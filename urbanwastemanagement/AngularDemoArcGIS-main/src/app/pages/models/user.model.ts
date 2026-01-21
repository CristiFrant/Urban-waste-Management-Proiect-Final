export interface User {
    email: string;
    password: string;
    role: string; // Poate fi 'admin' sau 'customer'
    visits: number;
    phone: string;
    username: string;
    
    // Experience and Gamification
    xp?: number;                    // Total experience points
    level?: number;                 // User level (calculated from XP)
    lastLoginDate?: number;         // Timestamp of last login
    loginStreak?: number;           // Consecutive days logged in
    longestStreak?: number;         // Longest login streak
    
    // Activity Statistics
    totalReports?: number;          // Total reports submitted
    totalVisits?: number;           // Total location visits
    totalRecyclingTypes?: {         // Materials recycled count
        plastic?: number;
        hartie?: number;
        sticla?: number;
        metal?: number;
        haine?: number;
        electronice?: number;
        baterii?: number;
        [key: string]: number | undefined;
    };
    
    // Activity History
    activityLog?: Activity[];
    weeklyActivity?: number[];      // Activity for last 7 days
    monthlyXP?: number[];          // XP gained per month
    
    // Timestamps
    createdAt?: number;
    lastActive?: number;
}

export interface Activity {
    type: 'login' | 'visit' | 'report' | 'recycle';
    xpGained: number;
    timestamp: number;
    details?: string;
}

export interface GlobalStats {
    totalUsers: number;
    totalReports: number;
    totalVisits: number;
    totalXP: number;
    topUsers: { email: string; username: string; xp: number; }[];
    materialStats: { [key: string]: number };
}