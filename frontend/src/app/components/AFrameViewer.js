"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import "aframe";
import ContextMenuWrapper from "./ContextMenuWrapper";
import CustomDialog from "./CustomDialog";
import DropdownSingle from "./select";
import MediaSourceField from "./MediaSourceField";
import Swal from "sweetalert2";
import { createLibrarySelection, resolveMediaSelection, resolveUploadsUrl, relativePathFromUploadsUrl } from "../lib/media-library";
import { ensurePanoramaDomeComponent } from "../lib/aframe-panorama-dome";

const AFrameViewer = ({ environment, enableContextMenu = false, pontoId, navigateOnHotspot = false }) => {
  const API_BASE =
    (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL.trim())
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
      : "";

  const buildApiUrl = (path) => {
    if (!API_BASE) return path;
    return `${API_BASE}${path}`;
  };

  const LEGACY_POINT_PREFIX = "ponto:";
  const NAV_POINT_PREFIX = "nav:ponto:";
  const NAV_FILE_PREFIX = "nav:file:";
  const NAV_BACK_VALUE = "nav:back";
  const HOTSPOT_META_PREFIX = "hsmeta:";
  const HOTSPOT_SCALE_MIN = 0.2;
  const DEFAULT_PANORAMA_DOME_RADIUS = 700;
  const DEFAULT_PANORAMA_DOME_THETA_START_DEG = 0;
  const DEFAULT_PANORAMA_DOME_THETA_LENGTH_DEG = 90;
  const DEFAULT_DOME_LIGHT_ROTATION_DEG = 0;
  const DEFAULT_DOME_LIGHT_STRENGTH = 1;
  const DEFAULT_DOME_LIGHT_WORLD_OPACITY = 0;
  const DEFAULT_DOME_LIGHT_BLUR = 0.5;
  const DEFAULT_DOME_ROTATION_Y = -130;
  const DEFAULT_DOME_LIGHT_COLOR = "#ffffff";
  const DEFAULT_DOME_LIGHT_DISTANCE = 2200;
  const DEFAULT_DOME_SHADOW_BIAS = -0.00015;
  const DOME_LIGHT_RADIUS = 45;
  const DOME_LIGHT_HEIGHT = 35;

  const encodeDestinationPointContent = (targetPontoId) => `${NAV_POINT_PREFIX}${targetPontoId}`;
  const encodeDestinationFileContent = (targetFilePath) => `${NAV_FILE_PREFIX}${targetFilePath}`;
  const encodeDestinationBackContent = () => NAV_BACK_VALUE;

  const encodeHotspotContent = (rawValue, viewPath, scale = 1, rotYaw = 0, rotPitch = 0) => {
    const payload = {
      value: String(rawValue || ""),
      view: String(viewPath || "").replace(/^\/+/, ""),
      scale: Number.isFinite(Number(scale))
        ? Math.max(HOTSPOT_SCALE_MIN, Number(scale))
        : 1,
      rotYaw: Number.isFinite(Number(rotYaw)) ? Number(rotYaw) : 0,
      rotPitch: Number.isFinite(Number(rotPitch)) ? Number(rotPitch) : 0,
    };

    try {
      return `${HOTSPOT_META_PREFIX}${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`;
    } catch {
      return String(rawValue || "");
    }
  };

  const decodeHotspotContent = (storedValue) => {
    const value = String(storedValue || "");
    if (!value.startsWith(HOTSPOT_META_PREFIX)) {
      return { value, view: "", scale: 1, rotYaw: 0, rotPitch: 0 };
    }

    try {
      const encoded = value.slice(HOTSPOT_META_PREFIX.length);
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json);
      return {
        value: String(parsed?.value || ""),
        view: String(parsed?.view || "").replace(/^\/+/, ""),
        scale: Number.isFinite(Number(parsed?.scale))
          ? Math.max(HOTSPOT_SCALE_MIN, Number(parsed.scale))
          : 1,
        rotYaw: Number.isFinite(Number(parsed?.rotYaw)) ? Number(parsed.rotYaw) : 0,
        rotPitch: Number.isFinite(Number(parsed?.rotPitch)) ? Number(parsed.rotPitch) : 0,
      };
    } catch {
      return { value, view: "", scale: 1, rotYaw: 0, rotPitch: 0 };
    }
  };

  const decodeNavigationContent = (tipo, conteudo) => {
    if (tipo !== "link") return { mode: null, pointId: "", filePath: "" };

    const decoded = decodeHotspotContent(conteudo);
    const value = String(decoded.value || "").trim();
    if (!value) return { mode: null, pointId: "", filePath: "" };

    if (value.startsWith(NAV_POINT_PREFIX)) {
      const parsed = value.slice(NAV_POINT_PREFIX.length);
      return /^\d+$/.test(parsed)
        ? { mode: "point", pointId: parsed, filePath: "" }
        : { mode: null, pointId: "", filePath: "" };
    }

    if (value.startsWith(NAV_FILE_PREFIX)) {
      const parsed = value.slice(NAV_FILE_PREFIX.length).replace(/^\/+/, "");
      return parsed
        ? { mode: "file", pointId: "", filePath: parsed }
        : { mode: null, pointId: "", filePath: "" };
    }

    if (value === NAV_BACK_VALUE) {
      return { mode: "back", pointId: "", filePath: "" };
    }

    if (value.startsWith(LEGACY_POINT_PREFIX)) {
      const parsed = value.slice(LEGACY_POINT_PREFIX.length);
      return /^\d+$/.test(parsed)
        ? { mode: "point", pointId: parsed, filePath: "" }
        : { mode: null, pointId: "", filePath: "" };
    }

    return { mode: null, pointId: "", filePath: "" };
  };

  const sceneRef = useRef(null);
  const domeEntityRef = useRef(null);
  const ambientLightRef = useRef(null);
  const pointLightRef = useRef(null);
  const [domeComponentReady, setDomeComponentReady] = useState(false);
  const [hotspots, setHotspots] = useState([]);
  const clickEventRef = useRef(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [domeDialogOpen, setDomeDialogOpen] = useState(false);
  const [editTipo, setEditTipo] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const [editX, setEditX] = useState(0);
  const [editY, setEditY] = useState(0);
  const [editZ, setEditZ] = useState(0);
  const [editYaw, setEditYaw] = useState(0);
  const [editPitch, setEditPitch] = useState(0);
  const [domeRadius, setDomeRadius] = useState(DEFAULT_PANORAMA_DOME_RADIUS);
  const [domeThetaStartDeg, setDomeThetaStartDeg] = useState(DEFAULT_PANORAMA_DOME_THETA_START_DEG);
  const [domeThetaLengthDeg, setDomeThetaLengthDeg] = useState(DEFAULT_PANORAMA_DOME_THETA_LENGTH_DEG);
  const [domeVerticalOffset, setDomeVerticalOffset] = useState(0);
  const [domeRotationY, setDomeRotationY] = useState(DEFAULT_DOME_ROTATION_Y);
  const [domeLightRotationDeg, setDomeLightRotationDeg] = useState(DEFAULT_DOME_LIGHT_ROTATION_DEG);
  const [domeLightStrength, setDomeLightStrength] = useState(DEFAULT_DOME_LIGHT_STRENGTH);
  const [domeLightWorldOpacity, setDomeLightWorldOpacity] = useState(DEFAULT_DOME_LIGHT_WORLD_OPACITY);
  const [domeLightBlur, setDomeLightBlur] = useState(DEFAULT_DOME_LIGHT_BLUR);
  const [domeLightColor, setDomeLightColor] = useState(DEFAULT_DOME_LIGHT_COLOR);
  const [domeLightDistance, setDomeLightDistance] = useState(DEFAULT_DOME_LIGHT_DISTANCE);
  const [domeShadowBias, setDomeShadowBias] = useState(DEFAULT_DOME_SHADOW_BIAS);
  const [editRadius, setEditRadius] = useState(DEFAULT_PANORAMA_DOME_RADIUS);
  const [editScale, setEditScale] = useState(1);
  const [editPontoDestino, setEditPontoDestino] = useState("");
  const [editNavigationSelection, setEditNavigationSelection] = useState(null);
  const [editNavigationPath, setEditNavigationPath] = useState("");
  const [editNavigationMode, setEditNavigationMode] = useState("file");
  const [editModelSelection, setEditModelSelection] = useState(null);
  const [pontosDestino, setPontosDestino] = useState([]);
  const [activePontoId, setActivePontoId] = useState(() => String(pontoId || ""));
  const [activeEnvironment, setActiveEnvironment] = useState(environment);
  const [viewHistory, setViewHistory] = useState([]);
  const [isNavigationTransitioning, setIsNavigationTransitioning] = useState(false);
  const [navigationPhase, setNavigationPhase] = useState("idle");
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [domeSettingsByView, setDomeSettingsByView] = useState({});
  const [domeSettingsLoaded, setDomeSettingsLoaded] = useState(false);
  const navigationTransitionTimerRef = useRef(null);
  const navigationProgressIntervalRef = useRef(null);
  const NAVIGATION_FADE_MS = 220;
  const NAVIGATION_WARP_OUT_MS = 240;
  const NAVIGATION_WARP_IN_MS = 260;
  const NAVIGATION_HOLD_MS = 120;
  const parsedEnvironment = parseEnvironment(activeEnvironment);
  const isHdrOrExrEnvironment = parsedEnvironment?.mode === 'url' && isHdrOrExrUrl(parsedEnvironment?.url);
  const initialViewPathRef = useRef("");
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [environmentLoadError, setEnvironmentLoadError] = useState("");

  const [editingItem, setEditingItem] = useState(null);
  const normalizeDomeUrlKey = (value) => String(value || "").split("?")[0].split("#")[0];
  const currentViewPath = useMemo(() => {
    if (parsedEnvironment?.mode === "url") {
      return relativePathFromUploadsUrl(parsedEnvironment.url || "");
    }
    return relativePathFromUploadsUrl(activeEnvironment || "");
  }, [activeEnvironment, parsedEnvironment?.mode, parsedEnvironment?.url]);
  const domeSettingsStorageKey = useMemo(
    () => `galerias360:domeSettingsByView:${String(activePontoId || pontoId || "")}`,
    [activePontoId, pontoId]
  );
  const currentDomeViewKey = useMemo(() => {
    if (currentViewPath) return `path:${currentViewPath}`;
    if (parsedEnvironment?.mode === "url" && parsedEnvironment?.url) {
      const normalizedUrl = normalizeDomeUrlKey(parsedEnvironment.url);
      // Blob URLs are ephemeral; scope them to point to keep settings stable while editing.
      if (normalizedUrl.startsWith("blob:")) {
        return `blob:${String(activePontoId || pontoId || "default")}`;
      }
      return `url:${normalizedUrl}`;
    }
    if (parsedEnvironment?.mode === "base64") return `base64:${String(activePontoId || pontoId || "default")}`;
    return `env:${String(activeEnvironment || "default")}`;
  }, [activeEnvironment, activePontoId, currentViewPath, parsedEnvironment?.mode, parsedEnvironment?.url, pontoId]);
  const imageSkySrc = parsedEnvironment?.mode === 'base64'
    ? `data:${parsedEnvironment?.mime};base64,${parsedEnvironment?.raw}`
    : parsedEnvironment?.url;

  useEffect(() => {
    setDomeSettingsLoaded(false);
    try {
      const raw = localStorage.getItem(domeSettingsStorageKey);
      if (!raw) {
        setDomeSettingsByView({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setDomeSettingsByView({});
        return;
      }
      setDomeSettingsByView(parsed);
    } catch {
      // ignore corrupted storage
      setDomeSettingsByView({});
    } finally {
      setDomeSettingsLoaded(true);
    }
  }, [domeSettingsStorageKey]);

  useEffect(() => {
    if (!domeSettingsLoaded) return;
    try {
      localStorage.setItem(domeSettingsStorageKey, JSON.stringify(domeSettingsByView || {}));
    } catch {
      // ignore quota errors
    }
  }, [domeSettingsByView, domeSettingsLoaded, domeSettingsStorageKey]);

  const handleOpenEditor = (item) => setEditingItem(item);
  const handleCloseEditor = () => setEditingItem(null);

  const handleUpdate = (field, value) => {
    setEditingItem((prev) => ({
      ...prev,
      props: {
        ...prev.props,
        [field]: value,
      },
    }));
  };

  const tipos = [
    { label: "Texto", value: "texto" },
    { label: "Imagem", value: "imagem" },
    { label: "Modelo 3D", value: "modelo3d" },
    { label: "Áudio", value: "audio" },
    { label: "Áudio Espacial", value: "audioespacial" },
    { label: "Vídeo", value: "video" },
    { label: "Navegação", value: "navegacao" },
    { label: "Link", value: "link" },
  ];

  const isHdrOrExrByUrl = (url) => /\.(hdr|exr)(\?|$)/i.test(String(url || ""));

  const destinoLabel = pontosDestino.find((item) => item.value === editPontoDestino)?.label || "Seleciona a próxima vista";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const positionSliderMin = -domeRadius;
  const positionSliderMax = domeRadius;
  const DOME_VERTICAL_OFFSET_MIN = -2000;
  const DOME_VERTICAL_OFFSET_MAX = 2000;

  const lightRotationRad = useMemo(
    () => (Number(domeLightRotationDeg) * Math.PI) / 180,
    [domeLightRotationDeg]
  );
  const pointLightPosition = useMemo(() => {
    const x = Math.sin(lightRotationRad) * DOME_LIGHT_RADIUS;
    const z = Math.cos(lightRotationRad) * DOME_LIGHT_RADIUS;
    return `${x.toFixed(2)} ${DOME_LIGHT_HEIGHT.toFixed(2)} ${z.toFixed(2)}`;
  }, [lightRotationRad]);

  const normalizeDomeSettings = (settings) => {
    const baseRadius = Number(settings?.radius);
    const baseThetaStart = Number(settings?.thetaStartDeg);
    const baseThetaLength = Number(settings?.thetaLengthDeg);
    const baseVerticalOffset = Number(settings?.verticalOffset);

    const radius = Number.isFinite(baseRadius)
      ? Math.max(50, baseRadius)
      : DEFAULT_PANORAMA_DOME_RADIUS;
    const thetaStartDeg = Number.isFinite(baseThetaStart)
      ? clamp(baseThetaStart, 0, 160)
      : DEFAULT_PANORAMA_DOME_THETA_START_DEG;
    const thetaLengthDeg = Number.isFinite(baseThetaLength)
      ? clamp(baseThetaLength, 20, 180 - thetaStartDeg)
      : clamp(DEFAULT_PANORAMA_DOME_THETA_LENGTH_DEG, 20, 180 - thetaStartDeg);

    const verticalOffset = Number.isFinite(baseVerticalOffset)
      ? baseVerticalOffset
      : 0;

    const baseRotationY = Number(settings?.rotationY);
    const rotationY = Number.isFinite(baseRotationY)
      ? clamp(baseRotationY, -360, 360)
      : DEFAULT_DOME_ROTATION_Y;

    const baseLightRotationDeg = Number(settings?.lightRotationDeg);
    const baseLightStrength = Number(settings?.lightStrength);
    const baseLightWorldOpacity = Number(settings?.lightWorldOpacity);
    const baseLightBlur = Number(settings?.lightBlur);
    const baseLightDistance = Number(settings?.lightDistance);
    const baseShadowBias = Number(settings?.shadowBias);
    const rawLightColor = String(settings?.lightColor || "").trim();

    const lightRotationDeg = Number.isFinite(baseLightRotationDeg)
      ? ((baseLightRotationDeg % 360) + 360) % 360
      : DEFAULT_DOME_LIGHT_ROTATION_DEG;
    const lightStrength = Number.isFinite(baseLightStrength)
      ? Math.max(0, baseLightStrength)
      : DEFAULT_DOME_LIGHT_STRENGTH;
    const lightWorldOpacity = Number.isFinite(baseLightWorldOpacity)
      ? Math.max(0, baseLightWorldOpacity)
      : DEFAULT_DOME_LIGHT_WORLD_OPACITY;
    const lightBlur = Number.isFinite(baseLightBlur)
      ? Math.max(0, baseLightBlur)
      : DEFAULT_DOME_LIGHT_BLUR;
    const lightDistance = Number.isFinite(baseLightDistance)
      ? Math.max(1, baseLightDistance)
      : DEFAULT_DOME_LIGHT_DISTANCE;
    const shadowBias = Number.isFinite(baseShadowBias)
      ? clamp(baseShadowBias, -0.01, 0.01)
      : DEFAULT_DOME_SHADOW_BIAS;
    const lightColor = /^#[0-9a-fA-F]{6}$/.test(rawLightColor)
      ? rawLightColor
      : DEFAULT_DOME_LIGHT_COLOR;

    return {
      radius,
      thetaStartDeg,
      thetaLengthDeg,
      verticalOffset,
      rotationY,
      lightRotationDeg,
      lightStrength,
      lightWorldOpacity,
      lightBlur,
      lightColor,
      lightDistance,
      shadowBias,
    };
  };

  const persistDomeSettingsForView = (nextSettings) => {
    const normalized = normalizeDomeSettings({
      radius: domeRadius,
      thetaStartDeg: domeThetaStartDeg,
      thetaLengthDeg: domeThetaLengthDeg,
      verticalOffset: domeVerticalOffset,
      rotationY: domeRotationY,
      lightRotationDeg: domeLightRotationDeg,
      lightStrength: domeLightStrength,
      lightWorldOpacity: domeLightWorldOpacity,
      lightBlur: domeLightBlur,
      lightColor: domeLightColor,
      lightDistance: domeLightDistance,
      shadowBias: domeShadowBias,
      ...(nextSettings || {}),
    });
    setDomeRadius(normalized.radius);
    setDomeThetaStartDeg(normalized.thetaStartDeg);
    setDomeThetaLengthDeg(normalized.thetaLengthDeg);
    setDomeVerticalOffset(normalized.verticalOffset);
    setDomeRotationY(normalized.rotationY);
    setDomeLightRotationDeg(normalized.lightRotationDeg);
    setDomeLightStrength(normalized.lightStrength);
    setDomeLightWorldOpacity(normalized.lightWorldOpacity);
    setDomeLightBlur(normalized.lightBlur);
    setDomeLightColor(normalized.lightColor);
    setDomeLightDistance(normalized.lightDistance);
    setDomeShadowBias(normalized.shadowBias);
    setEditRadius((prev) => clamp(prev, 10, normalized.radius));
    setDomeSettingsByView((prev) => ({
      ...prev,
      [currentDomeViewKey]: normalized,
    }));
  };

  useEffect(() => {
    const saved = domeSettingsByView[currentDomeViewKey];
    const normalized = normalizeDomeSettings(saved);
    setDomeRadius(normalized.radius);
    setDomeThetaStartDeg(normalized.thetaStartDeg);
    setDomeThetaLengthDeg(normalized.thetaLengthDeg);
    setDomeVerticalOffset(normalized.verticalOffset);
    setDomeRotationY(normalized.rotationY);
    setDomeLightRotationDeg(normalized.lightRotationDeg);
    setDomeLightStrength(normalized.lightStrength);
    setDomeLightWorldOpacity(normalized.lightWorldOpacity);
    setDomeLightBlur(normalized.lightBlur);
    setDomeLightColor(normalized.lightColor);
    setDomeLightDistance(normalized.lightDistance);
    setDomeShadowBias(normalized.shadowBias);
    setEditRadius((prev) => clamp(prev, 10, normalized.radius));
  }, [currentDomeViewKey, domeSettingsByView]);

  const toSpherical = (x, y, z) => {
    const radius = Math.sqrt((x * x) + (y * y) + (z * z)) || domeRadius;
    const yaw = (Math.atan2(x, z) * 180) / Math.PI;
    const pitch = (Math.asin(clamp(y / radius, -1, 1)) * 180) / Math.PI;
    return { radius, yaw, pitch };
  };

  const setPositionAndAnglesFromXYZ = (x, y, z) => {
    const nx = Number(x);
    const ny = Number(y);
    const nz = Number(z);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return;

    const spherical = toSpherical(nx, ny, nz);
    setEditX(nx);
    setEditY(ny);
    setEditZ(nz);
    setEditRadius(spherical.radius);
  };

  const setPositionFromRadius = (nextRadius) => {
    const targetRadius = clamp(Number(nextRadius) || editRadius, 10, domeRadius);
    const currentRadius = Math.sqrt((editX * editX) + (editY * editY) + (editZ * editZ));

    let nextX = 0;
    let nextY = 0;
    let nextZ = targetRadius;

    if (currentRadius > 0.0001) {
      const factor = targetRadius / currentRadius;
      nextX = editX * factor;
      nextY = editY * factor;
      nextZ = editZ * factor;
    }

    setEditRadius(targetRadius);
    setEditX(nextX);
    setEditY(nextY);
    setEditZ(nextZ);
  };

  const updateDomeThetaStart = (nextStart) => {
    const safeStart = clamp(Number(nextStart) || 0, 0, 160);
    persistDomeSettingsForView({
      radius: domeRadius,
      thetaStartDeg: safeStart,
      thetaLengthDeg: Math.min(domeThetaLengthDeg, 180 - safeStart),
      verticalOffset: domeVerticalOffset,
      lightRotationDeg: domeLightRotationDeg,
      lightStrength: domeLightStrength,
      lightWorldOpacity: domeLightWorldOpacity,
      lightBlur: domeLightBlur,
    });
  };

  const updateDomeThetaLength = (nextLength) => {
    persistDomeSettingsForView({
      radius: domeRadius,
      thetaStartDeg: domeThetaStartDeg,
      thetaLengthDeg: clamp(Number(nextLength) || 20, 20, 180 - domeThetaStartDeg),
      verticalOffset: domeVerticalOffset,
      lightRotationDeg: domeLightRotationDeg,
      lightStrength: domeLightStrength,
      lightWorldOpacity: domeLightWorldOpacity,
      lightBlur: domeLightBlur,
    });
  };

  useEffect(() => {
    setEditRadius((prev) => clamp(prev, 10, domeRadius));
  }, [domeRadius]);

  const previewHotspots = useMemo(() => {
    if (!editDialogOpen || !selectedHotspot) return hotspots;

    const navigationSelectionPath = editNavigationSelection?.source === "library"
      ? String(editNavigationSelection.path || "").replace(/^\/+/, "")
      : "";
    const liveNavigationPath = (editTipo === "navegacao" && editNavigationMode === "file")
      ? (navigationSelectionPath || String(editNavigationPath || "").replace(/^\/+/, ""))
      : "";

    return hotspots.map((hotspot) => {
      if (hotspot.id !== selectedHotspot.id) return hotspot;

      if (editTipo === "navegacao") {
        const isBack = editNavigationMode === "back";
        return {
          ...hotspot,
          x: Number(editX),
          y: Number(editY),
          z: Number(editZ),
          rot_yaw: Number(editYaw) || 0,
          rot_pitch: Number(editPitch) || 0,
          scale: Number(editScale),
          tipo: "navegacao",
          conteudo: "",
          navigation_mode: editNavigationMode,
          id_ponto_destino: editNavigationMode === "point" ? (editPontoDestino || "") : "",
          navigation_file_path: (editNavigationMode === "file" && !isBack) ? liveNavigationPath : "",
          navigation_file_url: (editNavigationMode === "file" && liveNavigationPath && !isBack) ? resolveUploadsUrl(liveNavigationPath) : "",
        };
      }

      return {
        ...hotspot,
        x: Number(editX),
        y: Number(editY),
        z: Number(editZ),
        rot_yaw: Number(editYaw) || 0,
        rot_pitch: Number(editPitch) || 0,
        scale: Number(editScale),
        tipo: editTipo,
        conteudo: editConteudo,
        id_ponto_destino: "",
        navigation_file_path: "",
        navigation_file_url: "",
      };
    });
  }, [
    hotspots,
    editDialogOpen,
    selectedHotspot,
    editTipo,
    editConteudo,
    editX,
    editY,
    editZ,
    editYaw,
    editPitch,
    editScale,
    editPontoDestino,
    editNavigationPath,
    editNavigationSelection,
    editNavigationMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const AFRAME = window.AFRAME;
    const THREE = window.THREE;
    if (!AFRAME || !THREE) return;

    if (!AFRAME.components["face-camera"]) {
      AFRAME.registerComponent("face-camera", {
        init() {
          this.cameraWorldPosition = new THREE.Vector3();
        },
        tick() {
          const scene = this.el.sceneEl;
          if (!scene?.camera) return;
          scene.camera.getWorldPosition(this.cameraWorldPosition);
          this.el.object3D.lookAt(this.cameraWorldPosition);
        },
      });
    }

    if (!AFRAME.components["center-model-pivot"]) {
      AFRAME.registerComponent("center-model-pivot", {
        init() {
          this.boundingBox = new THREE.Box3();
          this.center = new THREE.Vector3();
          this.appliedOffset = new THREE.Vector3();
          this.recenter = this.recenter.bind(this);
          this.el.addEventListener("model-loaded", this.recenter);
          this.recenter();
        },
        recenter() {
          const mesh = this.el.getObject3D("mesh");
          if (!mesh) return;

          // Remove previous offset before recalculating to avoid cumulative drift.
          mesh.position.add(this.appliedOffset);
          this.boundingBox.setFromObject(mesh);
          if (this.boundingBox.isEmpty()) {
            this.appliedOffset.set(0, 0, 0);
            return;
          }

          this.boundingBox.getCenter(this.center);
          this.appliedOffset.copy(this.center);
          mesh.position.sub(this.center);
        },
        remove() {
          this.el.removeEventListener("model-loaded", this.recenter);
        },
      });
    }
  }, []);

  useEffect(() => {
    setActiveEnvironment(environment);
    setActivePontoId(String(pontoId || ""));
    initialViewPathRef.current = relativePathFromUploadsUrl(environment || "");
    setViewHistory([]);
    setIsNavigationTransitioning(false);
    setNavigationPhase("idle");
    setNavigationProgress(0);
  }, [environment, pontoId]);

  const clearNavigationTransitionHandles = () => {
    if (navigationTransitionTimerRef.current) {
      clearTimeout(navigationTransitionTimerRef.current);
      navigationTransitionTimerRef.current = null;
    }

    if (navigationProgressIntervalRef.current) {
      clearInterval(navigationProgressIntervalRef.current);
      navigationProgressIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearNavigationTransitionHandles();
    };
  }, []);

  const runNavigationTransition = (action, holdMs = NAVIGATION_HOLD_MS) => {
    clearNavigationTransitionHandles();

    setIsNavigationTransitioning(true);
    setNavigationPhase("out");
    setNavigationProgress(12);
    navigationProgressIntervalRef.current = setInterval(() => {
      setNavigationProgress((prev) => {
        if (prev >= 88) return prev;
        return Math.min(88, prev + 8);
      });
    }, 90);

    navigationTransitionTimerRef.current = setTimeout(() => {
      action?.();

      navigationTransitionTimerRef.current = setTimeout(() => {
        setNavigationPhase("in");
        if (navigationProgressIntervalRef.current) {
          clearInterval(navigationProgressIntervalRef.current);
          navigationProgressIntervalRef.current = null;
        }
        setNavigationProgress(100);

        navigationTransitionTimerRef.current = setTimeout(() => {
          setIsNavigationTransitioning(false);
          setNavigationPhase("idle");
          setNavigationProgress(0);
          navigationTransitionTimerRef.current = null;
        }, NAVIGATION_WARP_IN_MS);
      }, holdMs);
    }, NAVIGATION_WARP_OUT_MS);
  };

  const goToPreviousView = () => {
    setViewHistory((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const previousEnvironment = next.pop();
      if (previousEnvironment) {
        runNavigationTransition(() => setActiveEnvironment(previousEnvironment));
      }
      return next;
    });
  };

  /*START Environment video handler*/
  const handleVideoRef = (el) => {
    videoRef.current = el;
    if (!el) return;

    el.addEventListener('canplay', () => setVideoReady(true));
    el.play().catch(() => console.log('Autoplay bloqueado'));
  };

  useEffect(() => {
    if (!parsedEnvironment?.mime?.startsWith('video/')) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleCanPlay = () => setVideoReady(true);
    videoEl.addEventListener('canplay', handleCanPlay);

    // forçar autoplay
    videoEl.play().catch(() => {
      console.log('Autoplay bloqueado, precisa interação do usuário');
    });

    return () => videoEl.removeEventListener('canplay', handleCanPlay);
  }, [parsedEnvironment?.mime]);
  /*END Environment video handler*/

  /*START Environment file handler*/
  function detectBase64Type(base64) {
    if (!base64 || typeof base64 !== 'string') return 'application/octet-stream';
    const firstBytes = atob(base64.slice(0, 64)); // decodifica os primeiros 64 chars
    const hex = Array.from(firstBytes)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    // Assinaturas conhecidas
    if (hex.startsWith("89504e47")) return "image/png";      // PNG
    if (hex.startsWith("ffd8ff")) return "image/jpeg";       // JPG
    if (hex.startsWith("47494638")) return "image/gif";      // GIF
    if (hex.startsWith("424d")) return "image/bmp";          // BMP
    if (hex.startsWith("00000018") || hex.startsWith("00000020")) return "video/mp4"; // MP4
    if (hex.startsWith("1a45dfa3")) return "video/webm";    // WebM
    if (hex.startsWith("66747970")) return "video/mp4";      // MP4 alternative

    return "application/octet-stream"; // fallback
  }

  function base64ToBlob(base64) {
    const mimeType = detectBase64Type(base64);

    // converte base64 para bytes
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      array[i] = bytes.charCodeAt(i);
    }

    // cria blob
    const blob = new Blob([array], { type: mimeType });
    const url = URL.createObjectURL(blob);

    return { url, mime: mimeType };
  }

  function inferMimeFromUrl(url) {
    const lowerUrl = String(url || '').toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif)(\?|$)/.test(lowerUrl)) return 'image/jpeg';
    if (/\.(hdr)(\?|$)/.test(lowerUrl)) return 'image/vnd.radiance';
    if (/\.(exr)(\?|$)/.test(lowerUrl)) return 'image/x-exr';
    if (/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/.test(lowerUrl)) return 'video/mp4';
    return 'application/octet-stream';
  }

  function isHdrOrExrUrl(url) {
    return /\.(hdr|exr)(\?|$)/i.test(String(url || ''));
  }

  useEffect(() => {
    let mounted = true;
    ensurePanoramaDomeComponent()
      .catch(() => {
        // ignore; errors are surfaced via events when the entity tries to load
      })
      .finally(() => {
        if (!mounted) return;
        setDomeComponentReady(Boolean(window?.AFRAME?.components?.["panorama-dome"]));
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;
    let shadowRefreshInterval = null;

    const apply = () => {
      try {
        const renderer = sceneEl.renderer;
        if (renderer) {
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = window.THREE?.VSMShadowMap ?? window.THREE?.PCFSoftShadowMap ?? renderer.shadowMap.type;
          renderer.shadowMap.needsUpdate = true;
          renderer.setClearColor?.(0x000000, 1);
        }

        sceneEl.object3D.traverse((obj) => {
          if (obj?.isLight) {
            obj.castShadow = true;
            if (obj.shadow) {
              obj.shadow.mapSize?.set?.(2048, 2048);
              obj.shadow.bias = domeShadowBias;
            }
          }
          if (obj?.isMesh) {
            // Respect explicit A-Frame shadow config on each entity.
            // This avoids invisible helper planes casting square shadows.
            const shadowConfig = obj.el?.getAttribute?.("shadow");
            if (shadowConfig && typeof shadowConfig === "object") {
              obj.castShadow = shadowConfig.cast !== false;
              obj.receiveShadow = shadowConfig.receive !== false;
            } else if (obj.el) {
              // Default for regular scene entities when not configured.
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          }
        });
      } catch {
        // ignore
      }
    };

    sceneEl.addEventListener("renderstart", apply);
    sceneEl.addEventListener("loaded", apply);
    apply();
    // Some meshes (e.g. glTF) arrive asynchronously; keep shadow flags in sync.
    shadowRefreshInterval = window.setInterval(apply, 1000);
    return () => {
      if (shadowRefreshInterval) {
        window.clearInterval(shadowRefreshInterval);
      }
      sceneEl.removeEventListener("renderstart", apply);
      sceneEl.removeEventListener("loaded", apply);
    };
  }, [domeShadowBias]);

  useEffect(() => {
    const ambientLight = ambientLightRef.current?.getObject3D?.("light");
    if (ambientLight) {
      ambientLight.intensity = Math.max(0, domeLightWorldOpacity);
    }

    const pointLight = pointLightRef.current?.getObject3D?.("light");
    if (pointLight) {
      pointLight.intensity = Math.max(0, domeLightStrength);
      pointLight.distance = domeLightDistance;
      pointLight.color?.set?.(domeLightColor);
      pointLight.castShadow = true;

      // Also update A-Frame light component attrs to keep runtime behavior in sync.
      pointLightRef.current?.setAttribute?.("light", "intensity", Math.max(0, domeLightStrength));
      pointLightRef.current?.setAttribute?.("light", "distance", domeLightDistance);
      pointLightRef.current?.setAttribute?.("light", "color", domeLightColor);

      if (pointLight.shadow) {
        pointLight.shadow.bias = domeShadowBias;
        pointLight.shadow.mapSize?.set?.(2048, 2048);

        // For PCF/PCFSoft this controls softness; with VSM we also tune blurSamples.
        pointLight.shadow.radius = Math.max(0, domeLightBlur * 12);
        if (typeof pointLight.shadow.blurSamples === "number") {
          pointLight.shadow.blurSamples = Math.max(1, Math.round(4 + domeLightBlur * 20));
        }
        pointLight.shadow.needsUpdate = true;
      }
    }

    const renderer = sceneRef.current?.renderer;
    if (renderer?.shadowMap) {
      renderer.shadowMap.needsUpdate = true;
    }
  }, [domeLightBlur, domeLightColor, domeLightDistance, domeLightStrength, domeLightWorldOpacity, domeShadowBias, pointLightPosition]);

  useEffect(() => {
    const el = domeEntityRef.current;
    if (!el) return;

    const onError = (evt) => {
      const message = evt?.detail?.message;
      setEnvironmentLoadError(message || "Não foi possível carregar o dome 360.");
    };
    const onLoaded = () => setEnvironmentLoadError("");

    el.addEventListener("panorama-dome-error", onError);
    el.addEventListener("panorama-dome-loaded", onLoaded);
    return () => {
      el.removeEventListener("panorama-dome-error", onError);
      el.removeEventListener("panorama-dome-loaded", onLoaded);
    };
  }, [activeEnvironment]);

  function parseEnvironment(value) {
    if (!value) return null;

    if (typeof value === 'object' && value.url) {
      return { url: value.url, mime: value.mime || inferMimeFromUrl(value.url), mode: 'url' };
    }

    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('blob:') || value.startsWith('data:'))) {
      return { url: value, mime: inferMimeFromUrl(value), mode: 'url' };
    }

    const blobData = base64ToBlob(value);
    return { ...blobData, mode: 'base64', raw: value };
  }
  /*END Environment file handler*/

  const panoramaKind = useMemo(() => {
    if (isHdrOrExrEnvironment) return "hdr";
    if (parsedEnvironment?.mime?.startsWith("video/")) return "video";
    if (parsedEnvironment?.mime?.startsWith("image/")) return "image";
    return "";
  }, [isHdrOrExrEnvironment, parsedEnvironment?.mime]);

  const panoramaSrc = useMemo(() => {
    if (panoramaKind === "hdr") return parsedEnvironment?.url || "";
    if (panoramaKind === "video") return videoReady ? "#environment" : "";
    if (panoramaKind === "image") return imageSkySrc || "";
    return "";
  }, [imageSkySrc, panoramaKind, parsedEnvironment?.url, videoReady]);

  useEffect(() => {
    const el = domeEntityRef.current;
    if (!el) return;
    if (!panoramaSrc || !panoramaKind) return;
    if (!domeComponentReady) return;

    el.setAttribute("panorama-dome", {
      kind: panoramaKind,
      src: panoramaSrc,
      radius: domeRadius,
      rotationY: domeRotationY,
      opacity: 1,
      shadowOpacity: Math.max(0.05, Math.min(1, 0.1 + domeLightStrength * 0.18)),
      model: "/models/Dome.fbx",
      recenter: false,
      alignY: "center",
    });
  }, [domeComponentReady, domeLightStrength, domeRadius, domeRotationY, panoramaKind, panoramaSrc]);

  useEffect(() => {
    const el = document.querySelector('a-text');
    if (el) {
      el.object3D.renderOrder = 1;
    }
  }, []);

  const defaultProps = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
  };

  const tipoToAFrame = {
    texto: (conteudo) => (
      <a-entity>
        <a-text
          value={String(conteudo || "Texto")}
          color="white"
          width="120"
          wrap-count="22"
          anchor="center"
          align="center"
          baseline="center"
          side="double"
          position="0 10 0"
        />
      </a-entity>
    ),

    imagem: (conteudo) => (
      <a-entity>
        <a-ring radius-inner="5" radius-outer="7" color="#06b6d4" material="side: double" />
        <a-text value={conteudo ? "Imagem" : "Imagem?"} color="white" width="70" align="center" position="0 9 0" />
      </a-entity>
    ),

    modelo3d: (conteudo) => (
      <a-entity
        gltf-model={conteudo}
        position={`${defaultProps.position.x} ${defaultProps.position.y} ${defaultProps.position.z}`}
        rotation={`${defaultProps.rotation.x} ${defaultProps.rotation.y} ${defaultProps.rotation.z}`}
        scale={`${defaultProps.scale.x} ${defaultProps.scale.y} ${defaultProps.scale.z}`}
        center-model-pivot
      />
    ),

    audio: (conteudo) => (
      <a-entity>
        <a-ring radius-inner="5" radius-outer="7" color="#a855f7" material="side: double" />
        <a-text value="Audio" color="white" width="60" align="center" position="0 9 0" />
        <a-entity
          sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: false`}
        ></a-entity>
      </a-entity>
    ),

    audioespacial: (conteudo) => (
      <a-entity>
        <a-ring radius-inner="5" radius-outer="7" color="#7c3aed" material="side: double" />
        <a-text value="Audio 3D" color="white" width="80" align="center" position="0 9 0" />
        <a-entity
          sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: true; refDistance: 50; rolloffFactor: 1;`}
        ></a-entity>
      </a-entity>
    ),

    video: (conteudo) => (
      <a-entity>
        <a-ring radius-inner="5" radius-outer="7" color="#f59e0b" material="side: double" />
        <a-text value={conteudo ? "Video" : "Video?"} color="white" width="60" align="center" position="0 9 0" />
      </a-entity>
    ),

    link: (conteudo, hotspot) => (
      (hotspot?.tipo === "navegacao" || hotspot?.id_ponto_destino || hotspot?.navigation_file_url || hotspot?.navigation_mode === "back") ? (
        <a-entity>
          <a-ring
            radius-inner="8"
            radius-outer="12"
            color="#22c55e"
            position="0 0 0"
            opacity="0.95"
            material="side: double"
          />
          <a-circle
            radius="7"
            color="#0b1b10"
            position="0 0 0.02"
            opacity="0.9"
            material="side: double"
          />
          {hotspot?.navigation_mode === "back" ? (
            <a-triangle
              vertex-a="2.5 4 0.05"
              vertex-b="2.5 -4 0.05"
              vertex-c="-4 0 0.05"
              color="#22c55e"
              material="side: double"
            />
          ) : (
            <a-triangle
              vertex-a="-2.5 4 0.05"
              vertex-b="-2.5 -4 0.05"
              vertex-c="4 0 0.05"
              color="#22c55e"
              material="side: double"
            />
          )}
          <a-text
            value={hotspot?.navigation_mode === "back" ? "Anterior" : "Proxima vista"}
            color="white"
            width="90"
            align="center"
            position="0 16 0"
          />
        </a-entity>
      ) : (
        <>
          <a-sphere position="0 0 0" radius="16" color="#ff2e63" />
          <a-link
            href={conteudo}
            title={conteudo}
            position="0 0 0.5"
            scale="16 16 1"
          />
        </>
      )
    ),
  };

  const contextMenuOptions = selectedHotspot
    ? [
      { label: "Editar Hotspot", value: "edit" },
      { label: "Eliminar Hotspot", value: "delete" },
      { label: "Editar dome", value: "edit-dome" },
    ]
    : [
      { label: "Criar Hotspot", value: "create" },
      { label: "Editar dome", value: "edit-dome" },
    ];

  const fetchHotspots = async () => {
    try {
      const res = await fetch(buildApiUrl("/hotspot/"));
      const data = await res.json();
      if (Array.isArray(data)) {
        const currentViewPath = relativePathFromUploadsUrl(activeEnvironment || "");
        const isInitialView = currentViewPath === initialViewPathRef.current;
        const doPonto = data.filter((h) => Number(h.id_ponto) === Number(activePontoId));
        const formatados = doPonto.map((h) => {
          const decodedContent = decodeHotspotContent(h.conteudo || "");
          const navigation = decodeNavigationContent(h.tipo || "", h.conteudo || "");
          const isNavigation = navigation.mode === "point" || navigation.mode === "file" || navigation.mode === "back";
          return {
            id: h.id_hotspot,
            id_hotspot: h.id_hotspot,
            x: parseFloat(h.x),
            y: parseFloat(h.y),
            z: parseFloat(h.z),
            scale: decodedContent.scale || 1,
            rot_yaw: decodedContent.rotYaw || 0,
            rot_pitch: decodedContent.rotPitch || 0,
            tipo: isNavigation ? "navegacao" : (h.tipo || ""),
            conteudo: isNavigation ? "" : decodedContent.value,
            view_path: decodedContent.view,
            navigation_mode: navigation.mode,
            id_ponto_destino: navigation.pointId,
            navigation_file_path: navigation.filePath,
            navigation_file_url: navigation.filePath ? resolveUploadsUrl(navigation.filePath) : "",
          };
        });

        const filtrados = formatados.filter((h) => {
          if (!h.view_path) return isInitialView;
          return h.view_path === currentViewPath;
        });

        setHotspots(filtrados);
      }
    } catch (err) {
      console.error("❌ Erro ao buscar hotspots:", err);
    }
  };

  useEffect(() => {
    fetchHotspots();
  }, [activePontoId, activeEnvironment]);

  useEffect(() => {
    const fetchPontosDestino = async () => {
      try {
        const res = await fetch(buildApiUrl("/ponto/list"));
        if (!res.ok) {
          console.error("❌ Erro ao buscar pontos:", res.status, res.statusText);
          setPontosNavegacao([]);
          setPontosDestino([]);
          return;
        }
        const data = await res.json();
        const pontos = Array.isArray(data?.pontos)
          ? data.pontos
          : (Array.isArray(data) ? data : []);

        const opcoes = pontos
          .filter((p) => Number(p.id_ponto) !== Number(pontoId))
          .filter((p) => isHdrOrExrByUrl(p.environment || p.imageUrl || ""))
          .map((p) => ({
            label: p.name || `Ponto ${p.id_ponto}`,
            value: String(p.id_ponto),
          }));
        setPontosDestino(opcoes);
      } catch (err) {
        console.error("❌ Erro ao buscar vistas de destino:", err);
      }
    };

    fetchPontosDestino();
  }, [pontoId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const onClickScene = (e) => {
      if (!enableContextMenu) return;
      const isHotspot = e.target?.classList?.contains("hotspot-interaction");
      if (!isHotspot) {
        setSelectedHotspot(null);
        clickEventRef.current = e;
      }
    };

    if (enableContextMenu) {
      scene.addEventListener("click", onClickScene);
    }

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e?.detail?.mouseEvent?.button ?? 0;
      const id = Number(e.currentTarget.dataset.id);
      const hotspot = hotspots.find((h) => h.id === id);
      if (hotspot) {
        if (enableContextMenu) {
          setSelectedHotspot(hotspot);
          clickEventRef.current = e;
          console.log("🟥 Clique no HOTSPOT:", hotspot);
        }
        if (navigateOnHotspot && btn === 0) {
          if (isNavigationTransitioning) return;

          if (hotspot.navigation_mode === "back") {
            goToPreviousView();
            return;
          }
          if (hotspot.id_ponto_destino) {
            runNavigationTransition(() => {
              window.location.href = `/view/p/${hotspot.id_ponto_destino}`;
            }, 0);
            return;
          }

          if (hotspot.navigation_file_url) {
            if (String(activeEnvironment || "") === String(hotspot.navigation_file_url)) return;

            setViewHistory((prev) => [...prev, activeEnvironment]);
            runNavigationTransition(() => {
              setActiveEnvironment(hotspot.navigation_file_url);
            });
            return;
          }
        }
        //se for um link, deve ver o href e ir para lá
        if (hotspot.tipo === "link" && hotspot.conteudo && btn === 0) {
          window.open(hotspot.conteudo, '_self');
        }
      }
    };

    const clickablePlanes = scene.querySelectorAll(".hotspot-interaction");
    clickablePlanes.forEach((el) => {
      el.addEventListener("click", handler);
    });

    return () => {
      if (enableContextMenu) {
        scene.removeEventListener("click", onClickScene);
      }
      clickablePlanes.forEach((el) => {
        el.removeEventListener("click", handler);
      });
    };
  }, [enableContextMenu, hotspots, navigateOnHotspot, activeEnvironment, isNavigationTransitioning]);

  const getPointerRaycaster = (clientX, clientY) => {
    const sceneEl = sceneRef.current;
    const THREE = window?.THREE;
    if (!sceneEl?.camera || !sceneEl?.canvas || !THREE) return null;

    const rect = sceneEl.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const mouse = {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, sceneEl.camera);
    return { THREE, raycaster };
  };

  const resolveHotspotFromObject = (object3D) => {
    let current = object3D;
    while (current) {
      const el = current.el;
      if (el?.dataset?.id) {
        const id = Number(el.dataset.id);
        if (Number.isFinite(id)) {
          return hotspots.find((hotspot) => Number(hotspot.id) === id) || null;
        }
      }
      current = current.parent;
    }
    return null;
  };

  const createHotspot = async () => {
    const event = clickEventRef.current;
    if (!event) return;

    const pointerClientX = Number(event?.clientX ?? event?.detail?.mouseEvent?.clientX);
    const pointerClientY = Number(event?.clientY ?? event?.detail?.mouseEvent?.clientY);
    if (!Number.isFinite(pointerClientX) || !Number.isFinite(pointerClientY)) {
      console.warn("❌ Coordenadas do rato inválidas para criar hotspot");
      return;
    }

    const raycast = getPointerRaycaster(pointerClientX, pointerClientY);
    if (!raycast) {
      console.error("THREE.js ou cena ainda não carregados");
      return;
    }

    const { THREE, raycaster } = raycast;
    let intersection = null;

    const domeMesh = domeEntityRef.current?.getObject3D?.("mesh");
    if (domeMesh) {
      const domeHits = raycaster.intersectObject(domeMesh, true);
      const firstDomeHit = domeHits.find((hit) => hit?.point);
      if (firstDomeHit?.point) {
        intersection = firstDomeHit.point.clone();
      }
    }

    if (!intersection) {
      const sphere = new THREE.Sphere(new THREE.Vector3(0, Number(domeVerticalOffset) || 0, 0), domeRadius);
      const point = new THREE.Vector3();
      if (raycaster.ray.intersectSphere(sphere, point)) {
        intersection = point;
      }
    }

    if (!intersection) {
      console.warn("❌ Sem interseção com o dome");
      return;
    }

    try {
      const res = await fetch(buildApiUrl("/hotspot/add"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_ponto: pontoId,
          x: intersection.x,
          y: intersection.y,
          z: intersection.z,
        }),
      });

      if (!res.ok) throw new Error("Erro ao guardar hotspot");

      const data = await res.json();
      console.log("✅ Hotspot guardado:", data);

      const hotspotCriado = data?.hotspot;
      if (hotspotCriado?.id_hotspot) {
        const activeViewPath = relativePathFromUploadsUrl(activeEnvironment || "");
        const hotspotEditavel = {
          id: hotspotCriado.id_hotspot,
          id_hotspot: hotspotCriado.id_hotspot,
          x: parseFloat(hotspotCriado.x),
          y: parseFloat(hotspotCriado.y),
          z: parseFloat(hotspotCriado.z),
          scale: 1,
          rot_yaw: 0,
          rot_pitch: 0,
          tipo: hotspotCriado.tipo || "",
          conteudo: hotspotCriado.conteudo || "",
          view_path: activeViewPath,
          navigation_mode: null,
          id_ponto_destino: "",
          navigation_file_path: "",
          navigation_file_url: "",
        };

        setHotspots((prev) => {
          const exists = prev.some((h) => h.id === hotspotEditavel.id);
          if (exists) return prev;
          return [...prev, hotspotEditavel];
        });

        setSelectedHotspot(hotspotEditavel);
        setEditTipo(hotspotEditavel.tipo || "");
        setEditConteudo(hotspotEditavel.conteudo || "");
        setEditYaw(Number(hotspotEditavel.rot_yaw) || 0);
        setEditPitch(Number(hotspotEditavel.rot_pitch) || 0);
        setEditScale(Number(hotspotEditavel.scale) || 1);
        setPositionAndAnglesFromXYZ(hotspotEditavel.x, hotspotEditavel.y, hotspotEditavel.z);
        setEditPontoDestino(hotspotEditavel.id_ponto_destino || "");
        setEditNavigationSelection(null);
        setEditNavigationPath("");
        setEditNavigationMode("file");
        setEditModelSelection(null);
        setEditDialogOpen(true);
      }
    } catch (err) {
      console.error("❌ Erro ao guardar hotspot:", err);
    }
  };

  const pickHotspotFromPointer = (clientX, clientY) => {
    if (!Array.isArray(hotspots) || hotspots.length === 0) {
      return null;
    }

    const raycast = getPointerRaycaster(clientX, clientY);
    if (!raycast) return null;

    const { THREE, raycaster } = raycast;

    const sceneObject = sceneRef.current?.object3D;
    if (sceneObject) {
      const intersections = raycaster.intersectObject(sceneObject, true);
      for (const hit of intersections) {
        const matched = resolveHotspotFromObject(hit?.object);
        if (matched) return matched;
      }
    }

    let best = null;
    let bestDistance = Infinity;

    hotspots.forEach((hotspot) => {
      const point = new THREE.Vector3(Number(hotspot.x) || 0, Number(hotspot.y) || 0, Number(hotspot.z) || 0);
      const distance = raycaster.ray.distanceToPoint(point);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = hotspot;
      }
    });

    // Fallback de tolerancia em unidades do mundo do dome 360.
    return bestDistance <= 40 ? best : null;
  };

  const deleteHotspot = async (id) => {
    const result = await Swal.fire({
      title: "Eliminar Hotspot",
      text: "Tens a certeza que queres eliminar este hotspot?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#171717",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(buildApiUrl(`/hotspot/${id}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao eliminar hotspot");
      setHotspots((prev) => prev.filter((h) => h.id !== id));
      Swal.fire({
        title: "Eliminado!",
        text: "Hotspot eliminado com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (err) {
      console.error("❌ Erro ao eliminar:", err);
      Swal.fire({
        title: "Erro",
        text: "Erro ao eliminar o hotspot.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const updateHotspot = async () => {
    if (!selectedHotspot) return;

    const result = await Swal.fire({
      title: "Confirmar alteração",
      text: "Tens a certeza que queres guardar as alterações neste hotspot?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#171717",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    let finalTipo = editTipo;
    let finalConteudoRaw = editConteudo;
    let finalPontoDestino = "";
    let finalNavigationPath = "";
    const activeViewPath = relativePathFromUploadsUrl(activeEnvironment || "");

    if (editTipo === "navegacao") {
      if (editNavigationMode === "back") {
        finalTipo = "link";
        finalConteudoRaw = encodeDestinationBackContent();
      } else if (editNavigationMode === "point") {
        if (!editPontoDestino) {
          Swal.fire({
            title: "Destino em falta",
            text: "Seleciona um ponto de destino.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }
        finalTipo = "link";
        finalConteudoRaw = encodeDestinationPointContent(editPontoDestino);
        finalPontoDestino = editPontoDestino;
      } else {
        const resolvedNavigation = await resolveMediaSelection(editNavigationSelection, "pontos");
        const navigationPath = resolvedNavigation?.path || editNavigationPath;

        if (!navigationPath) {
          Swal.fire({
            title: "Destino em falta",
            text: "Seleciona ou faz upload de um ficheiro HDR/EXR.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }

        if (!/\.(hdr|exr)$/i.test(navigationPath)) {
          Swal.fire({
            title: "Formato inválido",
            text: "Para navegação por ficheiro, usa apenas HDR/EXR.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }

        finalTipo = "link";
        finalConteudoRaw = encodeDestinationFileContent(navigationPath);
        finalNavigationPath = navigationPath;
      }
    }

    if (editTipo === "modelo3d") {
      if (editModelSelection) {
        const resolvedModel = await resolveMediaSelection(editModelSelection, "modelos3d");
        const resolvedModelUrl = resolvedModel?.url || resolveUploadsUrl(resolvedModel?.path || "");

        if (!resolvedModelUrl) {
          Swal.fire({
            title: "Modelo inválido",
            text: "Não foi possível resolver o ficheiro 3D selecionado.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }

        finalConteudoRaw = resolvedModelUrl;
      }

      if (!String(finalConteudoRaw || "").trim()) {
        Swal.fire({
          title: "Modelo em falta",
          text: "Seleciona ou faz upload de um ficheiro GLB/GLTF para o hotspot de modelo 3D.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }
    }

    const finalConteudo = encodeHotspotContent(finalConteudoRaw, activeViewPath, editScale, editYaw, editPitch);

    try {
      const res = await fetch(buildApiUrl(`/hotspot/${selectedHotspot.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: finalTipo,
          conteudo: finalConteudo,
          x: Number(editX),
          y: Number(editY),
          z: Number(editZ),
        }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar hotspot");
      const data = await res.json();
      console.log("✅ Hotspot atualizado:", data);
      const updatedLocal = {
        id: selectedHotspot.id,
        id_hotspot: selectedHotspot.id,
        tipo: editTipo,
        conteudo: editTipo === "navegacao" ? "" : finalConteudoRaw,
        view_path: activeViewPath,
        x: Number(editX),
        y: Number(editY),
        z: Number(editZ),
        rot_yaw: Number(editYaw) || 0,
        rot_pitch: Number(editPitch) || 0,
        scale: Number(editScale),
        navigation_mode: editTipo === "navegacao" ? editNavigationMode : null,
        id_ponto_destino: finalPontoDestino,
        navigation_file_path: finalNavigationPath,
        navigation_file_url: finalNavigationPath ? resolveUploadsUrl(finalNavigationPath) : "",
      };

      setHotspots((prev) => {
        const idx = prev.findIndex((h) => h.id === selectedHotspot.id);
        if (idx === -1) return [...prev, updatedLocal];

        const next = [...prev];
        next[idx] = { ...next[idx], ...updatedLocal };
        return next;
      });

      fetchHotspots();
      setEditDialogOpen(false);
      Swal.fire({
        title: "Atualizado!",
        text: "Hotspot atualizado com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (err) {
      console.error("❌ Erro ao atualizar hotspot:", err);
      Swal.fire({
        title: "Erro",
        text: "Erro ao atualizar o hotspot.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const scene = (
    <a-scene
      ref={sceneRef}
      embedded
      vr-mode-ui="enabled: false"
      renderer="logarithmicDepthBuffer: true"
      shadow="type: pcfsoft"
      className="w-full h-full"
    >
      <a-camera
        position="0 0 0"
        far={Math.max(4000, Math.ceil(domeRadius * 3.5 + 500))}
        look-controls
        wasd-controls-enabled="false"
        raycaster="objects: .hotspot-interaction"
        cursor="rayOrigin: mouse"
      ></a-camera>

      <a-entity ref={ambientLightRef} light={`type: ambient; color: #ffffff; intensity: ${Math.max(0, domeLightWorldOpacity)}`} />
      <a-entity
        ref={pointLightRef}
        position={pointLightPosition}
        light={`type: point; color: ${domeLightColor}; intensity: ${domeLightStrength}; distance: ${domeLightDistance}; decay: 2; castShadow: true; shadowMapWidth: 2048; shadowMapHeight: 2048; shadowBias: ${domeShadowBias}`}
      />

      {parsedEnvironment?.mime?.startsWith("video/") && (
        <video style={{ display: "none" }} id="environment" ref={handleVideoRef} preload="auto" crossOrigin="anonymous" autoPlay loop muted playsInline>
          <source src={parsedEnvironment.url} type={parsedEnvironment.mime} />
        </video>
      )}

      {panoramaSrc && panoramaKind && <a-entity ref={domeEntityRef} position={`0 ${domeVerticalOffset} 0`} shadow="cast: false; receive: true" />}

      {previewHotspots.map((pos) => (
        <a-entity
          key={pos.id}
          className="hotspot-root"
          data-id={pos.id}
          position={`${pos.x} ${pos.y} ${pos.z}`}
          rotation={`${Number(pos.rot_pitch) || 0} ${Number(pos.rot_yaw) || 0} 0`}
          scale={`${Math.max(HOTSPOT_SCALE_MIN, Number(pos.scale) || 1)} ${Math.max(HOTSPOT_SCALE_MIN, Number(pos.scale) || 1)} ${Math.max(HOTSPOT_SCALE_MIN, Number(pos.scale) || 1)}`}
          shadow="cast: true; receive: true"
        >
          {(!pos.tipo)
            ? <a-sphere position="0 0 0" radius="16" color="red" shadow="cast: true; receive: true" />
            : tipoToAFrame[pos.tipo === "navegacao" ? "link" : pos.tipo]?.(pos.conteudo, pos) || null}

          <a-plane
            className="clickable hotspot-interaction"
            data-id={pos.id}
            position="0 0 0"
            width="25"
            height="25"
            material="color: #fff; opacity: 0; side: double"
            transparent="true"
            rotation="0 0 0"
            shadow="cast: false; receive: false"
            event-set__enter="_event: mouseenter; opacity: 0.15"
            event-set__leave="_event: mouseleave; opacity: 0"
          />
        </a-entity>
      ))}
    </a-scene>
  );

  const isWarpOut = isNavigationTransitioning && navigationPhase === "out";
  const isWarpIn = isNavigationTransitioning && navigationPhase === "in";
  const sceneWarpStyle = {
    transform: isWarpOut
      ? "scale(1.14)"
      : (isWarpIn ? "scale(1.02)" : "scale(1)"),
    filter: isWarpOut
      ? "blur(2.4px) saturate(1.24) brightness(1.08)"
      : (isWarpIn ? "blur(0.8px) saturate(1.05) brightness(1.02)" : "none"),
    transitionDuration: isWarpOut ? `${NAVIGATION_WARP_OUT_MS}ms` : `${NAVIGATION_WARP_IN_MS}ms`,
    transitionTimingFunction: isWarpOut ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.2, 0, 0, 1)",
    transitionProperty: "transform, filter",
    transformOrigin: "50% 50%",
    willChange: "transform, filter",
  };

  return (
    <div className="relative w-full h-full">
      <div
        className="pointer-events-none absolute inset-0 z-30"
        style={{
          opacity: isNavigationTransitioning ? 1 : 0,
          backgroundColor: isWarpOut ? "rgba(4,7,14,0.34)" : "rgba(4,7,14,0.2)",
          backdropFilter: isNavigationTransitioning ? "blur(18px)" : "blur(0px)",
          WebkitBackdropFilter: isNavigationTransitioning ? "blur(18px)" : "blur(0px)",
          transitionDuration: isWarpOut ? `${NAVIGATION_WARP_OUT_MS}ms` : `${NAVIGATION_WARP_IN_MS}ms`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          transitionProperty: "opacity, background-color, backdrop-filter, -webkit-backdrop-filter",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-30"
        style={{
          opacity: isNavigationTransitioning ? (isWarpOut ? 0.72 : 0.24) : 0,
          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18) 0%, rgba(182,220,255,0.1) 20%, rgba(8,10,20,0.03) 42%, rgba(2,3,9,0.6) 100%)",
          transform: isWarpOut ? "scale(1.32)" : "scale(1.05)",
          transitionDuration: isWarpOut ? `${NAVIGATION_WARP_OUT_MS}ms` : `${NAVIGATION_WARP_IN_MS}ms`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          transitionProperty: "opacity, transform",
        }}
      />
      {isNavigationTransitioning && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-1 bg-white/10">
          <div
            className="h-full rounded-r-full bg-white/85"
            style={{
              width: `${navigationProgress}%`,
              boxShadow: "0 0 14px rgba(255,255,255,0.55)",
              transition: "width 100ms linear",
            }}
          />
        </div>
      )}
      {environmentLoadError && (
        <div className="absolute top-2 left-2 z-20 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {environmentLoadError}
        </div>
      )}
      {editingItem && isAdmin && (
        <div
          className="fixed top-1/2 -translate-y-1/2 right-4 bg-white rounded-xl shadow-xl w-[90vw] sm:w-[25%] h-[70%] overflow-y-auto z-50 p-6"
        >
          <button
            onClick={handleCloseEditor}
            className="absolute top-4 right-4 text-gray-700 hover:text-black"
          >
            ✕
          </button>

          <h2 className="text-lg font-semibold text-black mb-4">
            Editar {editingItem.tipo.toUpperCase()}
          </h2>

          {/* Campos dinâmicos conforme o tipo */}
          {editingItem.tipo === "modelo3d" && (
            <>
              <h3 className="font-semibold text-black">Transformações</h3>

              <label>Posição X</label>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={editingItem.props.position.x}
                onChange={(e) =>
                  handleUpdate("position", { ...editingItem.props.position, x: parseFloat(e.target.value) })
                }
                className="w-full accent-black"
              />

              <label>Rotação Y</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={editingItem.props.rotation.y}
                onChange={(e) =>
                  handleUpdate("rotation", { ...editingItem.props.rotation, y: parseFloat(e.target.value) })
                }
                className="w-full accent-black"
              />

              <label>Escala</label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={editingItem.props.scale.x}
                onChange={(e) =>
                  handleUpdate("scale", {
                    x: parseFloat(e.target.value),
                    y: parseFloat(e.target.value),
                    z: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-black"
              />

              <h3 className="font-semibold mt-4 text-black">VFX / Color</h3>

              <label>Brilho</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={editingItem.props.brightness}
                onChange={(e) => handleUpdate("brightness", parseFloat(e.target.value))}
                className="w-full accent-black"
              />

              <label>Contraste</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={editingItem.props.contrast}
                onChange={(e) => handleUpdate("contrast", parseFloat(e.target.value))}
                className="w-full accent-black"
              />

              <label>Saturação</label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={editingItem.props.saturation}
                onChange={(e) => handleUpdate("saturation", parseFloat(e.target.value))}
                className="w-full accent-black"
              />

              <label>Matiz</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={editingItem.props.hue}
                onChange={(e) => handleUpdate("hue", parseFloat(e.target.value))}
                className="w-full accent-black"
              />
            </>
          )}

          {editingItem.tipo === "imagem" && (
            <>
              <h3 className="font-semibold text-black">Efeitos Visuais</h3>
              <label>Brilho</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={editingItem.props.brightness}
                onChange={(e) => handleUpdate("brightness", parseFloat(e.target.value))}
                className="w-full accent-black"
              />
              <label>Contraste</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={editingItem.props.contrast}
                onChange={(e) => handleUpdate("contrast", parseFloat(e.target.value))}
                className="w-full accent-black"
              />
              <label>Saturação</label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={editingItem.props.saturation}
                onChange={(e) => handleUpdate("saturation", parseFloat(e.target.value))}
                className="w-full accent-black"
              />
              <label>Matiz</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={editingItem.props.hue}
                onChange={(e) => handleUpdate("hue", parseFloat(e.target.value))}
                className="w-full accent-black"
              />
            </>
          )}

          {editingItem.tipo === "video" && (
            <>
              <h3 className="font-semibold text-black">Efeitos no Vídeo</h3>
              <label>Brilho</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={editingItem.props.brightness}
                onChange={(e) => handleUpdate("brightness", parseFloat(e.target.value))}
                className="w-full accent-black"
              />
              {/* Outros VFX iguais aos de imagem */}
            </>
          )}
        </div>
      )}
      <div className="h-full w-full" style={sceneWarpStyle}>
        {enableContextMenu ? (
          <ContextMenuWrapper
            onContextMenuCapture={(event) => {
              clickEventRef.current = {
                clientX: event.clientX,
                clientY: event.clientY,
              };
              const hotspotAtPointer = pickHotspotFromPointer(event.clientX, event.clientY);
              setSelectedHotspot(hotspotAtPointer);
            }}
            options={contextMenuOptions}
            onSelect={(value) => {
              if (value === "create") {
                createHotspot();
              } else if (value === "edit") {
                if (selectedHotspot) {
                  setEditTipo(selectedHotspot.tipo || "");
                  setEditConteudo(selectedHotspot.conteudo || "");
                  setEditYaw(Number(selectedHotspot.rot_yaw) || 0);
                  setEditPitch(Number(selectedHotspot.rot_pitch) || 0);
                  setEditScale(Number(selectedHotspot.scale) || 1);
                  setEditModelSelection(
                    selectedHotspot.tipo === "modelo3d" && relativePathFromUploadsUrl(selectedHotspot.conteudo || "")
                      ? createLibrarySelection(relativePathFromUploadsUrl(selectedHotspot.conteudo || ""))
                      : null
                  );
                  setPositionAndAnglesFromXYZ(selectedHotspot.x, selectedHotspot.y, selectedHotspot.z);
                  setEditPontoDestino(selectedHotspot.id_ponto_destino || "");
                  setEditNavigationPath(selectedHotspot.navigation_file_path || "");
                  setEditNavigationSelection(
                    selectedHotspot.navigation_file_path
                      ? createLibrarySelection(selectedHotspot.navigation_file_path)
                      : null
                  );
                  setEditNavigationMode(
                    selectedHotspot.navigation_mode
                      ? selectedHotspot.navigation_mode
                      : (selectedHotspot.id_ponto_destino ? "point" : (selectedHotspot.navigation_file_path ? "file" : "file"))
                  );
                  setEditDialogOpen(true);
                }
              } else if (value === "delete") {
                deleteHotspot(selectedHotspot.id);
              } else if (value === "edit-dome") {
                setDomeDialogOpen(true);
              }
            }}
          >
            {scene}
          </ContextMenuWrapper>
        ) : (
          scene
        )}
      </div>
      <CustomDialog
        open={domeDialogOpen}
        onOpenChange={setDomeDialogOpen}
        title="Editar dome"
        confirmLabel="Fechar"
        cancelLabel="Cancelar"
        onConfirm={() => setDomeDialogOpen(false)}
        nonModal
        closeOnInteractOutside={false}
        overlayClassName="bg-transparent pointer-events-none"
        contentClassName="!left-auto !top-auto !right-4 !bottom-4 !translate-x-0 !translate-y-0 !w-[380px] max-w-[92vw] max-h-[78vh] p-4"
      >
        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm font-medium">Vista: {currentViewPath || "vista inicial"}</label>

          <label className="text-sm font-medium">Raio: {Math.round(domeRadius)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min="300"
            max={Math.max(1400, Math.ceil(domeRadius))}
            step="10"
            value={domeRadius}
            onChange={(e) => {
              const nextRadius = parseFloat(e.target.value);
              if (!Number.isFinite(nextRadius)) return;
              persistDomeSettingsForView({
                radius: nextRadius,
                thetaStartDeg: domeThetaStartDeg,
                thetaLengthDeg: domeThetaLengthDeg,
                verticalOffset: domeVerticalOffset,
                lightRotationDeg: domeLightRotationDeg,
                lightStrength: domeLightStrength,
                lightWorldOpacity: domeLightWorldOpacity,
                lightBlur: domeLightBlur,
              });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="10"
            value={domeRadius}
            onChange={(e) => {
              const nextRadius = parseFloat(e.target.value);
              if (!Number.isFinite(nextRadius)) return;
              persistDomeSettingsForView({ radius: nextRadius });
            }}
          />

          <label className="text-sm font-medium">Posição vertical: {Math.round(domeVerticalOffset)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min={DOME_VERTICAL_OFFSET_MIN}
            max={Math.max(DOME_VERTICAL_OFFSET_MAX, Math.ceil(domeVerticalOffset))}
            step="1"
            value={domeVerticalOffset}
            onChange={(e) => {
              const nextOffset = parseFloat(e.target.value);
              if (!Number.isFinite(nextOffset)) return;
              persistDomeSettingsForView({
                radius: domeRadius,
                thetaStartDeg: domeThetaStartDeg,
                thetaLengthDeg: domeThetaLengthDeg,
                verticalOffset: nextOffset,
                lightRotationDeg: domeLightRotationDeg,
                lightStrength: domeLightStrength,
                lightWorldOpacity: domeLightWorldOpacity,
                lightBlur: domeLightBlur,
              });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="1"
            value={domeVerticalOffset}
            onChange={(e) => {
              const nextOffset = parseFloat(e.target.value);
              if (!Number.isFinite(nextOffset)) return;
              persistDomeSettingsForView({ verticalOffset: nextOffset });
            }}
          />

          <label className="text-sm font-medium">Rotacao do dome (Y): {Math.round(domeRotationY)}°</label>
          <input
            className="w-full accent-black"
            type="range"
            min="-360"
            max="360"
            step="1"
            value={domeRotationY}
            onChange={(e) => {
              const nextRotationY = parseFloat(e.target.value);
              if (!Number.isFinite(nextRotationY)) return;
              persistDomeSettingsForView({ rotationY: nextRotationY });
            }}
          />

          <label className="text-sm font-medium">Inicio vertical: {Math.round(domeThetaStartDeg)}°</label>
          <input
            className="w-full accent-black"
            type="range"
            min="0"
            max="160"
            step="1"
            value={domeThetaStartDeg}
            onChange={(e) => {
              const nextStart = parseInt(e.target.value, 10);
              if (!Number.isFinite(nextStart)) return;
              updateDomeThetaStart(nextStart);
            }}
          />

          <label className="text-sm font-medium">Abertura vertical: {Math.round(domeThetaLengthDeg)}°</label>
          <input
            className="w-full accent-black"
            type="range"
            min="20"
            max={180 - domeThetaStartDeg}
            step="1"
            value={domeThetaLengthDeg}
            onChange={(e) => {
              const nextLength = parseInt(e.target.value, 10);
              if (!Number.isFinite(nextLength)) return;
              updateDomeThetaLength(nextLength);
            }}
          />

          <div className="mt-2 border-t border-black/10 pt-2" />
          <label className="text-sm font-medium">Rotacao da luz: {Math.round(domeLightRotationDeg)}°</label>
          <input
            className="w-full accent-black"
            type="range"
            min="0"
            max="360"
            step="1"
            value={domeLightRotationDeg}
            onChange={(e) => {
              const nextRotation = parseFloat(e.target.value);
              if (!Number.isFinite(nextRotation)) return;
              persistDomeSettingsForView({
                radius: domeRadius,
                thetaStartDeg: domeThetaStartDeg,
                thetaLengthDeg: domeThetaLengthDeg,
                verticalOffset: domeVerticalOffset,
                lightRotationDeg: nextRotation,
                lightStrength: domeLightStrength,
                lightWorldOpacity: domeLightWorldOpacity,
                lightBlur: domeLightBlur,
              });
            }}
          />

          <label className="text-sm font-medium">Strength: {domeLightStrength.toFixed(2)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min="0"
            max={Math.max(8, Math.ceil(domeLightStrength))}
            step="0.01"
            value={domeLightStrength}
            onChange={(e) => {
              const nextStrength = parseFloat(e.target.value);
              if (!Number.isFinite(nextStrength)) return;
              persistDomeSettingsForView({
                radius: domeRadius,
                thetaStartDeg: domeThetaStartDeg,
                thetaLengthDeg: domeThetaLengthDeg,
                verticalOffset: domeVerticalOffset,
                lightRotationDeg: domeLightRotationDeg,
                lightStrength: nextStrength,
                lightWorldOpacity: domeLightWorldOpacity,
                lightBlur: domeLightBlur,
              });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="0.01"
            min="0"
            value={domeLightStrength}
            onChange={(e) => {
              const nextStrength = parseFloat(e.target.value);
              if (!Number.isFinite(nextStrength)) return;
              persistDomeSettingsForView({ lightStrength: nextStrength });
            }}
          />

          <label className="text-sm font-medium">Cor da luz</label>
          <input
            className="h-9 w-full cursor-pointer rounded border border-black/20 bg-white"
            type="color"
            value={domeLightColor}
            onChange={(e) => {
              const nextColor = String(e.target.value || "");
              persistDomeSettingsForView({ lightColor: nextColor });
            }}
          />

          <label className="text-sm font-medium">Distancia da luz: {Math.round(domeLightDistance)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min="200"
            max={Math.max(4000, Math.ceil(domeLightDistance))}
            step="10"
            value={domeLightDistance}
            onChange={(e) => {
              const nextDistance = parseFloat(e.target.value);
              if (!Number.isFinite(nextDistance)) return;
              persistDomeSettingsForView({ lightDistance: nextDistance });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="10"
            min="1"
            value={domeLightDistance}
            onChange={(e) => {
              const nextDistance = parseFloat(e.target.value);
              if (!Number.isFinite(nextDistance)) return;
              persistDomeSettingsForView({ lightDistance: nextDistance });
            }}
          />

          <label className="text-sm font-medium">World Opacity: {domeLightWorldOpacity.toFixed(2)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min="0"
            max={Math.max(3, Math.ceil(domeLightWorldOpacity))}
            step="0.01"
            value={domeLightWorldOpacity}
            onChange={(e) => {
              const nextWorldOpacity = parseFloat(e.target.value);
              if (!Number.isFinite(nextWorldOpacity)) return;
              persistDomeSettingsForView({
                radius: domeRadius,
                thetaStartDeg: domeThetaStartDeg,
                thetaLengthDeg: domeThetaLengthDeg,
                verticalOffset: domeVerticalOffset,
                lightRotationDeg: domeLightRotationDeg,
                lightStrength: domeLightStrength,
                lightWorldOpacity: nextWorldOpacity,
                lightBlur: domeLightBlur,
              });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="0.01"
            min="0"
            value={domeLightWorldOpacity}
            onChange={(e) => {
              const nextWorldOpacity = parseFloat(e.target.value);
              if (!Number.isFinite(nextWorldOpacity)) return;
              persistDomeSettingsForView({ lightWorldOpacity: nextWorldOpacity });
            }}
          />

          <label className="text-sm font-medium">Blur: {domeLightBlur.toFixed(2)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min="0"
            max={Math.max(10, Math.ceil(domeLightBlur))}
            step="0.01"
            value={domeLightBlur}
            onChange={(e) => {
              const nextBlur = parseFloat(e.target.value);
              if (!Number.isFinite(nextBlur)) return;
              persistDomeSettingsForView({
                radius: domeRadius,
                thetaStartDeg: domeThetaStartDeg,
                thetaLengthDeg: domeThetaLengthDeg,
                verticalOffset: domeVerticalOffset,
                lightRotationDeg: domeLightRotationDeg,
                lightStrength: domeLightStrength,
                lightWorldOpacity: domeLightWorldOpacity,
                lightBlur: nextBlur,
              });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="0.01"
            min="0"
            value={domeLightBlur}
            onChange={(e) => {
              const nextBlur = parseFloat(e.target.value);
              if (!Number.isFinite(nextBlur)) return;
              persistDomeSettingsForView({ lightBlur: nextBlur });
            }}
          />

          <label className="text-sm font-medium">Shadow Bias: {domeShadowBias.toFixed(5)}</label>
          <input
            className="w-full accent-black"
            type="range"
            min={-Math.max(0.01, Math.abs(domeShadowBias))}
            max={Math.max(0.01, Math.abs(domeShadowBias))}
            step="0.00001"
            value={domeShadowBias}
            onChange={(e) => {
              const nextBias = parseFloat(e.target.value);
              if (!Number.isFinite(nextBias)) return;
              persistDomeSettingsForView({ shadowBias: nextBias });
            }}
          />
          <input
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            type="number"
            step="0.00001"
            value={domeShadowBias}
            onChange={(e) => {
              const nextBias = parseFloat(e.target.value);
              if (!Number.isFinite(nextBias)) return;
              persistDomeSettingsForView({ shadowBias: nextBias });
            }}
          />
        </div>
      </CustomDialog>
      <CustomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Editar Hotspot"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        onConfirm={updateHotspot}
        nonModal
        closeOnInteractOutside={false}
        overlayClassName="bg-transparent pointer-events-none"
        contentClassName="!left-auto !top-auto !right-4 !bottom-4 !translate-x-0 !translate-y-0 !w-[520px] max-w-[92vw] max-h-[78vh] p-4"
        bodyClassName="max-h-[58vh] pr-1"
      >
        {selectedHotspot && (
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium">Tipo:</label>
            <DropdownSingle
              label={tipos.find(t => t.value === editTipo)?.label || "Seleciona o tipo"}
              selectlabel="Tipo de Hotspot"
              items={tipos}
              onSelect={(value) => setEditTipo(value)}
              className="mt-1"
            />

            <label className="text-sm font-medium">Conteúdo:</label>
            {editTipo === "modelo3d" ? (
              <MediaSourceField
                label="Modelo 3D (GLB/GLTF)"
                accept=".glb,.gltf,model/gltf+json,model/gltf-binary"
                selection={editModelSelection}
                onChange={(selection) => {
                  setEditModelSelection(selection);
                  if (!selection) {
                    setEditConteudo("");
                    return;
                  }

                  if (selection.source === "library") {
                    setEditConteudo(selection.url || resolveUploadsUrl(selection.path || "") || "");
                    return;
                  }

                  setEditConteudo(selection.file?.name || "");
                }}
                destinationPath="modelos3d"
                helperText="Escolhe ou envia um ficheiro GLB/GLTF no File Manager para importar no A-Frame."
              />
            ) : (
              <input
                type="text"
                value={editConteudo}
                onChange={(e) => setEditConteudo(e.target.value)}
                disabled={editTipo === "navegacao"}
                className="border rounded px-2 py-1 dark:bg-black"
              />
            )}

            <label className="text-sm font-medium mt-2">Posição X: {(Number(editX) || 0).toFixed(1)}</label>
            <input
              type="range"
              min={positionSliderMin}
              max={positionSliderMax}
              step="0.1"
              value={Number(editX) || 0}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (!Number.isFinite(next)) return;
                setPositionAndAnglesFromXYZ(next, editY, editZ);
              }}
              className="w-full accent-black"
            />

            <label className="text-sm font-medium">Posição Y: {(Number(editY) || 0).toFixed(1)}</label>
            <input
              type="range"
              min={positionSliderMin}
              max={positionSliderMax}
              step="0.1"
              value={Number(editY) || 0}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (!Number.isFinite(next)) return;
                setPositionAndAnglesFromXYZ(editX, next, editZ);
              }}
              className="w-full accent-black"
            />

            <label className="text-sm font-medium">Posição Z: {(Number(editZ) || 0).toFixed(1)}</label>
            <input
              type="range"
              min={positionSliderMin}
              max={positionSliderMax}
              step="0.1"
              value={Number(editZ) || 0}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (!Number.isFinite(next)) return;
                setPositionAndAnglesFromXYZ(editX, editY, next);
              }}
              className="w-full accent-black"
            />

            <label className="text-sm font-medium mt-2">Rotação horizontal (Yaw): {Math.round(editYaw)}°</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={editYaw}
              onChange={(e) => {
                const nextYaw = parseFloat(e.target.value);
                if (!Number.isFinite(nextYaw)) return;
                setEditYaw(nextYaw);
              }}
              className="w-full accent-black"
            />

            <label className="text-sm font-medium">Rotação vertical (Pitch): {Math.round(editPitch)}°</label>
            <input
              type="range"
              min="-80"
              max="80"
              step="1"
              value={editPitch}
              onChange={(e) => {
                const nextPitch = parseFloat(e.target.value);
                if (!Number.isFinite(nextPitch)) return;
                setEditPitch(nextPitch);
              }}
              className="w-full accent-black"
            />

            <label className="text-sm font-medium">Distância ao centro: {Math.round(editRadius)}</label>
            <input
              type="range"
              min="100"
              max={domeRadius}
              step="1"
              value={editRadius}
              onChange={(e) => {
                const nextRadius = parseFloat(e.target.value);
                if (!Number.isFinite(nextRadius)) return;
                setPositionFromRadius(nextRadius);
              }}
              className="w-full accent-black"
            />

            <label className="text-sm font-medium">Escala do hotspot: {(Number(editScale) || 1).toFixed(2)}x</label>
            <input
              type="range"
              min="0.4"
              max={Math.max(20, Math.ceil(Number(editScale) || 1))}
              step="0.05"
              value={Number(editScale) || 1}
              onChange={(e) => {
                const nextScale = parseFloat(e.target.value);
                if (!Number.isFinite(nextScale)) return;
                setEditScale(Math.max(HOTSPOT_SCALE_MIN, nextScale));
              }}
              className="w-full accent-black"
            />
            <input
              type="number"
              min="0.4"
              step="0.05"
              value={(Number(editScale) || 1).toFixed(2)}
              onChange={(e) => {
                const nextScale = parseFloat(e.target.value);
                if (!Number.isFinite(nextScale)) return;
                setEditScale(Math.max(HOTSPOT_SCALE_MIN, nextScale));
              }}
              className="border rounded px-2 py-1 dark:bg-black"
            />

            {editTipo === "navegacao" && (
              <>
                <label className="text-sm font-medium mt-2">Destino de navegação:</label>
                <DropdownSingle
                  label={
                    editNavigationMode === "back"
                      ? "Anterior"
                      : (editNavigationMode === "point" ? "Outro ponto" : "Proxima vista (HDR/EXR)")
                  }
                  selectlabel="Destino"
                  items={[
                    { label: "Proxima vista (HDR/EXR)", value: "file" },
                    { label: "Outro ponto", value: "point" },
                    { label: "Anterior", value: "back" },
                  ]}
                  onSelect={(value) => {
                    setEditNavigationMode(value);
                    if (value === "back") {
                      setEditPontoDestino("");
                      setEditNavigationSelection(null);
                      setEditNavigationPath("");
                      return;
                    }
                    if (value === "point") {
                      setEditNavigationSelection(null);
                      setEditNavigationPath("");
                      return;
                    }
                    setEditPontoDestino("");
                  }}
                  className="mt-1"
                />

                {editNavigationMode === "file" && (
                  <>
                    <label className="text-sm font-medium mt-2">Vista (HDR/EXR):</label>
                    <MediaSourceField
                      label="Ficheiro de navegação"
                      accept="image/*,.hdr,.exr"
                      selection={editNavigationSelection}
                      onChange={(selection) => {
                        setEditNavigationSelection(selection);
                        setEditPontoDestino("");
                        setEditNavigationMode("file");
                      }}
                      destinationPath="pontos"
                      helperText="Escolhe ou envia um HDR/EXR para navegar entre vistas dentro deste ponto inicial."
                    />
                  </>
                )}

                {editNavigationMode === "point" && (
                  <>
                    <label className="text-sm font-medium mt-2">Ponto de destino:</label>
                    <DropdownSingle
                      label={destinoLabel}
                      selectlabel="Pontos disponíveis"
                      items={pontosDestino}
                      onSelect={(value) => {
                        setEditPontoDestino(value);
                        setEditNavigationPath("");
                        setEditNavigationSelection(null);
                        setEditNavigationMode("point");
                      }}
                      className="mt-1"
                    />
                  </>
                )}

                {editNavigationMode === "back" && (
                  <div className="mt-2 text-xs text-neutral-600">
                    Este hotspot volta para a vista anterior (histórico local).
                  </div>
                )}

                {editNavigationMode !== "back" && (!!editPontoDestino || !!editNavigationSelection || !!editNavigationPath) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditPontoDestino("");
                      setEditNavigationSelection(null);
                      setEditNavigationPath("");
                      setEditNavigationMode("file");
                    }}
                    className="self-start text-xs text-red-600 hover:underline"
                  >
                    Remover destino de navegação
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </CustomDialog>
    </div>
  );
};

export default dynamic(() => Promise.resolve(AFrameViewer), { ssr: false });