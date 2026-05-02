/**
 * E-Commerce Integration Routes
 * Base path: /api/integrations
 *
 * Endpoints:
 *   GET    /api/integrations                        - List all platform configs for tenant
 *   GET    /api/integrations/:platform              - Get single platform config (no secrets)
 *   POST   /api/integrations/:platform/connect      - Save credentials & test connection
 *   DELETE /api/integrations/:platform              - Disconnect platform
 *   POST   /api/integrations/:platform/sync         - Manual sync (pull orders + push products)
 *   GET    /api/integrations/orders/pending         - Get all pending online orders
 *   GET    /api/integrations/orders/:id             - Get single online order
 *   POST   /api/integrations/orders/:id/accept      - Accept pending order → creates Sale
 *   POST   /api/integrations/orders/:id/reject      - Reject pending order
 *   POST   /api/integrations/woocommerce/webhook    - WooCommerce webhook receiver
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const EcommerceConfig = require('../models/EcommerceConfig');
const OnlineOrder = require('../models/OnlineOrder');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Shift = require('../models/Shift');
const Customer = require('../models/Customer');
const LedgerTransaction = require('../models/LedgerTransaction');
const WooCommerceConnector = require('../integrations/woocommerce');
const JumiaConnector = require('../integrations/jumia');
const AmazonConnector = require('../integrations/amazon');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getConnector(platform, config) {
    switch (platform) {
        case 'woocommerce': return new WooCommerceConnector(config.woocommerce || {});
        case 'jumia': return new JumiaConnector(config.jumia || {});
        case 'amazon': return new AmazonConnector(config.amazon || {});
        default: throw new Error(`Unknown platform: ${platform}`);
    }
}

/** Strip sensitive fields from config before sending to frontend */
function sanitizeConfig(config) {
    const obj = config.toObject ? config.toObject() : { ...config };
    if (obj.woocommerce) {
        delete obj.woocommerce.consumerKey;
        delete obj.woocommerce.consumerSecret;
        delete obj.woocommerce.webhookSecret;
    }
    if (obj.jumia) delete obj.jumia.apiKey;
    if (obj.amazon) {
        delete obj.amazon.clientSecret;
        delete obj.amazon.refreshToken;
    }
    return obj;
}

/** Try to match platform items to POS products by SKU/barcode */
async function linkItemsToProducts(tenantId, items) {
    const linked = [];
    for (const item of items) {
        let product = null;
        if (item.sku) {
            product = await Product.findOne({ tenantId, barcode: item.sku });
        }
        if (!product) {
            // Fallback: Try matching by Name if SKU fails
            product = await Product.findOne({ tenantId, name: new RegExp(`^${item.name}$`, 'i') });
        }
        linked.push({ ...item, productId: product?._id || null });
    }
    return linked;
}

// ─────────────────────────────────────────────
// PLATFORM CONFIG ROUTES
// ─────────────────────────────────────────────

/**
 * GET /api/integrations
 * List all platform configs (without secrets)
 */
