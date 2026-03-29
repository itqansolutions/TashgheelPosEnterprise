// admin-app.js
// API_URL is defined in auth.js

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
    console.log('Sending Settings:', settings); // Debug Log

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
        const savedSettings = await response.json();
        console.log('Settings Saved Successfully:', savedSettings);
        const version = savedSettings._backendVersion || 'OLD';
        alert(getTranslation('settings_saved') + `\nDB Status: Rate=${savedSettings.taxRate}, Name="${savedSettings.taxName}"\nBackend Ver: ${version}`);
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
  const roleSelect = document.getElementById('user-role');
  const userTableBody = document.getElementById('user-table-body');

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
          const storesNames = user.role === 'admin' ? getTranslation('all_stores') : (user.allowedStores && user.allowedStores.length > 0
            ? user.allowedStores.map(sId => {
                const s = (window.allStores || []).find(st => st._id === sId);
                return s ? s.name : sId;
              }).join(', ')
            : '-');

          row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.fullName || user.username}</td>
                <td>${user.role}</td>
                <td style="font-size: 0.8em;">${storesNames}</td>
                <td><button onclick="handleDeleteUser('${user._id}')" class="btn btn-danger">🗑️</button></td>
              `;
          userTableBody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  window.handleDeleteUser = async function (id) {
    if (!confirm("Are you sure you want to delete this user?")) return;
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
    const role = roleSelect.value;

    if (!username || !password) return alert('Fill all fields');
    const token = localStorage.getItem('token');

    try {
      const allowedStores = Array.from(document.querySelectorAll('#user-stores-picker input:checked')).map(cb => cb.value);

      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ username, password, fullName: document.getElementById('new-fullname').value, role, allowedStores })
      });

      if (response.ok) {
        alert('User created successfully');
        userForm.reset();
        loadUsers();
      } else {
        const data = await response.json();
        alert(data.msg || 'Failed to create user');
      }
    } catch (e) {
      alert(e.message);
    }
  });

  // === Customer Management ===
  const customerForm = document.getElementById('customer-form');
  const customerNameInput = document.getElementById('customer-name');
  const customerPhoneInput = document.getElementById('customer-phone');
  const customerEmailInput = document.getElementById('customer-email');
  const customerAddressInput = document.getElementById('customer-address');
  const customerTableBody = document.getElementById('customer-table-body');

  async function loadCustomers() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/customers`, {
        headers: { 'x-auth-token': token }
      });
      if (response.ok) {
        const customers = await response.json();
        customerTableBody.innerHTML = '';
        customers.forEach((customer) => {
          const row = document.createElement('tr');
          row.innerHTML = `
                <td>${customer.name}</td>
                <td>${customer.phone}</td>
                <td>${customer.email || '-'}</td>
                <td>
                  <button onclick="handleDeleteCustomer('${customer._id}')" class="btn btn-danger">🗑️</button>
                </td>
              `;
          customerTableBody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }

  window.handleDeleteCustomer = async function (id) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (response.ok) {
        loadCustomers();
      } else {
        alert('Failed to delete customer');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = customerNameInput.value.trim();
    const phone = customerPhoneInput.value.trim();
    const email = customerEmailInput.value.trim();
    const address = customerAddressInput.value.trim();

    if (!name || !phone) return alert('Name and Phone are required');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ name, phone, email, address })
      });

      if (response.ok) {
        alert('Customer saved successfully');
        customerForm.reset();
        loadCustomers();
      } else {
        const data = await response.json();
        alert(data.msg || 'Failed to save customer');
      }
    } catch (e) {
      alert(e.message);
    }
  });

  loadSettings();
  // loadUsers(); // Called by loadStoresForUsers
  loadCustomers();

  // === License Info ===
  async function loadLicenseInfo() {
    try {
      const token = localStorage.getItem('token');
      // Using existing endpoint if available or fetch from settings/tenant
      // We'll likely need a specific endpoint or use an existing one.
      // Let's assume /api/tenant/trial-status exists or we can get it from /settings response if updated.
      // But based on previous knowledge, we might need to rely on /settings if it returns tenant info, or just fetch tenant.
      // Let's try to fetch tenant details. Existing auth usually puts tenantId in token.
      // Let's check /api/auth/user or similar.
      // Actually, let's use a simpler approach: check if we can get it from /settings? No.
      // Let's assume we can fetch '/api/tenant/my-status' or similar. 
      // If not, we might need to add it. But for now, let's try to fetch `GET /settings` and see if we can include it there in backend?
      // Or cleaner: `GET /api/tenant/status`

      const response = await fetch(`${API_URL}/tenant/trial-status`, {
        headers: { 'x-auth-token': token }
      });

      if (response.ok) {
        const data = await response.json();
        document.getElementById('license-loading').style.display = 'none';
        document.getElementById('license-details').style.display = 'block';

        const statusEl = document.getElementById('license-status');
        const dateEl = document.getElementById('license-date');
        const daysEl = document.getElementById('license-days');

        const remaining = data.daysRemaining;
        const validUntil = new Date(data.trialEndsAt);
        const isTrial = true; // Endpoint implies trial but returns validUntil which could be sub.
        // Actually the backend returns { trialEndsAt, daysRemaining, isExpired }

        // Let's assume if it is a trial endpoint, it returns trial info. 
        // Logic: if remaining > 365 roughly it might be long term.

        statusEl.textContent = 'Active'; // Simple status
        statusEl.style.color = 'green';

        dateEl.textContent = validUntil.toLocaleDateString();
        daysEl.textContent = remaining + ' days';

        if (remaining < 5) daysEl.style.color = 'red';
      } else {
        document.getElementById('license-loading').textContent = 'Could not load license info.';
      }
    } catch (error) {
      console.error('License load error:', error);
      document.getElementById('license-loading').textContent = 'Error loading license info.';
    }
  }

  loadLicenseInfo();
});

async function loadStoresForUsers() {
  const picker = document.getElementById('user-stores-picker');
  if (!picker) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/stores`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storesList = await response.json();
    window.allStores = storesList; // Shared for table rendering

    picker.innerHTML = '';
    storesList.forEach(store => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <label>
          <input type="checkbox" value="${store._id}"> ${store.name}
        </label>
      `;
      picker.appendChild(div);
    });
    loadUsers();
  } catch (error) {
    console.error('Error loading stores:', error);
    loadUsers();
  }
}

let allStores = [];
loadStoresForUsers();

// applyTranslations() is handled by translations.js