require('../src/config/env');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/database');

async function main() {
    const client = await pool.connect();
    try {
        const directory = path.join(__dirname, '../db/migrations');
        const files = await fs.readdir(directory, { withFileTypes: true });
        const migrations = files.filter(file => file.isFile() && file.name.endsWith('.sql'))
            .map(file => file.name).sort();
        for (const filename of migrations) {
            await client.query(await fs.readFile(path.join(directory, filename), 'utf8'));
            console.log('Applied migration:', filename);
        }
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}
main().catch(error => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
