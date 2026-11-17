require('../src/config/env');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/database');

async function main() {
    const client = await pool.connect();
    try {
        await client.query(await fs.readFile(path.join(__dirname, '../db/migrations/001_admin_customers.sql'), 'utf8'));
        console.log('Admin customer migration applied. Existing data retained.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}
main().catch(error => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
