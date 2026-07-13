/**
 * @file public/assets/js/ui/modal.js
 * @description Decoupled shared UI visual handlers, overlay configurations, and interaction helpers for VaultFlow.
 * @dependencies None
 */

function setButtonLoading(button, isLoading, label = 'Working...') {
    if (!button) return;
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = label; button.disabled = true; button.classList.add('loading');
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false; button.classList.remove('loading'); delete button.dataset.originalText;
    }
}

function showPlaceholder(label) { showToast(`${label} will be available in a future VaultFlow update.`, 'warning'); }