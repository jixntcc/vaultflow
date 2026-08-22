(function (window) {
  'use strict';

  function esc(value) {
    return typeof window.escapeHtml === 'function' ? window.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function habits() { return window.VaultFlowStore?.getHabits?.() || []; }
  function logs() { return window.VaultFlowStore?.getHabitLogs?.() || []; }
  function today() { return window.HabitDomain.getTodayLocalDate(); }

  if (typeof window.renderDashboardRetention === 'function') {
    window.renderDashboardRetention = function () {
      const container = document.getElementById('dashboardRetentionGrid');
      if (!container) return;
      const data = typeof window.getRetentionAnalytics === 'function' ? window.getRetentionAnalytics() : null;
      const cards = [];
      if (data && window.retentionPrefs?.showStreaks !== false) {
        cards.push(`<div class="retention-card"><div class="retention-card-title">🔥 Tracking Streak</div><div class="retention-metric">${Number(data.trackingStreak?.current || 0)}-Day Streak</div><div class="retention-subtext">Best: ${Number(data.trackingStreak?.longest || 0)} days</div></div>`);
        cards.push(`<div class="retention-card"><div class="retention-card-title">💰 Savings Streak</div><div class="retention-metric">${Number(data.savingsStreak?.current || 0)} Weeks</div><div class="retention-subtext">Best: ${Number(data.savingsStreak?.longest || 0)} weeks</div></div>`);
      }
      if (data && window.retentionPrefs?.showMotivationalInsights !== false && data.insights?.length) {
        cards.push(`<div class="retention-card"><div class="retention-card-title">✨ Progress Nudge</div><div class="retention-subtext">${esc(data.insights[0])}</div></div>`);
      }
      const topGoal = (data?.goalSummaries || []).slice().sort((a,b) => Number(b.percentage || 0) - Number(a.percentage || 0))[0];
      if (topGoal) cards.push(`<div class="retention-card"><div class="retention-card-title">🎯 Goal Snapshot</div><div class="retention-metric">${Number(topGoal.percentage || 0).toFixed(0)}% Complete</div><div class="retention-subtext">${esc(topGoal.goal?.name || 'Goal')}: ${window.formatMoney(topGoal.remaining || 0)} remaining</div></div>`);
      container.innerHTML = cards.join('');
      const monthlyCard = document.getElementById('dashboardMonthlyReviewsCard');
      if (monthlyCard) monthlyCard.style.display = 'none';
    };
  }

  if (typeof window.renderHabitsPage === 'function') {
    window.renderHabitsPage = function () {
      const date = window.getHabitUiDate ? window.getHabitUiDate() : today();
      const all = habits();
      const allLogs = logs();
      const filter = window.habitUiState?.filter || 'today';
      let visible;
      if (filter === 'archived') visible = all.filter(h => h.status === 'archived');
      else if (filter === 'all') visible = all.filter(h => h.status === 'active');
      else {
        visible = window.HabitDomain.getTodaysHabits(date, all);
        if (!visible.length) visible = all.filter(h => h.status === 'active' && window.HabitDomain.isHabitInDateRange(h, date));
      }

      const summary = window.HabitDomain.buildTodaySummary(date, all, allLogs);
      const progress = document.getElementById('habitProgressValue');
      const bar = document.getElementById('habitProgressBar');
      const ring = document.getElementById('habitProgressRing');
      const subtitle = document.getElementById('habitTodaySubtitle');
      const dateButton = document.getElementById('habitDateButton');
      if (progress) progress.textContent = `${Math.round(summary.completionRate || 0)}%`;
      if (bar) bar.style.width = `${Math.round(summary.completionRate || 0)}%`;
      if (ring) ring.style.background = `conic-gradient(var(--primary) ${(summary.completionRate || 0) * 3.6}deg,#e5e7eb 0deg)`;
      if (subtitle) subtitle.textContent = summary.total ? `${summary.completed} of ${summary.total} scheduled today` : (visible.length ? `${visible.length} active habit${visible.length === 1 ? '' : 's'} — none scheduled for this date` : 'No active habits are scheduled for this day.');
      if (dateButton) dateButton.textContent = window.formatHabitDate(date);

      const analyticsRange = Number(document.getElementById('habitAnalyticsRange')?.value || 30);
      const from = window.HabitDomain.addDays(today(), -(analyticsRange - 1));
      const analytics = window.HabitDomain.getPortfolioAnalytics(from, today(), all, allLogs);
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      set('habitAnalyticsRate', `${Math.round(analytics.completionRate || 0)}%`);
      set('habitAnalyticsScore', Math.round(analytics.consistencyScore || 0));
      set('habitAnalyticsCompleted', analytics.completed || 0);
      set('habitAnalyticsBest', analytics.habits.reduce((m,x)=>Math.max(m,Number(x.bestStreak||0)),0));
      const activeCount = all.filter(h=>h.status==='active').length;
      set('habitAnalyticsSubtitle', activeCount ? `${activeCount} active habit${activeCount===1?'':'s'} • ${from} to ${today()}` : 'Create an active habit to start analytics.');
      const daily = document.getElementById('habitAnalyticsDaily');
      if (daily) {
        const max = Math.max(1, ...analytics.daily.map(x=>Number(x.rate||0)));
        daily.innerHTML = analytics.daily.map(x => `<div class="habit-analytics-bar${x.rate===0?' zero':''}" style="height:${Math.max(4,Math.round((x.rate/max)*100))}%" title="${esc(x.date)}: ${Math.round(x.rate)}% (${x.completed}/${x.scheduled})"></div>`).join('');
      }
      const bestList = document.getElementById('habitAnalyticsHabits');
      if (bestList) bestList.innerHTML = analytics.habits.length ? analytics.habits.map(item => { const h=window.HabitDomain.getHabitById(item.habitId,all); return `<div class="habit-analytics-habit"><div class="habit-analytics-habit-name">${esc(h?.name || 'Habit')}</div><div class="habit-analytics-track"><span style="width:${Math.round(item.completionRate)}%"></span></div><div class="habit-analytics-percent">${Math.round(item.completionRate)}%</div></div>`; }).join('') : '<div class="habit-muted">No active habits yet.</div>';

      const list = document.getElementById('habitsList');
      if (!list) return;
      if (!visible.length) {
        list.innerHTML = '<div class="habit-empty"><strong>Nothing to show</strong><span>Create a habit or choose another day/filter.</span><div style="margin-top:14px"><button class="btn btn-primary" onclick="openHabitModal()">Create Habit</button></div></div>';
        return;
      }
      list.innerHTML = visible.map(h => {
        const model = window.HabitDomain.buildHabitViewModel(h,date,all,allLogs);
        const freq = model.frequency?.type === 'weekly' ? (model.frequency.daysOfWeek || []).map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(' · ') : 'Every day';
        const notScheduled = model.status === 'not_scheduled';
        return `<article class="habit-card"><div class="habit-card-top"><div class="habit-icon">${esc(model.icon || '✓')}</div><div style="flex:1"><div class="habit-card-title">${esc(model.name)}</div><div class="habit-card-meta"><span class="habit-chip">${esc(freq)}</span>${model.category?`<span class="habit-chip">${esc(model.category)}</span>`:''}</div></div><div class="habit-status ${notScheduled?'skipped':model.status}">${esc(model.status.replace('_',' '))}</div></div>${model.description?`<div class="habit-card-description">${esc(model.description)}</div>`:''}<div class="habit-card-bottom"><div>🔥 ${model.streak.current} ${model.streak.unit==='weeks'?'week':'day'} streak</div><div class="habit-actions">${model.actions.canComplete?`<button class="habit-action primary" onclick="setHabitOccurrence('${model.id}','${date}','completed')">✓ Complete</button>`:''}${model.actions.canSkip?`<button class="habit-action" onclick="setHabitOccurrence('${model.id}','${date}','skipped')">Skip</button>`:''}<button class="habit-action" onclick="openHabitHistory('${model.id}')">History</button>${model.actions.canEdit?`<button class="habit-action" onclick="openHabitModal('${model.id}')">Edit</button>`:''}${model.actions.canArchive?`<button class="habit-action danger" onclick="archiveHabit('${model.id}')">Archive</button>`:''}</div></div></article>`;
      }).join('');
    };
  }
})(window);
