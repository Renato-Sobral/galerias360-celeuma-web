const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const HotspotUserCustomization = sequelize.define('hotspot_user_customization', {
  id_hotspot_user_customization: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_hotspot: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'hotspots',
      key: 'id_hotspot',
    },
    onDelete: 'CASCADE',
  },
  id_user: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id_user',
    },
    onDelete: 'CASCADE',
  },
  overrides: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'hotspot_user_customization',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['id_hotspot', 'id_user'],
    },
  ],
});

module.exports = HotspotUserCustomization;
