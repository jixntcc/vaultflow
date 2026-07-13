/**
 * @file public/assets/js/modules/auth.js
 * @description Core Authentication and Security State Session Management module for VaultFlow.
 * @dependencies public/assets/js/core/config.js, public/assets/js/core/utils.js
 */

/**
 * Handles the background token rotation process to keep sessions alive securely.
 * @returns {Promise<boolean>} True if session refresh succeeds.
 */
async function refreshAuthToken() {
    if (isRefreshingToken || isDemoMode || !refreshToken) return false;
    isRefreshingToken = true;
    try {
        const response = await fetch(API_BASE_URL + '/api/auth/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        const result = await response.json();
        if (!response.ok) throw new Error();
        
        authToken = result.token;
        localStorage.setItem('vf_token', authToken);
        return true;
    } catch (_) {
        logout('Your login session expired. Please log in again.', 'warning');
        return false;
    } finally {
        isRefreshingToken = false;
    }
}

/**
 * Validates credentials on the backend and sets up the app session state.
 */
async function login(username, password) {
    try {
        const result = await apiCall('/api/auth/login', 'POST', { username, password });
        authToken = result.token;
        currentUser = result.user.username;
        localStorage.setItem('vf_token', authToken);
        localStorage.setItem('vf_refresh_token', result.refreshToken);
        localStorage.setItem('vf_username', currentUser);
        localStorage.setItem('vf_email', result.user.email || (String(username).includes('@') ? username : ''));
        
        if (result.user.createdAt) {
            localStorage.setItem(MEMBER_SINCE_KEY, result.user.createdAt);
        } else if (!localStorage.getItem(MEMBER_SINCE_KEY)) {
            localStorage.setItem(MEMBER_SINCE_KEY, new Date().toISOString());
        }
        
        isDemoMode = false;
        showToast('Login successful!', 'success');
        showApp();
    } catch (error) {
        // Errors are structurally handled and printed inside apiCall
    }
}

/**
 * Registers a new user account profile and auto-logs them into the app workspace.
 */
async function signup(username, email, password) {
    try {
        const result = await apiCall('/api/auth/register', 'POST', { username, email, password });
        authToken = result.token;
        currentUser = result.user.username;
        localStorage.setItem('vf_token', authToken);
        localStorage.setItem('vf_refresh_token', result.refreshToken);
        localStorage.setItem('vf_username', currentUser);
        localStorage.setItem('vf_email', result.user.email || email);
        localStorage.setItem(MEMBER_SINCE_KEY, result.user.createdAt || new Date().toISOString());
        
        isDemoMode = false;
        showToast('Account created successfully!', 'success');
        showApp();
    } catch (error) {
        // Errors are structurally handled and printed inside apiCall
    }
}

/**
 * Activates zero-database sandboxed local demo data loops.
 */
function startDemoMode() {
    isDemoMode = true;
    currentUser = 'Demo User';
    localStorage.setItem('vf_email', 'demo@vaultflow.local');
    localStorage.setItem(MEMBER_SINCE_KEY, new Date().toISOString());
    authToken = 'demo-token';
    localStorage.setItem(ONBOARDING_KEY, 'completed');
    seedDemoShowcaseData();
    showToast('Demo mode activated!', 'success');
    showApp();
}

/**
 * Seeds mockup transaction ledgers for previewing metrics without making network calls.
 */
function seedDemoShowcaseData() {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const d1 = new Date(today.getFullYear(), today.getMonth(), 2);
    const d2 = new Date(today.getFullYear(), today.getMonth(), 6);
    const d3 = new Date(today.getFullYear(), today.getMonth(), 11);
    const d4 = new Date(today.getFullYear(), today.getMonth(), 16);
    
    demoData.transactions = [
        { _id: 'dx1', date: iso(d1), time: '09:15', type: 'income', amount: 85000, category: 'Salary', wallet: 'HR', paymentMethod: 'online', vaultId: '1', vaultName: '👑 Sovereign Capital Vault' },
        { _id: 'dx2', date: iso(d2), time: '13:20', type: 'expense', amount: 7200, category: 'Food', wallet: 'HR', paymentMethod: 'online', vaultId: '4', vaultName: '🔒 Core Survival Vault' },
        { _id: 'dx3', date: iso(d3), time: '11:00', type: 'income', amount: 18000, category: 'Freelance', wallet: 'HL', paymentMethod: 'online', vaultId: '2', vaultName: '🧪 Risk Lab Wallet' },
        { _id: 'dx4', date: iso(d4), time: '18:40', type: 'expense', amount: 5400, category: 'Transport', wallet: 'HL', paymentMethod: 'online', vaultId: '4', vaultName: '🔒 Core Survival Vault' }
    ];
    demoData.goals = [{ _id: 'dg1', name: 'Emergency Fund', targetAmount: 200000, currentAmount: 85000, notes: 'Build 6 month runway' }];
}

/**
 * Wipes out tracking tokens from local client states and returns user to login panel view.
 */
function logout(message = 'Logged out successfully', type = 'success') {
    localStorage.removeItem('vf_token');
    localStorage.removeItem('vf_refresh_token');
    localStorage.removeItem('vf_username');
    localStorage.removeItem('vf_email');
    localStorage.removeItem(MEMBER_SINCE_KEY);
    
    authToken = null;
    refreshToken = null;
    currentUser = null;
    isDemoMode = false;
    resetDemoData();
    showAuth();
    showToast(message, type);
}

/**
 * Handles incoming URL recovery tokens when users click email reset links.
 */
function handleResetTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (window.location.pathname === '/reset-password' || token) {
        showAuth();
        const input = document.getElementById('resetTokenInput');
        if (input) input.value = token || '';
        document.getElementById('resetPasswordModal')?.classList.add('active');
    }
}

