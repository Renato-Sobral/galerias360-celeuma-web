"use client";

import { useEffect, useState, useRef } from "react";
import ProtectedRoute from "../../components/protectedRoute";
import { useThemePresets, CSS_VAR_KEYS } from "../../components/themePresetContext";
import MediaSourceField from "../../components/MediaSourceField";
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
import {
    createLibrarySelection,
    relativePathFromUploadsUrl,
    resolveMediaSelection,
} from "../../lib/media-library";

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

const HOTSPOT_ICON_CUSTOM_IMAGE_TYPES = [
    { key: "imagem", label: "Imagem" },
    { key: "imagem4p", label: "Imagem 4p" },
    { key: "modelo3d", label: "Modelo 3D" },
    { key: "modelo3d_inspect", label: "Inspeção 3D" },
    { key: "audio", label: "Áudio" },
    { key: "audioespacial", label: "Áudio 3D" },
    { key: "video", label: "Vídeo" },
    { key: "link", label: "Link" },
    { key: "navegacao", label: "Navegação" },
];

const HOTSPOT_TEXT_FONTS = [
    { value: "roboto", label: "Roboto" },
    { value: "mozillavr", label: "Mozilla VR" },
    { value: "sourcecodepro", label: "Source Code Pro" },
    { value: "monoid", label: "Monoid" },
    { value: "exo2bold", label: "Exo 2 Bold" },
    { value: "exo2semibold", label: "Exo 2 SemiBold" },
    { value: "kelsonsans", label: "Kelson Sans" },
    { value: "dejavu", label: "DejaVu" },
    { value: "aileronsemibold", label: "Aileron SemiBold" },
];

const HOTSPOT_TEXT_FONT_PREVIEWS = {
    roboto: "Roboto, sans-serif",
    mozillavr: '"Courier New", monospace',
    sourcecodepro: '"Source Code Pro", monospace',
    monoid: "monospace",
    exo2bold: "Arial, sans-serif",
    exo2semibold: "Arial, sans-serif",
    kelsonsans: "Verdana, sans-serif",
    dejavu: "Georgia, serif",
    aileronsemibold: "Helvetica, Arial, sans-serif",
};

function getHotspotTextPreviewFont(fontKey) {
    return HOTSPOT_TEXT_FONT_PREVIEWS[fontKey] || "sans-serif";
}

function selectionFromStoredValue(value) {
    const normalizedPath = relativePathFromUploadsUrl(value) || String(value || "").replace(/^\/+/, "");
    return normalizedPath ? createLibrarySelection(normalizedPath) : null;
}

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

const DEFAULT_THEME_SYSTEM_KEY = "default-base";

function isDefaultThemePreset(preset) {
    return preset?.systemKey === DEFAULT_THEME_SYSTEM_KEY;
}

