/**
 * WooCommerce Integration Connector
 * Uses WooCommerce REST API v3 over HTTPS with Basic Auth
 * Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */
const https = require('https');
const http = require('http');

class WooCommerceConnector {
    constructor({ siteUrl, consumerKey, consumerSecret }) {
        this.siteUrl = (siteUrl || '').replace(/\/$/, ''); // Remove trailing slash
        this.consumerKey = consumerKey;
        this.consumerSecret = consumerSecret;
    }

    _getAuthHeader() {
        const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        return `Basic ${credentials}`;
    }

    async _request(method, path, body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.siteUrl}/wp-json/wc/v3${path}`);
            console.log(`[WC] ${method} ${url}`);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    'Authorization': this._getAuthHeader(),
                    'Content-Type': 'application/json',
                    'User-Agent': 'TashgheelPOS/1.0'
                }
            };

            const req = lib.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`WooCommerce API error ${res.statusCode}: ${parsed.message || data}`));
                        }
                    } catch (e) {
                        const snippet = data.slice(0, 100).replace(/</g, '&lt;');
                        reject(new Error(`WordPress returned HTML instead of JSON. This usually means Permalinks are disabled or a security plugin blocked the request. (Snippet: ${snippet}...)`));
                    }
                });
            });

            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    /**
     * Test the connection
     */
    async testConnection() {
        const result = await this._request('GET', '/system_status');
        return { success: true, store: result?.settings?.store_name || 'WooCommerce Store' };
    }

    /**
     * Get new/processing orders since a given date
     */
    async getOrders(after = null) {
        let path = '/orders?status=processing&per_page=50&orderby=date&order=desc';
        if (after) {
            path += `&after=${new Date(after).toISOString()}`;
        }
        return this._request('GET', path);
    }

    /**
     * Get all products from WooCommerce
     */
    async getProducts(page = 1) {
        return this._request('GET', `/products?per_page=100&page=${page}&status=publish`);
    }

    /**
     * Create or update a product in WooCommerce
     * Matches by SKU (barcode in POS)
     */
    async pushProduct(product) {
        const wcProduct = {
            name: product.nameEn || product.name,
            sku: product.barcode || String(product._id),
            regular_price: String(product.priceOnline || product.price),
            manage_stock: product.trackStock,
            stock_quantity: product.stock,
            status: (product.active && product.onlineActive !== false) ? 'publish' : 'private',
            categories: product.categoryEn ? [{ name: product.categoryEn }] : [],
            images: product.imageUrl ? [{ src: product.imageUrl }] : []
        };

        // Check if product exists by SKU
        const existing = await this._request('GET', `/products?sku=${wcProduct.sku}&per_page=1`).catch(() => []);
        if (existing && existing.length > 0) {
            return this._request('PUT', `/products/${existing[0].id}`, wcProduct);
        } else {
            return this._request('POST', '/products', wcProduct);
        }
    }

    /**
     * Update stock level for a WooCommerce product by SKU
     */
    async updateStock(sku, stockQuantity) {
        const existing = await this._request('GET', `/products?sku=${sku}&per_page=1`).catch(() => []);
        if (existing && existing.length > 0) {
            return this._request('PUT', `/products/${existing[0].id}`, {
                stock_quantity: stockQuantity,
                manage_stock: true
            });
        }
    }

    /**
     * Update order status in WooCommerce
     */
    async updateOrderStatus(orderId, status) {
        // WC statuses: pending, processing, on-hold, completed, cancelled, refunded
        return this._request('PUT', `/orders/${orderId}`, { status });
    }

    /**
     * Normalize a WooCommerce order to our OnlineOrder format
     */
    static normalizeOrder(wcOrder) {
        return {
            platform: 'woocommerce',
            platformOrderId: String(wcOrder.id),
            platformOrderNumber: wcOrder.number,
            customerName: `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim(),
            customerEmail: wcOrder.billing?.email || '',
            customerPhone: wcOrder.billing?.phone || '',
            shippingAddress: {
                line1: wcOrder.shipping?.address_1 || wcOrder.billing?.address_1 || '',
                line2: wcOrder.shipping?.address_2 || '',
                city: wcOrder.shipping?.city || wcOrder.billing?.city || '',
                country: wcOrder.shipping?.country || 'EG'
            },
            items: (wcOrder.line_items || []).map(item => ({
                platformItemId: String(item.id),
                sku: item.sku,
                name: item.name,
                qty: item.quantity,
                price: parseFloat(item.price) || 0
            })),
            subtotal: parseFloat(wcOrder.subtotal) || 0,
            shippingCost: parseFloat(wcOrder.shipping_total) || 0,
            discount: parseFloat(wcOrder.discount_total) || 0,
            total: parseFloat(wcOrder.total) || 0,
            currency: wcOrder.currency || 'EGP',
            paymentMethod: wcOrder.payment_method_title || '',
            paymentStatus: wcOrder.date_paid ? 'paid' : (wcOrder.payment_method === 'cod' ? 'cod' : 'pending'),
            notes: wcOrder.customer_note || '',
            platformCreatedAt: new Date(wcOrder.date_created)
        };
    }
}

module.exports = WooCommerceConnector;
