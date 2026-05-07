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
    },
    systemKey: {
        type: DataTypes.STRING(120),
        allowNull: true,
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
    hotspotIconType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "default",
    },
    hotspotIconColor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        defaultValue: "#06b6d4",
    },
    hotspotTextFont: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "roboto",
    },
    hotspotCustomIcons: {
        type: DataTypes.JSON,
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
