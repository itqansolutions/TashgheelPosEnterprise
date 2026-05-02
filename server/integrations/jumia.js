/**
 * Jumia Egypt Seller Center API Connector
 * API Docs: https://sellercenter.jumia.com.eg/api/docs/
 * Uses HMAC-SHA256 request signing
 */
const https = require('https');
const crypto = require('crypto');

class JumiaConnector {
    constructor(config) {
        this.apiUrl = config.apiUrl || 'https://sellercenter.jumia.com.eg';
        this.apiKey = config.apiKey;
        this.userId = config.userId; // Usually the email registered with Jumia
    }

    /**
     * Generate HMAC-SHA256 signature for Jumia API
     * Jumia signs: sorted query params concatenated
     */
    _buildSignedUrl(action, extraParams = {}) {
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const params = {
            Action: action,
            Format: 'JSON',
            Timestamp: timestamp,
            UserID: this.userId,
            Version: '1.0',
            ...extraParams
        };

        // Sort params alphabetically and build query string
        const sortedKeys = Object.keys(params).sort();
        const queryString = sortedKeys.map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

        // Generate HMAC signature
        const signature = crypto
            .createHmac('sha256', this.apiKey)
            .update(queryString)
            .digest('hex');

        return `${this.apiUrl}?${queryString}&Signature=${encodeURIComponent(signature)}`;
    }

    async _request(url) {
        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: { 'User-Agent': 'TashgheelPOS/1.0' }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.ErrorResponse) {
                            reject(new Error(`Jumia API Error: ${parsed.ErrorResponse.Head?.ErrorMessage || 'Unknown error'}`));
                        } else {
                            resolve(parsed);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse Jumia response: ${data.substring(0, 200)}`));
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Test the connection
     */
    async testConnection() {
        const url = this._buildSignedUrl('GetSystemStatus');
        const result = await this._request(url);
        return { success: true, message: result?.SuccessResponse?.Head?.RequestId ? 'Connected to Jumia Egypt' : 'Connected' };
    }

    /**
     * Get orders from Jumia
     * @param {string} status - 'pending', 'ready_to_ship', 'delivered', 'returned', 'shipped'
     * @param {Date} createdAfter
     */
    async getOrders(status = 'pending', createdAfter = null) {
        const params = { Status: status };
        if (createdAfter) {
            params.CreatedAfter = createdAfter.toISOString();
        }
        const url = this._buildSignedUrl('GetOrders', params);
        return this._request(url);
    }

    /**
     * Get order items for a given order
     */
    async getOrderItems(orderId) {
        const url = this._buildSignedUrl('GetOrderItems', { OrderId: orderId });
        return this._request(url);
    }

    /**
     * Update a product's price and stock on Jumia
     */
    async updateProduct(sellerSku, price, stock) {
        // Jumia uses POST with XML payload for product updates
        // For now, this returns the expected format
        const params = {
            SellerSku: sellerSku,
            Price: price,
            SalePrice: price,
            Quantity: stock
        };
        const url = this._buildSignedUrl('ProductUpdate', params);
        return this._request(url);
    }

    /**
     * Set order status to 'ready_to_ship' (accept order)
     */
    async confirmOrder(orderItemIds) {
        const params = { OrderItemIds: orderItemIds.join(',') };
        const url = this._buildSignedUrl('SetStatusToReadyToShip', params);
        return this._request(url);
    }

    /**
     * Normalize a Jumia order object to our OnlineOrder format
     */
    static normalizeOrder(jumiaOrder, jumiaItems = []) {
        const address = jumiaOrder.AddressShipping || {};
        return {
            platform: 'jumia',
            platformOrderId: String(jumiaOrder.OrderId),
            platformOrderNumber: jumiaOrder.OrderNumber || String(jumiaOrder.OrderId),
            customerName: jumiaOrder.CustomerFirstName
                ? `${jumiaOrder.CustomerFirstName} ${jumiaOrder.CustomerLastName || ''}`.trim()
                : (address.FirstName ? `${address.FirstName} ${address.LastName || ''}`.trim() : 'Unknown'),
            customerEmail: jumiaOrder.CustomerEmail || '',
            customerPhone: address.Phone || address.Phone2 || '',
            shippingAddress: {
                line1: address.Address1 || '',
                line2: address.Address2 || '',
                city: address.City || '',
                country: 'EG'
            },
            items: jumiaItems.map(item => ({
                platformItemId: String(item.OrderItemId),
                sku: item.Sku || item.SellerSku,
                name: item.Name,
                qty: parseInt(item.Quantity) || 1,
                price: parseFloat(item.ItemPrice) || 0
            })),
            subtotal: parseFloat(jumiaOrder.Price) || 0,
            shippingCost: parseFloat(jumiaOrder.ShippingFee) || 0,
            discount: 0,
            total: parseFloat(jumiaOrder.Price) || 0,
            currency: 'EGP',
            paymentMethod: jumiaOrder.PaymentMethod || '',
            paymentStatus: jumiaOrder.PaymentMethod?.toLowerCase().includes('cod') ? 'cod' : 'pending',
            notes: '',
            platformCreatedAt: new Date(jumiaOrder.CreatedAt)
        };
    }
}

module.exports = JumiaConnector;
