// Sends a correctly signed fake VNPay IPN to the local backend.
// VNPay Sandbox cannot reach localhost, so use this to complete a local payment.
// Usage: node scripts/simulate-vnpay-ipn.js <txn_ref> [success|failed]
// Optional: API_BASE_URL (default http://localhost:<PORT or 3000>).
require('../src/config/env');
const pool = require('../src/config/database');
const vnpay = require('../src/modules/payment/vnpay');

async function main() {
    const [txnRef, outcome = 'success'] = process.argv.slice(2);
    if (!txnRef || !['success', 'failed'].includes(outcome)) {
        console.error('Usage: node scripts/simulate-vnpay-ipn.js <txn_ref> [success|failed]');
        process.exitCode = 1;
        return;
    }
    const config = vnpay.loadConfig();
    if (!config) {
        console.error('VNPay is not configured: set VNP_TMN_CODE, VNP_HASH_SECRET, VNP_URL, VNP_RETURN_URL and PAYMENT_RESULT_URL');
        process.exitCode = 1;
        return;
    }

    const { rows: [attempt] } = await pool.query(
        'SELECT order_id::text AS order_id, amount::text AS amount FROM payment_transactions WHERE txn_ref = $1',
        [txnRef]
    );
    if (!attempt) {
        console.error(`No payment transaction found for txn_ref ${txnRef}`);
        process.exitCode = 1;
        return;
    }

    const paid = outcome === 'success';
    const params = {
        vnp_TmnCode: config.tmnCode,
        vnp_Amount: attempt.amount,
        vnp_BankCode: 'NCB',
        vnp_BankTranNo: `SIM${Date.now()}`,
        vnp_CardType: 'ATM',
        vnp_OrderInfo: vnpay.orderInfo(attempt.order_id),
        vnp_PayDate: vnpay.formatVnpDate(new Date()),
        vnp_ResponseCode: paid ? '00' : '24',
        vnp_TransactionNo: String(Date.now()).slice(-8),
        vnp_TransactionStatus: paid ? '00' : '02',
        vnp_TxnRef: txnRef
    };
    const query = new URLSearchParams({ ...params, vnp_SecureHash: vnpay.sign(params, config.hashSecret) });
    const base = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const res = await fetch(`${base}/api/payments/vnpay/ipn?${query}`);
    console.log(`IPN ${outcome} for ${txnRef}: HTTP ${res.status}`, await res.json());
}

main()
    .catch(error => {
        console.error('IPN simulation failed:', error.code || error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
