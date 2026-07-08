/**
 * @file public/assets/js/core/config.js
 * @description Application global constants, dictionary mappings, and storage keys for VaultFlow.
 * @dependencies None
 */

const API_BASE_URL = window.location.origin;

// Application local storage configuration dictionary keys
const ONBOARDING_KEY = 'vf_onboarding_completed';
const INSTALL_DISMISS_KEY = 'vf_install_dismissed_at';
const NOTIF_PREFS_KEY = 'vf_notification_prefs_v1';
const LAST_BACKUP_KEY = 'vf_last_backup';
const MEMBER_SINCE_KEY = 'vf_member_since';
const RETENTION_PREFS_KEY = 'vf_retention_prefs';
const MONTHLY_REVIEWS_KEY = 'vf_monthly_reviews';

const PREF_KEYS = {
    currency: 'vf_currency',
    language: 'vf_language',
    theme: 'vf_theme',
    dateFormat: 'vf_date_format'
};

// Global localization dictionary maps
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼', SGD: 'S$', MYR: 'RM' };
const CURRENCY_LOCALES = { INR: 'en-IN', USD: 'en-US', EUR: 'en-US', GBP: 'en-GB', AED: 'en-AE', SAR: 'en-SA', SGD: 'en-SG', MYR: 'en-MY' };