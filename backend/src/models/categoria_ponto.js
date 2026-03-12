const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const CategoriaPonto = sequelize.define(
    'categorias_ponto',
    {
        id_categoria: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
    },
    {
        tableName: 'categorias_ponto',
        timestamps: true,
    }
);

module.exports = CategoriaPonto;
