const pool = require("../../config/database");

function problem(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function cents(value) {
  return Math.round(Number(value) * 100);
}
function money(centsValue) {
  return (centsValue / 100).toFixed(2);
}

async function ensureCart(db, userId, lock = false) {
  await db.query(
    "INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    [userId],
  );
  const result = await db.query(
    `SELECT id FROM carts WHERE user_id = $1${lock ? " FOR UPDATE" : ""}`,
    [userId],
  );
  return result.rows[0].id;
}

async function cartData(db, userId) {
  const cartId = await ensureCart(db, userId);
  const { rows } = await db.query(
    `SELECT ci.id, ci.meal_id, ci.quantity, ci.options,
                m.name, m.description, m.image_url, m.price, m.calories, m.protein_g, m.carbs_g, m.fat_g,
                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id', o.id, 'name', o.name, 'price_adjustment', o.price_adjustment,
                    'calories_adjustment', o.calories_adjustment, 'protein_g_adjustment', o.protein_g_adjustment,
                    'carbs_g_adjustment', o.carbs_g_adjustment, 'fat_g_adjustment', o.fat_g_adjustment
                ) ORDER BY o.id) FROM cart_item_customizations cic
                    JOIN meal_customization_options o ON o.id = cic.option_id
                    WHERE cic.cart_item_id = ci.id), '[]'::jsonb) AS customizations
         FROM cart_items ci JOIN meals m ON m.id = ci.meal_id
         WHERE ci.cart_id = $1 ORDER BY ci.id`,
    [cartId],
  );
  const items = rows.map((item) => {
    const customizations = item.customizations.map((option) => ({
      ...option,
      price_adjustment: Number(option.price_adjustment),
    }));
    const unitCents = Math.max(
      0,
      cents(item.price) +
        customizations.reduce(
          (sum, option) => sum + cents(option.price_adjustment),
          0,
        ),
    );
    return {
      ...item,
      unit_price: money(unitCents),
      line_total: money(unitCents * item.quantity),
      customizations,
    };
  });
  const subtotalCents = items.reduce(
    (sum, item) => sum + cents(item.line_total),
    0,
  );
  return {
    id: String(cartId),
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: money(subtotalCents),
    currency: "VND",
  };
}

async function listCart(userId) {
  return cartData(pool, userId);
}

async function addCartItem(userId, { meal_id, quantity, option_ids }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cartId = await ensureCart(client, userId, true);
    const meal = await client.query(
      "SELECT id FROM meals WHERE id = $1 AND is_available = TRUE FOR SHARE",
      [meal_id],
    );
    if (!meal.rowCount)
      throw problem(
        404,
        "MEAL_UNAVAILABLE",
        "This meal is no longer available",
      );
    let options = [];
    if (option_ids.length) {
      const result = await client.query(
        `SELECT id FROM meal_customization_options WHERE meal_id = $1 AND is_available = TRUE AND id = ANY($2::bigint[]) ORDER BY id`,
        [meal_id, option_ids],
      );
      if (result.rowCount !== option_ids.length)
        throw problem(
          409,
          "OPTION_UNAVAILABLE",
          "One or more selected options are no longer available",
        );
      options = result.rows.map((row) => String(row.id));
    }
    const lines = await client.query(
      "SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND meal_id = $2 AND options IS NULL ORDER BY id FOR UPDATE",
      [cartId, meal_id],
    );
    let match = null;
    for (const line of lines.rows) {
      const chosen = await client.query(
        "SELECT option_id FROM cart_item_customizations WHERE cart_item_id = $1 ORDER BY option_id",
        [line.id],
      );
      if (
        chosen.rows.map((row) => String(row.option_id)).join(",") ===
        options.join(",")
      ) {
        match = line;
        break;
      }
    }
    let lineId;
    if (match) {
      const nextQuantity = match.quantity + quantity;
      if (nextQuantity > 99)
        throw problem(
          400,
          "QUANTITY_LIMIT",
          "A cart line cannot exceed 99 meals",
        );
      await client.query("UPDATE cart_items SET quantity = $2 WHERE id = $1", [
        match.id,
        nextQuantity,
      ]);
      lineId = match.id;
    } else {
      const count = await client.query(
        "SELECT COUNT(*)::int AS count FROM cart_items WHERE cart_id = $1",
        [cartId],
      );
      if (count.rows[0].count >= 100)
        throw problem(
          409,
          "CART_LIMIT",
          "Your cart has reached its 100-line limit",
        );
      const inserted = await client.query(
        "INSERT INTO cart_items (cart_id, meal_id, quantity, options) VALUES ($1, $2, $3, NULL) RETURNING id",
        [cartId, meal_id, quantity],
      );
      lineId = inserted.rows[0].id;
      if (options.length) {
        for (const optionId of options)
          await client.query(
            "INSERT INTO cart_item_customizations (cart_item_id, option_id) VALUES ($1, $2)",
            [lineId, optionId],
          );
      }
    }
    await client.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId],
    );
    const cart = await cartData(client, userId);
    await client.query("COMMIT");
    return cart;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function updateCartItem(userId, itemId, quantity) {
  const result = await pool.query(
    `UPDATE cart_items ci SET quantity = $3 FROM carts c
         WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.id = $2 RETURNING ci.id`,
    [userId, itemId, quantity],
  );
  if (!result.rowCount)
    throw problem(404, "CART_ITEM_NOT_FOUND", "Cart item not found");
  return cartData(pool, userId);
}

