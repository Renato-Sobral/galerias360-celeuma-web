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
      type: DataTypes.ENUM('texto', 'imagem', 'modelo3d', 'audio', 'audioespacial', 'video', 'link'),
      allowNull: true,
    },
    conteudo: {
      type: DataTypes.STRING,
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
  }, {
    tableName: 'hotspots',
    timestamps: false,
});
  
module.exports = Hotspot;

