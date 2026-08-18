
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

  const previous = months.length >= 2 ? months[months.length - 2][1] : null;
  const latest = months.length ? months[months.length - 1][1] : null;
  const incomeGrowth = previous && previous.income > 0
    ? Number((((latest.income - previous.income) / previous.income) * 100).toFixed(1))
    : null;
  const expenseGrowth = previous && previous.expenses > 0
    ? Number((((latest.expenses - previous.expenses) / previous.expenses) * 100).toFixed(1))
    : null;

  const concentrationBase = totalExpenses > 0 ? totalExpenses : 1;
  const topCategoryShare = sortedCategories.length
    ? Number(((sortedCategories[0][1] / concentrationBase) * 100).toFixed(1))
    : 0;
  const expenseRatio = totalIncome > 0
    ? Number(((totalExpenses / totalIncome) * 100).toFixed(1))
    : 0;

  // Explainable 0–100 financial health score; deliberately deterministic.
  let healthScore = 50;
  if (totalIncome > 0) healthScore += Math.max(-20, Math.min(25, savingsRate * 0.5));
  if (expenseRatio > 100) healthScore -= Math.min(25, (expenseRatio - 100) * 0.25);
  if (anomalies.length) healthScore -= Math.min(10, anomalies.length * 2);
  if (topCategoryShare > 50) healthScore -= Math.min(10, (topCategoryShare - 50) * 0.2);
  healthScore = Math.round(Math.max(0, Math.min(100, healthScore)));

  return {
    totals: { income: totalIncome, expenses: totalExpenses, netSavings, savingsRate },
    health: {
      score: healthScore,
      expenseRatio,
      topCategoryShare,
      incomeGrowth,
      expenseGrowth
    },
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
    const recommendedMonthly = rate > 0 ? Number((rate * 0.8).toFixed(2)) : 0;
    const projectedDays = remaining === 0 ? 0 : rate > 0 ? Math.ceil((remaining / rate) * 30.4375) : null;
    const projectedDate = projectedDays === null ? null : new Date(now.getTime() + projectedDays * 86400000);
    const safeProjectedDays = remaining === 0 ? 0 : recommendedMonthly > 0 ? Math.ceil((remaining / recommendedMonthly) * 30.4375) : null;
    const safeProjectedDate = safeProjectedDays === null ? null : new Date(now.getTime() + safeProjectedDays * 86400000);
    const deadlineFeasible = remaining === 0 || (requiredMonthly !== null && rate >= requiredMonthly);
    const onTrack = remaining === 0 || deadlineFeasible;
    const deadlineBufferMonths = daysRemaining && daysRemaining > 0 && projectedDays !== null
      ? Number(((daysRemaining - projectedDays) / 30.4375).toFixed(1))
      : null;
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
      recommendedMonthlyContribution: recommendedMonthly,
      projectedCompletionDate: projectedDate ? projectedDate.toISOString().slice(0, 10) : null,
      conservativeCompletionDate: safeProjectedDate ? safeProjectedDate.toISOString().slice(0, 10) : null,
      monthlySurplus: Number(monthlySurplus.toFixed(2)),
      deadlineFeasible,
      deadlineBufferMonths,
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


function calculateFinanceHabitCorrelation(transactions, habits, habitLogs, now = new Date()) {
  const list = Array.isArray(transactions) ? transactions : [];
  const activeHabits = (Array.isArray(habits) ? habits : []).filter(h => h.status !== 'archived' && h.active !== false);
  const logs = Array.isArray(habitLogs) ? habitLogs : [];

  const daily = {};
  list.forEach(t => {
    const key = dateKey(t.date);
    if (!key) return;
    if (!daily[key]) daily[key] = { spending: 0, income: 0 };
    if (t.type === 'expense') daily[key].spending += Number(t.amount || 0);
    if (t.type === 'income') daily[key].income += Number(t.amount || 0);
  });

  const completedByDate = {};
  const scheduledByDate = {};
  logs.forEach(log => {
    const key = log.scheduledDate;
    if (!key) return;
    scheduledByDate[key] = (scheduledByDate[key] || 0) + 1;
    if (log.status === 'completed') completedByDate[key] = (completedByDate[key] || 0) + 1;
  });

  const dates = Array.from(new Set([...Object.keys(daily), ...Object.keys(scheduledByDate)])).sort();
  const observations = dates.map(date => {
    const scheduled = scheduledByDate[date] || 0;
    const completed = completedByDate[date] || 0;
    return {
      date,
      spending: Number((daily[date]?.spending || 0).toFixed(2)),
      income: Number((daily[date]?.income || 0).toFixed(2)),
      scheduled,
      completed,
      completionRate: scheduled ? (completed / scheduled) * 100 : null
    };
  }).filter(x => x.scheduled > 0);

  const average = items => items.length ? items.reduce((sum, x) => sum + x.spending, 0) / items.length : 0;
  const withBoth = observations.filter(x => x.completionRate != null);
  const high = withBoth.filter(x => x.completionRate >= 75);
  const low = withBoth.filter(x => x.completionRate < 50);

  const x = withBoth.map(o => o.completionRate);
  const y = withBoth.map(o => o.spending);
  let correlation = null;
  if (x.length >= 3) {
    const meanX = x.reduce((a,b) => a+b, 0) / x.length;
    const meanY = y.reduce((a,b) => a+b, 0) / y.length;
    const numerator = x.reduce((sum, value, i) => sum + ((value - meanX) * (y[i] - meanY)), 0);
    const denominatorX = Math.sqrt(x.reduce((sum, value) => sum + ((value - meanX) ** 2), 0));
    const denominatorY = Math.sqrt(y.reduce((sum, value) => sum + ((value - meanY) ** 2), 0));
    correlation = denominatorX && denominatorY ? Number((numerator / (denominatorX * denominatorY)).toFixed(3)) : null;
  }

  const highAverageSpending = average(high);
  const lowAverageSpending = average(low);
  const spendingDifferencePercent = lowAverageSpending > 0
    ? Number((((highAverageSpending - lowAverageSpending) / lowAverageSpending) * 100).toFixed(1))
    : null;

  const habitScores = activeHabits.map(habit => {
    const relevant = withBoth.filter(o => logs.some(log =>
      String(log.habitId) === String(habit._id) && log.scheduledDate === o.date
    ));
    const completed = relevant.filter(o => logs.some(log =>
      String(log.habitId) === String(habit._id) &&
      log.scheduledDate === o.date &&
      log.status === 'completed'
    ));
    return {
      habitId: habit._id,
      name: habit.name,
      observedDays: relevant.length,
      completionRate: relevant.length ? Number(((completed.length / relevant.length) * 100).toFixed(1)) : 0
    };
  }).filter(x => x.observedDays > 0);

  return {
    observedDays: withBoth.length,
    correlation,
    highCompletionDays: high.length,
    lowCompletionDays: low.length,
    averageSpendingHighCompletion: Number(highAverageSpending.toFixed(2)),
    averageSpendingLowCompletion: Number(lowAverageSpending.toFixed(2)),
    spendingDifferencePercent,
    habitScores: habitScores.slice(0, 8),
    generatedAt: now.toISOString()
  };
}


function buildPersonalizationProfile(financial, goals, habits, financeHabit, now = new Date()) {
  const goalList = Array.isArray(goals) ? goals : [];
  const activeGoals = goalList.filter(g => g.status !== 'completed');
  const atRiskGoals = activeGoals.filter(g => g.status === 'at-risk');
  const habitRate = Number(habits?.overallCompletionRate || 0);
  const savingsRate = Number(financial?.totals?.savingsRate || 0);
  const income = Number(financial?.totals?.income || 0);
  const expense = Number(financial?.totals?.expenses || 0);
  const healthScore = Number(financial?.health?.score || 0);
  const expenseGrowth = financial?.health?.expenseGrowth == null ? null : Number(financial.health.expenseGrowth);
  const incomeGrowth = financial?.health?.incomeGrowth == null ? null : Number(financial.health.incomeGrowth);
  const observedDays = Number(financeHabit?.observedDays || 0);
  const spendingDifference = financeHabit?.spendingDifferencePercent == null ? null : Number(financeHabit.spendingDifferencePercent);
  const transactionCount = Number(financial?.transactionCount || 0);

  // Higher score = stronger reason to focus attention here. Scores are derived
  // only from the user's own domain snapshot; no cross-user profile is used.
  const signals = {
    finance: Math.max(0, Math.min(100,
      (savingsRate < 10 ? 42 : savingsRate < 20 ? 25 : 8) +
      (expense > income && income > 0 ? 38 : 0) +
      (healthScore > 0 && healthScore < 55 ? 20 : healthScore < 70 ? 8 : 0) +
      (expenseGrowth != null && expenseGrowth > 10 ? 15 : 0)
    )),
    goals: Math.max(0, Math.min(100,
      atRiskGoals.length * 38 +
      activeGoals.length * 8 +
      (activeGoals.some(g => g.deadline && new Date(g.deadline) - now < 45 * 86400000) ? 20 : 0)
    )),
    habits: Math.max(0, Math.min(100,
      habitRate < 50 ? 52 : habitRate < 75 ? 32 : 8,
      100
    )),
    momentum: Math.max(0, Math.min(100,
      (savingsRate >= 20 ? 30 : 0) +
      (habitRate >= 75 ? 30 : 0) +
      (atRiskGoals.length === 0 && activeGoals.length ? 25 : 0) +
      (transactionCount >= 20 ? 15 : 0)
    ))
  };

  if (observedDays >= 7 && spendingDifference != null && Math.abs(spendingDifference) >= 10) {
    signals.habits = Math.min(100, signals.habits + 8);
  }

  const ranked = [
    ['finance', signals.finance],
    ['goals', signals.goals],
    ['habits', signals.habits],
    ['momentum', signals.momentum]
  ].sort((a, b) => b[1] - a[1]);

  const mode = ranked[0][0];
  const scoreGap = ranked.length > 1 ? ranked[0][1] - ranked[1][1] : ranked[0][1];
  const confidence = transactionCount < 5 && observedDays < 7
    ? 'early'
    : scoreGap >= 20
      ? 'high'
      : scoreGap >= 8
        ? 'medium'
        : 'balanced';

  const reasons = {
    finance: [
      savingsRate < 10 ? `Savings rate is ${Math.round(savingsRate)}%.` : null,
      expense > income && income > 0 ? 'Recent expenses exceed recorded income.' : null,
      healthScore > 0 && healthScore < 55 ? `Financial health is ${Math.round(healthScore)}/100.` : null,
      expenseGrowth != null && expenseGrowth > 10 ? `Expenses are up ${Math.round(expenseGrowth)}%.` : null
    ],
    goals: [
      atRiskGoals.length ? `${atRiskGoals.length} active goal${atRiskGoals.length === 1 ? '' : 's'} need attention.` : null,
      activeGoals.length ? `${activeGoals.length} active goal${activeGoals.length === 1 ? '' : 's'} are in progress.` : null
    ],
    habits: [
      habitRate < 50 ? `Habit completion is ${Math.round(habitRate)}%.` : null,
      observedDays >= 7 && spendingDifference != null && Math.abs(spendingDifference) >= 10
        ? `Habit-completion days differ from lower-completion days by ${Math.abs(spendingDifference)}% in spending.`
        : null
    ],
    momentum: [
      savingsRate >= 20 ? 'Your savings margin is healthy.' : null,
      habitRate >= 75 ? 'Habit consistency is strong.' : null,
      atRiskGoals.length === 0 && activeGoals.length ? 'Active goals are currently not at risk.' : null
    ]
  };

  const copy = {
    finance: {
      title: 'Stabilize your money',
      message: expense > income && income > 0
        ? 'Spending is currently ahead of income. Protect cash flow before adding complexity.'
        : 'Your financial numbers deserve the most attention right now. Focus on cash flow and savings consistency.',
      actionLabel: 'Review spending',
      actionPage: 'transactions'
    },
    goals: {
      title: 'Protect your goal momentum',
      message: atRiskGoals.length
        ? `${atRiskGoals.length} goal${atRiskGoals.length === 1 ? '' : 's'} need attention. Adjust the pace before the deadline gets closer.`
        : 'You have active goals. Keep your contribution pace consistent and move toward the next milestone.',
      actionLabel: 'Open goals',
      actionPage: 'goals'
    },
    habits: {
      title: 'Build consistency',
      message: 'Your habit completion is the clearest area to improve. Small repeated actions can strengthen your financial routine.',
      actionLabel: 'Open habits',
      actionPage: 'habits'
    },
    momentum: {
      title: 'Keep your momentum',
      message: 'Your recent signals look healthy. Avoid unnecessary complexity and keep repeating what is working.',
      actionLabel: 'View intelligence',
      actionPage: 'insights'
    }
  }[mode];

  const behavioralSignal = observedDays >= 7 && spendingDifference != null
    ? `Your data shows a ${Math.abs(spendingDifference)}% spending difference between higher- and lower-completion habit days.`
    : 'VaultFlow is still learning your money-and-habit pattern.';

  const cleanReasons = (reasons[mode] || []).filter(Boolean).slice(0, 3);
  const secondaryFocus = ranked[1]?.[0] || null;

  return {
    mode,
    generatedAt: now.toISOString(),
    confidence,
    signals,
    priorities: ranked.map(([name]) => name),
    headline: copy.title,
    message: copy.message,
    actionLabel: copy.actionLabel,
    actionPage: copy.actionPage,
    behavioralSignal,
    reasons: cleanReasons,
    secondaryFocus,
    adaptive: {
      showFinance: mode === 'finance' || signals.finance >= 45,
      showGoals: mode === 'goals' || signals.goals >= 40,
      showHabits: mode === 'habits' || signals.habits >= 45,
      emphasizeMomentum: mode === 'momentum' || signals.momentum >= 60
    },
    dataQuality: {
      transactionCount,
      activeGoals: activeGoals.length,
      activeHabits: Number(habits?.activeHabits || 0),
      habitObservedDays: observedDays
    }
  };
}

const VAULTFLOW_PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    name: 'Free',
    features: Object.freeze(['transactions', 'vaults', 'goals', 'habits', 'basic-insights'])
  }),
  plus: Object.freeze({
    id: 'plus',
    name: 'VaultFlow Plus',
    features: Object.freeze([
      'transactions', 'vaults', 'goals', 'habits', 'basic-insights',
      'advanced-intelligence', 'automation', 'background-notifications', 'advanced-exports'
    ])
  })
});

