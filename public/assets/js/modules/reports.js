/**
 * @file public/assets/js/modules/reports.js
 * @description Advanced Financial Reports compilation layer, smart insight engine, and Chart.js integration hooks.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

function loadReports() {
    showReportsSkeleton();
    apiCall('/api/analytics/full')
        .then(data => { 
            reportsRawData = data; 
            setupReportFilterDefaults(); 
            applyReportFilters(); 
        })
        .catch(error => console.error('Error loading reports:', error));
}

function showReportsSkeleton() {
    ['monthIncomeDisplay', 'monthExpensesDisplay', 'monthSavingsDisplay', 'annualDisplay'].forEach((id) => {
        const el = document.getElementById(id); 
        if (el) { el.textContent = ''; el.classList.add('skeleton'); }
    });
}

function clearReportsSkeleton() {
    ['monthIncomeDisplay', 'monthExpensesDisplay', 'monthSavingsDisplay', 'annualDisplay'].forEach((id) => {
        const el = document.getElementById(id); if (el) el.classList.remove('skeleton');
    });
}

function deferRender(task) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 300 }); else setTimeout(task, 0);
}

function setupReportFilterDefaults() {
    const today = new Date();
    if (document.getElementById('reportFromDate')) document.getElementById('reportFromDate').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    if (document.getElementById('reportToDate')) document.getElementById('reportToDate').value = today.toISOString().slice(0, 10);
}

function toggleReportFilters(forceExpand) {
    const card = document.getElementById('reportFiltersCard');
    const icon = document.getElementById('reportFilterToggleIcon');
    if (!card) return;
    if (forceExpand === true) card.classList.remove('collapsed');
    else if (forceExpand === false) card.classList.add('collapsed');
    else card.classList.toggle('collapsed');
    if (icon) icon.textContent = card.classList.contains('collapsed') ? '▾' : '▴';
}

function generateSmartInsights(data, txns) {
    const insights = [];
    const topCategory = rankHighestEntry(Object.entries(data.byCategory || {}));
    if (topCategory) insights.push({ kicker: 'Top spend', text: `${topCategory[0]} led your spending at ${formatMoney(topCategory[1])}.` });
    const expenseByDay = {};
    txns.filter(t => t.type === 'expense').forEach(t => { expenseByDay[t.date] = (expenseByDay[t.date] || 0) + Number(t.amount || 0); });
    const busiestDay = rankHighestEntry(Object.entries(expenseByDay));
    if (busiestDay) insights.push({ kicker: 'Biggest expense day', text: `Your peak spend day was ${busiestDay[0]} at ${formatMoney(busiestDay[1])}.` });
    const income = Number(data?.incomeVsExpenses?.income || 0);
    const expenses = Number(data?.incomeVsExpenses?.expenses || 0);
    insights.push({ kicker: 'Savings rate', text: `You saved ${(income > 0 ? ((income - expenses) / income) * 100 : 0).toFixed(1)}% of your income in this period.` });
    return insights.slice(0, 3);
}

function renderSmartInsights(data, txns) {
    const container = document.getElementById('smartInsights');
    if (!container) return;
    container.innerHTML = generateSmartInsights(data, txns).map(i => `
        <article class="insight-card"><div class="insight-kicker">${i.kicker}</div><div class="insight-text">${i.text}</div></article>`).join('');
}

async function applyReportFilters() {
    if (!reportsRawData) return;
    const preset = document.getElementById('reportPreset')?.value || 'all';
    let fromDate = document.getElementById('reportFromDate')?.value ? new Date(document.getElementById('reportFromDate').value + 'T00:00:00') : null;
    let toDate = document.getElementById('reportToDate')?.value ? new Date(document.getElementById('reportToDate').value + 'T23:59:59') : null;
    const now = new Date();
    if (preset === 'week') fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    if (preset === 'month') fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    if (preset === 'year') fromDate = new Date(now.getFullYear(), 0, 1);
    if (preset !== 'custom' && preset !== 'all') toDate = now;
    if (preset === 'all') { fromDate = null; toDate = null; }

    const filtered = transactions.filter(t => {
        const d = new Date(t.date);
        return !(fromDate && d < fromDate) && !(toDate && d > toDate);
    });

    const analytics = buildAnalyticsFromTransactions(filtered);
    renderSmartInsights(analytics, filtered);
    renderCharts(analytics);
    if (window.innerWidth <= 768) toggleReportFilters(false);
}

function buildAnalyticsFromTransactions(txns) {
    const byCategory = {}, byVault = {}, byMonth = {}, incomeByCategory = {};
    let totalIncome = 0, totalExpenses = 0;
    txns.forEach(t => {
        const amt = Number(t.amount || 0);
        const key = monthKeyFromDate(t.date);
        if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
        if (t.type === 'income') {
            totalIncome += amt; byMonth[key].income += amt;
            incomeByCategory[t.category || 'Uncategorized'] = (incomeByCategory[t.category || 'Uncategorized'] || 0) + amt;
        } else {
            totalExpenses += amt; byMonth[key].expenses += amt;
            byCategory[t.category || 'Uncategorized'] = (byCategory[t.category || 'Uncategorized'] || 0) + amt;
            byVault[t.vaultName || 'Unassigned'] = (byVault[t.vaultName || 'Unassigned'] || 0) + amt;
        }
    });
    const monthly = Object.keys(byMonth).sort().map(m => ({ month: m, income: byMonth[m].income, expenses: byMonth[m].expenses, savings: byMonth[m].income - byMonth[m].expenses }));
    let runningSavings = 0;
    return {
        incomeVsExpenses: { income: totalIncome, expenses: totalExpenses }, byCategory, byVault, monthly,
        savingsPortfolio: monthly.map(i => { runningSavings += i.savings; return { month: i.month, value: runningSavings }; }), incomeByCategory
    };
}

async function renderCharts(data) {
    const periodNet = Number(data.incomeVsExpenses.income || 0) - Number(data.incomeVsExpenses.expenses || 0);
    document.getElementById('monthIncomeDisplay').textContent = formatMoney(data.incomeVsExpenses.income);
    document.getElementById('monthExpensesDisplay').textContent = formatMoney(data.incomeVsExpenses.expenses);
    document.getElementById('monthSavingsDisplay').textContent = formatMoney(periodNet);
    document.getElementById('annualDisplay').textContent = formatMoney(periodNet);
    clearReportsSkeleton();

    Object.values(chartsInstance).forEach(chart => chart?.destroy?.());
    deferRender(() => renderIncomeFlowChart(data));
    deferRender(() => renderMonthlyBreakdownFromAnalytics(data.monthly || []));

    try {
        const total = Number(data.incomeVsExpenses.income || 0) + Number(data.incomeVsExpenses.expenses || 0);
        document.getElementById('incomeExpensesProgress').innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; font-weight:600;">
                <span>Income ${(total > 0 ? (data.incomeVsExpenses.income / total) * 100 : 0).toFixed(1)}%</span>
                <span>Expenses ${(total > 0 ? (data.incomeVsExpenses.expenses / total) * 100 : 0).toFixed(1)}%</span>
            </div>
            <div style="width:100%; height:22px; background:#e5e7eb; border-radius:999px; overflow:hidden; display:flex;">
                <div style="width:${total > 0 ? (data.incomeVsExpenses.income / total) * 100 : 0}%; background:#10b981;"></div>
                <div style="width:${total > 0 ? (data.incomeVsExpenses.expenses / total) * 100 : 0}%; background:#ef4444;"></div>
            </div>`;
    } catch (e) {}

    deferRender(() => {
        chartsInstance.category = new Chart(document.getElementById('categoryChart'), {
            type: 'bar', data: { labels: Object.keys(data.byCategory), datasets: [{ data: Object.values(data.byCategory), backgroundColor: '#6366f1' }] },
            options: { indexAxis: 'y', responsive: true, plugins: { legend: false } }
        });
        chartsInstance.vault = new Chart(document.getElementById('vaultChart'), {
            type: 'bar', data: { labels: Object.keys(data.byVault), datasets: [{ data: Object.values(data.byVault), backgroundColor: '#f59e0b' }] },
            options: { indexAxis: 'y', responsive: true, plugins: { legend: false } }
        });
        chartsInstance.trends = new Chart(document.getElementById('trendsChart'), {
            type: 'line', data: { labels: data.monthly.map(m => m.month), datasets: [{ label: 'Income', data: data.monthly.map(m => m.income), borderColor: '#10b981' }, { label: 'Expenses', data: data.monthly.map(m => m.expenses), borderColor: '#ef4444' }] },
            options: { responsive: true }
        });
        chartsInstance.savingsPortfolio = new Chart(document.getElementById('savingsPortfolioChart'), {
            type: 'line', data: { labels: data.savingsPortfolio.map(m => m.month), datasets: [{ label: 'Portfolio', data: data.savingsPortfolio.map(m => m.value), borderColor: '#10b981', fill: true }] },
            options: { responsive: true }
        });
        chartsInstance.incomeCategory = new Chart(document.getElementById('incomeCategoryChart'), {
            type: 'bar', data: { labels: Object.keys(data.incomeByCategory), datasets: [{ data: Object.values(data.incomeByCategory), backgroundColor: '#22c55e' }] },
            options: { indexAxis: 'y', responsive: true, plugins: { legend: false } }
        });
    });
}

function renderIncomeFlowChart(data) {
    const container = document.getElementById('incomeFlowChart'); if (!container) return;
    const income = Number(data?.incomeVsExpenses?.income || 0), expenses = Number(data?.incomeVsExpenses?.expenses || 0);
    const net = income - expenses, savings = Math.max(0, net), deficit = Math.max(0, -net);
    
    const scale = 280 / Math.max(income + deficit, expenses + savings, 1);
    const grossH = Math.max(18, income * scale), expenseH = Math.max(18, expenses * scale);
    const curve = (x1, y1, x2, y2, h) => `<path d="M ${x1} ${y1} C ${x1 + 110} ${y1}, ${x2 - 110} ${y2}, ${x2} ${y2} L ${x2} ${y2 + h} C ${x2 - 110} ${y2 + h}, ${x1 + 110} ${y1 + h}, ${x1} ${y1 + h} Z" fill="rgba(148,163,184,0.3)"></path>`;

    container.innerHTML = `
      <svg width="980" height="360" viewBox="0 0 980 360">
        ${curve(82, 36 + (280 - grossH)/2, 430, 50, expenseH)}
        ${savings > 0 ? curve(82, 36 + (280 - grossH)/2 + expenseH, 430, 68 + expenseH, Math.max(18, savings * scale)) : ''}
        <rect x="60" y="${36 + (280 - grossH)/2}" width="22" height="${grossH}" fill="#a3a3a3"></rect>
        <rect x="430" y="50" width="22" height="${expenseH}" fill="#a3a3a3"></rect>
        <text x="90" y="180" font-size="14">Gross Income (${formatMoney(income)})</text>
        <text x="460" y="65" font-size="14">Expenses (${formatMoney(expenses)})</text>
      </svg>`;
}

function renderMonthlyBreakdownFromAnalytics(monthlyRows) {
    const container = document.getElementById('monthlyBreakdown'); if (!container || monthlyRows.length === 0) return;
    let openingBalance = 0;
    const rows = [...monthlyRows].sort((a, b) => a.month.localeCompare(b.month)).map((row) => {
        const income = Number(row.income || 0), expenses = Number(row.expenses || 0), closingBalance = openingBalance + income - expenses;
        const mapped = { month: row.month, openingBalance, income, expenses, closingBalance, net: income - expenses };
        openingBalance = closingBalance; return mapped;
    }).reverse();

    let html = '<table><thead><tr><th>Month</th><th>Past Balance</th><th>Income</th><th>Expenses</th><th>Closing</th><th>Rate</th></tr></thead><tbody>';
    rows.forEach((r) => {
        html += `<tr><td>export data<strong>${r.month}</strong></td><td>${formatMoney(r.openingBalance)}</td><td style="color:var(--secondary)">${formatMoney(r.income)}</td><td style="color:var(--danger)">${formatMoney(r.expenses)}</td><td>${formatMoney(r.closingBalance)}</td><td>${(r.income > 0 ? (r.net / r.income) * 100 : 0).toFixed(1)}%</td></tr>`;
    });
    container.innerHTML = html + '</tbody></table>';
}

function renderReportsPage() { loadReports(); }