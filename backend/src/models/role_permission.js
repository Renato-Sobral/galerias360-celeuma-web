const { DataTypes } = require("sequelize");
const sequelize = require("./database");
const Role = require("./role");
const Permission = require("./permission");

const RolePermission = sequelize.define("role_permission", {
    id_permission: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: Role, key: "id_role" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
    },
    id_role: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: Permission, key: "id_permission" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
    },
}, {
    timestamps: false,
    tableName: "role_permissions",
});

module.exports = RolePermission;
