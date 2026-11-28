/* OS4.1D-3 — Personal Vault file-manager UI.
 * Uses authenticated same-origin APIs only. Never exposes storage object keys.
 */
(function () {
  'use strict';

  const state = { folderId: null, folderName: null, path: [], page: 1, pages: 0, total: 0, loaded: false, loading: false };
  const PAGE_SIZE = 25;
  const GIB = 1024 * 1024 * 1024;
  let requestVersion = 0;

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const formatBytes = value => {
    const n = Math.max(0, Number(value) || 0);
    if (n < 1024) return n + ' B';
    const units = ['KiB', 'MiB', 'GiB', 'TiB'];
    let size = n / 1024, i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(size >= 10 ? 1 : 2) + ' ' + units[i];
  };
  const token = () => localStorage.getItem('vf_token');

  async function api(path, options = {}) {
    const authToken = token();
    if (!authToken) throw new Error('Your session is missing. Please sign in again.');
    const headers = { Authorization: 'Bearer ' + authToken, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const response = await fetch(path, { ...options, headers, cache: 'no-store' });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || ('Request failed (' + response.status + ')'));
    return data;
  }

  function feedback(message, isError = false) {
    const el = $('pvFeedback');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', Boolean(isError));
  }

  async function loadUsage(version) {
    const usage = await api('/api/vault/usage');
    if (version !== requestVersion) return;
    const quota = Number(usage.quotaBytes) || 0;
    const used = Number(usage.usedBytes) || 0;
    const reserved = Number(usage.reservedBytes) || 0;
    const available = Number(usage.availableBytes) || 0;
    const percent = quota > 0 ? Math.min(100, ((used + reserved) / quota) * 100) : 0;
    $('pvStorageHeadline').textContent = formatBytes(used) + ' used of ' + formatBytes(quota);
    $('pvStorageDetail').textContent = formatBytes(available) + ' available' + (reserved ? ' • ' + formatBytes(reserved) + ' reserved for uploads' : '');
    $('pvStorageProgressFill').style.width = percent.toFixed(2) + '%';
    $('pvStorageProgress').setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function renderBreadcrumbs() {
    const crumbs = [{ id: null, name: 'All files' }, ...state.path];
    $('pvBreadcrumbs').innerHTML = crumbs.map((item, index) => {
      const label = escapeHtml(item.name);
      return index === crumbs.length - 1
        ? '<span aria-current="page">' + label + '</span>'
        : '<button type="button" data-pv-crumb="' + index + '">' + label + '</button><span aria-hidden="true">›</span>';
    }).join('');
    $('pvCurrentFolderLabel').textContent = state.folderName ? 'Inside ' + state.folderName : 'Your uploaded documents and media';
  }

  async function loadFolders(version) {
    const query = state.folderId ? '?parentId=' + encodeURIComponent(state.folderId) : '';
    const data = await api('/api/vault/folders' + query);
    if (version !== requestVersion) return;
    const folders = Array.isArray(data.folders) ? data.folders : [];
    $('pvFolderList').innerHTML = folders.length ? folders.map(folder => `
      <div class="pv-folder-row">
        <button class="pv-folder-open" type="button" data-pv-open-folder="${escapeHtml(folder._id)}" data-pv-folder-name="${escapeHtml(folder.name)}"><span aria-hidden="true">📁</span><span>${escapeHtml(folder.name)}</span></button>
        <button class="pv-folder-rename" type="button" data-pv-rename-folder="${escapeHtml(folder._id)}" data-pv-folder-name="${escapeHtml(folder.name)}" aria-label="Rename ${escapeHtml(folder.name)}" title="Rename folder">Rename</button>
      </div>`).join('') : '<div class="pv-empty-mini"><span>📂</span><strong>No folders here</strong><small>Create a folder to organise your files.</small></div>';
  }

  async function loadFiles(version) {
    const params = new URLSearchParams({ page: String(state.page), limit: String(PAGE_SIZE) });
    if (state.folderId) params.set('folderId', state.folderId);
    const data = await api('/api/vault/files?' + params.toString());
    if (version !== requestVersion) return;
    const files = Array.isArray(data.files) ? data.files : [];
    const pagination = data.pagination || {};
    state.total = Number(pagination.total) || 0;
    state.pages = Number(pagination.pages) || 0;
    $('pvFileCount').textContent = state.total + (state.total === 1 ? ' file' : ' files');
    $('pvFileList').innerHTML = files.length ? files.map(file => `
      <div class="pv-file-row">
        <span class="pv-file-icon" aria-hidden="true">${file.mimeType === 'application/pdf' ? '📕' : (String(file.mimeType || '').startsWith('image/') ? '🖼️' : '📄')}</span>
        <span class="pv-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}<small>${escapeHtml(file.extension || file.mimeType || 'File')} • ${formatBytes(file.sizeBytes)}</small></span>
        <span class="pv-file-date">${file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''}</span>
      </div>`).join('') : '<div class="pv-empty-state"><div class="pv-empty-art" aria-hidden="true">📄</div><h3>No available files yet</h3><p>Files will appear here after a secure upload has completed verification. Quarantined files are intentionally hidden.</p></div>';
    const paginationEl = $('pvPagination');
    paginationEl.hidden = state.pages <= 1;
    $('pvPageLabel').textContent = state.pages ? 'Page ' + state.page + ' of ' + state.pages : '';
    $('pvPrevPage').disabled = state.page <= 1;
    $('pvNextPage').disabled = state.page >= state.pages;
  }

  async function load() {
    const root = $('personalVaultPage');
    if (!root || state.loading) return;
    state.loading = true;
    const version = ++requestVersion;
    feedback('');
    $('pvFolderList').innerHTML = '<p class="pv-loading">Loading folders…</p>';
    $('pvFileList').innerHTML = '<p class="pv-loading">Loading files…</p>';
    renderBreadcrumbs();
    try {
      await Promise.all([loadUsage(version), loadFolders(version), loadFiles(version)]);
      if (version === requestVersion) { state.loaded = true; }
    } catch (error) {
      if (version === requestVersion) {
        $('pvFolderList').innerHTML = '<p class="pv-error">Unable to load folders.</p>';
        $('pvFileList').innerHTML = '<div class="pv-empty-state"><h3>Vault could not be loaded</h3><p>' + escapeHtml(error.message) + '</p><button class="btn btn-secondary" type="button" data-pv-retry>Try again</button></div>';
        $('pvFileCount').textContent = 'Unavailable';
        feedback(error.message, true);
      }
    } finally {
      if (version === requestVersion) state.loading = false;
    }
  }

  async function createFolder() {
    const name = window.prompt('Enter a name for the new folder:');
    if (name === null) return;
    if (!name.trim()) { feedback('Enter a folder name.', true); return; }
    try {
      await api('/api/vault/folders', { method: 'POST', body: JSON.stringify({ name: name.trim(), parentId: state.folderId }) });
      feedback('Folder created.');
      await load();
    } catch (error) { feedback(error.message, true); }
  }

  async function renameFolder(id, currentName) {
    const name = window.prompt('Rename folder:', currentName || '');
    if (name === null || name.trim() === (currentName || '')) return;
    if (!name.trim()) { feedback('Enter a folder name.', true); return; }
    try {
      await api('/api/vault/folders/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
      feedback('Folder renamed.');
      await load();
    } catch (error) { feedback(error.message, true); }
  }

  function navigateToFolder(id, name) {
    state.path.push({ id, name });
    state.folderId = id;
    state.folderName = name;
    state.page = 1;
    load();
  }

  function navigateToCrumb(index) {
    if (index < 0) return;
    if (index === 0) {
      state.path = [];
      state.folderId = null;
      state.folderName = null;
    } else {
      state.path = state.path.slice(0, index);
      const current = state.path[state.path.length - 1];
      state.folderId = current.id;
      state.folderName = current.name;
    }
    state.page = 1;
    load();
  }

  function init() {
    const root = $('personalVaultPage');
    if (!root || root.dataset.pvBound === '1') return;
    root.dataset.pvBound = '1';
    $('pvNewFolderButton').addEventListener('click', createFolder);
    root.addEventListener('click', event => {
      const open = event.target.closest('[data-pv-open-folder]');
      if (open) return navigateToFolder(open.dataset.pvOpenFolder, open.dataset.pvFolderName);
      const rename = event.target.closest('[data-pv-rename-folder]');
      if (rename) return renameFolder(rename.dataset.pvRenameFolder, rename.dataset.pvFolderName);
      const crumb = event.target.closest('[data-pv-crumb]');
      if (crumb) return navigateToCrumb(Number(crumb.dataset.pvCrumb));
      if (event.target.closest('[data-pv-root]')) return navigateToCrumb(0);
      if (event.target.closest('[data-pv-retry]')) return load();
    });
    $('pvPrevPage').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
    $('pvNextPage').addEventListener('click', () => { if (state.page < state.pages) { state.page++; load(); } });
  }

  window.PersonalVault = Object.freeze({ load });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