/**
 * Triggers dispatch flows for forgot-password recovery submissions.
 */
async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('forgotIdentifier').value.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return showToast('Please enter a valid email', 'error');
    
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    try {
        const res = await apiCall('/api/auth/forgot-password', 'POST', { email });
        showToast(res.message || 'If an account exists, a reset link has been sent.', 'success');
        closeModal('forgotPasswordModal');
        e.target.reset();
    } catch (_) {
        showToast('If an account exists, a reset link has been sent.', 'success');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
    }
}

/**
 * Submits finalized password replacement structures to backend targets.
 */
async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const token = document.getElementById('resetTokenInput').value.trim();
    const password = document.getElementById('resetPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;
    
    if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return showToast('Password must be 8+ chars with uppercase, lowercase, and number', 'error');
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Resetting...'; }
    try {
        const res = await apiCall('/api/auth/reset-password', 'POST', { token, password, confirmPassword });
        showToast(res.message || 'Password reset successful.', 'success');
        closeModal('resetPasswordModal');
        window.history.replaceState({}, document.title, '/');
    } catch (error) {
        // Handled structurally inside apiCall
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Reset Password'; }
    }
}

/**
 * Clears cached demo arrays to maintain clean states on logout boundaries.
 */
function resetDemoData() {
    demoData = {
        vaults: [
            { _id: '1', name: '👑 Sovereign Capital Vault', percentage: 50, description: 'Locked capital for empire building', totalIncome: 0, totalSpent: 0, balance: 0 },
            { _id: '2', name: '🧪 Risk Lab Wallet', percentage: 20, description: 'For trades, loops, experiments', totalIncome: 0, totalSpent: 0, balance: 0 },
            { _id: '3', name: '🧱 Infrastructure Vault', percentage: 10, description: 'For tools, scripts, books', totalIncome: 0, totalSpent: 0, balance: 0 },
            { _id: '4', name: '🔒 Core Survival Vault', percentage: 10, description: 'Essential needs', totalIncome: 0, totalSpent: 0, balance: 0 },
            { _id: '5', name: '🎭 Chaos Play Vault', percentage: 10, description: 'Spend freely', totalIncome: 0, totalSpent: 0, balance: 0 }
        ],
        transactions: [],
        goals: [],
        wallets: {
            HR: { name: 'HR Wallet', balance: 0, totalIncome: 0, totalSpent: 0 },
            HL: { name: 'HL Wallet', balance: 0, totalIncome: 0, totalSpent: 0 }
        }
    };
}