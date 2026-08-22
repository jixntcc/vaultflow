(function (window) {
  'use strict';

  // This layer is intentionally dependency-light because it is injected before
  // the application scripts by the service worker. It provides compatibility
  // helpers first, then patches page renderers once the rest of the app exists.
  if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function (value) {
      return String(value ?? '').replace(/[&<>\"']/g, function (c) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' })[c];
      });
    };
  }

  // Preserve the existing login across SPA/page navigations. The transaction
  // page must not turn a transient/missing Authorization header into a logout.
  // The stored token is only attached when a request has not already supplied
  // one; explicit request headers always win.
  (function installAuthBridge() {
    const token = localStorage.getItem('vf_token');
    const username = localStorage.getItem('vf_username');
    if (token) {
      window.__VAULTFLOW_TOKEN__ = token;
      window.__VAULTFLOW_USERNAME__ = username || '';
      if (window.VaultFlowStore?.setState) {
        try {
          const current = window.VaultFlowStore.getState?.() || {};
          if (!current.auth?.token) {
            window.VaultFlowStore.setState(state => ({
              ...state,
              auth: { ...state.auth, token, user: username ? { username } : state.auth?.user, mode: 'signed_in' }
            }), { type: 'auth:restore' });
          }
        } catch (_) {}
      }
    }

    if (window.__vaultflowFetchBridgeInstalled) return;
    window.__vaultflowFetchBridgeInstalled = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const sameOriginApi = /^\/?api\//.test(url) || url.indexOf(window.location.origin + '/api/') === 0;
        if (sameOriginApi) {
          const currentToken = localStorage.getItem('vf_token');
          if (currentToken) {
            const options = init ? { ...init } : {};
            const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + currentToken);
            options.headers = headers;
            return nativeFetch(input, options);
          }
        }
      } catch (_) {}
      return nativeFetch(input, init);
    };
  })();

  function esc(value) { return window.escapeHtml(value); }
  function habits() { return window.VaultFlowStore?.getHabits?.() || []; }
  function logs() { return window.VaultFlowStore?.getHabitLogs?.() || []; }
  function today() { return window.HabitDomain?.getTodayLocalDate?.() || new Date().toISOString().slice(0,10); }

  function hideMonthlyReview() {
    const ids = ['dashboardMonthlyReviewsCard', 'monthlyReviewSection', 'dashboardMonthlyReview'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.querySelectorAll('[data-dashboard-section="monthly-review"], .dashboard-monthly-review, .monthly-review-section').forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('.page.active *').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text === 'Monthly Review') {
        const section = el.closest('section, .card, .dashboard-section, [class*="review"]');
        if (section) section.style.display = 'none';
      }
    });
  }

  function patchDashboard() {
    if (typeof window.renderDashboardRetention === 'function' && !window.__vfRetentionPatched) {
      const original = window.renderDashboardRetention;
      window.renderDashboardRetention = function () {
        try { return original.apply(this, arguments); } finally { hideMonthlyReview(); }
      };
      window.__vfRetentionPatched = true;
    }
    hideMonthlyReview();
  }

  function patchHabits() {
    if (typeof window.renderHabitsPage !== 'function' || window.__vfHabitsPatched) return;
    const original = window.renderHabitsPage;
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

      // The original page owns the detailed analytics widgets. Let it render
      // those first, then replace only the broken habit-list projection.
      try { original.apply(this, arguments); } catch (error) { console.warn('[VaultFlow] original habit renderer failed:', error); }

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
      if (dateButton) dateButton.textContent = window.formatHabitDate ? window.formatHabitDate(date) : date;

      const list = document.getElementById('habitsList');
      if (!list) return;
      if (!visible.length) {
        list.innerHTML = '<div class="habit-empty"><strong>Nothing to show</strong><span>Create a habit or choose another day/filter.</span><div style="margin-top:14px"><button class="btn btn-primary" onclick="openHabitModal()">Create Habit</button></div></div>';
        return;
      }
      list.innerHTML = visible.map(h => {
        const model = window.HabitDomain.buildHabitViewModel(h, date, all, allLogs);
        const freq = model.frequency?.type === 'weekly' ? (model.frequency.daysOfWeek || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(' · ') : 'Every day';
        const notScheduled = model.status === 'not_scheduled';
        return `<article class="habit-card"><div class="habit-card-top"><div class="habit-icon">${esc(model.icon || '✓')}</div><div style="flex:1"><div class="habit-card-title">${esc(model.name)}</div><div class="habit-card-meta"><span class="habit-chip">${esc(freq)}</span>${model.category ? `<span class="habit-chip">${esc(model.category)}</span>` : ''}</div></div><div class="habit-status ${notScheduled ? 'skipped' : model.status}">${esc(model.status.replace('_',' '))}</div></div>${model.description ? `<div class="habit-card-description">${esc(model.description)}</div>` : ''}<div class="habit-card-bottom"><div>🔥 ${model.streak.current} ${model.streak.unit === 'weeks' ? 'week' : 'day'} streak</div><div class="habit-actions">${model.actions.canComplete ? `<button class="habit-action primary" onclick="setHabitOccurrence('${model.id}','${date}','completed')">✓ Complete</button>` : ''}${model.actions.canSkip ? `<button class="habit-action" onclick="setHabitOccurrence('${model.id}','${date}','skipped')">Skip</button>` : ''}<button class="habit-action" onclick="openHabitHistory('${model.id}')">History</button>${model.actions.canEdit ? `<button class="habit-action" onclick="openHabitModal('${model.id}')">Edit</button>` : ''}${model.actions.canArchive ? `<button class="habit-action danger" onclick="archiveHabit('${model.id}')">Archive</button>` : ''}</div></div></article>`;
      }).join('');
    };
    window.__vfHabitsPatched = true;
  }

  // The legacy transaction form already has a submit handler, but the current
  // restoration stack can occasionally leave that listener detached while the
  // modal remains visible. In that state the browser performs the form's native
  // submission, reloads the SPA, and the transaction is never POSTed.
  // Capture the submit before the native default can occur, then delegate to
  // the canonical application handler. This preserves the existing API payload,
  // validation, vault logic, refresh handling and rendering instead of creating
  // a second transaction implementation here.
  function installTransactionSubmitGuard() {
    const form = document.getElementById('transactionForm');
    if (!form || form.dataset.vfSubmitGuard === '1') return;
    form.dataset.vfSubmitGuard = '1';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const handler = window.handleTransactionSubmit;
      if (typeof handler !== 'function') {
        console.error('[VaultFlow] Transaction handler is unavailable.');
        if (typeof window.showToast === 'function') window.showToast('Transaction form is still loading. Please try again.', 'error');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton && submitButton.dataset.vfSaving === '1') return;
      if (submitButton) {
        submitButton.dataset.vfSaving = '1';
        submitButton.disabled = true;
        submitButton.dataset.vfOriginalText = submitButton.textContent;
        submitButton.textContent = 'Saving...';
      }

      Promise.resolve(handler(event)).catch(error => {
        console.error('[VaultFlow] Transaction save failed:', error);
        if (typeof window.showToast === 'function') window.showToast(error?.message || 'Could not save transaction.', 'error');
      }).finally(() => {
        if (submitButton) {
          submitButton.dataset.vfSaving = '0';
          submitButton.disabled = false;
          submitButton.textContent = submitButton.dataset.vfOriginalText || 'Save';
        }
      });
    }, true);
  }

  function initialize() {
    patchDashboard();
    patchHabits();
    installTransactionSubmitGuard();

    // The monolithic frontend defines its page functions asynchronously in a
    // few deployments. Retry briefly instead of racing those definitions.
    if (!window.__vfInitTimer) {
      let attempts = 0;
      window.__vfInitTimer = window.setInterval(() => {
        attempts += 1;
        patchDashboard();
        patchHabits();
        installTransactionSubmitGuard();
        if (typeof window.renderHabitsPage === 'function' && document.getElementById('habitsList')) {
          try { window.renderHabitsPage(); } catch (_) {}
        }
        hideMonthlyReview();
        if (attempts >= 20) {
          clearInterval(window.__vfInitTimer);
          window.__vfInitTimer = null;
        }
      }, 250);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();

  // Keep the Dashboard free of the retired Monthly Review section even when
  // the legacy renderer redraws the page after an API response.
  if (!window.__vfMonthlyObserver) {
    window.__vfMonthlyObserver = new MutationObserver(() => hideMonthlyReview());
    window.__vfMonthlyObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})(window);
