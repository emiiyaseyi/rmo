-- =============================================
-- DSN HR RMO — PostgreSQL 18 Schema
-- Run: psql $DATABASE_URL -f src/db/schema.sql
-- =============================================

-- 1. staff (insert first — all other tables FK into this)
CREATE TABLE IF NOT EXISTS staff (
    id                     TEXT PRIMARY KEY,
    name                   TEXT NOT NULL,
    email                  TEXT NOT NULL UNIQUE,
    password               TEXT NOT NULL,
    role                   TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff','team_lead','admin')),
    department             TEXT NOT NULL DEFAULT '',
    job_title              TEXT,
    status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
    suspended              BOOLEAN DEFAULT FALSE,
    first_login            BOOLEAN DEFAULT TRUE,
    must_change_password   BOOLEAN DEFAULT FALSE,
    points                 INTEGER DEFAULT 0,
    streak                 INTEGER DEFAULT 0,
    current_week_points    INTEGER DEFAULT 0,
    last_submitted_week    TEXT,
    badges                 JSONB DEFAULT '[]',
    profile_photo          JSONB,
    photo_url              TEXT,
    phone                  TEXT,
    lead_id                TEXT,  -- self-ref added after insert via ALTER
    lead_name              TEXT,
    staff_type             TEXT DEFAULT 'staff' CHECK (staff_type IN ('staff','intern')),
    is_intern              BOOLEAN DEFAULT FALSE,
    weekly_cap             NUMERIC(5,2),
    weekly_goal            INTEGER,
    weekly_hour_goal       INTEGER,
    cds_day                TEXT CHECK (cds_day IN ('monday','tuesday','wednesday','thursday','friday')),
    font_size              TEXT,
    exempt_from_timesheet  BOOLEAN DEFAULT FALSE,
    last_login             TIMESTAMPTZ,
    failed_attempts        INTEGER DEFAULT 0,
    lockout_until          TIMESTAMPTZ,
    password_reset_pending BOOLEAN DEFAULT FALSE,
    force_logout           BOOLEAN DEFAULT FALSE,
    tour_done              BOOLEAN DEFAULT FALSE,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);
-- Self-referencing FK added separately so migration can do two-pass inserts
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_lead_id_fkey;
ALTER TABLE staff ADD CONSTRAINT staff_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES staff(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- 2. timesheet_entries
CREATE TABLE IF NOT EXISTS timesheet_entries (
    id                 TEXT PRIMARY KEY,
    staff_id           TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    staff_name         TEXT NOT NULL,
    date               TEXT NOT NULL,
    start_date         TEXT NOT NULL,
    end_date           TEXT NOT NULL,
    week_key           TEXT NOT NULL,
    project            TEXT NOT NULL,
    category           TEXT NOT NULL DEFAULT '',
    description        TEXT NOT NULL DEFAULT '',
    hours              NUMERIC(5,2) NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','submitted','approved','rejected','resubmitted',
                                         'clarification_needed','pending_clarification','pending_2nd_approval')),
    deleted            BOOLEAN DEFAULT FALSE,
    is_new_task        BOOLEAN DEFAULT FALSE,
    lead               TEXT,
    lead_id            TEXT,
    approved_by        TEXT,
    approved_at        TIMESTAMPTZ,
    approved_by_name   TEXT,
    overridden_by      TEXT,
    overridden_at      TIMESTAMPTZ,
    rejection_reason   TEXT,
    resubmit_note      TEXT,
    submitted_at       TIMESTAMPTZ,
    deleted_at         TIMESTAMPTZ,
    rejected_by        TEXT,
    rejected_at        TIMESTAMPTZ,
    correction_note    TEXT,
    clarify_note       TEXT,
    clarification_note TEXT,
    corrected          BOOLEAN DEFAULT FALSE,
    override_history   JSONB DEFAULT '[]',
    approval_history   JSONB DEFAULT '[]',
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entries_staff_id  ON timesheet_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_entries_week_key  ON timesheet_entries(week_key);
CREATE INDEX IF NOT EXISTS idx_entries_status    ON timesheet_entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_deleted   ON timesheet_entries(deleted);
CREATE INDEX IF NOT EXISTS idx_entries_created   ON timesheet_entries(created_at DESC);

-- 3. notifications
CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'info',
    read        BOOLEAN DEFAULT FALSE,
    title       TEXT DEFAULT 'New Notification',
    linked_id   TEXT DEFAULT '',
    linked_type TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifs_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_read       ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifs_created_at ON notifications(created_at DESC);

