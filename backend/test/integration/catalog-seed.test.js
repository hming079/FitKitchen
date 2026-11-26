const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { Pool } = require("pg");

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database");
const dbDirectory = path.join(__dirname, "../../db");
const schema = `catalog_seed_test_${randomBytes(8).toString("hex")}`;
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set("options", `-c search_path=${schema}`);

test("Catalog seed adds sample records once and preserves custom images", async t => {
    const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const pool = new Pool({ connectionString: url.toString() });
    let schemaCreated = false;
    t.after(async () => {
        try {
            await pool.end();
        } finally {
            try {
                if (schemaCreated) await root.query(`DROP SCHEMA ${schema} CASCADE`);
            } finally {
                await root.end();
            }
        }
    });
    await root.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;
    assert.equal((await pool.query("SELECT current_schema() AS schema")).rows[0].schema, schema);

    for (const file of ["01_schema.sql", "02_mockdata.sql"]) {
        await pool.query(await fs.readFile(path.join(dbDirectory, "init", file), "utf8"));
    }
    const migrationDirectory = path.join(dbDirectory, "migrations");
    const migrations = (await fs.readdir(migrationDirectory)).filter(file => file.endsWith(".sql")).sort();
    for (const file of migrations) {
        await pool.query(await fs.readFile(path.join(migrationDirectory, file), "utf8"));
    }

    const seed = await fs.readFile(path.join(dbDirectory, "init/99_catalog_sample_data.sql"), "utf8");
    const firstRun = await pool.query(seed);
    assert.equal(firstRun.filter(result => result.command === "UPDATE")
        .reduce((total, result) => total + result.rowCount, 0), 7);

    const counts = async () => (await pool.query(`
        SELECT (SELECT count(*)::int FROM meal_categories) AS categories,
               (SELECT count(*)::int FROM meals) AS meals,
               (SELECT count(*)::int FROM meals WHERE is_available) AS available_meals,
               (SELECT count(*)::int FROM products) AS products,
               (SELECT count(*)::int FROM meal_customization_options) AS options
    `)).rows[0];
    const expectedCounts = { categories: 5, meals: 28, available_meals: 26, products: 9, options: 13 };
    assert.deepEqual(await counts(), expectedCounts);
    const { rows: unavailable } = await pool.query("SELECT name FROM meals WHERE NOT is_available");
    assert.deepEqual(unavailable.map(row => row.name).sort(), ["Bò áp chảo bơ tỏi rau củ", "Mì soba bò xào"]);
    const { rows: mismatchedMeals } = await pool.query(`
        SELECT name FROM meals
        WHERE meal_type = 'SINGLE'
          AND abs(calories - (4 * protein_g + 4 * carbs_g + 9 * fat_g)) > calories * 0.10
    `);
    assert.deepEqual(mismatchedMeals, []);
    const { rows: images } = await pool.query("SELECT image_url FROM meals UNION ALL SELECT image_url FROM products");
    for (const { image_url } of images) assert.match(image_url, /^https:\/\/images\.(unsplash|pexels)\.com\//);
    assert.equal(new Set(images.map(row => row.image_url)).size, images.length);

    const { rows: [riceCake] } = await pool.query(
        "SELECT stock_quantity, is_available FROM products WHERE name = $1", ["Bánh gạo lứt ăn kiêng"]
    );
    assert.deepEqual(riceCake, { stock_quantity: 0, is_available: true });
    const { rows: [swap] } = await pool.query(`
        SELECT price_adjustment, calories_adjustment, carbs_g_adjustment, fat_g_adjustment
        FROM meal_customization_options JOIN meals ON meals.id = meal_id
        WHERE meals.name = $1 AND meal_customization_options.name = $2
    `, ["Bò bít tết khoai tây nướng", "Đổi sang khoai lang"]);
    assert.deepEqual(swap, {
        price_adjustment: "0.00", calories_adjustment: "-40.00", carbs_g_adjustment: "2.00", fat_g_adjustment: "-5.00"
    });

    const customImage = "https://custom.test/menu.jpg";
    await pool.query("UPDATE meals SET image_url = $1 WHERE name = $2", [customImage, "Ức gà nướng măng tây"]);
    await pool.query("UPDATE products SET image_url = $1 WHERE name = $2", [customImage, "Nước ép cần tây"]);
    const secondRun = await pool.query(seed);
    assert.ok(secondRun.every(result => result.rowCount === 0));
    assert.deepEqual(await counts(), expectedCounts);
    const { rows: preserved } = await pool.query(`
        SELECT name FROM meals WHERE image_url = $1
        UNION ALL
        SELECT name FROM products WHERE image_url = $1
    `, [customImage]);
    assert.deepEqual(preserved.map(row => row.name).sort(), ["Nước ép cần tây", "Ức gà nướng măng tây"]);
});
