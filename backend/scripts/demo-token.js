// Local integration fixture, NOT a login endpoint or password verifier.
require('../src/config/env');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const pool = require('../src/config/database');

async function main() {
    if (process.env.NODE_ENV === 'production') throw new Error('Demo token issuance is disabled in production');
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to at least 32 characters');
    const email = process.argv[2];
    const localAdmin = ['admin1@fitkitchen.example.test', 'admin2@fitkitchen.example.test'].includes(email);
    if (!localAdmin && !['admin', 'active', 'orders'].some(name => email === `${name}@admin-demo.example.test`)) throw new Error('Choose a seeded demo email or an existing local Admin email');
    const { rows } = await pool.query('SELECT id, role, is_locked FROM users WHERE email = $1', [email]);
    if (!rows[0]) throw new Error('Create the local account first');
    if (rows[0].is_locked || (localAdmin && rows[0].role !== 'ADMIN')) throw new Error('An unlocked local Admin account is required');
    const sessionId = crypto.randomUUID();
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: 'HS256', subject: String(rows[0].id), jwtid: sessionId, expiresIn: '30m',
        issuer: process.env.JWT_ISSUER || 'fitkitchen', audience: process.env.JWT_AUDIENCE || 'fitkitchen-api'
    });
    const claims = jwt.decode(token);
    await pool.query(
        'INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, to_timestamp($3))',
        [sessionId, rows[0].id, claims.exp]
    );
    console.log(token);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
