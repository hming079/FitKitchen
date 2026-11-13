const userRoutes = require("./user.routes");

module.exports = {
    name: "users",
    basePath: "/api/users",
    router: userRoutes
};
