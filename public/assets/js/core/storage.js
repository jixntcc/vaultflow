/**
 * @file public/assets/js/core/storage.js
 * @description Secure Sandbox Import/Export data routines and database replication handlers for VaultFlow.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

function getPreferenceSnapshot() {
    return {
        currency: appPreferences.currency,
        language: appPreferences.language,
        theme: appPreferences.theme,
        dateFormat: appPreferences.dateFormat
    };
}

function markSuccessfulBackup() {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    renderSettingsPage();
}

function buildBackupPayload(reason = 'manual') {
    return {
        version: '1.0',
        app: 'VaultFlow',
        reason,
        exportedAt: new Date().toISOString(),
        profile: {
            username: currentUser || 'User',
            email: localStorage.getItem('vf_email') || '',
            memberSince: localStorage.getItem(MEMBER_SINCE_KEY) || null
        },
        transactions: transactions.map(({ _id, userId, __v, ...txn }) => ({ ...txn, sourceId: _id || txn.sourceId || null })),
        wallets: JSON.parse(JSON.stringify(wallets || {})),
        vaults: vaults.map(({ _id, userId, __v, ...vault }) => ({ ...vault, sourceId: _id || vault.sourceId || null })),
        goals: goals.map(({ _id, userId, __v, ...goal }) => ({ ...goal, sourceId: _id || goal.sourceId || null })),
        settings: getPreferenceSnapshot(),
        onboarding: {
            completed: localStorage.getItem(ONBOARDING_KEY) === 'completed',
            state: { ...onboardingState }
        },
        notificationPreferences: { ...notificationPrefs },
        retentionPreferences: { ...retentionPrefs },
        monthlyReviews: JSON.parse(localStorage.getItem(MONTHLY_REVIEWS_KEY) || '{}'),
        lastBackup: localStorage.getItem(LAST_BACKUP_KEY) || null
    };
}

function exportBackupJson(button = null, { silent = false, filenamePrefix = 'vaultflow-backup', reason = 'manual', markBackup = true } = {}) {
    setButtonLoading(button, true, 'Exporting...');
    try {
        const payload = buildBackupPayload(reason);
        const today = new Date().toISOString().slice(0, 10);
        downloadTextFile(`${filenamePrefix}-${today}.json`, JSON.stringify(payload, null, 2));
        if (markBackup) markSuccessfulBackup();
        if (!silent) showToast('Backup exported successfully.', 'success');
        return payload;
    } catch (error) {
        console.error('Backup export failed:', error);
        if (!silent) showToast('Could not export backup.', 'error');
        return null;
    } finally {
        setButtonLoading(button, false);
    }
}

function validateBackupStructure(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) errors.push('Backup must be a JSON object.');
    if (data && !data.version) errors.push('Missing version field.');
    ['transactions', 'vaults', 'goals'].forEach((key) => {
        if (!Array.isArray(data?.[key])) errors.push(`${key} must be an array.`);
    });
    if (!data?.wallets || typeof data.wallets !== 'object' || Array.isArray(data.wallets)) errors.push('wallets must be an object.');
    if (!data?.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) errors.push('settings must be an object.');
    return { valid: errors.length === 0, errors };
}

function openRestoreBackupPicker(button = null) {
    setButtonLoading(button, true, 'Opening...');
    const input = document.getElementById('restoreBackupInput');
    if (input) { input.value = ''; input.click(); }
    setTimeout(() => setButtonLoading(button, false), 350);
}

async function handleRestoreBackupFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const validation = validateBackupStructure(parsed);
        if (!validation.valid) {
            showToast(`Invalid backup: ${validation.errors[0]}`, 'error');
            return;
        }
        pendingRestoreBackup = parsed;
        renderRestoreSummary(parsed);
        document.getElementById('restoreBackupModal')?.classList.add('active');
    } catch (error) {
        console.error('Restore file read failed:', error);
        showToast('Invalid JSON backup file.', 'error');
    }
}

function renderRestoreSummary(backup) {
    const container = document.getElementById('restoreBackupSummary');
    if (!container) return;
    const items = [
        ['Transactions', backup.transactions?.length || 0],
        ['Vaults', backup.vaults?.length || 0],
        ['Goals', backup.goals?.length || 0],
        ['Exported', formatProfileDate(backup.exportedAt, true)]
    ];
    container.innerHTML = items.map(([label, value]) => `
        <div class="restore-summary-item">
            <div class="restore-summary-label">${label}</div>
            <div class="restore-summary-value">${value}</div>
        </div>`).join('');
}

function cancelRestoreBackup() {
    pendingRestoreBackup = null;
    document.getElementById('restoreBackupModal')?.classList.remove('active');
}

function sanitizeVaultForRestore(vault) { return { name: vault.name, percentage: Number(vault.percentage || 0), description: vault.description || '' }; }
function sanitizeTransactionForRestore(txn, vaultIdMap = {}) {
    const mappedVaultId = txn.vaultId ? vaultIdMap[String(txn.vaultId)] : null;
    return {
        date: String(txn.date || '').slice(0, 10), time: txn.time || '00:00', type: txn.type,
        amount: Number(txn.amount || 0), category: txn.category || 'Uncategorized', location: txn.location || '',
        wallet: txn.wallet || 'HR', paymentMethod: txn.paymentMethod || 'online', vaultId: mappedVaultId || '', notes: txn.notes || ''
    };
}
function sanitizeGoalForRestore(goal, vaultIdMap = {}) {
    const mappedVaultId = goal.vaultId ? vaultIdMap[String(goal.vaultId)] : null;
    return {
        name: goal.name, targetAmount: Number(goal.targetAmount || 0), currentAmount: Number(goal.currentAmount || 0),
        vaultId: mappedVaultId || '', vaultName: goal.vaultName || '', deadline: goal.deadline ? String(goal.deadline).slice(0, 10) : '', status: goal.status || 'active', notes: goal.notes || ''
    };
}

async function confirmRestoreBackup(button = null) {
    if (!pendingRestoreBackup) return;
    setButtonLoading(button, true, 'Restoring...');
    try {
        exportBackupJson(null, { silent: true, filenamePrefix: 'vaultflow-auto-backup-before-restore', reason: 'pre-restore-safety', markBackup: true });
        await new Promise(resolve => setTimeout(resolve, 80));
        await restoreBackupData(pendingRestoreBackup);
        cancelRestoreBackup();
        await loadAllData();
        renderAllPreferenceSensitiveViews();
        showToast('Backup restored successfully.', 'success');
    } catch (error) {
        console.error('Restore failed:', error);
        showToast(error.message || 'Could not restore backup.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function restoreBackupData(backup) {
    const validation = validateBackupStructure(backup);
    if (!validation.valid) throw new Error(validation.errors[0]);

    if (backup.settings) {
        appPreferences = { ...appPreferences, ...backup.settings };
        localStorage.setItem(PREF_KEYS.currency, appPreferences.currency);
        localStorage.setItem(PREF_KEYS.language, appPreferences.language);
        localStorage.setItem(PREF_KEYS.theme, appPreferences.theme);
        localStorage.setItem(PREF_KEYS.dateFormat, appPreferences.dateFormat);
        applyThemePreference();
    }
    if (backup.notificationPreferences) {
        notificationPrefs = { ...notificationPrefs, ...backup.notificationPreferences };
        persistNotificationPrefs();
    }
    if (backup.retentionPreferences) {
        retentionPrefs = { ...retentionPrefs, ...backup.retentionPreferences };
        persistRetentionPrefs();
    }
    if (backup.monthlyReviews) localStorage.setItem(MONTHLY_REVIEWS_KEY, JSON.stringify(backup.monthlyReviews));
    if (backup.onboarding?.completed) localStorage.setItem(ONBOARDING_KEY, 'completed');
    else localStorage.removeItem(ONBOARDING_KEY);
    if (backup.profile?.memberSince) localStorage.setItem(MEMBER_SINCE_KEY, backup.profile.memberSince);

    if (isDemoMode) {
        demoData.transactions = backup.transactions.map((txn, index) => ({ ...txn, _id: txn.sourceId || `rt${Date.now()}${index}` }));
        demoData.vaults = backup.vaults.map((vault, index) => ({ ...vault, _id: vault.sourceId || `rv${Date.now()}${index}` }));
        demoData.goals = backup.goals.map((goal, index) => ({ ...goal, _id: goal.sourceId || `rg${Date.now()}${index}` }));
        demoData.wallets = backup.wallets || demoData.wallets;
        await loadAllData();
        return;
    }

    for (const goal of [...goals]) await apiCall(`/api/goals/${goal._id}`, 'DELETE');
    for (const txn of [...transactions]) await apiCall(`/api/transactions/${txn._id}`, 'DELETE');
    for (const vault of [...vaults]) await apiCall(`/api/vaults/${vault._id}`, 'DELETE');

    const vaultIdMap = {};
    for (const vault of backup.vaults) {
        const created = await apiCall('/api/vaults', 'POST', sanitizeVaultForRestore(vault));
        if (created?._id) {
            if (vault.sourceId) vaultIdMap[String(vault.sourceId)] = created._id;
            if (vault._id) vaultIdMap[String(vault._id)] = created._id;
        }
    }
    const createdVaults = await apiCall('/api/vaults');
    backup.vaults.forEach((vault) => {
        const match = createdVaults.find(v => v.name === vault.name);
        if (match?._id) {
            if (vault.sourceId) vaultIdMap[String(vault.sourceId)] = match._id;
            if (vault._id) vaultIdMap[String(vault._id)] = match._id;
        }
    });
    for (const txn of backup.transactions) await apiCall('/api/transactions', 'POST', sanitizeTransactionForRestore(txn, vaultIdMap));
    for (const goal of backup.goals) await apiCall('/api/goals', 'POST', sanitizeGoalForRestore(goal, vaultIdMap));
}

function exportPdfReport(button = null) {
    setButtonLoading(button, true, 'Preparing...');
    try {
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : '0.0';
        const byCategory = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            byCategory[t.category || 'Uncategorized'] = (byCategory[t.category || 'Uncategorized'] || 0) + Number(t.amount || 0);
        });
        const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const email = localStorage.getItem('vf_email') || 'Not available';
        const reportDate = formatProfileDate(new Date(), true);
        const rowsHtml = categoryRows.length ? categoryRows.map(([name, value]) => `<tr><td>${name}</td><td>${formatMoney(value)}</td></tr>`).join('') : '<tr><td colspan="2">No spending categories yet.</td></tr>';
        const goalsHtml = goals.length ? goals.map(goal => {
            const progress = goal.targetAmount > 0 ? Math.min((Number(goal.currentAmount || 0) / Number(goal.targetAmount || 1)) * 100, 100) : 0;
            return `<tr><td>${goal.name}</td><td>${formatMoney(goal.currentAmount || 0)} / ${formatMoney(goal.targetAmount || 0)}</td><td>${progress.toFixed(1)}%</td></tr>`;
        }).join('') : '<tr><td colspan="3">No goals yet.</td></tr>';
        const html = `<!doctype html><html><head><title>VaultFlow PDF Report</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>
            body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;margin:0;padding:28px;background:#f8fafc;}
            .report{max-width:860px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;}
            header{background:#6366f1;color:white;padding:28px;} h1{margin:0;font-size:30px;} .subtitle{opacity:.9;margin-top:4px;}
            section{padding:22px 28px;border-top:1px solid #e5e7eb;} h2{font-size:18px;margin:0 0 12px;}
            .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{border:1px solid #e5e7eb;border-radius:12px;padding:14px;background:#f9fafb}.label{color:#6b7280;font-size:12px}.value{font-size:20px;font-weight:800;margin-top:4px}.user-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
            table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb}th{font-size:12px;color:#6b7280;text-transform:uppercase}footer{padding:18px 28px;color:#6b7280;font-size:12px;text-align:center}
            @media(max-width:720px){body{padding:8px}.grid,.user-grid{grid-template-columns:1fr}.report{border-radius:0}}
            @media print{body{background:white;padding:0}.report{border:none;border-radius:0}button{display:none}}
        </style></head><body><div class="report"><header><h1>VaultFlow</h1><div class="subtitle">Professional financial summary</div></header>
        <section><h2>User Information</h2><div class="user-grid"><div><div class="label">Username</div><div>${currentUser || 'User'}</div></div><div><div class="label">Email</div><div>${email}</div></div><div><div class="label">Report Date</div><div>${reportDate}</div></div></div></section>
        <section><h2>Financial Summary</h2><div class="grid"><div class="metric"><div class="label">Total Income</div><div class="value">${formatMoney(totalIncome)}</div></div><div class="metric"><div class="label">Total Expenses</div><div class="value">${formatMoney(totalExpenses)}</div></div><div class="metric"><div class="label">Net Savings</div><div class="value">${formatMoney(netSavings)}</div></div><div class="metric"><div class="label">Savings Rate</div><div class="value">${savingsRate}%</div></div></div></section>
        <section><h2>Category Breakdown</h2><table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>${rowsHtml}</tbody></table></section>
        <section><h2>Goals</h2><table><thead><tr><th>Goal</th><th>Progress</th><th>Completion</th></tr></thead><tbody>${goalsHtml}</tbody></table></section>
        <footer>Generated by VaultFlow</footer></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
        const win = window.open('', '_blank');
        if (!win) throw new Error('Please allow pop-ups to export PDF reports.');
        win.document.open(); win.document.write(html); win.document.close();
        markSuccessfulBackup();
        showToast('PDF report ready. Choose Save as PDF in the print dialog.', 'success');
    } catch (error) {
        console.error('PDF export failed:', error); showToast(error.message || 'Could not export PDF report.', 'error');
    } finally { setButtonLoading(button, false); }
}

function exportTransactionsCsv(button = null) {
    setButtonLoading(button, true, 'Exporting...');
    try {
        if (!transactions.length) { showToast('No transactions to export.', 'warning'); return; }
        const headers = ['Date', 'Time', 'Type', 'Amount', 'Currency', 'Raw Amount', 'Category', 'Location', 'Wallet', 'Payment Method', 'Vault', 'Notes'];
        const rows = transactions.map(t => [
            formatAppDate(t.date), t.time || '', t.type || '', formatMoney(t.amount || 0), getCurrentCurrency(), Number(t.amount || 0).toFixed(2),
            t.category || '', t.location || '', t.wallet || '', t.paymentMethod || '', t.vaultName || '', t.notes || ''
        ]);
        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        downloadTextFile(`vaultflow-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8;');
        showToast('CSV export downloaded.', 'success');
    } catch (error) {
        console.error('CSV export failed:', error); showToast('Could not export CSV.', 'error');
    } finally { setButtonLoading(button, false); }
}

function downloadTextFile(filename, content, type = 'application/json;charset=utf-8;') {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 250);
}