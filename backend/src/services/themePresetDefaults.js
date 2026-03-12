const ThemePreset = require('../models/theme_preset');
const logger = require('../models/logger');

const DEFAULT_THEME_SYSTEM_KEY = 'default-base';

const DEFAULT_LIGHT_VARS = {
    background: '0 0% 100%',
    foreground: '0 0% 3.9%',
    card: '0 0% 100%',
    'card-foreground': '0 0% 3.9%',
    popover: '0 0% 100%',
    'popover-foreground': '0 0% 3.9%',
    primary: '0 0% 9%',
    'primary-foreground': '0 0% 98%',
    secondary: '0 0% 96.1%',
    'secondary-foreground': '0 0% 9%',
    muted: '0 0% 96.1%',
    'muted-foreground': '0 0% 45.1%',
    accent: '0 0% 96.1%',
    'accent-foreground': '0 0% 9%',
    destructive: '0 84.2% 60.2%',
    'destructive-foreground': '0 0% 98%',
    border: '0 0% 89.8%',
    input: '0 0% 89.8%',
    ring: '0 0% 3.9%',
    'chart-1': '12 76% 61%',
    'chart-2': '173 58% 39%',
    'chart-3': '197 37% 24%',
    'chart-4': '43 74% 66%',
    'chart-5': '27 87% 67%',
};

const DEFAULT_DARK_VARS = {
    background: '0 0% 0%',
    foreground: '0 0% 98%',
    card: '0 0% 0%',
    'card-foreground': '0 0% 98%',
    popover: '0 0% 0%',
    'popover-foreground': '0 0% 98%',
    primary: '0 0% 100%',
    'primary-foreground': '0 0% 0%',
    secondary: '0 0% 5%',
    'secondary-foreground': '0 0% 98%',
    muted: '0 0% 5%',
    'muted-foreground': '0 0% 70%',
    accent: '0 0% 5%',
    'accent-foreground': '0 0% 98%',
    destructive: '0 70% 40%',
    'destructive-foreground': '0 0% 100%',
    border: '0 0% 8%',
    input: '0 0% 8%',
    ring: '0 0% 83.1%',
    'chart-1': '220 70% 50%',
    'chart-2': '160 60% 45%',
    'chart-3': '30 80% 55%',
    'chart-4': '280 65% 60%',
    'chart-5': '340 75% 55%',
};

