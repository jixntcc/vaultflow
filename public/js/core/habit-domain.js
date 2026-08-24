(function (window) {
  'use strict';

  const DAY = 86400000;
  const store = () => window.VaultFlowStore;

  function assertDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new TypeError('Expected YYYY-MM-DD date');
    const [y, m, d] = String(value).split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) throw new RangeError('Invalid date');
    return String(value);
  }

  function toUtc(date) { assertDate(date); const [y,m,d] = date.split('-').map(Number); return Date.UTC(y,m-1,d); }
  function fromUtc(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; }
  function addDays(date, amount) { return fromUtc(toUtc(date) + Number(amount) * DAY); }
  function compareDates(a,b) { return toUtc(a) - toUtc(b); }
  function dayOfWeek(date) { return new Date(toUtc(date)).getUTCDay(); }

  // Always use the browser's local calendar date. Do not use toISOString(),
  // because that can move the date backward/forward around midnight.
  function getTodayLocalDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }

  function allHabits() { return store()?.getHabits?.() || []; }
  function allLogs() { return store()?.getHabitLogs?.() || []; }
  function getHabitById(id, habits = allHabits()) { return (habits || []).find(h => String(h._id) === String(id)) || null; }
  function getHabitLog(habitId, date, logs = allLogs()) { return (logs || []).find(l => String(l.habitId) === String(habitId) && l.scheduledDate === date) || null; }

  function isHabitInDateRange(habit, date) {
    if (!habit || !habit.startDate) return false;
    return compareDates(date, habit.startDate) >= 0 && (!habit.endDate || compareDates(date, habit.endDate) <= 0);
  }

  function isScheduledOn(habit, date) {
    assertDate(date);
    if (!habit || habit.status !== 'active' || !isHabitInDateRange(habit, date)) return false;
    const frequency = habit.frequency || { type: 'daily' };
    if (frequency.type === 'daily') return true;
    if (frequency.type === 'weekly') {
      const days = Array.isArray(frequency.daysOfWeek) ? frequency.daysOfWeek.map(Number) : [];
      return days.includes(dayOfWeek(date));
    }
    return false;
  }

  function getScheduledDates(habit, fromDate, toDate) {
    assertDate(fromDate); assertDate(toDate);
    const result = [];
    if (compareDates(fromDate,toDate) > 0) return result;
    let cursor = fromDate;
    while (compareDates(cursor,toDate) <= 0) {
      if (isScheduledOn(habit,cursor)) result.push(cursor);
      cursor = addDays(cursor,1);
    }
    return result;
  }

  function getHabitStatus(habitId, date, habits = allHabits(), logs = allLogs()) {
    const habit = getHabitById(habitId, habits);
    if (!habit || !isScheduledOn(habit,date)) return 'not_scheduled';
    const log = getHabitLog(habitId,date,logs);
    if (log?.status === 'completed') return 'completed';
    if (log?.status === 'skipped') return 'skipped';
    return compareDates(date,getTodayLocalDate()) < 0 ? 'missed' : 'pending';
  }

  function getWeeklyWindow(date) {
    const dow = dayOfWeek(date);
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const start = addDays(date,mondayOffset);
    return { start, end: addDays(start,6) };
  }

  function getWeeklyCompletionCount(habit, weekStart, logs = allLogs()) {
    const dates = getScheduledDates(habit,weekStart,addDays(weekStart,6));
    const completed = dates.filter(d => getHabitLog(habit._id,d,logs)?.status === 'completed');
    return { scheduledDates: dates, completedDates: completed };
  }

  function getWeeklyTarget(habit) {
    return habit?.frequency?.type === 'weekly' ? Number(habit.frequency.targetPerWeek || 1) : null;
  }

  function getHabitStreak(habitId, asOfDate = getTodayLocalDate(), habits = allHabits(), logs = allLogs()) {
    const habit = getHabitById(habitId,habits);
    if (!habit) return { current:0,best:0,unit:'occurrences' };
    const scheduled = getScheduledDates(habit,habit.startDate,asOfDate);
    let current = 0;
    for (let i=scheduled.length-1;i>=0;i--) {
      if (getHabitLog(habit._id,scheduled[i],logs)?.status !== 'completed') break;
      current++;
    }
    let best = 0, run = 0;
    scheduled.forEach(d => {
      if (getHabitLog(habit._id,d,logs)?.status === 'completed') { run++; best=Math.max(best,run); }
      else run=0;
    });
    if (habit.frequency?.type === 'weekly') {
      const target = getWeeklyTarget(habit);
      const first = getWeeklyWindow(habit.startDate).start;
      const last = getWeeklyWindow(asOfDate).start;
      let week = first, weekRun = 0, bestWeeks = 0;
      while (compareDates(week,last) <= 0) {
        const met = getWeeklyCompletionCount(habit,week,logs).completedDates.length >= target;
        if (met) { weekRun++; bestWeeks=Math.max(bestWeeks,weekRun); } else weekRun=0;
        week=addDays(week,7);
      }
      let currentWeeks=0, cursor=last;
      while (compareDates(cursor,first)>=0 && getWeeklyCompletionCount(habit,cursor,logs).completedDates.length >= target) { currentWeeks++; cursor=addDays(cursor,-7); }
      return { current:currentWeeks,best:bestWeeks,unit:'weeks',targetPerWeek:target };
    }
    return { current,best,unit:'occurrences' };
  }

  function getHabitCompletionRate(habitId,fromDate,toDate,habits=allHabits(),logs=allLogs()) {
    const habit=getHabitById(habitId,habits);
    if(!habit) return {completed:0,scheduled:0,rate:0};
    const scheduled=getScheduledDates(habit,fromDate,toDate);
    const completed=scheduled.filter(d=>getHabitLog(habit._id,d,logs)?.status==='completed').length;
    return {completed,scheduled:scheduled.length,rate:scheduled.length?(completed/scheduled.length)*100:0};
  }

  function getDateRangeDays(fromDate,toDate) {
    const result=[]; assertDate(fromDate); assertDate(toDate); if(compareDates(fromDate,toDate)>0)return result;
    for(let d=fromDate;compareDates(d,toDate)<=0;d=addDays(d,1)) result.push(d);
    return result;
  }

  function getHabitAnalytics(habitId,fromDate,toDate,habits=allHabits(),logs=allLogs()) {
    const habit=getHabitById(habitId,habits); if(!habit)return {habitId,scheduled:0,completed:0,skipped:0,missed:0,pending:0,completionRate:0,consistencyScore:0,currentStreak:0,bestStreak:0,daily:[],weekday:[]};
    const daily=getScheduledDates(habit,fromDate,toDate).map(date=>({date,status:getHabitStatus(habitId,date,habits,logs)}));
    const completed=daily.filter(x=>x.status==='completed').length;
    const skipped=daily.filter(x=>x.status==='skipped').length;
    const missed=daily.filter(x=>x.status==='missed').length;
    const pending=daily.filter(x=>x.status==='pending').length;
    const scheduled=daily.length;
    const streak=getHabitStreak(habitId,toDate,habits,logs);
    const weekday=Array.from({length:7},(_,day)=>{const items=daily.filter(x=>dayOfWeek(x.date)===day);const done=items.filter(x=>x.status==='completed').length;return {day,scheduled:items.length,completed:done,rate:items.length?done/items.length*100:0};});
    return {habitId,fromDate,toDate,scheduled,completed,skipped,missed,pending,completionRate:scheduled?completed/scheduled*100:0,consistencyScore:scheduled?Math.max(0,Math.min(100,(completed*100+skipped*25)/scheduled)):0,currentStreak:streak.current,bestStreak:streak.best,streakUnit:streak.unit,daily,weekday};
  }

  function getTodaysHabits(date=getTodayLocalDate(),habits=allHabits()) {
    // Keep the date/filter logic in one place. This is deliberately derived from
    // the same active habit array used by analytics so the page cannot report
    // "1 active" while rendering an unrelated empty list.
    return (habits || []).filter(h => h.status === 'active' && isScheduledOn(h,date));
  }

  function getPortfolioAnalytics(fromDate,toDate,habits=allHabits(),logs=allLogs()) {
    const active=(habits||[]).filter(h=>h.status==='active');
    const dates=getDateRangeDays(fromDate,toDate);
    const daily=dates.map(date=>{const scheduled=active.filter(h=>isScheduledOn(h,date));const completed=scheduled.filter(h=>getHabitLog(h._id,date,logs)?.status==='completed');return {date,scheduled:scheduled.length,completed:completed.length,rate:scheduled.length?completed.length/scheduled.length*100:0};});
    const scheduled=daily.reduce((s,x)=>s+x.scheduled,0),completed=daily.reduce((s,x)=>s+x.completed,0);
    const analytics=active.map(h=>getHabitAnalytics(h._id,fromDate,toDate,active,logs)).sort((a,b)=>b.completionRate-a.completionRate);
    return {fromDate,toDate,active:active.length,scheduled,completed,completionRate:scheduled?completed/scheduled*100:0,consistencyScore:analytics.length?analytics.reduce((s,x)=>s+x.consistencyScore,0)/analytics.length:0,daily,habits:analytics};
  }

  function buildHabitViewModel(habit,date=getTodayLocalDate(),habits=allHabits(),logs=allLogs()) {
    const status=getHabitStatus(habit._id,date,habits,logs), streak=getHabitStreak(habit._id,date,habits,logs);
    return {id:habit._id,name:habit.name,description:habit.description||'',category:habit.category||'',icon:habit.icon||'✓',color:habit.color||'',frequency:habit.frequency||{type:'daily'},status,streak,actions:{canComplete:status==='pending'||status==='skipped',canSkip:status==='pending'||status==='completed',canEdit:habit.status!=='archived',canArchive:habit.status!=='archived',canViewHistory:true}};
  }

  function buildTodaySummary(date=getTodayLocalDate(),habits=allHabits(),logs=allLogs()) {
    const items=getTodaysHabits(date,habits).map(h=>buildHabitViewModel(h,date,habits,logs));
    const completed=items.filter(x=>x.status==='completed').length;
    return {date,total:items.length,completed,pending:items.filter(x=>x.status==='pending').length,skipped:items.filter(x=>x.status==='skipped').length,missed:items.filter(x=>x.status==='missed').length,completionRate:items.length?completed/items.length*100:0,items};
  }

  window.HabitDomain=Object.freeze({getTodayLocalDate,addDays,compareDates,dayOfWeek,isHabitInDateRange,isScheduledOn,getScheduledDates,getHabitById,getHabitLog,getHabitStatus,getWeeklyWindow,getWeeklyCompletionCount,getWeeklyTarget,getHabitStreak,getHabitCompletionRate,getDateRangeDays,getHabitAnalytics,getTodaysHabits,getPortfolioAnalytics,buildHabitViewModel,buildTodaySummary});
})(window);
