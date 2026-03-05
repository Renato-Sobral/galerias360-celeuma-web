const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const Rota = require('./rota');

const Trajeto = sequelize.define('trajetos', { 
    id_trajeto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_rota: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: Rota,
          key: 'id_rota'
        },
        onDelete: 'CASCADE'
      },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    video: {
        type: DataTypes.STRING,
        allowNull: true
    }
},{
    tableName: "trajetos",
    timestamps: true
});

module.exports = Trajeto;
