-- Repeatable: scripts/migrate.js applies every migration on each run.
BEGIN;

CREATE TABLE IF NOT EXISTS nutrition_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
    age SMALLINT NOT NULL CHECK (age BETWEEN 18 AND 100),
    height_cm NUMERIC(5,1) NOT NULL CHECK (height_cm BETWEEN 130 AND 230),
    weight_kg NUMERIC(5,1) NOT NULL CHECK (weight_kg BETWEEN 35 AND 300),
    activity_level VARCHAR(20) NOT NULL CHECK (activity_level IN ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE')),
    goal VARCHAR(20) NOT NULL CHECK (goal IN ('FAT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
