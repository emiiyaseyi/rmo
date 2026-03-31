/**
 * One-time Firestore → PostgreSQL migration script.
 *
 * Prerequisites:
 *   1. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Save as: scripts/service-account.json
 *   2. npm install --save-dev firebase-admin tsx dotenv
 *   3. Ensure DATABASE_URL is set in .env (or .env.local)
 *
 * Run:
 *   npx tsx scripts/migrate-firestore-to-pg.ts
 *
 * The script is IDEMPOTENT — safe to re-run. Uses ON CONFLICT DO NOTHING.
 * Collections are inserted in dependency order (staff first because of FK references).
 */

import * as admin from 'firebase-admin'
import { Pool, PoolClient } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config({ path: path.join(__dirname, '../.env.local') })

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
const serviceAccount = require('./service-account.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const firestore = admin.firestore()

// ---------------------------------------------------------------------------
// PostgreSQL pool
// ---------------------------------------------------------------------------
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Firestore Timestamps and nested objects recursively */
function sanitize(val: any): any {
  if (val === null || val === undefined) return null
  if (val?.toDate) return val.toDate().toISOString()   // Firestore Timestamp
  if (Array.isArray(val)) return val.map(sanitize)
  if (typeof val === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(val)) out[k] = sanitize(v)
    return out
  }
  return val
}

/** Coerce a value to a number or null (handles empty strings from Firestore) */
function num(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

async function getAll(col: string): Promise<any[]> {
  const snap = await firestore.collection(col).get()
  console.log(`  ${col}: ${snap.size} docs`)
  return snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) }))
}

type InsertFn = (client: PoolClient, doc: any) => Promise<void>

async function migrateCollection(name: string, insertFn: InsertFn) {
  console.log(`\nMigrating ${name}...`)
  const docs = await getAll(name)
  const client = await pool.connect()
  let ok = 0, skip = 0
  try {
    for (const doc of docs) {
      try {
        await insertFn(client, doc)
        ok++
      } catch (err: any) {
        console.warn(`  SKIP ${doc.id}: ${err.message}`)
        skip++
      }
    }
  } finally {
    client.release()
  }
  console.log(`  ✓ ${ok} inserted, ${skip} skipped`)
}

// ---------------------------------------------------------------------------
// Per-collection insert functions
// ---------------------------------------------------------------------------

async function insertStaff(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO staff (id,name,email,password,role,department,job_title,status,suspended,
      first_login,must_change_password,points,streak,current_week_points,last_submitted_week,
      badges,profile_photo,photo_url,phone,lead_id,lead_name,staff_type,is_intern,
      weekly_cap,weekly_goal,weekly_hour_goal,cds_day,font_size,exempt_from_timesheet,
      last_login,failed_attempts,lockout_until,password_reset_pending,force_logout,
      tour_done,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
    ON CONFLICT (id) DO NOTHING`,
    [
      d.id, d.name ?? '', d.email ?? '', d.password ?? '', d.role ?? 'staff',
      d.department ?? '', d.jobTitle ?? null,
      d.status ?? 'active', d.suspended ?? false,
      d.first_login ?? true, d.mustChangePassword ?? false,
      num(d.points) ?? 0, num(d.streak) ?? 0, num(d.currentWeekPoints) ?? 0,
      d.lastSubmittedWeek ?? null,
      JSON.stringify(d.badges ?? []),
      d.profilePhoto ? JSON.stringify(d.profilePhoto) : null,
      d.photoUrl ?? null, d.phone ?? null,
      null,  // lead_id: filled in pass 2
      d.leadName ?? null,
      d.staffType ?? 'staff', d.isIntern ?? false,
      num(d.weekly_cap), num(d.weekly_goal), num(d.weeklyHourGoal),
      d.cdsDay ?? null, num(d.fontSize), d.exemptFromTimesheet ?? false,
      d.last_login ?? null,
      num(d.failed_attempts) ?? 0, d.lockout_until ?? null,
      d.password_reset_pending ?? false, d.force_logout ?? false,
      d.tour_done ?? false,
      d.createdAt ?? new Date().toISOString(),
    ]
  )
}


async function insertApprovalDelegation(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO approval_delegations (id,task_owner_id,task_owner_name,delegate_id,delegate_name,
      start_date,end_date,is_active,reason,project_id,project_name,project_ids,project_names,
      scope,revoked_at,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (id) DO NOTHING`,
    [d.id, d.taskOwnerId, d.taskOwnerName ?? '', d.delegateId, d.delegateName ?? '',
     d.startDate ?? '', d.endDate ?? '', d.isActive ?? true, d.reason ?? null,
     d.projectId ?? null, d.projectName ?? null,
     JSON.stringify(d.projectIds ?? []), JSON.stringify(d.projectNames ?? []),
     d.scope ?? 'all', d.revokedAt ?? null, d.createdAt ?? new Date().toISOString()]
  )
}

