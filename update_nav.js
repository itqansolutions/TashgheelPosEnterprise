const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const baseNav = `
        <a href="pos.html" class="nav-item" data-i18n="nav_pos">🛒 Point of Sale</a>
        <a href="products.html" class="nav-item" data-i18n="nav_products">📦 Products</a>
        <a href="purchases.html" class="nav-item" data-i18n="nav_purchases">📥 Purchases</a>
        <a href="receipts.html" class="nav-item" data-i18n="nav_receipts">🧾 Receipts</a>
        <a href="reports.html" class="nav-item" data-i18n="nav_reports">📈 Reports</a>
        <a href="suppliers.html" class="nav-item" data-i18n="nav_suppliers">🏢 Suppliers</a>
        <a href="customers.html" class="nav-item" data-i18n="nav_customers">👥 Customers</a>
        <a href="salesmen.html" class="nav-item" data-i18n="nav_salesmen">🧑‍💼 Salesmen</a>
        <a href="expenses.html" class="nav-item" data-i18n="nav_expenses">📋 Expenses</a>
        <a href="stores.html" class="nav-item" data-i18n="nav_stores">🏢 Warehouses</a>
        <a href="admin.html" class="nav-item" data-i18n="nav_admin">⚙️ Admin Panel</a>
        <a href="backup.html" class="nav-item" data-i18n="nav_backup">💾 Backup</a>
`;

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Make the appropriate nav-item active
    const parts = baseNav.split('\n');
    let customizedNav = parts.map(line => {
        if (line.includes(`href="${file}"`)) {
            if (!line.includes('active')) {
                return line.replace('class="nav-item"', 'class="nav-item active"');
            }
        } else {
            return line.replace(' active"', '"');
        }
        return line;
    }).join('\n');

    const navBlock = `<nav>${customizedNav}</nav>`;
    const regex = /<nav>[\s\S]*?<\/nav>/;
    if (regex.test(content)) {
        content = content.replace(regex, navBlock);
        fs.writeFileSync(path.join(dir, file), content, 'utf8');
        console.log("Updated " + file);
    }
});
