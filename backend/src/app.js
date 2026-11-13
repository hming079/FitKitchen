
const express = require("express");
const cors = require("cors");
const mealModule = require("./modules/meal");
const userModule = require("./modules/user");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "EatClean API is running"
    });
});

app.use(mealModule.basePath, mealModule.router);
app.use(userModule.basePath, userModule.router);

module.exports = app;
