const mealRoutes = require("./meal.routes");

module.exports = {
    name: "meals",
    basePath: "/api/meals",
    router: mealRoutes
};
