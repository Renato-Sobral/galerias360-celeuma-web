const User = require("../models/user");
const Role = require("../models/role");
const logger = require("../models/logger");

exports.listUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] },
            include: [{ model: Role, attributes: ['name'] }],
        });

        return res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error("Erro ao listar utilizadores:", error);
        return res.status(500).json({ success: false, message: "Erro ao buscar utilizadores" });
    }
};

exports.listRoles = async (req, res) => {
    try {
        const roles = await Role.findAll();
        return res.status(200).json({ success: true, data: roles });
    } catch (error) {
        console.error("Erro ao listar roles:", error);
        return res.status(500).json({ success: false, message: "Erro ao buscar roles" });
    }
};

exports.userDetailsById = async (req, res) => {
    const { id_user } = req.params;

    try {
        const user = await User.findByPk(id_user, {
            attributes: ['name', 'email']
        });

        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateUserRole = async (req, res) => {
    const { id_user } = req.params;
    const { role } = req.body;

    try {
        const user = await User.findByPk(id_user);
        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

        const foundRole = await Role.findOne({ where: { name: role } });
        if (!foundRole) return res.status(400).json({ error: "Role inválida" });

        user.id_role = foundRole.id_role;
        await user.save();

        logger.info(`Role do utilizador com ID ${id_user} atualizada para ${role}`);
        return res.status(200).json({ success: true, message: "Role atualizada com sucesso" });
    } catch (err) {
        console.error("Erro ao atualizar role:", err);
        return res.status(500).json({ error: "Erro interno ao atualizar a role" });
    }
};

exports.blockUser = async (req, res) => {
    const { id_user } = req.params;

    try {
        const user = await User.findByPk(id_user);
        if (!user) {
            return res.status(404).json({ success: false, error: "Utilizador não encontrado" });
        }

        user.active = false;
        await user.save();

        logger.info(`Utilizador com ID ${id_user} foi bloqueado`);
        return res.status(200).json({ success: true, message: "Utilizador bloqueado com sucesso" });
    } catch (err) {
        console.error("Erro ao bloquear utilizador:", err);
        return res.status(500).json({ success: false, error: "Erro interno ao bloquear o utilizador" });
    }
};

exports.unblockUser = async (req, res) => {
    const { id_user } = req.params;

    try {
        const user = await User.findByPk(id_user);
        if (!user) {
            return res.status(404).json({ success: false, error: "Utilizador não encontrado" });
        }

        user.active = true;
        await user.save();

        logger.info(`Utilizador com ID ${id_user} foi desbloqueado`);
        return res.status(200).json({ success: true, message: "Utilizador desbloqueado com sucesso" });
    } catch (err) {
        console.error("Erro ao desbloquear utilizador:", err);
        return res.status(500).json({ success: false, error: "Erro interno ao desbloquear o utilizador" });
    }
};

exports.deleteUser = async (req, res) => {
    const { id_user } = req.params;

    try {
        const user = await User.findByPk(id_user);
        if (!user) {
            return res.status(404).json({ success: false, message: "Utilizador não encontrado" });
        }

        await user.destroy();

        logger.info(`Utilizador com ID ${id_user} foi eliminado`);
        return res.status(200).json({ success: true, message: "Utilizador eliminado com sucesso" });
    } catch (error) {
        console.error("Erro ao eliminar utilizador:", error);
        return res.status(500).json({ success: false, message: "Erro ao eliminar utilizador" });
    }
};
