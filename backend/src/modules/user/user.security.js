const crypto = require("crypto");

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");
        crypto.scrypt(password, salt, 64, (error, derivedKey) => {
            if (error) {
                return reject(error);
            }
            return resolve(`scrypt:${salt}:${derivedKey.toString("hex")}`);
        });
    });
}

function verifyPassword(password, storedHash) {
    return new Promise((resolve) => {
        const match = /^scrypt:([^:]+):([0-9a-f]{128})$/.exec(storedHash || "");
        if (!match) return resolve(false);

        const salt = match[1];
        const expected = Buffer.from(match[2], "hex");
        crypto.scrypt(password, salt, expected.length, (error, derivedKey) => {
            if (error || derivedKey.length !== expected.length) return resolve(false);
            return resolve(crypto.timingSafeEqual(derivedKey, expected));
        });
    });
}

module.exports = {
    hashPassword,
    verifyPassword
};
