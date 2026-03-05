"use client";

import { useEffect, useState, useRef } from "react";
import ProtectedRoute from "../../components/protectedRoute";
import { useThemePresets, CSS_VAR_KEYS } from "../../components/themePresetContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Plus,
    Pencil,
    Trash2,
    Check,
    Upload,
    X,
    Star,
    Eye,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

/* ── resolve relative logo URLs ── */
function resolveLogoUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;
    return `${API}${url.startsWith("/") ? "" : "/"}${url}`;
}

/* ── Default CSS vars (fallback from globals.css) ── */
const DEFAULT_LIGHT = {
    background: "0 0% 100%",
    foreground: "0 0% 3.9%",
    card: "0 0% 100%",
    "card-foreground": "0 0% 3.9%",
    popover: "0 0% 100%",
    "popover-foreground": "0 0% 3.9%",
    primary: "0 0% 9%",
    "primary-foreground": "0 0% 98%",
    secondary: "0 0% 96.1%",
    "secondary-foreground": "0 0% 9%",
    muted: "0 0% 96.1%",
    "muted-foreground": "0 0% 45.1%",
    accent: "0 0% 96.1%",
    "accent-foreground": "0 0% 9%",
    destructive: "0 84.2% 60.2%",
    "destructive-foreground": "0 0% 98%",
    border: "0 0% 89.8%",
    input: "0 0% 89.8%",
    ring: "0 0% 3.9%",
    "chart-1": "12 76% 61%",
    "chart-2": "173 58% 39%",
    "chart-3": "197 37% 24%",
    "chart-4": "43 74% 66%",
    "chart-5": "27 87% 67%",
};

const DEFAULT_DARK = {
    background: "0 0% 0%",
    foreground: "0 0% 98%",
    card: "0 0% 0%",
    "card-foreground": "0 0% 98%",
    popover: "0 0% 0%",
    "popover-foreground": "0 0% 98%",
    primary: "0 0% 100%",
    "primary-foreground": "0 0% 0%",
    secondary: "0 0% 5%",
    "secondary-foreground": "0 0% 98%",
    muted: "0 0% 5%",
    "muted-foreground": "0 0% 70%",
    accent: "0 0% 5%",
    "accent-foreground": "0 0% 98%",
    destructive: "0 70% 40%",
    "destructive-foreground": "0 0% 100%",
    border: "0 0% 8%",
    input: "0 0% 8%",
    ring: "0 0% 83.1%",
    "chart-1": "220 70% 50%",
    "chart-2": "160 60% 45%",
    "chart-3": "30 80% 55%",
    "chart-4": "280 65% 60%",
    "chart-5": "340 75% 55%",
};

/* ── HSL <-> Hex helpers ── */
function hslStringToHex(hslStr) {
    if (!hslStr) return "#000000";
    const parts = hslStr.trim().split(/\s+/);
    const h = parseFloat(parts[0]) || 0;
    const s = (parseFloat(parts[1]) || 0) / 100;
    const l = (parseFloat(parts[2]) || 0) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHslString(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: h = ((b - r) / d + 2) * 60; break;
            case b: h = ((r - g) / d + 4) * 60; break;
        }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/* ── Friendly labels ── */
const VAR_LABELS = {
    background: "Fundo", foreground: "Texto",
    card: "Card", "card-foreground": "Card Texto",
    popover: "Popover", "popover-foreground": "Popover Texto",
    primary: "Primária", "primary-foreground": "Primária Texto",
    secondary: "Secundária", "secondary-foreground": "Secundária Texto",
    muted: "Muted", "muted-foreground": "Muted Texto",
    accent: "Destaque", "accent-foreground": "Destaque Texto",
    destructive: "Destrutivo", "destructive-foreground": "Destrutivo Texto",
    border: "Borda", input: "Input", ring: "Anel",
    "chart-1": "Gráfico 1", "chart-2": "Gráfico 2", "chart-3": "Gráfico 3",
    "chart-4": "Gráfico 4", "chart-5": "Gráfico 5",
};

/* Group vars logically */
const VAR_GROUPS = [
    { label: "Base", keys: ["background", "foreground", "border", "input", "ring"] },
    { label: "Primária", keys: ["primary", "primary-foreground"] },
    { label: "Secundária", keys: ["secondary", "secondary-foreground"] },
    { label: "Card", keys: ["card", "card-foreground"] },
    { label: "Popover", keys: ["popover", "popover-foreground"] },
    { label: "Muted", keys: ["muted", "muted-foreground"] },
    { label: "Destaque", keys: ["accent", "accent-foreground"] },
    { label: "Destrutivo", keys: ["destructive", "destructive-foreground"] },
    { label: "Gráficos", keys: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] },
];

