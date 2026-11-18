const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { once } = require("node:events");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database");
const schema = `catalog_test_${randomBytes(8).toString("hex")}`;
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.JWT_ISSUER = "fitkitchen";
process.env.JWT_AUDIENCE = "fitkitchen-api";
const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pool = require("../../src/config/database");
const app = require("../../src/app");

const absentId = "9223372036854775807";
const mealPayload = { name: "Catalog test meal", price: 100, calories: 500, protein_g: 50, carbs_g: 0, fat_g: 0 };

test("Catalog against real HTTP, signed JWTs and PostgreSQL", async t => {
    let server;
    let schemaCreated = false;
    t.after(async () => {
        try {
            if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
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
    for (const file of ["init/01_schema.sql", "init/02_mockdata.sql", "migrations/001_admin_customers.sql"]) {
        await pool.query(await fs.readFile(path.join(__dirname, "../../db", file), "utf8"));
    }
    const { rows: [admin, customer] } = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
         RETURNING id`,
        ["catalog-admin@example.test", "unused", "Catalog Admin", "ADMIN",
            "catalog-customer@example.test", "unused", "Catalog Customer", "CUSTOMER"]
    );
    const sign = user => jwt.sign({}, process.env.JWT_SECRET, {
        subject: user.id, issuer: "fitkitchen", audience: "fitkitchen-api", expiresIn: "10m"
    });
    const adminToken = sign(admin);
    const customerToken = sign(customer);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}/api`;

    async function request(route, { method = "GET", body, token = null } = {}) {
        const response = await fetch(base + route, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        return { status: response.status, body: await response.json() };
    }
    const adminRequest = (route, method = "GET", body) => request(route, { method, body, token: adminToken });
    const ids = response => response.body.data.map(row => row.id);

    await t.test("public meals are available, filter by calories and protein and sort across pages", async () => {
        const hidden = await adminRequest("/meals", "POST", { ...mealPayload, is_available: false });
        assert.equal(hidden.status, 201);
        const tied = await adminRequest("/meals", "POST", { ...mealPayload, price: 120000 });
        assert.equal(tied.status, 201);
        const result = await request("/meals?available=false&min_calories=500&max_calories=600&min_protein=35&max_protein=50&meal_type=SINGLE&sort=price_desc&page_size=1");
        assert.equal(result.status, 200);
        assert.deepEqual(ids(result), ["3"]);
        assert.equal(result.body.data[0].protein_g, "35.00");
        assert.deepEqual(result.body.pagination, { page: 1, page_size: 1, total: 3, total_pages: 3 });
        const query = "min_calories=500&max_calories=600&min_protein=35&max_protein=50&sort=price_desc&page_size=1";
        assert.deepEqual(ids(await request(`/meals?${query}&page=2`)), [tied.body.data.id]);
        const empty = await request(`/meals?${query}&page=10`);
        assert.deepEqual(ids(empty), []);
        assert.deepEqual(empty.body.pagination, { page: 10, page_size: 1, total: 3, total_pages: 3 });
        assert.equal((await request("/meals?search=missing")).body.pagination.total_pages, 0);
        assert.deepEqual(ids(await request("/meals?search=catalog")), [tied.body.data.id]);
        assert.deepEqual(ids(await request("/meals?category_id=3&meal_type=SINGLE")), ["2"]);
        assert.equal((await request(`/meals/${hidden.body.data.id}`)).body.data.is_available, false);
        assert.deepEqual(ids(await adminRequest("/meals/manage?available=false")), [hidden.body.data.id]);
        assert.equal((await adminRequest("/meals/manage")).body.pagination.total, 6);
        assert.equal((await adminRequest("/meals/manage?available=true")).body.pagination.total, 5);
        const invalid = await request("/meals?min_calories=2&max_calories=1");
        assert.equal(invalid.status, 400);
        assert.deepEqual(invalid.body, { success: false, message: "Validation failed", errors: ["min_calories must be less than or equal to max_calories"] });
    });

    await t.test("anonymous and customer sessions cannot use catalog management routes", async () => {
        for (const [method, route] of [
            ["GET", "/meals/manage"], ["GET", "/meals/1/customizations/manage"],
            ["POST", "/meals/1/customizations"], ["PATCH", "/meals/1/customizations/1"],
            ["DELETE", "/meals/1/customizations/1"],
            ["POST", "/meal-categories"], ["PATCH", "/meal-categories/1"], ["DELETE", "/meal-categories/1"],
            ["GET", "/products/manage"], ["POST", "/products"], ["PATCH", "/products/1"],
            ["DELETE", "/products/1"], ["PATCH", "/products/1/stock"]
        ]) {
            assert.equal((await request(route, { method })).status, 401, `${method} ${route}`);
            assert.equal((await request(route, { method, token: customerToken })).status, 403, `${method} ${route}`);
        }
    });

    await t.test("categories support CRUD, trim names and block duplicates and in-use deletion", async () => {
        const created = await adminRequest("/meal-categories", "POST", { name: "  Catalog unreferenced  " });
        assert.equal(created.status, 201);
        const { id } = created.body.data;
        const route = `/meal-categories/${id}`;
        assert.deepEqual((await request(route)).body.data, { id, name: "Catalog unreferenced", description: null });
        const categories = await request("/meal-categories");
        assert.equal(categories.status, 200);
        assert.equal(categories.body.pagination, undefined);
        assert.deepEqual(categories.body.data.map(row => row.name), ["Bulking", "Catalog unreferenced", "Eat Clean", "Keto"]);
        assert.equal(categories.body.data.find(row => row.id === "1").meal_count, 2);
        assert.equal(categories.body.data.find(row => row.id === id).meal_count, 0);
        const dup = await adminRequest("/meal-categories", "POST", { name: "Catalog unreferenced" });
        assert.equal(dup.status, 409);
        assert.equal(dup.body.code, "CATEGORY_NAME_TAKEN");
        const update = await adminRequest(route, "PATCH", { name: "Catalog renamed", description: "Updated" });
        assert.equal(update.status, 200);
        assert.deepEqual(update.body.data, { id, name: "Catalog renamed", description: "Updated" });
        const rename = await adminRequest(route, "PATCH", { name: "Keto" });
        assert.equal(rename.status, 409);
        assert.equal(rename.body.code, "CATEGORY_NAME_TAKEN");
        assert.deepEqual(await adminRequest(route, "DELETE"), { status: 200, body: { success: true, data: { id } } });
        assert.equal((await request(route)).status, 404);
        assert.equal((await adminRequest(route, "DELETE")).status, 404);

        const used = await adminRequest("/meal-categories", "POST", { name: "Catalog inactive meal category" });
        assert.equal(used.status, 201);
        const meal = await adminRequest("/meals", "POST", {
            ...mealPayload, category_id: used.body.data.id, is_available: false
        });
        assert.equal(meal.status, 201);
        const blocked = await adminRequest(`/meal-categories/${used.body.data.id}`, "DELETE");
        assert.equal(blocked.status, 409);
        assert.equal(blocked.body.code, "CATEGORY_IN_USE");
        assert.equal(blocked.body.meal_count, 1);
        assert.equal((await request(`/meals/${meal.body.data.id}`)).body.data.category_id, used.body.data.id);
        const list = await request("/meal-categories");
        assert.equal(list.body.data.find(row => row.id === used.body.data.id).meal_count, 0);
    });

    await t.test("customizations are scoped to the parent and soft-deleted even when in a cart", async () => {
        const path = "/meals/1/customizations";
        assert.equal((await request(`/meals/${absentId}/customizations`)).status, 404);
        assert.equal((await adminRequest(`/meals/${absentId}/customizations`, "POST", { name: "Unavailable parent" })).status, 404);
        assert.deepEqual((await request("/meals/4/customizations")).body, { success: true, data: [] });
        const created = await adminRequest(path, "POST", { name: "  Catalog option ", description: "Test" });
        assert.equal(created.status, 201);
        const { id } = created.body.data;
        assert.equal(created.body.data.name, "Catalog option");
        assert.equal(created.body.data.price_adjustment, "0.00");
        assert.ok(ids(await request(path)).includes(id));
        const dup = await adminRequest(path, "POST", { name: "Catalog option" });
        assert.equal(dup.status, 409);
        assert.equal(dup.body.code, "OPTION_NAME_TAKEN");
        const sameName = await adminRequest("/meals/2/customizations", "POST", { name: "Catalog option" });
        assert.equal(sameName.status, 201);
        const renamed = await adminRequest(`${path}/${id}`, "PATCH", { name: "Thêm bơ" });
        assert.equal(renamed.status, 409);
        assert.equal(renamed.body.code, "OPTION_NAME_TAKEN");
        const updated = await adminRequest(`${path}/${id}`, "PATCH", { price_adjustment: -25.5, description: null });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.data.description, null);
        assert.equal(updated.body.data.price_adjustment, "-25.50");
        assert.equal((await adminRequest(`/meals/2/customizations/${id}`, "PATCH", { name: "Foreign" })).status, 404);
        assert.equal((await adminRequest(`/meals/2/customizations/${id}`, "DELETE")).status, 404);
        await pool.query("INSERT INTO cart_item_customizations (cart_item_id, option_id) VALUES ($1, $2)", [1, id]);
        const removed = await adminRequest(`${path}/${id}`, "DELETE");
        assert.equal(removed.status, 200);
        assert.equal(removed.body.data.is_available, false);
        assert.ok(!ids(await request(path)).includes(id));
        const manage = await adminRequest(`${path}/manage`);
        assert.equal(manage.body.data.find(row => row.id === id).is_available, false);
    });

    await t.test("products support filtering, CRUD, soft deletion and atomic stock adjustments", async () => {
        const created = await adminRequest("/products", "POST", {
            name: "Catalog Drink", category: "Catalog", price: 12.5, description: "Ginger", unit: "bottle"
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.data.price, "12.50");
        assert.equal(created.body.data.stock_quantity, 0);
        const { id } = created.body.data;
        const route = `/products/${id}`;
        assert.deepEqual((await request(route)).body.data, created.body.data);
        assert.deepEqual(ids(await request("/products?category=catalog")), []);
        assert.deepEqual(ids(await request("/products?search=GINGER&category=Catalog")), [id]);
        assert.deepEqual(ids(await request("/products?category=Catalog&in_stock=true")), []);

        const patched = await adminRequest(route, "PATCH", { name: "Catalog Drink Updated", unit: null });
        assert.equal(patched.status, 200);
        assert.equal(patched.body.data.name, "Catalog Drink Updated");
        assert.equal(patched.body.data.unit, null);
        assert.ok(patched.body.data.updated_at >= created.body.data.updated_at);
        const stocked = await adminRequest(`${route}/stock`, "PATCH", { adjustment: 5 });
        assert.equal(stocked.status, 200);
        assert.equal(stocked.body.data.stock_quantity, 5);
        const list = await request("/products?in_stock=true&sort=price_asc&page_size=1");
        assert.deepEqual(ids(list), [id]);
        assert.deepEqual(list.body.pagination, { page: 1, page_size: 1, total: 4, total_pages: 4 });
        const competed = await Promise.all(
            [-4, -4].map(adjustment => adminRequest(`${route}/stock`, "PATCH", { adjustment }))
        );
        assert.deepEqual(competed.map(result => result.status).sort(), [200, 409]);
        assert.equal(competed.find(result => result.status === 409).body.code, "INSUFFICIENT_STOCK");
        assert.equal((await request(route)).body.data.stock_quantity, 1);
        assert.equal((await adminRequest(`/products/${absentId}/stock`, "PATCH", { adjustment: -1 })).status, 404);
        assert.equal((await request(`/products/${absentId}`)).status, 404);

        assert.equal((await adminRequest(route, "PATCH", { stock_quantity: 2147483647 })).status, 200);
        const overflow = await adminRequest(`${route}/stock`, "PATCH", { adjustment: 1 });
        assert.equal(overflow.status, 409);
        assert.equal(overflow.body.code, "STOCK_LIMIT_EXCEEDED");
        assert.equal((await request(route)).body.data.stock_quantity, 2147483647);
        const removed = await adminRequest(route, "DELETE");
        assert.equal(removed.status, 200);
        assert.equal(removed.body.data.is_available, false);
        assert.deepEqual(ids(await request("/products?category=Catalog&available=false")), []);
        assert.deepEqual(ids(await adminRequest("/products/manage?category=Catalog&available=false")), [id]);
        assert.deepEqual(ids(await adminRequest("/products/manage?category=Catalog")), [id]);
        assert.deepEqual(ids(await adminRequest("/products/manage?category=Catalog&available=true")), []);
        assert.equal((await request(route)).body.data.is_available, false);
    });

    await t.test("meal creation and update map a missing category reference to validation errors", async () => {
        for (const result of [
            await adminRequest("/meals", "POST", { ...mealPayload, category_id: absentId }),
            await adminRequest("/meals/1", "PATCH", { category_id: absentId })
        ]) {
            assert.equal(result.status, 400);
            assert.deepEqual(result.body, {
                success: false,
                message: "Validation failed",
                errors: ["category_id does not reference an existing category"]
            });
        }
        assert.equal((await request("/meals/1")).body.data.category_id, "1");
    });
});
