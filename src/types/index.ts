export interface Staff {
    id: string;
    name: string;
    email: string;
    password: string;
    role: 'staff' | 'team_lead' | 'admin';
    department: string;
    jobTitle?: string;
    status: 'active' | 'suspended';
    suspended?: boolean; // Keep for compatibility
    first_login?: boolean; // Keep for compatibility
    mustChangePassword?: boolean;
    points?: number;
    last_login?: string;
    createdAt?: string;
    failed_attempts?: number;
    lockout_until?: string;
    password_reset_pending?: boolean;
    force_logout?: boolean;
    forceLogout?: boolean; // Align with story
    tour_done?: boolean;
    leadId?: string;
    staffType?: 'staff' | 'intern';
    isIntern?: boolean; // Convenience flag
    weekly_cap?: number | string;
    streak?: number;
    weekly_goal?: number;
    
    // Gamification extension
    currentWeekPoints?: number;
    lastSubmittedWeek?: string;
    badges?: string[];
    pointsHistory?: PointsHistoryEntry[];

    leadName?: string;
    phone?: string;
    photo?: string | null;
    photoUrl?: string | null; // Align with story
    profilePhoto?: {
        base64: string;
        uploadedAt: string;
        fileSize: number;
        mimeType: "image/jpeg" | "image/png" | "image/webp";
    } | null;
    cdsDay?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | null;
    weeklyHourGoal?: number;
    fontSize?: string | number;
    exemptFromTimesheet?: boolean;
}

export interface ApprovalHistoryEntry {
    id: string;
    action: 'approved' | 'rejected' | 'clarification' | 'correction' | '2nd_level_approved' | '2nd_level_rejected';
    reviewerId: string;
    reviewerName: string;
    reviewerRole: string;
    note?: string;
    timestamp: string;
    correctedHours?: number;
}

export interface Entry {
    id: string;
    staffId: string;
    staffName: string;
    date: string;     // kept for backwards compat — equals startDate for new entries
    startDate: string;
    endDate: string;
    weekKey: string;
    project: string;
    category: string;
    description: string;
    hours: number;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'resubmitted' | 'clarification_needed' | 'pending_clarification' | 'pending_2nd_approval';
    deleted?: boolean;
    isNewTask?: boolean;
    createdAt: string;
    updatedAt?: string;
    approvedBy?: string;
    approvedAt?: string;
    approvedByName?: string;
    lead?: string;
    leadId?: string;
    overriddenBy?: string;
    overriddenAt?: string;
    overrideHistory?: OverrideLog[];
    approvalHistory?: ApprovalHistoryEntry[];
    rejectionReason?: string;
    resubmitNote?: string;
    submittedAt?: string;
    deletedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    correctionNote?: string;
    clarifyNote?: string;
    clarificationNote?: string;
    corrected?: boolean;
}

export interface OverrideLog {
    id: string;
    adminId: string;
    adminName: string;
    fieldName: string;
    oldValue: any;
    newValue: any;
    note?: string;
    timestamp: string;
}

export interface WeekSubmission {
    id: string; // staffId_weekKey
    staffId: string;
    weekKey: string;
    status: 'submitted' | 'no_work';
    submittedAt: string;
    totalHours: number;
    latePenalty?: number; // Points deducted for late submission
    isLate?: boolean; // Whether submitted after deadline
}

export interface AppNotification {
    id: string;
    userId: string;
    message: string;
    type: string;
    read: boolean;
    createdAt: string;
    title?: string;
    linkedId?: string;
    linkedType?: 'entry' | 'message' | 'redemption' | 'request' | 'streak_recovery' | 'project' | string;
}

export interface MessageThread {
    id: string;
    type: 'direct' | 'group';
    name: string | null;
    icon: string | null;
    participants: string[];
    lastMessage: string | null;
    lastMessageAt: string | null;
    lastMessageBy: string | null;
    createdAt: string;
}

export interface AppMessage {
    id: string;
    senderId: string;
    senderName?: string;
    recipientId?: string;
    channelId?: string;
    threadId?: string;
    text: string;
    content?: string; // Alias for text
    type: 'dm' | 'channel';
    read: string[];
    readBy?: string[]; // Alias for read
    sentAt?: string; // Alias for createdAt
    createdAt: string;
}

export interface UnreadCount {
    id: string; // staffId
    threads: Record<string, number>;
    total: number;
}

export interface Holiday {
    id: string;
    date: string;
    name: string;
}

export interface FAQ {
    id: string;
    q: string;
    a: string;
}