router.get('/', auth, async (req, res) => {
    try {
        const configs = await EcommerceConfig.find({ tenantId: req.tenantId });
        res.json(configs.map(sanitizeConfig));
    } catch (err) {
        console.error('[integrations] GET /', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * GET /api/integrations/:platform
 * Get single platform config (no secrets)
 */
router.get('/:platform', auth, async (req, res) => {
    try {
        const { platform } = req.params;
        const config = await EcommerceConfig.findOne({ tenantId: req.tenantId, platform });
        if (!config) return res.json({ platform, enabled: false });
        res.json(sanitizeConfig(config));
    } catch (err) {
        console.error('[integrations] GET /:platform', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * POST /api/integrations/:platform/connect
 * Save credentials and test connection
 * Body for woocommerce: { siteUrl, consumerKey, consumerSecret, syncSettings }
 * Body for jumia:       { apiKey, userId, syncSettings }
 * Body for amazon:      { sellerId, clientId, clientSecret, refreshToken, syncSettings }
 */
router.post('/:platform/connect', auth, async (req, res) => {
    try {
        const { platform } = req.params;
        const { syncSettings, ...credentials } = req.body;

        // Find or create config
        let config = await EcommerceConfig.findOne({ tenantId: req.tenantId, platform });
        if (!config) {
            config = new EcommerceConfig({ tenantId: req.tenantId, platform });
        }

        // Update credentials
        if (platform === 'woocommerce') {
            config.woocommerce = {
                siteUrl: credentials.siteUrl,
                consumerKey: credentials.consumerKey,
                consumerSecret: credentials.consumerSecret,
                webhookSecret: credentials.webhookSecret || config.woocommerce?.webhookSecret
            };
        } else if (platform === 'jumia') {
            config.jumia = {
                apiKey: credentials.apiKey,
                userId: credentials.userId,
                apiUrl: credentials.apiUrl || 'https://sellercenter.jumia.com.eg'
            };
        } else if (platform === 'amazon') {
            config.amazon = {
                sellerId: credentials.sellerId,
                marketplaceId: credentials.marketplaceId || 'A1I7FNSA0GEFN2',
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                refreshToken: credentials.refreshToken,
                region: credentials.region || 'eu-west-1'
            };
        } else {
            return res.status(400).json({ msg: 'Invalid platform' });
        }

        if (syncSettings) {
            config.syncSettings = { ...config.syncSettings, ...syncSettings };
        }

        // Test connection
        const connector = getConnector(platform, config);
        const testResult = await connector.testConnection();

        config.enabled = true;
        config.lastSyncStatus = 'success';
        config.updatedAt = new Date();
        await config.save();

        res.json({
            msg: 'Connected successfully',
            testResult,
            config: sanitizeConfig(config)
        });
    } catch (err) {
        console.error(`[integrations] POST /${req.params.platform}/connect`, err.message);
        res.status(400).json({ msg: `Connection failed: ${err.message}` });
    }
});

/**
 * DELETE /api/integrations/:platform
 * Disconnect / remove platform
 */
router.delete('/:platform', auth, async (req, res) => {
    try {
        await EcommerceConfig.deleteOne({ tenantId: req.tenantId, platform: req.params.platform });
        res.json({ msg: `${req.params.platform} disconnected` });
    } catch (err) {
        console.error('[integrations] DELETE /:platform', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────
// SYNC ROUTES
// ─────────────────────────────────────────────

/**
 * POST /api/integrations/:platform/sync
 * Manual sync: pull new orders from platform + push products
 */
router.post('/:platform/sync', auth, async (req, res) => {
    const { platform } = req.params;
    try {
        const config = await EcommerceConfig.findOne({ tenantId: req.tenantId, platform });
        if (!config || !config.enabled) {
            return res.status(400).json({ msg: `${platform} is not connected` });
        }

        const connector = getConnector(platform, config);
        
        // Start background sync
        syncBackgroundTask(req.tenantId, platform, config, connector);

        res.json({ msg: 'Synchronization started in background. Please refresh in a moment to see results.' });
    } catch (err) {
        console.error(`[integrations] POST /${platform}/sync`, err.message);
        res.status(500).json({ msg: `Sync error: ${err.message}` });
    }
});

/** 
 * Background Sync Implementation 
 * Handles Pull Orders, Pull Products, and Push Products without blocking the request
 */
async function syncBackgroundTask(tenantId, platform, config, connector) {
    const results = { ordersImported: 0, productsImported: 0, productsPushed: 0, errors: [] };
    
    try {
        console.log(`[sync] Starting background sync for tenant ${tenantId} on ${platform}`);

        // === PULL ORDERS ===
        if (config.syncSettings?.pullOrders !== false) {
            try {
                let rawOrders = [];

                if (platform === 'woocommerce') {
                    rawOrders = await connector.getOrders(config.lastSyncAt);
                } else if (platform === 'jumia') {
                    const response = await connector.getOrders('pending', config.lastSyncAt);
                    rawOrders = response?.SuccessResponse?.Body?.Orders?.Order || [];
                    if (!Array.isArray(rawOrders)) rawOrders = rawOrders ? [rawOrders] : [];
                } else if (platform === 'amazon') {
                    rawOrders = await connector.getOrders(config.lastSyncAt);
                }

                for (const rawOrder of rawOrders) {
                    try {
                        let normalized;
                        let items = [];

                        if (platform === 'woocommerce') {
                            normalized = WooCommerceConnector.normalizeOrder(rawOrder);
                        } else if (platform === 'jumia') {
                            // Fetch items for this Jumia order
                            try {
                                const itemsResp = await connector.getOrderItems(rawOrder.OrderId);
                                items = itemsResp?.SuccessResponse?.Body?.OrderItems?.OrderItem || [];
                                if (!Array.isArray(items)) items = items ? [items] : [];
                            } catch (e) { /* ignore item fetch errors */ }
                            normalized = JumiaConnector.normalizeOrder(rawOrder, items);
                        } else if (platform === 'amazon') {
                            // Fetch items for Amazon order
                            try {
                                items = await connector.getOrderItems(rawOrder.AmazonOrderId);
                            } catch (e) { /* ignore */ }
                            normalized = AmazonConnector.normalizeOrder(rawOrder, items);
                        }

                        // Link items to POS products
                        normalized.items = await linkItemsToProducts(req.tenantId, normalized.items);

                        // Upsert: avoid duplicate imports
                        const existing = await OnlineOrder.findOne({
                            tenantId: req.tenantId,
                            platform,
                            platformOrderId: normalized.platformOrderId
                        });

                        if (!existing) {
                            await OnlineOrder.create({ tenantId: req.tenantId, ...normalized });
                            results.ordersImported++;
                        }
                    } catch (e) {
                        results.errors.push(`Order import error: ${e.message}`);
                    }
                }
            } catch (e) {
                results.errors.push(`Pull orders error: ${e.message}`);
            }
        }

        // === PULL PRODUCTS (WooCommerce to POS) ===
        if (config.syncSettings?.pullProducts !== false && platform === 'woocommerce') {
            try {
                const wcProducts = await connector.getProducts();
                for (const wcP of wcProducts) {
                    try {
                        const sku = wcP.sku || String(wcP.id);
                        const existing = await Product.findOne({ tenantId: req.tenantId, barcode: sku });
                        
                        if (!existing) {
                            // Ensure Category exists
                            const catName = wcP.categories?.[0]?.name || 'Uncategorized';
                            let category = await Category.findOne({ tenantId: req.tenantId, name: catName });
                            if (!category) {
                                category = await Category.create({ tenantId: req.tenantId, name: catName });
                            }

                            // Create new product in POS
                            await Product.create({
                                tenantId: req.tenantId,
                                name: wcP.name,
                                nameEn: wcP.name,
                                barcode: sku,
                                price: parseFloat(wcP.regular_price) || 0,
                                priceOnline: parseFloat(wcP.regular_price) || 0,
                                stock: parseInt(wcP.stock_quantity) || 0,
                                category: catName,
                                categoryEn: catName,
                                imageUrl: wcP.images?.[0]?.src || '',
                                active: wcP.status === 'publish',
                                trackStock: wcP.manage_stock,
                                onlineActive: true
                            });
                            results.productsImported = (results.productsImported || 0) + 1;
                        }
                    } catch (e) {
                        results.errors.push(`Product pull error for "${wcP.name}": ${e.message}`);
                    }
                }
            } catch (e) {
                results.errors.push(`Pull products error: ${e.message}`);
            }
        }

        // === PUSH PRODUCTS (POS to WooCommerce) ===
        if (config.syncSettings?.pushProducts !== false && platform === 'woocommerce') {
            try {
                const products = await Product.find({ tenantId: req.tenantId, active: true });
                for (const product of products.slice(0, 50)) { // Limit batch size
                    try {
                        await connector.pushProduct(product);
                        results.productsPushed++;
                    } catch (e) {
                        results.errors.push(`Push product "${product.name}": ${e.message}`);
                    }
                }
            } catch (e) {
                results.errors.push(`Push products error: ${e.message}`);
            }
        }

        // Update config stats
        const finalConfig = await EcommerceConfig.findOne({ _id: config._id });
        finalConfig.lastSyncAt = new Date();
        finalConfig.lastSyncStatus = results.errors.length === 0 ? 'success' : 'error';
        if (results.errors.length) finalConfig.lastSyncError = results.errors[0];
        finalConfig.ordersImported = (finalConfig.ordersImported || 0) + results.ordersImported;
        finalConfig.productsImported = (finalConfig.productsImported || 0) + (results.productsImported || 0);
        finalConfig.productsPushed = (finalConfig.productsPushed || 0) + results.productsPushed;
        finalConfig.updatedAt = new Date();
        await finalConfig.save();
        console.log(`[sync] Background sync finished for tenant ${tenantId}`);
    } catch (err) {
        console.error(`[sync] Background sync fatal error:`, err.message);
        try {
           await EcommerceConfig.updateOne({ _id: config._id }, { 
               lastSyncStatus: 'error', 
               lastSyncError: `Fatal background error: ${err.message}` 
           });
        } catch (e) {}
    }
}

// ─────────────────────────────────────────────
// PENDING ORDERS ROUTES
// ─────────────────────────────────────────────

/**
 * GET /api/integrations/orders/pending
 * Get all pending online orders (shown in POS Pending Orders tab)
 */
router.get('/orders/pending', auth, async (req, res) => {
    try {
        const orders = await OnlineOrder.find({
            tenantId: req.tenantId,
            status: 'pending'
        }).sort({ createdAt: -1 }).limit(100);
        res.json(orders);
    } catch (err) {
        console.error('[integrations] GET /orders/pending', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * GET /api/integrations/orders
 * Get all online orders with filters
 */
router.get('/orders', auth, async (req, res) => {
    try {
        const { status, platform, limit = 50 } = req.query;
        const filter = { tenantId: req.tenantId };
        if (status) filter.status = status;
        if (platform) filter.platform = platform;

        const orders = await OnlineOrder.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        res.json(orders);
    } catch (err) {
        console.error('[integrations] GET /orders', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * GET /api/integrations/orders/:id
 */
router.get('/orders/:id', auth, async (req, res) => {
    try {
        const order = await OnlineOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!order) return res.status(404).json({ msg: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * POST /api/integrations/orders/:id/accept
 * Accept a pending online order → creates a POS Sale record
 * Body: { paymentMethod: 'cash'|'card'|'mobile'|'cod' }
 */
router.post('/orders/:id/accept', auth, async (req, res) => {
    try {
        const order = await OnlineOrder.findOne({ _id: req.params.id, tenantId: req.tenantId, status: 'pending' });
        if (!order) return res.status(404).json({ msg: 'Pending order not found' });

        const paymentMethod = req.body.paymentMethod || 'cash';

        // Find active shift
        const shift = await Shift.findOne({
            tenantId: req.tenantId,
            cashier: req.user.username,
            status: 'open'
        });

        if (!shift) {
            return res.status(400).json({ msg: 'No open shift. Please open a shift before accepting orders.' });
        }

        // Build sale items (deduct stock)
        const saleItems = [];
        for (const item of order.items) {
            const saleItem = {
                code: item.sku || (item.productId?.toString() || ''),
                name: item.name,
                qty: item.qty,
                price: item.price,
                productId: item.productId,
                discount: { type: 'none', value: 0 }
            };
            saleItems.push(saleItem);

            // Deduct stock
            if (item.productId) {
                const product = await Product.findOne({ _id: item.productId, tenantId: req.tenantId });
                if (product && product.trackStock !== false) {
                    product.stock = Math.max(0, product.stock - item.qty);

                    if (!product.stores) product.stores = [];
                    let storeStock = product.stores.find(s => s.storeId?.toString() === shift.storeId?.toString());
                    if (storeStock) {
                        storeStock.stock = Math.max(0, storeStock.stock - item.qty);
                    } else {
                        product.stores.push({ storeId: shift.storeId, stock: -item.qty });
                    }
                    await product.save();
                }
            }
        }

        // Generate receipt ID
        const shiftCount = await Sale.countDocuments({ shiftId: shift._id });
        const receiptId = `${order.platform.toUpperCase().slice(0, 2)}-${shiftCount + 1}`;

        // Create Sale
        const newSale = new Sale({
            tenantId: req.tenantId,
            storeId: shift.storeId,
            receiptId,
            shiftId: shift._id,
            date: new Date(),
            method: paymentMethod,
            orderType: 'online',
            cashier: req.user.username,
            total: order.total,
            items: saleItems
        });
        const sale = await newSale.save();

        // Update online order
        order.status = 'accepted';
        order.saleId = sale._id;
        order.acceptedBy = req.user.username;
        order.acceptedAt = new Date();
        order.updatedAt = new Date();
        await order.save();

        // Try to update status on the platform
        try {
            const config = await EcommerceConfig.findOne({ tenantId: req.tenantId, platform: order.platform });
            if (config?.enabled) {
                const connector = getConnector(order.platform, config);
                if (order.platform === 'woocommerce') {
                    await connector.updateOrderStatus(order.platformOrderId, 'processing');
                } else if (order.platform === 'jumia') {
                    const itemIds = order.items.map(i => i.platformItemId).filter(Boolean);
                    if (itemIds.length) await connector.confirmOrder(itemIds);
                }
                // Amazon: status update handled separately (fulfillment flow)
            }
        } catch (platformErr) {
            console.warn('[integrations] Platform status update failed (non-critical):', platformErr.message);
        }

        res.json({ msg: 'Order accepted and added to POS', sale, order });
    } catch (err) {
        console.error('[integrations] POST /orders/:id/accept', err.message);
        res.status(500).json({ msg: `Error accepting order: ${err.message}` });
    }
});

/**
 * POST /api/integrations/orders/:id/reject
 * Reject a pending order
 * Body: { reason: 'Out of stock' }
 */
router.post('/orders/:id/reject', auth, async (req, res) => {
    try {
        const order = await OnlineOrder.findOne({ _id: req.params.id, tenantId: req.tenantId, status: 'pending' });
        if (!order) return res.status(404).json({ msg: 'Pending order not found' });

        order.status = 'rejected';
        order.rejectedReason = req.body.reason || 'Rejected by cashier';
        order.updatedAt = new Date();
        await order.save();

        // Try to cancel on platform
        try {
            const config = await EcommerceConfig.findOne({ tenantId: req.tenantId, platform: order.platform });
            if (config?.enabled && order.platform === 'woocommerce') {
                const connector = getConnector(order.platform, config);
                await connector.updateOrderStatus(order.platformOrderId, 'cancelled');
            }
        } catch (platformErr) {
            console.warn('[integrations] Platform cancel failed (non-critical):', platformErr.message);
        }

        res.json({ msg: 'Order rejected', order });
    } catch (err) {
        console.error('[integrations] POST /orders/:id/reject', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────
// WOOCOMMERCE WEBHOOK
// ─────────────────────────────────────────────

/**
 * POST /api/integrations/woocommerce/webhook
 * Receives real-time order notifications from WooCommerce
 * WooCommerce sends a HMAC-SHA256 signature in X-WC-Webhook-Signature header
 */
router.post('/woocommerce/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const rawBody = req.body;
        const signature = req.headers['x-wc-webhook-signature'];
        const topic = req.headers['x-wc-webhook-topic'];
        const tenantId = req.query.tenantId; // Pass tenantId as query param when registering webhook

        if (!tenantId) {
            return res.status(400).json({ msg: 'tenantId query param required' });
        }

        // Find config and verify signature
        const config = await EcommerceConfig.findOne({ platform: 'woocommerce', tenantId });
        if (!config) return res.status(404).json({ msg: 'Config not found' });

        if (config.woocommerce?.webhookSecret && signature) {
            const crypto = require('crypto');
            const expectedSig = crypto
                .createHmac('sha256', config.woocommerce.webhookSecret)
                .update(rawBody)
                .digest('base64');
            if (expectedSig !== signature) {
                return res.status(401).json({ msg: 'Invalid webhook signature' });
            }
        }

        // Process order.created and order.updated topics
        if (topic === 'order.created' || topic === 'order.updated') {
            const wcOrder = JSON.parse(rawBody.toString());

            // Only import new orders in processing status
            if (wcOrder.status === 'processing' || wcOrder.status === 'pending') {
                const normalized = WooCommerceConnector.normalizeOrder(wcOrder);
                normalized.items = await linkItemsToProducts(tenantId, normalized.items);

                await OnlineOrder.findOneAndUpdate(
                    { tenantId, platform: 'woocommerce', platformOrderId: normalized.platformOrderId },
                    { $setOnInsert: { tenantId, ...normalized } },
                    { upsert: true, new: true }
                );
            }
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error('[integrations] WC webhook error:', err.message);
        res.status(500).json({ msg: 'Webhook processing error' });
    }
});

module.exports = router;
