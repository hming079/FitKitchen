const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../src/modules/user/user.security");

test("password verification accepts the original password and rejects another", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
    assert.equal(await verifyPassword("wrong password", hash), false);
});

test("password verification rejects malformed stored hashes", async () => {
    assert.equal(await verifyPassword("anything", "hashed_pass_admin"), false);
});