export interface AppSettings {
    branding?: {
        appName: string;
        welcomeMessage: string;
        primaryColour: string;
        secondaryColour: string;
        logoBase64: string | null;
        logoUploadedAt?: string;
    };
    featureToggles: {
        gamification: boolean;
        leaderboard: boolean;
        messaging: boolean;
        bulkImports: boolean;
        darkMode: boolean;
        twoFactorAdminsLeads: boolean;
        deadlineCountdown: boolean;
        firstLoginWalkthrough: boolean;
        approvalDelegation: boolean;
        pdfExport: boolean;
        profilePhotos: boolean;
        streakRecovery: boolean;
        duplicateDetection: boolean;
        announcements: boolean;
        orgChart: boolean;
    };
    pointsConfig: {
        onTimeSubmission: number;
        approvedEntry: number;
        approvedWithNote: number;
        perfectWeek: number;
        hoursBonus: number;
        streakBonus: number;
    };
    hourCaps: {
        defaultStaffCap: number;
        internCap: number;
        cdsVisibility: boolean;
        customCaps: { staffId: string; cap: number; label: string }[];
        deadlineOverride?: string | null;
    };
    approvalWorkflow: {
        secondLevelEnabled: boolean;
        secondLevelThreshold: number;
    };
    idleTimeout: {
        minutes: number;
    };
    reviewWindow?: {
        enabled: boolean;
        hoursAfterClose: number; // hours after submission window close, default 24
        penaltyPerEntry: number; // points deducted per unreviewed entry, e.g. -5
    };
    submissionWindow: {
        enabled: boolean;
        schedule: {
            startDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
            startTime: string; // HH:mm format
            endDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
            endTime: string; // HH:mm format
        };
        latePenalty: {
            enabled: boolean;
            pointsPerPeriod: number; // e.g., -5
            periodHours: number; // e.g., 12
        };
        timezone: string; // e.g., 'Africa/Windhoek' for WAT
    };
    categories: string[];
    utilizationThresholds?: {
        low: number;
        high: number;
    };
    security?: {
        defaultPassword?: string;
        requireTwoFactor?: boolean;
    };
    // Keep legacy fields for compatibility during migration if needed
    app_name?: string;
    welcome_message?: string;
    accent_color?: string;
    weekly_cap?: number;
    idle_minutes?: number;
    points?: { [key: string]: number | undefined };
    holidays?: Holiday[];
    announcement?: { message: string, icon: string, color: string, expires?: string } | null;
}

export interface PublicHoliday {
    id: string;
    name: string;
    date: string;
    capReduction: number;
}

export interface Announcement {
    id: string;
    message: string;
    icon: string;
    colour: string;
    priority: 'low' | 'medium' | 'high';
    active: boolean;
    expiresAt?: string;
    expiryDate: string; // Keep for compatibility
    createdBy: string;
    dismissedBy: string[];
}

export interface WeekLock {
    id: string;
    weekId: string;
    isLocked: boolean;
    lockedBy: string;
    lockedAt: string;
}

export interface AuditLog {
    id: string;
    action: 'login' | 'logout' | 'submit' | 'approve' | 'reject' |
            'override' | 'import' | 'password_reset' | 'force_logout' |
            'settings_change' | 'delete' | 'restore';
    performedBy: string;
    targetId: string;
    device: string;
    ipAddress: string;
    timestamp: string;
    metadata: any;
}


export interface PasswordResetRequest {
    id: string;
    staffId: string;
    requestedAt: string;
    status: 'pending' | 'resolved';
    resolvedBy?: string;
    resolvedAt?: string;
}

export interface Template {
    id: string;
    staffId: string;
    userId?: string; // Alias for compatibility
    projectId?: string;
    project?: string; // Support both formats
    leadId?: string;
    lead?: string; // Support both formats
    category: string;
    description: string;
    hours?: number;
    name: string;
    createdAt: string;
    ownerId?: string; // For backward compatibility
}

export interface Delegation {
    id: string;
    delegatorId: string;
    delegatorName: string;
    delegateeId: string;
    delegateeName: string;
    from: string;
    until: string;
    reason?: string;
    active: boolean;
    createdAt: string;
    revokedAt?: string;
}

export interface ApprovalDelegation {
    id: string;
    taskOwnerId: string;
    taskOwnerName: string;
    delegateId: string;
    delegateName: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt: string;
    revokedAt?: string;
    reason?: string;
    projectId?: string;
    projectName?: string;
    projectIds?: string[]; // Support for multiple projects
    projectNames?: string[]; // Support for multiple project names
    scope?: 'all' | 'project' | 'projects'; // 'all' for all approvals, 'project' for single project (legacy), 'projects' for multiple projects
}

