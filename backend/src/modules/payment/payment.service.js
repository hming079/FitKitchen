const pool = require('../../config/database');
const { cents } = require('../order/order.service');
const vnpay = require('./vnpay');

// A pending attempt is reused only while it has at least this long left to be paid.
const REUSE_MIN_REMAINING_MS = 60 * 1000;

function problem(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

// VNPay amount unit: VND x 100, integer.
function vnpAmount(totalAmount) {
    return cents(totalAmount);
}

function paymentParams(config, { orderId, amount, txnRef, createDate, expireDate, ip }) {
    return {
        vnp_Version: vnpay.VERSION,
        vnp_Command: 'pay',
        vnp_TmnCode: config.tmnCode,
        vnp_Amount: String(amount),
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: vnpay.orderInfo(orderId),
        vnp_OrderType: 'other',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: config.returnUrl,
        vnp_IpAddr: vnpay.clientIp(ip),
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate
    };
}

// Creates a VNPay payment URL for the customer's own ONLINE order.
// The order row is locked so concurrent requests reuse one unexpired PENDING attempt
// (same txn_ref and dates) instead of opening a second payable transaction.
async function createVnpayUrl({ userId, orderId, ip, now = new Date() }) {
    const config = vnpay.loadConfig();
    if (!config) throw problem(503, 'PAYMENT_NOT_CONFIGURED', 'Online payment is not configured');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [order] } = await client.query(
            `SELECT id, total_amount, status, payment_method, payment_status
             FROM customer_orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            [orderId, userId]
        );
        if (!order) throw problem(404, 'ORDER_NOT_FOUND', 'Order not found');
        if (order.payment_method !== 'ONLINE' || order.status !== 'PENDING' ||
            !['PENDING', 'FAILED'].includes(order.payment_status)) {
            throw problem(409, 'PAYMENT_NOT_ALLOWED', 'This order cannot be paid online');
        }
        const amount = vnpAmount(order.total_amount);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            throw problem(409, 'PAYMENT_NOT_ALLOWED', 'This order has no payable amount');
        }

        const { rows: [existing] } = await client.query(
            `SELECT txn_ref, vnp_create_date, expires_at FROM payment_transactions
             WHERE order_id = $1 AND status = 'PENDING' AND amount = $2 AND expires_at > $3
             ORDER BY created_at DESC, id DESC LIMIT 1`,
            [order.id, amount, new Date(now.getTime() + REUSE_MIN_REMAINING_MS)]
        );

        let attempt;
        if (existing) {
            attempt = {
                txnRef: existing.txn_ref,
                createDate: existing.vnp_create_date,
                expiresAt: new Date(existing.expires_at)
            };
        } else {
            const createDate = vnpay.formatVnpDate(now);
            attempt = {
                txnRef: vnpay.txnRef(order.id, createDate),
                createDate,
                expiresAt: vnpay.expiryFrom(now)
            };
            await client.query(
                `INSERT INTO payment_transactions (order_id, provider, txn_ref, amount, status, vnp_create_date, expires_at)
                 VALUES ($1, 'VNPAY', $2, $3, 'PENDING', $4, $5)`,
                [order.id, attempt.txnRef, amount, attempt.createDate, attempt.expiresAt]
            );
        }
        await client.query('COMMIT');

        const params = paymentParams(config, {
            orderId: String(order.id),
            amount,
            txnRef: attempt.txnRef,
            createDate: attempt.createDate,
            expireDate: vnpay.formatVnpDate(attempt.expiresAt),
            ip
        });
        return {
            provider: 'VNPAY',
            order_id: String(order.id),
            txn_ref: attempt.txnRef,
            expires_at: attempt.expiresAt.toISOString(),
            redirect_url: vnpay.buildPaymentUrl(config.paymentUrl, params, config.hashSecret)
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { createVnpayUrl, vnpAmount };
