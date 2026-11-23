const { test } = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders, createRateLimiter } = require("../src/middleware/security");

function responseDouble() {
    const headers = new Map();
    return {
        statusCode: 200,
        body: null,
        set(name, value) {
            if (typeof name === "object") {
                for (const [key, item] of Object.entries(name)) headers.set(key, item);
            } else headers.set(name, value);
            return this;
        },
        removeHeader(name) {
            headers.delete(name);
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        header(name) {
            return headers.get(name);
        }
    };
}

test("securityHeaders applies browser hardening headers", () => {
    const res = responseDouble();
    let continued = false;

    securityHeaders({}, res, () => { continued = true; });

    assert.equal(continued, true);
    assert.equal(res.header("X-Content-Type-Options"), "nosniff");
    assert.equal(res.header("X-Frame-Options"), "DENY");
    assert.match(res.header("Content-Security-Policy"), /frame-ancestors 'none'/);
});

test("login rate limiter blocks requests over the configured threshold", () => {
    let timestamp = 1_000;
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, now: () => timestamp });
    const req = { ip: "127.0.0.1" };

    for (let request = 1; request <= 2; request += 1) {
        const res = responseDouble();
        let continued = false;
        limiter(req, res, () => { continued = true; });
        assert.equal(continued, true);
        assert.equal(res.header("RateLimit-Remaining"), String(2 - request));
    }

    const blocked = responseDouble();
    limiter(req, blocked, () => assert.fail("blocked request must not continue"));
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.code, "RATE_LIMITED");
    assert.equal(blocked.header("Retry-After"), "60");

    timestamp += 60_001;
    const reset = responseDouble();
    let continued = false;
    limiter(req, reset, () => { continued = true; });
    assert.equal(continued, true);
});
