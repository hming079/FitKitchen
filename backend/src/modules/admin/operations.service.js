const pool = require('../../config/database');
const { getOrderItems } = require('../order/order.service');

const transitions = new Map([
    ['PENDING', ['PREPARING', 'CANCELLED']],
    ['PREPARING', ['DELIVERING', 'CANCELLED']],
    ['DELIVERING', ['COMPLETED']],
]);

const orderFields = `o.id::text AS id, COALESCE(u.full_name, a.recipient_name) AS customer_name,
    o.created_at AT TIME ZONE current_setting('TimeZone') AS created_at,
    to_char(o.delivery_date, 'YYYY-MM-DD') AS delivery_date, o.delivery_time_slot,
    o.total_amount::text, o.status, o.payment_method, o.payment_status`;
const ordersFrom = `customer_orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN user_addresses a ON a.id = o.address_id`;
const newestFirst = 'o.created_at DESC NULLS LAST, o.id DESC';

function problem(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

function orderSummary(order) {
    return { ...order, next_statuses: transitions.get(order.status) ?? [] };
}

async function listOrders(search, { page, page_size }) {
    if (typeof search !== 'string' || search.length > 200) {
        throw problem(400, 'VALIDATION_ERROR', 'search must be at most 200 characters');
    }
    const pattern = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
    const where = `o.id::text ILIKE $1 OR CONCAT('#', o.id) ILIKE $1
        OR COALESCE(u.full_name, a.recipient_name) ILIKE $1 OR u.email ILIKE $1`;
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const count = await client.query(`SELECT COUNT(*)::int AS total FROM ${ordersFrom} WHERE ${where}`, [pattern]);
        const result = await client.query(`SELECT ${orderFields} FROM ${ordersFrom} WHERE ${where}
            ORDER BY ${newestFirst} LIMIT $2 OFFSET $3`, [pattern, page_size, (page - 1) * page_size]);
        await client.query('COMMIT');
        return {
            data: result.rows.map(orderSummary),
            pagination: { page, page_size, total: count.rows[0].total },
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function orderDetails(id) {
    const { rows: [order] } = await pool.query(
        `SELECT ${orderFields}, o.shipping_fee, a.recipient_name, a.address_detail
         FROM ${ordersFrom} WHERE o.id = $1`, [id],
    );
    if (!order) throw problem(404, 'ORDER_NOT_FOUND', 'Order not found');
    return { ...orderSummary(order), items: await getOrderItems(id) };
}

async function updateStatus(id, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => !['status', 'expected_status'].includes(key)) ||
        !transitions.get(body.expected_status)?.includes(body.status)) {
        throw problem(400, 'VALIDATION_ERROR', 'Order status transition is not supported');
    }
    // ONLINE orders must be PAID before preparation; checked in the same atomic UPDATE.
    const { rows: [updated] } = await pool.query(
        `UPDATE customer_orders SET status = $2 WHERE id = $1 AND status = $3
         AND NOT ($4 AND payment_method = 'ONLINE' AND payment_status IS DISTINCT FROM 'PAID')
         RETURNING id, status`,
        [id, body.status, body.expected_status, body.status === 'PREPARING'],
    );
    if (updated) return updated;

    const { rows: [current] } = await pool.query(
        'SELECT id, status, payment_method, payment_status FROM customer_orders WHERE id = $1', [id],
    );
    if (!current) throw problem(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (current.status === body.status) return { id: current.id, status: current.status };
    if (body.status === 'PREPARING' && current.status === body.expected_status &&
        current.payment_method === 'ONLINE' && current.payment_status !== 'PAID') {
        throw problem(409, 'PAYMENT_REQUIRED', 'Online orders must be paid before preparation');
    }
    throw problem(409, 'ORDER_STATUS_CHANGED', 'This order has changed. Review its current status and try again.');
}

async function overview(range) {
    if (!['this_week', 'last_week', 'this_month'].includes(range)) {
        throw problem(400, 'VALIDATION_ERROR', 'range must be this_week, last_week or this_month');
    }

    // Orders store a database-local timestamp. Convert the kitchen's date boundaries
    // to that timestamp before filtering, and group paid orders by their placement date.
    const { rows: [summary] } = await pool.query(`
        WITH calendar AS (
            SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today
        ), periods AS (
            SELECT today, date_trunc('week', today::timestamp)::date AS week_start,
                date_trunc('month', today::timestamp)::date AS month_start
            FROM calendar
        ), bounds AS (
            SELECT today, week_start,
                CASE $1 WHEN 'last_week' THEN week_start - 7 WHEN 'this_month' THEN month_start ELSE week_start END AS start_date,
                CASE $1 WHEN 'last_week' THEN week_start ELSE today + 1 END AS end_date
            FROM periods
        ), paid_orders AS (
            SELECT o.total_amount,
                ((o.created_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day
            FROM customer_orders o CROSS JOIN bounds b
            WHERE o.payment_status = 'PAID' AND o.status IS DISTINCT FROM 'CANCELLED'
              AND o.created_at >= ((LEAST(b.start_date, b.today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
              AND o.created_at < (((b.today + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
        ), daily AS (
            SELECT day, SUM(total_amount) AS revenue, COUNT(*) AS orders FROM paid_orders GROUP BY day
        ), top_meal AS (
            SELECT m.name, SUM(i.quantity)::int AS quantity, COUNT(DISTINCT o.id)::int AS order_count
            FROM order_items i JOIN meals m ON m.id = i.meal_id JOIN customer_orders o ON o.id = i.order_id
            CROSS JOIN bounds b
            WHERE o.status IS DISTINCT FROM 'CANCELLED'
              AND o.created_at >= ((b.week_start::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
              AND o.created_at < (((b.today + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
            GROUP BY m.id, m.name ORDER BY quantity DESC, m.id LIMIT 1
        )
        SELECT COALESCE((SELECT revenue FROM daily WHERE day = b.today), 0) AS daily_revenue,
            COALESCE((SELECT revenue FROM daily WHERE day = b.today - 1), 0) AS previous_daily_revenue,
            COALESCE((SELECT SUM(revenue) FROM daily WHERE day >= b.start_date AND day < b.end_date), 0) AS period_revenue,
            (SELECT ROUND(SUM(revenue) / NULLIF(SUM(orders), 0), 2)
                FROM daily WHERE day >= b.start_date AND day < b.end_date) AS average_order_value,
            (SELECT COUNT(*)::int FROM customer_orders WHERE status = 'PENDING') AS pending_orders,
            (SELECT COUNT(*)::int FROM customer_orders
                WHERE delivery_date = b.today AND status IN ('PENDING', 'PREPARING', 'DELIVERING')) AS deliveries_today,
            (SELECT COUNT(*)::int FROM user_subscriptions
                WHERE status = 'ACTIVE' AND b.today BETWEEN start_date AND end_date) AS active_subscriptions,
            (SELECT row_to_json(top_meal) FROM top_meal) AS top_meal,
            (SELECT json_agg(json_build_object('date', to_char(days.day, 'YYYY-MM-DD'),
                                               'revenue', COALESCE(d.revenue, 0)::text) ORDER BY days.day)
                FROM generate_series(b.start_date::timestamp, (b.end_date - 1)::timestamp, interval '1 day') days(day)
                LEFT JOIN daily d ON d.day = days.day::date) AS revenue_series,
            (SELECT COALESCE(json_agg(to_jsonb(recent) - 'sort_date' - 'sort_id'
                ORDER BY sort_date DESC NULLS LAST, sort_id DESC), '[]'::json) FROM (
                SELECT ${orderFields}, o.created_at AS sort_date, o.id AS sort_id
                FROM ${ordersFrom} ORDER BY ${newestFirst} LIMIT 4
            ) recent) AS recent_orders
        FROM bounds b`, [range]);

    return {
        ...summary,
        recent_orders: summary.recent_orders.map(orderSummary),
    };
}

module.exports = { overview, listOrders, orderDetails, updateStatus };
