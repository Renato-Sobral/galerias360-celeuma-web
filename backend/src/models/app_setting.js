const { DataTypes } = require("sequelize");
const sequelize = require("./database");

const AppSetting = sequelize.define("app_setting", {
    key: {
        type: DataTypes.STRING(120),
        primaryKey: true,
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: "app_setting",
    timestamps: false,
});

module.exports = AppSetting;
