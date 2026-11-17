BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET role = 'CUSTOMER' WHERE role IS NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'CUSTOMER';
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass) THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'CUSTOMER'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_account_audit (
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
CREATE INDEX IF NOT EXISTS idx_admin_account_audit_customer ON admin_account_audit(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_user_status ON customer_orders(user_id, status);
COMMIT;
