(function () {
    'use strict';
    const API_BASE_URL = window.location.origin;
    async function request(endpoint, { method = 'GET', body = null, token = null, signal = null } = {}) {
        const options = { method, headers: {}, signal };
        if (body !== null && !['GET', 'HEAD'].includes(method)) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        if (token) options.headers.Authorization = 'Bearer ' + token;
        const response = await fetch(API_BASE_URL + endpoint, options);
        let result = {};
        if (response.status !== 204) {
            try { result = await response.json(); } catch (_) {}
        }
        if (!response.ok) {
            const error = new Error(result.error || `Request failed (${response.status})`);
            error.status = response.status;
            error.payload = result;
            throw error;
        }
        return result;
    }
    window.VaultFlowApi = Object.freeze({ request, baseUrl: API_BASE_URL });
})();