const { DataTypes } = require('sequelize');
const sequelize = require('./database'); // assume que tens o sequelize inicializado aqui

const MapOverlay = sequelize.define('map_overlay', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tipo: {
        type: DataTypes.ENUM('imagem', 'video', 'modelo3d'),
        allowNull: false
    },
    conteudo: {
        type: DataTypes.BLOB('long'),
        allowNull: false
    },
    mediaPath: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: "map_overlay",
    timestamps: false,
});

module.exports = MapOverlay;