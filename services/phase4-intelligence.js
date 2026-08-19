
'use strict';

function dateKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function sum(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function calculateFinancialIntelligence(transactions, now = new Date()) {
  const list = Array.isArray(transactions) ? transactions : [];
  const expenses = list.filter(t => t.type === 'expense');
  const income = list.filter(t => t.type === 'income');
  const totalIncome = sum(income, t => t.amount);
  const totalExpenses = sum(expenses, t => t.amount);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

  const byCategory = {};
  expenses.forEach(t => {
    const key = t.category || 'Uncategorized';
    byCategory[key] = (byCategory[key] || 0) + Number(t.amount || 0);
  });

  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  const daily = {};
  list.forEach(t => {
    const key = dateKey(t.date);
    if (!key) return;
    if (!daily[key]) daily[key] = { income: 0, expenses: 0 };
    if (t.type === 'income') daily[key].income += Number(t.amount || 0);
    if (t.type === 'expense') daily[key].expenses += Number(t.amount || 0);
  });

  const dayValues = Object.values(daily);
  const avgDailyExpense = dayValues.length
    ? sum(dayValues, d => d.expenses) / dayValues.length
    : 0;

  const anomalies = Object.entries(daily)
    .filter(([, d]) => d.expenses > Math.max(0, avgDailyExpense * 2.25) && d.expenses > 0)
    .sort((a, b) => b[1].expenses - a[1].expenses)
    .slice(0, 5)
    .map(([date, d]) => ({
      date,
      amount: Number(d.expenses.toFixed(2)),
      multipleOfAverage: avgDailyExpense ? Number((d.expenses / avgDailyExpense).toFixed(1)) : 0
    }));

  const monthly = {};
  list.forEach(t => {
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { income: 0, expenses: 0 };
    if (t.type === 'income') monthly[key].income += Number(t.amount || 0);
    if (t.type === 'expense') monthly[key].expenses += Number(t.amount || 0);
  });

  const months = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));
  const recent = months.slice(-3);
  const recentExpenseTotal = sum(recent, ([, d]) => d.expenses);
  const recentMonthAverage = recent.length ? recentExpenseTotal / recent.length : 0;

  return {
    totals: { income: totalIncome, expenses: totalExpenses, netSavings, savingsRate },
    topCategories: sortedCategories.slice(0, 8),
    anomalies,
    monthly: months.slice(-12).map(([month, d]) => ({
      month, income: d.income, expenses: d.expenses, savings: d.income - d.expenses
    })),
    forecast: {
      averageMonthlyIncome: recent.length ? Number((sum(recent, ([, d]) => d.income) / recent.length).toFixed(2)) : 0,
      averageMonthlyExpenses: Number(recentMonthAverage.toFixed(2)),
      projectedMonthlySurplus: Number((
        (recent.length ? sum(recent, ([, d]) => d.income) / recent.length : 0) -
        recentMonthAverage
      ).toFixed(2))
    },
    generatedAt: now.toISOString()
  };
}

function detectRecurringExpenses(transactions) {
  const expenses = (Array.isArray(transactions) ? transactions : [])
    .filter(t => t.type === 'expense' && t.amount > 0)
    .map(t => ({ ...t, _date: new Date(t.date) }))
    .filter(t => !Number.isNaN(t._date.getTime()));

  const groups = new Map();
  expenses.forEach(t => {
    const fingerprint = `${String(t.category || 'Uncategorized').toLowerCase()}|${Number(t.amount).toFixed(2)}|${String(t.location || '').toLowerCase()}`;
    if (!groups.has(fingerprint)) groups.set(fingerprint, []);
    groups.get(fingerprint).push(t);
  });

  const result = [];
  for (const [fingerprint, items] of groups.entries()) {
    if (items.length < 3) continue;
    items.sort((a, b) => a._date - b._date);
    const gaps = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push(Math.round((items[i]._date - items[i - 1]._date) / 86400000));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 20 || avgGap > 40) continue;
    result.push({
      key: fingerprint,
      category: items[0].category || 'Uncategorized',
      amount: Number(items[items.length - 1].amount || 0),
      occurrences: items.length,
      averageIntervalDays: Number(avgGap.toFixed(1)),
      lastDate: dateKey(items[items.length - 1].date),
      confidence: Math.min(0.99, Number((0.55 + items.length * 0.08).toFixed(2)))
    });
  }
  return result.sort((a, b) => b.confidence - a.confidence).slice(0, 12);
}