const SIMPLE_SCHEMES = [
    {
        id: "default",
        name: "Predefinido",
        description: "Visual original da aplicação",
        lightVars: { ...DEFAULT_LIGHT },
        darkVars: { ...DEFAULT_DARK },
    },
    {
        id: "corporate-blue",
        name: "Azul Corporativo",
        description: "Tons profissionais e neutros",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "221 83% 53%",
            "primary-foreground": "0 0% 100%",
            secondary: "213 27% 92%",
            "secondary-foreground": "221 39% 22%",
            accent: "215 100% 96%",
            "accent-foreground": "221 83% 38%",
            ring: "221 83% 53%",
            "chart-1": "221 83% 53%",
            "chart-2": "199 89% 48%",
            "chart-3": "173 80% 40%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "213 94% 68%",
            "primary-foreground": "222 47% 11%",
            secondary: "222 35% 18%",
            "secondary-foreground": "210 40% 96%",
            accent: "216 34% 20%",
            "accent-foreground": "214 95% 78%",
            ring: "213 94% 68%",
            "chart-1": "213 94% 68%",
            "chart-2": "199 89% 58%",
            "chart-3": "173 74% 50%",
        },
    },
    {
        id: "emerald",
        name: "Verde Esmeralda",
        description: "Fresco e moderno",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "160 84% 35%",
            "primary-foreground": "0 0% 100%",
            secondary: "151 30% 92%",
            "secondary-foreground": "160 67% 20%",
            accent: "152 76% 94%",
            "accent-foreground": "160 84% 28%",
            ring: "160 84% 35%",
            "chart-1": "160 84% 35%",
            "chart-2": "173 58% 39%",
            "chart-3": "142 71% 45%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "152 66% 56%",
            "primary-foreground": "160 70% 10%",
            secondary: "156 28% 16%",
            "secondary-foreground": "149 61% 90%",
            accent: "159 35% 20%",
            "accent-foreground": "152 66% 70%",
            ring: "152 66% 56%",
            "chart-1": "152 66% 56%",
            "chart-2": "173 58% 49%",
            "chart-3": "142 71% 55%",
        },
    },
    {
        id: "violet",
        name: "Violeta",
        description: "Mais criativo e vibrante",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "262 83% 58%",
            "primary-foreground": "0 0% 100%",
            secondary: "265 35% 94%",
            "secondary-foreground": "262 48% 26%",
            accent: "270 100% 96%",
            "accent-foreground": "262 83% 42%",
            ring: "262 83% 58%",
            "chart-1": "262 83% 58%",
            "chart-2": "292 84% 61%",
            "chart-3": "234 89% 74%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "263 89% 72%",
            "primary-foreground": "258 48% 12%",
            secondary: "261 32% 18%",
            "secondary-foreground": "268 100% 93%",
            accent: "267 30% 22%",
            "accent-foreground": "263 89% 80%",
            ring: "263 89% 72%",
            "chart-1": "263 89% 72%",
            "chart-2": "292 84% 71%",
            "chart-3": "234 89% 74%",
        },
    },
    {
        id: "sunset-orange",
        name: "Laranja Sunset",
        description: "Quente e energético",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "24 95% 53%",
            "primary-foreground": "0 0% 100%",
            secondary: "32 68% 93%",
            "secondary-foreground": "20 67% 22%",
            accent: "34 100% 95%",
            "accent-foreground": "24 95% 38%",
            ring: "24 95% 53%",
            "chart-1": "24 95% 53%",
            "chart-2": "14 90% 60%",
            "chart-3": "43 96% 56%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "28 96% 64%",
            "primary-foreground": "24 60% 12%",
            secondary: "24 32% 18%",
            "secondary-foreground": "36 100% 92%",
            accent: "21 34% 22%",
            "accent-foreground": "28 96% 76%",
            ring: "28 96% 64%",
            "chart-1": "28 96% 64%",
            "chart-2": "14 90% 66%",
            "chart-3": "43 96% 62%",
        },
    },
    {
        id: "rose",
        name: "Rosa Quartz",
        description: "Suave e elegante",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "336 84% 57%",
            "primary-foreground": "0 0% 100%",
            secondary: "334 31% 93%",
            "secondary-foreground": "335 42% 26%",
            accent: "330 100% 96%",
            "accent-foreground": "336 84% 40%",
            ring: "336 84% 57%",
            "chart-1": "336 84% 57%",
            "chart-2": "315 79% 63%",
            "chart-3": "284 82% 69%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "335 90% 70%",
            "primary-foreground": "335 49% 13%",
            secondary: "331 29% 18%",
            "secondary-foreground": "330 60% 92%",
            accent: "329 31% 22%",
            "accent-foreground": "335 90% 81%",
            ring: "335 90% 70%",
            "chart-1": "335 90% 70%",
            "chart-2": "315 79% 69%",
            "chart-3": "284 82% 75%",
        },
    },
    {
        id: "slate-pro",
        name: "Slate Pro",
        description: "Minimal e técnico",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "215 25% 27%",
            "primary-foreground": "210 40% 98%",
            secondary: "210 22% 92%",
            "secondary-foreground": "215 24% 26%",
            accent: "210 24% 95%",
            "accent-foreground": "215 25% 33%",
            ring: "215 25% 27%",
            "chart-1": "215 25% 27%",
            "chart-2": "199 30% 45%",
            "chart-3": "173 23% 39%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "210 20% 88%",
            "primary-foreground": "222 47% 11%",
            secondary: "217 24% 18%",
            "secondary-foreground": "210 20% 90%",
            accent: "217 20% 22%",
            "accent-foreground": "210 20% 92%",
            ring: "210 20% 88%",
            "chart-1": "210 20% 88%",
            "chart-2": "199 38% 62%",
            "chart-3": "173 32% 56%",
        },
    },
    {
        id: "amber-night",
        name: "Âmbar Noturno",
        description: "Contraste forte e premium",
        lightVars: {
            ...DEFAULT_LIGHT,
            primary: "42 96% 48%",
            "primary-foreground": "26 75% 12%",
            secondary: "39 45% 90%",
            "secondary-foreground": "31 45% 22%",
            accent: "48 100% 92%",
            "accent-foreground": "35 92% 35%",
            ring: "42 96% 48%",
            "chart-1": "42 96% 48%",
            "chart-2": "28 91% 58%",
            "chart-3": "12 84% 60%",
        },
        darkVars: {
            ...DEFAULT_DARK,
            primary: "45 100% 66%",
            "primary-foreground": "30 52% 11%",
            secondary: "34 27% 17%",
            "secondary-foreground": "48 88% 90%",
            accent: "29 31% 21%",
            "accent-foreground": "45 100% 78%",
            ring: "45 100% 66%",
            "chart-1": "45 100% 66%",
            "chart-2": "28 91% 66%",
            "chart-3": "12 84% 68%",
        },
    },
];

