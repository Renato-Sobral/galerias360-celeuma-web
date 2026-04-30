const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const user = require('../models/user');
const role = require('../models/role');
const { sendAccountConfirmationEmail } = require('./emailSenderController');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send({ message: 'Email e senha são obrigatórios' });
    }

    try {
        const utilizador = await user.findOne({ where: { email } });

        if (!utilizador) {
            return res.status(401).send({ message: 'Credenciais inválidas' });
        }

        if (utilizador.active === false) {
            return res.status(403).send({ message: 'A sua conta está bloqueada. Contacte um administrador.' });
        }

        if (!utilizador.email_confirmed) {
            return res.status(403).send({ message: 'Conta não confirmada. Verifique o email antes de iniciar sessão.' });
        }

        const isMatch = await bcrypt.compare(password, utilizador.password);

        if (!isMatch) {
            return res.status(401).send({ message: 'Senha inválida' });
        }

        const r = utilizador.id_role ? await role.findOne({ where: { id_role: utilizador.id_role } }) : null;
        const userRole = r ? r.name : 'User';

        const authToken = jwt.sign(
            {
                user: utilizador.id_user,
                name: utilizador.name,
                email: utilizador.email,
                role: userRole,
                id_role: utilizador.id_role,
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.send({ message: 'Login bem-sucedido', authToken });

    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).send({ message: 'Erro no servidor' });
    }
};


// Função de registo
exports.registo = async (req, res) => {
    const { email, name, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).send({ message: 'Nome, email e senha são obrigatórios' });
    }
    try {
        const userExistente = await user.findOne({ where: { email } });

        if (userExistente) {
            return res.status(400).send({ message: 'Email já está em uso' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Bootstrap: o primeiro utilizador criado vira Admin; restantes viram User.
        const totalUsers = await user.count();
        const defaultRoleName = totalUsers === 0 ? 'Admin' : 'User';

        const [defaultRole] = await role.findOrCreate({
            where: { name: defaultRoleName },
            defaults: { name: defaultRoleName }
        });

        const id_role = defaultRole.id_role;

        const novouser = await user.create({
            name,
            email,
            id_role,
            password: hashedPassword,
            email_confirmed: false,
        });

        if (novouser) {
            try {
                const confirmationToken = jwt.sign(
                    {
                        id_user: novouser.id_user,
                        email: novouser.email,
                        purpose: 'confirm-account',
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );

                await sendAccountConfirmationEmail(novouser.email, confirmationToken, novouser.name);
            } catch (error) {
                await novouser.destroy();
                throw error;
            }

            return res.status(201).send({ message: 'Conta criada com sucesso. Verifique o email para confirmar a conta.' });
        } else {
            return res.status(500).send({ message: 'Erro ao registar o user' });
        }
    } catch (error) {
        console.error('Erro no registo:', error);
        res.status(500).send({ message: error.message || 'Erro no servidor' });
    }
};

exports.confirmarConta = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: 'Token de confirmação é obrigatório.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.purpose !== 'confirm-account' || !decoded.id_user || !decoded.email) {
            return res.status(400).json({ message: 'Token de confirmação inválido.' });
        }

        const utilizador = await user.findOne({
            where: {
                id_user: decoded.id_user,
                email: decoded.email,
            },
        });

        if (!utilizador) {
            return res.status(404).json({ message: 'Utilizador não encontrado para confirmação.' });
        }

        if (utilizador.email_confirmed) {
            return res.status(200).json({ message: 'A conta já se encontra confirmada.' });
        }

        utilizador.email_confirmed = true;
        await utilizador.save();

        return res.status(200).json({ message: 'Conta confirmada com sucesso. Já pode iniciar sessão.' });
    } catch (error) {
        console.error('Erro ao confirmar conta:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'O link de confirmação expirou. Faça um novo registo ou peça reenvio.' });
        }

        return res.status(400).json({ message: 'Token de confirmação inválido.' });
    }
};

exports.users = async (req, res) => {
    try {
        const users = await user.findAll();
        return res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao listar useres:', error);
        return res.status(400).json({ error: error.message });
    }
};

exports.updateNome = async (req, res) => {
    const { nome } = req.body;
    const { id } = req.params;

    // Verifica se o token está presente no cabeçalho Authorization
    const authToken = req.headers.authorization?.split(' ')[1];
    if (!authToken) {
        return res.status(401).send({ message: 'Token de autenticação não fornecido' });
    }

    try {
        // Verifica o token JWT
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);

        // Verifica se o ID do user no token corresponde ao ID fornecido
        if (decoded.id !== parseInt(id)) {
            return res.status(401).send({ message: 'ID do user no token não corresponde ao ID fornecido' });
        }

        const user = await user.findOne({ where: { id: id } });

        if (!user) {
            return res.status(404).send({ message: 'user não encontrado' });
        }

        // Atualiza o nome do user
        user.nome = nome;
        await user.save();

        return res.status(200).send({ message: 'Nome atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar nome:', error);
        return res.status(500).send({ message: 'Erro no servidor' });
    }
};

exports.permissao = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Pega o token da autorização (Bearer <token>)

    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Valida o token com a chave secreta

        // Caso o token seja válido, retorne as informações do usuário (pode incluir o papel ou permissões)
        res.json({ isAuthorized: true, user: decoded });
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};