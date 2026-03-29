document.addEventListener('DOMContentLoaded', () => {
    const storesTableBody = document.getElementById('storesTableBody');
    const storeModal = document.getElementById('storeModal');
    const storeForm = document.getElementById('storeForm');
    const addStoreBtn = document.getElementById('addStoreBtn');
    const closeModal = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalTitle');
    
    let stores = [];

    // Check auth
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const user = window.getCurrentUser ? window.getCurrentUser() : JSON.parse(localStorage.getItem('currentUser'));
    if (user) {
        document.getElementById('currentUser').textContent = user.fullName || user.username;
    }

    // Load translations and sidebar
    if (window.i18n) {
        window.i18n.updatePage();
    }

    const loadStores = async () => {
        try {
            const res = await fetch('/api/stores', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            stores = await res.json();
            renderStores();
        } catch (err) {
            console.error('Error loading stores:', err);
        }
    };

    const renderStores = () => {
        storesTableBody.innerHTML = '';
        stores.forEach(store => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${store.name}</td>
                <td>${store.location || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-edit" onclick="editStore('${store._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteStore('${store._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            storesTableBody.appendChild(tr);
        });
    };

    window.editStore = (id) => {
        const store = stores.find(s => s._id === id);
        if (store) {
            document.getElementById('storeId').value = store._id;
            document.getElementById('storeName').value = store.name;
            document.getElementById('storeLocation').value = store.location || '';
            modalTitle.setAttribute('data-i18n', 'edit_store');
            if (window.i18n) window.i18n.updatePage();
            storeModal.style.display = 'block';
        }
    };

    window.deleteStore = async (id) => {
        const confirmMsg = document.documentElement.lang === 'ar' ? 'هل أنت متأكد من مسح هذا المخزن؟' : 'Are you sure you want to delete this store?';
        if (confirm(confirmMsg)) {
            try {
                await fetch(`/api/stores/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                loadStores();
            } catch (err) {
                console.error('Error deleting store:', err);
            }
        }
    };

    addStoreBtn.onclick = () => {
        storeForm.reset();
        document.getElementById('storeId').value = '';
        modalTitle.setAttribute('data-i18n', 'add_store');
        if (window.i18n) window.i18n.updatePage();
        storeModal.style.display = 'block';
    };

    closeModal.onclick = () => storeModal.style.display = 'none';

    storeForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('storeId').value;
        const storeData = {
            name: document.getElementById('storeName').value,
            location: document.getElementById('storeLocation').value
        };

        const url = id ? `/api/stores/${id}` : '/api/stores';
        const method = id ? 'PUT' : 'POST';

        try {
            await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(storeData)
            });
            storeModal.style.display = 'none';
            loadStores();
        } catch (err) {
            console.error('Error saving store:', err);
        }
    };

    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    };

    loadStores();
});
