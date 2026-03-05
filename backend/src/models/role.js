// Role Model
const { DataTypes } = require("sequelize");
const sequelize = require("./database");

const Role = sequelize.define("role", {
    id_role: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    tableName: "roles",
    timestamps: false
});

module.exports = Role;
