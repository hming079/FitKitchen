-- Fresh-volume initialization; existing databases use db/migrations/001_admin_customers.sql.
CREATE TABLE admin_account_audit (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(10) NOT NULL CHECK (action IN ('LOCK', 'UNLOCK')),
    reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
    was_locked BOOLEAN NOT NULL,
    is_locked BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (was_locked <> is_locked),
    CHECK ((action = 'LOCK') = is_locked),
    CHECK (admin_id <> customer_id)
);
CREATE INDEX idx_admin_account_audit_customer ON admin_account_audit(customer_id, created_at DESC);
CREATE INDEX idx_customer_orders_user_status ON customer_orders(user_id, status);
