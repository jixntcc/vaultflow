(function (window, document) {
  'use strict';

  const CATEGORIES = ['Health', 'Fitness', 'Learning', 'Work', 'Finance', 'Personal', 'Mindfulness', 'Other'];

  function ensureCategoryOptions() {
    const select = document.getElementById('habitCategory');
    if (!select) return;
    const current = select.value;
    const existing = new Set(Array.from(select.options).map(option => option.value));
    CATEGORIES.forEach(category => {
      if (existing.has(category)) return;
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    if (current) select.value = current;
  }

  function setup() {
    ensureCategoryOptions();
    const modal = document.getElementById('habitModal');
    if (!modal) return;

    const observer = new MutationObserver(() => {
      if (modal.classList.contains('active')) {
        window.requestAnimationFrame(() => document.getElementById('habitName')?.focus({ preventScroll: true }));
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})(window, document);