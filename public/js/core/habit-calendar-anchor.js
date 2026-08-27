(function (window, document) {
  'use strict';
  function ensureAnchor() {
    const shell = document.querySelector('.vf-habit-shell');
    if (!shell || document.getElementById('habitsList')) return;
    const anchor = document.createElement('div');
    anchor.id = 'habitsList';
    anchor.setAttribute('aria-hidden', 'true');
    anchor.style.display = 'none';
    shell.appendChild(anchor);
  }
  ensureAnchor();
  const observer = new MutationObserver(ensureAnchor);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})(window, document);