/* ═══════════════════════════════════════════════════════════════
   MINI-PREVIEW COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function MiniPreview({ vars, label, compact = false }) {
    if (!vars) return null;
    const bg = vars.background || "0 0% 100%";
    const fg = vars.foreground || "0 0% 0%";
    const primary = vars.primary || "0 0% 9%";
    const primaryFg = vars["primary-foreground"] || "0 0% 98%";
    const card = vars.card || bg;
    const cardFg = vars["card-foreground"] || fg;
    const muted = vars.muted || "0 0% 96%";
    const mutedFg = vars["muted-foreground"] || "0 0% 45%";
    const accent = vars.accent || muted;
    const border = vars.border || "0 0% 90%";
    const destructive = vars.destructive || "0 84% 60%";

    return (
        <div
            className="rounded-lg border overflow-hidden w-full"
            style={{
                background: `hsl(${bg})`,
                color: `hsl(${fg})`,
                borderColor: `hsl(${border})`,
            }}
        >
            <div className={`${compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs"} font-medium`} style={{ borderBottom: `1px solid hsl(${border})` }}>
                {label}
            </div>
            <div className={`${compact ? "p-2 space-y-1.5" : "p-3 space-y-2"}`}>
                {/* Fake card */}
                <div
                    className={`rounded-md ${compact ? "p-1.5 text-[11px]" : "p-2 text-xs"}`}
                    style={{ background: `hsl(${card})`, color: `hsl(${cardFg})`, border: `1px solid hsl(${border})` }}
                >
                    <div className="font-medium mb-1">Card exemplo</div>
                    <div style={{ color: `hsl(${mutedFg})` }}>Texto secundário</div>
                </div>
                {/* Buttons */}
                <div className={`flex ${compact ? "gap-1" : "gap-2"}`}>
                    <div
                        className={`rounded-md ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"} font-medium`}
                        style={{ background: `hsl(${primary})`, color: `hsl(${primaryFg})` }}
                    >
                        Botão
                    </div>
                    <div
                        className={`rounded-md ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"} font-medium`}
                        style={{ background: `hsl(${accent})`, color: `hsl(${fg})` }}
                    >
                        Secundário
                    </div>
                    <div
                        className={`rounded-md ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"} font-medium`}
                        style={{ background: `hsl(${destructive})`, color: `hsl(${primaryFg})` }}
                    >
                        Apagar
                    </div>
                </div>
                {/* Muted line */}
                <div className={`${compact ? "text-[10px]" : "text-xs"}`} style={{ color: `hsl(${mutedFg})` }}>
                    Texto muted de exemplo
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   COLOR PICKER ROW
   ═══════════════════════════════════════════════════════════════ */
function ColorPickerRow({ varKey, value, onChange }) {
    const hex = hslStringToHex(value);
    return (
        <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground w-32 shrink-0 truncate" title={varKey}>
                {VAR_LABELS[varKey] || varKey}
            </label>
            <div className="relative">
                <input
                    type="color"
                    value={hex}
                    onChange={(e) => onChange(varKey, hexToHslString(e.target.value))}
                    className="w-9 h-9 rounded-md border border-border cursor-pointer bg-transparent p-0.5"
                />
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(varKey, e.target.value)}
                className="flex-1 text-xs bg-muted rounded-md px-2 py-1.5 border border-border font-mono min-w-0"
                placeholder="H S% L%"
            />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   LOGO UPLOAD ROW
   ═══════════════════════════════════════════════════════════════ */
function LogoUploadRow({ label, previewUrl, onFile, invertPreview = false, darkBackground = false }) {
    const inputRef = useRef(null);
    return (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">{label}</p>
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`group relative h-24 w-full rounded-md border border-border flex flex-col items-center justify-center overflow-hidden gap-1 transition-colors ${darkBackground ? "bg-zinc-900" : "bg-background"}`}
                aria-label={`Escolher ficheiro para ${label}`}
            >
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={label}
                        className="max-h-14 max-w-[160px] object-contain"
                        style={invertPreview ? { filter: "invert(1)" } : undefined}
                    />
                ) : (
                    <>
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Clique para escolher ficheiro</span>
                    </>
                )}

                <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-5 h-5 text-foreground" />
                </div>
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
        </div>
    );
}

