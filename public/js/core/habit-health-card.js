(function (window, document) {
  'use strict';

  if (window.__vfHabitHealthCardInstalled) return;
  window.__vfHabitHealthCardInstalled = true;

  const categoryIcons = {
    Health: '♥', Fitness: '✦', Learning: '▣', Work: '◈', Finance: '◉',
    Personal: '✿', Mindfulness: '◌', Other: '•'
  };

  function habits() { return window.VaultFlowStore?.getHabits?.() || []; }
  function logs() { return window.VaultFlowStore?.getHabitLogs?.() || []; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function isHabitsPage() {
    const currentPage = window.VaultFlowStore?.getState?.()?.ui?.currentPage;
    if (currentPage === 'habits') return true;

    const habitsList = document.getElementById('habitsList');
    if (habitsList?.closest('.page.active')) return true;
    if (document.querySelector('.page.active .vf-habit-shell')) return true;

    return false;
  }

  function buildModel() {
    const domain = window.HabitDomain;
    if (!domain) return null;

    const active = habits().filter(h => h.status === 'active');
    const today = domain.getTodayLocalDate();
    const todaySummary = domain.buildTodaySummary(today, habits(), logs());
    const from = domain.addDays(today, -29);

    const scheduled = active.reduce((sum, habit) => sum + domain.getScheduledDates(habit, from, today).length, 0);
    const completed = active.reduce((sum, habit) => {
      const dates = domain.getScheduledDates(habit, from, today);
      return sum + dates.filter(date => domain.getHabitLog(habit._id, date, logs())?.status === 'completed').length;
    }, 0);
    const recentRate = scheduled ? (completed / scheduled) * 100 : 0;
    const bestStreak = active.reduce((max, habit) => Math.max(max, Number(domain.getHabitStreak(habit._id, today, active, logs()).best || 0)), 0);

    const categoryMap = new Map();
    active.forEach(habit => {
      const category = habit.category || 'Other';
      const dates = domain.getScheduledDates(habit, from, today);
      const item = categoryMap.get(category) || { category, scheduled: 0, completed: 0 };
      item.scheduled += dates.length;
      item.completed += dates.filter(date => domain.getHabitLog(habit._id, date, logs())?.status === 'completed').length;
      categoryMap.set(category, item);
    });

    const categories = [...categoryMap.values()]
      .map(item => ({ ...item, rate: item.scheduled ? (item.completed / item.scheduled) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate || b.completed - a.completed)
      .slice(0, 4);

    let message = 'Create a habit to start building consistency.';
    if (active.length) {
      if (!todaySummary.total) message = 'No active habits are scheduled today.';
      else if (todaySummary.completed === todaySummary.total) message = 'Excellent — you completed everything scheduled today.';
      else if (todaySummary.completed > 0) message = 'Good momentum — finish the remaining habit(s) today.';
      else if (recentRate >= 70) message = 'Your recent consistency is strong. Keep the streak alive.';
      else if (recentRate >= 40) message = 'Small wins compound. Focus on completing today’s next habit.';
      else message = 'Start small today. One completed habit moves the score forward.';
    }

    return {
      active,
      today: todaySummary,
      recentRate,
      bestStreak,
      categories,
      message,
      recentDays: 30
    };
  }

  function render() {
    const root = document.getElementById('habitReportSnapshot');
    if (!root) return;

    // The Habit Health Card belongs exclusively to the Habits page. The
    // snapshot mount exists in the shared SPA shell, so never leave the card
    // visible while another page is active.
    if (!isHabitsPage()) {
      root.style.display = 'none';
      return;
    }

    root.style.display = '';
    const model = buildModel();
    if (!model) return;

    const todayPct = Math.round(model.today.completionRate || 0);
    const recentPct = Math.round(model.recentRate || 0);
    const ringDegrees = Math.max(0, Math.min(100, todayPct)) * 3.6;

    root.className = 'card habit-health-card';
    root.innerHTML = `
      <div class="habit-health-head">
        <div class="habit-health-title-wrap">
          <div class="habit-health-icon" aria-hidden="true">✓</div>
          <div>
            <div class="habit-health-eyebrow">Habit health</div>
            <h3 class="section-title">Consistency at a glance</h3>
            <p class="card-subtitle">Your active habits across today and the last 30 days.</p>
          </div>
        </div>
        <button class="btn btn-secondary habit-health-open" data-vf-open-habits type="button">Open Habits <span aria-hidden="true">→</span></button>
      </div>

      <div class="habit-health-today">
        <div class="habit-health-today-copy">
          <span class="habit-health-label">TODAY</span>
          <div class="habit-health-today-value">${model.today.completed}<span>/${model.today.total}</span></div>
          <div class="habit-health-today-status">${model.today.total ? `${todayPct}% of scheduled habits completed` : 'No habits scheduled today'}</div>
          <div class="habit-health-track" role="progressbar" aria-label="Today's habit completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${todayPct}">
            <span style="width:${todayPct}%"></span>
          </div>
        </div>
        <div class="habit-health-ring" style="--vf-ring:${ringDegrees}deg" aria-label="${todayPct}% completed today">
          <div><strong>${todayPct}%</strong><span>today</span></div>
        </div>
      </div>

      <div class="habit-health-metrics">
        <div><span>Active habits</span><strong>${model.active.length}</strong></div>
        <div><span>30-day consistency</span><strong>${recentPct}%</strong></div>
        <div><span>Best streak</span><strong>${model.bestStreak}<small> days</small></strong></div>
      </div>

      <div class="habit-health-section">
        <div class="habit-health-section-head">
          <div>
            <span class="habit-health-label">CATEGORY PERFORMANCE</span>
            <p>Where your consistency is strongest.</p>
          </div>
          <span class="habit-health-range">30 days</span>
        </div>
        <div class="habit-health-categories">
          ${model.categories.length ? model.categories.map(item => `
            <div class="habit-health-category">
              <div class="habit-health-category-top">
                <span><i>${categoryIcons[item.category] || '•'}</i>${escapeHtml(item.category)}</span>
                <strong>${Math.round(item.rate)}%</strong>
              </div>
              <div class="habit-health-category-track"><span style="width:${Math.min(100, Math.max(0, item.rate))}%"></span></div>
              <small>${item.completed}/${item.scheduled} completed</small>
            </div>
          `).join('') : '<div class="habit-health-empty">Your category performance will appear here once you have active habits.</div>'}
        </div>
      </div>

      <div class="habit-health-message"><span aria-hidden="true">✦</span><p>${escapeHtml(model.message)}</p></div>
    `;

    root.querySelector('[data-vf-open-habits]')?.addEventListener('click', () => {
      if (typeof window.switchPage === 'function') window.switchPage('habits');
    });
  }

  function install() {
    if (typeof window.renderHabitReportSnapshot === 'function') {
      window.renderHabitReportSnapshot = render;
    }
    render();

    if (window.VaultFlowStore?.subscribe) {
      window.VaultFlowStore.subscribe(() => window.requestAnimationFrame(render));
    }
    window.addEventListener('vf:habit-completion-changed', () => window.requestAnimationFrame(render));

    // SPA navigation may change the active page without changing the store.
    // Watch only page-level state so the card follows navigation immediately.
    const observer = new MutationObserver(() => window.requestAnimationFrame(render));
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window, document);
