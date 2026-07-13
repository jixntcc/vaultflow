/**
 * @file public/assets/js/modules/settings.js
 * @description Application settings manager, profile parameters renderer, and workspace preferences engine.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

function initAppPreferences() {
    appPreferences = {
        currency: localStorage.getItem(PREF_KEYS.currency) || 'INR',
        language: localStorage.getItem(PREF_KEYS.language) || 'en-IN',
        theme: localStorage.getItem(PREF_KEYS.theme) || 'light',
        dateFormat: localStorage.getItem(PREF_KEYS.dateFormat) || 'DD-MM-YYYY'
    };
    applyThemePreference();
    renderSettingsPage();
}

function applyThemePreference() {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    const effectiveTheme = appPreferences.theme === 'system' ? (prefersDark ? 'dark' : 'light') : appPreferences.theme;
    document.documentElement.dataset.theme = effectiveTheme === 'dark' ? 'dark' : 'light';
}

function persistSettingsFromForm() {
    appPreferences.currency = document.getElementById('settingsCurrency')?.value || appPreferences.currency;
    appPreferences.language = document.getElementById('settingsLanguage')?.value || appPreferences.language;
    appPreferences.theme = document.getElementById('settingsTheme')?.value || appPreferences.theme;
    appPreferences.dateFormat = document.getElementById('settingsDateFormat')?.value || appPreferences.dateFormat;
    
    localStorage.setItem(PREF_KEYS.currency, appPreferences.currency);
    localStorage.setItem(PREF_KEYS.language, appPreferences.language);
    localStorage.setItem(PREF_KEYS.theme, appPreferences.theme);
    localStorage.setItem(PREF_KEYS.dateFormat, appPreferences.dateFormat);
    
    applyThemePreference();
    renderAllPreferenceSensitiveViews();
    showToast('Preferences updated.', 'success');
}

function renderAllPreferenceSensitiveViews() {
    renderSettingsPage();
    renderDashboard();
    renderCurrentPage();
    if (document.getElementById('reports')?.classList.contains('active')) applyReportFilters();
}

function getMemberSinceDate() {
    if (isDemoMode) return 'Demo session';
    const stored = localStorage.getItem(MEMBER_SINCE_KEY);
    if (stored) return formatProfileDate(stored);
    const payload = authToken && authToken !== 'demo-token' ? parseJwt(authToken) : null;
    if (payload?.iat) {
        const fallback = new Date(payload.iat * 1000).toISOString();
        localStorage.setItem(MEMBER_SINCE_KEY, fallback);
        return formatProfileDate(fallback);
    }
    return 'Not available';
}

function getLastBackupDisplay() {
    const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
    return lastBackup ? formatProfileDate(lastBackup, true) : 'Never';
}

function renderSettingsPage() {
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    setValue('settingsCurrency', appPreferences.currency);
    setValue('settingsLanguage', appPreferences.language);
    setValue('settingsTheme', appPreferences.theme);
    setValue('settingsDateFormat', appPreferences.dateFormat);
    
    const username = document.getElementById('settingsUsername');
    if (username) username.textContent = currentUser || 'User';
    
    const emailValue = localStorage.getItem('vf_email') || (String(currentUser || '').includes('@') ? currentUser : '');
    const email = document.getElementById('settingsEmail');
    if (email) {
        email.textContent = emailValue || 'Not available';
        email.href = emailValue ? `mailto:${emailValue}` : '#';
        email.toggleAttribute('aria-disabled', !emailValue);
    }
    
    const memberSince = document.getElementById('settingsMemberSince');
    if (memberSince) memberSince.textContent = getMemberSinceDate();
    
    const lastBackup = document.getElementById('settingsLastBackup');
    if (lastBackup) lastBackup.textContent = getLastBackupDisplay();
    
    const backupStatus = document.getElementById('backupStatusText');
    if (backupStatus) backupStatus.textContent = `Last backup: ${getLastBackupDisplay()}`;
    
    const pwa = document.getElementById('pwaStatus');
    if (pwa) pwa.textContent = isStandaloneAppMode() ? 'Installed' : ('serviceWorker' in navigator ? 'Available' : 'Not supported');
    
    renderRetentionPrefsUI();
    renderNotificationPrefsUI();
}

function openChangePasswordFlow() {
    const email = localStorage.getItem('vf_email') || (String(currentUser || '').includes('@') ? currentUser : '');
    if (email) document.getElementById('forgotIdentifier').value = email;
    document.getElementById('forgotPasswordModal').classList.add('active');
}

function initRetentionPrefs() {
    try {
        retentionPrefs = { ...retentionPrefs, ...(JSON.parse(localStorage.getItem(RETENTION_PREFS_KEY) || '{}')) };
    } catch (_) {}
    renderRetentionPrefsUI();
}

function persistRetentionPrefs() {
    localStorage.setItem(RETENTION_PREFS_KEY, JSON.stringify(retentionPrefs));
}

function renderRetentionPrefsUI() {
    const streaks = document.getElementById('retentionShowStreaks');
    const reviews = document.getElementById('retentionShowReviews');
    const insights = document.getElementById('retentionShowInsights');
    if (streaks) streaks.checked = !!retentionPrefs.showStreaks;
    if (reviews) reviews.checked = !!retentionPrefs.showMonthlyReviews;
    if (insights) insights.checked = !!retentionPrefs.showMotivationalInsights;
}

function syncRetentionPrefToggles() {
    retentionPrefs.showStreaks = !!document.getElementById('retentionShowStreaks')?.checked;
    retentionPrefs.showMonthlyReviews = !!document.getElementById('retentionShowReviews')?.checked;
    retentionPrefs.showMotivationalInsights = !!document.getElementById('retentionShowInsights')?.checked;
    persistRetentionPrefs();
    renderDashboardRetention();
    showToast('Retention preferences updated.', 'success');
}