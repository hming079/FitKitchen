const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vnpay = require('../src/modules/payment/vnpay');

const SECRET = 'TESTSECRETKEY0123456789ABCDEFGHIJ';

function sampleParams() {
    return {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: 'DEMO1234',
        vnp_Amount: '6500000',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: '42T20261126070000',
        vnp_OrderInfo: 'Thanh toan don hang 42',
        vnp_OrderType: 'other',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: 'http://localhost:3000/api/payments/vnpay/return',
        vnp_IpAddr: '127.0.0.1',
        vnp_CreateDate: '20261126070000',
        vnp_ExpireDate: '20261126071500'
    };
}

test('signData sorts keys, encodes values with + for spaces and skips signature fields', () => {
    const data = vnpay.signData({
        vnp_TxnRef: '1',
        vnp_Amount: '100',
        vnp_OrderInfo: 'Thanh toan don hang 1',
        vnp_ReturnUrl: 'http://x.test/a?b=1',
        vnp_SecureHash: 'abc',
        vnp_SecureHashType: 'HmacSHA512',
        other: 'ignored'
    });
    assert.equal(
        data,
        'vnp_Amount=100&vnp_OrderInfo=Thanh+toan+don+hang+1&vnp_ReturnUrl=http%3A%2F%2Fx.test%2Fa%3Fb%3D1&vnp_TxnRef=1'
    );
});

test('sign is stable, independent of key order, and equals HMAC-SHA512 of signData', () => {
    const params = sampleParams();
    const reversed = Object.fromEntries(Object.entries(params).reverse());
    const hash = vnpay.sign(params, SECRET);
    assert.equal(hash, vnpay.sign(reversed, SECRET));
    assert.match(hash, /^[0-9a-f]{128}$/);
    const expected = crypto.createHmac('sha512', SECRET).update(vnpay.signData(params)).digest('hex');
    assert.equal(hash, expected);
});

test('changing any parameter or the secret changes the signature', () => {
    const params = sampleParams();
    const base = vnpay.sign(params, SECRET);
    for (const key of Object.keys(params)) {
        assert.notEqual(vnpay.sign({ ...params, [key]: `${params[key]}0` }, SECRET), base, key);
    }
    assert.notEqual(vnpay.sign(params, `${SECRET}x`), base);
});

test('verify accepts a valid signature in any hex case and rejects tampered or malformed ones', () => {
    const params = sampleParams();
    const hash = vnpay.sign(params, SECRET);
    assert.equal(vnpay.verify({ ...params, vnp_SecureHash: hash }, SECRET), true);
    assert.equal(vnpay.verify({ ...params, vnp_SecureHash: hash.toUpperCase() }, SECRET), true);
    assert.equal(vnpay.verify({ ...params, vnp_SecureHashType: 'HmacSHA512', vnp_SecureHash: hash }, SECRET), true);

    assert.equal(vnpay.verify({ ...params, vnp_Amount: '6500001', vnp_SecureHash: hash }, SECRET), false);
    assert.equal(vnpay.verify({ ...params, vnp_SecureHash: hash }, 'other-secret'), false);
    for (const bad of [undefined, null, '', 'abc', hash.slice(0, 10), `${hash}00`, 'zz'.repeat(64), ['a'], 42]) {
        assert.doesNotThrow(() => vnpay.verify({ ...params, vnp_SecureHash: bad }, SECRET));
        assert.equal(vnpay.verify({ ...params, vnp_SecureHash: bad }, SECRET), false);
    }
    assert.equal(vnpay.verify(null, SECRET), false);
});

test('buildPaymentUrl round-trips: parsed query verifies with the same secret', () => {
    const url = new URL(vnpay.buildPaymentUrl('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', sampleParams(), SECRET));
    assert.equal(url.origin, 'https://sandbox.vnpayment.vn');
    const query = Object.fromEntries(url.searchParams);
    assert.equal(query.vnp_OrderInfo, 'Thanh toan don hang 42');
    assert.equal(query.vnp_ReturnUrl, 'http://localhost:3000/api/payments/vnpay/return');
    assert.equal(vnpay.verify(query, SECRET), true);
});

