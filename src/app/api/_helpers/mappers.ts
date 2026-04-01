// Row mappers: PostgreSQL snake_case → app camelCase
// Each mapper takes a raw DB row and returns the shape the app expects.

export function rowToStaff(r: any) {
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    password: r.password,
    role: r.role,
    department: r.department,
    jobTitle: r.job_title,
    status: r.status,
    suspended: r.suspended,
    first_login: r.first_login,
    mustChangePassword: r.must_change_password,
    points: r.points,
    streak: r.streak,
    currentWeekPoints: r.current_week_points,
    lastSubmittedWeek: r.last_submitted_week,
    badges: r.badges ?? [],
    profilePhoto: r.profile_photo,
    photoUrl: r.photo_url,
    phone: r.phone,
    leadId: r.lead_id,
    leadName: r.lead_name,
    staffType: r.staff_type,
    isIntern: r.is_intern,
    weekly_cap: r.weekly_cap != null ? Number(r.weekly_cap) : undefined,
    weekly_goal: r.weekly_goal,
    weeklyHourGoal: r.weekly_hour_goal,
    cdsDay: r.cds_day,
    fontSize: r.font_size,
    exemptFromTimesheet: r.exempt_from_timesheet,
    last_login: r.last_login,
    failed_attempts: r.failed_attempts,
    lockout_until: r.lockout_until,
    password_reset_pending: r.password_reset_pending,
    force_logout: r.force_logout,
    tour_done: r.tour_done,
    createdAt: r.created_at,
  }
}

export function staffToRow(d: any) {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    password: d.password,
    role: d.role ?? 'staff',
    department: d.department ?? '',
    job_title: d.jobTitle ?? null,
    status: d.status ?? 'active',
    suspended: d.suspended ?? false,
    first_login: d.first_login ?? true,
    must_change_password: d.mustChangePassword ?? false,
    points: d.points ?? 0,
    streak: d.streak ?? 0,
    current_week_points: d.currentWeekPoints ?? 0,
    last_submitted_week: d.lastSubmittedWeek ?? null,
    badges: JSON.stringify(d.badges ?? []),
    profile_photo: d.profilePhoto != null ? JSON.stringify(d.profilePhoto) : null,
    photo_url: d.photoUrl ?? null,
    phone: d.phone ?? null,
    lead_id: d.leadId ?? null,
    lead_name: d.leadName ?? null,
    staff_type: d.staffType ?? 'staff',
    is_intern: d.isIntern ?? false,
    weekly_cap: d.weekly_cap ?? null,
    weekly_goal: d.weekly_goal ?? null,
    weekly_hour_goal: d.weeklyHourGoal ?? null,
    cds_day: d.cdsDay ?? null,
    font_size: d.fontSize ?? null,
    exempt_from_timesheet: d.exemptFromTimesheet ?? false,
    last_login: d.last_login ?? null,
    failed_attempts: d.failed_attempts ?? 0,
    lockout_until: d.lockout_until ?? null,
    password_reset_pending: d.password_reset_pending ?? false,
    force_logout: d.force_logout ?? false,
    tour_done: d.tour_done ?? false,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToEntry(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    date: r.date,
    startDate: r.start_date,
    endDate: r.end_date,
    weekKey: r.week_key,
    project: r.project,
    category: r.category,
    description: r.description,
    hours: r.hours != null ? Number(r.hours) : 0,
    status: r.status,
    deleted: r.deleted,
    isNewTask: r.is_new_task ?? false,
    lead: r.lead,
    leadId: r.lead_id,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    approvedByName: r.approved_by_name,
    overriddenBy: r.overridden_by,
    overriddenAt: r.overridden_at,
    rejectionReason: r.rejection_reason,
    resubmitNote: r.resubmit_note,
    submittedAt: r.submitted_at,
    deletedAt: r.deleted_at,
    rejectedBy: r.rejected_by,
    rejectedAt: r.rejected_at,
    correctionNote: r.correction_note,
    clarifyNote: r.clarify_note,
    clarificationNote: r.clarification_note,
    corrected: r.corrected,
    overrideHistory: r.override_history ?? [],
    approvalHistory: r.approval_history ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function entryToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    staff_name: d.staffName ?? '',
    date: d.date ?? '',
    start_date: d.startDate ?? d.date ?? '',
    end_date: d.endDate ?? d.date ?? '',
    week_key: d.weekKey ?? '',
    project: d.project ?? '',
    category: d.category ?? '',
    description: d.description ?? '',
    hours: d.hours ?? 0,
    status: d.status ?? 'draft',
    deleted: d.deleted ?? false,
    is_new_task: d.isNewTask ?? false,
    lead: d.lead ?? null,
    lead_id: d.leadId || null,
    approved_by: d.approvedBy ?? null,
    approved_at: d.approvedAt ?? null,
    approved_by_name: d.approvedByName ?? null,
    overridden_by: d.overriddenBy ?? null,
    overridden_at: d.overriddenAt ?? null,
    rejection_reason: d.rejectionReason ?? null,
    resubmit_note: d.resubmitNote ?? null,
    submitted_at: d.submittedAt ?? null,
    deleted_at: d.deletedAt ?? null,
    rejected_by: d.rejectedBy ?? null,
    rejected_at: d.rejectedAt ?? null,
    correction_note: d.correctionNote ?? null,
    clarify_note: d.clarifyNote ?? null,
    clarification_note: d.clarificationNote ?? null,
    corrected: d.corrected ?? false,
    override_history: JSON.stringify(d.overrideHistory ?? []),
    approval_history: JSON.stringify(d.approvalHistory ?? []),
    created_at: d.createdAt ?? new Date().toISOString(),
    updated_at: d.updatedAt ?? new Date().toISOString(),
  }
}