function calculateGoalProjections(goals, transactions, now = new Date()) {
  const income = (transactions || []).filter(t => t.type === 'income');
  const expenses = (transactions || []).filter(t => t.type === 'expense');
  const monthlyIncome = income.length ? sum(income, t => t.amount) / Math.max(1, new Set(income.map(t => String(t.date).slice(0, 7))).size) : 0;
  const monthlyExpenses = expenses.length ? sum(expenses, t => t.amount) / Math.max(1, new Set(expenses.map(t => String(t.date).slice(0, 7))).size) : 0;
  const monthlySurplus = Math.max(0, monthlyIncome - monthlyExpenses);

  return (Array.isArray(goals) ? goals : []).map(goal => {
    const target = Number(goal.targetAmount || 0);
    const current = Number(goal.currentAmount || 0);
    const remaining = Math.max(0, target - current);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const daysRemaining = deadline && !Number.isNaN(deadline.getTime())
      ? Math.ceil((deadline - now) / 86400000) : null;
    const requiredMonthly = daysRemaining && daysRemaining > 0 ? remaining / (daysRemaining / 30.4375) : null;
    const rate = monthlySurplus > 0 ? monthlySurplus : 0;
    const projectedDays = remaining === 0 ? 0 : rate > 0 ? Math.ceil((remaining / rate) * 30.4375) : null;
    const projectedDate = projectedDays === null ? null : new Date(now.getTime() + projectedDays * 86400000);
    const onTrack = remaining === 0 || (requiredMonthly !== null && rate >= requiredMonthly);
    return {
      id: goal._id,
      name: goal.name,
      target,
      current,
      remaining,
      progress: target > 0 ? Number(((current / target) * 100).toFixed(1)) : 0,
      deadline: goal.deadline || null,
      daysRemaining,
      requiredMonthly: requiredMonthly === null ? null : Number(requiredMonthly.toFixed(2)),
      projectedMonthlyContribution: Number(rate.toFixed(2)),
      projectedCompletionDate: projectedDate ? projectedDate.toISOString().slice(0, 10) : null,
      status: remaining === 0 ? 'completed' : onTrack ? 'on-track' : 'at-risk'
    };
  });
}

function calculateHabitSnapshot(habits, logs, now = new Date()) {
  const active = (habits || []).filter(h => h.status !== 'archived' && h.active !== false);
  const today = dateKey(now);
  const todayLogs = (logs || []).filter(l => l.scheduledDate === today);
  const completedToday = todayLogs.filter(l => l.status === 'completed').length;
  const scheduledToday = todayLogs.length;
  const completed = (logs || []).filter(l => l.status === 'completed').length;
  const possible = (logs || []).length;
  return {
    activeHabits: active.length,
    today: { completed: completedToday, scheduled: scheduledToday, rate: scheduledToday ? Number(((completedToday / scheduledToday) * 100).toFixed(1)) : 0 },
    overallCompletionRate: possible ? Number(((completed / possible) * 100).toFixed(1)) : 0
  };
}

function buildInsights(financial, goals, habits, recurring) {
  const insights = [];
  if (financial.totals.income > 0 && financial.totals.savingsRate < 10) {
    insights.push({ type: 'warning', priority: 1, title: 'Low savings rate', message: `Your current savings rate is ${financial.totals.savingsRate}%.` });
  }
  if (financial.forecast.projectedMonthlySurplus < 0) {
    insights.push({ type: 'warning', priority: 1, title: 'Projected monthly deficit', message: 'Recent spending is running above recent income.' });
  }
  if (financial.anomalies.length) {
    const a = financial.anomalies[0];
    insights.push({ type: 'info', priority: 2, title: 'Unusual spending day', message: `${a.date} was ${a.multipleOfAverage}× your average daily expense.` });
  }
  const atRisk = goals.filter(g => g.status === 'at-risk');
  if (atRisk.length) {
    insights.push({ type: 'warning', priority: 1, title: 'Goal at risk', message: `${atRisk[0].name} is projected to miss its target pace.` });
  }
  if (habits.today.scheduled && habits.today.rate < 50) {
    insights.push({ type: 'info', priority: 2, title: 'Habit momentum is low today', message: `${habits.today.completed} of ${habits.today.scheduled} scheduled habits are complete.` });
  }
  if (recurring.length) {
    insights.push({ type: 'info', priority: 3, title: 'Recurring expense detected', message: `${recurring.length} likely monthly expense pattern${recurring.length === 1 ? '' : 's'} detected.` });
  }
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

function searchAll(query, { transactions = [], vaults = [], goals = [], habits = [] } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const result = [];
  const add = (type, id, title, subtitle, page, score) => result.push({ type, id, title, subtitle, page, score });
  transactions.forEach(t => {
    const text = `${t.category} ${t.location} ${t.wallet} ${t.vaultName} ${t.notes} ${t.amount} ${t.date}`.toLowerCase();
    if (text.includes(q)) add('transaction', t._id, `${t.type === 'income' ? '+' : '-'} ${t.amount}`, `${t.category || 'Uncategorized'} · ${t.date}`, 'transactions', text.startsWith(q) ? 10 : 5);
  });
  vaults.forEach(v => {
    const text = `${v.name} ${v.description}`.toLowerCase();
    if (text.includes(q)) add('vault', v._id, v.name, `${v.percentage || 0}% allocation`, 'vaults', 8);
  });
  goals.forEach(g => {
    const text = `${g.name} ${g.notes} ${g.status}`.toLowerCase();
    if (text.includes(q)) add('goal', g._id, g.name, `${g.status || 'active'} · ${g.targetAmount || 0}`, 'goals', 8);
  });
  habits.forEach(h => {
    const text = `${h.name} ${h.description} ${h.category}`.toLowerCase();
    if (text.includes(q)) add('habit', h._id, h.name, `${h.frequency || 'daily'} · ${h.status || 'active'}`, 'habits', 8);
  });
  return result.sort((a, b) => b.score - a.score).slice(0, 25);
}

module.exports = {
  dateKey, calculateFinancialIntelligence, detectRecurringExpenses,
  calculateGoalProjections, calculateHabitSnapshot, buildInsights, searchAll
};