function sortThemePresets(a, b) {
    const rank = (preset) => {
        if (isDefaultThemePreset(preset)) return 0;
        if (preset?.systemKey) return 1;
        return 2;
    };

    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return (a?.name || "").localeCompare(b?.name || "", "pt");
}

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
    const lightVars = { ...DEFAULT_LIGHT, ...(scheme.lightVars || {}) };
    const darkVars = { ...DEFAULT_DARK, ...(scheme.darkVars || {}) };

    const lightPrimary = lightVars.primary || "0 0% 9%";
    const lightSecondary = lightVars.secondary || "0 0% 96.1%";
    const lightAccent = lightVars.accent || "0 0% 96.1%";

    const darkPrimary = darkVars.primary || "0 0% 100%";
    const darkSecondary = darkVars.secondary || "0 0% 5%";
    const darkAccent = darkVars.accent || "0 0% 5%";

    return (
        <button
            type="button"
            onClick={onApply}
            className={`w-full text-left rounded-lg border p-2 transition-colors hover:bg-muted/30 ${isActive ? "ring-2 ring-primary bg-primary/5" : ""}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[15px] leading-5 font-semibold">{scheme.name}</div>
                    {scheme.description && (
                        <div className="text-[12px] leading-4 text-muted-foreground">{scheme.description}</div>
                    )}
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
    const { presets, activePreset, refreshPresets, refreshActive, refreshFavicon } = useThemePresets();
    const orderedPresets = [...presets].sort(sortThemePresets);
    const starterPresets = orderedPresets.filter((preset) => !!preset.systemKey);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [settingActive, setSettingActive] = useState(false);
    const [landingTitle, setLandingTitle] = useState("Explora o mundo com Galerias 360");
    const [landingDescription, setLandingDescription] = useState("Descobre pontos turísticos e culturais em realidade aumentada com uma experiência imersiva em 360º. Acede ao mapa interativo e mergulha em cada história.");
    const [savingLandingText, setSavingLandingText] = useState(false);
    const [faviconSelection, setFaviconSelection] = useState(null);
    const [faviconPreview, setFaviconPreview] = useState(null);
    const [savingFavicon, setSavingFavicon] = useState(false);

    // Hotspot icon customization state
    const [hotspotIconType, setHotspotIconType] = useState("ring");
    const [hotspotIconColor, setHotspotIconColor] = useState("#06b6d4");
    const [hotspotCustomIconSelections, setHotspotCustomIconSelections] = useState({});
    const [hotspotTextFont, setHotspotTextFont] = useState("roboto");
    const [savingHotspotIcon, setSavingHotspotIcon] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [lightVars, setLightVars] = useState({ ...DEFAULT_LIGHT });
    const [darkVars, setDarkVars] = useState({ ...DEFAULT_DARK });
    const [logoLightSelection, setLogoLightSelection] = useState(null);
    const [logoDarkSelection, setLogoDarkSelection] = useState(null);
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
        if (!logoLightSelection) {
            setLogoLightPreview(null);
            return undefined;
        }

        if (logoLightSelection.source === "library") {
            setLogoLightPreview(logoLightSelection.url || null);
            return undefined;
        }

        if (logoLightSelection.file) {
            const objectUrl = URL.createObjectURL(logoLightSelection.file);
            setLogoLightPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }

        setLogoLightPreview(null);
        return undefined;
    }, [logoLightSelection]);

    useEffect(() => {
        if (!logoDarkSelection) {
            setLogoDarkPreview(null);
            return undefined;
        }

        if (logoDarkSelection.source === "library") {
            setLogoDarkPreview(logoDarkSelection.url || null);
            return undefined;
        }

        if (logoDarkSelection.file) {
            const objectUrl = URL.createObjectURL(logoDarkSelection.file);
            setLogoDarkPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }

        setLogoDarkPreview(null);
        return undefined;
    }, [logoDarkSelection]);

    useEffect(() => {
        if (!faviconSelection) {
            setFaviconPreview(null);
            return undefined;
        }

        if (faviconSelection.source === "library") {
            setFaviconPreview(faviconSelection.url || null);
            return undefined;
        }

        if (faviconSelection.file) {
            const objectUrl = URL.createObjectURL(faviconSelection.file);
            setFaviconPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }

        setFaviconPreview(null);
        return undefined;
    }, [faviconSelection]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("hotspot_icon_config");
            if (!stored) return;

            const parsed = JSON.parse(stored);
            if (parsed?.icon_type) setHotspotIconType(parsed.icon_type);
            if (parsed?.icon_color) setHotspotIconColor(parsed.icon_color);

            const customIcons = parsed?.custom_icons && typeof parsed.custom_icons === "object" ? parsed.custom_icons : {};
            const nextSelections = HOTSPOT_ICON_CUSTOM_IMAGE_TYPES.reduce((acc, { key }) => {
                acc[key] = selectionFromStoredValue(customIcons[key]);
                return acc;
            }, {});

            setHotspotCustomIconSelections(nextSelections);
            if (parsed?.text_font) setHotspotTextFont(parsed.text_font);
        } catch (err) {
            console.error(err);
        }
    }, []);

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

    useEffect(() => {
        let mounted = true;

        const loadFavicon = async () => {
            try {
                const res = await fetch(`${API}/theme/favicon`, { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                if (!mounted || !json?.success) return;

                const faviconPath = relativePathFromUploadsUrl(json.data?.path || json.data?.url || "");
                setFaviconSelection(createLibrarySelection(faviconPath));
                setFaviconPreview(json.data?.url || null);
            } catch (err) {
                console.error(err);
            }
        };

        loadFavicon();
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

    const handleSaveFavicon = async () => {
        setSavingFavicon(true);
        try {
            const faviconAsset = await resolveMediaSelection(faviconSelection, "logos");
            const res = await fetch(`${API}/theme/favicon`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
                },
                body: JSON.stringify({
                    faviconPath: faviconAsset?.path || "",
                }),
            });
            const json = await res.json();
            if (!res.ok || !json?.success) {
                throw new Error(json?.message || "Erro ao atualizar favicon");
            }

            const faviconPath = relativePathFromUploadsUrl(json.data?.path || json.data?.url || "");
            setFaviconSelection(createLibrarySelection(faviconPath));
            setFaviconPreview(json.data?.url || null);
            await refreshFavicon();
        } catch (err) {
            console.error(err);
            alert(err.message || "Erro ao atualizar favicon");
        } finally {
            setSavingFavicon(false);
        }
    };

    const handleSaveHotspotIcon = async () => {
        setSavingHotspotIcon(true);
        try {
            const resolvedCustomIcons = {};

            for (const { key } of HOTSPOT_ICON_CUSTOM_IMAGE_TYPES) {
                const selection = hotspotCustomIconSelections[key];
                if (!selection) continue;

                const resolvedAsset = await resolveMediaSelection(selection, "media");
                const storedPath = resolvedAsset?.path || selection.path || "";
                if (storedPath) {
                    resolvedCustomIcons[key] = storedPath;
                }
            }

            localStorage.setItem("hotspot_icon_config", JSON.stringify({
                icon_type: hotspotIconType,
                icon_color: hotspotIconColor,
                text_font: hotspotTextFont,
                custom_icons: resolvedCustomIcons,
            }));
            alert("Configuração de ícones dos hotspots guardada com sucesso!");
        } catch (err) {
            console.error(err);
            alert(err.message || "Erro ao atualizar configuração de ícones");
        } finally {
            setSavingHotspotIcon(false);
        }
    };

    /* open dialog for create */
    const openCreate = () => {
        setEditingPreset(null);
        setName("");
        setLightVars({ ...DEFAULT_LIGHT });
        setDarkVars({ ...DEFAULT_DARK });
        setLogoLightSelection(null);
        setLogoDarkSelection(null);
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
        setLogoLightSelection(createLibrarySelection(relativePathFromUploadsUrl(preset.logoLightUrl)));
        setLogoDarkSelection(createLibrarySelection(relativePathFromUploadsUrl(preset.logoDarkUrl)));
        setLogoLightPreview(resolveLogoUrl(preset.logoLightUrl) || null);
        setLogoDarkPreview(resolveLogoUrl(preset.logoDarkUrl) || null);
        setInvertLogoDark(!!preset?.darkVars?.invertLogoDark);
        setEditMode("light");
        setEditorVariant("simple");
        setDialogOpen(true);
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
            const [logoLightAsset, logoDarkAsset] = await Promise.all([
                resolveMediaSelection(logoLightSelection, "logos"),
                resolveMediaSelection(logoDarkSelection, "logos"),
            ]);
            const fd = new FormData();
            fd.append("name", name.trim());
            fd.append("lightVars", JSON.stringify(lightVars));
            fd.append("darkVars", JSON.stringify(darkVarsPayload));
            fd.append("logoLightPath", logoLightAsset?.path || "");
            fd.append("logoDarkPath", logoDarkAsset?.path || "");

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
        setLightVars({ ...DEFAULT_LIGHT, ...(scheme.lightVars || {}) });
        setDarkVars({ ...DEFAULT_DARK, ...(scheme.darkVars || {}) });
        setInvertLogoDark(!!scheme?.darkVars?.invertLogoDark);
    };

    const isSchemeSelected = (scheme) => {
        const keys = ["primary", "secondary", "accent"];
        const schemeLightVars = { ...DEFAULT_LIGHT, ...(scheme.lightVars || {}) };
        const schemeDarkVars = { ...DEFAULT_DARK, ...(scheme.darkVars || {}) };
        return (
            keys.every((key) => lightVars[key] === schemeLightVars[key]) &&
            keys.every((key) => darkVars[key] === schemeDarkVars[key])
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
                        <Plus className="w-4 h-4 mr-2" /> Novo Tema
                    </Button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6 items-start">
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

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Favicon do Website</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <MediaSourceField
                                label="Favicon"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp,.ico"
                                selection={faviconSelection}
                                onChange={setFaviconSelection}
                                destinationPath="logos"
                            />

                            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                                    {faviconPreview ? (
                                        <img src={faviconPreview} alt="Preview favicon" className="h-6 w-6 object-contain" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Sem</span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    O favicon aparece no separador do browser e nos favoritos.
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setFaviconSelection(null);
                                        setFaviconPreview(null);
                                    }}
                                    disabled={savingFavicon}
                                >
                                    Limpar
                                </Button>
                                <Button onClick={handleSaveFavicon} disabled={savingFavicon}>
                                    {savingFavicon ? "A guardar..." : "Guardar favicon"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Ícones dos Hotspots</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Tipo de Ícone</label>
                            <select
                                value={hotspotIconType}
                                onChange={(e) => setHotspotIconType(e.target.value)}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            >
                                <option value="ring">Ring (Anel)</option>
                                <option value="sphere">Sphere (Esfera)</option>
                                <option value="arrow">Arrow (Seta)</option>
                                <option value="custom">Custom (Personalizado)</option>
                            </select>
                            <p className="text-xs text-muted-foreground mt-2">
                                Seleciona o tipo de ícone a usar nos hotspots da galeria 360.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Cor do Ícone</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="color"
                                    value={hotspotIconColor}
                                    onChange={(e) => setHotspotIconColor(e.target.value)}
                                    className="h-10 w-20 rounded-md border border-border cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={hotspotIconColor}
                                    onChange={(e) => setHotspotIconColor(e.target.value)}
                                    className="flex-1 text-sm bg-muted rounded-md px-3 py-2 border border-border"
                                    placeholder="#06b6d4"
                                />
                            </div>
                        </div>

                        {hotspotIconType === "custom" && (
                            <div className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
                                <div>
                                    <p className="text-sm font-medium">Fonte do texto</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        O hotspot do tipo texto usa esta fonte em vez de um ícone.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Fonte para texto</label>
                                    <select
                                        value={hotspotTextFont}
                                        onChange={(e) => setHotspotTextFont(e.target.value)}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                    >
                                        {HOTSPOT_TEXT_FONTS.map((font) => (
                                            <option key={font.value} value={font.value}>{font.label}</option>
                                        ))}
                                    </select>
                                    <div className="rounded-md border border-border bg-background px-3 py-3">
                                        <span
                                            className="text-base"
                                            style={{
                                                fontFamily: getHotspotTextPreviewFont(hotspotTextFont),
                                                fontWeight: 600,
                                            }}
                                        >
                                            Amostra de texto 360
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {hotspotIconType === "custom" && (
                            <div className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
                                <div>
                                    <p className="text-sm font-medium">Imagens por tipo de hotspot</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Define uma imagem para cada tipo. Quando o modo custom estiver ativo, o viewer vai usar a imagem correspondente ao tipo do hotspot.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {HOTSPOT_ICON_CUSTOM_IMAGE_TYPES.map(({ key, label }) => (
                                        <div key={key} className="rounded-md border border-border bg-background p-3 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium">{label}</p>
                                                    <p className="text-xs text-muted-foreground">Imagem usada para este tipo de hotspot.</p>
                                                </div>
                                                {hotspotCustomIconSelections[key] && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-xs"
                                                        onClick={() => {
                                                            setHotspotCustomIconSelections((prev) => ({ ...prev, [key]: null }));
                                                        }}
                                                    >
                                                        Limpar
                                                    </Button>
                                                )}
                                            </div>

                                            <MediaSourceField
                                                label={`Ícone ${label}`}
                                                accept="image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp"
                                                selection={hotspotCustomIconSelections[key] || null}
                                                onChange={(selection) => {
                                                    setHotspotCustomIconSelections((prev) => ({ ...prev, [key]: selection }));
                                                }}
                                                destinationPath="media"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-3">
                            <div>
                                <p className="text-sm font-medium">Pré-visualização</p>
                                <div className="mt-2 flex gap-4">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-24 h-24 rounded-md border border-border bg-black flex items-center justify-center relative">
                                            {hotspotIconType === "ring" && (
                                                <div 
                                                    className="rounded-full border-2" 
                                                    style={{
                                                        width: "16px",
                                                        height: "16px",
                                                        borderColor: hotspotIconColor,
                                                    }}
                                                />
                                            )}
                                            {hotspotIconType === "sphere" && (
                                                <div 
                                                    className="rounded-full" 
                                                    style={{
                                                        width: "20px",
                                                        height: "20px",
                                                        backgroundColor: hotspotIconColor,
                                                        opacity: 0.8,
                                                    }}
                                                />
                                            )}
                                            {hotspotIconType === "arrow" && (
                                                <div 
                                                    style={{
                                                        width: 0,
                                                        height: 0,
                                                        borderLeft: "8px solid transparent",
                                                        borderRight: "8px solid transparent",
                                                        borderBottom: `16px solid ${hotspotIconColor}`,
                                                    }}
                                                />
                                            )}
                                            {hotspotIconType === "custom" && (
                                                <span className="text-2xl">◉</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">Pré-visualização</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveHotspotIcon} disabled={savingHotspotIcon}>
                                {savingHotspotIcon ? "A guardar..." : "Guardar Ícone"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {orderedPresets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Ainda não criou nenhum preset de tema. Clique em &quot;Novo Tema&quot; para começar.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orderedPresets.map((p) => {
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
                                                <Button size="sm" variant="outline" onClick={() => handleSetActive(isDefaultThemePreset(p) ? null : p)} disabled={settingActive}>
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
                            <DialogTitle>{editingPreset ? `Editar "${editingPreset.name}"` : "Novo Tema"}</DialogTitle>
                        </DialogHeader>

                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
                            <div className="space-y-3 min-w-0 h-[620px]">
                                {/* Name */}
                                <div>
                                    <label className="text-sm font-medium">Nome do Tema</label>
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
                                        <MediaSourceField
                                            label="Logo (modo claro)"
                                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                            selection={logoLightSelection}
                                            onChange={setLogoLightSelection}
                                            destinationPath="logos"
                                        />
                                        <MediaSourceField
                                            label="Logo (modo escuro)"
                                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                            selection={logoDarkSelection}
                                            onChange={setLogoDarkSelection}
                                            destinationPath="logos"
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
                                        {starterPresets.map((scheme) => (
                                            <SimpleSchemeCard
                                                key={scheme.id_theme_preset}
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
