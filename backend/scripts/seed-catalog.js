require('../src/config/env');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/database');

async function main() {
    if (process.env.NODE_ENV === 'production') throw new Error('Catalog seed is disabled in production');
    const sql = await fs.readFile(path.join(__dirname, '../db/init/99_catalog_sample_data.sql'), 'utf8');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Serialize the name checks with catalog writes because meal and product names are not unique.
        await client.query('LOCK TABLE meal_categories, meals, products IN SHARE ROW EXCLUSIVE MODE');
        const results = await client.query(sql);
        const inserted = results.filter(result => result.command === 'INSERT')
            .reduce((total, result) => total + result.rowCount, 0);
        const updated = results.filter(result => result.command === 'UPDATE')
            .reduce((total, result) => total + result.rowCount, 0);
        await client.query('COMMIT');
        console.log(`Catalog seed: ${inserted} new rows, ${updated} image URLs updated.`);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}

main().catch(error => { console.error('Catalog seed failed:', error.code || error.message); process.exitCode = 1; })
    .finally(() => pool.end());
