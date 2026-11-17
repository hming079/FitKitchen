const router = require('express').Router();
const crypto = require('node:crypto');
const pool = require('../../config/database');
const { hashPassword } = require('../user/user.security');
const { validateUserPayload } = require('../user/user.validation');

function reject(res, status, code, message) {
    return res.status(status).json({ success: false, code, message });
}

function internalAccess(req, res, next) {
    const configured = process.env.ADMIN_PROVISIONING_KEY;
    if (process.env.NODE_ENV === 'production' || process.env.INTERNAL_ADMIN_PROVISIONING_ENABLED !== 'true' ||
        !configured || configured.length < 32) {
        return reject(res, 404, 'NOT_FOUND', 'Not found');
    }
    // Use the actual peer address, never X-Forwarded-For. This route must not
    // be published through a reverse proxy; the separate key is also required.
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const supplied = req.get('X-Admin-Provisioning-Key') || '';
    const digest = value => crypto.createHash('sha256').update(value).digest();
    if (!local || !supplied || supplied.length > 1024 ||
        !crypto.timingSafeEqual(digest(supplied), digest(configured))) {
        return reject(res, 403, 'INTERNAL_ACCESS_DENIED', 'Internal access denied');
    }
    return next();
}

router.post('/admins', internalAccess, async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['email', 'full_name', 'password'].includes(key))) {
        return reject(res, 400, 'VALIDATION_ERROR', 'Only email, full_name and password are accepted');
    }
    const { data, errors } = validateUserPayload(body);
    if (errors.length || data.email.length > 255 ||
        body.password.length < 12 || body.password.length > 128) {
        return reject(res, 400, 'VALIDATION_ERROR', 'Provide a valid email, name (1–150 characters), and password (12–128 characters)');
    }
    const hash = await hashPassword(data.password);
    try {
        const result = await pool.query(`INSERT INTO users (email, full_name, password_hash, role)
            VALUES ($1, $2, $3, 'ADMIN') RETURNING id, email, full_name, role, is_locked, created_at`,
            [data.email, data.full_name, hash]);
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') return reject(res, 409, 'EMAIL_IN_USE', 'Email is already in use; existing accounts are not changed');
        throw error;
    }
});

module.exports = { basePath: '/api/internal', router, internalAccess };
