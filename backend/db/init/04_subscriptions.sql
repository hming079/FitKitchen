-- Fresh-volume initialization; existing databases use db/migrations/004_subscriptions.sql.
BEGIN;

UPDATE user_subscriptions SET status = 'PENDING' WHERE status IS NULL;
UPDATE user_subscriptions SET payment_status = 'PENDING' WHERE payment_status IS NULL;
ALTER TABLE user_subscriptions
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN payment_status SET NOT NULL;

-- NOT VALID enforces the rules for new and updated rows without failing on legacy values.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_status_check' AND conrelid = 'user_subscriptions'::regclass) THEN
        ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_status_check
            CHECK (status IN ('PENDING', 'ACTIVE', 'CANCELLED')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_payment_status_check' AND conrelid = 'user_subscriptions'::regclass) THEN
        ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_payment_status_check
            CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_gifts_status_check' AND conrelid = 'subscription_gifts'::regclass) THEN
        ALTER TABLE subscription_gifts ADD CONSTRAINT subscription_gifts_status_check
            CHECK (status IN ('PENDING', 'DELIVERED', 'CANCELLED')) NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status_dates
    ON user_subscriptions (user_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_status
    ON user_subscriptions (plan_id, status);
CREATE INDEX IF NOT EXISTS idx_subscription_gifts_plan_template
    ON subscription_gifts (plan_id) WHERE subscription_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_gifts_subscription
    ON subscription_gifts (subscription_id);

COMMIT;
