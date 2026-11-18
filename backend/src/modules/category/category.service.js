const pool = require("../../config/database");
const { categoryFields } = require("./category.validation");

async function list() {
    const { rows } = await pool.query(
        `SELECT categories.id, categories.name, categories.description, COUNT(meals.id)::int AS meal_count
         FROM meal_categories AS categories
         LEFT JOIN meals ON meals.category_id = categories.id AND meals.is_available = TRUE
         GROUP BY categories.id
         ORDER BY categories.name`
    );
    return rows;
}

async function findById(id) {
    const { rows } = await pool.query("SELECT id, name, description FROM meal_categories WHERE id = $1", [id]);
    return rows[0];
}

async function create({ name, description = null }) {
    const { rows } = await pool.query(
        "INSERT INTO meal_categories (name, description) VALUES ($1, $2) RETURNING id, name, description",
        [name, description]
    );
    return rows[0];
}

async function update(id, data) {
    const fields = Object.keys(categoryFields).filter(field => Object.hasOwn(data, field));
    const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
    const { rows } = await pool.query(
        `UPDATE meal_categories SET ${assignments.join(", ")} WHERE id = $1 RETURNING id, name, description`,
        [id, ...fields.map(field => data[field])]
    );
    return rows[0];
}

async function remove(id) {
    const client = await pool.connect();
    let rollbackError;
    try {
        await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        // The parent row lock blocks new FK references until the count and deletion finish.
        const category = await client.query("SELECT id FROM meal_categories WHERE id = $1 FOR UPDATE", [id]);
        let result;
        if (category.rowCount) {
            const { rows } = await client.query("SELECT COUNT(*)::int AS meal_count FROM meals WHERE category_id = $1", [id]);
            result = rows[0];
            if (result.meal_count === 0) {
                const deleted = await client.query("DELETE FROM meal_categories WHERE id = $1 RETURNING id", [id]);
                result = deleted.rows[0];
            }
        }
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK").catch(failure => { rollbackError = failure; });
        throw error;
    } finally {
        client.release(rollbackError);
    }
}

module.exports = { list, findById, create, update, remove };