async function insertLeave(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO leaves (id,staff_id,staff_name,type,from_date,to_date,reason,status,
      approved_by,approved_at,rejection_reason,lead_approved_by,lead_approved_at,
      lead_id,rejected_by,rejected_at,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (id) DO NOTHING`,
    [d.id, d.staffId, d.staffName ?? '', d.type ?? '', d.fromDate ?? '',
     d.toDate ?? '', d.reason ?? null, d.status ?? 'pending',
     d.approvedBy ?? null, d.approvedAt ?? null, d.rejectionReason ?? null,
     d.leadApprovedBy ?? null, d.leadApprovedAt ?? null, d.leadId ?? null,
     d.rejectedBy ?? null, d.rejectedAt ?? null, d.createdAt ?? new Date().toISOString()]
  )
}

async function insertReward(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO rewards (id,name,description,cost,icon,active,stock,is_enabled,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
    [d.id, d.name ?? '', d.desc ?? d.description ?? '', d.cost ?? 0, d.icon ?? '',
     d.active ?? true, d.stock ?? 0, d.isEnabled ?? true, d.createdAt ?? new Date().toISOString()]
  )
}


async function insertAnnouncement(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO announcements (id,message,icon,colour,priority,active,expires_at,expiry_date,
      created_by,dismissed_by,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
    [d.id, d.message ?? '', d.icon ?? '', d.colour ?? '', d.priority ?? 'medium',
     d.active ?? true, d.expiresAt ?? null, d.expiryDate ?? null, d.createdBy ?? '',
     JSON.stringify(d.dismissedBy ?? []), d.createdAt ?? new Date().toISOString()]
  )
}

async function insertPublicHoliday(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO public_holidays (id,name,date,cap_reduction)
    VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
    [d.id, d.name ?? '', d.date ?? '', d.capReduction ?? 8]
  )
}


async function insertProject(c: PoolClient, d: any) {
  const { id, name, description, active, client, startDate, endDate, budget, createdAt, ...rest } = d
  await c.query(`
    INSERT INTO projects (id,name,description,active,client,start_date,end_date,budget,data,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
    [id, name ?? '', description ?? null, active ?? true, client ?? null,
     startDate ?? null, endDate ?? null, budget ?? 0, JSON.stringify(rest),
     createdAt ?? new Date().toISOString()]
  )
}


// ---------------------------------------------------------------------------
// Settings (3 documents: 'global', 'features', 'lockedWeeks')
// ---------------------------------------------------------------------------
async function migrateSettings() {
  console.log('\nMigrating settings...')
  const client = await pool.connect()
  try {
    for (const key of ['global', 'features', 'lockedWeeks']) {
      const snap = await firestore.collection('settings').doc(key).get()
      if (snap.exists) {
        await client.query(
          `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, JSON.stringify(sanitize(snap.data()))]
        )
        console.log(`  settings/${key}: migrated`)
      }
    }
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// Pass 2: update lead_id self-references in staff table
// ---------------------------------------------------------------------------
async function updateStaffLeadIds() {
  console.log('\nPass 2: updating staff.lead_id self-references...')
  const snap = await firestore.collection('staff').get()
  const client = await pool.connect()
  let updated = 0
  try {
    for (const doc of snap.docs) {
      const d = sanitize(doc.data())
      if (d.leadId) {
        try {
          await client.query(
            'UPDATE staff SET lead_id = $1 WHERE id = $2 AND lead_id IS NULL',
            [d.leadId, doc.id]
          )
          updated++
        } catch {
          console.warn(`  SKIP lead_id ${d.leadId} for staff ${doc.id}: lead not in table`)
        }
      }
    }
  } finally {
    client.release()
  }
  console.log(`  ${updated} lead_id references updated`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Firestore → PostgreSQL Migration ===')
  console.log(`Target: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`)

  // Staff MUST go first (FK anchor for everything else)
  await migrateCollection('staff', insertStaff)
  await updateStaffLeadIds()

  // Essential reference data
  await migrateCollection('projects',            insertProject)
  await migrateCollection('announcements',       insertAnnouncement)
  await migrateCollection('publicHolidays',      insertPublicHoliday)
  await migrateCollection('leaves',              insertLeave)
  await migrateCollection('approvalDelegations', insertApprovalDelegation)
  await migrateCollection('rewards',             insertReward)

  // App configuration
  await migrateSettings()

  // Skipped (log/transactional data — start fresh):
  //   timesheetEntries, notifications, auditLogs, pointsHistory, hof,
  //   redeems, weekLocks, weekSubmissions, streakRecoveries, delegations,
  //   budgets, templates, projectBudgets, bulkImportLogs, bulkStaffImportLogs,
  //   passwordResetRequests, reset_requests

  await pool.end()
  console.log('\n=== Migration complete ===')
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
