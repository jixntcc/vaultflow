/**
 * @file public/assets/js/modules/transactions.js
 * @description Transactions Ledger Renderer, Mobile Card List compiler, and Search Filter engine for VaultFlow.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

/**
 * Triggers the master ledger rendering logic for the main Transactions view section.
 */
function renderTransactionsPage() {
    renderTransactionTable(transactions, 'transactionsTable');
}

/**
 * Compiles a responsive table matrix or a list of optimized mobile cards depending on the browser viewport bounds.
 * @param {Array<Object>} data - Array list of transaction items to paint into the view layout.
 * @param {string} containerId - The strict element string ID targeting the injection container wrapper.
 */
function renderTransactionTable(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🚀</div>
                <h3 class="empty-title">Your money story starts here</h3>
                <p class="empty-text">Start tracking your money in under 30 seconds and unlock live insights.</p>
                <div class="empty-cta-row">
                    <button class="btn btn-primary guided-pulse" onclick="showTransactionModal()">+ Add Transaction</button>
                    <button class="btn btn-secondary" onclick="switchPage('reports')">See Demo-style Reports</button>
                </div>
            </div>
        `;
        return;
    }

    const isMobileView = window.innerWidth <= 768;
    if (isMobileView) {
        let mobileHtml = '<div class="mobile-txn-list">';
        data.forEach(txn => {
            const dateObj = new Date(txn.date);
            const dateStr = formatAppDate(dateObj);
            mobileHtml += `
                <div class="mobile-txn-card">
                    <div class="mobile-txn-top">
                        <strong>${dateStr} • ${txn.time || ''}</strong>
                        <span class="badge ${txn.type}">${txn.type}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:14px; color:var(--text-secondary);">${txn.category || '-'}</div>
                            <div class="mobile-txn-meta">
                                <span>Wallet: ${txn.wallet || '-'}</span>
                                <span>Vault: ${txn.vaultName || '-'}</span>
                                <span>${txn.paymentMethod === 'online' ? '💳 Online' : '💵 By Hand'}</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:700; font-size:20px;">${formatMoney(txn.amount || 0)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        mobileHtml += '</div>';
        container.innerHTML = mobileHtml;
        return;
    }

    let html = `<table class="transactions-table"><thead><tr>`;
    html += `<th>Date Time</th>`;
    html += `<th>Type</th>`;
    html += `<th>Amount</th>`;
    html += `<th>Category</th>`;
    html += `<th>Location</th>`;
    html += `<th>Wallet</th>`;
    html += `<th>Payment Method</th>`;
    html += `<th>Vault</th>`;
    html += `<th>Notes</th>`;
    html += `<th>Actions</th>`;
    html += `</tr></thead><tbody>`;

    data.forEach(txn => {
        const dateObj = new Date(txn.date);
        const dateStr = formatAppDate(dateObj);
        const timeStr = txn.time || '';

        html += `<tr>`;
        html += `<td><strong>${dateStr}</strong><br><small>${timeStr}</small></td>`;
        html += `<td><span class="badge ${txn.type}">${txn.type}</span></td>`;
        html += `<td><strong>${formatMoney(txn.amount || 0)}</strong></td>`;
        html += `<td>${txn.category || '-'}</td>`;
        html += `<td>${txn.location ? txn.location : '-'}</td>`;
        html += `<td>${txn.wallet || '-'}</td>`;
        html += `<td>${txn.paymentMethod === 'online' ? '💳 Online' : '💵 By Hand'}</td>`;
        html += `<td>${txn.vaultName || '-'}</td>`;
        html += `<td>${txn.notes || '-'}</td>`;
        html += `<td>`;
        html += `<button class="action-btn edit-btn" onclick="editTransaction('${txn._id}')">Edit</button>`;
        html += `<button class="action-btn delete-btn" onclick="deleteTransaction('${txn._id}')">Delete</button>`;
        html += `</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Filters the active system transaction arrays via input parameters and repaints the tracking tables.
 */
function filterTransactions() {
    const searchEl = document.getElementById('searchTransactions');
    const filterEl = document.getElementById('filterType');
    if (!searchEl || !filterEl) return;

    const search = searchEl.value.toLowerCase();
    const type = filterEl.value;

    let filtered = transactions;

    if (type !== 'all') {
        filtered = filtered.filter(t => t.type === type);
    }

    if (search) {
        filtered = filtered.filter(t =>
            (t.category && t.category.toLowerCase().includes(search)) ||
            (t.location && t.location.toLowerCase().includes(search)) ||
            (t.notes && t.notes.toLowerCase().includes(search))
        );
    }

    renderTransactionTable(filtered, 'transactionsTable');
}