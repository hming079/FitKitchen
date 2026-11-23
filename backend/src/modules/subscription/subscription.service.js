const pool = require('../../config/database');
const { MIN_LEAD_DAYS, MAX_LEAD_DAYS } = require('./subscription.validation');

// Start/end dates are kitchen calendar days, so "today" follows the kitchen's
// timezone rather than the database server's timezone.
const TODAY = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
const OPEN_STATUSES = ['PENDING', 'ACTIVE'];
const STATUS_TRANSITIONS = { PENDING: ['ACTIVE', 'CANCELLED'], ACTIVE: ['CANCELLED'] };

function httpError(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

async function transaction(work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

function giftsJson(where, { withStatus = false } = {}) {
    return `COALESCE((
        SELECT json_agg(json_build_object(
            'id', g.id::text,
            'product_id', g.product_id::text,
            'product_name', pr.name,
            'gift_name', g.gift_name,
            'description', g.description,
            'quantity', g.quantity${withStatus ? ", 'status', g.status" : ''}
        ) ORDER BY g.id)
        FROM subscription_gifts g
        LEFT JOIN products pr ON pr.id = g.product_id
        WHERE ${where}
    ), '[]'::json) AS gifts`;
}

// Template gifts belong to a plan; gifts issued at checkout belong to a subscription.
const templateGifts = giftsJson('g.plan_id = p.id AND g.subscription_id IS NULL');
const issuedGifts = giftsJson('g.subscription_id = s.id', { withStatus: true });
const planColumns = 'p.id, p.name, p.description, p.duration_days, p.meals_per_day, p.price, p.is_active';
const phase = `CASE
    WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
    WHEN s.status = 'PENDING' THEN 'PENDING'
    WHEN s.end_date < ${TODAY} THEN 'ENDED'
    WHEN s.start_date > ${TODAY} THEN 'UPCOMING'
    ELSE 'IN_PROGRESS'
END`;
const subscriptionColumns = `s.id, p.id AS plan_id, p.name AS plan_name, p.duration_days, p.meals_per_day,
    to_char(s.start_date, 'YYYY-MM-DD') AS start_date, to_char(s.end_date, 'YYYY-MM-DD') AS end_date,
    s.status, ${phase} AS phase, s.payment_method, s.payment_status, s.total_amount, s.created_at,
    a.recipient_name, a.phone AS address_phone, a.address_detail, ${issuedGifts}`;
const subscriptionFrom = `user_subscriptions s
    JOIN subscription_plans p ON p.id = s.plan_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_addresses a ON a.id = s.address_id`;
const adminSubscriptionColumns = `${subscriptionColumns}, s.user_id, u.full_name AS customer_name,
    u.email AS customer_email, u.phone AS customer_phone`;

async function checkoutWindow(db = pool) {
    const { rows } = await db.query(
        `SELECT to_char(${TODAY} + $1::int, 'YYYY-MM-DD') AS earliest_start_date,
                to_char(${TODAY} + $2::int, 'YYYY-MM-DD') AS latest_start_date`,
        [MIN_LEAD_DAYS, MAX_LEAD_DAYS]
    );
    return rows[0];
}

async function listPublicPlans() {
    const [plans, window] = await Promise.all([
        pool.query(`SELECT ${planColumns}, ${templateGifts} FROM subscription_plans p
            WHERE p.is_active = TRUE ORDER BY p.duration_days, p.price, p.id`),
        checkoutWindow()
    ]);
    return { data: plans.rows, checkout_window: window };
}

async function findPublicPlan(id) {
    const { rows } = await pool.query(`SELECT ${planColumns}, ${templateGifts} FROM subscription_plans p
        WHERE p.id = $1 AND p.is_active = TRUE`, [id]);
    if (!rows[0]) throw httpError(404, 'PLAN_NOT_FOUND', 'This plan is not available');
    return { data: rows[0], checkout_window: await checkoutWindow() };
}

async function findSubscription(id, db = pool, columns = subscriptionColumns) {
    const { rows } = await db.query(`SELECT ${columns} FROM ${subscriptionFrom} WHERE s.id = $1`, [id]);
    return rows[0];
}

async function listCustomerSubscriptions(userId) {
    const { rows } = await pool.query(`SELECT ${subscriptionColumns} FROM ${subscriptionFrom}
        WHERE s.user_id = $1 ORDER BY s.start_date DESC, s.id DESC LIMIT 100`, [userId]);
    return rows;
}

function displayDate(value) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
}

async function checkout(userId, { plan_id, address_id, start_date, payment_method }) {
    return transaction(async client => {
        // Serialize checkouts per customer so two requests cannot both pass the overlap check.
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const plan = (await client.query(
            'SELECT id, name, duration_days, price FROM subscription_plans WHERE id = $1 AND is_active = TRUE FOR SHARE',
            [plan_id]
        )).rows[0];
        if (!plan) throw httpError(404, 'PLAN_NOT_FOUND', 'This plan is no longer available');

        const address = await client.query('SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2', [address_id, userId]);
        if (!address.rows[0]) throw httpError(400, 'ADDRESS_NOT_FOUND', 'Choose one of your saved delivery addresses');

        const dates = (await client.query(
            `SELECT to_char($1::date + ($2::int - 1), 'YYYY-MM-DD') AS end_date,
                    to_char(${TODAY} + $3::int, 'YYYY-MM-DD') AS earliest,
                    to_char(${TODAY} + $4::int, 'YYYY-MM-DD') AS latest,
                    $1::date < ${TODAY} + $3::int AS too_early,
                    $1::date > ${TODAY} + $4::int AS too_late`,
            [start_date, plan.duration_days, MIN_LEAD_DAYS, MAX_LEAD_DAYS]
        )).rows[0];
        if (dates.too_early || dates.too_late) {
            throw httpError(400, 'INVALID_START_DATE',
                `Choose a start date between ${displayDate(dates.earliest)} and ${displayDate(dates.latest)}`);
        }

        const overlap = (await client.query(
            `SELECT p.name, to_char(s.start_date, 'YYYY-MM-DD') AS start_date, to_char(s.end_date, 'YYYY-MM-DD') AS end_date
             FROM user_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
             WHERE s.user_id = $1 AND s.status = ANY($2::text[])
               AND s.start_date <= $4::date AND s.end_date >= $3::date
             ORDER BY s.start_date LIMIT 1`,
            [userId, OPEN_STATUSES, start_date, dates.end_date]
        )).rows[0];
        if (overlap) {
            throw httpError(409, 'SUBSCRIPTION_OVERLAP',
                `Your plan “${overlap.name}” already covers ${displayDate(overlap.start_date)}–${displayDate(overlap.end_date)}. ` +
                'Choose a start date after it ends.');
        }

        // The price is a snapshot: later plan edits never change what this customer owes.
        const created = await client.query(
            `INSERT INTO user_subscriptions
                (user_id, plan_id, address_id, start_date, end_date, status, payment_method, payment_status, auto_renew, total_amount)
             VALUES ($1, $2, $3, $4::date, $5::date, 'PENDING', $6, 'PENDING', FALSE, $7)
             RETURNING id`,
            [userId, plan.id, address_id, start_date, dates.end_date, payment_method, plan.price]
        );
        const subscriptionId = created.rows[0].id;
        await client.query(
            `INSERT INTO subscription_gifts (subscription_id, product_id, gift_name, description, quantity, status)
             SELECT $1, product_id, gift_name, description, quantity, 'PENDING'
             FROM subscription_gifts WHERE plan_id = $2 AND subscription_id IS NULL ORDER BY id`,
            [subscriptionId, plan.id]
        );
        return findSubscription(subscriptionId, client);
    });
}

const adminPlanColumns = `${planColumns}, ${templateGifts},
    (SELECT COUNT(*)::int FROM user_subscriptions s WHERE s.plan_id = p.id
        AND s.status = 'ACTIVE' AND ${TODAY} BETWEEN s.start_date AND s.end_date) AS in_progress_count,
    (SELECT COUNT(*)::int FROM user_subscriptions s WHERE s.plan_id = p.id AND s.status = 'PENDING') AS pending_count`;

async function listAdminPlans() {
    const { rows } = await pool.query(`SELECT ${adminPlanColumns} FROM subscription_plans p
        ORDER BY p.is_active DESC NULLS LAST, p.duration_days, p.id LIMIT 200`);
    return rows;
}

async function findAdminPlan(id, db = pool) {
    const { rows } = await db.query(`SELECT ${adminPlanColumns} FROM subscription_plans p WHERE p.id = $1`, [id]);
    return rows[0];
}

async function assertProductsExist(db, gifts) {
    const ids = [...new Set(gifts.map(gift => gift.product_id).filter(Boolean))];
    if (!ids.length) return;
    const { rows } = await db.query('SELECT id FROM products WHERE id = ANY($1::bigint[])', [ids]);
    if (rows.length !== ids.length) throw httpError(400, 'VALIDATION_ERROR', 'A linked gift product no longer exists');
}

async function replaceTemplateGifts(db, planId, gifts) {
    await assertProductsExist(db, gifts);
    await db.query('DELETE FROM subscription_gifts WHERE plan_id = $1 AND subscription_id IS NULL', [planId]);
    for (const gift of gifts) {
        await db.query(
            `INSERT INTO subscription_gifts (plan_id, product_id, gift_name, description, quantity, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
            [planId, gift.product_id, gift.gift_name, gift.description, gift.quantity]
        );
    }
}

async function createPlan({ gifts, ...plan }) {
    return transaction(async client => {
        const { rows } = await client.query(
            `INSERT INTO subscription_plans (name, description, duration_days, meals_per_day, price, is_active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [plan.name, plan.description ?? null, plan.duration_days, plan.meals_per_day, plan.price, plan.is_active]
        );
        await replaceTemplateGifts(client, rows[0].id, gifts);
        return findAdminPlan(rows[0].id, client);
    });
}

async function updatePlan(id, { gifts, ...fields }) {
    return transaction(async client => {
        const existing = await client.query('SELECT id FROM subscription_plans WHERE id = $1 FOR UPDATE', [id]);
        if (!existing.rows[0]) throw httpError(404, 'PLAN_NOT_FOUND', 'Plan not found');
        const entries = Object.entries(fields);
        if (entries.length) {
            // Column names come from the validator's fixed allow-list.
            const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
            await client.query(
                `UPDATE subscription_plans SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [id, ...entries.map(([, value]) => value)]
            );
        }
        if (gifts !== undefined) await replaceTemplateGifts(client, id, gifts);
        return findAdminPlan(id, client);
    });
}

function escapeLike(value) {
    return value.replace(/[\\%_]/g, '\\$&');
}

const viewConditions = {
    all: 'TRUE',
    in_progress: `s.status = 'ACTIVE' AND ${TODAY} BETWEEN s.start_date AND s.end_date`,
    upcoming: `s.status = 'ACTIVE' AND s.start_date > ${TODAY}`,
    pending: "s.status = 'PENDING'",
    ended: `s.status = 'ACTIVE' AND s.end_date < ${TODAY}`,
    cancelled: "s.status = 'CANCELLED'"
};

async function listAdminSubscriptions({ search, view, plan_id, page, page_size }) {
    const where = `${viewConditions[view]}
        AND ($1 = '' OR u.full_name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2)
        AND ($3::bigint IS NULL OR s.plan_id = $3::bigint)`;
    const params = [search, `%${escapeLike(search)}%`, plan_id];
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const count = await client.query(`SELECT COUNT(*)::int AS total FROM ${subscriptionFrom} WHERE ${where}`, params);
        const result = await client.query(
            `SELECT ${adminSubscriptionColumns} FROM ${subscriptionFrom} WHERE ${where}
             ORDER BY s.created_at DESC, s.id DESC LIMIT $4 OFFSET $5`,
            [...params, page_size, (page - 1) * page_size]
        );
        await client.query('COMMIT');
        return { data: result.rows, pagination: { page, page_size, total: count.rows[0].total } };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function updateSubscription(id, { status, payment_status }) {
    return transaction(async client => {
        const current = (await client.query(
            `SELECT id, status, payment_status, end_date < ${TODAY} AS ended
             FROM user_subscriptions WHERE id = $1 FOR UPDATE`,
            [id]
        )).rows[0];
        if (!current) throw httpError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

        const nextStatus = status && status !== current.status ? status : null;
        if (nextStatus) {
            if (!STATUS_TRANSITIONS[current.status]?.includes(nextStatus)) {
                throw httpError(409, 'INVALID_TRANSITION', `A ${String(current.status).toLowerCase()} subscription cannot become ${nextStatus.toLowerCase()}`);
            }
            if (nextStatus === 'ACTIVE' && current.ended) {
                throw httpError(409, 'SUBSCRIPTION_ENDED', 'This subscription’s dates have already passed. Cancel it instead.');
            }
        }
        const nextPayment = payment_status && payment_status !== current.payment_status ? payment_status : null;
        if (nextPayment) {
            if (current.status === 'CANCELLED' || nextStatus === 'CANCELLED') {
                throw httpError(409, 'INVALID_TRANSITION', 'Payment cannot be recorded for a cancelled subscription');
            }
            if (current.payment_status !== 'PENDING') {
                throw httpError(409, 'INVALID_TRANSITION', 'Only unpaid subscriptions can be marked as paid');
            }
        }

        if (nextStatus || nextPayment) {
            await client.query(
                `UPDATE user_subscriptions
                 SET status = COALESCE($2, status), payment_status = COALESCE($3, payment_status), updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id, nextStatus, nextPayment]
            );
        }
        if (nextStatus === 'CANCELLED') {
            await client.query(
                "UPDATE subscription_gifts SET status = 'CANCELLED' WHERE subscription_id = $1 AND status = 'PENDING'",
                [id]
            );
        }
        return {
            data: await findSubscription(id, client, adminSubscriptionColumns),
            changed: Boolean(nextStatus || nextPayment)
        };
    });
}

module.exports = {
    checkoutWindow,
    listPublicPlans,
    findPublicPlan,
    listCustomerSubscriptions,
    checkout,
    listAdminPlans,
    findAdminPlan,
    createPlan,
    updatePlan,
    listAdminSubscriptions,
    updateSubscription
};
