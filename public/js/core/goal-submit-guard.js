(function (window, document) {
  'use strict';

  // The Goals form already has the canonical handleGoalSubmit() implementation.
  // This guard exists only to prevent a native browser submission when a
  // restoration/re-render has detached the normal listener.
  function installGoalSubmitGuard() {
    const form = document.getElementById('goalForm');
    if (!form || form.dataset.vfGoalSubmitGuard === '1') return;
    form.dataset.vfGoalSubmitGuard = '1';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const handler = window.handleGoalSubmit;
      if (typeof handler !== 'function') {
        console.error('[VaultFlow] Goal handler is unavailable.');
        if (typeof window.showToast === 'function') {
          window.showToast('Goal form is still loading. Please try again.', 'error');
        }
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
        console.error('[VaultFlow] Goal save failed:', error);
        if (typeof window.showToast === 'function') {
          window.showToast(error?.message || 'Could not save goal.', 'error');
        }
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
    installGoalSubmitGuard();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installGoalSubmitGuard, { once: true });
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      installGoalSubmitGuard();
      attempts += 1;
      if (attempts >= 20 || document.getElementById('goalForm')?.dataset.vfGoalSubmitGuard === '1') {
        window.clearInterval(timer);
      }
    }, 250);
  }

  initialize();
})(window, document);