// Pure VNPay helpers (API v2.1.0): configuration, signing, verification and dates.
// No database or HTTP access here so every rule can be unit tested.
const crypto = require('node:crypto');

const VERSION = '2.1.0';
const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const EXPIRE_MINUTES = 15;
const EXCLUDED_FROM_SIGNATURE = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);

function httpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
        return null;
    }
}

// Returns null when any required setting is missing or malformed.
function loadConfig(env = process.env) {
    const tmnCode = typeof env.VNP_TMN_CODE === 'string' ? env.VNP_TMN_CODE.trim() : '';
    const hashSecret = typeof env.VNP_HASH_SECRET === 'string' ? env.VNP_HASH_SECRET.trim() : '';
    const paymentUrl = httpUrl(env.VNP_URL);
    const returnUrl = httpUrl(env.VNP_RETURN_URL);
    const resultUrl = httpUrl(env.PAYMENT_RESULT_URL);
    if (!tmnCode || !hashSecret || !paymentUrl || !returnUrl || !resultUrl) return null;
    return { tmnCode, hashSecret, paymentUrl, returnUrl, resultUrl };
}

// yyyyMMddHHmmss in Vietnam time, independent of the server time zone.
function formatVnpDate(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}${part('month')}${part('day')}${part('hour')}${part('minute')}${part('second')}`;
}

function expiryFrom(createdAt) {
    return new Date(createdAt.getTime() + EXPIRE_MINUTES * 60 * 1000);
}

// encodeURIComponent, with spaces as '+', matching VNPay's reference implementation.
function encodeValue(value) {
    return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

// Sorted vnp_* parameters joined as k=v&k=v, without the signature fields.
function signData(params) {
    return Object.keys(params)
        .filter(key => key.startsWith('vnp_') && !EXCLUDED_FROM_SIGNATURE.has(key))
        .filter(key => params[key] !== undefined && params[key] !== null)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeValue(params[key])}`)
        .join('&');
}

function sign(params, hashSecret) {
    return crypto.createHmac('sha512', hashSecret).update(signData(params), 'utf8').digest('hex');
}

// Constant-time comparison; malformed or missing signatures return false.
function verify(params, hashSecret) {
    const received = params && params.vnp_SecureHash;
    if (typeof received !== 'string' || !/^[0-9a-fA-F]+$/.test(received)) return false;
    const expected = Buffer.from(sign(params, hashSecret), 'utf8');
    const actual = Buffer.from(received.toLowerCase(), 'utf8');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function buildPaymentUrl(paymentUrl, params, hashSecret) {
    return `${paymentUrl}?${signData(params)}&vnp_SecureHash=${sign(params, hashSecret)}`;
}

// <orderId>A<attempt>T<yyyyMMddHHmmss>: the attempt number keeps references unique
// even when a new attempt is created within the same second as the previous one.
const TXN_REF_PATTERN = /^([1-9]\d*)A([1-9]\d*)T(\d{14})$/;

function txnRef(orderId, attempt, createDate) {
    return `${orderId}A${attempt}T${createDate}`;
}

// Returns the order id encoded in a reference, or null when it is malformed.
function orderIdFromTxnRef(value) {
    const match = typeof value === 'string' ? TXN_REF_PATTERN.exec(value) : null;
    return match ? match[1] : null;
}

// ASCII only; VNPay rejects Vietnamese diacritics in vnp_OrderInfo.
function orderInfo(orderId) {
    return `Thanh toan don hang ${orderId}`;
}

// Removes the signature fields before persisting a callback payload.
function withoutSignature(params) {
    return Object.fromEntries(Object.entries(params || {})
        .filter(([key]) => key.startsWith('vnp_') && !EXCLUDED_FROM_SIGNATURE.has(key)));
}

// IPv4-mapped IPv6 addresses are sent to VNPay as plain IPv4.
function clientIp(ip) {
    if (typeof ip !== 'string' || !ip) return '127.0.0.1';
    if (ip === '::1') return '127.0.0.1';
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

module.exports = {
    VERSION,
    EXPIRE_MINUTES,
    loadConfig,
    formatVnpDate,
    expiryFrom,
    encodeValue,
    signData,
    sign,
    verify,
    buildPaymentUrl,
    txnRef,
    orderIdFromTxnRef,
    orderInfo,
    withoutSignature,
    clientIp
};
