const fs = require('fs');
const domain = fs.readFileSync('public/js/core/habit-domain.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
for (const token of ['function getDateRangeDays','function getHabitAnalytics','function getPortfolioAnalytics','consistencyScore','weekday']) {
  if (!domain.includes(token)) throw new Error(`Missing domain token: ${token}`);
}
for (const token of ['Habit Analytics','habitAnalyticsRate','habitAnalyticsScore','habitAnalyticsDaily','habitAnalyticsHabits','notifHabitReminder','notifHabitWeekly','notifHabitRisk','maybeScheduleHabitNotifications','maybeScheduleHabitRiskNotification','maybeScheduleHabitWeeklySummary','renderHabitAnalytics']) {
  if (!html.includes(token)) throw new Error(`Missing UI token: ${token}`);
}
if (!sw.includes('payload.data?.tag')) throw new Error('Notification tags not wired');
console.log('VaultFlow Phase 3E Habit Analytics & Notifications assertions passed.');
