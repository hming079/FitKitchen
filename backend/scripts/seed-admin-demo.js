require('../src/config/env');
const pool = require('../src/config/database');
const { hashPassword } = require('../src/modules/user/user.security');

async function main() {
    if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
    const password = process.env.ADMIN_DEMO_PASSWORD;
    if (!password || password.length < 12) throw new Error('Set ADMIN_DEMO_PASSWORD to at least 12 characters (local demo only)');
    const hash = await hashPassword(password);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const ids = [];
        for (const [email, name, role, phone, goal] of [
            ['admin@admin-demo.example.test', 'Demo administrator', 'ADMIN', '0900000001', null],
            ['active@admin-demo.example.test', 'Demo active customer', 'CUSTOMER', '0900000002', 'MAINTAIN'],
            ['orders@admin-demo.example.test', 'Demo customer with orders', 'CUSTOMER', '0900000003', 'CUT']
        ]) {
            const result = await client.query(`INSERT INTO users (email, password_hash, full_name, role, phone, fitness_goal)
                VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING RETURNING id`, [email, hash, name, role, phone, goal]);
            if (!result.rows[0]) throw new Error('Demo accounts already exist; seed does not overwrite accounts or credentials');
            ids.push(result.rows[0].id);
        }
        const customerId = ids[2];
        const address = await client.query(`INSERT INTO user_addresses (user_id, recipient_name, phone, address_detail, is_default)
            VALUES ($1, 'Demo customer with orders', '0900000003', 'Demo address, Ho Chi Minh City', true) RETURNING id`, [customerId]);
        await client.query(`INSERT INTO customer_orders (user_id, address_id, total_amount, status, payment_method, payment_status, delivery_date)
            VALUES ($1, $2, 150000, 'PREPARING', 'COD', 'PENDING', CURRENT_DATE + 1),
                   ($1, $2, 100000, 'COMPLETED', 'ONLINE', 'PAID', CURRENT_DATE - 1)`, [customerId, address.rows[0].id]);
        const plan = await client.query(`INSERT INTO subscription_plans (name, duration_days, meals_per_day, price)
            VALUES ('Admin demo 30-day plan', 30, 1, 2500000) RETURNING id`);
        await client.query(`INSERT INTO user_subscriptions (user_id, plan_id, address_id, start_date, end_date, status, payment_method, payment_status, total_amount)
            VALUES ($1, $2, $3, CURRENT_DATE - 1, CURRENT_DATE + 28, 'ACTIVE', 'ONLINE', 'PAID', 2500000)`, [customerId, plan.rows[0].id, address.rows[0].id]);
        await client.query('COMMIT');
        console.log('Created three local demo accounts, one address, two orders and one active subscription. Passwords use the existing scrypt helper.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}
main().catch(error => { console.error('Seed failed:', error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
