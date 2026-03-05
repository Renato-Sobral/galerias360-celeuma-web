const winston = require('winston');
const { format, transports } = winston;
const Log = require('../models/log');
const { Op } = require('sequelize');

const getCurrentWeekStart = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - now.getDay());
    return now;
};

let logBuffer = "";
let currentWeekStart = getCurrentWeekStart();

const checkAndRotateWeeklyLog = async () => {
    const now = new Date();
    if (now.getTime() >= currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000) {
        await updateWeeklyLogInDatabase();
        logBuffer = "";
        lastSavedLog = "";
        currentWeekStart = getCurrentWeekStart();
    }
};

const appendLog = async (level, message) => {
    const timestamp = new Date().toLocaleString("pt-PT", {
        timeZone: "Europe/Lisbon"
    });

    const newLogEntry = `${timestamp} [${level.toUpperCase()}]: ${message}\n`;

    if (global.io) {
        global.io.emit("log", { message: newLogEntry.trim() });
    }

    try {
        const existingLog = await Log.findOne({ where: { weekStartDate: currentWeekStart } });

        if (existingLog) {
            const currentContent = existingLog.logFile?.toString('utf-8') || '';
            const updatedContent = currentContent + newLogEntry;

            await existingLog.update({
                logFile: Buffer.from(updatedContent, 'utf-8')
            });
        } else {
            await Log.create({
                weekStartDate: currentWeekStart,
                logFile: Buffer.from(newLogEntry, 'utf-8')
            });
        }

        logBuffer += newLogEntry;
    } catch (error) {
        console.error('❌ Erro ao escrever log na BD:', error);
    }
};


const logger = {
    info: (message) => appendLog('info', message),
    error: (message) => appendLog('error', message),
    warn: (message) => appendLog('warn', message),
};

setInterval(checkAndRotateWeeklyLog, 60 * 60 * 1000);

module.exports = logger;