-- 4. approval_delegations
CREATE TABLE IF NOT EXISTS approval_delegations (
    id               TEXT PRIMARY KEY,
    task_owner_id    TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    task_owner_name  TEXT NOT NULL DEFAULT '',
    delegate_id      TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    delegate_name    TEXT NOT NULL DEFAULT '',
    start_date       TEXT NOT NULL,
    end_date         TEXT NOT NULL,
    is_active        BOOLEAN DEFAULT TRUE,
    reason           TEXT,
    project_id       TEXT,
    project_name     TEXT,
    project_ids      JSONB DEFAULT '[]',
    project_names    JSONB DEFAULT '[]',
    scope            TEXT DEFAULT 'all' CHECK (scope IN ('all','project','projects')),
    revoked_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apprdel_owner    ON approval_delegations(task_owner_id);
CREATE INDEX IF NOT EXISTS idx_apprdel_delegate ON approval_delegations(delegate_id);

-- 5. leaves
CREATE TABLE IF NOT EXISTS leaves (
    id               TEXT PRIMARY KEY,
    staff_id         TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    staff_name       TEXT NOT NULL,
    type             TEXT NOT NULL,
    from_date        TEXT NOT NULL,
    to_date          TEXT NOT NULL,
    reason           TEXT,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','lead_approved','approved','rejected')),
    approved_by      TEXT,
    approved_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    lead_approved_by TEXT,
    lead_approved_at TIMESTAMPTZ,
    lead_id          TEXT,
    rejected_by      TEXT,
    rejected_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leaves_staff_id ON leaves(staff_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status   ON leaves(status);

-- 6. rewards
CREATE TABLE IF NOT EXISTS rewards (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cost       INTEGER NOT NULL DEFAULT 0,
    icon       TEXT NOT NULL DEFAULT '',
    active     BOOLEAN DEFAULT TRUE,
    stock      INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. redeems
CREATE TABLE IF NOT EXISTS redeems (
    id           TEXT PRIMARY KEY,
    staff_id     TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    staff_name   TEXT NOT NULL DEFAULT '',
    reward_id    TEXT NOT NULL,
    reward_name  TEXT NOT NULL DEFAULT '',
    cost         INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','rejected')),
    fulfilled_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redeems_staff_id ON redeems(staff_id);

-- 8. hof (hall of fame snapshot)
CREATE TABLE IF NOT EXISTS hof (
    id       TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    rank     INTEGER NOT NULL,
    saved_at TEXT NOT NULL,
    snapshot JSONB NOT NULL
);

-- 9. announcements
CREATE TABLE IF NOT EXISTS announcements (
    id           TEXT PRIMARY KEY,
    message      TEXT NOT NULL,
    icon         TEXT NOT NULL DEFAULT '',
    colour       TEXT NOT NULL DEFAULT '',
    priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    active       BOOLEAN DEFAULT TRUE,
    expires_at   TIMESTAMPTZ,
    expiry_date  TEXT,
    created_by   TEXT NOT NULL DEFAULT '',
    dismissed_by JSONB DEFAULT '[]',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 10. public_holidays
CREATE TABLE IF NOT EXISTS public_holidays (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    date          TEXT NOT NULL,
    cap_reduction INTEGER DEFAULT 8,
    type          TEXT DEFAULT 'public'
);

-- 11. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id           TEXT PRIMARY KEY,
    action       TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    target_id    TEXT NOT NULL,
    device       TEXT DEFAULT '',
    ip_address   TEXT DEFAULT 'Local Browser',
    metadata     JSONB DEFAULT '{}',
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- 12. projects
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    active      BOOLEAN DEFAULT TRUE,
    client      TEXT,
    start_date  TEXT,
    end_date    TEXT,
    budget      NUMERIC(12,2) DEFAULT 0,
    data        JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 13. settings (key-value: 'global', 'features', 'lockedWeeks')
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings(key, value) VALUES
    ('global',      '{}'),
    ('features',    '{}'),
    ('lockedWeeks', '{"lockedWeeks":[]}')
ON CONFLICT (key) DO NOTHING;

-- 14. reset_requests (password reset queue shown in admin panel)
CREATE TABLE IF NOT EXISTS reset_requests (
    id           TEXT PRIMARY KEY,
    staff_id     TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    staff_name   TEXT NOT NULL DEFAULT '',
    email        TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
    resolved_by  TEXT,
    resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reset_req_staff ON reset_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_reset_req_ts    ON reset_requests(requested_at DESC);

-- 15. active_sessions (heartbeat — 30s updates)
CREATE TABLE IF NOT EXISTS active_sessions (
    user_id    TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
    user_name  TEXT NOT NULL,
    email      TEXT NOT NULL,
    role       TEXT NOT NULL,
    department TEXT DEFAULT '',
    last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    login_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON active_sessions(last_seen DESC);

-- 16. week_locks
CREATE TABLE IF NOT EXISTS week_locks (
    id        TEXT PRIMARY KEY,
    week_id   TEXT NOT NULL UNIQUE,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by TEXT NOT NULL DEFAULT '',
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. delegations (absence/cover, separate from approval_delegations)
CREATE TABLE IF NOT EXISTS delegations (
    id             TEXT PRIMARY KEY,
    delegator_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    delegator_name TEXT NOT NULL DEFAULT '',
    delegatee_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    delegatee_name TEXT NOT NULL DEFAULT '',
    from_date      TEXT NOT NULL,
    until_date     TEXT NOT NULL,
    reason         TEXT,
    active         BOOLEAN DEFAULT TRUE,
    revoked_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 18. budgets
CREATE TABLE IF NOT EXISTS budgets (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT '',
    amount     NUMERIC(12,2) DEFAULT 0,
    data       JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. templates
CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    staff_id    TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    project     TEXT,
    project_id  TEXT,
    lead        TEXT,
    lead_id     TEXT,
    category    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    hours       NUMERIC(5,2),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_staff_id ON templates(staff_id);

-- 20. project_budgets
CREATE TABLE IF NOT EXISTS project_budgets (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL DEFAULT '',
    budget_hours NUMERIC(8,2) DEFAULT 0,
    logged_hours NUMERIC(8,2) DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proj_budgets ON project_budgets(project_id);

-- 21. bulk_import_logs
CREATE TABLE IF NOT EXISTS bulk_import_logs (
    id               TEXT PRIMARY KEY,
    imported_by      TEXT NOT NULL,
    imported_by_name TEXT NOT NULL DEFAULT '',
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_rows       INTEGER DEFAULT 0,
    success_count    INTEGER DEFAULT 0,
    fail_count       INTEGER DEFAULT 0,
    errors           JSONB DEFAULT '[]'
);

-- 22. bulk_staff_import_logs
CREATE TABLE IF NOT EXISTS bulk_staff_import_logs (
    id             TEXT PRIMARY KEY,
    imported_by    TEXT NOT NULL,
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_rows     INTEGER DEFAULT 0,
    new_count      INTEGER DEFAULT 0,
    existing_count INTEGER DEFAULT 0,
    invalid_count  INTEGER DEFAULT 0,
    errors         JSONB DEFAULT '[]'
);

-- 23. streak_recoveries
CREATE TABLE IF NOT EXISTS streak_recoveries (
    id          TEXT PRIMARY KEY,
    staff_id    TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    staff_name  TEXT NOT NULL DEFAULT '',
    week_id     TEXT NOT NULL,
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 24. points_history
CREATE TABLE IF NOT EXISTS points_history (
    id        TEXT PRIMARY KEY,
    staff_id  TEXT REFERENCES staff(id) ON DELETE CASCADE,
    week_id   TEXT NOT NULL,
    action    TEXT NOT NULL,
    points    INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pts_history_staff ON points_history(staff_id);

-- 25. password_reset_requests (in-app request button — different from reset_requests)
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id           TEXT PRIMARY KEY,
    staff_id     TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
    resolved_by  TEXT,
    resolved_at  TIMESTAMPTZ
);

-- 26. week_submissions
CREATE TABLE IF NOT EXISTS week_submissions (
    id           TEXT PRIMARY KEY,
    staff_id     TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    week_key     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','no_work')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_hours  NUMERIC(6,2) DEFAULT 0,
    late_penalty INTEGER,
    is_late      BOOLEAN DEFAULT FALSE,
    UNIQUE(staff_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_week_sub_staff ON week_submissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_week_sub_week  ON week_submissions(week_key);

-- 27. review_window_log (tracks per-cycle: email sent, 24h deadline, penalty applied)
CREATE TABLE IF NOT EXISTS review_window_log (
    week_key         TEXT PRIMARY KEY,
    notified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    review_deadline  TIMESTAMPTZ NOT NULL,
    penalty_applied  BOOLEAN DEFAULT FALSE,
    penalty_applied_at TIMESTAMPTZ
);
