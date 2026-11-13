const pool = require("../../config/database");

const userColumns = `
    id, email, full_name, phone, fitness_goal, target_calories,
    role, created_at, updated_at
`;

const userFields = new Set([
    "email",
    "full_name",
    "phone",
    "fitness_goal",
    "target_calories",
    "role"
]);

class UserService {
    async list({ search, role, fitnessGoal }) {
        const values = [];
        const conditions = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(email ILIKE $${values.length} OR full_name ILIKE $${values.length})`);
        }
        if (role) {
            values.push(role);
            conditions.push(`role = $${values.length}`);
        }
        if (fitnessGoal) {
            values.push(fitnessGoal);
            conditions.push(`fitness_goal = $${values.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `SELECT ${userColumns} FROM users ${where} ORDER BY id`,
            values
        );
        return result.rows;
    }

    async findById(id) {
        const result = await pool.query(
            `SELECT ${userColumns} FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async create(data) {
        const result = await pool.query(
            `INSERT INTO users
                (email, password_hash, full_name, phone, fitness_goal, target_calories, role)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'CUSTOMER'))
             RETURNING ${userColumns}`,
            [
                data.email,
                data.password_hash,
                data.full_name,
                data.phone || null,
                data.fitness_goal || null,
                data.target_calories === undefined ? null : data.target_calories,
                data.role || null
            ]
        );
        return result.rows[0];
    }

    async update(id, data) {
        const fields = Object.keys(data).filter((field) => userFields.has(field));
        const values = fields.map((field) => data[field]);
        const assignments = fields.map((field, index) => `${field} = $${index + 1}`);

        if (data.password_hash !== undefined) {
            values.push(data.password_hash);
            assignments.push(`password_hash = $${values.length}`);
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE users
             SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${values.length}
             RETURNING ${userColumns}`,
            values
        );
        return result.rows[0];
    }

    async remove(id) {
        const result = await pool.query(
            "DELETE FROM users WHERE id = $1 RETURNING id",
            [id]
        );
        return result.rows[0];
    }

    async listAddresses(userId) {
        const result = await pool.query(
            `SELECT id, user_id, recipient_name, phone, address_detail, is_default
             FROM user_addresses
             WHERE user_id = $1
             ORDER BY is_default DESC, id`,
            [userId]
        );
        return result.rows;
    }

    async findAddress(userId, addressId) {
        const result = await pool.query(
            `SELECT id, user_id, recipient_name, phone, address_detail, is_default
             FROM user_addresses
             WHERE user_id = $1 AND id = $2`,
            [userId, addressId]
        );
        return result.rows[0];
    }

    async createAddress(userId, data) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            if (data.is_default) {
                await client.query(
                    "UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1",
                    [userId]
                );
            }
            const result = await client.query(
                `INSERT INTO user_addresses
                    (user_id, recipient_name, phone, address_detail, is_default)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, user_id, recipient_name, phone, address_detail, is_default`,
                [userId, data.recipient_name, data.phone, data.address_detail, data.is_default || false]
            );
            await client.query("COMMIT");
            return result.rows[0];
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async updateAddress(userId, addressId, data) {
        const fields = ["recipient_name", "phone", "address_detail", "is_default"]
            .filter((field) => data[field] !== undefined);
        const values = fields.map((field) => data[field]);
        const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
        values.push(userId, addressId);

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const existing = await client.query(
                "SELECT id FROM user_addresses WHERE user_id = $1 AND id = $2 FOR UPDATE",
                [userId, addressId]
            );
            if (existing.rowCount === 0) {
                await client.query("ROLLBACK");
                return undefined;
            }
            if (data.is_default === true) {
                await client.query(
                    "UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1",
                    [userId]
                );
            }
            const result = await client.query(
                `UPDATE user_addresses
                 SET ${assignments.join(", ")}
                 WHERE user_id = $${values.length - 1} AND id = $${values.length}
                 RETURNING id, user_id, recipient_name, phone, address_detail, is_default`,
                values
            );
            await client.query("COMMIT");
            return result.rows[0];
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async removeAddress(userId, addressId) {
        const result = await pool.query(
            "DELETE FROM user_addresses WHERE user_id = $1 AND id = $2 RETURNING id",
            [userId, addressId]
        );
        return result.rows[0];
    }
}

module.exports = new UserService();
