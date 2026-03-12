const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const PontoCategoria = sequelize.define(
    'ponto_categoria',
    {
        id_ponto: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        id_categoria: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
    },
    {
        tableName: 'ponto_categoria',
        timestamps: false,
    }
);

module.exports = PontoCategoria;
