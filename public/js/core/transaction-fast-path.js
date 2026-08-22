(function (window, document) {
  'use strict';

  // Phase 10B transaction fast path.
  // The normal API can take a few seconds, but the UI should never wait for
  // that round trip before showing the user's transaction. We optimistically
  // render the transaction, close the modal immediately, and reconcile with
  // the server in the background. A global lock prevents duplicate submits
  // even if the user reopens the modal while the first request is pending.
  if (window.__vfTransactionFastPathInstalled) return;
  window.__vfTransactionFastPathInstalled = true;
  window.__vfTransactionSaveInFlight = false;

  function moneyData() {
    const get = id => document.getElementById(id);
    const type = get('txnType')?.value || 'expense';
    const vaultId = get('txnVault')?.value || '';
    const vaults = Array.isArray(window.vaults) ? window.vaults : [];
    const data = {
      date: get('txnDate')?.value || new Date().toISOString().slice(0, 10),
      time: get('txnTime')?.value || '00:00',
      type,
      amount: Number(get('txnAmount')?.value || 0),
      category: get('txnCategory')?.value?.trim() || 'Uncategorized',
      location: get('txnLocation')?.value?.trim() || '',
      wallet: get('txnWallet')?.value || 'HR',
      paymentMethod: get('txnPaymentMethod')?.value || 'online',
      notes: get('txnNotes')?.value?.trim() || ''
    };
    if (type === 'expense' && vaultId) {
      data.vaultId = vaultId;
      data.vaultName = vaults.find(v => String(v._id) === String(vaultId))?.name || '';
    }
    return data;
  }

  function setSaving(button, saving) {
    if (!button) return;
    if (saving) {
      button.dataset.vfFastSaving = '1';
      button.disabled = true;
      button.dataset.vfFastOriginalText = button.textContent || 'Save';
      button.textContent = 'Saving…';
    } else {
      button.dataset.vfFastSaving = '0';
      button.disabled = false;
      button.textContent = button.dataset.vfFastOriginalText || 'Save';
    }
  }

  function renderImmediately() {
    try { window.calculateWalletBalances?.(); } catch (_) {}
    try { window.renderDashboard?.(); } catch (_) {}
    try { window.renderCurrentPage?.(); } catch (_) {}
  }

  function closeTransactionModal() {
    try {
      if (typeof window.closeTransactionModal === 'function') window.closeTransactionModal();
      else document.getElementById('transactionModal')?.classList.remove('active');
    } catch (_) {
      document.getElementById('transactionModal')?.classList.remove('active');
    }
  }

  function toast(message, type) {
    try { window.showToast?.(message, type); } catch (_) {}
  }

  async function fastSubmit(form, button) {
    if (window.__vfTransactionSaveInFlight) {
      toast('A transaction is already being saved. Please wait a moment.', 'warning');
      return;
    }

    if (button?.dataset.vfFastSaving === '1') return;

    const id = document.getElementById('txnId')?.value || '';
    const data = moneyData();
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      toast('Enter a valid transaction amount.', 'error');
      return;
    }
    if (!data.category) {
      toast('Enter a transaction category.', 'error');
      return;
    }

    window.__vfTransactionSaveInFlight = true;
    setSaving(button, true);

    const transactions = Array.isArray(window.transactions) ? window.transactions : null;
    const tempId = `vf-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let previous = null;
    let optimisticInserted = false;

    if (transactions) {
      if (id) {
        const index = transactions.findIndex(t => String(t._id) === String(id));
        if (index >= 0) {
          previous = { index, value: { ...transactions[index] } };
          transactions[index] = { ...transactions[index], ...data, _id: id, __vfPending: true };
        }
      } else {
        transactions.unshift({ ...data, _id: tempId, __vfPending: true });
        optimisticInserted = true;
      }
    }

    // Make the interaction feel instant: close and repaint before waiting for
    // MongoDB/Vercel. The request continues in the background.
    closeTransactionModal();
    renderImmediately();
    toast(id ? 'Transaction updated — syncing…' : 'Transaction added — syncing…', 'success');

    try {
      const endpoint = id ? `/api/transactions/${encodeURIComponent(id)}` : '/api/transactions';
      const method = id ? 'PUT' : 'POST';
      const saved = await window.apiCall(endpoint, method, data);

      if (transactions) {
        if (id) {
          const index = transactions.findIndex(t => String(t._id) === String(id));
          if (index >= 0) transactions[index] = { ...transactions[index], ...(saved || data), __vfPending: false };
        } else {
          const index = transactions.findIndex(t => String(t._id) === String(tempId));
          if (index >= 0) transactions[index] = { ...transactions[index], ...(saved || {}), __vfPending: false };
        }
      }

      // Reconcile in the background. These refreshes no longer block the UI.
      Promise.allSettled([
        typeof window.loadTransactions === 'function' ? window.loadTransactions() : Promise.resolve(),
        typeof window.loadVaults === 'function' ? window.loadVaults() : Promise.resolve()
      ]).then(() => {
        try { window.calculateWalletBalances?.(); } catch (_) {}
        try { window.renderDashboard?.(); } catch (_) {}
        try { window.renderCurrentPage?.(); } catch (_) {}
      });

      toast(id ? 'Transaction updated.' : 'Transaction saved.', 'success');
    } catch (error) {
      // Roll back only the optimistic local change. The server is authoritative.
      if (transactions) {
        if (optimisticInserted) {
          const index = transactions.findIndex(t => String(t._id) === String(tempId));
          if (index >= 0) transactions.splice(index, 1);
        } else if (previous) {
          transactions.splice(previous.index, 1, previous.value);
        }
      }
      renderImmediately();
      toast(error?.message || 'Could not save transaction.', 'error');
    } finally {
      window.__vfTransactionSaveInFlight = false;
      setSaving(button, false);
    }
  }

  // Document-level capture runs before the existing restoration guard and the
  // legacy form listener, so the old handler cannot create a second POST.
  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'transactionForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = form.querySelector('button[type="submit"]');
    fastSubmit(form, button).catch(error => {
      console.error('[VaultFlow] fast transaction submit failed:', error);
      window.__vfTransactionSaveInFlight = false;
      setSaving(button, false);
      toast(error?.message || 'Could not save transaction.', 'error');
    });
  }, true);
})(window, document);