export function rowToNotification(r: any) {
  if (!r) return null
  return {
    id: r.id,
    userId: r.user_id,
    message: r.message,
    type: r.type,
    read: r.read,
    title: r.title,
    linkedId: r.linked_id,
    linkedType: r.linked_type,
    createdAt: r.created_at,
  }
}

export function notificationToRow(d: any) {
  return {
    id: d.id,
    user_id: d.userId,
    message: d.message ?? '',
    type: d.type ?? 'info',
    read: d.read ?? false,
    title: d.title ?? 'New Notification',
    linked_id: d.linkedId ?? '',
    linked_type: d.linkedType ?? '',
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToApprovalDelegation(r: any) {
  if (!r) return null
  return {
    id: r.id,
    taskOwnerId: r.task_owner_id,
    taskOwnerName: r.task_owner_name,
    delegateId: r.delegate_id,
    delegateName: r.delegate_name,
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: r.is_active,
    reason: r.reason,
    projectId: r.project_id,
    projectName: r.project_name,
    projectIds: r.project_ids ?? [],
    projectNames: r.project_names ?? [],
    scope: r.scope,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
  }
}

export function approvalDelegationToRow(d: any) {
  return {
    id: d.id,
    task_owner_id: d.taskOwnerId,
    task_owner_name: d.taskOwnerName ?? '',
    delegate_id: d.delegateId,
    delegate_name: d.delegateName ?? '',
    start_date: d.startDate,
    end_date: d.endDate,
    is_active: d.isActive ?? true,
    reason: d.reason ?? null,
    project_id: d.projectId ?? null,
    project_name: d.projectName ?? null,
    project_ids: JSON.stringify(d.projectIds ?? []),
    project_names: JSON.stringify(d.projectNames ?? []),
    scope: d.scope ?? 'all',
    revoked_at: d.revokedAt ?? null,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToLeave(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    type: r.type,
    fromDate: r.from_date,
    toDate: r.to_date,
    reason: r.reason,
    status: r.status,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    rejectionReason: r.rejection_reason,
    leadApprovedBy: r.lead_approved_by,
    leadApprovedAt: r.lead_approved_at,
    leadId: r.lead_id,
    rejectedBy: r.rejected_by,
    rejectedAt: r.rejected_at,
    createdAt: r.created_at,
  }
}

export function leaveToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    staff_name: d.staffName ?? '',
    type: d.type ?? '',
    from_date: d.fromDate ?? '',
    to_date: d.toDate ?? '',
    reason: d.reason ?? null,
    status: d.status ?? 'pending',
    approved_by: d.approvedBy ?? null,
    approved_at: d.approvedAt ?? null,
    rejection_reason: d.rejectionReason ?? null,
    lead_approved_by: d.leadApprovedBy ?? null,
    lead_approved_at: d.leadApprovedAt ?? null,
    lead_id: d.leadId ?? null,
    rejected_by: d.rejectedBy ?? null,
    rejected_at: d.rejectedAt ?? null,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToReward(r: any) {
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    desc: r.description,
    cost: r.cost,
    icon: r.icon,
    active: r.active,
    stock: r.stock,
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
  }
}

export function rewardToRow(d: any) {
  return {
    id: d.id,
    name: d.name ?? '',
    description: d.desc ?? '',
    cost: d.cost ?? 0,
    icon: d.icon ?? '',
    active: d.active ?? true,
    stock: d.stock ?? 0,
    is_enabled: d.isEnabled ?? true,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToRedeem(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    rewardId: r.reward_id,
    rewardName: r.reward_name,
    cost: r.cost,
    status: r.status,
    fulfilledAt: r.fulfilled_at,
    createdAt: r.created_at,
  }
}

export function redeemToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    staff_name: d.staffName ?? '',
    reward_id: d.rewardId,
    reward_name: d.rewardName ?? '',
    cost: d.cost ?? 0,
    status: d.status ?? 'pending',
    fulfilled_at: d.fulfilledAt ?? null,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToAnnouncement(r: any) {
  if (!r) return null
  return {
    id: r.id,
    message: r.message,
    icon: r.icon,
    colour: r.colour,
    priority: r.priority,
    active: r.active,
    expiresAt: r.expires_at,
    expiryDate: r.expiry_date,
    createdBy: r.created_by,
    dismissedBy: r.dismissed_by ?? [],
    createdAt: r.created_at,
  }
}

export function announcementToRow(d: any) {
  return {
    id: d.id,
    message: d.message ?? '',
    icon: d.icon ?? '',
    colour: d.colour ?? '',
    priority: d.priority ?? 'medium',
    active: d.active ?? true,
    expires_at: d.expiresAt ?? null,
    expiry_date: d.expiryDate ?? null,
    created_by: d.createdBy ?? '',
    dismissed_by: JSON.stringify(d.dismissedBy ?? []),
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToPublicHoliday(r: any) {
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    capReduction: r.cap_reduction,
  }
}

export function publicHolidayToRow(d: any) {
  return {
    id: d.id,
    name: d.name ?? '',
    date: d.date ?? '',
    cap_reduction: d.capReduction ?? 8,
  }
}

export function rowToAuditLog(r: any) {
  if (!r) return null
  return {
    id: r.id,
    action: r.action,
    performedBy: r.performed_by,
    targetId: r.target_id,
    device: r.device,
    ipAddress: r.ip_address,
    metadata: r.metadata ?? {},
    timestamp: r.timestamp,
  }
}

export function auditLogToRow(d: any) {
  return {
    id: d.id,
    action: d.action ?? '',
    performed_by: d.performedBy ?? '',
    target_id: d.targetId ?? '',
    device: d.device ?? '',
    ip_address: d.ipAddress ?? 'Local Browser',
    metadata: JSON.stringify(d.metadata ?? {}),
    timestamp: d.timestamp ?? new Date().toISOString(),
  }
}

export function rowToProject(r: any) {
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    active: r.active,
    client: r.client,
    startDate: r.start_date,
    endDate: r.end_date,
    budget: r.budget != null ? Number(r.budget) : 0,
    ...(r.data ?? {}),
    createdAt: r.created_at,
  }
}

export function projectToRow(d: any) {
  const { id, name, description, active, client, startDate, endDate, budget, createdAt, ...rest } = d
  return {
    id,
    name: name ?? '',
    description: description ?? null,
    active: active ?? true,
    client: client ?? null,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
    budget: budget ?? 0,
    data: JSON.stringify(rest),
    created_at: createdAt ?? new Date().toISOString(),
  }
}

export function rowToWeekLock(r: any) {
  if (!r) return null
  return {
    id: r.id,
    weekId: r.week_id,
    isLocked: r.is_locked,
    lockedBy: r.locked_by,
    lockedAt: r.locked_at,
  }
}

export function weekLockToRow(d: any) {
  return {
    id: d.id,
    week_id: d.weekId,
    is_locked: d.isLocked ?? false,
    locked_by: d.lockedBy ?? '',
    locked_at: d.lockedAt ?? new Date().toISOString(),
  }
}

export function rowToDelegation(r: any) {
  if (!r) return null
  return {
    id: r.id,
    delegatorId: r.delegator_id,
    delegatorName: r.delegator_name,
    delegateeId: r.delegatee_id,
    delegateeName: r.delegatee_name,
    fromDate: r.from_date,
    untilDate: r.until_date,
    reason: r.reason,
    active: r.active,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
  }
}

export function delegationToRow(d: any) {
  return {
    id: d.id,
    delegator_id: d.delegatorId,
    delegator_name: d.delegatorName ?? '',
    delegatee_id: d.delegateeId,
    delegatee_name: d.delegateeName ?? '',
    from_date: d.fromDate ?? '',
    until_date: d.untilDate ?? '',
    reason: d.reason ?? null,
    active: d.active ?? true,
    revoked_at: d.revokedAt ?? null,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToHof(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    rank: r.rank,
    savedAt: r.saved_at,
    snapshot: r.snapshot,
  }
}

export function hofToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    rank: d.rank ?? 0,
    saved_at: d.savedAt ?? new Date().toISOString(),
    snapshot: JSON.stringify(d.snapshot ?? {}),
  }
}

export function rowToStreakRecovery(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    weekId: r.week_id,
    reason: r.reason,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }
}

export function streakRecoveryToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    staff_name: d.staffName ?? '',
    week_id: d.weekId ?? '',
    reason: d.reason ?? '',
    status: d.status ?? 'pending',
    reviewed_by: d.reviewedBy ?? null,
    reviewed_at: d.reviewedAt ?? null,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToPointsHistory(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    weekId: r.week_id,
    action: r.action,
    points: r.points,
    timestamp: r.timestamp,
  }
}

