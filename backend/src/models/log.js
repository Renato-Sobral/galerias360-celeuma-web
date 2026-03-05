const { DataTypes } = require('sequelize');
const sequelize = require('../models/database');

const Log = sequelize.define('logs', {
    id_log: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    weekStartDate: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    logFile: {
        type: DataTypes.BLOB('long'),
        allowNull: true,
    }
}, {
    tableName: "logs",
    timestamps: false
});

module.exports = Log;
