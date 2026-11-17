const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function deny(res, status, code, message) {
    return res.status(status).json({ success: false, code, message });
}

// Verification only. Token issuance/login belongs to the account module.
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
        if (typeof claims !== 'object' || typeof claims.sub !== 'string' ||
            !/^[1-9]\d*$/.test(claims.sub) || BigInt(claims.sub) > 9223372036854775807n ||
            !Number.isFinite(claims.exp)) throw new Error('Invalid claims');
    } catch {
        return deny(res, 401, 'UNAUTHENTICATED', 'Your session is invalid or expired');
    }
    try {
        const { rows } = await pool.query(
            'SELECT id, full_name, role, is_locked FROM users WHERE id = $1', [claims.sub]
        );
        const user = rows[0];
        if (!user) return deny(res, 401, 'UNAUTHENTICATED', 'The account no longer exists');
        if (user.is_locked) return deny(res, 403, 'ACCOUNT_LOCKED', 'Your account is locked. Contact support.');
        if (!['ADMIN', 'CUSTOMER'].includes(user.role)) return deny(res, 403, 'FORBIDDEN', 'Access denied');
        req.user = user;
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