function SimpleSchemeCard({ scheme, isActive, onApply }) {
    const lightPrimary = scheme.lightVars?.primary || "0 0% 9%";
    const lightSecondary = scheme.lightVars?.secondary || "0 0% 96.1%";
    const lightAccent = scheme.lightVars?.accent || "0 0% 96.1%";

    const darkPrimary = scheme.darkVars?.primary || "0 0% 100%";
    const darkSecondary = scheme.darkVars?.secondary || "0 0% 5%";
    const darkAccent = scheme.darkVars?.accent || "0 0% 5%";

    return (
        <button
            type="button"
            onClick={onApply}
            className={`w-full text-left rounded-lg border p-2 transition-colors hover:bg-muted/30 ${isActive ? "ring-2 ring-primary bg-primary/5" : ""}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[15px] leading-5 font-semibold">{scheme.name}</div>
                    <div className="text-[12px] leading-4 text-muted-foreground">{scheme.description}</div>
                </div>
                {isActive && <Badge variant="secondary" className="h-7 px-3">Selecionado</Badge>}
            </div>

            <div className="mt-1.5 flex items-center gap-5 text-[12px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium">Claro</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: `hsl(${lightPrimary})` }} />
                    <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: `hsl(${lightSecondary})` }} />
                    <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: `hsl(${lightAccent})` }} />
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="font-medium">Escuro</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: `hsl(${darkPrimary})` }} />
                    <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: `hsl(${darkSecondary})` }} />
                    <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: `hsl(${darkAccent})` }} />
                </div>
            </div>
        </button>
    );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function PersonalizacaoPage() {
    const { presets, activePreset, refreshPresets, refreshActive } = useThemePresets();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [settingActive, setSettingActive] = useState(false);
    const [landingTitle, setLandingTitle] = useState("Explora o mundo com Galerias 360");
    const [landingDescription, setLandingDescription] = useState("Descobre pontos turísticos e culturais em realidade aumentada com uma experiência imersiva em 360º. Acede ao mapa interativo e mergulha em cada história.");
    const [savingLandingText, setSavingLandingText] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [lightVars, setLightVars] = useState({ ...DEFAULT_LIGHT });
    const [darkVars, setDarkVars] = useState({ ...DEFAULT_DARK });
    const [logoLightFile, setLogoLightFile] = useState(null);
    const [logoDarkFile, setLogoDarkFile] = useState(null);
    const [logoLightPreview, setLogoLightPreview] = useState(null);
    const [logoDarkPreview, setLogoDarkPreview] = useState(null);
    const [invertLogoDark, setInvertLogoDark] = useState(false);
    const [editMode, setEditMode] = useState("light"); // "light" | "dark"
    const [editorVariant, setEditorVariant] = useState("simple"); // "simple" | "advanced"

    useEffect(() => {
        refreshPresets();
        refreshActive();
    }, [refreshPresets, refreshActive]);

    useEffect(() => {
        let mounted = true;

        const loadLandingContent = async () => {
            try {
                const res = await fetch(`${API}/theme/landing-content`, { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                if (!mounted || !json?.success) return;

                setLandingTitle(json.data?.title || "Explora o mundo com Galerias 360");
                setLandingDescription(
                    json.data?.description ||
                    "Descobre pontos turísticos e culturais em realidade aumentada com uma experiência imersiva em 360º. Acede ao mapa interativo e mergulha em cada história."
                );
            } catch (err) {
                console.error(err);
            }
        };

        loadLandingContent();
        return () => {
            mounted = false;
        };
    }, []);

    const handleSaveLandingContent = async () => {
        if (!landingTitle.trim() || !landingDescription.trim()) return;
        setSavingLandingText(true);
        try {
            const res = await fetch(`${API}/theme/landing-content`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
                },
                body: JSON.stringify({
                    title: landingTitle,
                    description: landingDescription,
                }),
            });
            const json = await res.json();
            if (!json?.success) throw new Error(json?.message || "Erro ao atualizar texto da homepage");
        } catch (err) {
            console.error(err);
            alert(err.message || "Erro ao atualizar texto da homepage");
        } finally {
            setSavingLandingText(false);
        }
    };

    /* open dialog for create */
    const openCreate = () => {
        setEditingPreset(null);
        setName("");
        setLightVars({ ...DEFAULT_LIGHT });
        setDarkVars({ ...DEFAULT_DARK });
        setLogoLightFile(null);
        setLogoDarkFile(null);
        setLogoLightPreview(null);
        setLogoDarkPreview(null);
        setInvertLogoDark(false);
        setEditMode("light");
        setEditorVariant("simple");
        setDialogOpen(true);
    };

    /* open dialog for edit */
    const openEdit = (preset) => {
        setEditingPreset(preset);
        setName(preset.name);
        setLightVars({ ...DEFAULT_LIGHT, ...(preset.lightVars || {}) });
        setDarkVars({ ...DEFAULT_DARK, ...(preset.darkVars || {}) });
        setLogoLightFile(null);
        setLogoDarkFile(null);
        setLogoLightPreview(resolveLogoUrl(preset.logoLightUrl) || null);
        setLogoDarkPreview(resolveLogoUrl(preset.logoDarkUrl) || null);
        setInvertLogoDark(!!preset?.darkVars?.invertLogoDark);
        setEditMode("light");
        setEditorVariant("simple");
        setDialogOpen(true);
    };

    /* handle file preview */
    const handleLogoLight = (file) => {
        setLogoLightFile(file);
        if (file) setLogoLightPreview(URL.createObjectURL(file));
    };
    const handleLogoDark = (file) => {
        setLogoDarkFile(file);
        if (file) setLogoDarkPreview(URL.createObjectURL(file));
    };

    /* handle color change */
    const handleColorChange = (mode, key, val) => {
        if (mode === "light") setLightVars((prev) => ({ ...prev, [key]: val }));
        else setDarkVars((prev) => ({ ...prev, [key]: val }));
    };

    /* save (create or update) */
    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const darkVarsPayload = { ...darkVars, invertLogoDark };
            const fd = new FormData();
            fd.append("name", name.trim());
            fd.append("lightVars", JSON.stringify(lightVars));
            fd.append("darkVars", JSON.stringify(darkVarsPayload));
            if (logoLightFile) fd.append("logoLight", logoLightFile);
            if (logoDarkFile) fd.append("logoDark", logoDarkFile);

            const url = editingPreset
                ? `${API}/theme/update/${editingPreset.id_theme_preset}`
                : `${API}/theme/create`;

            const res = await fetch(url, {
                method: editingPreset ? "PUT" : "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
                },
                body: fd,
            });

            const contentType = res.headers.get("content-type") || "";
            let json = null;

            if (contentType.includes("application/json")) {
                json = await res.json();
            } else {
                const text = await res.text();
                throw new Error(
                    `Resposta inválida do servidor (${res.status}). Verifica se a API está configurada em NEXT_PUBLIC_API_URL e se a rota /theme está ativa.` +
                    (text ? ` Detalhe: ${text.slice(0, 120)}` : "")
                );
            }

            if (!res.ok || !json?.success) {
                throw new Error(json?.message || `Erro HTTP ${res.status}`);
            }
            await refreshPresets();
            await refreshActive();
            setDialogOpen(false);
        } catch (err) {
            console.error(err);
            alert(err.message || "Erro ao guardar preset");
        } finally {
            setSaving(false);
        }
    };

    /* delete */
    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await fetch(`${API}/theme/delete/${deleteTarget.id_theme_preset}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
                },
            });
            await refreshPresets();
            await refreshActive();
        } catch (err) {
            console.error(err);
        }
        setDeleteTarget(null);
    };

    /* set active */
    const handleSetActive = async (preset) => {
        setSettingActive(true);
        try {
            await fetch(`${API}/theme/set-active`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
                },
                body: JSON.stringify({ presetId: preset?.id_theme_preset ?? null }),
            });
            await refreshPresets();
            await refreshActive();
        } catch (err) {
            console.error(err);
        }
        setSettingActive(false);
    };

    const currentVars = editMode === "light" ? lightVars : darkVars;

    const applySimpleScheme = (scheme) => {
        setLightVars({ ...scheme.lightVars });
        setDarkVars((prev) => ({ ...scheme.darkVars, invertLogoDark: prev?.invertLogoDark || false }));
    };

    const isSchemeSelected = (scheme) => {
        const keys = ["primary", "secondary", "accent"];
        return (
            keys.every((key) => lightVars[key] === scheme.lightVars[key]) &&
            keys.every((key) => darkVars[key] === scheme.darkVars[key])
        );
    };

    return (
        <ProtectedRoute rolesRequired={["Admin"]}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Personalização</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Crie e gira temas visuais para o website. O tema visual fica sempre o que estiver ativo aqui.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="w-4 h-4 mr-2" /> Novo Preset
                    </Button>
                </div>

                {/* Preset cards grid */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Texto da Homepage</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Título principal</label>
                            <input
                                type="text"
                                value={landingTitle}
                                onChange={(e) => setLandingTitle(e.target.value)}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Descrição</label>
                            <textarea
                                value={landingDescription}
                                onChange={(e) => setLandingDescription(e.target.value)}
                                rows={4}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveLandingContent} disabled={savingLandingText || !landingTitle.trim() || !landingDescription.trim()}>
                                {savingLandingText ? "A guardar..." : "Guardar texto"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {presets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Ainda não criou nenhum preset de tema. Clique em &quot;Novo Preset&quot; para começar.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* Default card */}
                        <Card className={`relative overflow-hidden transition-shadow ${!activePreset ? "ring-2 ring-primary" : ""}`}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Predefinido</CardTitle>
                                    {!activePreset && <Badge variant="secondary"><Star className="w-3 h-3 mr-1" /> Ativo</Badge>}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <MiniPreview vars={DEFAULT_LIGHT} label="Claro" />
                                    <MiniPreview vars={DEFAULT_DARK} label="Escuro" />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    {activePreset && (
                                        <Button size="sm" variant="outline" onClick={() => handleSetActive(null)} disabled={settingActive}>
                                            <Check className="w-4 h-4 mr-1" /> Ativar
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preset cards */}
                        {presets.map((p) => {
                            const isActive = activePreset?.id_theme_preset === p.id_theme_preset;
                            return (
                                <Card key={p.id_theme_preset} className={`relative overflow-hidden transition-shadow ${isActive ? "ring-2 ring-primary" : ""}`}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base truncate">{p.name}</CardTitle>
                                            {isActive && <Badge variant="secondary"><Star className="w-3 h-3 mr-1" /> Ativo</Badge>}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <MiniPreview vars={{ ...DEFAULT_LIGHT, ...(p.lightVars || {}) }} label="Claro" />
                                            <MiniPreview vars={{ ...DEFAULT_DARK, ...(p.darkVars || {}) }} label="Escuro" />
                                        </div>

                                        {/* Logos thumbnails */}
                                        {(p.logoLightUrl || p.logoDarkUrl) && (
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {p.logoLightUrl && <img src={resolveLogoUrl(p.logoLightUrl)} alt="Logo claro" className="h-6 max-w-[80px] object-contain rounded" />}
                                                {p.logoDarkUrl && <img src={resolveLogoUrl(p.logoDarkUrl)} alt="Logo escuro" className="h-6 max-w-[80px] object-contain rounded bg-zinc-800 px-1" />}
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-1">
                                            {!isActive && (
                                                <Button size="sm" variant="outline" onClick={() => handleSetActive(p)} disabled={settingActive}>
                                                    <Check className="w-4 h-4 mr-1" /> Ativar
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                                                <Pencil className="w-4 h-4 mr-1" /> Editar
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(p)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* ═══ Create / Edit Dialog ═══ */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="max-w-[95vw] w-full lg:max-w-7xl max-h-[95vh] overflow-y-auto p-4 sm:p-5">
                        <DialogHeader>
                            <DialogTitle>{editingPreset ? `Editar "${editingPreset.name}"` : "Novo Preset"}</DialogTitle>
                        </DialogHeader>

                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
                            <div className="space-y-3 min-w-0 h-[620px]">
                                {/* Name */}
                                <div>
                                    <label className="text-sm font-medium">Nome do Preset</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: Azul Corporativo"
                                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                    />
                                </div>

                                {/* Logos */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium">Logos por Tema</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        <LogoUploadRow label="Logo (modo claro)" previewUrl={logoLightPreview} onFile={handleLogoLight} />
                                        <LogoUploadRow
                                            label="Logo (modo escuro)"
                                            previewUrl={logoDarkPreview}
                                            onFile={handleLogoDark}
                                            invertPreview={invertLogoDark}
                                            darkBackground
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-1.5">
                                        <div>
                                            <p className="text-sm font-medium">Inverter logo no modo escuro</p>
                                            <p className="text-xs text-muted-foreground">Aplica filtro invertido ao logo quando o tema estiver em dark mode.</p>
                                        </div>
                                        <Switch checked={invertLogoDark} onCheckedChange={setInvertLogoDark} />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    {/* Editor type */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label className="text-sm font-medium">Tipo de edição</label>
                                        <div className="inline-flex rounded-md border border-border p-0.5 gap-0.5 bg-muted/40">
                                            <Button
                                                size="sm"
                                                className="h-8 px-3"
                                                variant={editorVariant === "simple" ? "default" : "ghost"}
                                                onClick={() => setEditorVariant("simple")}
                                            >
                                                Simples
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-8 px-3"
                                                variant={editorVariant === "advanced" ? "default" : "ghost"}
                                                onClick={() => setEditorVariant("advanced")}
                                            >
                                                Avançado
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Left 60% content */}
                                {editorVariant === "simple" ? (
                                    <div className="rounded-xl border border-border p-2 space-y-1.5 h-[255px] overflow-y-auto pr-1">
                                        {SIMPLE_SCHEMES.map((scheme) => (
                                            <SimpleSchemeCard
                                                key={scheme.id}
                                                scheme={scheme}
                                                isActive={isSchemeSelected(scheme)}
                                                onApply={() => applySimpleScheme(scheme)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border p-2.5 h-[420px] overflow-y-auto space-y-3">
                                        {VAR_GROUPS.map((group) => (
                                            <div key={group.label}>
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                    {group.label}
                                                </h4>
                                                <div className="space-y-2">
                                                    {group.keys.map((k) => (
                                                        <ColorPickerRow
                                                            key={k}
                                                            varKey={k}
                                                            value={currentVars[k] || ""}
                                                            onChange={(key, val) => handleColorChange(editMode, key, val)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Right 40% preview only */}
                            <div className="rounded-xl border border-border p-2.5 min-w-0 h-[620px] overflow-y-auto xl:sticky xl:top-2 self-start flex flex-col gap-2.5">
                                <div className="flex gap-2">
                                    <Button
                                        variant={editMode === "light" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setEditMode("light")}
                                    >
                                        Modo Claro
                                    </Button>
                                    <Button
                                        variant={editMode === "dark" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setEditMode("dark")}
                                    >
                                        Modo Escuro
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <Eye className="w-4 h-4" /> Preview ({editMode === "light" ? "Claro" : "Escuro"})
                                </div>

                                <div
                                    className="rounded-lg border overflow-hidden flex-1 min-h-0 flex flex-col"
                                    style={{
                                        background: `hsl(${currentVars.background})`,
                                        color: `hsl(${currentVars.foreground})`,
                                        borderColor: `hsl(${currentVars.border})`,
                                    }}
                                >
                                    <div
                                        className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
                                        style={{ borderBottom: `1px solid hsl(${currentVars.border})` }}
                                    >
                                        {(editMode === "light" ? logoLightPreview : logoDarkPreview) ? (
                                            <img
                                                src={editMode === "light" ? logoLightPreview : logoDarkPreview}
                                                alt="logo"
                                                className="h-4 object-contain"
                                                style={editMode === "dark" && invertLogoDark ? { filter: "invert(1)" } : undefined}
                                            />
                                        ) : (
                                            <div className="font-bold">Logo</div>
                                        )}
                                        <div className="ml-auto flex gap-1.5">
                                            <span
                                                className="rounded px-1.5 py-0.5"
                                                style={{ background: `hsl(${currentVars.muted})`, color: `hsl(${currentVars["muted-foreground"]})` }}
                                            >
                                                Menu 1
                                            </span>
                                            <span
                                                className="rounded px-1.5 py-0.5"
                                                style={{ background: `hsl(${currentVars.muted})`, color: `hsl(${currentVars["muted-foreground"]})` }}
                                            >
                                                Menu 2
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-3 space-y-2 flex-1 flex flex-col">
                                        <div className="text-xs font-bold">Título de Exemplo</div>
                                        <div className="text-[11px]" style={{ color: `hsl(${currentVars["muted-foreground"]})` }}>
                                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vitae velit a tortor mollis.
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                            <span
                                                className="rounded px-1.5 py-0.5 text-[10px]"
                                                style={{ background: `hsl(${currentVars.accent})`, color: `hsl(${currentVars["accent-foreground"]})` }}
                                            >
                                                Tag A
                                            </span>
                                            <span
                                                className="rounded px-1.5 py-0.5 text-[10px]"
                                                style={{ background: `hsl(${currentVars.muted})`, color: `hsl(${currentVars["muted-foreground"]})` }}
                                            >
                                                Tag B
                                            </span>
                                            <span
                                                className="rounded px-1.5 py-0.5 text-[10px]"
                                                style={{ background: `hsl(${currentVars.secondary})`, color: `hsl(${currentVars["secondary-foreground"]})` }}
                                            >
                                                Tag C
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5">
                                            {["12k", "184", "96%"].map((val, idx) => (
                                                <div
                                                    key={val}
                                                    className="rounded-md border px-2 py-1"
                                                    style={{
                                                        borderColor: `hsl(${currentVars.border})`,
                                                        background: idx === 0 ? `hsl(${currentVars.primary})` : `hsl(${currentVars.card})`,
                                                        color: idx === 0 ? `hsl(${currentVars["primary-foreground"]})` : `hsl(${currentVars["card-foreground"]})`,
                                                    }}
                                                >
                                                    <div className="text-[10px]" style={{ opacity: 0.85 }}>Métrica</div>
                                                    <div className="text-[11px] font-semibold">{val}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div
                                                className="rounded-md border px-2 py-1.5 text-[10px]"
                                                style={{ borderColor: `hsl(${currentVars.border})`, background: `hsl(${currentVars.card})`, color: `hsl(${currentVars["card-foreground"]})` }}
                                            >
                                                <div className="font-semibold">Filtro</div>
                                                <div style={{ color: `hsl(${currentVars["muted-foreground"]})` }}>Últimos 30 dias</div>
                                            </div>
                                            <div
                                                className="rounded-md border px-2 py-1.5 text-[10px]"
                                                style={{ borderColor: `hsl(${currentVars.border})`, background: `hsl(${currentVars.card})`, color: `hsl(${currentVars["card-foreground"]})` }}
                                            >
                                                <div className="font-semibold">Região</div>
                                                <div style={{ color: `hsl(${currentVars["muted-foreground"]})` }}>Porto Centro</div>
                                            </div>
                                        </div>

                                        <div className="flex gap-1.5">
                                            <span
                                                className="rounded-md px-2 py-1 text-[11px] font-medium"
                                                style={{
                                                    background: `hsl(${currentVars.primary})`,
                                                    color: `hsl(${currentVars["primary-foreground"]})`,
                                                }}
                                            >
                                                Confirmar
                                            </span>
                                            <span
                                                className="rounded-md px-2 py-1 text-[11px] font-medium"
                                                style={{
                                                    background: `hsl(${currentVars.secondary})`,
                                                    color: `hsl(${currentVars["secondary-foreground"]})`,
                                                }}
                                            >
                                                Cancelar
                                            </span>
                                            <span
                                                className="rounded-md px-2 py-1 text-[11px] font-medium"
                                                style={{
                                                    background: `hsl(${currentVars.destructive})`,
                                                    color: `hsl(${currentVars["destructive-foreground"]})`,
                                                }}
                                            >
                                                Apagar
                                            </span>
                                        </div>

                                        <div
                                            className="rounded-md border p-2 space-y-1"
                                            style={{ borderColor: `hsl(${currentVars.border})`, background: `hsl(${currentVars.card})` }}
                                        >
                                            <div className="text-[10px] font-semibold" style={{ color: `hsl(${currentVars["card-foreground"]})` }}>
                                                Atividade Recente
                                            </div>
                                            {[
                                                "Novo ponto adicionado",
                                                "Trajeto atualizado",
                                                "Utilizador convidado",
                                            ].map((item) => (
                                                <div key={item} className="flex items-center justify-between text-[10px]">
                                                    <span style={{ color: `hsl(${currentVars["muted-foreground"]})` }}>{item}</span>
                                                    <span style={{ color: `hsl(${currentVars["muted-foreground"]})` }}>Agora</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-1.5">
                                            {["Conversão", "Retenção", "Engajamento"].map((label, i) => {
                                                const widths = [72, 58, 84];
                                                return (
                                                    <div key={label} className="space-y-0.5">
                                                        <div className="flex justify-between text-[10px]" style={{ color: `hsl(${currentVars["muted-foreground"]})` }}>
                                                            <span>{label}</span>
                                                            <span>{widths[i]}%</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full" style={{ background: `hsl(${currentVars.muted})` }}>
                                                            <div
                                                                className="h-1.5 rounded-full"
                                                                style={{
                                                                    width: `${widths[i]}%`,
                                                                    background: i === 1 ? `hsl(${currentVars.secondary})` : `hsl(${currentVars.primary})`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex gap-1 pt-0.5">
                                            {["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].map((k) => (
                                                <div
                                                    key={k}
                                                    className="h-3 flex-1 rounded-sm"
                                                    style={{ background: `hsl(${currentVars[k]})` }}
                                                />
                                            ))}
                                        </div>
                                        <div
                                            className="rounded-md border overflow-hidden"
                                            style={{ borderColor: `hsl(${currentVars.border})` }}
                                        >
                                            <div
                                                className="grid grid-cols-3 text-[10px] font-medium px-2 py-1"
                                                style={{ background: `hsl(${currentVars.muted})`, color: `hsl(${currentVars["muted-foreground"]})` }}
                                            >
                                                <span>Nome</span>
                                                <span>Status</span>
                                                <span className="text-right">Ações</span>
                                            </div>
                                            <div className="grid grid-cols-3 text-[10px] px-2 py-1.5" style={{ color: `hsl(${currentVars.foreground})` }}>
                                                <span>Ponto 1</span>
                                                <span>Ativo</span>
                                                <span className="text-right">...</span>
                                            </div>
                                            <div className="grid grid-cols-3 text-[10px] px-2 py-1.5" style={{ color: `hsl(${currentVars.foreground})` }}>
                                                <span>Ponto 2</span>
                                                <span>Rascunho</span>
                                                <span className="text-right">...</span>
                                            </div>
                                            <div className="grid grid-cols-3 text-[10px] px-2 py-1.5" style={{ color: `hsl(${currentVars.foreground})` }}>
                                                <span>Trajeto A</span>
                                                <span>Ativo</span>
                                                <span className="text-right">...</span>
                                            </div>
                                        </div>
                                        <div
                                            className="rounded-md border px-2 py-1 text-[11px] mt-auto"
                                            style={{
                                                borderColor: `hsl(${currentVars.input})`,
                                                background: `hsl(${currentVars.background})`,
                                                color: `hsl(${currentVars["muted-foreground"]})`,
                                            }}
                                        >
                                            Campo de input...
                                        </div>
                                        <div className="flex justify-end gap-1.5">
                                            <span
                                                className="rounded-md px-2 py-1 text-[10px] font-medium"
                                                style={{ background: `hsl(${currentVars.secondary})`, color: `hsl(${currentVars["secondary-foreground"]})` }}
                                            >
                                                Cancelar
                                            </span>
                                            <span
                                                className="rounded-md px-2 py-1 text-[10px] font-medium"
                                                style={{ background: `hsl(${currentVars.primary})`, color: `hsl(${currentVars["primary-foreground"]})` }}
                                            >
                                                Guardar
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={saving || !name.trim()}>
                                {saving ? "A guardar..." : editingPreset ? "Atualizar" : "Criar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ═══ Delete Confirm ═══ */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar Preset</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem a certeza que pretende eliminar o preset &quot;{deleteTarget?.name}&quot;? Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ProtectedRoute>
    );
}
