const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Role = require('../models/role');
const Mailjet = require('node-mailjet');

const mailjet = new Mailjet({
    apiKey: process.env.MJ_APIKEY_PUBLIC,
    apiSecret: process.env.MJ_APIKEY_PRIVATE,
});

const sendResetPasswordEmail = async (email, token) => {
    try {
        const request = mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [
                {
                    From: {
                        Email: 'projetogalerias360@gmail.com',
                        Name: 'Galerias 360',
                    },
                    To: [
                        {
                            Email: email,
                            Name: 'User',
                        },
                    ],
                    Subject: 'Redefinição de Palavra-Passe',
                    HTMLPart: `
                        <!DOCTYPE html>
                        <html lang="pt">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body {
                                    background-color: #f7f7f7;
                                    font-family: Arial, sans-serif;
                                    margin: 0;
                                    padding: 0;
                                }
                                .email-container {
                                    width: 100%;
                                    max-width: 600px;
                                    margin: 0 auto;
                                    background-color: #ffffff;
                                    border-radius: 10px;
                                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                                    overflow: hidden;
                                }
                                .email-header {
                                    background-color: #121212;
                                    color: #ffc107;
                                    padding: 20px;
                                    text-align: center;
                                }
                                .email-body {
                                    padding: 20px;
                                    text-align: center;
                                }
                                .email-footer {
                                    background-color: #f1f1f1;
                                    padding: 15px;
                                    text-align: center;
                                    font-size: 12px;
                                    color: #666666;
                                }
                                .cta-button {
                                    background-color: #121212;
                                    padding: 15px 30px;
                                    color: #ffc107;
                                    text-decoration: none;
                                    border-radius: 5px;
                                    font-weight: bold;
                                    display: inline-block;
                                    margin-top: 20px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="email-container">
                                <div class="email-header">
                                    <h3>Redefinição de Palavra-Passe</h3>
                                </div>
                                <div class="email-body">
                                    <p>Clique no botão abaixo para redefinir sua palavra-passe:</p>
                                    <a href="${process.env.FRONTEND_URL}/profile/reset-password/${token}" class="cta-button">Redefinir Senha</a>
                                </div>
                                <div class="email-footer">
                                    <p>&copy; 2025 Celeuma. Todos os direitos reservados.</p>
                                    <p>Se você não solicitou esse e-mail, por favor, ignore esta mensagem.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `,
                },
            ],
        });

        await request;
        console.log('Reset password email sent successfully');
    } catch (error) {
        console.error('Error sending reset password email:', error.message);
        throw new Error('Falha ao enviar o email de redefinição de senha. Verifique as configurações do Mailjet.');
    }
};

const sendInviteEmail = async (email, token, role) => {
    try {
        const request = mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [
                {
                    From: {
                        Email: 'projetogalerias360@gmail.com',
                        Name: 'Galerias 360',
                    },
                    To: [
                        {
                            Email: email,
                            Name: 'Convidado',
                        },
                    ],
                    Subject: 'Convite para se registar no Galerias 360',
                    HTMLPart: `
                        <!DOCTYPE html>
                        <html lang="pt">
                        <head>
                            <meta charset="UTF-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                            <style>
                                body {
                                    background-color: #f7f7f7;
                                    font-family: Arial, sans-serif;
                                    margin: 0; padding: 0;
                                }
                                .email-container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    background-color: #fff;
                                    border-radius: 10px;
                                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                                    overflow: hidden;
                                }
                                .email-header {
                                    background-color: #121212;
                                    color: #ffc107;
                                    padding: 20px;
                                    text-align: center;
                                }
                                .email-body {
                                    padding: 20px;
                                    text-align: center;
                                }
                                .email-footer {
                                    background-color: #f1f1f1;
                                    padding: 15px;
                                    text-align: center;
                                    font-size: 12px;
                                    color: #666666;
                                }
                                .cta-button {
                                    background-color: #121212;
                                    padding: 15px 30px;
                                    color: #ffc107;
                                    text-decoration: none;
                                    border-radius: 5px;
                                    font-weight: bold;
                                    display: inline-block;
                                    margin-top: 20px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="email-container">
                                <div class="email-header">
                                    <h3>Convite para se registar</h3>
                                </div>
                                <div class="email-body">
                                    <p>Você foi convidado para se registar no Galerias 360 com a role: <strong>${role}</strong>.</p>
                                    <p>Clique no botão abaixo para aceitar o convite e completar o registo:</p>
                                    <a href="${process.env.FRONTEND_URL}/convite/${token}" class="cta-button">Aceitar Convite</a>
                                </div>
                                <div class="email-footer">
                                    <p>&copy; 2024 Galerias 360.\.</p>
                                    <p>Se você não solicitou este convite, por favor, ignore esta mensagem.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `,
                },
            ],
        });

        await request;
        console.log('Convite enviado com sucesso');
    } catch (error) {
        console.error('Erro ao enviar convite:', error.message);
        throw new Error('Falha ao enviar email de convite.');
    }
};

exports.recuperarPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).send({ message: 'Email é obrigatório' });
    }

    try {
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).send({ message: 'User não encontrado' });
        }

        const resetToken = jwt.sign(
            { id_user: user.id_user },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        await sendResetPasswordEmail(user.email, resetToken);

        return res.status(200).send({ message: 'Email de recuperação enviado com sucesso' });
    } catch (error) {
        console.error('Erro ao enviar email de recuperação de senha:', error);
        return res.status(500).send({ message: error.message || 'Erro no servidor' });
    }
};

exports.redefinirPassword = async (req, res) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
        return res.status(400).send({ message: 'Token e nova senha são obrigatórios' });
    }

    try {
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        const user = await User.findOne({ where: { id_user: decoded.id_user } });

        if (!user) {
            return res.status(404).send({ message: 'User não encontrado' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).send({ message: 'Senha redefinida com sucesso' });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        return res.status(500).send({ message: error.message || 'Erro no servidor' });
    }
};

exports.convidarUtilizador = async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).send({ message: 'Email e role são obrigatórios' });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).send({ message: 'Já existe um utilizador com este email.' });
    }

    // Gera token de convite
    const inviteToken = jwt.sign(
      { email, role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await sendInviteEmail(email, inviteToken, role);

    return res.status(200).send({ message: 'Email de convite enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar email de convite:', error);
    return res.status(500).send({ message: error.message || 'Erro no servidor' });
  }
};

exports.registarComConvite = async (req, res) => {
  const { token, name, password } = req.body;

  if (!token || !name || !password) {
    return res.status(400).json({ message: "Token, nome e password são obrigatórios." });
  }

  try {
    // Validar token e extrair email e role
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email, role } = decoded;

    if (!email || !role) {
      return res.status(400).json({ message: "Token inválido. Dados incompletos." });
    }

    // Verificar se já existe utilizador com este email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Já existe um utilizador com este email." });
    }

    // Obter id da role pelo nome
    const foundRole = await Role.findOne({ where: { name: role } });
    if (!foundRole) {
      return res.status(400).json({ message: `Role "${role}" não encontrada.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar utilizador com id_role
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      id_role: foundRole.id_role,
    });

    return res.status(201).json({
      message: "Conta criada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao registar com convite:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado. Solicita novo convite." });
    }
    return res.status(500).json({ message: error.message || "Erro no servidor." });
  }
};