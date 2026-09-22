export type BotStatus = 'ACTIVE' | 'PAUSED' | 'RETIRED';

export type NexoraBot = {
    id: string;
    name: string;
    title: 'BOT';
    balance: number;
    startingBalance: number;
    trades: number;
    wins: number;
    losses: number;
    consecutiveLosses: number;
    pnl: number;
    lastPnl: number;
    status: BotStatus;
};

const botNames = ['Atlas', 'Nova', 'Echo', 'Vector', 'Orbit', 'Pulse', 'Apex', 'Cipher', 'Titan', 'Vega'];

export const initialBots: NexoraBot[] = botNames.map((name, index) => ({
    id: `BOT-${String(index + 1).padStart(2, '0')}`,
    name,
    title: 'BOT',
    balance: 10,
    startingBalance: 10,
    trades: 0,
    wins: 0,
    losses: 0,
    consecutiveLosses: 0,
    pnl: 0,
    lastPnl: 0,
    status: 'ACTIVE',
}));

export function simulateBotTrade(bot: NexoraBot, marketBias = 0): NexoraBot {
    if (bot.status !== 'ACTIVE') return bot;
    const move = (Math.random() - 0.48 + marketBias) * 1.2;
    const pnl = Number(move.toFixed(2));
    const win = pnl > 0;
    const nextBalance = Math.max(0, Number((bot.balance + pnl).toFixed(2)));
    return {
        ...bot,
        balance: nextBalance,
        trades: bot.trades + 1,
        wins: bot.wins + (win ? 1 : 0),
        losses: bot.losses + (win ? 0 : 1),
        consecutiveLosses: win ? 0 : bot.consecutiveLosses + 1,
        pnl: Number((bot.pnl + pnl).toFixed(2)),
        lastPnl: pnl,
        status: nextBalance < 1 ? 'RETIRED' : bot.status,
    };
}

export function simulateFleetCycle(bots: NexoraBot[], marketBias = 0): NexoraBot[] {
    return bots.map(bot => simulateBotTrade(bot, marketBias));
}

export function fleetStats(bots: NexoraBot[]) {
    const active = bots.filter(bot => bot.status === 'ACTIVE').length;
    const totalBalance = Number(bots.reduce((sum, bot) => sum + bot.balance, 0).toFixed(2));
    const totalPnl = Number(bots.reduce((sum, bot) => sum + bot.pnl, 0).toFixed(2));
    const totalTrades = bots.reduce((sum, bot) => sum + bot.trades, 0);
    const wins = bots.reduce((sum, bot) => sum + bot.wins, 0);
    const losses = bots.reduce((sum, bot) => sum + bot.losses, 0);
    const winRate = wins + losses === 0 ? 0 : Number(((wins / (wins + losses)) * 100).toFixed(1));
    return { active, totalBalance, totalPnl, totalTrades, wins, losses, winRate };
}
