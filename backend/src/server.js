require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Kiểm tra kết nối database
        await pool.query("SELECT 1");

        console.log("Connected to PostgreSQL");

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Cannot connect to database:", error);
        process.exit(1);
    }
}

startServer();
