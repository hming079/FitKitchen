const pool = require("../../config/database");
const { addCatalogSearch, listPage } = require("../meal/catalog.service");
const { productFields, productSorts, maxStock } = require("./product.validation");

const columns = "id, name, description, category, image_url, price, stock_quantity, unit, is_available, created_at, updated_at";

function list(filters) {
    const values = [];
    const conditions = [];
    addCatalogSearch(filters.search, conditions, values);
    if (filters.category !== undefined) {
        values.push(filters.category);
        conditions.push(`category = $${values.length}`);
    }
    if (filters.available !== undefined) {
        values.push(filters.available);
        conditions.push(`is_available = $${values.length}`);
    }
    if (filters.in_stock) conditions.push("stock_quantity > 0");
    if (filters.in_stock === false) conditions.push("stock_quantity = 0");

    return listPage({
        table: "products", columns, conditions, values,
        order: productSorts[filters.sort], page: filters.page, page_size: filters.page_size
    });
}

async function findById(id) {
    const { rows } = await pool.query(`SELECT ${columns} FROM products WHERE id = $1`, [id]);
    return rows[0];
}

async function create(data) {
    const fields = Object.keys(productFields).filter(field => Object.hasOwn(data, field));
    const placeholders = fields.map((field, index) => `$${index + 1}`);
    const { rows } = await pool.query(
        `INSERT INTO products (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${columns}`,
        fields.map(field => data[field])
    );
    return rows[0];
}

async function update(id, data) {
    const fields = Object.keys(productFields).filter(field => Object.hasOwn(data, field));
    const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
    const { rows } = await pool.query(
        `UPDATE products SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING ${columns}`,
        [id, ...fields.map(field => data[field])]
    );
    return rows[0];
}

async function adjustStock(id, adjustment) {
    const { rows } = await pool.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND stock_quantity::bigint + $1 BETWEEN 0 AND $3 RETURNING ${columns}`,
        [adjustment, id, maxStock]
    );
    return rows[0];
}

module.exports = { list, findById, create, update, adjustStock };
