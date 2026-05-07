const Role = require("./role");
const Permission = require("./permission");
const RolePermission = require("./role_permission");
const Rota = require('./rota');
const Trajeto = require('./trajeto');
const Ponto = require('./ponto');
const PontoTrajeto = require('./ponto_trajeto');
const PontoCategoria = require('./ponto_categoria');
const Hotspot = require('./hotspot');
const CategoriaPonto = require('./categoria_ponto');
const ThemePreset = require('./theme_preset');
const AppSetting = require('./app_setting');
const PontoAlinhamento = require('./ponto_alinhamento');

// Role <-> Permission
Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'id_role',
    otherKey: 'id_permission',
});
Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: 'id_permission',
    otherKey: 'id_role',
});

// Trajeto <-> Ponto via PontoTrajeto
Trajeto.hasMany(PontoTrajeto, { foreignKey: 'id_trajeto' });
Ponto.hasMany(PontoTrajeto, { foreignKey: 'id_ponto' });
PontoTrajeto.belongsTo(Trajeto, { foreignKey: 'id_trajeto' });
PontoTrajeto.belongsTo(Ponto, { foreignKey: 'id_ponto' });

// Acesso direto a pontos do trajeto
Trajeto.belongsToMany(Ponto, {
    through: PontoTrajeto,
    foreignKey: 'id_trajeto',
    otherKey: 'id_ponto'
});
Ponto.belongsToMany(Trajeto, {
    through: PontoTrajeto,
    foreignKey: 'id_ponto',
    otherKey: 'id_trajeto'
});

// Trajeto → Rota
Trajeto.belongsTo(Rota, { foreignKey: 'id_rota', onDelete: 'CASCADE' });
Rota.hasMany(Trajeto, { foreignKey: 'id_rota', onDelete: 'CASCADE' });

// Hotspot → Ponto
Hotspot.belongsTo(Ponto, { foreignKey: 'id_ponto' });
Ponto.hasMany(Hotspot, { foreignKey: 'id_ponto' });

// Alinhamento → Ponto
PontoAlinhamento.belongsTo(Ponto, { foreignKey: 'id_ponto' });
Ponto.hasMany(PontoAlinhamento, { foreignKey: 'id_ponto' });

// Categoria <-> Ponto via PontoCategoria
Ponto.belongsToMany(CategoriaPonto, {
    through: PontoCategoria,
    foreignKey: 'id_ponto',
    otherKey: 'id_categoria',
    as: 'categorias'
});
CategoriaPonto.belongsToMany(Ponto, {
    through: PontoCategoria,
    foreignKey: 'id_categoria',
    otherKey: 'id_ponto',
    as: 'pontos'
});

module.exports = {
    Role,
    Permission,
    RolePermission,
    Rota,
    Trajeto,
    Ponto,
    CategoriaPonto,
    PontoCategoria,
    PontoTrajeto,
    Hotspot,
    ThemePreset,
    AppSetting,
    PontoAlinhamento
};
