const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const PontoAlinhamento = sequelize.define('ponto_alinhamentos', {
    id_alinhamento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_ponto: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    vista_path: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Relative path of the panorama file (e.g., pontos/image.jpg)'
    },
    radius: {
        type: DataTypes.FLOAT,
        defaultValue: 700,
        comment: 'Dome/sphere radius'
    },
    verticalOffset: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'Vertical offset of the panorama'
    },
    rotationX: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'Rotation around X axis (pitch)'
    },
    rotationY: {
        type: DataTypes.FLOAT,
        defaultValue: -130,
        comment: 'Rotation around Y axis (yaw)'
    },
    rotationZ: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'Rotation around Z axis (roll)'
    },
    mirrorX: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Mirror horizontally'
    },
    mirrorY: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Mirror vertically'
    }
},
    {
        tableName: "ponto_alinhamentos",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['id_ponto', 'vista_path']
            }
        ]
    });

module.exports = PontoAlinhamento;