async function removeCartItem(userId, itemId) {
  const result = await pool.query(
    `DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.id = $2 RETURNING ci.id`,
    [userId, itemId],
  );
  if (!result.rowCount)
    throw problem(404, "CART_ITEM_NOT_FOUND", "Cart item not found");
  return cartData(pool, userId);
}

async function clearCart(userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cartId = await ensureCart(client, userId, true);
    await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
    await client.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId],
    );
    const cart = await cartData(client, userId);
    await client.query("COMMIT");
    return cart;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function checkout(
  userId,
  { address_id, delivery_date, delivery_time_slot, payment_method },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const cartId = await ensureCart(client, userId, true);
    const address = await client.query(
      "SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2 FOR SHARE",
      [address_id, userId],
    );
    if (!address.rowCount)
      throw problem(
        404,
        "ADDRESS_NOT_FOUND",
        "Choose one of your saved delivery addresses",
      );
    const items = await client.query(
      `SELECT ci.id, ci.meal_id, ci.quantity, m.name, m.price, m.calories, m.protein_g, m.carbs_g, m.fat_g,
                    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name,
                        'price_adjustment', o.price_adjustment, 'calories_adjustment', o.calories_adjustment,
                        'protein_g_adjustment', o.protein_g_adjustment, 'carbs_g_adjustment', o.carbs_g_adjustment,
                        'fat_g_adjustment', o.fat_g_adjustment) ORDER BY o.id)
                     FROM cart_item_customizations cic JOIN meal_customization_options o ON o.id = cic.option_id
                     WHERE cic.cart_item_id = ci.id), '[]'::jsonb) AS customizations
             FROM cart_items ci JOIN meals m ON m.id = ci.meal_id
             WHERE ci.cart_id = $1 ORDER BY ci.id FOR UPDATE OF ci`,
      [cartId],
    );
    if (!items.rowCount)
      throw problem(409, "CART_EMPTY", "Add a meal before placing your order");
    const unavailable = await client.query(
      "SELECT id FROM meals WHERE id = ANY($1::bigint[]) AND is_available = FALSE",
      [items.rows.map((item) => item.meal_id)],
    );
    if (unavailable.rowCount)
      throw problem(
        409,
        "MEAL_UNAVAILABLE",
        "A meal in your cart is no longer available; remove it before checkout",
      );
    const unavailableOptions = await client.query(
      `SELECT 1 FROM cart_item_customizations cic JOIN meal_customization_options o ON o.id = cic.option_id
             JOIN cart_items ci ON ci.id = cic.cart_item_id WHERE ci.cart_id = $1 AND o.is_available = FALSE LIMIT 1`,
      [cartId],
    );
    if (unavailableOptions.rowCount)
      throw problem(
        409,
        "OPTION_UNAVAILABLE",
        "A customization in your cart is no longer available; remove and add the meal again",
      );
    const subtotalCents = items.rows.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          cents(item.price) +
            item.customizations.reduce(
              (n, option) => n + cents(option.price_adjustment),
              0,
            ),
        ) *
          item.quantity,
      0,
    );
    const order = await client.query(
      `INSERT INTO customer_orders (user_id, address_id, total_amount, shipping_fee, status, payment_method, payment_status, delivery_date, delivery_time_slot)
             VALUES ($1, $2, $3, 0, 'PENDING', $4, 'PENDING', $5::date, $6) RETURNING id, user_id, address_id, total_amount, shipping_fee, status, payment_method, payment_status, to_char(delivery_date, 'YYYY-MM-DD') AS delivery_date, delivery_time_slot, created_at`,
      [
        userId,
        address_id,
        money(subtotalCents),
        payment_method,
        delivery_date,
        delivery_time_slot,
      ],
    );
    for (const item of items.rows) {
      const unitPrice = Math.max(
        0,
        cents(item.price) +
          item.customizations.reduce(
            (sum, option) => sum + cents(option.price_adjustment),
            0,
          ),
      );
      const adjust = (key) =>
        item.customizations.reduce(
          (sum, option) => sum + Number(option[`${key}_adjustment`]),
          0,
        );
      await client.query(
        `INSERT INTO order_items (order_id, meal_id, quantity, unit_price, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot, options)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          order.rows[0].id,
          item.meal_id,
          item.quantity,
          money(unitPrice),
          Number(item.calories) + adjust("calories"),
          Number(item.protein_g) + adjust("protein_g"),
          Number(item.carbs_g) + adjust("carbs_g"),
          Number(item.fat_g) + adjust("fat_g"),
          JSON.stringify(item.customizations),
        ],
      );
    }
    await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
    await client.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId],
    );
    await client.query("COMMIT");
    return {
      ...order.rows[0],
      items: items.rows.map((item) => ({
        meal_id: String(item.meal_id),
        name: item.name,
        quantity: item.quantity,
        unit_price: money(
          Math.max(
            0,
            cents(item.price) +
              item.customizations.reduce(
                (n, option) => n + cents(option.price_adjustment),
                0,
              ),
          ),
        ),
        customizations: item.customizations,
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function listOrders(userId, { page, page_size }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const count = await client.query(
      "SELECT COUNT(*)::int AS total FROM customer_orders WHERE user_id = $1",
      [userId],
    );
    const result = await client.query(
      `SELECT o.id, o.created_at, to_char(o.delivery_date, 'YYYY-MM-DD') AS delivery_date,
              o.total_amount, o.shipping_fee, o.status, o.payment_method, o.payment_status, o.delivery_time_slot,
              COALESCE(string_agg(COALESCE(m.name, 'Meal no longer available') || ' x' || oi.quantity,
                ', ' ORDER BY oi.id), '') AS items_summary
       FROM customer_orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN meals m ON m.id = oi.meal_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC, o.id DESC LIMIT $2 OFFSET $3`,
      [userId, page_size, (page - 1) * page_size],
    );
    await client.query("COMMIT");
    return {
      data: result.rows,
      pagination: { page, page_size, total: count.rows[0].total },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function findOrder(db, userId, id) {
  const order = await db.query(
    `SELECT id, created_at, to_char(delivery_date, 'YYYY-MM-DD') AS delivery_date,
            total_amount, shipping_fee, status, payment_method, payment_status, delivery_time_slot
     FROM customer_orders WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  if (!order.rowCount) return null;
  return { ...order.rows[0], items: await getOrderItems(id) };
}

async function getOrderItems(id) {
  const items = await pool.query(
    `SELECT oi.id, oi.meal_id, COALESCE(m.name, 'Meal no longer available') AS name, oi.quantity, oi.unit_price,
                oi.calories_snapshot, oi.protein_snapshot, oi.carbs_snapshot, oi.fat_snapshot, oi.options
         FROM order_items oi LEFT JOIN meals m ON m.id = oi.meal_id WHERE oi.order_id = $1 ORDER BY oi.id`,
    [id],
  );
  return items.rows;
}

async function getOrder(userId, id) {
  return findOrder(pool, userId, id);
}

async function cancelOrder(userId, id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT status FROM customer_orders WHERE user_id = $1 AND id = $2 FOR UPDATE",
      [userId, id],
    );
    if (!existing.rowCount)
      throw problem(404, "ORDER_NOT_FOUND", "Order not found");
    if (existing.rows[0].status !== "PENDING")
      throw problem(
        409,
        "ORDER_NOT_CANCELLABLE",
        "Only pending orders can be cancelled",
      );
    await client.query(
      "UPDATE customer_orders SET status = 'CANCELLED' WHERE user_id = $1 AND id = $2",
      [userId, id],
    );
    const order = await findOrder(client, userId, id);
    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  checkout,
  listOrders,
  getOrder,
  getOrderItems,
  cancelOrder,
  cents,
  money,
};
