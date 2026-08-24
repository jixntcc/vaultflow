(function (window, document) {
  'use strict';
  if (window.__vfTransactionFastPathInstalled) return;
  window.__vfTransactionFastPathInstalled = true;
  window.__vfTransactionSaveInFlight = false;

  function getTransactions() {
    try { return window.eval('transactions'); } catch (_) { return null; }
  }
  function getVaults() {
    try { return window.eval('vaults'); } catch (_) { return []; }
  }
  function dataFromForm() {
    const get = id => document.getElementById(id);
    const type = get('txnType')?.value || 'expense';
    const vaultId = get('txnVault')?.value || '';
    const vaults = getVaults();
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
  function renderNow() {
    try { window.calculateWalletBalances?.(); } catch (_) {}
    try { window.renderDashboard?.(); } catch (_) {}
    try { window.renderCurrentPage?.(); } catch (_) {}
  }
  function closeModalFast() {
    try { window.closeTransactionModal?.(); } catch (_) {}
    document.getElementById('transactionModal')?.classList.remove('active');
  }
  function toast(message, type) { try { window.showToast?.(message, type); } catch (_) {} }

  async function fastSubmit(button) {
    if (window.__vfTransactionSaveInFlight) {
      toast('A transaction is already being saved. Please wait a moment.', 'warning');
      return;
    }
    const id = document.getElementById('txnId')?.value || '';
    const data = dataFromForm();
    if (!Number.isFinite(data.amount) || data.amount <= 0) return toast('Enter a valid transaction amount.', 'error');
    if (!data.category) return toast('Enter a transaction category.', 'error');

    window.__vfTransactionSaveInFlight = true;
    setSaving(button, true);
    const transactions = getTransactions();
    const tempId = `vf-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let previous = null;
    let inserted = false;

    if (Array.isArray(transactions)) {
      if (id) {
        const index = transactions.findIndex(t => String(t._id) === String(id));
        if (index >= 0) {
          previous = { index, value: { ...transactions[index] } };
          transactions[index] = { ...transactions[index], ...data, _id: id, __vfPending: true };
        }
      } else {
        transactions.unshift({ ...data, _id: tempId, __vfPending: true });
        inserted = true;
      }
    }

    closeModalFast();
    renderNow();
    toast(id ? 'Transaction updated — syncing…' : 'Transaction added — syncing…', 'success');

    try {
      const saved = await window.apiCall(id ? `/api/transactions/${encodeURIComponent(id)}` : '/api/transactions', id ? 'PUT' : 'POST', data);
      if (Array.isArray(transactions)) {
        const index = transactions.findIndex(t => String(t._id) === String(id || tempId));
        if (index >= 0) transactions[index] = { ...transactions[index], ...(saved || data), __vfPending: false };
      }
      Promise.allSettled([
        window.loadTransactions?.(),
        window.loadVaults?.()
      ]).then(renderNow);
      toast(id ? 'Transaction updated.' : 'Transaction saved.', 'success');
    } catch (error) {
      if (Array.isArray(transactions)) {
        if (inserted) {
          const index = transactions.findIndex(t => String(t._id) === String(tempId));
          if (index >= 0) transactions.splice(index, 1);
        } else if (previous) transactions.splice(previous.index, 1, previous.value);
      }
      renderNow();
      toast(error?.message || 'Could not save transaction.', 'error');
    } finally {
      window.__vfTransactionSaveInFlight = false;
      setSaving(button, false);
    }
  }

  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'transactionForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = form.querySelector('button[type="submit"]');
    fastSubmit(button).catch(error => {
      window.__vfTransactionSaveInFlight = false;
      setSaving(button, false);
      toast(error?.message || 'Could not save transaction.', 'error');
    });
  }, true);
})(window, document);
