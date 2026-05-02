// products-app.js
// API_URL is defined in auth.js

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadCategories();

  document.getElementById("product-form").addEventListener("submit", handleAddProduct);
  document.getElementById("edit-product-form").addEventListener("submit", handleUpdateProduct);
  document.getElementById("category-form-modal").addEventListener("submit", handleAddCategory);
  
  // Search listener
  const searchInput = document.getElementById("product-search");
  if (searchInput) {
      searchInput.addEventListener("input", filterProducts);
  }

  // Expose functions globally
  window.openCategoryModal = openCategoryModal;
  window.closeCategoryModal = closeCategoryModal;
  window.deleteCategory = deleteCategory;
  window.deleteProduct = deleteProduct;
  window.editProduct = editProduct;
});

// --- SEARCH ---
function filterProducts() {
    const term = document.getElementById("product-search").value.toLowerCase();
    const rows = document.querySelectorAll("#product-table-body tr");
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
}

// --- PRODUCTS ---

async function loadProducts() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/products`, {
      headers: { 'x-auth-token': token }
    });
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            alert("Session expired or access denied");
            window.location.href = "index.html";
        }
        return;
    }
    const products = await response.json();
    window.allProducts = products;

    renderProductTable(products);
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

function renderProductTable(products) {
    const tbody = document.getElementById("product-table-body");
    tbody.innerHTML = "";

    products.forEach((p) => {
      const row = document.createElement("tr");
      
      const statusHtml = p.active !== false 
        ? `<span class="badge badge-success" data-i18n="active">${getTranslation('active')}</span>`
        : `<span class="badge badge-danger" data-i18n="inactive">${getTranslation('inactive') || 'Inactive'}</span>`;

      row.innerHTML = `
        <td>
            <div style="font-weight:bold;">${p.name}</div>
            <div style="font-size:0.8em; color:#666;">${p.code || '-'}</div>
        </td>
        <td>${p.barcode || "-"}</td>
        <td>${p.category || "-"}</td>
        <td>${p.price?.toFixed(2) || "0.00"}</td>
        <td class="font-semibold text-brand-blue">${p.priceOnline?.toFixed(2) || "-"}</td>
        <td class="font-bold">${p.stock || 0}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p._id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(row);
    });
}

async function handleAddProduct(e) {
  e.preventDefault();

  const name = document.getElementById("product-name").value.trim();
  const category = document.getElementById("product-category").value;
  const barcode = document.getElementById("product-barcode").value.trim();
  const price = parseFloat(document.getElementById("product-price").value);
  const priceOnline = parseFloat(document.getElementById("product-price-online").value) || 0;
  const priceDelivery = parseFloat(document.getElementById("product-price-delivery").value) || 0;
  const trackStock = document.getElementById("product-track-stock").checked;
  const onlineActive = document.getElementById("product-online-active").checked;
  const imageUrl = document.getElementById("product-image-url").value.trim();

  if (!name || isNaN(price)) return alert("Please fill required fields");

  const product = {
    name,
    category,
    barcode,
    price,
    priceOnline,
    priceDelivery,
    trackStock,
    onlineActive,
    imageUrl,
    active: true
  };

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify(product)
    });

    if (response.ok) {
      alert('Product added successfully');
      e.target.reset();
      loadProducts();
    } else {
      const err = await response.json();
      alert('Failed: ' + err.msg);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function editProduct(id) {
  const product = window.allProducts?.find(p => p._id === id);
  if (!product) return;

  document.getElementById("edit-product-id").value = product._id;
  document.getElementById("edit-product-name").value = product.name;
  document.getElementById("edit-product-barcode").value = product.barcode || "";
  document.getElementById("edit-product-price").value = product.price;
  document.getElementById("edit-product-price-online").value = product.priceOnline || "";
  document.getElementById("edit-product-price-delivery").value = product.priceDelivery || "";
  document.getElementById("edit-product-track-stock").checked = product.trackStock !== false;
  document.getElementById("edit-product-online-active").checked = product.onlineActive !== false;
  document.getElementById("edit-product-image-url").value = product.imageUrl || "";

  // Category
  const editCat = document.getElementById("edit-product-category");
  const mainCat = document.getElementById("product-category");
  editCat.innerHTML = mainCat.innerHTML;
  editCat.value = product.category || "";

  document.getElementById("editProductModal").style.display = "flex";
}

function closeEditProductModal() {
  document.getElementById("editProductModal").style.display = "none";
}

async function handleUpdateProduct(e) {
  e.preventDefault();

  const id = document.getElementById("edit-product-id").value;
  const name = document.getElementById("edit-product-name").value.trim();
  const barcode = document.getElementById("edit-product-barcode").value.trim();
  const category = document.getElementById("edit-product-category").value;
  const price = parseFloat(document.getElementById("edit-product-price").value);
  const priceOnline = parseFloat(document.getElementById("edit-product-price-online").value) || 0;
  const priceDelivery = parseFloat(document.getElementById("edit-product-price-delivery").value) || 0;
  const trackStock = document.getElementById("edit-product-track-stock").checked;
  const onlineActive = document.getElementById("edit-product-online-active").checked;
  const imageUrl = document.getElementById("edit-product-image-url").value.trim();

  const updates = { name, barcode, category, price, priceOnline, priceDelivery, trackStock, onlineActive, imageUrl };

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify(updates)
    });

    if (response.ok) {
      alert("Updated successfully");
      closeEditProductModal();
      loadProducts();
    }
  } catch (error) {
    console.error(error);
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });
    if (response.ok) loadProducts();
  } catch (e) {
    console.error(e);
  }
}

// --- CATEGORIES ---

async function loadCategories() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/categories`, {
      headers: { 'x-auth-token': token }
    });
    if (!response.ok) return;
    
    const categories = await response.json();
    const select = document.getElementById("product-category");
    const listBody = document.getElementById("category-list-body");

    select.innerHTML = '<option value="">-- Select Category --</option>';
    listBody.innerHTML = "";

    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);

      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${cat.name}</td>
                <td style="text-align:right;">
                    <button class="btn btn-danger btn-sm" onclick="deleteCategory('${cat._id}')">🗑️</button>
                </td>
            `;
      listBody.appendChild(row);
    });
  } catch (error) {
    console.error(error);
  }
}

function openCategoryModal() {
  document.getElementById("categoryModal").style.display = "flex";
}

function closeCategoryModal() {
  document.getElementById("categoryModal").style.display = "none";
}

async function handleAddCategory(e) {
  e.preventDefault();
  const input = document.getElementById("new-category-modal");
  const name = input.value.trim();
  if (!name) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ name })
    });

    if (response.ok) {
      input.value = "";
      loadCategories();
    }
  } catch (error) {
    console.error(error);
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete category?')) return;
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });
    loadCategories();
  } catch (error) {
    console.error(error);
  }
}
