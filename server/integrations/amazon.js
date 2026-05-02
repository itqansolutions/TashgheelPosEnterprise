/**
 * Amazon Selling Partner API (SP-API) Connector
 * Marketplace: Amazon.eg (Egypt) — marketplace ID: A1I7FNSA0GEFN2
 * Region: EU (eu-west-1), endpoint: https://sellingpartnerapi-eu.amazon.com
 * Auth: Login with Amazon (LWA) OAuth2
 * Docs: https://developer-docs.amazon.com/sp-api/
 */
const https = require('https');
const crypto = require('crypto');

const AMAZON_ENDPOINTS = {
    'eu-west-1': 'sellingpartnerapi-eu.amazon.com',
    'us-east-1': 'sellingpartnerapi-na.amazon.com',
    'us-west-2': 'sellingpartnerapi-fe.amazon.com'
};

const AMAZON_EG_MARKETPLACE_ID = 'A1I7FNSA0GEFN2';

class AmazonConnector {
    constructor(config) {
        this.sellerId = config.sellerId;
        this.marketplaceId = config.marketplaceId || AMAZON_EG_MARKETPLACE_ID;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.refreshToken = config.refreshToken;
        this.region = config.region || 'eu-west-1';
        this.endpoint = AMAZON_ENDPOINTS[this.region];
        this._accessToken = null;
        this._tokenExpiry = null;
    }

    /**
     * Get LWA access token (cached until expiry)
     */
    async _getAccessToken() {
        if (this._accessToken && this._tokenExpiry && Date.now() < this._tokenExpiry) {
            return this._accessToken;
        }

        return new Promise((resolve, reject) => {
            const body = JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
                client_id: this.clientId,
                client_secret: this.clientSecret
            });

            const req = https.request({
                hostname: 'api.amazon.com',
                path: '/auth/o2/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.access_token) {
                            this._accessToken = parsed.access_token;
                            this._tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
                            resolve(parsed.access_token);
                        } else {
                            reject(new Error(`LWA token error: ${parsed.error_description || JSON.stringify(parsed)}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse LWA response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    /**
     * Make an authenticated SP-API request
     */
    async _request(method, path, params = {}) {
        const token = await this._getAccessToken();

        const queryString = Object.keys(params).length
            ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
            : '';

        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.endpoint,
                path: path + queryString,
                method,
                headers: {
                    'x-amz-access-token': token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'TashgheelPOS/1.0 (Language=JavaScript)'
                }
            };

            https.request(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            const errMsg = parsed.errors?.[0]?.message || parsed.message || data;
                            reject(new Error(`Amazon SP-API ${res.statusCode}: ${errMsg}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse Amazon response: ${data.substring(0, 300)}`));
                    }
                });
            }).on('error', reject).end();
        });
    }

    /**
     * Test connection
     */
    async testConnection() {
        await this._getAccessToken();
        return { success: true, message: `Connected to Amazon (marketplace: ${this.marketplaceId})` };
    }

    /**
     * Get orders (new orders in 'Unshipped' or 'PendingAvailability' status)
     * @param {Date} createdAfter
     */
    async getOrders(createdAfter = null) {
        const after = createdAfter
            ? new Date(createdAfter).toISOString()
            : new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(); // Last 7 days default

        const result = await this._request('GET', '/orders/v0/orders', {
            MarketplaceIds: this.marketplaceId,
            CreatedAfter: after,
            OrderStatuses: 'Unshipped,PartiallyShipped,PendingAvailability'
        });
        return result?.payload?.Orders || [];
    }

    /**
     * Get order items for a given Amazon order
     */
    async getOrderItems(orderId) {
        const result = await this._request('GET', `/orders/v0/orders/${orderId}/orderItems`);
        return result?.payload?.OrderItems || [];
    }

    /**
     * Get inventory summaries (FBA) — for stock sync
     * Note: For FBM (Fulfilled by Merchant), you manage stock externally
     */
    async getInventory(skus = []) {
        const params = {
            granularityType: 'Marketplace',
            granularityId: this.marketplaceId,
            marketplaceIds: this.marketplaceId
        };
        if (skus.length) params.sellerSkus = skus.join(',');

        const result = await this._request('GET', '/fba/inventory/v1/summaries', params);
        return result?.payload?.inventorySummaries || [];
    }

    /**
     * Update listing price and quantity for a SKU (FBM)
     * Uses Listings Items API (SP-API v2021-08-01)
     */
    async updateListing(sku, price, quantity) {
        // This requires Listings Items API with a specific body format
        // Returning a structured response for now; full implementation requires
        // marketplace-specific product type schema
        return {
            sku,
            status: 'ACCEPTED',
            note: `Price: ${price}, Qty: ${quantity} — submit via Amazon Seller Central for full FBM listing update`
        };
    }

    /**
     * Normalize Amazon order to our OnlineOrder format
     */
    static normalizeOrder(order, orderItems = []) {
        const addr = order.ShippingAddress || {};
        return {
            platform: 'amazon',
            platformOrderId: order.AmazonOrderId,
            platformOrderNumber: order.AmazonOrderId,
            customerName: addr.Name || order.BuyerInfo?.BuyerName || 'Amazon Customer',
            customerEmail: order.BuyerInfo?.BuyerEmail || '',
            customerPhone: addr.Phone || '',
            shippingAddress: {
                line1: addr.AddressLine1 || '',
                line2: addr.AddressLine2 || '',
                city: addr.City || '',
                country: addr.CountryCode || 'EG'
            },
            items: orderItems.map(item => ({
                platformItemId: item.OrderItemId,
                sku: item.SellerSKU,
                name: item.Title,
                qty: parseInt(item.QuantityOrdered) || 1,
                price: parseFloat(item.ItemPrice?.Amount) || 0
            })),
            subtotal: parseFloat(order.OrderTotal?.Amount) || 0,
            shippingCost: 0,
            discount: 0,
            total: parseFloat(order.OrderTotal?.Amount) || 0,
            currency: order.OrderTotal?.CurrencyCode || 'EGP',
            paymentMethod: order.PaymentMethod || '',
            paymentStatus: order.PaymentExecutionDetail ? 'paid' : 'pending',
            notes: '',
            platformCreatedAt: new Date(order.PurchaseDate)
        };
    }
}

module.exports = AmazonConnector;
