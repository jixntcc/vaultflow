/**
 * @file public/assets/js/modules/notifications.js
 * @description Local Smart Finance scheduling alerts engine and PWA serviceWorker communications manager.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

function initNotificationPrefs() {
    try {
        notificationPrefs = { ...notificationPrefs, ...(JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}')) };
    } catch (_) {}
    renderNotificationPrefsUI();
}

function persistNotificationPrefs() { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(notificationPrefs)); }

function renderNotificationPrefsUI() {
    const permission = ('Notification' in window) ? Notification.permission : 'default';
    const btn = document.getElementById('notifEnableBtn');
    if (btn) btn.textContent = permission === 'granted' ? 'Notifications Enabled' : 'Enable Notifications';
    const daily = document.getElementById('notifDaily');
    const weekly = document.getElementById('notifWeekly');
    const savings = document.getElementById('notifSavings');
    if (daily) daily.checked = !!notificationPrefs.dailyReminder;
    if (weekly) weekly.checked = !!notificationPrefs.weeklySummary;
    if (savings) savings.checked = !!notificationPrefs.savingsInsights;
}

function syncNotificationPrefToggles() {
    notificationPrefs.dailyReminder = !!document.getElementById('notifDaily')?.checked;
    notificationPrefs.weeklySummary = !!document.getElementById('notifWeekly')?.checked;
    notificationPrefs.savingsInsights = !!document.getElementById('notifSavings')?.checked;
    persistNotificationPrefs();
    maybeScheduleSmartLocalNotifications();
}

async function promptNotificationPermissionFlow() {
    if (!('Notification' in window)) return showToast('Notifications are not supported on this browser.', 'warning');
    const allow = confirm('Would you like helpful finance reminders from VaultFlow?');
    if (!allow) return;
    const result = await Notification.requestPermission();
    notificationPrefs.enabled = result === 'granted';
    persistNotificationPrefs();
    renderNotificationPrefsUI();
    if (result === 'granted') {
        showToast('Finance reminders enabled.', 'success');
        maybeScheduleSmartLocalNotifications(true);
    } else {
        showToast('Notification permission not granted.', 'warning');
    }
}

async function sendLocalFinanceNotification(title, body, data = {}) {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    if (reg.active) reg.active.postMessage({ type: 'VF_LOCAL_NOTIFY', payload: { title, body, data } });
}

function maybeScheduleSmartLocalNotifications(forceNow = false) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !notificationPrefs.enabled) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const savings = Math.max(0, totalIncome - totalExpense);
    
    const byCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { byCategory[t.category || 'Other'] = (byCategory[t.category || 'Other'] || 0) + Number(t.amount || 0); });
    const topCategory = Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0];
    
    if ((forceNow || now - (notificationPrefs.lastDailyAt || 0) > dayMs) && notificationPrefs.dailyReminder) {
        sendLocalFinanceNotification('Track today in VaultFlow', 'A quick expense update now keeps your weekly insights accurate.', { page: 'transactions' });
        notificationPrefs.lastDailyAt = now;
    }
    if ((forceNow || now - (notificationPrefs.lastWeeklyAt || 0) > weekMs) && notificationPrefs.weeklySummary) {
        const summary = topCategory ? `Top expense: ${topCategory[0]}. Savings so far: ${formatMoney(savings)}.` : `Savings so far: ${formatMoney(savings)}.`;
        sendLocalFinanceNotification('Your weekly money snapshot', summary, { page: 'reports' });
        notificationPrefs.lastWeeklyAt = now;
    }
    persistNotificationPrefs();
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((e) => console.error('SW registration failed:', e));
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'VF_NAVIGATE' && event.data?.page) switchPage(event.data.page);
    });
}

function isStandaloneAppMode() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone; }

function setupPWAInstallFlow() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault(); deferredInstallPrompt = event; maybeShowInstallBanner();
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null; document.getElementById('pwaInstallBanner')?.classList.remove('active');
    });
    setTimeout(maybeShowInstallBanner, 1500);
}

function maybeShowInstallBanner() {
    if (isStandaloneAppMode()) return;
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    if (!deferredInstallPrompt) return;
    document.getElementById('pwaInstallBanner')?.classList.add('active');
}

async function triggerInstallPrompt() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome !== 'accepted') localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    deferredInstallPrompt = null;
    document.getElementById('pwaInstallBanner')?.classList.remove('active');
}

function dismissInstallBanner() {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    document.getElementById('pwaInstallBanner')?.classList.remove('active');
}

function setupOfflineStatusBanner() {
    const banner = document.getElementById('offlineBanner'); if (!banner) return;
    const sync = () => banner.classList.toggle('active', !navigator.onLine);
    window.addEventListener('online', sync); window.addEventListener('offline', sync); sync();
}