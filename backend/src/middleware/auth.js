const jwt = require('jsonwebtoken');

function getBearerToken(req) {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (!scheme || !token) return null;
    if (!/^Bearer$/i.test(scheme)) return null;
    return token;
}

function requireAuth(req, res, next) {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ message: 'Token não fornecido' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.auth = decoded;
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
}

function requireAdmin(req, res, next) {
    return requireAuth(req, res, () => {
        if (req.auth?.role !== 'Admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }
        return next();
    });
}

module.exports = {
    requireAuth,
    requireAdmin,
};
