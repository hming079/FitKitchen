
const express = require("express");
const cors = require("cors");
const mealModule = require("./modules/meal");

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

module.exports = app;
