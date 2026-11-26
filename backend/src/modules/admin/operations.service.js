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
    o.total_amount::text, o.subtotal_amount::text, o.discount_amount::text, o.promotion_code,
    o.status, o.payment_method, o.payment_status`;
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

const MAX_DAILY_SPAN_DAYS = 366;
const MAX_MONTHLY_SPAN_DAYS = 1830;
const PRESET_RANGES = new Set(['this_week', 'last_week', 'this_month', 'last_month']);

function parseCalendarDate(value, field) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw problem(400, 'VALIDATION_ERROR', `${field} must use YYYY-MM-DD format`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
        throw problem(400, 'VALIDATION_ERROR', `${field} must be a valid calendar date`);
    }
    return { value, time: parsed.valueOf() };
}

function parseOverviewQuery(input = {}) {
    const query = typeof input === 'string' ? { range: input } : (input || {});
    const group_by = query.group_by === undefined ? 'day' : query.group_by;
    if (group_by !== 'day' && group_by !== 'month') {
        throw problem(400, 'VALIDATION_ERROR', 'group_by must be day or month');
    }

    let top_limit = 5;
    if (query.top_limit !== undefined && query.top_limit !== '') {
        const raw = String(query.top_limit);
        if (!/^[1-9]\d*$/.test(raw) || Number(raw) > 20) {
            throw problem(400, 'VALIDATION_ERROR', 'top_limit must be an integer from 1 to 20');
        }
        top_limit = Number(raw);
    }

    const hasStart = query.start_date !== undefined && query.start_date !== '';
    const hasEnd = query.end_date !== undefined && query.end_date !== '';
    if (hasStart !== hasEnd) {
        throw problem(400, 'VALIDATION_ERROR', 'start_date and end_date must be provided together');
    }

    if (hasStart && hasEnd) {
        if (query.range !== undefined && query.range !== '' && query.range !== 'custom' && !PRESET_RANGES.has(query.range)) {
            throw problem(400, 'VALIDATION_ERROR', 'range must be this_week, last_week, this_month, last_month or custom');
        }
        const start = parseCalendarDate(query.start_date, 'start_date');
        const end = parseCalendarDate(query.end_date, 'end_date');
        if (end.time < start.time) {
            throw problem(400, 'VALIDATION_ERROR', 'end_date must be on or after start_date');
        }
        const spanDays = Math.floor((end.time - start.time) / 86400000) + 1;
        if (group_by === 'day' && spanDays > MAX_DAILY_SPAN_DAYS) {
            throw problem(400, 'VALIDATION_ERROR', 'Daily overview supports at most 366 days');
        }
        if (group_by === 'month' && spanDays > MAX_MONTHLY_SPAN_DAYS) {
            throw problem(400, 'VALIDATION_ERROR', 'Overview date range must not exceed 5 years');
        }
        return {
            range: 'custom',
            start_date: start.value,
            end_date: end.value,
            group_by,
            top_limit,
        };
    }

    const range = query.range === undefined || query.range === '' ? 'this_week' : query.range;
    if (!PRESET_RANGES.has(range)) {
        throw problem(400, 'VALIDATION_ERROR', 'range must be this_week, last_week, this_month or last_month');
    }
    return {
        range,
        start_date: null,
        end_date: null,
        group_by,
        top_limit,
    };
}

async function updateStatus(id, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => !['status', 'expected_status'].includes(key)) ||
        !transitions.get(body.expected_status)?.includes(body.status)) {
        throw problem(400, 'VALIDATION_ERROR', 'Order status transition is not supported');
    }
    // ONLINE orders must be PAID before preparation; COD orders become PAID upon completion.
    const { rows: [updated] } = await pool.query(
        `UPDATE customer_orders
         SET status = $2,
             payment_status = CASE
                 WHEN $2 = 'COMPLETED' AND payment_method = 'COD' AND payment_status IS DISTINCT FROM 'PAID'
                 THEN 'PAID'
                 ELSE payment_status
             END
         WHERE id = $1 AND status = $3
           AND NOT ($4 AND payment_method = 'ONLINE' AND payment_status IS DISTINCT FROM 'PAID')
         RETURNING id, status, payment_status`,
        [id, body.status, body.expected_status, body.status === 'PREPARING'],
    );
    if (updated) return updated;

    const { rows: [current] } = await pool.query(
        'SELECT id, status, payment_method, payment_status FROM customer_orders WHERE id = $1', [id],
    );
    if (!current) throw problem(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (current.status === body.status) {
        return { id: current.id, status: current.status, payment_status: current.payment_status };
    }
    if (body.status === 'PREPARING' && current.status === body.expected_status &&
        current.payment_method === 'ONLINE' && current.payment_status !== 'PAID') {
        throw problem(409, 'PAYMENT_REQUIRED', 'Online orders must be paid before preparation');
    }
    throw problem(409, 'ORDER_STATUS_CHANGED', 'This order has changed. Review its current status and try again.');
}

async function overview(input) {
    const { range, start_date, end_date, group_by, top_limit } = parseOverviewQuery(input);

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
                CASE
                    WHEN $2::date IS NOT NULL THEN $2::date
                    WHEN $1 = 'last_week' THEN week_start - 7
                    WHEN $1 = 'this_month' THEN month_start
                    WHEN $1 = 'last_month' THEN (month_start - INTERVAL '1 month')::date
                    ELSE week_start
                END AS start_date,
                CASE
                    WHEN $3::date IS NOT NULL THEN ($3::date + 1)
                    WHEN $1 = 'last_week' THEN week_start
                    WHEN $1 = 'last_month' THEN month_start
                    ELSE today + 1
                END AS end_date
            FROM periods
        ), paid_orders AS (
            SELECT o.total_amount,
                ((o.created_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
                b.start_date, b.end_date
            FROM customer_orders o CROSS JOIN bounds b
            WHERE o.payment_status = 'PAID' AND o.status IS DISTINCT FROM 'CANCELLED'
              AND o.created_at >= ((LEAST(b.start_date, b.today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
              AND o.created_at < ((GREATEST(b.end_date, b.today + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
        ), daily AS (
            SELECT day, SUM(total_amount) AS revenue, COUNT(*) AS orders FROM paid_orders GROUP BY day
        ), monthly AS (
            SELECT date_trunc('month', day::timestamp)::date AS month_start,
                SUM(total_amount) AS revenue, COUNT(*) AS orders
            FROM paid_orders
            WHERE day >= start_date AND day < end_date
            GROUP BY 1
        ), top_meals AS (
            SELECT m.id::text AS meal_id, m.name,
                SUM(i.quantity)::int AS quantity,
                COUNT(DISTINCT o.id)::int AS order_count,
                COALESCE(SUM(i.quantity * i.unit_price), 0)::numeric(12,2)::text AS revenue
            FROM order_items i JOIN meals m ON m.id = i.meal_id JOIN customer_orders o ON o.id = i.order_id
            CROSS JOIN bounds b
            WHERE o.payment_status = 'PAID' AND o.status IS DISTINCT FROM 'CANCELLED'
              AND o.created_at >= ((b.start_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
              AND o.created_at < ((b.end_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE current_setting('TimeZone'))
            GROUP BY m.id, m.name
            ORDER BY quantity DESC, SUM(i.quantity * i.unit_price) DESC, m.id ASC
            LIMIT $5
        ), ended_subscriptions AS (
            SELECT DISTINCT s.user_id, s.id, s.end_date
            FROM user_subscriptions s CROSS JOIN bounds b
            WHERE s.status = 'ACTIVE' AND s.payment_status = 'PAID'
              AND s.end_date >= b.start_date
              AND s.end_date < LEAST(b.end_date, b.today)
        ), renewal_metrics AS (
            SELECT COUNT(DISTINCT ended.user_id)::int AS eligible_customers,
                COUNT(DISTINCT ended.user_id) FILTER (WHERE EXISTS (
                    SELECT 1 FROM user_subscriptions next
                    WHERE next.user_id = ended.user_id
                      AND next.status = 'ACTIVE' AND next.payment_status = 'PAID'
                      AND next.start_date > ended.end_date
                      AND next.start_date <= ended.end_date + 7
                ))::int AS renewed_customers
            FROM ended_subscriptions ended
        )
        SELECT to_char(b.start_date, 'YYYY-MM-DD') AS period_start,
            to_char(b.end_date - 1, 'YYYY-MM-DD') AS period_end,
            COALESCE((SELECT revenue FROM daily WHERE day = b.today), 0) AS daily_revenue,
            COALESCE((SELECT revenue FROM daily WHERE day = b.today - 1), 0) AS previous_daily_revenue,
            COALESCE((SELECT SUM(revenue) FROM daily WHERE day >= b.start_date AND day < b.end_date), 0) AS period_revenue,
            (SELECT ROUND(SUM(revenue) / NULLIF(SUM(orders), 0), 2)
                FROM daily WHERE day >= b.start_date AND day < b.end_date) AS average_order_value,
            (SELECT COUNT(*)::int FROM customer_orders WHERE status = 'PENDING') AS pending_orders,
            (SELECT COUNT(*)::int FROM customer_orders
                WHERE delivery_date = b.today AND status IN ('PENDING', 'PREPARING', 'DELIVERING')) AS deliveries_today,
            (SELECT COUNT(*)::int FROM user_subscriptions
                WHERE status = 'ACTIVE' AND b.today BETWEEN start_date AND end_date) AS active_subscriptions,
            rm.eligible_customers AS renewal_eligible_customers,
            rm.renewed_customers,
            ROUND(100.0 * rm.renewed_customers / NULLIF(rm.eligible_customers, 0), 1)::text AS renewal_rate,
            (SELECT COALESCE(json_agg(tm ORDER BY tm.quantity DESC, tm.revenue::numeric DESC, tm.meal_id::bigint ASC), '[]'::json)
                FROM top_meals tm) AS top_meals,
            CASE WHEN $4 = 'month' THEN
                (SELECT COALESCE(json_agg(json_build_object(
                    'date', to_char(months.month_start, 'YYYY-MM-DD'),
                    'label', to_char(months.month_start, 'YYYY-MM'),
                    'revenue', COALESCE(m.revenue, 0)::text,
                    'orders', COALESCE(m.orders, 0)::int
                ) ORDER BY months.month_start), '[]'::json)
                FROM generate_series(
                    date_trunc('month', b.start_date::timestamp),
                    date_trunc('month', (b.end_date - 1)::timestamp),
                    interval '1 month'
                ) months(month_start)
                LEFT JOIN monthly m ON m.month_start = months.month_start::date)
            ELSE
                (SELECT COALESCE(json_agg(json_build_object(
                    'date', to_char(days.day, 'YYYY-MM-DD'),
                    'label', to_char(days.day, 'YYYY-MM-DD'),
                    'revenue', COALESCE(d.revenue, 0)::text,
                    'orders', COALESCE(d.orders, 0)::int
                ) ORDER BY days.day), '[]'::json)
                FROM generate_series(b.start_date::timestamp, (b.end_date - 1)::timestamp, interval '1 day') days(day)
                LEFT JOIN daily d ON d.day = days.day::date)
            END AS revenue_series,
            (SELECT COALESCE(json_agg(to_jsonb(recent) - 'sort_date' - 'sort_id'
                ORDER BY sort_date DESC NULLS LAST, sort_id DESC), '[]'::json) FROM (
                SELECT ${orderFields}, o.created_at AS sort_date, o.id AS sort_id
                FROM ${ordersFrom} ORDER BY ${newestFirst} LIMIT 4
            ) recent) AS recent_orders
        FROM bounds b CROSS JOIN renewal_metrics rm`, [range, start_date, end_date, group_by, top_limit]);

    return {
        ...summary,
        group_by,
        top_meal: summary.top_meals[0] ?? null,
        recent_orders: summary.recent_orders.map(orderSummary),
    };
}

module.exports = { overview, parseOverviewQuery, listOrders, orderDetails, updateStatus };
