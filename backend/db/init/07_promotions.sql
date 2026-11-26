-- Fresh-volume initialization; existing databases use db/migrations/007_promotions.sql.
BEGIN;

ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS description VARCHAR(500),
    ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS usage_limit INTEGER,
    ADD COLUMN IF NOT EXISTS per_user_limit INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE promotions SET min_order_amount = 0 WHERE min_order_amount IS NULL;
UPDATE promotions SET is_active = TRUE WHERE is_active IS NULL;
ALTER TABLE promotions
    ALTER COLUMN min_order_amount SET NOT NULL,
    ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_rules_check;
ALTER TABLE promotions ADD CONSTRAINT promotions_rules_check CHECK (
    discount_type IN ('PERCENTAGE', 'FIXED')
    AND discount_value > 0
    AND (discount_type <> 'PERCENTAGE' OR discount_value <= 100)
    AND (max_discount_amount IS NULL OR (discount_type = 'PERCENTAGE' AND max_discount_amount > 0))
    AND min_order_amount >= 0
    AND (usage_limit IS NULL OR usage_limit > 0)
    AND (per_user_limit IS NULL OR per_user_limit > 0)
    AND (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS promotions_code_upper_key ON promotions (UPPER(code));

ALTER TABLE customer_orders
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promotion_code VARCHAR(50);

UPDATE customer_orders
SET subtotal_amount = total_amount - COALESCE(shipping_fee, 0) + discount_amount
WHERE subtotal_amount IS NULL;

ALTER TABLE customer_orders DROP CONSTRAINT IF EXISTS customer_orders_discount_check;
ALTER TABLE customer_orders ADD CONSTRAINT customer_orders_discount_check
    CHECK (discount_amount >= 0 AND (subtotal_amount IS NULL OR discount_amount <= subtotal_amount));

CREATE INDEX IF NOT EXISTS idx_customer_orders_promotion
    ON customer_orders (promotion_id, user_id) WHERE promotion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_created
    ON customer_orders (created_at);

COMMIT;
