/**
 * @file public/assets/js/modules/vaults.js
 * @description Budget Vault Management Grid view compiler for VaultFlow.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

/**
 * Renders the primary card deck list of client allocation vaults.
 */
function renderVaultsPage() {
    const container = document.getElementById('vaultsList');
    if (!container) return;

    if (!vaults || vaults.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏦</div>
                <h3 class="empty-title">No vaults yet</h3>
                <p class="empty-text">Create vaults to organize your budget</p>
            </div>
        `;
        return;
    }

    let html = '';
    vaults.forEach(vault => {
        html += `
            <div class="vault-card">
                <div class="vault-header">
                    <div>
                        <div class="vault-name">${vault.name}</div>
                        <div class="vault-desc">${vault.description || ''}</div>
                    </div>
                    <div class="vault-percentage">${vault.percentage}%</div>
                </div>
                <div class="vault-stats">
                    <div class="vault-stat">
                        <div class="vault-stat-label">Income</div>
                        <div class="vault-stat-value">${formatMoney(vault.totalIncome)}</div>
                    </div>
                    <div class="vault-stat">
                        <div class="vault-stat-label">Spent</div>
                        <div class="vault-stat-value">${formatMoney(vault.totalSpent)}</div>
                    </div>
                    <div class="vault-stat">
                        <div class="vault-stat-label">Balance</div>
                        <div class="vault-stat-value" style="color: ${vault.balance >= 0 ? 'var(--secondary)' : 'var(--danger)'}">${formatMoney(vault.balance)}</div>
                    </div>
                </div>
                <div class="vault-actions">
                    <button class="btn btn-secondary" onclick="editVault('${vault._id}')">Edit</button>
                    <button class="btn btn-secondary" onclick="deleteVault('${vault._id}')">Delete</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}