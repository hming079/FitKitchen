-- Fresh-volume initialization; existing databases use db/migrations/006_payment_transactions.sql.
-- One row per VNPay payment attempt; amount is in VNPay units (VND x 100).
CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'VNPAY',
    txn_ref VARCHAR(64) NOT NULL UNIQUE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    vnp_create_date VARCHAR(14) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    vnp_transaction_no VARCHAR(64),
    bank_code VARCHAR(32),
    response_code VARCHAR(8),
    transaction_status VARCHAR(8),
    pay_date VARCHAR(14),
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order
    ON payment_transactions(order_id, created_at);
