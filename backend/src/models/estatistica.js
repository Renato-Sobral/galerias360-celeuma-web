const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Estatistica = sequelize.define('estatisticas', {
  id_visualizacao: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tipo: {
    type: DataTypes.ENUM('ponto', 'rota'),
    allowNull: false,
  },
  referencia_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  data: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'estatisticas',
  timestamps: true,
});

module.exports = Estatistica;
