/*
 * VaultFlow Portfolio UI
 *
 * P3.3/P3.4: isolated portfolio view backed by /api/portfolio.
 * Portfolio calculations are derived from the API response and do not touch
 * the Transaction or Dashboard renderers.
 */
(function (window, document) {
  'use strict';

  const PAGE_ID = 'portfolio';
  const NAV_SELECTOR = '.nav-item[data-page]';
  const API_URL = '/api/portfolio';

  function esc(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value ?? '').replace(/[&<>\"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function getToken() {
    return localStorage.getItem('vf_token') || window.__VAULTFLOW_TOKEN__ || '';
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(Number(value || 0));
  }

  function formatMoney(value, currency) {
    const amount = Number(value || 0);
    const code = String(currency || 'USD').toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: code, maximumFractionDigits: 2
      }).format(amount);
    } catch (_) {
      return `${code} ${amount.toFixed(2)}`;
    }
  }

  function formatPnl(value, currency) {
    const amount = Number(value || 0);
    const text = formatMoney(Math.abs(amount), currency);
    return amount > 0 ? `+${text}` : amount < 0 ? `-${text}` : text;
  }

  function assetIcon(type) {
    return ({ stock: '📈', crypto: '₿', forex: '💱', gold: '🥇', bond: '📜', other: '◈' })[type] || '◈';
  }

  function getPage() { return document.getElementById(PAGE_ID); }
  function getMainContent() { return document.querySelector('.main-content'); }

  function ensureNavItem() {
    if (document.querySelector(`${NAV_SELECTOR}[data-page="${PAGE_ID}"]`)) return;
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.page = PAGE_ID;
    item.innerHTML = '<span>💼</span><span>Portfolio</span>';
    nav.appendChild(item);
  }

  function ensurePage() {
    if (getPage()) return getPage();
    const main = getMainContent();
    if (!main) return null;

    const page = document.createElement('section');
    page.className = 'page';
    page.id = PAGE_ID;
    page.innerHTML = `
      <div class="page-header">
        <div class="portfolio-toolbar">
          <div class="portfolio-toolbar-copy">
            <h1 class="page-title">Portfolio</h1>
            <p class="page-subtitle">Track your invested positions and current value.</p>
          </div>
          <div class="portfolio-toolbar-actions">
            <button type="button" class="btn btn-secondary portfolio-refresh" id="portfolioRefreshButton">↻ Refresh</button>
            <button type="button" class="btn btn-primary portfolio-add" id="portfolioAddButton">+ Add Investment</button>
          </div>
        </div>
      </div>

      <div id="portfolioSummary" class="portfolio-summary" aria-label="Portfolio summary"></div>

      <div class="card portfolio-table-card">
        <div class="portfolio-section-heading">
          <div>
            <h2>Holdings</h2>
            <span id="portfolioHoldingCount">0 positions</span>
          </div>
        </div>
        <div class="portfolio-table-wrap">
          <table aria-label="Portfolio holdings">
            <colgroup>
              <col style="width:24%"><col style="width:10%"><col style="width:14%">
              <col style="width:15%"><col style="width:15%"><col style="width:12%"><col style="width:10%">
            </colgroup>
            <thead><tr>
              <th>Asset</th><th>Qty</th><th>Avg Cost</th><th>Invested Value</th><th>Current Value</th><th>P/L</th><th>Actions</th>
            </tr></thead>
            <tbody id="portfolioTableBody">
              <tr><td colspan="7"><div class="portfolio-loading">Loading portfolio…</div></td></tr>
            </tbody>
          </table>
        </div>
      <div class="portfolio-modal" id="portfolioModal" hidden>
        <div class="portfolio-modal-backdrop" data-portfolio-close></div>
        <div class="portfolio-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolioModalTitle">
          <div class="portfolio-modal-header">
            <div><h2 id="portfolioModalTitle">Add Investment</h2><p>Record an investment position for tracking.</p></div>
            <button type="button" class="portfolio-modal-close" aria-label="Close" data-portfolio-close>×</button>
          </div>
          <form id="portfolioForm" class="portfolio-form">
            <input type="hidden" id="portfolioAssetId" name="id">
            <div class="portfolio-form-grid">
              <label>Asset Type<select id="portfolioAssetType" name="assetType" required><option value="stock">Stock</option><option value="crypto">Crypto</option><option value="gold">Gold</option><option value="bond">Bond</option><option value="forex">Forex</option><option value="other">Other</option></select></label>
              <label>Symbol<input id="portfolioSymbol" name="symbol" maxlength="40" placeholder="e.g. BTC" required></label>
              <label class="portfolio-form-wide">Name<input id="portfolioName" name="name" maxlength="160" placeholder="e.g. Bitcoin" required></label>
              <label>Quantity<input id="portfolioQuantity" name="quantity" type="number" min="0" step="any" required></label>
              <label>Average Cost<input id="portfolioAverageCost" name="averageCost" type="number" min="0" step="any" required></label>
              <label>Current Price<input id="portfolioCurrentPrice" name="currentPrice" type="number" min="0" step="any" value="0"></label>
              <label>Currency<select id="portfolioCurrency" name="currency" required><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British Pound</option><option value="AED">AED — UAE Dirham</option><option value="USDT">USDT — Tether</option><option value="USDC">USDC — USD Coin</option><option value="OTHER">Other</option></select></label>
              <label>Broker<input id="portfolioBroker" name="broker" maxlength="160" placeholder="Optional"></label>
              <label>Exchange<input id="portfolioExchange" name="exchange" maxlength="160" placeholder="Optional"></label>
              <label>Wallet<input id="portfolioWallet" name="wallet" maxlength="160" placeholder="Optional"></label>
              <label>Status<select id="portfolioStatus" name="status"><option value="active">Active</option><option value="closed">Closed</option></select></label>
              <label class="portfolio-form-wide">Notes<textarea id="portfolioNotes" name="notes" maxlength="2000" rows="3" placeholder="Optional notes"></textarea></label>
            </div>
            <div class="portfolio-form-error" id="portfolioFormError" role="alert" hidden></div>
            <div class="portfolio-form-footer"><button type="button" class="btn btn-secondary" data-portfolio-close>Cancel</button><button type="submit" class="btn btn-primary" id="portfolioSaveButton">Save Investment</button></div>
          </form>
        </div>
      </div>
      </div>`;

    main.appendChild(page);
    page.querySelector('#portfolioRefreshButton').addEventListener('click', loadPortfolio);
    page.querySelector('#portfolioAddButton').addEventListener('click', () => openForm());
    page.querySelector('#portfolioForm').addEventListener('submit', saveForm);
    page.addEventListener('click', event => {
      const close = event.target.closest('[data-portfolio-close]');
      if (close) closeForm();
      const edit = event.target.closest('[data-portfolio-edit]');
      if (edit) openForm(edit.dataset.portfolioEdit);
      const remove = event.target.closest('[data-portfolio-delete]');
      if (remove) deleteAsset(remove.dataset.portfolioDelete);
    });
    return page;
  }

  function calculateSummary(assets) {
    const groups = new Map();
    assets.forEach(asset => {
      const currency = String(asset.currency || 'USD').toUpperCase();
      if (!groups.has(currency)) groups.set(currency, { currency, invested: 0, current: 0, pnl: 0, count: 0 });
      const group = groups.get(currency);
      group.invested += Number(asset.investedValue ?? (Number(asset.quantity || 0) * Number(asset.averageCost || 0)));
      group.current += Number(asset.currentValue ?? (Number(asset.quantity || 0) * Number(asset.currentPrice || 0)));
      group.pnl += Number(asset.unrealizedGainLoss ?? (group.current - group.invested));
      group.count += 1;
    });
    groups.forEach(group => {
      group.returnPercent = group.invested > 0 ? (group.pnl / group.invested) * 100 : 0;
    });
    return [...groups.values()];
  }

  function renderSummary(assets) {
    const container = document.getElementById('portfolioSummary');
    const count = document.getElementById('portfolioHoldingCount');
    if (!container) return;
    if (count) count.textContent = `${assets.length} ${assets.length === 1 ? 'position' : 'positions'}`;

    const groups = calculateSummary(assets);
    if (!groups.length) {
      container.innerHTML = `
        <div class="portfolio-stat-card">
          <span class="portfolio-stat-label">Positions</span>
          <strong>0</strong>
          <small>Add an investment to start tracking.</small>
        </div>`;
      return;
    }

    container.innerHTML = groups.map(group => `
      <div class="portfolio-stat-card">
        <div class="portfolio-stat-top">
          <span class="portfolio-stat-label">${esc(group.currency)} portfolio</span>
          <span class="portfolio-stat-count">${group.count} ${group.count === 1 ? 'asset' : 'assets'}</span>
        </div>
        <div class="portfolio-stat-row"><span>Invested</span><strong>${formatMoney(group.invested, group.currency)}</strong></div>
        <div class="portfolio-stat-row"><span>Current</span><strong>${formatMoney(group.current, group.currency)}</strong></div>
        <div class="portfolio-stat-row portfolio-stat-pnl ${group.pnl > 0 ? 'portfolio-positive' : group.pnl < 0 ? 'portfolio-negative' : ''}">
          <span>P/L</span><strong>${formatPnl(group.pnl, group.currency)}</strong>
        </div>
        <div class="portfolio-stat-return">Return <strong>${group.returnPercent >= 0 ? '+' : ''}${group.returnPercent.toFixed(2)}%</strong></div>
      </div>`).join('');
  }

  function render(assets) {
    renderSummary(assets);
    const body = document.getElementById('portfolioTableBody');
    if (!body) return;
    if (!assets.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="portfolio-empty">No portfolio investments yet.</div></td></tr>';
      return;
    }
    body.innerHTML = assets.map(asset => {
      const pnl = Number(asset.unrealizedGainLoss || 0);
      return `<tr>
        <td><div class="portfolio-asset">
          <div class="portfolio-asset-icon" aria-hidden="true">${assetIcon(asset.assetType)}</div>
          <div class="portfolio-asset-copy"><div class="portfolio-symbol">${esc(asset.symbol)}</div><div class="portfolio-name">${esc(asset.name)}</div></div>
        </div></td>
        <td>${formatNumber(asset.quantity)}</td>
        <td>${formatMoney(asset.averageCost, asset.currency)}</td>
        <td>${formatMoney(asset.investedValue, asset.currency)}</td>
        <td>${formatMoney(asset.currentValue, asset.currency)}</td>
        <td class="${pnl > 0 ? 'portfolio-positive' : pnl < 0 ? 'portfolio-negative' : ''}">${formatPnl(pnl, asset.currency)}</td>
        <td><div class="portfolio-row-actions">
          <button type="button" class="portfolio-action-btn" data-portfolio-edit="${esc(asset._id)}">Edit</button>
          <button type="button" class="portfolio-action-btn portfolio-delete-btn" data-portfolio-delete="${esc(asset._id)}">Delete</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  function getAssetById(id) {
    return (window.__VAULTFLOW_PORTFOLIO_ASSETS__ || []).find(asset => String(asset._id) === String(id)) || null;
  }

  function setFormValue(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value ?? '';
  }

  function openForm(id = '') {
    ensurePage();
    const modal = document.getElementById('portfolioModal');
    const form = document.getElementById('portfolioForm');
    const title = document.getElementById('portfolioModalTitle');
    const error = document.getElementById('portfolioFormError');
    if (!modal || !form) return;
    form.reset();
    setFormValue('portfolioAssetId', ''); setFormValue('portfolioAssetType', 'stock');
    setFormValue('portfolioCurrency', 'INR'); setFormValue('portfolioCurrentPrice', '0'); setFormValue('portfolioStatus', 'active');
    if (error) { error.hidden = true; error.textContent = ''; }
    const asset = id ? getAssetById(id) : null;
    if (asset) {
      title.textContent = 'Edit Investment';
      setFormValue('portfolioAssetId', asset._id); setFormValue('portfolioAssetType', asset.assetType); setFormValue('portfolioSymbol', asset.symbol);
      setFormValue('portfolioName', asset.name); setFormValue('portfolioQuantity', asset.quantity); setFormValue('portfolioAverageCost', asset.averageCost);
      setFormValue('portfolioCurrentPrice', asset.currentPrice); setFormValue('portfolioCurrency', asset.currency); setFormValue('portfolioBroker', asset.broker);
      setFormValue('portfolioExchange', asset.exchange); setFormValue('portfolioWallet', asset.wallet); setFormValue('portfolioStatus', asset.status); setFormValue('portfolioNotes', asset.notes);
    } else title.textContent = 'Add Investment';
    modal.hidden = false; document.body.classList.add('portfolio-modal-open'); document.getElementById('portfolioSymbol')?.focus();
  }

  function closeForm() {
    const modal = document.getElementById('portfolioModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('portfolio-modal-open');
  }

  function formPayload() {
    const data = new FormData(document.getElementById('portfolioForm'));
    return { assetType:data.get('assetType'), symbol:data.get('symbol'), name:data.get('name'), quantity:data.get('quantity'), averageCost:data.get('averageCost'), currentPrice:data.get('currentPrice') || 0, currency:data.get('currency'), broker:data.get('broker'), exchange:data.get('exchange'), wallet:data.get('wallet'), status:data.get('status') || 'active', notes:data.get('notes') };
  }

  async function saveForm(event) {
    event.preventDefault();
    const form = document.getElementById('portfolioForm'), button = document.getElementById('portfolioSaveButton'), error = document.getElementById('portfolioFormError');
    const id = document.getElementById('portfolioAssetId')?.value;
    if (!form || !getToken() || !form.reportValidity()) return;
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }
    if (error) { error.hidden = true; error.textContent = ''; }
    try {
      const response = await fetch(id ? `${API_URL}/${encodeURIComponent(id)}` : API_URL, { method:id ? 'PUT' : 'POST', headers:{Authorization:`Bearer ${getToken()}`,'Content-Type':'application/json'}, body:JSON.stringify(formPayload()) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not save investment');
      closeForm(); await loadPortfolio();
    } catch (err) { if (error) { error.hidden = false; error.textContent = err.message || 'Could not save investment.'; } }
    finally { if (button) { button.disabled = false; button.textContent = 'Save Investment'; } }
  }

  async function deleteAsset(id) {
    const asset = getAssetById(id), label = asset ? `${asset.symbol} — ${asset.name}` : 'this investment';
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`, { method:'DELETE', headers:{Authorization:`Bearer ${getToken()}`} });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not delete investment');
      await loadPortfolio();
    } catch (err) { window.alert(err.message || 'Could not delete investment.'); }
  }

  async function loadPortfolio() {
    const body = document.getElementById('portfolioTableBody');
    const button = document.getElementById('portfolioRefreshButton');
    if (!body) return;
    if (!getToken()) {
      body.innerHTML = '<tr><td colspan="7"><div class="portfolio-error">Please log in to view your portfolio.</div></td></tr>';
      return;
    }
    if (button) { button.disabled = true; button.textContent = 'Loading…'; }
    body.innerHTML = '<tr><td colspan="7"><div class="portfolio-loading">Loading portfolio…</div></td></tr>';
    try {
      const response = await fetch(API_URL, { headers: { Authorization: `Bearer ${getToken()}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load portfolio');
      const assets = Array.isArray(payload) ? payload : [];
      window.__VAULTFLOW_PORTFOLIO_ASSETS__ = assets;
      render(assets);
    } catch (error) {
      console.error('[VaultFlow] Portfolio load failed:', error);
      body.innerHTML = `<tr><td colspan="7"><div class="portfolio-error">${esc(error.message || 'Could not load portfolio.')}</div></td></tr>`;
    } finally {
      if (button) { button.disabled = false; button.textContent = '↻ Refresh'; }
    }
  }

  function showPortfolio() {
    ensureNavItem();
    const page = ensurePage();
    if (!page) return;
    document.querySelectorAll('.page').forEach(item => item.classList.remove('active'));
    document.querySelectorAll(NAV_SELECTOR).forEach(item => item.classList.remove('active'));
    page.classList.add('active', 'vf-portfolio-active');
    const navItem = document.querySelector(`${NAV_SELECTOR}[data-page="${PAGE_ID}"]`);
    if (navItem) navItem.classList.add('active');
    loadPortfolio();
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (sidebar) sidebar.classList.remove('mobile-visible');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('mobile-nav-open');
  }

  function hidePortfolioWhenOtherPageSelected(target) {
    if (!target || target.dataset.page === PAGE_ID) return;
    const page = getPage();
    if (page) page.classList.remove('active', 'vf-portfolio-active');
  }

  function initialize() {
    ensureNavItem();
    ensurePage();
    if (document.documentElement.dataset.vfPortfolioUi === '1') return;
    document.documentElement.dataset.vfPortfolioUi = '1';
    document.addEventListener('click', event => {
      const navItem = event.target.closest(NAV_SELECTOR);
      if (!navItem) return;
      if (navItem.dataset.page === PAGE_ID) {
        event.preventDefault(); event.stopPropagation(); showPortfolio();
      } else {
        hidePortfolioWhenOtherPageSelected(navItem);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();

  window.VaultFlowPortfolio = { load: loadPortfolio, show: showPortfolio };
})(window, document);
