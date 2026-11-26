const pool = require("../../config/database");
const { code: normalizeCode, validatePromotion } = require("./promotion.validation");

function problem(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function cents(value) {
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result)) throw problem(409, "INVALID_AMOUNT", "Order amount is not supported");
  return result;
}

function money(value) {
  return (value / 100).toFixed(2);
}

function promotionRow(row) {
  return {
    ...row,
    id: String(row.id),
    discount_value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount),
    max_discount_amount: row.max_discount_amount === null ? null : Number(row.max_discount_amount),
  };
}

function mapWriteError(error) {
  if (error.code === "23505")
    return problem(409, "PROMOTION_CODE_EXISTS", "A promotion with this code already exists");
  if (error.code === "23514")
    return problem(400, "VALIDATION_ERROR", "Promotion values do not satisfy the promotion rules");
  return error;
}

async function listAdmin({ page, page_size }) {
  const [count, rows] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM promotions"),
    pool.query(
      `SELECT p.id, p.code, p.description, p.discount_type, p.discount_value::text,
              p.min_order_amount::text, p.max_discount_amount::text,
              to_char(p.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(p.end_date, 'YYYY-MM-DD') AS end_date,
              p.usage_limit, p.per_user_limit, p.is_active, p.created_at, p.updated_at,
              (SELECT COUNT(*)::int FROM customer_orders o
              WHERE o.promotion_id = p.id AND o.status IS DISTINCT FROM 'CANCELLED') AS redemption_count
       FROM promotions p
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC
       LIMIT $1 OFFSET $2`,
      [page_size, (page - 1) * page_size],
    ),
  ]);
  return {
    data: rows.rows.map(promotionRow),
    pagination: { page, page_size, total: count.rows[0].total },
  };
}

async function createPromotion(input) {
  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO promotions
        (code, description, discount_type, discount_value, min_order_amount, max_discount_amount,
         start_date, end_date, usage_limit, per_user_limit, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11)
       RETURNING id, code, description, discount_type, discount_value::text, min_order_amount::text,
         max_discount_amount::text, to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date, 'YYYY-MM-DD') AS end_date, usage_limit, per_user_limit, is_active,
         created_at, updated_at, 0::int AS redemption_count`,
      [
        input.code,
        input.description,
        input.discount_type,
        input.discount_value,
        input.min_order_amount,
        input.max_discount_amount,
        input.start_date,
        input.end_date,
        input.usage_limit,
        input.per_user_limit,
        input.is_active,
      ],
    );
    return promotionRow(row);
  } catch (error) {
    throw mapWriteError(error);
  }
}

async function updatePromotion(id, patch) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [existing] } = await client.query(
      `SELECT code, description, discount_type, discount_value::text, min_order_amount::text,
              max_discount_amount::text, to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date, usage_limit, per_user_limit, is_active
       FROM promotions WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing) throw problem(404, "PROMOTION_NOT_FOUND", "Promotion not found");
    const merged = validatePromotion({ ...existing, ...patch });
    const { rows: [row] } = await client.query(
      `UPDATE promotions SET code = $2, description = $3, discount_type = $4, discount_value = $5,
          min_order_amount = $6, max_discount_amount = $7, start_date = $8::date, end_date = $9::date,
          usage_limit = $10, per_user_limit = $11, is_active = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, code, description, discount_type, discount_value::text, min_order_amount::text,
          max_discount_amount::text, to_char(start_date, 'YYYY-MM-DD') AS start_date,
          to_char(end_date, 'YYYY-MM-DD') AS end_date, usage_limit, per_user_limit, is_active,
          created_at, updated_at,
          (SELECT COUNT(*)::int FROM customer_orders o
           WHERE o.promotion_id = promotions.id AND o.status IS DISTINCT FROM 'CANCELLED') AS redemption_count`,
      [
        id,
        merged.code,
        merged.description,
        merged.discount_type,
        merged.discount_value,
        merged.min_order_amount,
        merged.max_discount_amount,
        merged.start_date,
        merged.end_date,
        merged.usage_limit,
        merged.per_user_limit,
        merged.is_active,
      ],
    );
    await client.query("COMMIT");
    return promotionRow(row);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw mapWriteError(error);
  } finally {
    client.release();
  }
}

async function calculateOffer(db, userId, submittedCode, subtotalCents, { lock = false } = {}) {
  const normalized = normalizeCode(submittedCode);
  const { rows: [promotion] } = await db.query(
    `SELECT id, code, description, discount_type, discount_value::text, min_order_amount::text,
            max_discount_amount::text, to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date, usage_limit, per_user_limit, is_active
     FROM promotions WHERE UPPER(code) = $1${lock ? " FOR UPDATE" : ""}`,
    [normalized],
  );
  if (!promotion || !promotion.is_active)
    throw problem(400, "PROMOTION_UNAVAILABLE", "This promotion code is not available");

  const { rows: [calendar] } = await db.query(
    "SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today",
  );
  if ((promotion.start_date && promotion.start_date > calendar.today) ||
      (promotion.end_date && promotion.end_date < calendar.today))
    throw problem(400, "PROMOTION_UNAVAILABLE", "This promotion code is not currently valid");
  if (subtotalCents < cents(promotion.min_order_amount))
    throw problem(400, "PROMOTION_MINIMUM_NOT_MET", "Your cart does not meet this code’s minimum order amount");

  const { rows: [usage] } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE user_id = $2)::int AS customer
     FROM customer_orders
     WHERE promotion_id = $1 AND status IS DISTINCT FROM 'CANCELLED'`,
    [promotion.id, userId],
  );
  if (promotion.usage_limit !== null && usage.total >= promotion.usage_limit)
    throw problem(400, "PROMOTION_LIMIT_REACHED", "This promotion has reached its usage limit");
  if (promotion.per_user_limit !== null && usage.customer >= promotion.per_user_limit)
    throw problem(400, "PROMOTION_LIMIT_REACHED", "You have already used this promotion the maximum number of times");

  // Integer arithmetic (value in hundredths of a percent) avoids floating-point drift.
  let discountCents = promotion.discount_type === "PERCENTAGE"
    ? Number(BigInt(subtotalCents) * BigInt(cents(promotion.discount_value)) / 10000n)
    : cents(promotion.discount_value);
  if (promotion.max_discount_amount !== null)
    discountCents = Math.min(discountCents, cents(promotion.max_discount_amount));
  discountCents = Math.min(discountCents, subtotalCents);
  return {
    promotion_id: String(promotion.id),
    code: promotion.code,
    discount_type: promotion.discount_type,
    discount_value: Number(promotion.discount_value),
    subtotal: money(subtotalCents),
    discount_amount: money(discountCents),
    total_amount: money(subtotalCents - discountCents),
  };
}

async function validateForCart(userId, submittedCode, subtotal) {
  const subtotalCents = cents(subtotal);
  if (subtotalCents <= 0) throw problem(409, "CART_EMPTY", "Add a meal before applying a promotion");
  return calculateOffer(pool, userId, submittedCode, subtotalCents);
}

module.exports = {
  listAdmin,
  createPromotion,
  updatePromotion,
  calculateOffer,
  validateForCart,
  cents,
  money,
  problem,
};
