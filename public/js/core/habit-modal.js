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

  function focusFirstField() {
    const modal = document.getElementById('habitModal');
    if (!modal?.classList.contains('active')) return;
    window.requestAnimationFrame(() => document.getElementById('habitName')?.focus({ preventScroll: true }));
  }

  ensureCategoryOptions();

  const observer = new MutationObserver(() => {
    ensureCategoryOptions();
    focusFirstField();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('load', ensureCategoryOptions, { once: true });
})(window, document);