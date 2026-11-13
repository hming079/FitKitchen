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

module.exports = {
    hashPassword
};