test('formatVnpDate uses Asia/Ho_Chi_Minh regardless of the server time zone', () => {
    assert.equal(vnpay.formatVnpDate(new Date('2026-11-26T00:00:00Z')), '20261126070000');
    assert.equal(vnpay.formatVnpDate(new Date('2026-12-31T17:30:05Z')), '20270101003005');
    assert.equal(vnpay.formatVnpDate(new Date('2026-11-25T16:59:59Z')), '20261125235959');
    const created = new Date('2026-11-26T00:00:00Z');
    assert.equal(vnpay.formatVnpDate(vnpay.expiryFrom(created)), '20261126071500');
});

test('txnRef, orderInfo, clientIp and withoutSignature', () => {
    assert.equal(vnpay.txnRef('42', '20261126070000'), '42T20261126070000');
    assert.match(vnpay.orderInfo('42'), /^[\x20-\x7E]+$/);
    assert.equal(vnpay.clientIp('::ffff:10.0.0.5'), '10.0.0.5');
    assert.equal(vnpay.clientIp('::1'), '127.0.0.1');
    assert.equal(vnpay.clientIp(undefined), '127.0.0.1');
    assert.deepEqual(
        vnpay.withoutSignature({ vnp_Amount: '1', vnp_SecureHash: 'x', vnp_SecureHashType: 'y', foo: 'bar' }),
        { vnp_Amount: '1' }
    );
});

test('loadConfig requires every setting and valid URLs', () => {
    const env = {
        VNP_TMN_CODE: 'DEMO1234',
        VNP_HASH_SECRET: SECRET,
        VNP_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        VNP_RETURN_URL: 'http://localhost:3000/api/payments/vnpay/return',
        PAYMENT_RESULT_URL: 'http://localhost:5173/payment/result'
    };
    const config = vnpay.loadConfig(env);
    assert.equal(config.tmnCode, 'DEMO1234');
    assert.equal(config.paymentUrl, env.VNP_URL);
    for (const key of Object.keys(env)) {
        assert.equal(vnpay.loadConfig({ ...env, [key]: '' }), null, `${key} empty`);
        assert.equal(vnpay.loadConfig({ ...env, [key]: undefined }), null, `${key} missing`);
    }
    assert.equal(vnpay.loadConfig({ ...env, PAYMENT_RESULT_URL: 'javascript:alert(1)' }), null);
    assert.equal(vnpay.loadConfig({ ...env, VNP_URL: 'not a url' }), null);
});

test('vnpAmount converts stored NUMERIC totals to integer VND x 100', () => {
    const { vnpAmount } = require('../src/modules/payment/payment.service');
    assert.equal(vnpAmount('65000.00'), 6500000);
    assert.equal(vnpAmount('168000.00'), 16800000);
    assert.equal(vnpAmount(85000), 8500000);
});

test('validateCreatePayment accepts only a positive order_id', () => {
    const { validateCreatePayment } = require('../src/modules/payment/payment.validation');
    assert.deepEqual(validateCreatePayment({ order_id: 42 }), { order_id: '42' });
    assert.deepEqual(validateCreatePayment({ order_id: '7' }), { order_id: '7' });
    for (const body of [
        undefined, null, [], {}, { order_id: 0 }, { order_id: -1 }, { order_id: '1.5' }, { order_id: 'abc' },
        { order_id: '9223372036854775808' }, { order_id: 1, amount: 100 }, { order_id: true }
    ]) {
        assert.throws(() => validateCreatePayment(body), error => error.status === 400 && error.code === 'VALIDATION_ERROR');
    }
});

test('order checkout validation accepts COD and ONLINE only', () => {
    const { validateCheckout } = require('../src/modules/order/order.validation');
    const today = new Date().toISOString().slice(0, 10);
    const body = method => ({ address_id: 1, delivery_date: today, delivery_time_slot: '11:00 - 12:00', payment_method: method });
    assert.equal(validateCheckout(body('COD')).payment_method, 'COD');
    assert.equal(validateCheckout(body('ONLINE')).payment_method, 'ONLINE');
    for (const method of [undefined, 'online', 'VNPAY', 'CARD', '']) {
        assert.throws(() => validateCheckout(body(method)), error => error.status === 400);
    }
});
