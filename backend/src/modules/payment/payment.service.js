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

const IPN = {
    SUCCESS: { RspCode: '00', Message: 'Confirm Success' },
    ORDER_NOT_FOUND: { RspCode: '01', Message: 'Order not found' },
    ALREADY_CONFIRMED: { RspCode: '02', Message: 'Order already confirmed' },
    INVALID_AMOUNT: { RspCode: '04', Message: 'Invalid amount' },
    INVALID_CHECKSUM: { RspCode: '97', Message: 'Invalid Checksum' },
    UNKNOWN: { RspCode: '99', Message: 'Unknown error' }
};

function text(value, maxLength) {
    return typeof value === 'string' && value ? value.slice(0, maxLength) : null;
}

// Records the callback on the attempt row (signature fields removed).
async function recordAttempt(client, transactionId, query, status) {
    await client.query(
        `UPDATE payment_transactions
         SET status = $2, vnp_transaction_no = $3, bank_code = $4, response_code = $5,
             transaction_status = $6, pay_date = $7, raw_data = $8::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
            transactionId,
            status,
            text(query.vnp_TransactionNo, 64),
            text(query.vnp_BankCode, 32),
            text(query.vnp_ResponseCode, 8),
            text(query.vnp_TransactionStatus, 8),
            text(query.vnp_PayDate, 14),
            JSON.stringify(vnpay.withoutSignature(query))
        ]
    );
}

// VNPay server-to-server callback. Checks run in VNPay's documented order:
// checksum (97), transaction/order (01), amount (04), already confirmed (02), then 00.
// One client and row locks (order, then attempt) make repeated IPNs take effect once.
async function handleIpn(query) {
    const config = vnpay.loadConfig();
    if (!config) {
        console.error('VNPay IPN rejected: payment is not configured');
        return IPN.UNKNOWN;
    }
    if (!vnpay.verify(query, config.hashSecret)) return IPN.INVALID_CHECKSUM;

    const txnRef = typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';
    if (!txnRef) return IPN.ORDER_NOT_FOUND;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [ref] } = await client.query(
            'SELECT order_id FROM payment_transactions WHERE txn_ref = $1', [txnRef]
        );
        if (!ref) {
            await client.query('ROLLBACK');
            return IPN.ORDER_NOT_FOUND;
        }
        const { rows: [order] } = await client.query(
            'SELECT id, status, payment_status FROM customer_orders WHERE id = $1 FOR UPDATE', [ref.order_id]
        );
        const { rows: [attempt] } = await client.query(
            'SELECT id, amount::text AS amount, status FROM payment_transactions WHERE txn_ref = $1 FOR UPDATE', [txnRef]
        );
        if (!order || !attempt) {
            await client.query('ROLLBACK');
            return IPN.ORDER_NOT_FOUND;
        }
        if (typeof query.vnp_Amount !== 'string' || query.vnp_Amount !== attempt.amount) {
            await client.query('ROLLBACK');
            return IPN.INVALID_AMOUNT;
        }

        const paid = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
        if (attempt.status !== 'PENDING') {
            await client.query('ROLLBACK');
            return IPN.ALREADY_CONFIRMED;
        }
        if (order.payment_status === 'PAID') {
            // An older attempt reported after the order was already paid by another attempt.
            await recordAttempt(client, attempt.id, query, paid ? 'SUCCESS' : 'FAILED');
            await client.query('COMMIT');
            if (paid) console.warn(`VNPay duplicate payment for order ${order.id} (txn ${txnRef}); refund manually`);
            return IPN.ALREADY_CONFIRMED;
        }

        await recordAttempt(client, attempt.id, query, paid ? 'SUCCESS' : 'FAILED');
        await client.query(
            'UPDATE customer_orders SET payment_status = $2 WHERE id = $1',
            [order.id, paid ? 'PAID' : 'FAILED']
        );
        await client.query('COMMIT');
        if (paid && order.status === 'CANCELLED') {
            console.warn(`VNPay payment received for cancelled order ${order.id} (txn ${txnRef}); refund manually`);
        }
        return IPN.SUCCESS;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { createVnpayUrl, handleIpn, vnpAmount, IPN };