export function pointsHistoryToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId ?? null,
    week_id: d.weekId ?? '',
    action: d.action ?? '',
    points: d.points ?? 0,
    timestamp: d.timestamp ?? new Date().toISOString(),
  }
}

export function rowToPasswordResetRequest(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    requestedAt: r.requested_at,
    status: r.status,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
  }
}

export function passwordResetRequestToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    requested_at: d.requestedAt ?? new Date().toISOString(),
    status: d.status ?? 'pending',
    resolved_by: d.resolvedBy ?? null,
    resolved_at: d.resolvedAt ?? null,
  }
}

export function rowToResetRequest(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    email: r.email,
    requestedAt: r.requested_at,
    timestamp: r.requested_at, // compat alias used in ResetRequestsPage
    status: r.status,
  }
}

export function rowToWeekSubmission(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    weekKey: r.week_key,
    status: r.status,
    submittedAt: r.submitted_at,
    totalHours: r.total_hours != null ? Number(r.total_hours) : 0,
    latePenalty: r.late_penalty,
    isLate: r.is_late,
  }
}

export function rowToBudget(r: any) {
  if (!r) return null
  return { id: r.id, name: r.name, amount: r.amount, ...(r.data ?? {}), createdAt: r.created_at }
}

export function budgetToRow(d: any) {
  const { id, name, amount, createdAt, ...rest } = d
  return {
    id,
    name: name ?? '',
    amount: amount ?? 0,
    data: JSON.stringify(rest),
    created_at: createdAt ?? new Date().toISOString(),
  }
}

