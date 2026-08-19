(function () {
    'use strict';
    const API_BASE_URL = window.location.origin;
    const DEFAULT_TIMEOUT_MS = 15000;

    async function request(endpoint, { method = 'GET', body = null, token = null, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const options = { method, headers: {}, signal: controller.signal };
        if (body !== null && !['GET', 'HEAD'].includes(method)) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        if (token) options.headers.Authorization = 'Bearer ' + token;
        let response;
        try {
            response = await fetch(API_BASE_URL + endpoint, options);
        } catch (error) {
            if (error?.name === 'AbortError') {
                const timeoutError = new Error(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
                timeoutError.status = 408;
                timeoutError.code = 'REQUEST_TIMEOUT';
                throw timeoutError;
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }

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