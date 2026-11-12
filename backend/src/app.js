
const express = require("express");
const cors = require("cors");
const { registerFeatureModules } = require("./modules");

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

registerFeatureModules(app);

// Keep the original public endpoint while clients migrate to /api/catalog.
app.use("/api/meals", require("./routes/meal.route"));

module.exports = app;
