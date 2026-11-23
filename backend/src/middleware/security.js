const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 10;

function securityHeaders(req, res, next) {
    res.set({
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    });
    res.removeHeader("X-Powered-By");
    return next();
}

function createRateLimiter({
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    now = Date.now
} = {}) {
    const clients = new Map();

    return function rateLimit(req, res, next) {
        const timestamp = now();
        const key = req.ip || req.socket?.remoteAddress || "unknown";
        let entry = clients.get(key);

        if (!entry && clients.size >= 10_000) {
            clients.delete(clients.keys().next().value);
        }
        if (!entry || entry.resetAt <= timestamp) {
            entry = { count: 0, resetAt: timestamp + windowMs };
            clients.set(key, entry);
        }

        entry.count += 1;
        const remaining = Math.max(0, maxRequests - entry.count);
        const retryAfter = Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000));
        res.set({
            "RateLimit-Limit": String(maxRequests),
            "RateLimit-Remaining": String(remaining),
            "RateLimit-Reset": String(retryAfter)
        });

        if (entry.count > maxRequests) {
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({
                success: false,
                code: "RATE_LIMITED",
                message: "Too many sign-in attempts. Please try again later."
            });
        }

        return next();
    };
}

module.exports = { securityHeaders, createRateLimiter };
