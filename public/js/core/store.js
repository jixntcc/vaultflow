(function () {
    'use strict';
    const initialState = {
        auth: { token: null, user: null, mode: 'signed_out' },
        account: { plan: null },
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
        intelligence: { data: null, loading: false, lastUpdated: null },
        automation: { rules: [], loading: false },
        sync: { queue: [], status: 'idle', lastSyncedAt: null },
        audit: { events: [] },
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

    function updateHabit(habit, meta = {}) {
        if (!habit || !habit._id) throw new TypeError('Habit must contain _id');
        return setState(current => ({
            ...current,
            habits: {
                ...current.habits,
                items: current.habits.items.map(item => String(item._id) === String(habit._id) ? habit : item)
            }
        }), { type: 'habits:update', ...meta }).habits.items;
    }
    function removeHabit(habitId, meta = {}) {
        return setState(current => ({
            ...current,
            habits: {
                ...current.habits,
                items: current.habits.items.filter(item => String(item._id) !== String(habitId))
            }
        }), { type: 'habits:remove', ...meta }).habits.items;
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


    // Vault domain accessors. Vault business rules remain outside the generic Store.
    function getVaults() {
        return state.finance.vaults;
    }
    function setVaults(nextVaults, meta = {}) {
        const normalized = Array.isArray(nextVaults) ? nextVaults : [];
        return setState(current => ({
            ...current,
            finance: { ...current.finance, vaults: normalized }
        }), { type: 'vaults:set', ...meta }).finance.vaults;
    }
    function upsertVault(vault, meta = {}) {
        if (!vault || !vault._id) throw new TypeError('Vault must contain _id');
        return setState(current => ({
            ...current,
            finance: {
                ...current.finance,
                vaults: [
                    ...current.finance.vaults.filter(item => item._id !== vault._id),
                    vault
                ]
            }
        }), { type: 'vaults:upsert', ...meta }).finance.vaults;
    }
    function removeVault(vaultId, meta = {}) {
        return setState(current => ({
            ...current,
            finance: {
                ...current.finance,
                vaults: current.finance.vaults.filter(vault => String(vault._id) !== String(vaultId))
            }
        }), { type: 'vaults:remove', ...meta }).finance.vaults;
    }

    // Goals domain accessors. Goal business rules remain outside the generic Store.
    function getGoals() {
        return state.planning.goals;
    }
    function setGoals(nextGoals, meta = {}) {
        const normalized = Array.isArray(nextGoals) ? nextGoals : [];
        return setState(current => ({
            ...current,
            planning: { ...current.planning, goals: normalized }
        }), { type: 'goals:set', ...meta }).planning.goals;
    }

    function upsertGoal(goal, meta = {}) {
        if (!goal || !goal._id) throw new TypeError('Goal must contain _id');
        return setState(current => ({
            ...current,
            planning: {
                ...current.planning,
                goals: [
                    ...current.planning.goals.filter(item => item._id !== goal._id),
                    goal
                ]
            }
        }), { type: 'goals:upsert', ...meta }).planning.goals;
    }
    function removeGoal(goalId, meta = {}) {
        return setState(current => ({
            ...current,
            planning: {
                ...current.planning,
                goals: current.planning.goals.filter(goal => String(goal._id) !== String(goalId))
            }
        }), { type: 'goals:remove', ...meta }).planning.goals;
    }

    // Phase 4 cross-domain read models. These are derived/coordination state,
    // not replacements for the underlying domain entities.
    // Reports read-model contract. Analytics remain derived from authoritative transactions.
    function getSettings() {
        return state.settings;
    }
    function setSettings(data, meta = {}) {
        return setState(current => ({
            ...current,
            settings: { ...current.settings, ...(data || {}) }
        }), { type: 'settings:set', ...meta }).settings;
    }

    function getReports() {
        return state.reports;
    }
    function setReports(data, meta = {}) {
        return setState(current => ({
            ...current,
            reports: { data: data || null, loading: false }
        }), { type: 'reports:set', ...meta }).reports;
    }
    function setReportsLoading(loading) {
        return setState(current => ({
            ...current,
            reports: { ...current.reports, loading: Boolean(loading) }
        }), { type: 'reports:loading' }).reports;
    }

    function getIntelligence() {
        return state.intelligence;
    }

    function setIntelligence(data, meta = {}) {
        return setState(current => ({
            ...current,
            intelligence: { data: data || null, loading: false, lastUpdated: new Date().toISOString() }
        }), { type: 'intelligence:set', ...meta }).intelligence;
    }
    function setPersonalization(data, meta = {}) {
        return setState(current => ({
            ...current,
            intelligence: { ...current.intelligence, personalization: data || null }
        }), { type: 'personalization:set', ...meta }).intelligence.personalization;
    }
    function setPlan(data, meta = {}) {
        return setState(current => ({
            ...current,
            account: { ...current.account, plan: data || null }
        }), { type: 'plan:set', ...meta }).account.plan;
    }
    function setRetention(data, meta = {}) {
        return setState(current => ({
            ...current,
            intelligence: { ...current.intelligence, retention: data || null }
        }), { type: 'retention:set', ...meta }).intelligence.retention;
    }
    function setIntelligenceLoading(loading) {
        return setState(current => ({
            ...current,
            intelligence: { ...current.intelligence, loading: Boolean(loading) }
        }), { type: 'intelligence:loading' }).intelligence;
    }
    function setAutomationRules(rules, meta = {}) {
        return setState(current => ({
            ...current,
            automation: { ...current.automation, rules: Array.isArray(rules) ? rules : [], loading: false }
        }), { type: 'automation:rules:set', ...meta }).automation.rules;
    }
    function setSyncQueue(queue, status = 'idle') {
        return setState(current => ({
            ...current,
            sync: { ...current.sync, queue: Array.isArray(queue) ? queue : [], status }
        }), { type: 'sync:queue:set' }).sync;
    }
    function addSyncMutation(mutation) {
        if (!mutation || !mutation.key) throw new TypeError('Sync mutation requires a key');
        return setState(current => ({
            ...current,
            sync: { ...current.sync, queue: [...current.sync.queue, mutation], status: 'pending' }
        }), { type: 'sync:mutation:add' }).sync.queue;
    }
    function removeSyncMutation(key) {
        return setState(current => ({
            ...current,
            sync: { ...current.sync, queue: current.sync.queue.filter(item => item.key !== key) }
        }), { type: 'sync:mutation:remove' }).sync.queue;
    }
    function setAuditEvents(events) {
        return setState(current => ({
            ...current,
            audit: { events: Array.isArray(events) ? events : [] }
        }), { type: 'audit:set' }).audit.events;
    }

    window.VaultFlowStore = Object.freeze({
        getState, setState, subscribe, reset,
        getHabits, setHabits, getHabitLogs, setHabitLogs, getVaults, setVaults, upsertVault, removeVault, getGoals, setGoals, upsertGoal, removeGoal, getReports, setReports, setReportsLoading, getIntelligence, getSettings, setSettings,
        addHabit, updateHabit, removeHabit, addOrUpdateHabitLog, removeHabitLog,
        setIntelligence, setPersonalization, setRetention, setPlan, setIntelligenceLoading, setAutomationRules,
        setSyncQueue, addSyncMutation, removeSyncMutation, setAuditEvents
    });
})();