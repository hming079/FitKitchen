const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const pool = require("../../config/database");
const userService = require("../user/user.service");
const { verifyPassword } = require("../user/user.security");

function failure(res, status, code, message) {
    return res.status(status).json({ success: false, code, message });
}

class AuthController {
    async login(req, res, next) {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
            return failure(res, 400, "VALIDATION_ERROR", "Email and password are required");
        }
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
            return failure(res, 503, "AUTH_NOT_CONFIGURED", "Authentication is not configured");
        }

        try {
            const user = await userService.findCredentialsByEmail(email);
            if (!user || !(await verifyPassword(password, user.password_hash))) {
                return failure(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect");
            }
            if (user.is_locked) {
                return failure(res, 403, "ACCOUNT_LOCKED", "Your account is locked. Contact support.");
            }

            const sessionId = crypto.randomUUID();
            const token = jwt.sign({}, process.env.JWT_SECRET, {
                algorithm: "HS256",
                subject: String(user.id),
                jwtid: sessionId,
                expiresIn: "30m",
                issuer: process.env.JWT_ISSUER || "fitkitchen",
                audience: process.env.JWT_AUDIENCE || "fitkitchen-api"
            });
            const claims = jwt.decode(token);
            await pool.query(
                "INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, to_timestamp($3))",
                [sessionId, user.id, claims.exp]
            );
            return res.json({
                success: true,
                data: {
                    token,
                    user: {
                        id: String(user.id),
                        full_name: user.full_name,
                        role: user.role,
                        is_locked: user.is_locked
                    }
                }
            });
        } catch (error) {
            return next(error);
        }
    }

    async logout(req, res, next) {
        try {
            if (req.authSessionId) {
                await pool.query(
                    "UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
                    [req.authSessionId, req.user.id]
                );
            }
            return res.json({ success: true, data: { signed_out: true } });
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = new AuthController();
