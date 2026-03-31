/**
 * One-time migration: Firestore timesheetEntries → PostgreSQL
 *
 * Run after the main migration (migrate-firestore-to-pg.ts) has completed.
 * Requires DATABASE_URL pointing at the target database.
 *
 * Run:
 *   npx tsx scripts/migrate-timesheet-entries.ts
 */

import * as admin from 'firebase-admin'
import { Pool, PoolClient } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const serviceAccount = require('./service-account.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const firestore = admin.firestore()

const pool = new Pool({ connectionString: process.env.LIVE_DATABASE_URL })

function sanitize(val: any): any {
  if (val === null || val === undefined) return null
  if (val?.toDate) return val.toDate().toISOString()
  if (Array.isArray(val)) return val.map(sanitize)
  if (typeof val === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(val)) out[k] = sanitize(v)
    return out
  }
  return val
}

function num(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

async function insertTimesheetEntry(c: PoolClient, d: any) {
  await c.query(`
    INSERT INTO timesheet_entries (id,staff_id,staff_name,date,start_date,end_date,week_key,
      project,category,description,hours,status,deleted,lead,lead_id,approved_by,approved_at,
      approved_by_name,overridden_by,overridden_at,rejection_reason,resubmit_note,submitted_at,
      deleted_at,rejected_by,rejected_at,correction_note,clarify_note,clarification_note,
      corrected,override_history,approval_history,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
    ON CONFLICT (id) DO NOTHING`,
    [
      d.id, d.staffId, d.staffName ?? '', d.date ?? '', d.startDate ?? d.date ?? '',
      d.endDate ?? d.date ?? '', d.weekKey ?? '', d.project ?? '', d.category ?? '',
      d.description ?? '', num(d.hours) ?? 0, d.status ?? 'draft', d.deleted ?? false,
      d.lead ?? null, d.leadId ?? null, d.approvedBy ?? null, d.approvedAt ?? null,
      d.approvedByName ?? null, d.overriddenBy ?? null, d.overriddenAt ?? null,
      d.rejectionReason ?? null, d.resubmitNote ?? null, d.submittedAt ?? null,
      d.deletedAt ?? null, d.rejectedBy ?? null, d.rejectedAt ?? null,
      d.correctionNote ?? null, d.clarifyNote ?? null, d.clarificationNote ?? null,
      d.corrected ?? false,
      JSON.stringify(d.overrideHistory ?? []),
      JSON.stringify(d.approvalHistory ?? []),
      d.createdAt ?? new Date().toISOString(),
      d.updatedAt ?? new Date().toISOString(),
    ]
  )
}

async function main() {
  console.log('=== Migrating timesheetEntries → PostgreSQL ===')
  console.log(`Target: ${process.env.LIVE_DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`)

  const snap = await firestore.collection('timesheetEntries').get()
  console.log(`\n  timesheetEntries: ${snap.size} docs`)

  const client = await pool.connect()
  let ok = 0, skip = 0
  try {
    for (const doc of snap.docs) {
      const d = { id: doc.id, ...sanitize(doc.data()) }
      try {
        await insertTimesheetEntry(client, d)
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
  await pool.end()
  console.log('\n=== Done ===')
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
