export interface Staff {
    id: string;
    name: string;
    email: string;
    password: string;
    role: 'staff' | 'admin' | 'owner' | 'hr';
    department: string;
    suspended?: boolean;
    first_login?: boolean;
    points?: number;
    badges?: string[];
    last_login?: string;
    createdAt?: string;
    failed_attempts?: number;
    lockout_until?: string;
    password_reset_pending?: boolean;
    force_logout?: boolean;
    tour_done?: boolean;
    leadId?: string;
    staffType?: 'staff' | 'intern';
    isIntern?: boolean; // Convenience flag
    weekly_cap?: number | string;
    streak?: number;
    weekly_goal?: number;

    leadName?: string;
    phone?: string;
    photo?: string | null;
    fontSize?: string | number;
}

export interface Entry {
    id: string;
    staffId: string;
    staffName: string;
    date: string;
    weekKey: string;
    project: string;
    category: string;
    description: string;
    hours: number;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'resubmitted' | 'clarification_needed';
    deleted?: boolean;
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
    rejectionReason?: string;
    resubmitNote?: string;
    submittedAt?: string;
    deletedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    correctionNote?: string;
    clarifyNote?: string;
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
}

export interface AppNotification {
    id: string;
    userId: string;
    message: string;
    type: string;
    read: boolean;
    createdAt: string;
}

export interface AppMessage {
    id: string;
    senderId: string;
    senderName?: string;
    recipientId?: string;
    channelId?: string;
    text: string;
    type: 'dm' | 'channel';
    read: string[];
    createdAt: string;
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
    app_name: string;
    welcome_message: string;
    accent_color: string;
    weekly_cap: number;
    idle_minutes: number;
    submission_reminder_hour?: number;
    approval_reminder_hours?: number;
    second_level_threshold?: number;
    points?: {
        approved: number;
        submit_ontime: number;
        submit_early: number;
        streak_week: number;
        complete_45h: number;
        first_submit: number;
        [key: string]: number | undefined;
    };
    categories?: string[];
    holidays?: Holiday[];
    announcement?: {
        message: string;
        icon: string;
        color: string;
        expires?: string;
    } | null;
    faqs?: FAQ[];
}

export interface Leave {
    id: string;
    staffId: string;
    staffName: string;
    type: string;
    from: string;
    to: string;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
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

export interface Reward {
    id: string;
    name: string;
    desc: string;
    cost: number;
    icon: string;
    active: boolean;
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
    status: 'pending' | 'approved' | 'rejected';
}

export interface HofEntry extends Staff {
    rank: number;
    savedAt: string;
}

export interface AppContextType {
    user: Staff | null;
    staff: Staff[];
    entries: Entry[];
    messages: AppMessage[];
    notifications: AppNotification[];
    leaves: Leave[];
    hof: HofEntry[];
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
    saveMessages: (data: AppMessage[]) => void;
    saveNotifications: (data: AppNotification[]) => void;
    saveLeaves: (data: Leave[]) => void;
    saveHof: (data: HofEntry[]) => void;
    saveRewards: (data: Reward[]) => void;
    saveRedeems: (data: Redemption[]) => void;
    saveTemplates: (data: Template[]) => void;
    delegations: Delegation[];
    saveDelegations: (data: Delegation[]) => void;
    notify: (userId: string, message: string, type?: string) => any;
    markRead: (id: string) => void;
    markAllRead: () => void;
    awardPoints: (staffId: string, points: number, reason: string) => void;
    grantBadge: (staffId: string, badgeId: string) => void;
    pendingApprovals: () => Entry[];
    sendMessage: (msg: Partial<AppMessage>) => AppMessage;
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
    // Add other fields as needed or use any for complex legacy state
    [key: string]: any;
}

