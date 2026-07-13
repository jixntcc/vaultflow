/**
 * @file public/assets/js/modules/wallets.js
 * @description Wallet Balance Calculations and Payment Method Split view compiler for VaultFlow.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

/**
 * Calculates current ledger balances broken down by payment methods (Online vs Cash By-Hand) across accounts.
 */
function renderWalletsPage() {
    const walletStats = {
        HR: { online: 0, byhand: 0, total: 0 },
        HL: { online: 0, byhand: 0, total: 0 }
    };

    transactions.forEach(txn => {
        const wallet = txn.wallet || 'HR';
        const amount = txn.amount || 0;
        const isOnline = txn.paymentMethod === 'online' || !txn.paymentMethod;

        if (txn.type === 'income') {
            if (isOnline) walletStats[wallet].online += amount;
            else walletStats[wallet].byhand += amount;
        } else if (txn.type === 'expense') {
            if (isOnline) walletStats[wallet].online -= amount;
            else walletStats[wallet].byhand -= amount;
        }
    });

    Object.keys(walletStats).forEach(key => {
        walletStats[key].total = walletStats[key].online + walletStats[key].byhand;
    });

    const totalOnline = walletStats.HR.online + walletStats.HL.online;
    const totalByHand = walletStats.HR.byhand + walletStats.HL.byhand;
    const grandTotal = walletStats.HR.total + walletStats.HL.total;

    // UI Updates safely checking element existence
    const updateText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const updateColor = (id, val, posColor = 'var(--secondary)') => { 
        const el = document.getElementById(id); 
        if (el) el.style.color = val >= 0 ? posColor : 'var(--danger)'; 
    };

    updateText('hrOnlineBalance', formatMoney(walletStats.HR.online));
    updateColor('hrOnlineBalance', walletStats.HR.online);

    updateText('hrByHandBalance', formatMoney(walletStats.HR.byhand));
    updateColor('hrByHandBalance', walletStats.HR.byhand);

    updateText('hrTotalBalance', formatMoney(walletStats.HR.total));
    updateColor('hrTotalBalance', walletStats.HR.total);

    updateText('hlOnlineBalance', formatMoney(walletStats.HL.online));
    updateColor('hlOnlineBalance', walletStats.HL.online);

    updateText('hlByHandBalance', formatMoney(walletStats.HL.byhand));
    updateColor('hlByHandBalance', walletStats.HL.byhand);

    updateText('hlTotalBalance', formatMoney(walletStats.HL.total));
    updateColor('hlTotalBalance', walletStats.HL.total);

    updateText('totalOnlineBalance', formatMoney(totalOnline));
    updateColor('totalOnlineBalance', totalOnline);

    updateText('totalByHandBalance', formatMoney(totalByHand));
    updateColor('totalByHandBalance', totalByHand, 'var(--warning)');

    updateText('grandTotalBalance', formatMoney(grandTotal));
    updateColor('grandTotalBalance', grandTotal, 'var(--primary)');
}