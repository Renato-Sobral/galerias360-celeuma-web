const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const Ponto = require('./ponto');

const Hotspot = sequelize.define('hotspots', {
  id_hotspot: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_ponto: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Ponto,
      key: 'id_ponto',
    },
    onDelete: 'CASCADE',
  },
  tipo: {
    type: DataTypes.ENUM('texto', 'imagem', 'imagem4p', 'modelo3d', 'audio', 'audioespacial', 'video', 'link'),
    allowNull: true,
  },
  conteudo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  x: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  y: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  z: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  icon_type: {
    type: DataTypes.ENUM('ring', 'default', 'custom'),
    allowNull: true,
    defaultValue: 'ring',
  },
  icon_color: {
    type: DataTypes.STRING(7),
    allowNull: true,
    defaultValue: '#06b6d4',
  },
  hide_icon: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'hotspots',
  timestamps: false,
});

module.exports = Hotspot;