function buildPlanProfile(user = {}) {
  const planId = user.subscriptionPlan === 'plus' ? 'plus' : 'free';
  const plan = VAULTFLOW_PLANS[planId];
  return {
    id: plan.id,
    name: plan.name,
    status: user.subscriptionStatus || 'active',
    features: [...plan.features],
    billingReady: true,
    billingProvider: null,
    upgradeAvailable: planId === 'free'
  };
}

function buildRetentionProfile(transactions, goals, habits, habitLogs, personalization = null, now = new Date()) {
  const tx = Array.isArray(transactions) ? transactions : [];
  const gs = Array.isArray(goals) ? goals : [];
  const logs = Array.isArray(habitLogs) ? habitLogs : [];
  const days = new Set();
  tx.forEach(t => {
    const d = dateKey(t.date);
    if (d) days.add(d);
  });
  logs.forEach(l => { if (l.scheduledDate) days.add(l.scheduledDate); });

  const today = dateKey(now);
  const activeGoals = gs.filter(g => g.status !== 'completed');
  const completedGoals = gs.filter(g => g.status === 'completed');
  const habitCompleted = logs.filter(l => l.status === 'completed').length;
  const habitScheduled = logs.length;
  const completionRate = habitScheduled ? Math.round((habitCompleted / habitScheduled) * 100) : 0;

  const recentDays = [];
  const cursor = new Date(now);
  for (let i = 0; i < 14; i++) {
    recentDays.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  const activeRecentDays = recentDays.filter(d => days.has(d)).length;

  let streak = 0;
  const streakCursor = new Date(now);
  while (streak < 14) {
    const d = dateKey(streakCursor);
    if (!days.has(d)) break;
    streak++;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const milestones = [];
  activeGoals.forEach(g => {
    const target = Number(g.targetAmount || 0);
    const current = Number(g.currentAmount || 0);
    if (target <= 0) return;
    [25,50,75].forEach(p => {
      const key = `${g._id}:${p}`;
      if (current >= target * p / 100) milestones.push({ key, type:'goal', title:`${g.name} reached ${p}%`, goalId:g._id, progress:p });
    });
  });

  const activityScore = Math.min(100, Math.round(
    (Math.min(activeRecentDays, 7) / 7) * 45 +
    Math.min(streak, 7) / 7 * 25 +
    (activeGoals.length ? 15 : 0) +
    (habitScheduled ? Math.min(completionRate,100) * 0.15 : 0)
  ));

  let state = activityScore >= 75 ? 'engaged' : activityScore >= 40 ? 'developing' : 'at-risk';
  if (!tx.length && !logs.length) state = 'new';

  const weeklyReview = {
    periodDays: 7,
    activeDays: recentDays.slice(0,7).filter(d => days.has(d)).length,
    transactions: tx.filter(t => {
      const d = dateKey(t.date);
      return recentDays.slice(0,7).includes(d);
    }).length,
    habitCompletionRate: completionRate,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    streak,
    activityScore
  };

  let message = 'Keep using VaultFlow to build a useful personal pattern.';
  let actionLabel = 'Add activity';
  let actionPage = 'transactions';
  if (state === 'engaged') {
    message = streak >= 3
      ? `You have a ${streak}-day activity streak. A short weekly review can keep the momentum useful.`
      : 'Your recent activity is consistent. Keep the weekly review habit simple and sustainable.';
    actionLabel = 'Review week';
    actionPage = 'insights';
  } else if (state === 'developing') {
    message = 'You are building a useful pattern. One small action today is enough to keep VaultFlow relevant.';
    actionLabel = 'Log today';
    actionPage = 'dashboard';
  } else if (state === 'at-risk') {
    message = 'Your recent activity is quiet. Start with one transaction or habit check-in rather than trying to catch up all at once.';
    actionLabel = 'Start today';
    actionPage = 'dashboard';
  }

  return {
    state,
    activityScore,
    streak,
    weeklyReview,
    milestones: milestones.slice(-8),
    headline: state === 'engaged' ? 'Keep your momentum' : state === 'developing' ? 'Build your rhythm' : state === 'at-risk' ? 'Restart gently' : 'Welcome to VaultFlow',
    message,
    actionLabel,
    actionPage,
    personalizationMode: personalization?.mode || null,
    generatedAt: now.toISOString(),
    dataQuality: {
      transactionCount: tx.length,
      habitLogCount: logs.length,
      activeGoals: activeGoals.length
    },
    privacy: { serverDerived: true, noCrossUserData: true }
  };
}

function buildInsights(financial, goals, habits, recurring, financeHabit = null) {
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
  if (financeHabit?.observedDays >= 7 && financeHabit.spendingDifferencePercent != null) {
    const direction = financeHabit.spendingDifferencePercent < 0 ? 'lower' : financeHabit.spendingDifferencePercent > 0 ? 'higher' : 'about the same';
    insights.push({ type: 'info', priority: 3, title: 'Habit and spending pattern detected', message: `On higher-completion habit days, spending was ${Math.abs(financeHabit.spendingDifferencePercent)}% ${direction} than on lower-completion days. This is a correlation, not proof of cause.` });
  }
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

function searchAll(query, {
  transactions = [], vaults = [], goals = [], habits = [], automationRules = [], intelligence = null
} = {}) {
  const raw = String(query || '').trim();
  const q = raw.toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const result = [];

  const scoreText = (text, base = 5) => {
    const value = String(text || '').toLowerCase();
    if (!value) return 0;
    if (value === q) return base + 8;
    if (value.startsWith(q)) return base + 5;
    if (value.includes(q)) return base;
    const matched = terms.filter(term => value.includes(term)).length;
    return matched ? base - 1 + matched * 2 : 0;
  };

  const add = (type, id, title, subtitle, page, score, action = null) => {
    if (score > 0) result.push({
      type, id: String(id || `${type}-${result.length}`), title, subtitle, page,
      score, action: action || { type: 'switch-page', page }
    });
  };

  transactions.forEach(t => {
    const text = `${t.category} ${t.location} ${t.wallet} ${t.vaultName} ${t.notes} ${t.amount} ${t.date} ${t.type}`;
    add('transaction', t._id, `${t.type === 'income' ? '+' : '-'} ${t.amount}`,
      `${t.category || 'Uncategorized'} · ${t.date}`, 'transactions', scoreText(text, 7));
  });

  vaults.forEach(v => {
    const text = `${v.name} ${v.description}`;
    add('vault', v._id, v.name, `${v.percentage || 0}% allocation`, 'vaults', scoreText(text, 9));
  });

  goals.forEach(g => {
    const text = `${g.name} ${g.notes} ${g.status} ${g.targetAmount}`;
    add('goal', g._id, g.name, `${g.status || 'active'} · ${g.targetAmount || 0}`, 'goals', scoreText(text, 9));
  });

  habits.forEach(h => {
    const text = `${h.name} ${h.description} ${h.category} ${h.frequency} ${h.status}`;
    add('habit', h._id, h.name, `${h.frequency || 'daily'} · ${h.status || 'active'}`, 'habits', scoreText(text, 9));
  });

  const eventLabels = {
    goal_at_risk: 'Goal at risk',
    expense_threshold: 'Daily expense threshold',
    habit_streak: 'Habit streak',
    weekly_summary: 'Weekly summary',
    financial_health_drop: 'Financial health below',
    savings_rate_below: 'Savings rate below',
    habit_finance_signal: 'Habit spending signal'
  };
  automationRules.forEach(rule => {
    const label = eventLabels[rule.event] || rule.event || 'Automation';
    const text = `${rule.name} ${label} ${rule.event} ${JSON.stringify(rule.condition || {})}`;
    add('automation', rule._id, rule.name, `${label}${rule.condition?.threshold != null ? ` · ${rule.condition.threshold}` : ''}`,
      'settings', scoreText(text, 10), { type: 'automation', page: 'settings', id: rule._id });
  });

  if (intelligence) {
    const candidates = [
      ['financial-health', 'Financial health', `Score ${Math.round(Number(intelligence.health?.score || 0))}/100`, 'insights'],
      ['savings-rate', 'Savings rate', `${Number(intelligence.totals?.savingsRate || 0)}%`, 'insights'],
      ['cash-flow', 'Cash-flow outlook', `Projected monthly surplus ${Number(intelligence.forecast?.projectedMonthlySurplus || 0)}`, 'insights'],
      ['habit-finance', 'Habit ↔ spending signal', intelligence.financeHabit?.observedDays >= 7
        ? `${Math.abs(Number(intelligence.financeHabit.spendingDifferencePercent || 0))}% observed difference`
        : 'Building pattern', 'insights']
    ];
    candidates.forEach(([id, title, subtitle, page]) => {
      const text = `${title} ${subtitle}`;
      add('intelligence', id, title, subtitle, page, scoreText(text, 6));
    });
  }

  return result
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 30);
}

module.exports = {
  dateKey, calculateFinancialIntelligence, detectRecurringExpenses,
  calculateGoalProjections, calculateHabitSnapshot, calculateFinanceHabitCorrelation, buildPersonalizationProfile, buildRetentionProfile, buildPlanProfile, buildInsights, searchAll
};
