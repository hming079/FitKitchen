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
    const goalMacrosMigration = await fs.readFile(
        path.join(__dirname, "../../db/migrations/002_catalog_goal_macros.sql"), "utf8"
    );
    await t.test("migration 002 can be applied twice and enforces the goal constraint", async () => {
        await pool.query(goalMacrosMigration);
        await pool.query(goalMacrosMigration);
        await assert.rejects(pool.query("UPDATE meals SET goal_type = $1 WHERE id = 1", ["INVALID"]), {
            code: "23514", constraint: "meals_goal_type_check"
        });
        assert.equal((await pool.query("SELECT goal_type FROM meals WHERE id = 1")).rows[0].goal_type, "CUT");
    });
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
        const hidden = await adminRequest("/meals", "POST", {
            ...mealPayload, goal_type: "CUT", allergen_info: "Milk", is_available: false
        });
        assert.equal(hidden.status, 201);
        assert.equal(hidden.body.data.goal_type, "CUT");
        assert.equal(hidden.body.data.allergen_info, "Milk");
        const tied = await adminRequest("/meals", "POST", { ...mealPayload, price: 120000 });
        assert.equal(tied.status, 201);
        assert.equal(tied.body.data.goal_type, null);
        assert.equal(tied.body.data.allergen_info, null);
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
        const publicCut = await request("/meals?goal_type=CUT");
        assert.deepEqual(ids(publicCut), ["1", "4"]);
        assert.equal(publicCut.body.pagination.total, 2);
        assert.deepEqual(ids(await adminRequest("/meals/manage?goal_type=CUT")), ["1", "4", hidden.body.data.id]);
        assert.deepEqual(ids(await adminRequest("/meals/manage?goal_type=CUT&available=false")), [hidden.body.data.id]);
        assert.equal((await adminRequest("/meals/manage")).body.pagination.total, 6);
        assert.equal((await adminRequest("/meals/manage?available=true")).body.pagination.total, 5);
        const invalid = await request("/meals?min_calories=2&max_calories=1");
        assert.equal(invalid.status, 400);
        assert.deepEqual(invalid.body, {
            success: false, code: "VALIDATION_ERROR", message: "Validation failed",
            errors: ["min_calories must be less than or equal to max_calories"]
        });
    });

    await t.test("meal routes reject malformed identifiers and invalid amounts", async () => {
        assert.equal((await request("/meals/0x1")).status, 400);
        assert.equal((await request("/meals/0x1/customizations")).status, 400);
        assert.equal((await request("/meals?category_id=1e0")).status, 400);
        for (const [field, value] of [["calories", 10000000], ["price", null], ["category_id", "1.0"]]) {
            for (const result of [
                await adminRequest("/meals", "POST", { ...mealPayload, [field]: value }),
                await adminRequest("/meals/1", "PATCH", { [field]: value })
            ]) {
                assert.equal(result.status, 400);
                assert.equal(result.body.code, "VALIDATION_ERROR");
                assert.match(result.body.errors[0], new RegExp(`^${field} `));
            }
        }
    });

    await t.test("meal writes reject NUL text and map database encoding failures to 400", async () => {
        for (const [field, message] of [
            ["description", "description must be a string without NUL characters or null"],
            ["image_url", "image_url must be a string without NUL characters or null"],
            ["name", "A text meal field contains invalid characters"]
        ]) {
            for (const result of [
                await adminRequest("/meals", "POST", { ...mealPayload, [field]: "before\0after" }),
                await adminRequest("/meals/1", "PATCH", { [field]: "before\0after" })
            ]) {
                assert.equal(result.status, 400);
                assert.equal(result.body.code, "VALIDATION_ERROR");
                assert.deepEqual(result.body.errors, [message]);
            }
        }
    });

    await t.test("meal and product search fold Vietnamese text and match literal wildcard characters", async () => {
        const search = (route, term) => request(`${route}?search=${encodeURIComponent(term)}`);
        for (const term of ["uc ga", "UC GA", "ức gà"]) {
            const result = await search("/meals", term);
            assert.equal(result.status, 200);
            assert.ok(result.body.data.some(meal => meal.name === "Ức gà nướng măng tây"));
        }
        const product = await search("/products", "bot dam");
        assert.equal(product.status, 200);
        assert.deepEqual(product.body.data.map(row => row.name), ["Whey Protein vị vani"]);
        const created = await adminRequest("/products", "POST", {
            name: "Đậu".normalize("NFD"), description: "100%_\\", price: 10
        });
        assert.equal(created.status, 201);
        const { id } = created.body.data;
        assert.ok(ids(await search("/products", "dau")).includes(id));
        for (const term of ["%", "_", "\\"]) {
            assert.deepEqual(ids(await search("/meals", term)), []);
            assert.deepEqual(ids(await search("/products", term)), [id]);
        }
    });

    await t.test("meal goal and allergen fields can be cleared and invalid goals return HTTP 400", async () => {
        const path = "/meals/3";
        const original = (await request(path)).body.data;
        assert.equal(original.goal_type, "MAINTAIN");
        assert.equal(original.allergen_info, "Cá, sữa");
        for (const response of [
            await adminRequest("/meals", "POST", { ...mealPayload, goal_type: "SINGLE" }),
            await adminRequest(path, "PATCH", { goal_type: "SINGLE" }),
            await request("/meals?goal_type=maintain"),
            await adminRequest("/meals/manage?goal_type=CUT&goal_type=BULK")
        ]) {
            assert.equal(response.status, 400);
            assert.match(response.body.errors[0], /^goal_type /);
        }
        assert.equal((await adminRequest(path, "PATCH", { allergen_info: "x".repeat(501) })).status, 400);
        const cleared = await adminRequest(path, "PATCH", { goal_type: null, allergen_info: null });
        assert.equal(cleared.status, 200);
        assert.equal(cleared.body.data.goal_type, null);
        assert.equal(cleared.body.data.allergen_info, null);
        assert.deepEqual((await request(path)).body.data, cleared.body.data);
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
        assert.deepEqual(await request(route), {
            status: 404, body: { success: false, code: "NOT_FOUND", message: "Category not found" }
        });
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
        assert.equal(blocked.body.total_meal_count, 1);
        assert.equal((await request(`/meals/${meal.body.data.id}`)).body.data.category_id, used.body.data.id);
        const list = await request("/meal-categories");
        assert.deepEqual(list.body.data.find(row => row.id === used.body.data.id), {
            ...used.body.data, meal_count: 0, total_meal_count: 1
        });
    });

    await t.test("paused meals hide customization options from public requests only", async () => {
        const paused = await adminRequest("/meals", "POST", { ...mealPayload, is_available: false });
        assert.equal(paused.status, 201);
        const path = `/meals/${paused.body.data.id}/customizations`;
        const option = await adminRequest(path, "POST", { name: "Visible only to management" });
        assert.equal(option.status, 201);
        assert.deepEqual(await request(path), { status: 200, body: { success: true, data: [] } });
        assert.deepEqual(ids(await adminRequest(`${path}/manage`)), [option.body.data.id]);
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
        for (const field of ["calories_adjustment", "protein_g_adjustment", "carbs_g_adjustment", "fat_g_adjustment"]) {
            assert.equal(created.body.data[field], "0.00");
        }
        assert.ok(ids(await request(path)).includes(id));
        const dup = await adminRequest(path, "POST", { name: "Catalog option" });
        assert.equal(dup.status, 409);
        assert.equal(dup.body.code, "OPTION_NAME_TAKEN");
        const sameName = await adminRequest("/meals/2/customizations", "POST", {
            name: "Catalog option", calories_adjustment: 80, protein_g_adjustment: 16
        });
        assert.equal(sameName.status, 201);
        assert.equal(sameName.body.data.calories_adjustment, "80.00");
        assert.equal(sameName.body.data.protein_g_adjustment, "16.00");
        const renamed = await adminRequest(`${path}/${id}`, "PATCH", { name: "Thêm bơ" });
        assert.equal(renamed.status, 409);
        assert.equal(renamed.body.code, "OPTION_NAME_TAKEN");
        assert.equal((await adminRequest(`${path}/${id}`, "PATCH", { fat_g_adjustment: -10000.01 })).status, 400);
        const updated = await adminRequest(`${path}/${id}`, "PATCH", {
            price_adjustment: -25.5, description: null,
            calories_adjustment: -80.25, protein_g_adjustment: 16, carbs_g_adjustment: 0, fat_g_adjustment: -2.5
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.data.description, null);
        assert.equal(updated.body.data.price_adjustment, "-25.50");
        assert.equal(updated.body.data.calories_adjustment, "-80.25");
        assert.equal(updated.body.data.protein_g_adjustment, "16.00");
        assert.equal(updated.body.data.carbs_g_adjustment, "0.00");
        assert.equal(updated.body.data.fat_g_adjustment, "-2.50");
        assert.deepEqual((await request(path)).body.data.find(row => row.id === id), updated.body.data);
        assert.equal((await adminRequest(`/meals/2/customizations/${id}`, "PATCH", { name: "Foreign" })).status, 404);
        assert.equal((await adminRequest(`/meals/2/customizations/${id}`, "DELETE")).status, 404);
        await pool.query("INSERT INTO cart_item_customizations (cart_item_id, option_id) VALUES ($1, $2)", [1, id]);
        const removed = await adminRequest(`${path}/${id}`, "DELETE");
        assert.equal(removed.status, 200);
        assert.equal(removed.body.data.is_available, false);
        assert.ok(!ids(await request(path)).includes(id));
        const manage = await adminRequest(`${path}/manage`);
        assert.deepEqual(removed.body.data, { ...updated.body.data, is_available: false });
        assert.deepEqual(manage.body.data.find(row => row.id === id), removed.body.data);
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
        assert.deepEqual(ids(await request("/products?category=Catalog&in_stock=false")), [id]);

        const patched = await adminRequest(route, "PATCH", { name: "Catalog Drink Updated", unit: null });
        assert.equal(patched.status, 200);
        assert.equal(patched.body.data.name, "Catalog Drink Updated");
        assert.equal(patched.body.data.unit, null);
        assert.ok(patched.body.data.updated_at >= created.body.data.updated_at);
        const stocked = await adminRequest(`${route}/stock`, "PATCH", { adjustment: 5 });
        assert.equal(stocked.status, 200);
        assert.equal(stocked.body.data.stock_quantity, 5);
        assert.deepEqual(ids(await request("/products?category=Catalog&in_stock=false")), []);
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
                code: "VALIDATION_ERROR",
                message: "Validation failed",
                errors: ["category_id does not reference an existing category"]
            });
        }
        assert.equal((await request("/meals/1")).body.data.category_id, "1");
    });
});
