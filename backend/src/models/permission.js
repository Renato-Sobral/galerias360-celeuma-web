const { DataTypes } = require("sequelize");
const sequelize = require("./database");

const Permission = sequelize.define("permission", {
    id_permission: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    tableName: "permissions",
    timestamps: false
});

module.exports = Permission;