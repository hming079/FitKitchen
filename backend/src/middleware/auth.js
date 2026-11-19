const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function deny(res, status, code, message) {
    return res.status(status).json({ success: false, code, message });
}

// Legacy tokens without a session id remain valid until their short expiry.
async function authenticate(req, res, next) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) return deny(res, 401, 'UNAUTHENTICATED', 'A valid session is required');
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        return deny(res, 503, 'AUTH_NOT_CONFIGURED', 'Authentication is not configured');
    }
    let claims;
    try {
        claims = jwt.verify(match[1], process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: process.env.JWT_ISSUER || 'fitkitchen',
            audience: process.env.JWT_AUDIENCE || 'fitkitchen-api'
        });
        const validSessionId = claims?.jti === undefined || (
            typeof claims.jti === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.jti)
        );
        if (typeof claims !== 'object' || typeof claims.sub !== 'string' ||
            !/^[1-9]\d*$/.test(claims.sub) || BigInt(claims.sub) > 9223372036854775807n ||
            !Number.isFinite(claims.exp) || !validSessionId) {
            throw new Error('Invalid claims');
        }
    } catch {
        return deny(res, 401, 'UNAUTHENTICATED', 'Your session is invalid or expired');
    }
    try {
        const { rows } = claims.jti
            ? await pool.query(
                `SELECT u.id, u.full_name, u.role, u.is_locked
                 FROM users u
                 INNER JOIN user_sessions s ON s.user_id = u.id
                 WHERE u.id = $1 AND s.id = $2 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP`,
                [claims.sub, claims.jti]
            )
            : await pool.query(
                'SELECT id, full_name, role, is_locked FROM users WHERE id = $1', [claims.sub]
            );
        const user = rows[0];
        if (!user) return deny(res, 401, 'UNAUTHENTICATED', 'The account no longer exists');
        if (user.is_locked) return deny(res, 403, 'ACCOUNT_LOCKED', 'Your account is locked. Contact support.');
        if (!['ADMIN', 'CUSTOMER'].includes(user.role)) return deny(res, 403, 'FORBIDDEN', 'Access denied');
        req.user = user;
        req.authSessionId = claims.jti || null;
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) return deny(res, 401, 'UNAUTHENTICATED', 'A valid session is required');
        if (req.user.role !== role) return deny(res, 403, 'FORBIDDEN', 'You do not have access to this area');
        return next();
    };
}

function requireSelf(param) {
    return (req, res, next) => {
        if (!req.user) return deny(res, 401, 'UNAUTHENTICATED', 'A valid session is required');
        if (String(req.user.id) !== req.params[param]) return deny(res, 403, 'FORBIDDEN', 'You can only manage your own account');
        return next();
    };
}

module.exports = { authenticate, requireRole, requireSelf };
