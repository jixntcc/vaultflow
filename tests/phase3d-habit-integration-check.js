const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');
const store = fs.readFileSync('public/js/core/store.js', 'utf8');
const required = [
  "habits: items + logs",
  "habitLogs",
  "function loadAllHabitLogs",
  "function renderDashboardHabits",
  "function renderHabitReportSnapshot",
  "function restoreBackupData",
  "apiCall('/api/habit-logs'",
  "sourceHabitId",
  "Habit Snapshot",
  "Today's Habits"
];
for (const token of required) {
  if (!html.includes(token) && token !== 'habits: items + logs') throw new Error(`Missing UI integration token: ${token}`);
}
if (!server.includes("app.get('/api/habit-logs'")) throw new Error('Missing all HabitLogs API route');
if (!server.includes("app.delete('/api/habit-logs/:id'")) throw new Error('Missing HabitLog delete route');
if (!store.includes('habits: { items: [], logs: [] }')) throw new Error('Habit store contract missing');
if (!html.includes("['transactions', 'vaults', 'goals', 'habits', 'habitLogs']")) throw new Error('Backup validation does not include habit data');
if (!html.includes('sanitizeHabitForRestore')) throw new Error('Habit restore sanitizer missing');
if (!html.includes('sanitizeHabitLogForRestore')) throw new Error('HabitLog restore sanitizer missing');
if (html.includes('backup.getVaults()')) throw new Error('Stale backup.getVaults() bug remains');
console.log('VaultFlow Phase 3D Habit Integration assertions passed.');
