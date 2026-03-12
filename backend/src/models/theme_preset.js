const { DataTypes } = require("sequelize");
const sequelize = require("./database");

const ThemePreset = sequelize.define("theme_preset", {
    id_theme_preset: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
    },
    systemKey: {
        type: DataTypes.STRING(120),
        allowNull: true,
        unique: true,
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    lightVars: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    darkVars: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    logoLightUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    logoDarkUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    tableName: "theme_preset",
    timestamps: true,
});

module.exports = ThemePreset;
