/*
 * VaultFlow Portfolio UI
 *
 * P3.3: isolated read-only portfolio view backed by /api/portfolio.
 * This module does not touch the Transaction or Dashboard renderers.
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
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 8
    }).format(Number(value || 0));
  }

  function formatMoney(value, currency) {
    const amount = Number(value || 0);
    const code = String(currency || 'USD').toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2
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
    return ({
      stock: '📈',
      crypto: '₿',
      forex: '💱',
      gold: '🥇',
      bond: '📜',
      other: '◈'
    })[type] || '◈';
  }

  function getPage() {
    return document.getElementById(PAGE_ID);
  }

  function getMainContent() {
    return document.querySelector('.main-content');
  }

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
          <button type="button" class="btn btn-secondary portfolio-refresh" id="portfolioRefreshButton">↻ Refresh</button>
        </div>
      </div>
      <div class="card portfolio-table-card">
        <div class="portfolio-table-wrap">
          <table aria-label="Portfolio holdings">
            <colgroup>
              <col style="width:26%">
              <col style="width:11%">
              <col style="width:15%">
              <col style="width:16%">
              <col style="width:16%">
              <col style="width:16%">
            </colgroup>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Qty</th>
                <th>Avg Cost</th>
                <th>Invested Value</th>
                <th>Current Value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody id="portfolioTableBody">
              <tr><td colspan="6"><div class="portfolio-loading">Loading portfolio…</div></td></tr>
            </tbody>
          </table>
        </div>
      </div>`;

    main.appendChild(page);
    page.querySelector('#portfolioRefreshButton').addEventListener('click', loadPortfolio);
    return page;
  }

  function render(assets) {
    const body = document.getElementById('portfolioTableBody');
    if (!body) return;

    if (!assets.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="portfolio-empty">No portfolio investments yet.</div></td></tr>';
      return;
    }

    body.innerHTML = assets.map(asset => {
      const pnl = Number(asset.unrealizedGainLoss || 0);
      return `<tr>
        <td>
          <div class="portfolio-asset">
            <div class="portfolio-asset-icon" aria-hidden="true">${assetIcon(asset.assetType)}</div>
            <div class="portfolio-asset-copy">
              <div class="portfolio-symbol">${esc(asset.symbol)}</div>
              <div class="portfolio-name">${esc(asset.name)}</div>
            </div>
          </div>
        </td>
        <td>${formatNumber(asset.quantity)}</td>
        <td>${formatMoney(asset.averageCost, asset.currency)}</td>
        <td>${formatMoney(asset.investedValue, asset.currency)}</td>
        <td>${formatMoney(asset.currentValue, asset.currency)}</td>
        <td class="${pnl > 0 ? 'portfolio-positive' : pnl < 0 ? 'portfolio-negative' : ''}">${formatPnl(pnl, asset.currency)}</td>
      </tr>`;
    }).join('');
  }

  async function loadPortfolio() {
    const body = document.getElementById('portfolioTableBody');
    const button = document.getElementById('portfolioRefreshButton');
    if (!body) return;

    if (!getToken()) {
      body.innerHTML = '<tr><td colspan="6"><div class="portfolio-error">Please log in to view your portfolio.</div></td></tr>';
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Loading…';
    }
    body.innerHTML = '<tr><td colspan="6"><div class="portfolio-loading">Loading portfolio…</div></td></tr>';

    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load portfolio');
      render(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('[VaultFlow] Portfolio load failed:', error);
      body.innerHTML = `<tr><td colspan="6"><div class="portfolio-error">${esc(error.message || 'Could not load portfolio.')}</div></td></tr>`;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '↻ Refresh';
      }
    }
  }

  function showPortfolio() {
    ensureNavItem();
    const page = ensurePage();
    if (!page) return;

    document.querySelectorAll('.page').forEach(item => item.classList.remove('active'));
    document.querySelectorAll(NAV_SELECTOR).forEach(item => item.classList.remove('active'));
    page.classList.add('active');
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
    if (page) page.classList.remove('active');
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
        event.preventDefault();
        event.stopPropagation();
        showPortfolio();
      } else {
        hidePortfolioWhenOtherPageSelected(navItem);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  window.VaultFlowPortfolio = {
    load: loadPortfolio,
    show: showPortfolio
  };
})(window, document);
