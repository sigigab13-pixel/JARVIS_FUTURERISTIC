export type PrimeStatus = 'ALIVE' | 'DYING' | 'DEAD - STARVATION (No Fuel)' | 'DEAD - TILT PROTECTION';

export type PrimeState = {
    balance: number;
    cloneBalance: number;
    wins: number;
    losses: number;
    consecutiveLosses: number;
    daysNoPost: number;
    status: PrimeStatus;
    trades: number;
    pnlToday: number;
};

export const initialPrime: PrimeState = {
    balance: 10,
    cloneBalance: 90,
    wins: 0,
    losses: 0,
    consecutiveLosses: 0,
    daysNoPost: 0,
    status: 'ALIVE',
    trades: 0,
    pnlToday: 0,
};

export function checkPrimeStatus(state: PrimeState): PrimeState {
    if (state.balance < 1) {
        return { ...state, status: 'DEAD - STARVATION (No Fuel)' };
    }
    if (state.consecutiveLosses >= 5) {
        return { ...state, status: 'DEAD - TILT PROTECTION' };
    }
    if (state.daysNoPost >= 3) {
        return { ...state, status: 'DYING' };
    }
    return { ...state, status: 'ALIVE' };
}

export function recordPaperTrade(state: PrimeState, result: number): PrimeState {
    if (state.status !== 'ALIVE') return checkPrimeStatus(state);
    const win = result > 0;
    const next: PrimeState = {
        ...state,
        balance: Math.max(0, Number((state.balance + result).toFixed(2))),
        wins: state.wins + (win ? 1 : 0),
        losses: state.losses + (result < 0 ? 1 : 0),
        consecutiveLosses: result < 0 ? state.consecutiveLosses + 1 : 0,
        trades: state.trades + 1,
        pnlToday: Number((state.pnlToday + result).toFixed(2)),
    };
    return checkPrimeStatus(next);
}

export function receiveContentEarnings(state: PrimeState, earning: number): PrimeState {
    if (earning <= 0) return state;
    const cloneTransfer = Number((earning * 0.9).toFixed(2));
    const mainKeeps = Number((earning - cloneTransfer).toFixed(2));
    return checkPrimeStatus({
        ...state,
        balance: Number((state.balance + mainKeeps).toFixed(2)),
        cloneBalance: Number((state.cloneBalance + cloneTransfer).toFixed(2)),
    });
}

export function revivePrime(state: PrimeState, amount = 1): PrimeState {
    return checkPrimeStatus({
        ...state,
        balance: Number((state.balance + Math.max(0, amount)).toFixed(2)),
        consecutiveLosses: 0,
        daysNoPost: 0,
    });
}
