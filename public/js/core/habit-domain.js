(function (window) {
    'use strict';

    const MS_PER_DAY = 86400000;

    function assertDateString(date) {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new TypeError('Expected local date in YYYY-MM-DD format');
        }
        const [year, month, day] = date.split('-').map(Number);
        const probe = new Date(Date.UTC(year, month - 1, day));
        if (
            probe.getUTCFullYear() !== year ||
            probe.getUTCMonth() !== month - 1 ||
            probe.getUTCDate() !== day
        ) {
            throw new RangeError('Invalid calendar date: ' + date);
        }
        return date;
    }

    function dateToUtc(date) {
        assertDateString(date);
        const [y, m, d] = date.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    }

    function utcToDate(ms) {
        const d = new Date(ms);
        return [
            d.getUTCFullYear(),
            String(d.getUTCMonth() + 1).padStart(2, '0'),
            String(d.getUTCDate()).padStart(2, '0')
        ].join('-');
    }

    function addDays(date, amount) {
        return utcToDate(dateToUtc(date) + amount * MS_PER_DAY);
    }

    function compareDates(a, b) {
        return dateToUtc(a) - dateToUtc(b);
    }

    function dayOfWeek(date) {
        return new Date(dateToUtc(date)).getUTCDay();
    }

    function getTodayLocalDate(now = new Date()) {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getHabitById(habitId, habits = VaultFlowStore.getHabits()) {
        return habits.find(habit => String(habit._id) === String(habitId)) || null;
    }

    function getHabitLog(habitId, scheduledDate, logs = VaultFlowStore.getHabitLogs()) {
        return logs.find(log =>
            String(log.habitId) === String(habitId) &&
            log.scheduledDate === scheduledDate
        ) || null;
    }

    function isHabitInDateRange(habit, date) {
        if (!habit) return false;
        if (compareDates(date, habit.startDate) < 0) return false;
        if (habit.endDate && compareDates(date, habit.endDate) > 0) return false;
        return true;
    }

    function isScheduledOn(habit, date) {
        assertDateString(date);
        if (!isHabitInDateRange(habit, date)) return false;

        const frequency = habit.frequency || {};
        if (frequency.type === 'daily') return true;

        if (frequency.type === 'weekly') {
            const days = Array.isArray(frequency.daysOfWeek) ? frequency.daysOfWeek : [];
            return days.includes(dayOfWeek(date));
        }

        return false;
    }

    function getScheduledDates(habit, fromDate, toDate) {
        assertDateString(fromDate);
        assertDateString(toDate);
        if (compareDates(fromDate, toDate) > 0) return [];

        const dates = [];
        let cursor = fromDate;
        while (compareDates(cursor, toDate) <= 0) {
            if (isScheduledOn(habit, cursor)) dates.push(cursor);
            cursor = addDays(cursor, 1);
        }
        return dates;
    }

    function getHabitStatus(habitId, date, habits, logs) {
        const habit = getHabitById(habitId, habits);
        if (!habit || !isHabitInDateRange(habit, date)) return 'not_scheduled';
        if (!isScheduledOn(habit, date)) return 'not_scheduled';

        const log = getHabitLog(habitId, date, logs);
        if (log?.status === 'completed') return 'completed';
        if (log?.status === 'skipped') return 'skipped';

        const today = getTodayLocalDate();
        if (compareDates(date, today) < 0) return 'missed';
        return 'pending';
    }

    function getWeeklyWindow(date) {
        const dow = dayOfWeek(date);
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const start = addDays(date, mondayOffset);
        return { start, end: addDays(start, 6) };
    }

    function getWeeklyCompletionCount(habit, weekStart, logs) {
        const weekEnd = addDays(weekStart, 6);
        const scheduled = getScheduledDates(habit, weekStart, weekEnd);
        const completed = scheduled.filter(date => {
            const log = getHabitLog(habit._id, date, logs);
            return log?.status === 'completed';
        });
        return { scheduledDates: scheduled, completedDates: completed };
    }

    function getWeeklyTarget(habit) {
        const frequency = habit.frequency || {};
        return frequency.type === 'weekly'
            ? Number(frequency.targetPerWeek || 1)
            : null;
    }

    // Daily streak = consecutive scheduled dates completed.
    // Weekly streak = consecutive calendar weeks that reach targetPerWeek.
    function getHabitStreak(habitId, asOfDate = getTodayLocalDate(), habits, logs) {
        const habit = getHabitById(habitId, habits);
        if (!habit) return { current: 0, best: 0, unit: 'occurrences' };

        const allLogs = logs || VaultFlowStore.getHabitLogs();
        const today = asOfDate;

        if (habit.frequency?.type === 'weekly') {
            const target = getWeeklyTarget(habit);
            let cursor = getWeeklyWindow(today).start;
            let current = 0;
            let best = 0;
            let run = 0;

            // Evaluate from habit start through current week, but never count
            // the current incomplete week as a success until its target is met.
            const firstWeek = getWeeklyWindow(habit.startDate).start;
            const weeks = [];
            while (compareDates(cursor, firstWeek) >= 0) {
                // placeholder; replaced below with forward iteration
                break;
            }
            cursor = firstWeek;
            while (compareDates(cursor, getWeeklyWindow(today).start) <= 0) {
                const result = getWeeklyCompletionCount(habit, cursor, allLogs);
                const targetMet = result.completedDates.length >= target;
                const weekEnd = addDays(cursor, 6);
                const isCurrentWeek = compareDates(cursor, getWeeklyWindow(today).start) === 0;
                const weekCounts = targetMet && (!isCurrentWeek || result.completedDates.length >= target);

                if (weekCounts) {
                    run += 1;
                    best = Math.max(best, run);
                } else if (!isCurrentWeek) {
                    run = 0;
                }
                cursor = addDays(cursor, 7);
            }

            // Current streak is the consecutive successful weeks ending at the
            // current week; if current week has not met target, use the prior run.
            const currentWeek = getWeeklyWindow(today).start;
            let endCursor = currentWeek;
            let currentRun = 0;
            while (true) {
                const result = getWeeklyCompletionCount(habit, endCursor, allLogs);
                const met = result.completedDates.length >= target;
                if (!met) break;
                currentRun += 1;
                endCursor = addDays(endCursor, -7);
                if (compareDates(endCursor, firstWeek) < 0) break;
            }

            current = currentRun;
            return { current, best, unit: 'weeks', targetPerWeek: target };
        }

        // Daily habits.
        const scheduled = getScheduledDates(habit, habit.startDate, today);
        let current = 0;
        for (let i = scheduled.length - 1; i >= 0; i -= 1) {
            const log = getHabitLog(habit._id, scheduled[i], allLogs);
            if (log?.status !== 'completed') break;
            current += 1;
        }

        let best = 0;
        let run = 0;
        for (const date of scheduled) {
            const log = getHabitLog(habit._id, date, allLogs);
            if (log?.status === 'completed') {
                run += 1;
                best = Math.max(best, run);
            } else {
                run = 0;
            }
        }

        return { current, best, unit: 'occurrences' };
    }

    function getHabitCompletionRate(habitId, fromDate, toDate, habits, logs) {
        const habit = getHabitById(habitId, habits);
        if (!habit) return { completed: 0, scheduled: 0, rate: 0 };

        const scheduled = getScheduledDates(habit, fromDate, toDate);
        const completed = scheduled.filter(date =>
            getHabitLog(habit._id, date, logs)?.status === 'completed'
        ).length;

        return {
            completed,
            scheduled: scheduled.length,
            rate: scheduled.length ? (completed / scheduled.length) * 100 : 0
        };
    }

    function getTodaysHabits(date = getTodayLocalDate(), habits = VaultFlowStore.getHabits()) {
        return habits.filter(habit =>
            habit.status === 'active' && isScheduledOn(habit, date)
        );
    }


    function getDateRangeDays(fromDate, toDate) {
        assertDateString(fromDate);
        assertDateString(toDate);
        if (compareDates(fromDate, toDate) > 0) return [];
        const dates = [];
        let cursor = fromDate;
        while (compareDates(cursor, toDate) <= 0) {
            dates.push(cursor);
            cursor = addDays(cursor, 1);
        }
        return dates;
    }

    function getHabitAnalytics(habitId, fromDate, toDate, habits, logs) {
        const habit = getHabitById(habitId, habits);
        if (!habit) {
            return {
                habitId, fromDate, toDate, scheduled: 0, completed: 0, skipped: 0,
                missed: 0, pending: 0, completionRate: 0, consistencyScore: 0,
                currentStreak: 0, bestStreak: 0, daily: [], weekday: []
            };
        }

        const effectiveLogs = logs || VaultFlowStore.getHabitLogs();
        const dates = getDateRangeDays(fromDate, toDate);
        const scheduled = dates.filter(date => isScheduledOn(habit, date));
        const daily = scheduled.map(date => ({
            date,
            status: getHabitStatus(habitId, date, habits, effectiveLogs)
        }));

        const counts = {
            completed: daily.filter(x => x.status === 'completed').length,
            skipped: daily.filter(x => x.status === 'skipped').length,
            missed: daily.filter(x => x.status === 'missed').length,
            pending: daily.filter(x => x.status === 'pending').length
        };
        const completionRate = scheduled.length ? (counts.completed / scheduled.length) * 100 : 0;

        const weekday = Array.from({ length: 7 }, (_, day) => {
            const items = daily.filter(x => dayOfWeek(x.date) === day);
            const done = items.filter(x => x.status === 'completed').length;
            return {
                day,
                scheduled: items.length,
                completed: done,
                rate: items.length ? (done / items.length) * 100 : 0
            };
        });

        const streak = getHabitStreak(habitId, toDate, habits, effectiveLogs);
        // Consistency rewards completion while modestly penalizing skipped/missed
        // occurrences. It is deliberately transparent, not a second source of truth.
        const consistencyScore = scheduled.length
            ? Math.max(0, Math.min(100,
                (counts.completed * 100 + counts.skipped * 25) / scheduled.length
            ))
            : 0;

        return {
            habitId,
            fromDate,
            toDate,
            scheduled: scheduled.length,
            ...counts,
            completionRate,
            consistencyScore,
            currentStreak: streak.current,
            bestStreak: streak.best,
            streakUnit: streak.unit,
            daily,
            weekday
        };
    }

    function getPortfolioAnalytics(fromDate, toDate, habits, logs) {
        const effectiveHabits = (habits || VaultFlowStore.getHabits()).filter(h => h.status !== 'archived');
        const effectiveLogs = logs || VaultFlowStore.getHabitLogs();
        const dates = getDateRangeDays(fromDate, toDate);

        const daily = dates.map(date => {
            const scheduled = effectiveHabits.filter(h => isScheduledOn(h, date));
            const completed = scheduled.filter(h =>
                getHabitLog(h._id, date, effectiveLogs)?.status === 'completed'
            );
            return {
                date,
                scheduled: scheduled.length,
                completed: completed.length,
                rate: scheduled.length ? (completed.length / scheduled.length) * 100 : 0
            };
        });

        const scheduled = daily.reduce((sum, x) => sum + x.scheduled, 0);
        const completed = daily.reduce((sum, x) => sum + x.completed, 0);
        const active = effectiveHabits.length;
        const habitScores = effectiveHabits.map(h =>
            getHabitAnalytics(h._id, fromDate, toDate, effectiveHabits, effectiveLogs)
        );

        return {
            fromDate, toDate, active, scheduled, completed,
            completionRate: scheduled ? (completed / scheduled) * 100 : 0,
            consistencyScore: habitScores.length
                ? habitScores.reduce((sum, x) => sum + x.consistencyScore, 0) / habitScores.length
                : 0,
            daily,
            habits: habitScores.sort((a, b) => b.completionRate - a.completionRate)
        };
    }

    function buildHabitViewModel(habit, date = getTodayLocalDate(), habits, logs) {
        const effectiveHabits = habits || VaultFlowStore.getHabits();
        const effectiveLogs = logs || VaultFlowStore.getHabitLogs();
        const status = getHabitStatus(habit._id, date, effectiveHabits, effectiveLogs);
        const streak = getHabitStreak(habit._id, date, effectiveHabits, effectiveLogs);

        return {
            id: habit._id,
            name: habit.name,
            description: habit.description || '',
            category: habit.category || '',
            icon: habit.icon || '',
            color: habit.color || '',
            frequency: habit.frequency,
            status,
            streak,
            actions: {
                canComplete: status === 'pending' || status === 'skipped',
                canSkip: status === 'pending' || status === 'completed',
                canEdit: habit.status !== 'archived',
                canArchive: habit.status !== 'archived',
                canViewHistory: true
            }
        };
    }

    function buildTodaySummary(date = getTodayLocalDate(), habits, logs) {
        const today = getTodaysHabits(date, habits || VaultFlowStore.getHabits());
        const models = today.map(habit => buildHabitViewModel(habit, date, habits, logs));
        const completed = models.filter(model => model.status === 'completed').length;
        return {
            date,
            total: models.length,
            completed,
            pending: models.filter(model => model.status === 'pending').length,
            skipped: models.filter(model => model.status === 'skipped').length,
            missed: models.filter(model => model.status === 'missed').length,
            completionRate: models.length ? (completed / models.length) * 100 : 0,
            items: models
        };
    }

    window.HabitDomain = Object.freeze({
        getTodayLocalDate,
        addDays,
        compareDates,
        dayOfWeek,
        isHabitInDateRange,
        isScheduledOn,
        getScheduledDates,
        getHabitById,
        getHabitLog,
        getHabitStatus,
        getWeeklyWindow,
        getWeeklyCompletionCount,
        getWeeklyTarget,
        getHabitStreak,
        getHabitCompletionRate,
        getDateRangeDays,
        getHabitAnalytics,
        getPortfolioAnalytics,
        getTodaysHabits,
        buildHabitViewModel,
        buildTodaySummary
    });
})(window);
