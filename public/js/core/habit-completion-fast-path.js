(function (window, document) {
  'use strict';

  if (window.__vfHabitCompletionFastPathInstalled) return;
  window.__vfHabitCompletionFastPathInstalled = true;

  function token() { return localStorage.getItem('vf_token') || ''; }

  async function request(endpoint, options = {}) {
    if (window.VaultFlowApi?.request) return window.VaultFlowApi.request(endpoint, { ...options, token: token() });
    const response = await fetch(endpoint, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: options.body == null ? undefined : JSON.stringify(options.body)
    });
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  async function handle(button) {
    const habitId = button.dataset.vfComplete;
    const date = button.dataset.vfDate;
    const requestedStatus = button.dataset.vfStatus || 'completed';
    if (!habitId || !date) return;
    button.disabled = true;
    try {
      const logs = window.VaultFlowStore?.getHabitLogs?.() || [];
      const existing = logs.find(log => String(log.habitId) === String(habitId) && log.scheduledDate === date);
      if (requestedStatus === 'completed') {
        const result = await request(`/api/habits/${encodeURIComponent(habitId)}/logs`, {
          method: 'POST', body: { scheduledDate: date, status: 'completed' }
        });
        window.VaultFlowStore?.addOrUpdateHabitLog?.(result);
      } else if (existing?._id) {
        await request(`/api/habit-logs/${encodeURIComponent(existing._id)}`, { method: 'DELETE' });
        window.VaultFlowStore?.removeHabitLog?.(existing._id);
      }
      window.dispatchEvent(new CustomEvent('vf:habit-completion-changed', { detail: { habitId, date, status: requestedStatus } }));
    } catch (error) {
      console.error('[Habit Completion] failed:', error);
      if (typeof window.showToast === 'function') window.showToast(error?.message || 'Unable to update habit completion', 'error');
    } finally { button.disabled = false; }
  }

  // Capture before habit-calendar.js so the legacy delegated listener cannot
  // turn Complete into a no-op or issue a duplicate request.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-vf-complete]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handle(button);
  }, true);
})(window, document);