export interface Reward {
    id: string;
    name: string;
    desc: string;
    cost: number;
    icon: string;
    active: boolean;
    stock: number;
    isEnabled: boolean;
    createdAt: string;
}

export interface Redemption {
    id: string;
    staffId: string;
    staffName: string;
    rewardId: string;
    rewardName: string;
    cost: number;
    createdAt: string;
    status: 'pending' | 'fulfilled' | 'rejected';
    fulfilledAt?: string;
}

export interface StreakRecoveryRequest {
    id: string;
    staffId: string;
    staffName: string;
    weekId: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    createdAt: string;
}

export interface PointsHistoryEntry {
    id: string;
    weekId: string;
    action: string;
    points: number;
    timestamp: string;
}

export interface HofEntry extends Staff {
    rank: number;
    savedAt: string;
}

export interface ProjectBudget {
    id: string;
    projectId: string;
    projectName: string;
    budgetHours: number;
    loggedHours: number;
    updatedAt: string;
}

export interface BulkStaffImportLog {
    id: string;
    importedBy: string;
    timestamp: string;
    totalRows: number;
    newCount: number;
    existingCount: number;
    invalidCount: number;
    errors: Array<{
        row: number;
        reason: string;
    }>;
}

export interface BulkImportLog {
    id: string;
    importedBy: string;
    importedByName: string;
    timestamp: string;
    totalRows: number;
    successCount: number;
    failCount: number;
    errors: Array<{
        row: number;
        reason: string;
        data?: any;
    }>;
}

export interface AppContextType {
    user: Staff | null;
    staff: Staff[];
    entries: Entry[];
    announcements: Announcement[];
    notifications: AppNotification[];

    hof: HofEntry[];
    bulkStaffImportLogs: BulkStaffImportLog[];
    rewards: Reward[];
    redeems: Redemption[];
    settings: AppSettings | null;
    darkMode: boolean;
    online: boolean;
    unreadCount: number;
    login: (s: Staff) => void;
    logout: () => void;
    updateUser: (updates: Partial<Staff>) => void;
    toggleDark: () => void;
    saveStaff: (data: Staff[]) => void;
    saveEntries: (data: Entry[]) => void;
    saveAnnouncements: (data: Announcement[]) => void;
    saveNotifications: (data: AppNotification[]) => void;
    saveHof: (data: HofEntry[]) => void;
    saveRewards: (data: Reward[]) => void;
    saveRedeems: (data: Redemption[]) => void;
    saveTemplates: (data: Template[]) => void;
    delegations: Delegation[];
    saveDelegations: (data: Delegation[]) => void;
    approvalDelegations: ApprovalDelegation[];
    saveApprovalDelegations: (data: ApprovalDelegation[]) => void;
    notify: (userId: string, message: string, type?: string, title?: string, linkedId?: string, linkedType?: string, overrideEmail?: string) => any;
    markRead: (id: string) => void;
    markAllRead: () => void;
    awardPoints: (staffId: string, points: number, action: string, weekId?: string) => void;
    grantBadge: (staffId: string, badgeId: string) => void;
    pendingApprovals: () => Entry[];
    canApproveTimesheets: () => boolean;
    loadAll: () => void;
    checkReminders: () => void;
    templates: Template[];
    features: Record<string, boolean>;
    saveFeatures: (data: Record<string, boolean>) => void;
    lockedWeeks: string[];
    saveLockedWeeks: (data: string[]) => void;
    idleCountdown: number | null;
    showPasswordChange: boolean;
    setShowPasswordChange: (show: boolean) => void;
    prefillTemplate: any;
    setPrefillTemplate: (data: any) => void;
    passwordResetRequests: PasswordResetRequest[];
    savePasswordResetRequests: (data: PasswordResetRequest[]) => void;
    projectBudgets: ProjectBudget[];
    saveProjectBudgets: (data: ProjectBudget[]) => void;
    bulkImportLogs: BulkImportLog[];
    saveBulkImportLogs: (data: BulkImportLog[]) => void;
    saveBulkStaffImportLogs: (data: BulkStaffImportLog[]) => void;
    streakRecoveries: StreakRecoveryRequest[];
    saveStreakRecoveries: (data: StreakRecoveryRequest[]) => void;
    pointsHistory: PointsHistoryEntry[];
    savePointsHistory: (data: PointsHistoryEntry[]) => void;
    // Add other fields as needed or use any for complex legacy state
    [key: string]: any;
}
