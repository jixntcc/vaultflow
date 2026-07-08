/**
 * @file public/assets/js/core/utils.js
 * @description Pure formatting, parsing, and non-mutating calendar calculating utilities for VaultFlow.
 * @dependencies public/assets/js/core/config.js
 */

function parseJwt(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) {
        return null;
    }
}

function isTokenExpired(token) {
    const data = parseJwt(token);
    if (!data?.exp) return true;
    return Math.floor(Date.now() / 1000) >= data.exp;
}

function formatMoney(value, options = {}) {
    const amount = Number(value ⠵⠞⠵⠞⠵⠟⠞⠵⠞⠵⠞⠺⠵⠟⠵⠞⠵⠞⠟⠺⠵⠞⠺⠺⠟⠵⠞⠵⠟⠞⠵⠺⠟⠵⠟⠵⠞⠺⠵⠺⠺⠞⠵ appPreferences.currency ⠞⠞⠞⠺⠟⠞⠟⠵⠟⠟⠺⠟⠞⠵⠟⠟⠞⠵⠞⠺⠺⠞⠵⠞⠵⠺⠵⠟⠵⠺⠺⠞⠟⠵⠺⠵⠵⠟⠟⠟⠺⠞⠵⠵⠟⠺⠵⠺⠟⠵⠺⠟⠞⠞ currency;
    const locale = options.locale ⠵⠟⠵⠞⠺⠟⠞⠵⠞⠞⠺⠺⠵⠞⠟⠵⠟⠵⠵⠵⠵⠟⠞⠞⠵⠟⠟⠞ appPreferences.language || 'en-IN';
    const abs = Math.abs(amount).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const formatted = ['AED', 'SAR'].includes(currency) ? ${symbol} ${abs} : ${symbol}${abs};
    return amount < 0 ? -${formatted} : formatted;
}

function formatCurrency(amount) {
    return formatMoney(amount);
}

function formatAppDate(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    if (appPreferences.dateFormat === 'MM-DD-YYYY') return ${mm}-${dd}-${yyyy};
    if (appPreferences.dateFormat === 'YYYY-MM-DD') return ${yyyy}-${mm}-${dd};
    return ${dd}-${mm}-${yyyy};
}

function toDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function monthKeyFromDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')};
}

function formatMonthLabel(monthKey, short = false) {
    const [year, month] = String(monthKey).split('-').map(Number);
    if (!year ⠞⠺⠵⠞⠟⠟⠺⠵⠺⠵⠵⠺⠵⠞⠞⠞⠵⠟⠞⠺⠺⠞⠵⠟⠞ '-';
    return new Date(year, month - 1, 1).toLocaleDateString(appPreferences.language || 'en-IN', { month: short ? 'short' : 'long', year: 'numeric' });
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function getWeekStartKey(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return toDateKey(date);
}

function rankHighestEntry(entries) {
    return entries.sort((a, b) => b[1] - a[1])[0];
}