const MAX_QUANTITY = 99;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  throw error;
}

function positiveId(value, field) {
  if (typeof value !== "string" && typeof value !== "number")
    invalid(`${field} must be a positive integer`);
  const raw = String(value);
  if (!/^[1-9]\d*$/.test(raw) || BigInt(raw) > 9223372036854775807n)
    invalid(`${field} must be a positive integer`);
  return raw;
}

function bodyObject(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    invalid("Request body must be an object");
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    invalid("Request contains unsupported fields");
}

function validateCartItem(body, { partial = false } = {}) {
  bodyObject(
    body,
    partial ? ["quantity"] : ["meal_id", "quantity", "option_ids"],
  );
  const data = {};
  if (!partial || body.meal_id !== undefined)
    data.meal_id = positiveId(body.meal_id, "meal_id");
  if (!partial || body.quantity !== undefined) {
    if (
      !Number.isInteger(body.quantity) ||
      body.quantity < 1 ||
      body.quantity > MAX_QUANTITY
    )
      invalid(`quantity must be an integer from 1 to ${MAX_QUANTITY}`);
    data.quantity = body.quantity;
  }
  if (!partial || body.option_ids !== undefined) {
    const options = body.option_ids ?? [];
    if (!Array.isArray(options) || options.length > 20)
      invalid("option_ids must be an array of at most 20 option ids");
    data.option_ids = [
      ...new Set(options.map((value) => positiveId(value, "option_ids"))),
    ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    if (data.option_ids.length !== options.length)
      invalid("option_ids cannot contain duplicates");
  }
  return data;
}

function validateCheckout(body) {
  bodyObject(body, [
    "address_id",
    "delivery_date",
    "delivery_time_slot",
    "payment_method",
  ]);
  const address_id = positiveId(body.address_id, "address_id");
  if (
    typeof body.delivery_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.delivery_date)
  )
    invalid("delivery_date must use YYYY-MM-DD format");
  const date = new Date(`${body.delivery_date}T00:00:00.000Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== body.delivery_date ||
    body.delivery_date < new Date().toISOString().slice(0, 10)
  ) {
    invalid("delivery_date must be a valid date from today onward");
  }
  const slots = new Set([
    "11:00 - 12:00",
    "12:00 - 13:00",
    "17:00 - 18:00",
    "18:00 - 19:00",
  ]);
  const delivery_time_slot = body.delivery_time_slot;
  if (
    delivery_time_slot !== undefined &&
    delivery_time_slot !== null &&
    !slots.has(delivery_time_slot)
  )
    invalid("delivery_time_slot is not supported");
  if (body.payment_method !== "COD") invalid("payment_method must be COD");
  return {
    address_id,
    delivery_date: body.delivery_date,
    delivery_time_slot: delivery_time_slot ?? null,
    payment_method: "COD",
  };
}

function validatePage(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const page_size =
    query.page_size === undefined ? 10 : Number(query.page_size);
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    invalid("page must be a positive integer");
  if (!Number.isInteger(page_size) || page_size < 1 || page_size > 50)
    invalid("page_size must be from 1 to 50");
  return { page, page_size };
}

module.exports = {
  validateCartItem,
  validateCheckout,
  validatePage,
  positiveId,
};
