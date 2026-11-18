const pool = require("../../config/database");
const { listPage } = require("./catalog.service");
const { mealSorts, writableFields } = require("./meal.validation");
const { optionFields } = require("./option.validation");

const mealColumns = `
    id, category_id, name, description, image_url, price, calories,
    protein_g, carbs_g, fat_g, meal_type, goal_type, allergen_info, is_available, created_at, updated_at
`;

const optionFieldsToRead = ["id", "meal_id", ...Object.keys(optionFields), "created_at"];
const optionColumns = optionFieldsToRead.join(", ");
const qualifiedOptionColumns = optionFieldsToRead.map(column => `options.${column}`).join(", ");
const mealFilters = {
    category_id: "category_id =",
    meal_type: "meal_type =",
    goal_type: "goal_type =",
    min_calories: "calories >=",
    max_calories: "calories <=",
    min_protein: "protein_g >=",
    max_protein: "protein_g <=",
    available: "is_available ="
};

class MealService {
    list(filters) {
        const values = [];
        const conditions = [];

        if (filters.search) {
            values.push(`%${filters.search}%`);
            conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
        }
        for (const [field, expression] of Object.entries(mealFilters)) {
            if (filters[field] === undefined) continue;
            values.push(filters[field]);
            conditions.push(`${expression} $${values.length}`);
        }

        return listPage({
            table: "meals", columns: mealColumns, conditions, values,
            order: mealSorts[filters.sort], page: filters.page, page_size: filters.page_size
        });
    }

    async findById(id) {
        const result = await pool.query(
            `SELECT ${mealColumns} FROM meals WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async getCustomizations(id, manage) {
        const { rows } = await pool.query(
            `SELECT ${qualifiedOptionColumns}
             FROM meals
             LEFT JOIN meal_customization_options AS options
                 ON options.meal_id = meals.id AND ($2 OR options.is_available = TRUE)
             WHERE meals.id = $1
             ORDER BY options.id`,
            [id, manage]
        );
        return rows.length ? rows.filter(option => option.id !== null) : null;
    }

    async createCustomization(id, data) {
        const fields = Object.keys(optionFields).filter(field => Object.hasOwn(data, field));
        const values = [id, ...fields.map(field => data[field])];
        const placeholders = values.map((value, index) => `$${index + 1}`);
        const { rows } = await pool.query(
            `INSERT INTO meal_customization_options (meal_id, ${fields.join(", ")})
             VALUES (${placeholders.join(", ")}) RETURNING ${optionColumns}`,
            values
        );
        return rows[0];
    }

    async updateCustomization(id, optionId, data) {
        const fields = Object.keys(optionFields).filter(field => Object.hasOwn(data, field));
        const values = [id, optionId, ...fields.map(field => data[field])];
        const assignments = fields.map((field, index) => `${field} = $${index + 3}`);
        const { rows } = await pool.query(
            `UPDATE meal_customization_options SET ${assignments.join(", ")}
             WHERE meal_id = $1 AND id = $2 RETURNING ${optionColumns}`,
            values
        );
        return rows[0];
    }

    async create(data) {
        const fields = writableFields.filter(field => Object.hasOwn(data, field));
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
        const fields = writableFields.filter(field => Object.hasOwn(data, field));
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
