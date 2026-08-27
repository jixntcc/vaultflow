(function (window, document) {
  'use strict';

  if (window.__vfHabitCalendarInstalled) return;
  window.__vfHabitCalendarInstalled = true;

  const CATEGORIES = ['Fitness', 'Learning', 'Personal', 'Health', 'Finance', 'Mindfulness', 'Work', 'Other'];
  const CATEGORY_ICONS = {
    Fitness: '🏃', Learning: '📚', Personal: '✨', Health: '❤️', Finance: '💰',
    Mindfulness: '🧘', Work: '💼', Other: '●'
  };
  const CATEGORY_COLORS = {
    Fitness: '#10b981', Learning: '#6366f1', Personal: '#f59e0b', Health: '#ef4444',
    Finance: '#14b8a6', Mindfulness: '#8b5cf6', Work: '#64748b', Other: '#94a3b8'
  };

  const state = {
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    selectedDate: null,
    category: 'All',
    initialized: false,
    lastSignature: ''
  };

  const pad = n => String(n).padStart(2, '0');
  const localDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseDate = value => {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' })[c]);
  const domain = () => window.HabitDomain;
  const store = () => window.VaultFlowStore;
  const habits = () => store()?.getHabits?.() || [];
  const logs = () => store()?.getHabitLogs?.() || [];
  const today = () => domain()?.getTodayLocalDate?.() || localDate(new Date());

  function activeHabits() {
    return habits().filter(h => h.status === 'active');
  }

  function normalizeCategory(value) {
    const category = String(value || '').trim();
    return category || 'Other';
  }

  function matchesCategory(habit) {
    return state.category === 'All' || normalizeCategory(habit.category) === state.category;
  }

  function scheduledOn(habit, date) {
    return domain()?.isScheduledOn?.(habit, date) || false;
  }

  function statusFor(habit, date) {
    return domain()?.getHabitStatus?.(habit._id, date, habits(), logs()) || 'pending';
  }

  function monthDays() {
    const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
    const start = new Date(first);
    const mondayOffset = (first.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      return d;
    });
  }

  function dayStats(dateString) {
    const scheduled = activeHabits().filter(h => matchesCategory(h) && scheduledOn(h, dateString));
    const completed = scheduled.filter(h => statusFor(h, dateString) === 'completed');
    const skipped = scheduled.filter(h => statusFor(h, dateString) === 'skipped');
    return { scheduled, completed, skipped, rate: scheduled.length ? completed.length / scheduled.length * 100 : 0 };
  }

  function selectedHabits() {
    const date = state.selectedDate || today();
    return activeHabits().filter(h => matchesCategory(h) && scheduledOn(h, date));
  }

  function categoryStats() {
    const from = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
    const to = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0);
    const fromString = localDate(from), toString = localDate(to);
    return CATEGORIES.map(category => {
      const items = activeHabits().filter(h => normalizeCategory(h.category) === category);
      let scheduled = 0, completed = 0;
      items.forEach(h => {
        const dates = domain()?.getScheduledDates?.(h, fromString, toString) || [];
        scheduled += dates.length;
        completed += dates.filter(d => statusFor(h, d) === 'completed').length;
      });
      return { category, habits: items.length, scheduled, completed, rate: scheduled ? completed / scheduled * 100 : 0 };
    }).filter(x => x.habits > 0);
  }

  function monthSummary() {
    const from = localDate(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
    const to = localDate(new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0));
    const analytics = domain()?.getPortfolioAnalytics?.(from, to, activeHabits(), logs());
    return analytics || { scheduled: 0, completed: 0, completionRate: 0 };
  }

  function categoryChip(category) {
    const active = state.category === category ? ' active' : '';
    const icon = category === 'All' ? '◉' : (CATEGORY_ICONS[category] || '●');
    return `<button class="vf-habit-cat${active}" data-vf-category="${esc(category)}"><span>${icon}</span>${esc(category)}</button>`;
  }

  function renderCalendar() {
    const days = monthDays();
    const month = state.month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const todayString = today();
    return `<section class="vf-habit-card vf-calendar-card">
      <div class="vf-calendar-head">
        <div>
          <div class="vf-eyebrow">Calendar</div>
          <h2>${esc(month)}</h2>
          <p>See your consistency at a glance and choose any day to work on it.</p>
        </div>
        <div class="vf-calendar-actions">
          <button class="vf-icon-btn" data-vf-month="prev" aria-label="Previous month">‹</button>
          <button class="vf-today-btn" data-vf-month="today">Today</button>
          <button class="vf-icon-btn" data-vf-month="next" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="vf-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div>${d}</div>`).join('')}</div>
      <div class="vf-calendar-grid">
        ${days.map(date => {
          const dateString = localDate(date);
          const inMonth = date.getMonth() === state.month.getMonth();
          const stats = dayStats(dateString);
          const selected = state.selectedDate === dateString;
          const isToday = todayString === dateString;
          const pct = Math.round(stats.rate);
          const intensity = stats.scheduled ? Math.max(1, Math.min(5, Math.ceil(pct / 20))) : 0;
          return `<button class="vf-day ${inMonth ? '' : 'outside'} ${selected ? 'selected' : ''} ${isToday ? 'today' : ''} level-${intensity}" data-vf-date="${dateString}">
            <span class="vf-day-number">${date.getDate()}</span>
            ${stats.scheduled ? `<span class="vf-day-count">${stats.completed.length}/${stats.scheduled.length}</span><span class="vf-day-bar"><i style="width:${pct}%"></i></span>` : '<span class="vf-day-empty">—</span>'}
          </button>`;
        }).join('')}
      </div>
      <div class="vf-calendar-legend"><span><i class="vf-legend-dot"></i> completed</span><span><i class="vf-legend-outline"></i> selected</span><span>0–100% daily completion</span></div>
    </section>`;
  }

  function renderDayPanel() {
    const date = state.selectedDate || today();
    const selected = parseDate(date);
    const label = selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const items = selectedHabits();
    const stats = dayStats(date);
    return `<section class="vf-habit-card vf-day-card">
      <div class="vf-section-head">
        <div><div class="vf-eyebrow">Daily plan</div><h2>${esc(label)}</h2><p>${stats.completed.length} of ${stats.scheduled.length} scheduled habits completed</p></div>
        <div class="vf-day-score">${Math.round(stats.rate)}%<small>complete</small></div>
      </div>
      ${items.length ? `<div class="vf-day-list">${items.map(h => renderHabitRow(h, date)).join('')}</div>` : `<div class="vf-empty-day"><div class="vf-empty-icon">☀</div><strong>No habits scheduled</strong><span>Create a habit or select another date.</span><button class="vf-primary" data-vf-add-habit>Add Habit</button></div>`}
    </section>`;
  }

  function renderHabitRow(habit, date) {
    const status = statusFor(habit, date);
    const category = normalizeCategory(habit.category);
    const streak = domain()?.getHabitStreak?.(habit._id, date, habits(), logs()) || { current: 0, unit: 'occurrences' };
    const isDone = status === 'completed';
    const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
    return `<article class="vf-habit-row ${isDone ? 'done' : ''}">
      <div class="vf-habit-avatar" style="--vf-cat:${color}">${esc(habit.icon || CATEGORY_ICONS[category] || '✓')}</div>
      <div class="vf-habit-main"><div class="vf-habit-title">${esc(habit.name)}</div><div class="vf-habit-meta"><span>${CATEGORY_ICONS[category] || '●'} ${esc(category)}</span><span>${habit.frequency?.type === 'weekly' ? 'Selected days' : 'Every day'}</span><span>🔥 ${streak.current} ${streak.unit === 'weeks' ? 'week' : 'day'} streak</span></div>${habit.description ? `<div class="vf-habit-desc">${esc(habit.description)}</div>` : ''}</div>
      <div class="vf-habit-actions"><span class="vf-status ${status}">${status === 'completed' ? 'Completed' : status === 'skipped' ? 'Skipped' : status === 'missed' ? 'Missed' : 'Pending'}</span><button class="vf-complete-btn ${isDone ? 'completed' : ''}" data-vf-complete="${esc(habit._id)}" data-vf-date="${date}" data-vf-status="${isDone ? 'pending' : 'completed'}">${isDone ? '✓ Done' : 'Complete'}</button><button class="vf-more-btn" data-vf-edit="${esc(habit._id)}">Edit</button></div>
    </article>`;
  }

  function renderCategoryAnalytics() {
    const summary = monthSummary();
    const categories = categoryStats();
    return `<section class="vf-habit-card vf-analytics-card">
      <div class="vf-section-head"><div><div class="vf-eyebrow">Monthly performance</div><h2>Category consistency</h2><p>${summary.completed} completed of ${summary.scheduled} scheduled this month</p></div><div class="vf-month-score">${Math.round(summary.completionRate || 0)}%<small>completion</small></div></div>
      <div class="vf-category-bars">${categories.length ? categories.map(item => `<button class="vf-category-stat" data-vf-category="${esc(item.category)}"><div class="vf-category-stat-top"><span>${CATEGORY_ICONS[item.category] || '●'} ${esc(item.category)}</span><strong>${Math.round(item.rate)}%</strong></div><div class="vf-progress"><i style="width:${Math.min(100, Math.max(0, item.rate))}%;background:${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}"></i></div><small>${item.completed}/${item.scheduled} completions · ${item.habits} habit${item.habits === 1 ? '' : 's'}</small></button>`).join('') : '<div class="vf-no-data">Create your first habit to start building category analytics.</div>'}</div>
    </section>`;
  }

  function render() {
    const list = document.getElementById('habitsList');
    if (!list) return;
    const page = list.closest('.page');
    if (!page) return;
    const activePage = page.classList.contains('active') || page.style.display === 'block';
    if (!activePage) return;

    const signature = JSON.stringify({
      habits: habits().map(h => [h._id, h.name, h.category, h.status, h.startDate, h.endDate, h.frequency]),
      logs: logs().map(l => [l._id, l.habitId, l.scheduledDate, l.status]),
      month: localDate(state.month), date: state.selectedDate, category: state.category
    });
    if (signature === state.lastSignature && state.initialized) return;
    state.lastSignature = signature;

    if (!state.selectedDate) state.selectedDate = today();
    const cats = ['All', ...CATEGORIES.filter(c => activeHabits().some(h => normalizeCategory(h.category) === c))];
    if (state.category !== 'All' && !cats.includes(state.category)) state.category = 'All';

    const currentDayStats = dayStats(state.selectedDate);
    const month = monthSummary();
    const active = activeHabits();
    const currentStreak = active.reduce((max, h) => Math.max(max, Number(domain()?.getHabitStreak?.(h._id, today(), active, logs())?.current || 0)), 0);

    page.dataset.vfHabitCalendar = '1';
    page.innerHTML = `<div class="vf-habit-shell">
      <header class="vf-habit-hero"><div><div class="vf-eyebrow">Habit tracker</div><h1>Habits</h1><p>Build consistency through small actions that repeat.</p></div><button class="vf-primary vf-add" data-vf-add-habit>＋ Add Habit</button></header>
      <section class="vf-habit-metrics"><div><span>Today</span><strong>${currentDayStats.completed.length}/${currentDayStats.scheduled.length}</strong><small>scheduled completed</small></div><div><span>This month</span><strong>${Math.round(month.completionRate || 0)}%</strong><small>completion rate</small></div><div><span>Active habits</span><strong>${active.length}</strong><small>across ${new Set(active.map(h => normalizeCategory(h.category))).size} categories</small></div><div><span>Best active streak</span><strong>🔥 ${currentStreak}</strong><small>days / occurrences</small></div></section>
      <section class="vf-category-filter"><div class="vf-filter-label">Categories</div><div class="vf-category-chips">${cats.map(categoryChip).join('')}</div></section>
      <div class="vf-habit-main-grid">${renderCalendar()}${renderDayPanel()}</div>
      ${renderCategoryAnalytics()}
    </div>`;
    state.initialized = true;
  }

  function rerenderSoon() {
    window.clearTimeout(window.__vfHabitCalendarTimer);
    window.__vfHabitCalendarTimer = window.setTimeout(render, 40);
  }

  document.addEventListener('click', event => {
    const add = event.target.closest('[data-vf-add-habit]');
    if (add) {
      event.preventDefault();
      if (typeof window.openHabitModal === 'function') window.openHabitModal();
      return;
    }

    const category = event.target.closest('[data-vf-category]');
    if (category) {
      event.preventDefault();
      state.category = category.dataset.vfCategory || 'All';
      state.lastSignature = '';
      rerenderSoon();
      return;
    }

    const date = event.target.closest('[data-vf-date]');
    if (date) {
      event.preventDefault();
      state.selectedDate = date.dataset.vfDate;
      state.lastSignature = '';
      rerenderSoon();
      return;
    }

    const month = event.target.closest('[data-vf-month]');
    if (month) {
      event.preventDefault();
      const action = month.dataset.vfMonth;
      if (action === 'prev') state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
      else if (action === 'next') state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
      else state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (action === 'today') state.selectedDate = today();
      state.lastSignature = '';
      rerenderSoon();
      return;
    }

    const complete = event.target.closest('[data-vf-complete]');
    if (complete) {
      event.preventDefault();
      const id = complete.dataset.vfComplete;
      const dateValue = complete.dataset.vfDate;
      const status = complete.dataset.vfStatus || 'completed';
      if (typeof window.setHabitOccurrence === 'function') {
        complete.disabled = true;
        Promise.resolve(window.setHabitOccurrence(id, dateValue, status)).finally(() => {
          state.lastSignature = '';
          rerenderSoon();
        });
      }
      return;
    }

    const edit = event.target.closest('[data-vf-edit]');
    if (edit) {
      event.preventDefault();
      if (typeof window.openHabitModal === 'function') window.openHabitModal(edit.dataset.vfEdit);
    }
  }, true);

  function initialize() {
    render();
    if (store()?.subscribe) store().subscribe(() => rerenderSoon());
    if (!window.__vfHabitCalendarPoll) {
      window.__vfHabitCalendarPoll = window.setInterval(() => {
        const list = document.getElementById('habitsList');
        if (list && list.closest('.page')?.classList.contains('active')) render();
      }, 700);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})(window, document);
