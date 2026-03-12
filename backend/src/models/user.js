const { DataTypes } = require("sequelize");
const sequelize = require("./database");
const Role = require("./role");

// Modelo User
const User = sequelize.define("user", {
  id_user: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  id_role: {
    type: DataTypes.INTEGER,
    references: {
      model: 'roles',
      key: 'id_role',
    },
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  email_confirmed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: "users",
  timestamps: false
});

User.belongsTo(Role, {
  foreignKey: 'id_role',
});

module.exports = User;
