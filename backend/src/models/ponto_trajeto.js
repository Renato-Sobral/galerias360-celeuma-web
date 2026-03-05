const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const Trajeto = require('./trajeto');
const Ponto = require('./ponto');

const PontoTrajeto = sequelize.define('ponto_trajeto', {
    id_trajeto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: Trajeto,
          key: 'id_trajeto'
        },
        onDelete: 'CASCADE'
      },
      id_ponto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: Ponto,
          key: 'id_ponto'
        },
        onDelete: 'CASCADE'
      }
},{
    tableName: "ponto_trajeto",
    timestamps: false
});

module.exports = PontoTrajeto;
