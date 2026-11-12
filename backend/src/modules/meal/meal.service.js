const pool = require("../../config/database");

const mealColumns = `
    id, category_id, name, description, image_url, price, calories,
    protein_g, carbs_g, fat_g, meal_type, is_available, created_at, updated_at
`;

class MealService {
    async list({ search, categoryId, mealType, available }) {
        const values = [];
        const conditions = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
        }
        if (categoryId !== undefined) {
            values.push(categoryId);
            conditions.push(`category_id = $${values.length}`);
        }
        if (mealType) {
            values.push(mealType);
            conditions.push(`meal_type = $${values.length}`);
        }
        if (available !== undefined) {
            values.push(available);
            conditions.push(`is_available = $${values.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `SELECT ${mealColumns} FROM meals ${where} ORDER BY id`,
            values
        );
        return result.rows;
    }

    async findById(id) {
        const result = await pool.query(
            `SELECT ${mealColumns} FROM meals WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async getCustomizations(id) {
        const result = await pool.query(
            `SELECT id, meal_id, name, description, price_adjustment, is_available, created_at
             FROM meal_customization_options
             WHERE meal_id = $1
             ORDER BY id`,
            [id]
        );
        return result.rows;
    }

    async create(data) {
        const fields = Object.keys(data);
        const values = fields.map((field) => data[field]);
        const placeholders = fields.map((field, index) => `$${index + 1}`);
        const result = await pool.query(
            `INSERT INTO meals (${fields.join(", ")})
             VALUES (${placeholders.join(", ")})
             RETURNING ${mealColumns}`,
            values
        );
        return result.rows[0];
    }

    async update(id, data) {
        const fields = Object.keys(data);
        const values = fields.map((field) => data[field]);
        const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
        values.push(id);

        const result = await pool.query(
            `UPDATE meals
             SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${values.length}
             RETURNING ${mealColumns}`,
            values
        );
        return result.rows[0];
    }

    async archive(id) {
        const result = await pool.query(
            `UPDATE meals
             SET is_available = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING ${mealColumns}`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = new MealService();
