(function () {
    'use strict';
    const initialState = {
        auth: { token: null, user: null, mode: 'signed_out' },
        finance: {
            transactions: [],
            vaults: [],
            wallets: {
                HR: { name: 'HR Wallet', balance: 0, totalIncome: 0, totalSpent: 0 },
                HL: { name: 'HL Wallet', balance: 0, totalIncome: 0, totalSpent: 0 }
            }
        },
        planning: { goals: [] },
        habits: { items: [], logs: [] },
        reports: { data: null, loading: false },
        preferences: { currency: 'INR', language: 'en-IN', theme: 'light', dateFormat: 'DD-MM-YYYY' },
        ui: { currentPage: 'dashboard', modal: null, loading: false }
    };
    let state = structuredClone(initialState);
    const listeners = new Set();
    function getState() { return state; }
    function setState(updater, meta = {}) {
        const previous = state;
        state = typeof updater === 'function' ? updater(previous) : { ...previous, ...updater };
        listeners.forEach(listener => {
            try { listener(state, previous, meta); }
            catch (error) { console.error('[VaultFlow Store] subscriber error:', error); }
        });
        return state;
    }
    function subscribe(listener) {
        if (typeof listener !== 'function') throw new TypeError('Store subscriber must be a function');
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
    function reset() {
        state = structuredClone(initialState);
        listeners.forEach(listener => listener(state, state, { type: 'reset' }));
    }

    // Habit domain state accessors. These are deliberately thin: business
    // rules belong to HabitDomain, not inside the generic Store.
    function getHabits() {
        return state.habits.items;
    }

    function setHabits(nextHabits, meta = {}) {
        const normalized = Array.isArray(nextHabits) ? nextHabits : [];
        return setState(current => ({
            ...current,
            habits: { ...current.habits, items: normalized }
        }), { type: 'habits:items:set', ...meta }).habits.items;
    }

    function getHabitLogs() {
        return state.habits.logs;
    }

    function setHabitLogs(nextLogs, meta = {}) {
        const normalized = Array.isArray(nextLogs) ? nextLogs : [];
        return setState(current => ({
            ...current,
            habits: { ...current.habits, logs: normalized }
        }), { type: 'habits:logs:set', ...meta }).habits.logs;
    }

    function addHabit(habit, meta = {}) {
        if (!habit || !habit._id) throw new TypeError('Habit must contain _id');
        return setState(current => ({
            ...current,
            habits: {
                ...current.habits,
                items: [...current.habits.items.filter(item => item._id !== habit._id), habit]
            }
        }), { type: 'habits:item:upsert', ...meta }).habits.items;
    }

    function addOrUpdateHabitLog(log, meta = {}) {
        if (!log || !log._id) throw new TypeError('HabitLog must contain _id');
        return setState(current => ({
            ...current,
            habits: {
                ...current.habits,
                logs: [
                    ...current.habits.logs.filter(item => item._id !== log._id &&
                        !(item.habitId === log.habitId && item.scheduledDate === log.scheduledDate)),
                    log
                ]
            }
        }), { type: 'habits:log:upsert', ...meta }).habits.logs;
    }

    function removeHabitLog(logId, meta = {}) {
        return setState(current => ({
            ...current,
            habits: {
                ...current.habits,
                logs: current.habits.logs.filter(log => log._id !== logId)
            }
        }), { type: 'habits:log:remove', ...meta }).habits.logs;
    }

    window.VaultFlowStore = Object.freeze({
        getState, setState, subscribe, reset,
        getHabits, setHabits, getHabitLogs, setHabitLogs,
        addHabit, addOrUpdateHabitLog, removeHabitLog
    });
})();