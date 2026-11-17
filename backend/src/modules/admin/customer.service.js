const pool = require('../../config/database');

const columns = 'id, full_name, email, phone, fitness_goal, role, is_locked, created_at';
const unfinishedStatuses = ['PENDING', 'PREPARING', 'DELIVERING'];

function notFound() {
    const error = new Error('Customer not found');
    error.status = 404;
    error.code = 'CUSTOMER_NOT_FOUND';
    return error;
}

async function findCustomer(id, db = pool) {
    const result = await db.query(`SELECT ${columns} FROM users WHERE id = $1 AND role = 'CUSTOMER'`, [id]);
    if (!result.rows[0]) throw notFound();
    return result.rows[0];
}

async function list({ search, status, page, page_size }) {
    // Treat SQL wildcard characters as literal search text.
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const where = `role = 'CUSTOMER' AND (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
        AND ($2::boolean IS NULL OR is_locked = $2)`;
    const params = [pattern, status === 'all' ? null : status === 'locked'];
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const count = await client.query(`SELECT COUNT(*)::int AS total FROM users WHERE ${where}`, params);
        const result = await client.query(`SELECT ${columns} FROM users WHERE ${where}
            ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`, [...params, page_size, (page - 1) * page_size]);
        await client.query('COMMIT');
        return { data: result.rows, pagination: { page, page_size, total: count.rows[0].total } };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}

async function profile(id) {
    const customer = await findCustomer(id);
    const addresses = await pool.query(`SELECT id, recipient_name, phone, address_detail, is_default
        FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, id`, [id]);
    const unfinished = await pool.query(`SELECT COUNT(*)::int AS count FROM customer_orders
        WHERE user_id = $1 AND status = ANY($2::text[])`, [id, unfinishedStatuses]);
    return { ...customer, addresses: addresses.rows, unfinished_order_count: unfinished.rows[0].count };
}

async function history(id, kind, { page, page_size }) {
    await findCustomer(id);
    const isOrders = kind === 'orders';
    const from = isOrders ? 'customer_orders o' : 'user_subscriptions o JOIN subscription_plans p ON p.id = o.plan_id';
    const where = `o.user_id = $1${isOrders ? '' : " AND o.status = 'ACTIVE' AND CURRENT_DATE BETWEEN o.start_date AND o.end_date"}`;
    // DATE values are calendar dates, not instants. Avoid pg's local Date parser
    // and JSON timezone conversion; timestamps such as created_at remain timestamps.
    const fields = isOrders ? "o.id, o.created_at, to_char(o.delivery_date, 'YYYY-MM-DD') AS delivery_date, o.total_amount, o.status, o.payment_method, o.payment_status"
        : "o.id, p.name AS plan_name, to_char(o.start_date, 'YYYY-MM-DD') AS start_date, to_char(o.end_date, 'YYYY-MM-DD') AS end_date, o.status, o.payment_method, o.payment_status, o.total_amount";
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM ${from} WHERE ${where}`, [id]);
    const result = await pool.query(`SELECT ${fields} FROM ${from} WHERE ${where}
        ORDER BY o.created_at DESC, o.id DESC LIMIT $2 OFFSET $3`, [id, page_size, (page - 1) * page_size]);
    return { data: result.rows, pagination: { page, page_size, total: count.rows[0].total } };
}

async function changeStatus(id, adminId, { is_locked, reason, confirm_unfinished_orders }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existing = await client.query(`SELECT ${columns} FROM users WHERE id = $1 AND role = 'CUSTOMER' FOR UPDATE`, [id]);
        const customer = existing.rows[0];
        if (!customer) throw notFound();
        if (customer.is_locked === is_locked) {
            await client.query('COMMIT');
            return { data: customer, changed: false };
        }
        if (is_locked) {
            const unfinished = await client.query(`SELECT COUNT(*)::int AS count FROM customer_orders
                WHERE user_id = $1 AND status = ANY($2::text[])`, [id, unfinishedStatuses]);
            const count = unfinished.rows[0].count;
            if (count > 0 && !confirm_unfinished_orders) {
                const error = new Error('This customer has unfinished orders. Confirm to lock the account.');
                Object.assign(error, { status: 409, code: 'UNFINISHED_ORDERS', unfinished_order_count: count });
                throw error;
            }
        }
        const updated = await client.query(`UPDATE users SET is_locked = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING ${columns}`, [id, is_locked]);
        await client.query(`INSERT INTO admin_account_audit
            (admin_id, customer_id, action, reason, was_locked, is_locked)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [adminId, id, is_locked ? 'LOCK' : 'UNLOCK', reason, customer.is_locked, is_locked]);
        await client.query('COMMIT');
        return { data: updated.rows[0], changed: true };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}

module.exports = { list, profile, history, changeStatus, unfinishedStatuses };
