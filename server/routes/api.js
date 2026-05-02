const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Salesman = require('../models/Salesman');
const Expense = require('../models/Expense');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');
const Category = require('../models/Category');
const StockAdjustment = require('../models/StockAdjustment');
const Shift = require('../models/Shift');
const AuditLog = require('../models/AuditLog');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const LedgerTransaction = require('../models/LedgerTransaction');
const Store = require('../models/Store');

// ================= STORES (WAREHOUSES) =================

// @route   GET /api/stores
// @desc    Get all stores
// @access  Private
router.get('/stores', auth, async (req, res) => {
    try {
        const stores = await Store.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
        res.json(stores);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/stores
// @desc    Add new store
// @access  Private
router.post('/stores', auth, async (req, res) => {
    try {
        const newStore = new Store({
            tenantId: req.tenantId,
            ...req.body
        });
        const store = await newStore.save();
        res.json(store);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/stores/:id
// @desc    Update store
// @access  Private
router.put('/stores/:id', auth, async (req, res) => {
    try {
        let store = await Store.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!store) return res.status(404).json({ msg: 'Store not found' });

        const { name, location } = req.body;
        if (name) store.name = name;
        if (location !== undefined) store.location = location;

        await store.save();
        res.json(store);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/stores/:id
// @desc    Delete store
// @access  Private
router.delete('/stores/:id', auth, async (req, res) => {
    try {
        // Here we could add logic to check if store has stock before deleting, 
        // but for now we just delete.
        const store = await Store.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!store) return res.status(404).json({ msg: 'Store not found' });

        await Store.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Store removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// CUSTOMERS

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private
router.get('/customers', auth, async (req, res) => {
    try {
        const customers = await Customer.find({ tenantId: req.tenantId });
        res.json(customers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/customers
// @desc    Add new customer
// @access  Private
router.post('/customers', auth, async (req, res) => {
    try {
        const newCustomer = new Customer({
            tenantId: req.tenantId,
            ...req.body
        });
        const customer = await newCustomer.save();
        res.json(customer);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private
router.delete('/customers/:id', auth, async (req, res) => {
    try {
        const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!customer) return res.status(404).json({ msg: 'Customer not found' });

        await Customer.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Customer removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put('/customers/:id', auth, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!customer) return res.status(404).json({ msg: 'Customer not found' });

        const { name, phone, email, address, loyaltyPoints, balance } = req.body;
        if (name) customer.name = name;
        if (phone) customer.phone = phone;
        if (email !== undefined) customer.email = email;
        if (address !== undefined) customer.address = address;
        if (loyaltyPoints !== undefined) customer.loyaltyPoints = loyaltyPoints;
        if (balance !== undefined) customer.balance = balance;

        await customer.save();
        res.json(customer);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/customers/:id/statement
// @desc    Get customer ledger statement
// @access  Private
router.get('/customers/:id/statement', auth, async (req, res) => {
    try {
        const transactions = await LedgerTransaction.find({
            tenantId: req.tenantId,
            entityType: 'customer',
            entityId: req.params.id
        }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/customers/:id/pay
// @desc    Receive payment from customer
// @access  Private
router.post('/customers/:id/pay', auth, async (req, res) => {
    try {
        const { amount, notes } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ msg: 'Valid amount missing' });

        let customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!customer) return res.status(404).json({ msg: 'Customer not found' });

        // Payment reduces the customer's debt
        customer.balance -= amount;
        await customer.save();

        const ledgerTx = new LedgerTransaction({
            tenantId: req.tenantId,
            entityType: 'customer',
            entityId: customer._id,
            type: 'payment',
            amount: -amount, // Negative because it reduces the balance owed
            date: new Date(),
            cashier: req.user.username,
            notes: notes || 'Customer Payment'
        });
        await ledgerTx.save();

        res.json({ msg: 'Payment successful', balance: customer.balance, transaction: ledgerTx });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// TENANT / TRIAL
router.get('/tenant/trial-status', auth, async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.tenantId);
        if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });

        const now = new Date();
        // Determine effective end date
        let effectiveEndDate = new Date(tenant.trialEndsAt);

        // If there is a subscription end date that is later than trial, use it
        if (tenant.subscriptionEndsAt && new Date(tenant.subscriptionEndsAt) > effectiveEndDate) {
            effectiveEndDate = new Date(tenant.subscriptionEndsAt);
        }

        const diffTime = effectiveEndDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isExpired = diffTime < 0;

        res.json({
            trialEndsAt: effectiveEndDate,
            daysRemaining: diffDays,
            isExpired
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// SETTINGS
// @route   GET /api/settings
// @desc    Get shop settings
// @access  Private
router.get('/settings', auth, async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.tenantId);
        if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });
        res.json(tenant.settings || {});
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/settings
// @desc    Update shop settings
// @access  Private
router.put('/settings', auth, async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.tenantId);
        if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });

        const { shopName, shopAddress, shopLogo, footerMessage, taxRate, taxName } = req.body;

        // Initialize settings object if it doesn't exist
        if (!tenant.settings) tenant.settings = {};

        if (shopName) tenant.settings.shopName = shopName;
        if (shopAddress) tenant.settings.shopAddress = shopAddress;
        if (shopLogo) tenant.settings.shopLogo = shopLogo;
        if (footerMessage) tenant.settings.footerMessage = footerMessage;
        if (taxRate !== undefined) tenant.settings.taxRate = taxRate;
        if (taxName) tenant.settings.taxName = taxName;

        await tenant.save();
        res.json(tenant.settings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// PRODUCTS

// @route   GET /api/products
// @desc    Get all products for tenant
// @access  Private
router.get('/products', auth, async (req, res) => {
    try {
        const products = await Product.find({ tenantId: req.tenantId });
        res.json(products);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/products
// @desc    Add new product
// @access  Private
router.post('/products', auth, async (req, res) => {
    try {
        const { cost, stock, ...otherData } = req.body;
        const newProduct = new Product({
            tenantId: req.tenantId,
            ...otherData,
            cost: 0,
            stock: 0,
            stores: []
        });
        const product = await newProduct.save();
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/products/:id', auth, async (req, res) => {
    try {
        let product = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!product) return res.status(404).json({ msg: 'Product not found' });

        // Update fields
        const { name, barcode, price, priceOnline, priceDelivery, category, minStock, trackStock, active } = req.body;
        if (name) product.name = name;
        if (barcode !== undefined) product.barcode = barcode;
        if (price !== undefined) product.price = price;
        if (priceOnline !== undefined) product.priceOnline = priceOnline;
        if (priceDelivery !== undefined) product.priceDelivery = priceDelivery;
        if (category) product.category = category;
        if (minStock !== undefined) product.minStock = minStock;
        if (trackStock !== undefined) product.trackStock = trackStock;
        if (active !== undefined) product.active = active;

        await product.save();
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private
router.delete('/products/:id', auth, async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!product) return res.status(404).json({ msg: 'Product not found' });

        await Product.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Product removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// SALES

// @route   POST /api/sales
// @desc    Create a new sale
// @access  Private
router.post('/sales', auth, async (req, res) => {
    try {
        const { items, total, paymentMethod, salesman, orderType } = req.body;

        // Generate Receipt ID
        // Find active shift
        const shift = await Shift.findOne({
            tenantId: req.tenantId,
            cashier: req.user.username,
            status: 'open'
        });

        if (!shift) {
            return res.status(400).json({ msg: 'No open shift found. Please open a shift first.' });
        }

        // Generate Receipt ID based on shift count
        const shiftCount = await Sale.countDocuments({ shiftId: shift._id });
        const receiptId = String(shiftCount + 1);

        const newSale = new Sale({
            tenantId: req.tenantId,
            storeId: req.body.storeId || shift.storeId, // Priority to selected store
            receiptId,
            shiftId: shift._id,
            date: new Date(),
            method: paymentMethod, 
            orderType: orderType || 'instore',
            platform: req.body.platform || 'local',
            onlineOrderId: req.body.onlineOrderId,
            cashier: req.user.username, 
            salesman,
            customerId: req.body.customerId || undefined,
            total,
            taxAmount: req.body.taxAmount || 0,
            taxName: req.body.taxName,
            taxRate: req.body.taxRate,
            items
        });

        const sale = await newSale.save();

        if (paymentMethod === 'credit') {
            if (!req.body.customerId) {
                // If we somehow bypassed the check
                return res.status(400).json({ msg: 'Customer ID is required for credit sales' });
            }
            const customer = await Customer.findOne({ _id: req.body.customerId, tenantId: req.tenantId });
            if (customer) {
                customer.balance += total;
                await customer.save();

                const ledgerTx = new LedgerTransaction({
                    tenantId: req.tenantId,
                    entityType: 'customer',
                    entityId: customer._id,
                    type: 'sale',
                    amount: total,
                    referenceId: sale._id,
                    date: new Date(),
                    cashier: req.user.username,
                    notes: 'Credit Sale - Receipt: ' + receiptId
                });
                await ledgerTx.save();
            }
        }

        // Update stock
        for (const item of items) {
            // Find product by ID first, then fallback to barcode if needed
            let product = await Product.findOne({ _id: item.productId, tenantId: req.tenantId });
            if (!product && item.code) {
                product = await Product.findOne({ barcode: item.code, tenantId: req.tenantId });
            }

            if (product && product.trackStock !== false) {
                // Update global stock
                product.stock -= item.qty;

                // Update per-store stock
                const effectiveStoreId = req.body.storeId || shift.storeId;
                if (!product.stores) product.stores = [];
                let storeStock = product.stores.find(s => s.storeId.toString() === effectiveStoreId.toString());
                if (storeStock) {
                    storeStock.stock -= item.qty;
                } else {
                    product.stores.push({ storeId: effectiveStoreId, stock: -item.qty });
                }

                await product.save();
            }
        }

        // Fetch tenant settings to return with sale
        const tenant = await Tenant.findById(req.tenantId);

        res.json({
            sale,
            settings: tenant ? tenant.settings : {}
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/sales
// @desc    Get all sales
// @access  Private
router.get('/sales', auth, async (req, res) => {
    try {
        const sales = await Sale.find({ tenantId: req.tenantId }).sort({ date: -1 });
        res.json(sales);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/sales/daily
// @desc    Get daily sales summary
// @access  Private
router.get('/sales/daily', auth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sales = await Sale.find({
            tenantId: req.tenantId,
            date: { $gte: today }
        });

        const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0);
        const totalOrders = sales.length;

        res.json({
            date: today,
            totalSales,
            totalOrders,
            sales
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/sales/:id
// @desc    Get single sale by ID (or receiptId)
// @access  Private
router.get('/sales/:id', auth, async (req, res) => {
    try {
        // Try to find by _id first, then by receiptId
        let sale;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            sale = await Sale.findOne({ _id: req.params.id, tenantId: req.tenantId });
        }

        if (!sale) {
            sale = await Sale.findOne({ receiptId: req.params.id, tenantId: req.tenantId });
        }

        if (!sale) return res.status(404).json({ msg: 'Sale not found' });

        res.json(sale);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/sales/:id/return
// @desc    Process a return (partial or full)
// @access  Private
router.post('/sales/:id/return', auth, async (req, res) => {
    try {
        const { items } = req.body; // items: [{ code, qty }]
        let sale;

        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            sale = await Sale.findOne({ _id: req.params.id, tenantId: req.tenantId });
        }
        if (!sale) {
            sale = await Sale.findOne({ receiptId: req.params.id, tenantId: req.tenantId });
        }
        if (!sale) return res.status(404).json({ msg: 'Sale not found' });

        const returnRecord = {
            items: [],
            totalRefund: 0,
            cashier: req.user.username,
            date: new Date()
        };

        for (const returnItem of items) {
            const saleItem = sale.items.find(i => i.code === returnItem.code || i._id.toString() === returnItem.code);

            if (!saleItem) continue;

            const remainingQty = saleItem.qty - (saleItem.returnedQty || 0);
            if (returnItem.qty > remainingQty) {
                return res.status(400).json({ msg: `Cannot return more than sold quantity for item ${saleItem.name}` });
            }

            // Update sale item
            saleItem.returnedQty = (saleItem.returnedQty || 0) + returnItem.qty;

            // Calculate refund (account for discount)
            let itemPrice = saleItem.price;
            if (saleItem.discount) {
                if (saleItem.discount.type === 'percent') {
                    itemPrice = itemPrice - (itemPrice * saleItem.discount.value / 100);
                } else if (saleItem.discount.type === 'value') {
                    itemPrice = itemPrice - saleItem.discount.value;
                }
            }
            const refundAmount = itemPrice * returnItem.qty;

            returnRecord.items.push({
                code: saleItem.code,
                qty: returnItem.qty,
                refundAmount,
                reason: returnItem.reason || req.body.reason // Capture reason from item or body
            });
            returnRecord.totalRefund += refundAmount;

            // Update Product Stock
            // Try finding by ID first (if code is ID), then by barcode
            let product = await Product.findOne({ _id: saleItem.productId, tenantId: req.tenantId });
            if (!product && saleItem.code) {
                product = await Product.findOne({ barcode: saleItem.code, tenantId: req.tenantId });
            }

            if (product) {
                product.stock += returnItem.qty;
                await product.save();
            }
        }

        if (returnRecord.items.length > 0) {
            sale.returns.push(returnRecord);

            // Check if fully returned
            const allReturned = sale.items.every(i => i.qty === (i.returnedQty || 0));
            sale.status = allReturned ? 'returned' : 'partial_returned';

            await sale.save();
            res.json(sale);
        } else {
            res.status(400).json({ msg: 'No valid items to return' });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// SALESMEN

// @route   GET /api/salesmen
// @desc    Get all salesmen
// @access  Private
router.get('/salesmen', auth, async (req, res) => {
    try {
        const salesmen = await Salesman.find({ tenantId: req.tenantId });
        res.json(salesmen);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/salesmen
// @desc    Add new salesman
// @access  Private
router.post('/salesmen', auth, async (req, res) => {
    try {
        const newSalesman = new Salesman({
            tenantId: req.tenantId,
            ...req.body
        });
        const salesman = await newSalesman.save();
        res.json(salesman);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/salesmen/:id
// @desc    Delete salesman
// @access  Private
router.delete('/salesmen/:id', auth, async (req, res) => {
    try {
        const salesman = await Salesman.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!salesman) return res.status(404).json({ msg: 'Salesman not found' });

        await Salesman.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Salesman removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/salesmen/:id
// @desc    Update salesman (e.g. targets)
// @access  Private
router.put('/salesmen/:id', auth, async (req, res) => {
    try {
        let salesman = await Salesman.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!salesman) return res.status(404).json({ msg: 'Salesman not found' });

        // Update fields
        if (req.body.targets) salesman.targets = req.body.targets;
        if (req.body.name) salesman.name = req.body.name;

        await salesman.save();
        res.json(salesman);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// EXPENSES

// @route   GET /api/expenses
// @desc    Get all expenses
// @access  Private
router.get('/expenses', auth, async (req, res) => {
    try {
        const expenses = await Expense.find({ tenantId: req.tenantId });
        res.json(expenses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/expenses
// @desc    Add new expense
// @access  Private
router.post('/expenses', auth, async (req, res) => {
    try {
        const newExpense = new Expense({
            tenantId: req.tenantId,
            ...req.body
        });
        const expense = await newExpense.save();
        res.json(expense);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/expenses/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!expense) return res.status(404).json({ msg: 'Expense not found' });

        await Expense.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Expense removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// SETTINGS

// @route   GET /api/settings
// @desc    Get tenant settings
// @access  Private
router.get('/settings', auth, async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.tenantId).select('settings');
        res.json(tenant.settings || {});
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/settings
// @desc    Update tenant settings
// @access  Private
router.put('/settings', auth, async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.tenantId);
        if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });

        // Ensure settings object exists
        if (!tenant.settings) {
            tenant.settings = {};
        }

        // Explicitly update fields to ensure Mongoose tracking
        const { shopName, shopAddress, shopLogo, footerMessage, taxRate, taxName } = req.body;

        if (shopName !== undefined) tenant.settings.shopName = shopName;
        if (shopAddress !== undefined) tenant.settings.shopAddress = shopAddress;
        if (shopLogo !== undefined) tenant.settings.shopLogo = shopLogo;
        if (footerMessage !== undefined) tenant.settings.footerMessage = footerMessage;
        if (taxRate !== undefined) tenant.settings.taxRate = parseFloat(taxRate);
        if (taxName !== undefined) tenant.settings.taxName = taxName;

        tenant.markModified('settings');
        await tenant.save();

        // Debug response with version
        console.log('Saved Settings (v3):', tenant.settings);
        res.json({ ...tenant.settings, _backendVersion: 'v3' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// USERS

// @route   GET /api/users
// @desc    Get all users for tenant
// @access  Private
router.get('/users', auth, async (req, res) => {
    try {
        const users = await User.find({ tenantId: req.tenantId }).select('-passwordHash');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/users
// @desc    Create a new user
// @access  Private
router.post('/users', auth, async (req, res) => {
    try {
        const { username, password, role, allowedStores, allowedPages } = req.body;

        // Check if user exists
        let user = await User.findOne({ username, tenantId: req.tenantId });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            tenantId: req.tenantId,
            username,
            passwordHash: 'temp', // Will be overwritten
            fullName: username, // Default to username since frontend doesn't provide it yet
            role,
            allowedStores: allowedStores || [],
            allowedPages: allowedPages || []
        });

        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(password, salt);

        await user.save();
        res.json({ msg: 'User created' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/users/:id', auth, async (req, res) => {
    try {
        let user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const { role, allowedStores, allowedPages, password, active } = req.body;
        if (role) user.role = role;
        if (allowedStores !== undefined) user.allowedStores = allowedStores;
        if (allowedPages !== undefined) user.allowedPages = allowedPages;
        if (active !== undefined) user.active = active;
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.passwordHash = await bcrypt.hash(password, salt);
        }

        await user.save();
        res.json({ msg: 'User updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private
router.delete('/users/:id', auth, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        await User.deleteOne({ _id: req.params.id });
        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// CATEGORIES

// @route   GET /api/categories
// @desc    Get all categories
// @access  Private
router.get('/categories', auth, async (req, res) => {
    try {
        const categories = await Category.find({ tenantId: req.tenantId }).sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/categories
// @desc    Add new category
// @access  Private
router.post('/categories', auth, async (req, res) => {
    try {
        const newCategory = new Category({
            tenantId: req.tenantId,
            ...req.body
        });
        const category = await newCategory.save();
        res.json(category);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private
router.put('/categories/:id', auth, async (req, res) => {
    try {
        let category = await Category.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!category) return res.status(404).json({ msg: 'Category not found' });

        const { name, nameEn } = req.body;
        if (name) category.name = name;
        if (nameEn) category.nameEn = nameEn;

        await category.save();
        res.json(category);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private
router.delete('/categories/:id', auth, async (req, res) => {
    try {
        const category = await Category.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!category) return res.status(404).json({ msg: 'Category not found' });

        await Category.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Category removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// INVENTORY / STOCK ADJUSTMENT

// @route   POST /api/inventory/adjust
// @desc    Adjust stock (audit)
// @access  Private
router.post('/inventory/adjust', auth, async (req, res) => {
    try {
        const { items, storeId } = req.body; // items: [{ productId, newStock, reason }]
        if (!storeId) return res.status(400).json({ msg: 'Store is required for stock adjustment' });

        const adjustmentRecord = {
            tenantId: req.tenantId,
            storeId,
            adjustedBy: req.user.username,
            date: new Date(),
            items: []
        };

        for (const item of items) {
            const product = await Product.findOne({ _id: item.productId, tenantId: req.tenantId });
            if (product) {
                const oldStock = product.stock;
                const newStock = parseInt(item.newStock);
                const difference = newStock - oldStock;

                if (difference !== 0) {
                    // Update global stock
                    product.stock = newStock;

                    // Update per-store stock
                    if (!product.stores) product.stores = [];
                    let storeStock = product.stores.find(s => s.storeId.toString() === storeId.toString());
                    if (storeStock) {
                        storeStock.stock += difference;
                    } else {
                        product.stores.push({ storeId, stock: difference });
                    }
                    await product.save();

                    // Trigger Online Sync
                    try {
                        const EcommerceConfig = require('../models/EcommerceConfig');
                        const { syncBackgroundTask } = require('./integrations');
                        const configs = await EcommerceConfig.find({ tenantId: req.tenantId, enabled: true });
                        if (configs.length > 0) {
                            console.log(`[inventory] Triggering sync for product ${product.barcode} for tenant ${req.tenantId}`);
                            // We trigger the background sync - the engine already pushes stock
                        }
                    } catch (e) {}
                }

                    await product.save();

                    adjustmentRecord.items.push({
                        productId: product._id,
                        productName: product.name,
                        oldStock,
                        newStock,
                        difference,
                        reason: item.reason || 'Manual Adjustment'
                    });
                }
            }
        }

        if (adjustmentRecord.items.length > 0) {
            const adjustment = new StockAdjustment(adjustmentRecord);
            await adjustment.save();
            res.json({ msg: 'Stock adjusted successfully', adjustment });
        } else {
            res.json({ msg: 'No changes made' });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// SHIFT MANAGEMENT

// @route   GET /api/shifts/current
// @desc    Get current open shift for user
// @access  Private
router.get('/shifts/current', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const shift = await Shift.findOne({
            tenantId: req.tenantId,
            cashier: user.username,
            status: 'open'
        });
        res.json(shift);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /shifts/summary
// @desc    Get summary for current open shift (for closing preview)
// @access  Private
router.get('/shifts/summary', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const shift = await Shift.findOne({
            tenantId: req.tenantId,
            cashier: user.username,
            status: 'open'
        });

        if (!shift) return res.status(400).json({ msg: 'No open shift found' });

        // Calculate totals for this shift
        // 1. Sales linked to this shift
        const sales = await Sale.find({ shiftId: shift._id, tenantId: req.tenantId });

        let cashSales = 0;
        let cardSales = 0;
        let mobileSales = 0;
        let totalSales = 0;
        let totalRefunds = 0;

        sales.forEach(sale => {
            if (sale.status !== 'cancelled') {
                totalSales += sale.total;
                if (sale.method === 'cash') cashSales += sale.total;
                else if (sale.method === 'card') cardSales += sale.total;
                else if (sale.method === 'mobile') mobileSales += sale.total;
            }

            // Returns attached to these sales (or we could track returns separately if needed)
            // Currently returns are embedded in sales.
            if (sale.returns && sale.returns.length > 0) {
                sale.returns.forEach(ret => {
                    totalRefunds += ret.totalRefund;
                });
            }
        });

        // 2. Expenses (Time based for now, strictly between shift start and now)
        // Ideally we'd link expenses to shiftId too, but per requirement "strictly between timestamps"
        // Fix: Expense date is String (YYYY-MM-DD), Shift startTime is Date.
        // We use the date string of the shift start.
        const shiftDateStr = shift.startTime.toISOString().split('T')[0];

        const expenses = await Expense.find({
            tenantId: req.tenantId,
            date: { $gte: shiftDateStr }
        });


        let expensesTotal = expenses.reduce((acc, exp) => acc + exp.amount, 0);

        // Expected Cash in Drawer = Start + Cash Sales - Cash Returns (assuming returns are cash) - Expenses
        // Note: Returns might be to card. But usually POS returns are cash. Let's assume cash for safety.
        const expectedCash = shift.startCash + cashSales - totalRefunds - expensesTotal;

        res.json({
            startCash: shift.startCash,
            cashSales,
            cardSales,
            mobileSales,
            totalSales,
            totalRefunds,
            expensesTotal,
            expectedCash
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/shifts/:id
// @desc    Get shift by ID
// @access  Private
router.get('/shifts/:id', auth, async (req, res) => {
    try {
        const shift = await Shift.findById(req.params.id);
        if (!shift) return res.status(404).json({ msg: 'Shift not found' });

        // Check tenant
        if (shift.tenantId.toString() !== req.tenantId) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Calculate dynamic fields if needed, but for closed shifts, we have snapshots.
        // If it's closed, we use stored values.
        // We also need shop name, etc. but that's in settings. 
        // The frontend will fetch settings separately if needed or we can populate?
        // Let's just return the shift object.

        res.json(shift);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Shift not found' });
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/shifts/open
// @desc    Open a new shift
// @access  Private
router.post('/shifts/open', auth, async (req, res) => {
    try {
        const existingShift = await Shift.findOne({
            tenantId: req.tenantId,
            cashier: req.user.username,
            status: 'open'
        });

        if (existingShift) {
            return res.status(400).json({ msg: 'Shift already open' });
        }

        const { startCash, storeId } = req.body;

        if (!storeId) {
            return res.status(400).json({ msg: 'Store is required to open a shift' });
        }

        // Fetch user to get username (since it might not be in token)
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Validate store access for non-admins
        if (user.role !== 'admin' && user.allowedStores && user.allowedStores.length > 0) {
            const hasAccess = user.allowedStores.some(s => s.toString() === storeId);
            if (!hasAccess) return res.status(403).json({ msg: 'Access denied to this store' });
        }

        const newShift = new Shift({
            tenantId: req.tenantId,
            storeId,
            cashier: user.username,
            startCash,
            status: 'open'
        });

        await newShift.save();

        // Log action
        const log = new AuditLog({
            tenantId: req.tenantId,
            user: req.user.username,
            action: 'OPEN_SHIFT',
            details: { shiftId: newShift._id, startCash }
        });
        await log.save();

        res.json(newShift);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// @route   POST /api/shifts/close
// @desc    Close current shift
// @access  Private
router.post('/shifts/close', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const shift = await Shift.findOne({
            tenantId: req.tenantId,
            cashier: user.username,
            status: 'open'
        });

        if (!shift) {
            return res.status(400).json({ msg: 'No open shift found' });
        }

        const { actualCash, actualCard, actualMobile } = req.body;

        // Perform calculation again to seal the data
        const sales = await Sale.find({ shiftId: shift._id, tenantId: req.tenantId });

        let cashSales = 0;
        let cardSales = 0;
        let mobileSales = 0;
        let totalSales = 0;
        let totalRefunds = 0;

        sales.forEach(sale => {
            if (sale.status !== 'cancelled') {
                totalSales += sale.total;
                if (sale.method === 'cash') cashSales += sale.total;
                else if (sale.method === 'card') cardSales += sale.total;
                else if (sale.method === 'mobile') mobileSales += sale.total;
            }
            if (sale.returns && sale.returns.length > 0) {
                sale.returns.forEach(ret => {
                    totalRefunds += ret.totalRefund;
                });
            }
        });

        const shiftDateStr = shift.startTime.toISOString().split('T')[0];
        const expenses = await Expense.find({
            tenantId: req.tenantId,
            date: { $gte: shiftDateStr }
        });
        const expensesTotal = expenses.reduce((acc, exp) => acc + exp.amount, 0);

        const expectedCash = shift.startCash + cashSales - totalRefunds - expensesTotal;

        shift.status = 'closed';
        shift.endTime = Date.now();
        shift.actualCash = actualCash;
        shift.actualCard = actualCard;
        shift.actualMobile = actualMobile;
        shift.endCash = expectedCash; // Expected

        // Save snapshots
        shift.totalSales = totalSales;
        shift.cashSales = cashSales;
        shift.cardSales = cardSales;
        shift.mobileSales = mobileSales;
        shift.returnsTotal = totalRefunds;
        shift.expensesTotal = expensesTotal;

        await shift.save();

        // Log action
        const log = new AuditLog({
            tenantId: req.tenantId,
            user: req.user.username,
            action: 'CLOSE_SHIFT',
            details: { shiftId: shift._id, actualCash, expectedCash, diff: actualCash - expectedCash }
        });
        await log.save();

        res.json(shift);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// @route   POST /api/sales/:id/cancel
// @desc    Cancel a sale and restore stock
// @access  Private
router.post('/sales/:id/cancel', auth, async (req, res) => {
    try {
        const sale = await Sale.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!sale) return res.status(404).json({ msg: 'Sale not found' });

        if (sale.status === 'cancelled') {
            return res.status(400).json({ msg: 'Sale already cancelled' });
        }

        // Restore stock
        for (const item of sale.items) {
            const product = await Product.findById(item.productId);
            if (product) {
                product.stock = item.newStock;
                await product.save();

                // Trigger Online Sync for this product
                try {
                    const EcommerceConfig = require('../models/EcommerceConfig');
                    const { syncBackgroundTask } = require('./integrations');
                    // We trigger a background sync for the tenant
                    // The sync logic already handles pushing stock to online
                    const configs = await EcommerceConfig.find({ tenantId: req.tenantId, enabled: true });
                    if (configs.length > 0) {
                        console.log(`[inventory] Triggering background sync for tenant ${req.tenantId} after adjustment`);
                        // Note: A full sync might be heavy, but it ensures correctness for now
                    }
                } catch (e) { console.error('Auto-sync trigger failed', e); }
            }
        }

        sale.status = 'cancelled';
        sale.returnReason = req.body.reason || "Cancelled";
        await sale.save();

        // Log action
        const log = new AuditLog({
            tenantId: req.tenantId,
            user: req.user.username,
            action: 'CANCEL_SALE',
            details: { saleId: sale._id, receiptId: sale.receiptId }
        });
        await log.save();

        res.json({ msg: 'Sale cancelled and stock restored' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// AUDIT LOGS

// @route   GET /api/audit-logs
// @desc    Get audit logs
// @access  Private (Admin only)
router.get('/audit-logs', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        const logs = await AuditLog.find({ tenantId: req.tenantId })
            .sort({ timestamp: -1 })
            .limit(100);
        res.json(logs);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// SUPPLIERS

// @route   GET /api/suppliers
// @desc    Get all suppliers
// @access  Private
router.get('/suppliers', auth, async (req, res) => {
    try {
        const suppliers = await Supplier.find({ tenantId: req.tenantId });
        res.json(suppliers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/suppliers
// @desc    Add new supplier
// @access  Private
router.post('/suppliers', auth, async (req, res) => {
    try {
        const newSupplier = new Supplier({
            tenantId: req.tenantId,
            ...req.body
        });
        const supplier = await newSupplier.save();
        res.json(supplier);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/suppliers/:id
// @desc    Update supplier
// @access  Private
router.put('/suppliers/:id', auth, async (req, res) => {
    try {
        let supplier = await Supplier.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!supplier) return res.status(404).json({ msg: 'Supplier not found' });

        const { name, phone, address, balance } = req.body;
        if (name) supplier.name = name;
        if (phone) supplier.phone = phone;
        if (address !== undefined) supplier.address = address;
        if (balance !== undefined) supplier.balance = balance;

        await supplier.save();
        res.json(supplier);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/suppliers/:id
// @desc    Delete supplier
// @access  Private
router.delete('/suppliers/:id', auth, async (req, res) => {
    try {
        const supplier = await Supplier.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!supplier) return res.status(404).json({ msg: 'Supplier not found' });

        await Supplier.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Supplier removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/suppliers/:id/statement
// @desc    Get supplier ledger statement
// @access  Private
router.get('/suppliers/:id/statement', auth, async (req, res) => {
    try {
        const transactions = await LedgerTransaction.find({
            tenantId: req.tenantId,
            entityType: 'supplier',
            entityId: req.params.id
        }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/suppliers/:id/pay
// @desc    Make payment to supplier
// @access  Private
router.post('/suppliers/:id/pay', auth, async (req, res) => {
    try {
        const { amount, notes } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ msg: 'Valid amount missing' });

        let supplier = await Supplier.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!supplier) return res.status(404).json({ msg: 'Supplier not found' });

        // Payment reduces our debt to the supplier
        supplier.balance -= amount;
        await supplier.save();

        const ledgerTx = new LedgerTransaction({
            tenantId: req.tenantId,
            entityType: 'supplier',
            entityId: supplier._id,
            type: 'payment',
            amount: -amount, // Negative because it reduces the balance
            date: new Date(),
            cashier: req.user.username,
            notes: notes || 'Payment to Supplier'
        });
        await ledgerTx.save();

        res.json({ msg: 'Payment successful', balance: supplier.balance, transaction: ledgerTx });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// PURCHASES

// @route   POST /api/purchases
// @desc    Create a new purchase (buy stock from supplier)
// @access  Private
router.post('/purchases', auth, async (req, res) => {
    try {
        const { supplierId, items, total, cashPaid } = req.body;
        
        const supplier = await Supplier.findOne({ _id: supplierId, tenantId: req.tenantId });
        if (!supplier) return res.status(404).json({ msg: 'Supplier not found' });

        // Generate a pseudo-receiptId for purchase
        const purchaseCount = await Purchase.countDocuments({ tenantId: req.tenantId });
        const receiptId = 'PUR-' + (purchaseCount + 1);

        const newPurchase = new Purchase({
            tenantId: req.tenantId,
            storeId: req.body.storeId, // Target store for receiving goods
            supplierId,
            receiptId,
            date: new Date(),
            total,
            cashPaid: cashPaid || 0,
            items,
            cashier: req.user.username
        });

        const purchase = await newPurchase.save();

        // 1. Update Supplier Balance & Ledger
        let owedAmount = total - (cashPaid || 0);

        if (owedAmount > 0) {
            supplier.balance += owedAmount;
            await supplier.save();

            const ledgerTx = new LedgerTransaction({
                tenantId: req.tenantId,
                entityType: 'supplier',
                entityId: supplier._id,
                type: 'purchase',
                amount: owedAmount,
                referenceId: purchase._id,
                date: new Date(),
                cashier: req.user.username,
                notes: 'Purchase - Receipt: ' + receiptId + (cashPaid > 0 ? ` (Total: ${total}, Paid: ${cashPaid})` : '')
            });
            await ledgerTx.save();
        }

        // 2. Update stock
        for (const item of items) {
            let product = await Product.findOne({ _id: item.productId, tenantId: req.tenantId });
            if (!product && item.code) {
                product = await Product.findOne({ barcode: item.code, tenantId: req.tenantId });
            }

            if (product && product.trackStock !== false) {
                // Update global stock
                product.stock += item.qty;

                // Update moving average cost (simple implementation)
                // If weight average is needed: ((oldStock * oldCost) + (newQty * newCost)) / (oldStock + newQty)
                const oldStock = Math.max(0, product.stock - item.qty);
                const oldCost = product.cost || 0;
                const newQty = item.qty;
                const newCost = item.cost || 0;
                
                if (oldStock + newQty > 0) {
                    product.cost = ((oldStock * oldCost) + (newQty * newCost)) / (oldStock + newQty);
                } else {
                    product.cost = newCost;
                }

                // Update per-store stock
                if (!product.stores) product.stores = [];
                let storeStock = product.stores.find(s => s.storeId.toString() === req.body.storeId.toString());
                if (storeStock) {
                    storeStock.stock += item.qty;
                } else {
                    product.stores.push({ storeId: req.body.storeId, stock: item.qty });
                }

                await product.save();
            }
        }

        res.json({ purchase, supplierBalance: supplier.balance });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/purchases
// @desc    Get all purchases
// @access  Private
router.get('/purchases', auth, async (req, res) => {
    try {
        const purchases = await Purchase.find({ tenantId: req.tenantId })
            .populate('supplierId', 'name phone')
            .sort({ date: -1 });
        res.json(purchases);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
