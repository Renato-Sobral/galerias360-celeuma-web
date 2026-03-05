const Log = require('../models/log');
const { Op } = require('sequelize');
const archiver = require("archiver");

exports.listWeeklyLogs = async (req, res) => {
    try {
        const logs = await Log.findAll();

        if (!logs || logs.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error("❌ Erro ao buscar logs:", error);
        return res.status(500).json({ error: "Erro ao buscar logs" });
    }
};

exports.downloadWeeklyLog = async (req, res) => {
    try {
        const log = await Log.findByPk(req.params.id);

        if (!log || !log.logFile) {
            return res.status(404).json({ error: 'Log não encontrado' });
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="log-${log.weekStartDate.toISOString().split('T')[0]}.txt"`);
        res.send(log.logFile);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao baixar o log semanal' });
    }
};

exports.downloadAllLogs = async (req, res) => {
    try {
        const logs = await Log.findAll();

        if (!logs || logs.length === 0) {
            return res.status(404).json({ error: "Nenhum log encontrado" });
        }

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", 'attachment; filename="logs.zip"');

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(res);

        logs.forEach((log) => {
            const data = log.weekStartDate
                ? log.weekStartDate.toISOString().split("T")[0]
                : `log-${log.id_log}`;

            const fileName = `log-${data}.txt`;

            // ⚠️ Converter BLOB para string
            let fileContent = "⚠️ Log vazio.";
            if (log.logFile) {
                try {
                    fileContent = Buffer.from(log.logFile).toString("utf-8");
                } catch (err) {
                    console.warn(`Erro ao converter log ID ${log.id_log}:`, err);
                }
            }

            archive.append(fileContent, { name: fileName });
        });

        await archive.finalize();
    } catch (err) {
        console.error("❌ Erro ao criar ZIP:", err);
        res.status(500).json({ error: "Erro ao gerar ZIP com logs" });
    }
};

