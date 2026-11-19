const authRoutes = require("./auth.routes");

module.exports = {
    name: "auth",
    basePath: "/api/auth",
    router: authRoutes
};
