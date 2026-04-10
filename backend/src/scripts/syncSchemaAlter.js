/* eslint-disable no-console */

require("dotenv").config();
require("../models/associations");

const sequelize = require("../models/database");

async function main() {
    console.log("🔧 Running sequelize.sync({ alter: true })...");
    await sequelize.sync({ alter: true });
    console.log("✅ Schema sync complete.");
    await sequelize.close();
}

main().catch(async (err) => {
    console.error("❌ Schema sync failed:", err);
    try {
        await sequelize.close();
    } catch {
        // ignore
    }
    process.exit(1);
});