const DEFAULT_THEME_PRESETS = [
    {
        systemKey: DEFAULT_THEME_SYSTEM_KEY,
        name: 'Predefinido',
        description: 'Visual original da aplicação',
        lightVars: { ...DEFAULT_LIGHT_VARS },
        darkVars: { ...DEFAULT_DARK_VARS },
    },
    {
        systemKey: 'corporate-blue',
        name: 'Azul Corporativo',
        description: 'Tons profissionais e neutros',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '221 83% 53%',
            'primary-foreground': '0 0% 100%',
            secondary: '213 27% 92%',
            'secondary-foreground': '221 39% 22%',
            accent: '215 100% 96%',
            'accent-foreground': '221 83% 38%',
            ring: '221 83% 53%',
            'chart-1': '221 83% 53%',
            'chart-2': '199 89% 48%',
            'chart-3': '173 80% 40%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '213 94% 68%',
            'primary-foreground': '222 47% 11%',
            secondary: '222 35% 18%',
            'secondary-foreground': '210 40% 96%',
            accent: '216 34% 20%',
            'accent-foreground': '214 95% 78%',
            ring: '213 94% 68%',
            'chart-1': '213 94% 68%',
            'chart-2': '199 89% 58%',
            'chart-3': '173 74% 50%',
        },
    },
    {
        systemKey: 'emerald',
        name: 'Verde Esmeralda',
        description: 'Fresco e moderno',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '160 84% 35%',
            'primary-foreground': '0 0% 100%',
            secondary: '151 30% 92%',
            'secondary-foreground': '160 67% 20%',
            accent: '152 76% 94%',
            'accent-foreground': '160 84% 28%',
            ring: '160 84% 35%',
            'chart-1': '160 84% 35%',
            'chart-2': '173 58% 39%',
            'chart-3': '142 71% 45%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '152 66% 56%',
            'primary-foreground': '160 70% 10%',
            secondary: '156 28% 16%',
            'secondary-foreground': '149 61% 90%',
            accent: '159 35% 20%',
            'accent-foreground': '152 66% 70%',
            ring: '152 66% 56%',
            'chart-1': '152 66% 56%',
            'chart-2': '173 58% 49%',
            'chart-3': '142 71% 55%',
        },
    },
    {
        systemKey: 'violet',
        name: 'Violeta',
        description: 'Mais criativo e vibrante',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '262 83% 58%',
            'primary-foreground': '0 0% 100%',
            secondary: '265 35% 94%',
            'secondary-foreground': '262 48% 26%',
            accent: '270 100% 96%',
            'accent-foreground': '262 83% 42%',
            ring: '262 83% 58%',
            'chart-1': '262 83% 58%',
            'chart-2': '292 84% 61%',
            'chart-3': '234 89% 74%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '263 89% 72%',
            'primary-foreground': '258 48% 12%',
            secondary: '261 32% 18%',
            'secondary-foreground': '268 100% 93%',
            accent: '267 30% 22%',
            'accent-foreground': '263 89% 80%',
            ring: '263 89% 72%',
            'chart-1': '263 89% 72%',
            'chart-2': '292 84% 71%',
            'chart-3': '234 89% 74%',
        },
    },
    {
        systemKey: 'sunset-orange',
        name: 'Laranja Sunset',
        description: 'Quente e energético',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '24 95% 53%',
            'primary-foreground': '0 0% 100%',
            secondary: '32 68% 93%',
            'secondary-foreground': '20 67% 22%',
            accent: '34 100% 95%',
            'accent-foreground': '24 95% 38%',
            ring: '24 95% 53%',
            'chart-1': '24 95% 53%',
            'chart-2': '14 90% 60%',
            'chart-3': '43 96% 56%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '28 96% 64%',
            'primary-foreground': '24 60% 12%',
            secondary: '24 32% 18%',
            'secondary-foreground': '36 100% 92%',
            accent: '21 34% 22%',
            'accent-foreground': '28 96% 76%',
            ring: '28 96% 64%',
            'chart-1': '28 96% 64%',
            'chart-2': '14 90% 66%',
            'chart-3': '43 96% 62%',
        },
    },
    {
        systemKey: 'rose',
        name: 'Rosa Quartz',
        description: 'Suave e elegante',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '336 84% 57%',
            'primary-foreground': '0 0% 100%',
            secondary: '334 31% 93%',
            'secondary-foreground': '335 42% 26%',
            accent: '330 100% 96%',
            'accent-foreground': '336 84% 40%',
            ring: '336 84% 57%',
            'chart-1': '336 84% 57%',
            'chart-2': '315 79% 63%',
            'chart-3': '284 82% 69%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '335 90% 70%',
            'primary-foreground': '335 49% 13%',
            secondary: '331 29% 18%',
            'secondary-foreground': '330 60% 92%',
            accent: '329 31% 22%',
            'accent-foreground': '335 90% 81%',
            ring: '335 90% 70%',
            'chart-1': '335 90% 70%',
            'chart-2': '315 79% 69%',
            'chart-3': '284 82% 75%',
        },
    },
    {
        systemKey: 'slate-pro',
        name: 'Slate Pro',
        description: 'Minimal e técnico',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '215 25% 27%',
            'primary-foreground': '210 40% 98%',
            secondary: '210 22% 92%',
            'secondary-foreground': '215 24% 26%',
            accent: '210 24% 95%',
            'accent-foreground': '215 25% 33%',
            ring: '215 25% 27%',
            'chart-1': '215 25% 27%',
            'chart-2': '199 30% 45%',
            'chart-3': '173 23% 39%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '210 20% 88%',
            'primary-foreground': '222 47% 11%',
            secondary: '217 24% 18%',
            'secondary-foreground': '210 20% 90%',
            accent: '217 20% 22%',
            'accent-foreground': '210 20% 92%',
            ring: '210 20% 88%',
            'chart-1': '210 20% 88%',
            'chart-2': '199 38% 62%',
            'chart-3': '173 32% 56%',
        },
    },
    {
        systemKey: 'amber-night',
        name: 'Âmbar Noturno',
        description: 'Contraste forte e premium',
        lightVars: {
            ...DEFAULT_LIGHT_VARS,
            primary: '42 96% 48%',
            'primary-foreground': '26 75% 12%',
            secondary: '39 45% 90%',
            'secondary-foreground': '31 45% 22%',
            accent: '48 100% 92%',
            'accent-foreground': '35 92% 35%',
            ring: '42 96% 48%',
            'chart-1': '42 96% 48%',
            'chart-2': '28 91% 58%',
            'chart-3': '12 84% 60%',
        },
        darkVars: {
            ...DEFAULT_DARK_VARS,
            primary: '45 100% 66%',
            'primary-foreground': '30 52% 11%',
            secondary: '34 27% 17%',
            'secondary-foreground': '48 88% 90%',
            accent: '29 31% 21%',
            'accent-foreground': '45 100% 78%',
            ring: '45 100% 66%',
            'chart-1': '45 100% 66%',
            'chart-2': '28 91% 66%',
            'chart-3': '12 84% 68%',
        },
    },
];

async function seedThemePreset(defaultPreset) {
    let preset = await ThemePreset.findOne({ where: { systemKey: defaultPreset.systemKey } });

    if (!preset) {
        preset = await ThemePreset.findOne({ where: { name: defaultPreset.name } });
    }

    if (!preset) {
        await ThemePreset.create({
            systemKey: defaultPreset.systemKey,
            name: defaultPreset.name,
            description: defaultPreset.description,
            lightVars: defaultPreset.lightVars,
            darkVars: defaultPreset.darkVars,
        });
        return 'created';
    }

    const updates = {};
    if (!preset.systemKey) updates.systemKey = defaultPreset.systemKey;
    if (!preset.description && defaultPreset.description) updates.description = defaultPreset.description;

    if (Object.keys(updates).length > 0) {
        await preset.update(updates);
        return 'updated';
    }

    return 'skipped';
}

async function seedDefaultThemePresets() {
    let createdCount = 0;
    let updatedCount = 0;

    for (const defaultPreset of DEFAULT_THEME_PRESETS) {
        const result = await seedThemePreset(defaultPreset);
        if (result === 'created') createdCount += 1;
        if (result === 'updated') updatedCount += 1;
    }

    if (createdCount > 0 || updatedCount > 0) {
        logger.info(`Presets de tema default sincronizados: ${createdCount} criados, ${updatedCount} atualizados.`);
    }
}

function getDefaultThemePreset() {
    return ThemePreset.findOne({ where: { systemKey: DEFAULT_THEME_SYSTEM_KEY } });
}

module.exports = {
    DEFAULT_THEME_SYSTEM_KEY,
    seedDefaultThemePresets,
    getDefaultThemePreset,
};
