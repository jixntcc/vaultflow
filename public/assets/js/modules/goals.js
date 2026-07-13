/**
 * @file public/assets/js/modules/goals.js
 * @description Long-term Savings Goals metrics compiler and predictive completion calculator.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

/**
 * Builds visualization parameters and compiles linear tracking progress cards for target savings goals.
 */
function renderGoalsPage() {
    const container = document.getElementById('goalsList');
    if (!container) return;

    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <h3 class="empty-title">Set your first money target</h3>
                <p class="empty-text">Goals create momentum and help build your savings habit.</p>
                <div class="empty-cta-row">
                    <button class="btn btn-primary" onclick="showGoalModal()">+ Add Goal</button>
                </div>
            </div>
        `;
        return;
    }

    const models = goals.map(goal => buildGoalProgressModel(goal));
    container.innerHTML = models.map(({ goal, target, current, remaining, percentage, estimatedDate, daysRemaining }) => `
        <div class="goal-card goal-progress-card">
            <div class="goal-header">
                <div>
                    <div class="goal-name">${goal.name}</div>
                    <div class="goal-amount">${percentage.toFixed(0)}% Complete</div>
                </div>
                <div class="goal-progress">${percentage.toFixed(1)}%</div>
            </div>
            <div class="goal-progress-meta">
                <div class="goal-progress-stat"><span>Current Progress</span><strong>${formatMoney(current)} / ${formatMoney(target)}</strong></div>
                <div class="goal-progress-stat"><span>Remaining</span><strong>${formatMoney(remaining)}</strong></div>
                <div class="goal-progress-stat"><span>Estimated Completion</span><strong>${estimatedDate ? formatMonthLabel(monthKeyFromDate(estimatedDate), true) : 'Add more data'}</strong></div>
                <div class="goal-progress-stat"><span>Days Remaining</span><strong>${daysRemaining !== null ? `${daysRemaining} days` : 'Calculating'}</strong></div>
            </div>
            <div class="goal-progress-track" aria-label="${goal.name} progress ${percentage.toFixed(1)}%">
                <div class="goal-progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="milestone-row">${renderMilestones(percentage)}</div>
            ${goal.notes ? `<p style="margin-top: 10px; color: var(--text-secondary); font-size: 14px;">${goal.notes}</p>` : ''}
            <div class="vault-actions" style="margin-top: 16px;">
                <button class="btn btn-secondary" onclick="editGoal('${goal._id}')">Edit</button>
                <button class="btn btn-secondary" onclick="deleteGoal('${goal._id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

/**
 * Generates interactive pill markers indicating major milestone status.
 */
function renderMilestones(percentage) {
    return [25, 50, 75, 100].map(milestone => `
        <span class="milestone-pill ${percentage >= milestone ? 'achieved' : ''}">${percentage >= milestone ? '✓ ' : ''}${milestone}%</span>
    `).join('');
}