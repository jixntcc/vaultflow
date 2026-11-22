(function () {
  'use strict';
  const TIMEZONE = 'Asia/Kolkata';
  const ROOT_ID = 'personalOsDashboard';
  let selectedDate = '';
  let requestSequence = 0;

  function todayInTimezone() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return values.year + '-' + values.month + '-' + values.day;
  }
  function shiftDate(date, amount) {
    const value = new Date(date + 'T12:00:00.000Z');
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }
  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function formatAmount(value) {
    return number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function formatDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(date + 'T12:00:00.000Z'));
  }
  function root() { return document.getElementById(ROOT_ID); }

  function renderShell() {
    const host = root();
    if (!host) return;
    if (!selectedDate) selectedDate = todayInTimezone();
    host.innerHTML =
      '<section class="vf-os-panel" aria-labelledby="vfOsTitle">' +
        '<div class="vf-os-heading"><div><div class="vf-os-eyebrow">PERSONAL OS</div>' +
          '<h2 id="vfOsTitle">Daily Overview</h2><p class="vf-os-date-label" id="vfOsDateLabel">' + escapeHtml(formatDate(selectedDate)) + '</p></div>' +
          '<div class="vf-os-date-controls">' +
            '<button type="button" class="vf-os-icon-btn" id="vfOsPrev" aria-label="Previous day">‹</button>' +
            '<input type="date" id="vfOsDate" aria-label="Choose activity date" value="' + escapeHtml(selectedDate) + '">' +
            '<button type="button" class="vf-os-icon-btn" id="vfOsNext" aria-label="Next day">›</button>' +
            '<button type="button" class="vf-os-today-btn" id="vfOsToday">Today</button>' +
          '</div></div>' +
        '<div id="vfOsStatus" class="vf-os-status" role="status">Loading daily activity…</div>' +
        '<div id="vfOsContent" hidden><div class="vf-os-metrics" id="vfOsMetrics"></div>' +
          '<div class="vf-os-lower-grid">' +
            '<section class="vf-os-subpanel"><div class="vf-os-subheading"><h3>Activity timeline</h3><span id="vfOsActivityCount"></span></div>' +
              '<div id="vfOsTimeline" class="vf-os-timeline"></div></section>' +
            '<section class="vf-os-side-stack">' +
              '<div class="vf-os-subpanel"><div class="vf-os-subheading"><h3>On This Day</h3></div><div id="vfOsMemories" class="vf-os-memory-list"></div></div>' +
              '<div class="vf-os-subpanel"><div class="vf-os-subheading"><h3>Portfolio snapshot</h3><span class="vf-os-snapshot-tag">Current</span></div>' +
                '<div id="vfOsPortfolio"></div><p class="vf-os-footnote">Latest stored valuation, not a historical value for this date.</p></div>' +
            '</section></div><div class="vf-os-footer"><span id="vfOsGenerated"></span>' +
              '<button type="button" class="vf-os-refresh-btn" id="vfOsRefresh">↻ Refresh</button></div></div></section>';

    document.getElementById('vfOsPrev').addEventListener('click', () => chooseDate(shiftDate(selectedDate, -1)));
    document.getElementById('vfOsNext').addEventListener('click', () => chooseDate(shiftDate(selectedDate, 1)));
    document.getElementById('vfOsToday').addEventListener('click', () => chooseDate(todayInTimezone()));
    document.getElementById('vfOsDate').addEventListener('change', event => {
      if (event.target.value) chooseDate(event.target.value);
    });
    document.getElementById('vfOsRefresh').addEventListener('click', load);
  }
  function chooseDate(date) {
    selectedDate = date;
    const input = document.getElementById('vfOsDate');
    const label = document.getElementById('vfOsDateLabel');
    if (input) input.value = date;
    if (label) label.textContent = formatDate(date);
    load();
  }
  function setStatus(message, kind) {
    const status = document.getElementById('vfOsStatus');
    if (!status) return;
    status.hidden = false;
    status.className = 'vf-os-status' + (kind ? ' is-' + kind : '');
    status.textContent = message;
    const content = document.getElementById('vfOsContent');
    if (content) content.hidden = true;
  }
  function renderMetrics(summary) {
    const scheduled = number(summary.habitsScheduled);
    const completed = number(summary.habitsCompleted);
    const progress = scheduled ? Math.min(100, Math.round(completed / scheduled * 100)) : 0;
    const metrics = [
      { label: 'Income', value: formatAmount(summary.income), note: 'Daily total', tone: 'income' },
      { label: 'Expenses', value: formatAmount(summary.expenses), note: 'Daily total', tone: 'expense' },
      { label: 'Net cash flow', value: (number(summary.netCashFlow) > 0 ? '+' : '') + formatAmount(summary.netCashFlow), note: 'Income minus expenses', tone: number(summary.netCashFlow) >= 0 ? 'positive' : 'negative' },
      { label: 'Habits', value: completed + ' / ' + scheduled, note: number(summary.habitsPending) + ' pending · ' + number(summary.habitsSkipped) + ' skipped · ' + number(summary.habitsMissed) + ' missed', tone: 'habits', progress: progress }
    ];
    document.getElementById('vfOsMetrics').innerHTML = metrics.map(item =>
      '<article class="vf-os-metric ' + item.tone + '">' +
        '<span class="vf-os-metric-label">' + escapeHtml(item.label) + '</span>' +
        '<strong>' + escapeHtml(item.value) + '</strong>' +
        '<span class="vf-os-metric-note">' + escapeHtml(item.note) + '</span>' +
        (item.tone === 'habits' ? '<span class="vf-os-progress"><span style="width:' + item.progress + '%"></span></span>' : '') +
      '</article>'
    ).join('');
  }
  function renderTimeline(activities) {
    const host = document.getElementById('vfOsTimeline');
    document.getElementById('vfOsActivityCount').textContent = activities.length + (activities.length === 1 ? ' item' : ' items');
    if (!activities.length) {
      host.innerHTML = '<div class="vf-os-empty">No recorded activity for this date.</div>';
      return;
    }
    const icons = { transaction: '↔', habit: '✓', memory: '✦', note: '▤', portfolio: '◈' };
    host.innerHTML = activities.map(item => {
      const type = String(item.type || 'activity').toLowerCase();
      const category = item.category ? String(item.category) : type;
      const isExpense = category.toLowerCase() === 'expense';
      const amount = item.amount == null ? '' :
        '<span class="vf-os-activity-amount ' + (isExpense ? 'is-expense' : 'is-income') + '">' +
        (isExpense ? '−' : '+') + escapeHtml(formatAmount(item.amount)) + '</span>';
      const time = item.time ? escapeHtml(item.time) : 'All day';
      return '<article class="vf-os-activity"><span class="vf-os-activity-icon ' + escapeHtml(type) + '" aria-hidden="true">' +
        (icons[type] || '•') + '</span><div class="vf-os-activity-main">' +
        '<div class="vf-os-activity-title">' + escapeHtml(item.title || category) + '</div>' +
        '<div class="vf-os-activity-meta">' + escapeHtml(category) + ' <span>·</span> ' + time + '</div>' +
        (item.description ? '<div class="vf-os-activity-description">' + escapeHtml(item.description) + '</div>' : '') +
        '</div>' + amount + '</article>';
    }).join('');
  }
  function renderMemories(items) {
    const host = document.getElementById('vfOsMemories');
    if (!items.length) {
      host.innerHTML = '<div class="vf-os-empty">No memories recorded for this calendar date in previous years.</div>';
      return;
    }
    host.innerHTML = items.slice(0, 6).map(item =>
      '<article class="vf-os-memory"><span class="vf-os-memory-year">' + escapeHtml(item.year) + '</span><div>' +
      '<strong>' + escapeHtml(item.title || 'Memory') + '</strong><span>' +
      escapeHtml(item.category || 'Personal') + (item.location ? ' · ' + escapeHtml(item.location) : '') +
      '</span></div></article>'
    ).join('');
  }
  function renderPortfolio(portfolio) {
    const host = document.getElementById('vfOsPortfolio');
    const rows = Array.isArray(portfolio && portfolio.totalsByCurrency) ? portfolio.totalsByCurrency : [];
    if (!rows.length) {
      host.innerHTML = '<div class="vf-os-empty">No active portfolio positions.</div>';
      return;
    }
    host.innerHTML = rows.map(row =>
      '<div class="vf-os-portfolio-row"><span>' + escapeHtml(row.currency || 'UNKNOWN') +
      ' <small>' + number(row.positions) + ' positions</small></span><strong>' +
      escapeHtml(formatAmount(row.currentValue)) + '</strong></div>'
    ).join('');
  }
  function renderData(data) {
    renderMetrics(data.summary || {});
    renderTimeline(Array.isArray(data.activities) ? data.activities : []);
    renderMemories(Array.isArray(data.onThisDay) ? data.onThisDay : []);
    renderPortfolio(data.portfolio);
    const generated = document.getElementById('vfOsGenerated');
    if (generated) {
      const stamp = data.generatedAt ? new Date(data.generatedAt) : null;
      generated.textContent = stamp && !Number.isNaN(stamp.getTime())
        ? 'Updated ' + stamp.toLocaleTimeString('en-IN', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }) : '';
    }
    document.getElementById('vfOsStatus').hidden = true;
    document.getElementById('vfOsContent').hidden = false;
  }
  async function load() {
    const host = root();
    const app = document.getElementById('appContainer');
    if (!host || !app || app.classList.contains('hidden')) return;
    if (!selectedDate) selectedDate = todayInTimezone();
    if (!document.getElementById('vfOsDate')) renderShell();
    const token = localStorage.getItem('vf_token');
    if (!token || token === 'demo-token') {
      setStatus('Daily activity is available when you are signed in to your VaultFlow account.', 'muted');
      return;
    }
    const currentRequest = ++requestSequence;
    setStatus('Loading daily activity…');
    try {
      const response = await fetch('/api/activity?date=' + encodeURIComponent(selectedDate) + '&timezone=' + encodeURIComponent(TIMEZONE), {
        method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load daily activity.');
      if (currentRequest !== requestSequence) return;
      if (data.date !== selectedDate) throw new Error('The activity response date did not match the selected date.');
      renderData(data);
    } catch (error) {
      if (currentRequest !== requestSequence) return;
      setStatus(error.message || 'Unable to load daily activity. Please try again.', 'error');
    }
  }
  function boot() {
    if (!root()) return;
    selectedDate = todayInTimezone();
    renderShell();
    const app = document.getElementById('appContainer');
    const dashboard = document.getElementById('dashboard');
    const maybeLoad = () => {
      if (app && !app.classList.contains('hidden') && dashboard && dashboard.classList.contains('active')) load();
    };
    if (app) new MutationObserver(maybeLoad).observe(app, { attributes: true, attributeFilter: ['class'] });
    if (dashboard) new MutationObserver(maybeLoad).observe(dashboard, { attributes: true, attributeFilter: ['class'] });
    maybeLoad();
  }
  window.VaultFlowPersonalOS = Object.freeze({ load: load });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();