export function rowToTemplate(r: any) {
  if (!r) return null
  return {
    id: r.id,
    staffId: r.staff_id,
    name: r.name,
    project: r.project,
    projectId: r.project_id,
    lead: r.lead,
    leadId: r.lead_id,
    category: r.category,
    description: r.description,
    hours: r.hours != null ? Number(r.hours) : undefined,
    createdAt: r.created_at,
  }
}

export function templateToRow(d: any) {
  return {
    id: d.id,
    staff_id: d.staffId,
    name: d.name ?? '',
    project: d.project ?? null,
    project_id: d.projectId ?? null,
    lead: d.lead ?? null,
    lead_id: d.leadId ?? null,
    category: d.category ?? '',
    description: d.description ?? '',
    hours: d.hours ?? null,
    created_at: d.createdAt ?? new Date().toISOString(),
  }
}

export function rowToProjectBudget(r: any) {
  if (!r) return null
  return {
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    budgetHours: r.budget_hours != null ? Number(r.budget_hours) : 0,
    loggedHours: r.logged_hours != null ? Number(r.logged_hours) : 0,
    updatedAt: r.updated_at,
  }
}

export function projectBudgetToRow(d: any) {
  return {
    id: d.id,
    project_id: d.projectId,
    project_name: d.projectName ?? '',
    budget_hours: d.budgetHours ?? 0,
    logged_hours: d.loggedHours ?? 0,
    updated_at: d.updatedAt ?? new Date().toISOString(),
  }
}

