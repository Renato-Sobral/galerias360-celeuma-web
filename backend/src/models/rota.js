const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Rota = sequelize.define('rotas', {
    id_rota: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
},{
    tableName: "rotas",
    timestamps: false
});

module.exports = Rota;
