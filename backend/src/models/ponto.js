const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Ponto = sequelize.define('pontos', {
    id_ponto: {
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
    },
    latitude: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    longitude: {
        type: DataTypes.FLOAT, 
        allowNull: true
    },
    image: {
        type: DataTypes.BLOB('long'),
        allowNull: true
    },
    iv: {
        type: DataTypes.STRING,
        allowNull: true
      }
},
{
    tableName: "pontos",
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['latitude', 'longitude']
        }
    ]
});

module.exports = Ponto;
