BEGIN;

ALTER TABLE meals
    ADD COLUMN IF NOT EXISTS goal_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS allergen_info TEXT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meals_goal_type_check' AND conrelid = 'meals'::regclass) THEN
        ALTER TABLE meals ADD CONSTRAINT meals_goal_type_check CHECK (goal_type IN ('BULK', 'CUT', 'MAINTAIN'));
    END IF;
END $$;

ALTER TABLE meal_customization_options
    ADD COLUMN IF NOT EXISTS calories_adjustment NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS protein_g_adjustment NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS carbs_g_adjustment NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fat_g_adjustment NUMERIC(8,2) NOT NULL DEFAULT 0;

COMMIT;
