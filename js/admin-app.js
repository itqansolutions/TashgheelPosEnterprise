// admin-app.js
// API_URL is defined in auth.js

const APP_PAGES = [
  { id: 'pos.html', label: 'nav_pos' },
  { id: 'products.html', label: 'nav_products' },
  { id: 'inventory.html', label: 'nav_inventory' },
  { id: 'purchases.html', label: 'nav_purchases' },
  { id: 'receipts.html', label: 'nav_receipts' },
  { id: 'reports.html', label: 'nav_reports' },
  { id: 'suppliers.html', label: 'nav_suppliers' },
  { id: 'customers.html', label: 'nav_customers' },
  { id: 'salesmen.html', label: 'nav_salesmen' },
  { id: 'expenses.html', label: 'nav_expenses' },
  { id: 'stores.html', label: 'nav_stores' },
  { id: 'admin.html', label: 'nav_admin' },
  { id: 'backup.html', label: 'nav_backup' }
];

document.addEventListener('DOMContentLoaded', () => {
  // === Shop Settings ===
  const shopNameInput = document.getElementById('shop-name');
  const shopAddressInput = document.getElementById('shop-address');
  const shopLogoInput = document.getElementById('shop-logo');
  const logoPreview = document.getElementById('logo-preview');
  const shopForm = document.getElementById('shop-settings-form');
  const footerMessageInput = document.getElementById('footer-message');
  const taxRateInput = document.getElementById('tax-rate');
  const taxNameInput = document.getElementById('tax-name');

  let uploadedLogoBase64 = '';

  // Load Settings
  async function loadSettings() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/settings`, {
        headers: { 'x-auth-token': token }
      });
      if (response.ok) {
        const settings = await response.json();
        if (settings.shopName) shopNameInput.value = settings.shopName;
        if (settings.shopAddress) shopAddressInput.value = settings.shopAddress;
        if (settings.footerMessage) footerMessageInput.value = settings.footerMessage;
        if (settings.taxRate !== undefined) taxRateInput.value = settings.taxRate;
        if (settings.taxName) taxNameInput.value = settings.taxName;
        if (settings.shopLogo) {
          logoPreview.src = settings.shopLogo;
          logoPreview.style.display = 'block';
          uploadedLogoBase64 = settings.shopLogo;
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  shopLogoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        uploadedLogoBase64 = reader.result;
        logoPreview.src = uploadedLogoBase64;
        logoPreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  shopForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const settings = {
      shopName: shopNameInput.value.trim(),
      shopAddress: shopAddressInput.value.trim(),
      footerMessage: footerMessageInput.value.trim(),
      taxRate: parseFloat(taxRateInput.value) || 0,
      taxName: taxNameInput.value.trim(),
      shopLogo: uploadedLogoBase64
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        alert(getTranslation('settings_saved'));
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  });

  // === User Management ===
  const userForm = document.getElementById('user-form');
  const usernameInput = document.getElementById('new-username');
  const passwordInput = document.getElementById('new-password');
  const fullNameInput = document.getElementById('new-fullname');
  const roleSelect = document.getElementById('user-role');
  const userTableBody = document.getElementById('user-table-body');
  const storesPicker = document.getElementById('user-stores-picker');
  const pagesPicker = document.getElementById('user-pages-picker');

  // Populate Pages Picker
  function populatePagesPicker() {
    pagesPicker.innerHTML = '';
    APP_PAGES.forEach(page => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" value="${page.id}" checked>
          <span data-i18n="${page.label}">${getTranslation(page.label)}</span>
        </label>
      `;
      pagesPicker.appendChild(div);
    });
  }

  async function loadUsers() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users`, {
        headers: { 'x-auth-token': token }
      });
      if (response.ok) {
        const users = await response.json();
        userTableBody.innerHTML = '';
        users.forEach((user) => {
          const row = document.createElement('tr');
          
          // Determine Stores Display
          let storesDisplay = '';
          if (user.role === 'admin') {
            storesDisplay = `<span class="badge badge-success" data-i18n="all_stores">${getTranslation('all_stores')}</span>`;
          } else {
            const names = (user.allowedStores || []).map(sId => {
              const s = (window.allStores || []).find(st => st._id === sId);
              return s ? s.name : sId;
            });
            storesDisplay = names.length > 0 ? names.join(', ') : `<span class="text-muted">-</span>`;
          }

          // Determine Pages Display
          let pagesDisplay = '';
          if (user.role === 'admin') {
            pagesDisplay = `<span class="badge badge-success" data-i18n="all_pages">${getTranslation('all_pages')}</span>`;
          } else {
            const pages = (user.allowedPages || []).map(pId => {
              const p = APP_PAGES.find(ap => ap.id === pId);
              return p ? getTranslation(p.label) : pId;
            });
            pagesDisplay = pages.length > 0 ? pages.join(', ') : `<span class="text-muted">-</span>`;
          }

          row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.fullName || user.username}</td>
                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td style="font-size: 0.85em;">${storesDisplay}</td>
                <td style="font-size: 0.85em;">${pagesDisplay}</td>
                <td>
                  <button onclick="handleDeleteUser('${user._id}')" class="btn btn-sm btn-danger">🗑️</button>
                </td>
              `;
          userTableBody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  window.handleDeleteUser = async function (id) {
    if (!confirm(getTranslation('confirm_delete_user') || "Are you sure?")) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (response.ok) {
        loadUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const fullName = fullNameInput.value.trim();
    const role = roleSelect.value;

    if (!username || !password) return alert('Fill all fields');

    const allowedStores = Array.from(storesPicker.querySelectorAll('input:checked')).map(cb => cb.value);
    const allowedPages = Array.from(pagesPicker.querySelectorAll('input:checked')).map(cb => cb.value);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ username, password, fullName, role, allowedStores, allowedPages })
      });

      if (response.ok) {
        alert('User created successfully');
        userForm.reset();
        // Reset checkboxes if needed, or rely on reset() if they have default checked
        loadUsers();
      } else {
        const data = await response.json();
        alert(data.msg || 'Failed to create user');
      }
    } catch (e) {
      alert(e.message);
    }
  });

  // Handle Role Change to auto-check/uncheck
  roleSelect.addEventListener('change', () => {
    const isAdmin = roleSelect.value === 'admin';
    if (isAdmin) {
      // Maybe check all?
      storesPicker.querySelectorAll('input').forEach(cb => cb.checked = true);
      pagesPicker.querySelectorAll('input').forEach(cb => cb.checked = true);
    }
  });

  loadSettings();
  populatePagesPicker();
});