export function rowToBulkImportLog(r: any) {
  if (!r) return null
  return {
    id: r.id,
    importedBy: r.imported_by,
    importedByName: r.imported_by_name,
    timestamp: r.timestamp,
    totalRows: r.total_rows,
    successCount: r.success_count,
    failCount: r.fail_count,
    errors: r.errors ?? [],
  }
}

export function bulkImportLogToRow(d: any) {
  return {
    id: d.id,
    imported_by: d.importedBy ?? '',
    imported_by_name: d.importedByName ?? '',
    timestamp: d.timestamp ?? new Date().toISOString(),
    total_rows: d.totalRows ?? 0,
    success_count: d.successCount ?? 0,
    fail_count: d.failCount ?? 0,
    errors: JSON.stringify(d.errors ?? []),
  }
}

export function rowToBulkStaffImportLog(r: any) {
  if (!r) return null
  return {
    id: r.id,
    importedBy: r.imported_by,
    timestamp: r.timestamp,
    totalRows: r.total_rows,
    newCount: r.new_count,
    existingCount: r.existing_count,
    invalidCount: r.invalid_count,
    errors: r.errors ?? [],
  }
}

export function bulkStaffImportLogToRow(d: any) {
  return {
    id: d.id,
    imported_by: d.importedBy ?? '',
    timestamp: d.timestamp ?? new Date().toISOString(),
    total_rows: d.totalRows ?? 0,
    new_count: d.newCount ?? 0,
    existing_count: d.existingCount ?? 0,
    invalid_count: d.invalidCount ?? 0,
    errors: JSON.stringify(d.errors ?? []),
  }
}

// Generic upsert builder: given a table name and a plain object (snake_case keys),
// generates the INSERT ... ON CONFLICT (id) DO UPDATE SET ... SQL.
export function buildUpsert(table: string, row: Record<string, any>): { text: string; values: any[] } {
  const keys = Object.keys(row)
  const placeholders = keys.map((_, i) => `$${i + 1}`)
  const updates = keys.filter(k => k !== 'id').map((k, i) => `${k} = $${keys.indexOf(k) + 1}`)
  const text = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}
  `
  return { text, values: Object.values(row) }
}
