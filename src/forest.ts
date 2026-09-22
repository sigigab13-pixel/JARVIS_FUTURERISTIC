export type ForestPlatform = 'YouTube' | 'TikTok' | 'Facebook';

export type ForestAccount = {
    platform: ForestPlatform;
    name: string;
    audience: number;
    yesterdayAudience: number;
    viewsToday: number;
    commentsToday: number;
    revenueToday: number;
    postsToday: number;
    monetization: string;
};

export type ForestState = {
    accounts: ForestAccount[];
    recentNicheDays: number;
    blowThreshold: number;
    lastAlert: string;
};

export const initialForest: ForestState = {
    accounts: [
        { platform: 'YouTube', name: 'YT Main', audience: 620, yesterdayAudience: 470, viewsToday: 12800, commentsToday: 74, revenueToday: 3.2, postsToday: 1, monetization: 'Tracking / verify in connected account' },
        { platform: 'TikTok', name: '@forest_tt', audience: 910, yesterdayAudience: 700, viewsToday: 21600, commentsToday: 91, revenueToday: 4.1, postsToday: 1, monetization: 'Tracking / verify in connected account' },
        { platform: 'Facebook', name: 'Forest Page', audience: 340, yesterdayAudience: 290, viewsToday: 8400, commentsToday: 33, revenueToday: 2.7, postsToday: 1, monetization: 'Tracking / verify in connected account' },
    ],
    recentNicheDays: 14,
    blowThreshold: 300,
    lastAlert: 'No blow alert yet',
};

export function forestRevenue(state: ForestState): number {
    return Number(state.accounts.reduce((sum, account) => sum + account.revenueToday, 0).toFixed(2));
}

export function blowScore(account: ForestAccount): number {
    return (account.audience - account.yesterdayAudience) + account.commentsToday * 2;
}

export function evaluateForest(state: ForestState): ForestState {
    const alerting = state.accounts.find(account => blowScore(account) > state.blowThreshold);
    return {
        ...state,
        lastAlert: alerting
            ? `BLOW ALERT — ${alerting.platform} +${alerting.audience - alerting.yesterdayAudience} audience; score ${blowScore(alerting)}`
            : 'No blow alert yet',
    };
}

export function simulateForestDay(state: ForestState): ForestState {
    const accounts = state.accounts.map(account => {
        const growth = Math.floor(20 + Math.random() * 80);
        const audience = account.audience + growth;
        return {
            ...account,
            yesterdayAudience: account.audience,
            audience,
            viewsToday: Math.floor(account.viewsToday * (0.85 + Math.random() * 0.5)),
            commentsToday: Math.floor(account.commentsToday * (0.85 + Math.random() * 0.4)),
            revenueToday: Number((account.revenueToday * (0.8 + Math.random() * 0.5)).toFixed(2)),
        };
    });
    return evaluateForest({ ...state, accounts, recentNicheDays: Math.min(14, state.recentNicheDays + 1) });
}
