const fields = [
  "code",
  "description",
  "discount_type",
  "discount_value",
  "min_order_amount",
  "max_discount_amount",
  "start_date",
  "end_date",
  "usage_limit",
  "per_user_limit",
  "is_active",
];

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  throw error;
}

function objectBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    invalid("Request body must be an object");
  if (Object.keys(body).some((key) => !fields.includes(key)))
    invalid("Request contains unsupported fields");
}

function code(value) {
  if (typeof value !== "string") invalid("code must be text");
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,50}$/.test(normalized))
    invalid("code must contain 1 to 50 letters, numbers, hyphens or underscores");
  return normalized;
}

function amount(value, field, { nullable = false, allowZero = true } = {}) {
  if (nullable && value === null) return null;
  const validNumber =
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value));
  const parsed = Number(value);
  if (!validNumber || parsed > 9999999999.99 || parsed < 0 || (!allowZero && parsed === 0))
    invalid(`${field} must be ${allowZero ? "a non-negative" : "a positive"} amount`);
  return parsed;
}

function calendarDate(value, field) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    invalid(`${field} must use YYYY-MM-DD format or be null`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value)
    invalid(`${field} must be a real calendar date`);
  return value;
}

function limit(value, field) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 2147483647)
    invalid(`${field} must be a positive integer or null`);
  return value;
}

function validatePromotion(body, { partial = false } = {}) {
  objectBody(body);
  if (partial && Object.keys(body).length === 0) invalid("Provide at least one field to update");
  if (!partial && (!("code" in body) || !("discount_type" in body) || !("discount_value" in body)))
    invalid("code, discount_type, and discount_value are required");

  const data = {};
  if ("code" in body) data.code = code(body.code);
  if ("description" in body) {
    if (body.description !== null && typeof body.description !== "string")
      invalid("description must be text or null");
    const description = body.description?.trim() ?? null;
    if (description && description.length > 500) invalid("description must be at most 500 characters");
    data.description = description;
  }
  if ("discount_type" in body) {
    if (!["PERCENTAGE", "FIXED"].includes(body.discount_type))
      invalid("discount_type must be PERCENTAGE or FIXED");
    data.discount_type = body.discount_type;
  }
  if ("discount_value" in body)
    data.discount_value = amount(body.discount_value, "discount_value", { allowZero: false });
  if ("min_order_amount" in body)
    data.min_order_amount = amount(body.min_order_amount, "min_order_amount");
  if ("max_discount_amount" in body)
    data.max_discount_amount = amount(body.max_discount_amount, "max_discount_amount", {
      nullable: true,
      allowZero: false,
    });
  if ("start_date" in body) data.start_date = calendarDate(body.start_date, "start_date");
  if ("end_date" in body) data.end_date = calendarDate(body.end_date, "end_date");
  if ("usage_limit" in body) data.usage_limit = limit(body.usage_limit, "usage_limit");
  if ("per_user_limit" in body) data.per_user_limit = limit(body.per_user_limit, "per_user_limit");
  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") invalid("is_active must be a boolean");
    data.is_active = body.is_active;
  }

  if (!partial) {
    data.description ??= null;
    data.min_order_amount ??= 0;
    data.max_discount_amount ??= null;
    data.start_date ??= null;
    data.end_date ??= null;
    data.usage_limit ??= null;
    data.per_user_limit ??= null;
    data.is_active ??= true;
  }

  if (data.discount_type === "PERCENTAGE" && data.discount_value !== undefined && data.discount_value > 100)
    invalid("percentage discount_value cannot exceed 100");
  if (data.discount_type === "FIXED" && data.max_discount_amount !== undefined && data.max_discount_amount !== null)
    invalid("max_discount_amount is only valid for percentage discounts");
  if (data.start_date && data.end_date && data.start_date > data.end_date)
    invalid("end_date must be on or after start_date");
  return data;
}

function validateCodeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "code") || !("code" in body))
    invalid("Request must contain only code");
  return { code: code(body.code) };
}

module.exports = { validatePromotion, validateCodeBody, code };
