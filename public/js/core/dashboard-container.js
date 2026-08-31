(function () {
    'use strict';

    function ensureDashboardContainer() {
        const dashboard = document.getElementById('dashboard');
        if (!dashboard) return false;
        if (dashboard.querySelector(':scope > .vf-page.dashboard-v2')) return true;

        const wrapper = document.createElement('div');
        wrapper.className = 'vf-page dashboard-v2';
        const children = Array.from(dashboard.children);
        children.forEach(child => wrapper.appendChild(child));
        dashboard.appendChild(wrapper);
        return true;
    }

    function init() {
        ensureDashboardContainer();

        // Dashboard is part of the existing SPA and can be restored/re-rendered.
        // Keep the wrapper intact without changing any existing IDs or handlers.
        const observer = new MutationObserver(() => ensureDashboardContainer());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
