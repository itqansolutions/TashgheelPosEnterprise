// Ali Karam POS System - Enhanced Authentication & Security
// Compatible with Windows 7+ browsers and works fully offline
// Includes one-time license activation system

// Auth System linked to Backend API

// Determine API URL based on environment
let defaultApiUrl = '/api';
if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && window.location.port !== '5000')) {
    defaultApiUrl = 'http://localhost:5000/api';
}

const API_URL = window.API_URL || defaultApiUrl;
window.API_URL = API_URL;

// Login function
async function login(username, password, businessEmail) {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, businessEmail })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            return { success: true };
        } else {
            console.error('Login failed:', data.msg);
            return { success: false, msg: data.msg };
        }
    } catch (error) {
        console.error('Error:', error);
        return { success: false, msg: 'Server connection error' };
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('shiftResumed');
    window.location.href = 'index.html';
}

// Confirm logout with user
function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
}

// Get current logged in user
function getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

// Check if session is valid
function isSessionValid() {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            logout();
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

// Check permissions
function hasPermission(requiredRole) {
    const user = getCurrentUser();
    if (!user) return false;

    const roleHierarchy = {
        'admin': 3,
        'manager': 2,
        'cashier': 1
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
}

// New: Check page-level permission
function canAccessPage(pageName) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin has all permissions
    if (!user.allowedPages || user.allowedPages.length === 0) return false;
    return user.allowedPages.includes(pageName);
}

// Export functions
window.login = login;
window.logout = logout;
window.confirmLogout = confirmLogout;
window.getCurrentUser = getCurrentUser;
window.hasPermission = hasPermission;
window.canAccessPage = canAccessPage;
window.isSessionValid = isSessionValid;

// Redirect if not logged in or doesn't have page permission
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1);
    
    // Auth exceptions
    const exceptions = ['index.html', 'register.html', 'subscription.html', ''];
    if (!exceptions.includes(page)) {
        if (!isSessionValid()) {
            window.location.href = 'index.html';
            return;
        }

        // Granular page permission check
        const user = getCurrentUser();
        if (user && user.role !== 'admin') {
            const allowedPages = user.allowedPages || [];
            // If accessing a restricted page
            if (page && page.endsWith('.html') && !allowedPages.includes(page)) {
                // Special case for POS - it's usually the landing page for cashiers
                if (page !== 'pos.html') {
                   alert('Access Denied: You do not have permission to view this page.');
                   window.location.href = 'pos.html';
                }
            }
        }
    }

    // Sidebar Visibility Enhancement
    const sidebarItems = document.querySelectorAll('.nav-item');
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
        const allowedPages = user.allowedPages || [];
        sidebarItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && href.endsWith('.html') && !allowedPages.includes(href)) {
                item.style.display = 'none'; // Hide unauthorized sidebar links
            }
        });
    }
});