async function loadStoresForUsers() {
  const picker = document.getElementById('user-stores-picker');
  if (!picker) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/stores`, {
      headers: { 'x-auth-token': token }
    });
    const storesList = await response.json();
    window.allStores = storesList;

    picker.innerHTML = '';
    storesList.forEach(store => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" value="${store._id}" checked>
          <span>${store.name}</span>
        </label>
      `;
      picker.appendChild(div);
    });
    // Now that stores are loaded, we can load users to show names
    if (typeof loadUsers === 'function') loadUsers(); 
    // Wait, loadUsers is inside DOMContentLoaded. Let's make it global or call it from within.
    // Actually, I'll move loadUsers call here.
    window.dispatchEvent(new CustomEvent('storesLoaded'));
  } catch (error) {
    console.error('Error loading stores:', error);
  }
}

// Move loadUsers to a point where it can be called
window.addEventListener('storesLoaded', () => {
    // This is a bit messy, let's just make loadUsers global or call it directly.
});

// Refactored flow:
// 1. DOM Loads -> populatePagesPicker, loadSettings
// 2. loadStoresForUsers -> Fetch stores -> then call loadUsers (which is now global)

window.loadUsersGlobal = async function() {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/users`, {
          headers: { 'x-auth-token': token }
        });
        if (response.ok) {
          const users = await response.json();
          tableBody.innerHTML = '';
          users.forEach((user) => {
            const row = document.createElement('tr');
            
            let storesDisplay = '';
            if (user.role === 'admin') {
              storesDisplay = `<span class="badge badge-success" data-i18n="all_stores">${getTranslation('all_stores')}</span>`;
            } else {
              const names = (user.allowedStores || []).map(sId => {
                const s = (window.allStores || []).find(st => st._id === sId);
                return s ? s.name : sId;
              });
              storesDisplay = names.length > 0 ? names.join(', ') : '-';
            }

            let pagesDisplay = '';
            const APP_PAGES = [
                { id: 'pos.html', label: 'nav_pos' },
                { id: 'products.html', label: 'nav_products' },
                { id: 'purchases.html', label: 'nav_purchases' },
                { id: 'receipts.html', label: 'nav_receipts' },
                { id: 'reports.html', label: 'nav_reports' },
                { id: 'suppliers.html', label: 'nav_suppliers' },
                { id: 'customers.html', label: 'nav_customers' },
                { id: 'salesmen.html', label: 'nav_salesmen' },
                { id: 'expenses.html', label: 'nav_expenses' },
                { id: 'stores.html', label: 'nav_stores' },
                { id: 'admin.html', label: 'nav_admin' },
                { id: 'backup.html', label: 'nav_backup' }
              ];

            if (user.role === 'admin') {
              pagesDisplay = `<span class="badge badge-success" data-i18n="all_pages">${getTranslation('all_pages')}</span>`;
            } else {
              const pages = (user.allowedPages || []).map(pId => {
                const p = APP_PAGES.find(ap => ap.id === pId);
                return p ? getTranslation(p.label) : pId;
              });
              pagesDisplay = pages.length > 0 ? pages.join(', ') : '-';
            }

            row.innerHTML = `
                  <td>${user.username}</td>
                  <td>${user.fullName || user.username}</td>
                  <td>${user.role}</td>
                  <td style="font-size: 0.8em;">${storesDisplay}</td>
                  <td style="font-size: 0.8em;">${pagesDisplay}</td>
                  <td>
                    <button onclick="handleDeleteUser('${user._id}')" class="btn btn-danger">🗑️</button>
                  </td>
                `;
            tableBody.appendChild(row);
          });
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
};

loadStoresForUsers().then(() => {
    window.loadUsersGlobal();
});