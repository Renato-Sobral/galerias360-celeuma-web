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
import { getUserRoleFromToken, getUserRoleIdFromToken } from "./jwtDecode";

const AFrameViewer = ({ environment, enableContextMenu = false, pontoId, navigateOnHotspot = false }) => {
  const API_BASE =
    (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL.trim())
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
      : "";

  const userRole = useMemo(() => getUserRoleFromToken(), []);
  const userRoleId = useMemo(() => Number(getUserRoleIdFromToken()), []);

  const canManageHotspots = useMemo(() => {
    if (Number.isInteger(userRoleId)) {
      return userRoleId !== 2;
    }

    if (!userRole) return false;
    return userRole !== "User";
  }, [userRole, userRoleId]);

  const showEditContextMenu = enableContextMenu && canManageHotspots;

  const buildApiUrl = (path) => {
    if (!API_BASE) return path;
    return `${API_BASE}${path}`;
  };

  const LEGACY_POINT_PREFIX = "ponto:";
  const NAV_POINT_PREFIX = "nav:ponto:";
  const NAV_FILE_PREFIX = "nav:file:";
  const NAV_BACK_VALUE = "nav:back";
  const HOTSPOT_META_PREFIX = "hsmeta:";
  const IMAGE4P_PREFIX = "img4p:";
  const INSPECT3D_PREFIX = "insp3d:";
  const HOTSPOT_SCALE_MIN = 0.2;
  const DEFAULT_PANORAMA_DOME_RADIUS = 700;
  const DEFAULT_DOME_ROTATION_Y = -130;
  const DEFAULT_DOME_ROTATION_X = 0;
  const DEFAULT_DOME_ROTATION_Z = 0;
  const DEFAULT_DOME_MIRROR_X = false;
  const DEFAULT_DOME_MIRROR_Y = false;
  const DEFAULT_AMBIENT_LIGHT_INTENSITY = 1.5;
  const DEFAULT_POINT_LIGHT_INTENSITY = 1;
  const DEFAULT_POINT_LIGHT_COLOR = "#ffffff";
  const DEFAULT_POINT_LIGHT_DISTANCE = 2200;
  const DEFAULT_POINT_LIGHT_SHADOW_BIAS = -0.00015;
  const DEFAULT_MODEL_CONTACT_SHADOW_OPACITY = 0.34;
  const MODEL_CONTACT_SHADOW_MIN_RADIUS = 0.3;
  const MODEL_CONTACT_SHADOW_GROUND_SCALE = 1.25;
  const MODEL_CONTACT_SHADOW_DOME_SCALE = 1.2;
  const DOME_LIGHT_RADIUS = 45;
  const DOME_LIGHT_HEIGHT = 35;
  const DEFAULT_POINT_LIGHT_POSITION = `0 ${DOME_LIGHT_HEIGHT.toFixed(2)} ${DOME_LIGHT_RADIUS.toFixed(2)}`;

  const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp01 = (value, fallback = 0) => {
    const numeric = toFiniteNumber(value, fallback);
    return Math.max(0, Math.min(1, numeric));
  };

  const createContactShadowMesh = (THREE, opacity) => {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -95;
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  const disposeContactShadowMesh = (mesh) => {
    if (!mesh) return;
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    mesh.geometry?.dispose?.();
    mesh.material?.dispose?.();
  };

  const applyContactShadow = ({ THREE, entityObject3D, mesh, opacity, radius }) => {
    let targetMesh = mesh;
    if (!targetMesh) {
      targetMesh = createContactShadowMesh(THREE, opacity);
      entityObject3D.add(targetMesh);
    }

    targetMesh.scale.setScalar(radius);
    targetMesh.position.set(0, 0.02, 0);
    targetMesh.material.opacity = opacity;

    return targetMesh;
  };

  const applyModelShadowFlags = (modelMesh) => {
    modelMesh.traverse((child) => {
      if (!child?.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  };

  const getModelHotspotPlacement = (hotspot, currentFloorY) => {
    const placement = String(hotspot?.placement || "");
    const isGround = placement === "ground" || Math.abs(toFiniteNumber(hotspot?.y, 0) - currentFloorY) <= 0.001;
    return { placement, isGround };
  };

  const encodeDestinationPointContent = (targetPontoId) => `${NAV_POINT_PREFIX}${targetPontoId}`;
  const encodeDestinationFileContent = (targetFilePath) => `${NAV_FILE_PREFIX}${targetFilePath}`;
  const encodeDestinationBackContent = () => NAV_BACK_VALUE;

  const encodeHotspotContent = (rawValue, viewPath, scale = 1, rotYaw = 0, rotPitch = 0, placement = "") => {
    const payload = {
      value: String(rawValue || ""),
      view: String(viewPath || "").replace(/^\/+/, ""),
      scale: Number.isFinite(Number(scale))
        ? Math.max(HOTSPOT_SCALE_MIN, Number(scale))
        : 1,
      rotYaw: Number.isFinite(Number(rotYaw)) ? Number(rotYaw) : 0,
      rotPitch: Number.isFinite(Number(rotPitch)) ? Number(rotPitch) : 0,
      placement: String(placement || ""),
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
      return { value, view: "", scale: 1, rotYaw: 0, rotPitch: 0, placement: "" };
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
        placement: String(parsed?.placement || ""),
      };
    } catch {
      return { value, view: "", scale: 1, rotYaw: 0, rotPitch: 0, placement: "" };
    }
  };

  const encodeImage4pValue = (payload) => {
    const safePayload = {
      src: String(payload?.src || ""),
      points: Array.isArray(payload?.points) ? payload.points : [],
      opacity: Number.isFinite(Number(payload?.opacity)) ? Number(payload.opacity) : 1,
      brightness: Number.isFinite(Number(payload?.brightness)) ? Number(payload.brightness) : 1,
      inset: Number.isFinite(Number(payload?.inset)) ? Number(payload.inset) : 0.6,
      rotateDeg: Number.isFinite(Number(payload?.rotateDeg)) ? Number(payload.rotateDeg) : 0,
      flipX: Boolean(payload?.flipX),
      flipY: Boolean(payload?.flipY),
      depthMode: payload?.depthMode === "occlusion-mask" ? "occlusion-mask" : "none",
      occlusionMaskPoints: Array.isArray(payload?.occlusionMaskPoints) ? payload.occlusionMaskPoints : [],
      occlusionMaskInset: Number.isFinite(Number(payload?.occlusionMaskInset)) ? Number(payload.occlusionMaskInset) : 0,
    };

    try {
      return `${IMAGE4P_PREFIX}${btoa(unescape(encodeURIComponent(JSON.stringify(safePayload))))}`;
    } catch {
      return "";
    }
  };

  const decodeImage4pValue = (rawValue) => {
    const value = String(rawValue || "");
    if (!value.startsWith(IMAGE4P_PREFIX)) return null;

    try {
      const encoded = value.slice(IMAGE4P_PREFIX.length);
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json);
      const points = Array.isArray(parsed?.points) ? parsed.points : [];
      return {
        src: String(parsed?.src || ""),
        points: points
          .map((p) => ({
            x: Number(p?.x),
            y: Number(p?.y),
            z: Number(p?.z),
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)),
        opacity: Number.isFinite(Number(parsed?.opacity)) ? Number(parsed.opacity) : 1,
        brightness: Number.isFinite(Number(parsed?.brightness)) ? Number(parsed.brightness) : 1,
        inset: Number.isFinite(Number(parsed?.inset)) ? Number(parsed.inset) : 0.6,
        rotateDeg: Number.isFinite(Number(parsed?.rotateDeg)) ? Number(parsed.rotateDeg) : 0,
        flipX: Boolean(parsed?.flipX),
        flipY: Boolean(parsed?.flipY),
        depthMode: parsed?.depthMode === "occlusion-mask" ? "occlusion-mask" : "none",
        occlusionMaskPoints: (Array.isArray(parsed?.occlusionMaskPoints) ? parsed.occlusionMaskPoints : [])
          .map((p) => ({
            x: Number(p?.x),
            y: Number(p?.y),
            z: Number(p?.z),
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)),
        occlusionMaskInset: Number.isFinite(Number(parsed?.occlusionMaskInset)) ? Number(parsed.occlusionMaskInset) : 0,
      };
    } catch {
      return null;
    }
  };

  const encodeInspect3dValue = (payload) => {
    const safePayload = {
      src: String(payload?.src || ""),
      rotationSpeed: Number.isFinite(Number(payload?.rotationSpeed)) ? Number(payload.rotationSpeed) : 1,
      axis: ["x", "y", "z"].includes(payload?.axis) ? payload.axis : "y",
      buttons: Array.isArray(payload?.buttons) ? payload.buttons : [],
    };

    try {
      return `${INSPECT3D_PREFIX}${btoa(unescape(encodeURIComponent(JSON.stringify(safePayload))))}`;
    } catch {
      return "";
    }
  };

  const decodeInspect3dValue = (rawValue) => {
    const value = String(rawValue || "");
    if (!value.startsWith(INSPECT3D_PREFIX)) return null;

    try {
      const encoded = value.slice(INSPECT3D_PREFIX.length);
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json);
      return {
        src: String(parsed?.src || ""),
        rotationSpeed: Number.isFinite(Number(parsed?.rotationSpeed)) ? Number(parsed.rotationSpeed) : 1,
        axis: ["x", "y", "z"].includes(parsed?.axis) ? parsed.axis : "y",
        buttons: Array.isArray(parsed?.buttons) ? parsed.buttons : [],
      };
    } catch {
      return null;
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
  const panoramaNodeRef = useRef(null);
  const groundPlaneRef = useRef(null);
  const ambientLightRef = useRef(null);
  const pointLightRef = useRef(null);
  const [hotspots, setHotspots] = useState([]);
  const clickEventRef = useRef(null);
  const image4pMagnifierCanvasRef = useRef(null);
  const image4pMagnifierCursorBoxRef = useRef(null);
  const image4pMagnifierPointerRef = useRef({ clientX: 0, clientY: 0, active: false });
  const image4pMagnifierRafRef = useRef(null);
  const image4pMagnifierCORSBlockedRef = useRef(false);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStep, setEditStep] = useState("type");
  const [domeDialogOpen, setDomeDialogOpen] = useState(false);
  const [showAlignmentGuides, setShowAlignmentGuides] = useState(true);
  const [alignmentGuidesOpacity, setAlignmentGuidesOpacity] = useState(0.65);
  const [editTipo, setEditTipo] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const [editX, setEditX] = useState(0);
  const [editY, setEditY] = useState(0);
  const [editZ, setEditZ] = useState(0);
  const [editStickToGround, setEditStickToGround] = useState(false);
  const [editHideIcon, setEditHideIcon] = useState(false);
  const [editYaw, setEditYaw] = useState(0);
  const [editPitch, setEditPitch] = useState(0);
  const [domeRadius, setDomeRadius] = useState(DEFAULT_PANORAMA_DOME_RADIUS);
  const [domeVerticalOffset, setDomeVerticalOffset] = useState(0);
  const [domeRotationX, setDomeRotationX] = useState(DEFAULT_DOME_ROTATION_X);
  const [domeRotationY, setDomeRotationY] = useState(DEFAULT_DOME_ROTATION_Y);
  const [domeRotationZ, setDomeRotationZ] = useState(DEFAULT_DOME_ROTATION_Z);
  const [domeMirrorX, setDomeMirrorX] = useState(DEFAULT_DOME_MIRROR_X);
  const [domeMirrorY, setDomeMirrorY] = useState(DEFAULT_DOME_MIRROR_Y);
  const [cameraAlignmentBase, setCameraAlignmentBase] = useState({ pitch: 0, yaw: 0 });
  const [editRadius, setEditRadius] = useState(DEFAULT_PANORAMA_DOME_RADIUS);
  const [editScale, setEditScale] = useState(1);
  const [editPlacement, setEditPlacement] = useState("");
  const [editPontoDestino, setEditPontoDestino] = useState("");
  const [editNavigationSelection, setEditNavigationSelection] = useState(null);
  const [editNavigationPath, setEditNavigationPath] = useState("");
  const [editNavigationMode, setEditNavigationMode] = useState("file");
  const [editModelSelection, setEditModelSelection] = useState(null);
  const [editImageSelection, setEditImageSelection] = useState(null);
  const [editImage4pSelection, setEditImage4pSelection] = useState(null);
  const [editImage4pPreviewUrl, setEditImage4pPreviewUrl] = useState("");
  const [editImage4pPoints, setEditImage4pPoints] = useState([]);
  const [editImage4pOpacity, setEditImage4pOpacity] = useState(1);
  const [editImage4pBrightness, setEditImage4pBrightness] = useState(1);
  const [editImage4pInset, setEditImage4pInset] = useState(0.6);
  const [editImage4pRotateDeg, setEditImage4pRotateDeg] = useState(0);
  const [editImage4pFlipX, setEditImage4pFlipX] = useState(false);
  const [editImage4pFlipY, setEditImage4pFlipY] = useState(false);
  const [editImage4pDepthMode, setEditImage4pDepthMode] = useState("none");
  const [editImage4pOcclusionMaskPoints, setEditImage4pOcclusionMaskPoints] = useState([]);
  const [editImage4pOcclusionMaskInset, setEditImage4pOcclusionMaskInset] = useState(0);
  const [inspectModeHotspotId, setInspectModeHotspotId] = useState(null);
  const [editInspect3dSrc, setEditInspect3dSrc] = useState(null);
  const [editInspect3dRotationSpeed, setEditInspect3dRotationSpeed] = useState(1);
  const [editInspect3dAxis, setEditInspect3dAxis] = useState("y");
  const [editInspect3dButtons, setEditInspect3dButtons] = useState([]);
  const [isCapturingImage4pPoints, setIsCapturingImage4pPoints] = useState(false);
  const [isCapturingImage4pMaskPoints, setIsCapturingImage4pMaskPoints] = useState(false);
  const [isPickingGroundPosition, setIsPickingGroundPosition] = useState(false);
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
    { label: "Imagem (4 pontos)", value: "imagem4p" },
    { label: "Modelo 3D", value: "modelo3d" },
    { label: "Modelo 3D (Inspect)", value: "modelo3d_inspect" },
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
  const floorY = Number(domeVerticalOffset) || 0;

  const normalizeDomeSettings = (settings) => {
    const baseRadius = Number(settings?.radius);
    const baseVerticalOffset = Number(settings?.verticalOffset);

    const radius = Number.isFinite(baseRadius)
      ? Math.max(50, baseRadius)
      : DEFAULT_PANORAMA_DOME_RADIUS;

    const verticalOffset = Number.isFinite(baseVerticalOffset)
      ? baseVerticalOffset
      : 0;

    const baseRotationX = Number(settings?.rotationX);
    const baseRotationY = Number(settings?.rotationY);
    const baseRotationZ = Number(settings?.rotationZ);
    const rotationX = Number.isFinite(baseRotationX)
      ? clamp(baseRotationX, -360, 360)
      : DEFAULT_DOME_ROTATION_X;
    const rotationY = Number.isFinite(baseRotationY)
      ? clamp(baseRotationY, -360, 360)
      : DEFAULT_DOME_ROTATION_Y;
    const rotationZ = Number.isFinite(baseRotationZ)
      ? clamp(baseRotationZ, -360, 360)
      : DEFAULT_DOME_ROTATION_Z;
    const mirrorX = typeof settings?.mirrorX === "boolean"
      ? settings.mirrorX
      : DEFAULT_DOME_MIRROR_X;
    const mirrorY = typeof settings?.mirrorY === "boolean"
      ? settings.mirrorY
      : DEFAULT_DOME_MIRROR_Y;

    return {
      radius,
      verticalOffset,
      rotationX,
      rotationY,
      rotationZ,
      mirrorX,
      mirrorY,
    };
  };

  const persistDomeSettingsForView = (nextSettings) => {
    const normalized = normalizeDomeSettings({
      radius: domeRadius,
      verticalOffset: domeVerticalOffset,
      rotationX: domeRotationX,
      rotationY: domeRotationY,
      rotationZ: domeRotationZ,
      mirrorX: domeMirrorX,
      mirrorY: domeMirrorY,
      ...(nextSettings || {}),
    });
    setDomeRadius(normalized.radius);
    setDomeVerticalOffset(normalized.verticalOffset);
    setDomeRotationX(normalized.rotationX);
    setDomeRotationY(normalized.rotationY);
    setDomeRotationZ(normalized.rotationZ);
    setDomeMirrorX(normalized.mirrorX);
    setDomeMirrorY(normalized.mirrorY);
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
    setDomeVerticalOffset(normalized.verticalOffset);
    setDomeRotationX(normalized.rotationX);
    setDomeRotationY(normalized.rotationY);
    setDomeRotationZ(normalized.rotationZ);
    setDomeMirrorX(normalized.mirrorX);
    setDomeMirrorY(normalized.mirrorY);
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
    const ny = editStickToGround ? floorY : Number(y);
    const nz = Number(z);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return;

    const spherical = toSpherical(nx, ny, nz);
    setEditX(nx);
    setEditY(ny);
    setEditZ(nz);
    setEditRadius(spherical.radius);
  };

  useEffect(() => {
    if (!editStickToGround) return;
    setEditY(floorY);
    setEditPlacement("ground");
  }, [editStickToGround, floorY]);

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

  const normalizeSigned180Deg = (angleDeg) => {
    let angle = Number(angleDeg) || 0;
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  };



  useEffect(() => {
    setEditRadius((prev) => clamp(prev, 10, domeRadius));
  }, [domeRadius]);

  useEffect(() => {
    if (editTipo !== "imagem4p" || !editDialogOpen) {
      setIsCapturingImage4pPoints(false);
      setIsCapturingImage4pMaskPoints(false);
    }
  }, [editDialogOpen, editTipo]);



  useEffect(() => {
    if (!editDialogOpen || !editStickToGround) {
      setIsPickingGroundPosition(false);
    }
  }, [editDialogOpen, editStickToGround]);

  useEffect(() => {
    return () => {
      if (typeof editImage4pPreviewUrl === "string" && editImage4pPreviewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(editImage4pPreviewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [editImage4pPreviewUrl]);

  useEffect(() => {
    if (!editDialogOpen) return;
    if (editTipo !== "imagem4p") return;

    const encoded = encodeImage4pValue({
      src: editImage4pPreviewUrl,
      points: editImage4pPoints,
      opacity: editImage4pOpacity,
      brightness: editImage4pBrightness,
      inset: editImage4pInset,
      rotateDeg: editImage4pRotateDeg,
      flipX: editImage4pFlipX,
      flipY: editImage4pFlipY,
      depthMode: editImage4pDepthMode,
      occlusionMaskPoints: editImage4pOcclusionMaskPoints,
      occlusionMaskInset: editImage4pOcclusionMaskInset,
    });

    setEditConteudo(encoded);
  }, [
    editDialogOpen,
    editTipo,
    editImage4pPreviewUrl,
    editImage4pPoints,
    editImage4pOpacity,
    editImage4pBrightness,
    editImage4pInset,
    editImage4pRotateDeg,
    editImage4pFlipX,
    editImage4pFlipY,
    editImage4pDepthMode,
    editImage4pOcclusionMaskPoints,
    editImage4pOcclusionMaskInset,
  ]);

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

      const previewX = Number(editX);
      const previewY = editStickToGround ? floorY : Number(editY);
      const previewZ = Number(editZ);

      if (editTipo === "navegacao") {
        const isBack = editNavigationMode === "back";
        return {
          ...hotspot,
          x: previewX,
          y: previewY,
          z: previewZ,
          rot_yaw: Number(editYaw) || 0,
          rot_pitch: Number(editPitch) || 0,
          scale: Number(editScale),
          placement: String((editStickToGround ? "ground" : editPlacement) || hotspot.placement || ""),
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
        x: previewX,
        y: previewY,
        z: previewZ,
        rot_yaw: Number(editYaw) || 0,
        rot_pitch: Number(editPitch) || 0,
        scale: Number(editScale),
        placement: String((editStickToGround ? "ground" : editPlacement) || hotspot.placement || ""),
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
    editStickToGround,
    floorY,
    editYaw,
    editPitch,
    editScale,
    editPlacement,
    editPontoDestino,
    editNavigationPath,
    editNavigationSelection,
    editNavigationMode,
  ]);

  const warpOverlays = useMemo(() => {
    return (Array.isArray(previewHotspots) ? previewHotspots : [])
      .filter((h) => String(h?.tipo || "") === "imagem4p")
      .map((h) => {
        const payload = decodeImage4pValue(h?.conteudo);
        return payload
          ? {
            id: h.id,
            src: payload.src,
            points: payload.points,
            opacity: payload.opacity,
            brightness: payload.brightness,
            inset: payload.inset,
            rotateDeg: payload.rotateDeg,
            flipX: payload.flipX,
            flipY: payload.flipY,
            depthMode: payload.depthMode,
            occlusionMaskPoints: payload.occlusionMaskPoints,
            occlusionMaskInset: payload.occlusionMaskInset,
          }
          : null;
      })
      .filter(Boolean);
  }, [previewHotspots]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const AFRAME = window.AFRAME;
    const THREE = window.THREE;
    if (!AFRAME || !THREE) return;

    if (!AFRAME.components["inspect-3d"]) {
      AFRAME.registerComponent("inspect-3d", {
        schema: {
          axis: { type: "string", default: "y" },
          speed: { type: "number", default: 1 },
          isInspecting: { type: "boolean", default: false }
        },
        init() {
          this.baseRotation = new THREE.Euler().copy(this.el.object3D.rotation);
          this.basePosition = new THREE.Vector3().copy(this.el.object3D.position);
          this.baseScale = new THREE.Vector3().copy(this.el.object3D.scale);

          this.dragRotation = new THREE.Euler(0, 0, 0);
          this.isDragging = false;
          this.previousMousePosition = { x: 0, y: 0 };

          this.idleRotationOffset = 0;

          this.onMouseDown = (e) => {
            if (!this.data.isInspecting) return;
            this.isDragging = true;
            this.previousMousePosition.x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            this.previousMousePosition.y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
          };
          this.onMouseUp = () => { this.isDragging = false; };
          this.onMouseMove = (e) => {
            if (!this.isDragging || !this.data.isInspecting) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

            const deltaX = clientX - this.previousMousePosition.x;
            const deltaY = clientY - this.previousMousePosition.y;

            this.previousMousePosition = { x: clientX, y: clientY };

            this.dragRotation.y += deltaX * 0.01;
            this.dragRotation.x += deltaY * 0.01;
          };

          this.onMouseDownBound = this.onMouseDown.bind(this);
          this.onMouseUpBound = this.onMouseUp.bind(this);
          this.onMouseMoveBound = this.onMouseMove.bind(this);

          window.addEventListener("mousedown", this.onMouseDownBound);
          window.addEventListener("mouseup", this.onMouseUpBound);
          window.addEventListener("mousemove", this.onMouseMoveBound);
          window.addEventListener("touchstart", this.onMouseDownBound, { passive: true });
          window.addEventListener("touchend", this.onMouseUpBound);
          window.addEventListener("touchmove", this.onMouseMoveBound, { passive: true });
        },
        update(oldData) {
          if (this.data.isInspecting !== oldData.isInspecting) {
            const sceneEl = this.el.sceneEl;
            if (!sceneEl || !sceneEl.camera) return;
            const cameraEl = sceneEl.camera.el;

            if (this.data.isInspecting) {
              if (cameraEl.components["look-controls"]) {
                cameraEl.setAttribute("look-controls", "enabled", false);
              }
              const cameraWorldPos = new THREE.Vector3();
              const cameraWorldDir = new THREE.Vector3();
              sceneEl.camera.getWorldPosition(cameraWorldPos);
              sceneEl.camera.getWorldDirection(cameraWorldDir);

              this.targetPosition = new THREE.Vector3().copy(cameraWorldPos).add(cameraWorldDir.multiplyScalar(2));
              this.dragRotation.set(0, 0, 0);
            } else {
              if (cameraEl.components["look-controls"]) {
                cameraEl.setAttribute("look-controls", "enabled", true);
              }
              this.targetPosition = new THREE.Vector3().copy(this.basePosition);
              this.idleRotationOffset = 0;
            }
          }
        },
        tick(time, timeDelta) {
          if (!this.targetPosition) this.targetPosition = new THREE.Vector3().copy(this.basePosition);

          if (this.data.isInspecting) {
            this.el.object3D.position.lerp(this.targetPosition, 0.05);

            // Smooth rotation targeting based on drag
            const targetEuler = new THREE.Euler(
              this.baseRotation.x + this.dragRotation.x,
              this.baseRotation.y + this.dragRotation.y,
              this.baseRotation.z + this.dragRotation.z
            );

            this.el.object3D.rotation.x += (targetEuler.x - this.el.object3D.rotation.x) * 0.1;
            this.el.object3D.rotation.y += (targetEuler.y - this.el.object3D.rotation.y) * 0.1;
            this.el.object3D.rotation.z += (targetEuler.z - this.el.object3D.rotation.z) * 0.1;

          } else {
            this.el.object3D.position.lerp(this.basePosition, 0.05);
            const rSpeed = this.data.speed * (timeDelta / 1000) || 0;
            this.idleRotationOffset += rSpeed;

            const targetEuler = new THREE.Euler().copy(this.baseRotation);
            if (this.data.axis === 'x') targetEuler.x += this.idleRotationOffset;
            else if (this.data.axis === 'z') targetEuler.z += this.idleRotationOffset;
            else targetEuler.y += this.idleRotationOffset;

            this.el.object3D.rotation.x += (targetEuler.x - this.el.object3D.rotation.x) * 0.1;
            this.el.object3D.rotation.y += (targetEuler.y - this.el.object3D.rotation.y) * 0.1;
            this.el.object3D.rotation.z += (targetEuler.z - this.el.object3D.rotation.z) * 0.1;
          }
        },
        remove() {
          window.removeEventListener("mousedown", this.onMouseDownBound);
          window.removeEventListener("mouseup", this.onMouseUpBound);
          window.removeEventListener("mousemove", this.onMouseMoveBound);
          window.removeEventListener("touchstart", this.onMouseDownBound);
          window.removeEventListener("touchend", this.onMouseUpBound);
          window.removeEventListener("touchmove", this.onMouseMoveBound);
        }
      });
    }

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

    if (!AFRAME.components["ground-model-on-dome"]) {
      AFRAME.registerComponent("ground-model-on-dome", {
        schema: {
          centerY: { type: "number", default: 0 },
          inset: { type: "number", default: 1.5 },
          contactShadow: { type: "number", default: DEFAULT_MODEL_CONTACT_SHADOW_OPACITY },
        },
        init() {
          this.boundingBox = new THREE.Box3();
          this.size = new THREE.Vector3();
          this.parentWorld = new THREE.Vector3();
          this.center = new THREE.Vector3();
          this.inward = new THREE.Vector3();
          this.contactShadowMesh = null;
          this.applyGrounding = this.applyGrounding.bind(this);
          this.el.addEventListener("model-loaded", this.applyGrounding);
          this.applyGrounding();
        },
        remove() {
          this.el.removeEventListener("model-loaded", this.applyGrounding);
          disposeContactShadowMesh(this.contactShadowMesh);
          this.contactShadowMesh = null;
        },
        applyGrounding() {
          const mesh = this.el.getObject3D("mesh");
          if (!mesh) return;

          mesh.updateMatrixWorld(true);
          this.boundingBox.setFromObject(mesh);
          if (this.boundingBox.isEmpty()) return;

          this.boundingBox.getSize(this.size);

          const radius = Math.max(this.size.x, this.size.z) * 0.5;
          const contactShadowRadius = Math.max(MODEL_CONTACT_SHADOW_MIN_RADIUS, radius * MODEL_CONTACT_SHADOW_DOME_SCALE);
          const contactShadowOpacity = clamp01(
            this.data.contactShadow,
            DEFAULT_MODEL_CONTACT_SHADOW_OPACITY
          );
          this.contactShadowMesh = applyContactShadow({
            THREE,
            entityObject3D: this.el.object3D,
            mesh: this.contactShadowMesh,
            opacity: contactShadowOpacity,
            radius: contactShadowRadius,
          });

          const parentObject = this.el.parentEl?.object3D;
          if (parentObject) {
            parentObject.getWorldPosition(this.parentWorld);
          } else {
            this.el.object3D.getWorldPosition(this.parentWorld);
          }

          this.center.set(0, Number(this.data.centerY) || 0, 0);
          this.inward.subVectors(this.center, this.parentWorld);
          if (this.inward.lengthSq() < 1e-6) {
            this.inward.set(0, 1, 0);
          } else {
            this.inward.normalize();
          }

          this.el.object3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.inward);

          const inwardInset = Math.max(0, Number(this.data.inset) || 0);
          this.el.object3D.position.set(0, inwardInset, 0);

          applyModelShadowFlags(mesh);
        },
      });
    }

    if (!AFRAME.components["ground-model-on-floor"]) {
      AFRAME.registerComponent("ground-model-on-floor", {
        schema: {
          contactShadow: { type: "number", default: DEFAULT_MODEL_CONTACT_SHADOW_OPACITY },
        },
        init() {
          this.boundingBox = new THREE.Box3();
          this.center = new THREE.Vector3();
          this.size = new THREE.Vector3();
          this.appliedOffset = new THREE.Vector3();
          this.contactShadowMesh = null;
          this.applyGrounding = this.applyGrounding.bind(this);
          this.el.addEventListener("model-loaded", this.applyGrounding);
          this.applyGrounding();
        },
        remove() {
          this.el.removeEventListener("model-loaded", this.applyGrounding);
          disposeContactShadowMesh(this.contactShadowMesh);
          this.contactShadowMesh = null;
        },
        applyGrounding() {
          const mesh = this.el.getObject3D("mesh");
          if (!mesh) return;

          // Remove previous offset before recalculating to avoid cumulative drift.
          mesh.position.add(this.appliedOffset);
          this.appliedOffset.set(0, 0, 0);

          mesh.updateMatrixWorld(true);
          this.boundingBox.setFromObject(mesh);
          if (this.boundingBox.isEmpty()) return;

          this.boundingBox.getCenter(this.center);
          this.boundingBox.getSize(this.size);
          const minY = this.boundingBox.min.y;

          // Pivot at the model base center.
          mesh.position.x -= this.center.x;
          mesh.position.z -= this.center.z;
          mesh.position.y -= minY;

          this.appliedOffset.set(this.center.x, minY, this.center.z);

          const radius = Math.max(this.size.x, this.size.z) * 0.5;
          const contactShadowRadius = Math.max(MODEL_CONTACT_SHADOW_MIN_RADIUS, radius * MODEL_CONTACT_SHADOW_GROUND_SCALE);
          const contactShadowOpacity = clamp01(
            this.data.contactShadow,
            DEFAULT_MODEL_CONTACT_SHADOW_OPACITY
          );
          this.contactShadowMesh = applyContactShadow({
            THREE,
            entityObject3D: this.el.object3D,
            mesh: this.contactShadowMesh,
            opacity: contactShadowOpacity,
            radius: contactShadowRadius,
          });

          applyModelShadowFlags(mesh);
        },
      });
    }

    if (!AFRAME.components["warp-image"]) {
      AFRAME.registerComponent("warp-image", {
        schema: {
          src: { type: "string", default: "" },
          points: { type: "string", default: "" },
          opacity: { type: "number", default: 1 },
          brightness: { type: "number", default: 1 },
          inset: { type: "number", default: 0.6 },
          rotateDeg: { type: "number", default: 0 },
          flipX: { type: "boolean", default: false },
          flipY: { type: "boolean", default: false },
          depthMode: { type: "string", default: "none" },
          occlusionMaskPoints: { type: "string", default: "" },
          occlusionMaskInset: { type: "number", default: 0 },
          doubleSided: { type: "boolean", default: true },
        },
        init() {
          this._mesh = null;
          this._occlusionMaskMesh = null;
          this._group = null;
          this._geometry = null;
          this._occlusionMaskGeometry = null;
          this._material = null;
          this._occlusionMaskMaterial = null;
          this._texture = null;
          this._textureLoader = new THREE.TextureLoader();
          this._textureLoader.crossOrigin = "anonymous";
        },
        remove() {
          if (this._group || this._mesh) {
            this.el.removeObject3D("mesh");
          }
          this._geometry?.dispose?.();
          this._occlusionMaskGeometry?.dispose?.();
          this._material?.dispose?.();
          this._occlusionMaskMaterial?.dispose?.();
          this._texture?.dispose?.();
          this._group = null;
          this._mesh = null;
          this._occlusionMaskMesh = null;
          this._geometry = null;
          this._occlusionMaskGeometry = null;
          this._material = null;
          this._occlusionMaskMaterial = null;
          this._texture = null;
        },
        update(oldData) {
          const src = String(this.data.src || "").trim();
          const encodedPoints = String(this.data.points || "");
          const encodedMaskPoints = String(this.data.occlusionMaskPoints || "");
          let points = [];
          let occlusionMaskPoints = [];

          if (encodedPoints) {
            try {
              const decoded = decodeURIComponent(encodedPoints);
              const parsed = JSON.parse(decoded);
              if (Array.isArray(parsed)) {
                points = parsed
                  .map((p) => ({
                    x: Number(p?.x),
                    y: Number(p?.y),
                    z: Number(p?.z),
                  }))
                  .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
              }
            } catch {
              points = [];
            }
          }

          if (encodedMaskPoints) {
            try {
              const decoded = decodeURIComponent(encodedMaskPoints);
              const parsed = JSON.parse(decoded);
              if (Array.isArray(parsed)) {
                occlusionMaskPoints = parsed
                  .map((p) => ({
                    x: Number(p?.x),
                    y: Number(p?.y),
                    z: Number(p?.z),
                  }))
                  .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
              }
            } catch {
              occlusionMaskPoints = [];
            }
          }

          const opacity = Math.max(0, Math.min(1, Number(this.data.opacity) || 1));
          const brightness = Math.max(0, Math.min(5, Number(this.data.brightness) || 1));
          const inset = Number.isFinite(Number(this.data.inset)) ? Number(this.data.inset) : 0.6;
          const rotateDeg = Number.isFinite(Number(this.data.rotateDeg)) ? Number(this.data.rotateDeg) : 0;
          const depthMode = this.data.depthMode === "occlusion-mask" ? "occlusion-mask" : "none";
          const occlusionMaskInset = Number.isFinite(Number(this.data.occlusionMaskInset)) ? Number(this.data.occlusionMaskInset) : 0;
          const flipX = Boolean(this.data.flipX);
          const flipY = Boolean(this.data.flipY);
          const side = this.data.doubleSided ? THREE.DoubleSide : THREE.FrontSide;

          if (!src || points.length < 4) {
            if (this._group || this._mesh) {
              this.el.removeObject3D("mesh");
              this._group = null;
              this._mesh = null;
              this._occlusionMaskMesh = null;
            }
            this._geometry?.dispose?.();
            this._occlusionMaskGeometry?.dispose?.();
            this._material?.dispose?.();
            this._occlusionMaskMaterial?.dispose?.();
            this._texture?.dispose?.();
            this._geometry = null;
            this._occlusionMaskGeometry = null;
            this._material = null;
            this._occlusionMaskMaterial = null;
            this._texture = null;
            return;
          }

          const buildPolygonGeometry = (polygonPoints, polygonInset, includeUv) => {
            let normalizedPoints = Array.isArray(polygonPoints) ? [...polygonPoints] : [];
            if (normalizedPoints.length < 3) return null;

            const center = new THREE.Vector3();
            normalizedPoints.forEach((p) => center.add(new THREE.Vector3(p.x, p.y, p.z)));
            center.multiplyScalar(1 / normalizedPoints.length);

            // Determine polygon normal using Newell's method.
            const normal = new THREE.Vector3(0, 0, 0);
            for (let i = 0; i < normalizedPoints.length; i += 1) {
              const current = normalizedPoints[i];
              const next = normalizedPoints[(i + 1) % normalizedPoints.length];
              normal.x += (current.y - next.y) * (current.z + next.z);
              normal.y += (current.z - next.z) * (current.x + next.x);
              normal.z += (current.x - next.x) * (current.y + next.y);
            }
            if (normal.lengthSq() < 1e-8) {
              // Fallback to first 3 points.
              const p0 = new THREE.Vector3(normalizedPoints[0].x, normalizedPoints[0].y, normalizedPoints[0].z);
              const p1 = new THREE.Vector3(normalizedPoints[1].x, normalizedPoints[1].y, normalizedPoints[1].z);
              const p2 = new THREE.Vector3(normalizedPoints[2].x, normalizedPoints[2].y, normalizedPoints[2].z);
              normal.copy(new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)));
            }
            if (normal.lengthSq() < 1e-8) {
              return null;
            }
            normal.normalize();

            // Build a stable tangent basis on the plane.
            const p0 = new THREE.Vector3(normalizedPoints[0].x, normalizedPoints[0].y, normalizedPoints[0].z);
            const p1 = new THREE.Vector3(normalizedPoints[1].x, normalizedPoints[1].y, normalizedPoints[1].z);
            const tangent = new THREE.Vector3().subVectors(p1, p0);
            tangent.addScaledVector(normal, -tangent.dot(normal));
            if (tangent.lengthSq() < 1e-8) {
              tangent.set(1, 0, 0);
              tangent.addScaledVector(normal, -tangent.dot(normal));
            }
            tangent.normalize();
            const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

            const verts2 = normalizedPoints.map((p) => {
              const v = new THREE.Vector3(p.x, p.y, p.z).sub(center);
              return new THREE.Vector2(v.dot(tangent), v.dot(bitangent));
            });

            // Ensure CCW orientation for triangulation.
            let area = 0;
            for (let i = 0; i < verts2.length; i += 1) {
              const a = verts2[i];
              const b = verts2[(i + 1) % verts2.length];
              area += (a.x * b.y - b.x * a.y);
            }
            if (area < 0) {
              verts2.reverse();
              normalizedPoints = [...normalizedPoints].reverse();
            }

            const triangles = THREE.ShapeUtils.triangulateShape(verts2, []);
            if (!triangles?.length) return null;

            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            verts2.forEach((v) => {
              minX = Math.min(minX, v.x);
              maxX = Math.max(maxX, v.x);
              minY = Math.min(minY, v.y);
              maxY = Math.max(maxY, v.y);
            });
            const spanX = Math.max(1e-6, maxX - minX);
            const spanY = Math.max(1e-6, maxY - minY);

            const positions = new Float32Array(normalizedPoints.length * 3);
            const uvs = includeUv ? new Float32Array(normalizedPoints.length * 2) : null;

            const angle = (rotateDeg * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            for (let i = 0; i < normalizedPoints.length; i += 1) {
              const p = normalizedPoints[i];
              const idx3 = i * 3;
              positions[idx3] = p.x - normal.x * polygonInset;
              positions[idx3 + 1] = p.y - normal.y * polygonInset;
              positions[idx3 + 2] = p.z - normal.z * polygonInset;

              if (includeUv && uvs) {
                const idx2 = i * 2;
                let u = (verts2[i].x - minX) / spanX;
                let v = 1 - (verts2[i].y - minY) / spanY;

                if (flipX) u = 1 - u;
                if (flipY) v = 1 - v;

                if (Math.abs(rotateDeg) > 1e-6) {
                  const du = u - 0.5;
                  const dv = v - 0.5;
                  u = du * cos - dv * sin + 0.5;
                  v = du * sin + dv * cos + 0.5;
                }

                uvs[idx2] = u;
                uvs[idx2 + 1] = v;
              }
            }

            const indices = new Uint16Array(triangles.length * 3);
            for (let i = 0; i < triangles.length; i += 1) {
              const tri = triangles[i];
              indices[i * 3] = tri[0];
              indices[i * 3 + 1] = tri[1];
              indices[i * 3 + 2] = tri[2];
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            if (includeUv && uvs) {
              geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
            }
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            geometry.computeVertexNormals();
            return geometry;
          };

          const buildOrUpdateMesh = (texture) => {
            this._geometry?.dispose?.();
            this._occlusionMaskGeometry?.dispose?.();
            this._material?.dispose?.();
            this._occlusionMaskMaterial?.dispose?.();

            if (this._group || this._mesh) {
              this.el.removeObject3D("mesh");
            }

            const geometry = buildPolygonGeometry(points, inset, true);
            if (!geometry) return;

            const material = new THREE.MeshBasicMaterial({
              map: texture,
              color: new THREE.Color(1, 1, 1).multiplyScalar(brightness),
              transparent: true,
              opacity,
              side,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            mesh.renderOrder = 20;

            const group = new THREE.Group();
            group.add(mesh);

            let occlusionMaskMesh = null;
            let occlusionMaskGeometry = null;
            let occlusionMaskMaterial = null;

            if (depthMode === "occlusion-mask" && occlusionMaskPoints.length >= 3) {
              occlusionMaskGeometry = buildPolygonGeometry(occlusionMaskPoints, occlusionMaskInset, false);
              if (occlusionMaskGeometry) {
                occlusionMaskMaterial = new THREE.MeshBasicMaterial({
                  color: 0x000000,
                  side: THREE.DoubleSide,
                  transparent: true,
                  opacity: 0,
                  depthWrite: true,
                  depthTest: true,
                  colorWrite: false,
                });
                occlusionMaskMesh = new THREE.Mesh(occlusionMaskGeometry, occlusionMaskMaterial);
                occlusionMaskMesh.frustumCulled = false;
                occlusionMaskMesh.renderOrder = 19;
                group.add(occlusionMaskMesh);
              }
            }

            this._geometry = geometry;
            this._occlusionMaskGeometry = occlusionMaskGeometry;
            this._material = material;
            this._occlusionMaskMaterial = occlusionMaskMaterial;
            this._mesh = mesh;
            this._occlusionMaskMesh = occlusionMaskMesh;
            this._group = group;
            this.el.setObject3D("mesh", group);
          };

          if (!this._texture || oldData?.src !== src) {
            this._texture?.dispose?.();
            this._texture = null;

            this._textureLoader.load(
              src,
              (tex) => {
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.needsUpdate = true;
                this._texture = tex;
                buildOrUpdateMesh(tex);
              },
              undefined,
              () => {
                // ignore load errors; leave empty
              }
            );
          } else {
            buildOrUpdateMesh(this._texture);
          }
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
          renderer.outputColorSpace = window.THREE?.SRGBColorSpace ?? renderer.outputColorSpace;
          // ACES is great for HDR/EXR, but it can darken regular JPG/MP4 panoramas.
          renderer.toneMapping = isHdrOrExrEnvironment
            ? (window.THREE?.ACESFilmicToneMapping ?? renderer.toneMapping)
            : (window.THREE?.NoToneMapping ?? renderer.toneMapping);
          renderer.toneMappingExposure = 1.0;
          renderer.setClearColor?.(0x000000, 1);
        }

        sceneEl.object3D.traverse((obj) => {
          if (obj?.isLight) {
            obj.castShadow = true;
            if (obj.shadow) {
              obj.shadow.mapSize?.set?.(2048, 2048);
              obj.shadow.bias = DEFAULT_POINT_LIGHT_SHADOW_BIAS;
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
  }, [isHdrOrExrEnvironment]);

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
    if (parsedEnvironment?.mime?.startsWith("video/")) return "video";
    if (parsedEnvironment?.mime?.startsWith("image/")) return "image";
    return "";
  }, [parsedEnvironment?.mime]);

  const panoramaSrc = useMemo(() => {
    if (panoramaKind === "video") return videoReady ? "#environment" : "";
    if (panoramaKind === "image") return imageSkySrc || "";
    return "";
  }, [imageSkySrc, panoramaKind, videoReady]);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl?.camera) return;
    const cameraEl = sceneEl.querySelector("a-camera");
    const lookControls = cameraEl?.components?.["look-controls"];
    if (!lookControls?.yawObject || !lookControls?.pitchObject) {
      setCameraAlignmentBase({ pitch: 0, yaw: 0 });
      return;
    }

    const yawDeg = (lookControls.yawObject.rotation.y * 180) / Math.PI;
    const pitchDeg = (lookControls.pitchObject.rotation.x * 180) / Math.PI;
    setCameraAlignmentBase({
      pitch: Number.isFinite(pitchDeg) ? pitchDeg : 0,
      yaw: Number.isFinite(yawDeg) ? yawDeg : 0,
    });
  }, [domeDialogOpen]);

  useEffect(() => {
    if (isHdrOrExrEnvironment) {
      setEnvironmentLoadError("HDR/EXR não é suportado neste modo. Usa JPG/PNG ou vídeo.");
      return;
    }
    setEnvironmentLoadError("");
  }, [isHdrOrExrEnvironment]);

  const effectivePanoramaRotation = useMemo(() => {
    const x = Number(domeRotationX) || 0;
    const y = Number(domeRotationY) || 0;
    const z = Number(domeRotationZ) || 0;
    return `${x} ${y} ${z}`;
  }, [domeRotationX, domeRotationY, domeRotationZ]);

  const relativeDomeRotationX = useMemo(
    () => (Number(domeRotationX) || 0) - (Number(cameraAlignmentBase.pitch) || 0),
    [cameraAlignmentBase.pitch, domeRotationX]
  );

  const relativeDomeRotationY = useMemo(
    () => (Number(domeRotationY) || 0) - (Number(cameraAlignmentBase.yaw) || 0),
    [cameraAlignmentBase.yaw, domeRotationY]
  );

  const panoramaScale = useMemo(() => {
    const sx = domeMirrorX ? -1 : 1;
    const sy = domeMirrorY ? -1 : 1;
    return `${sx} ${sy} 1`;
  }, [domeMirrorX, domeMirrorY]);

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

  const defaultModelTransformProps = {
    position: `${defaultProps.position.x} ${defaultProps.position.y} ${defaultProps.position.z}`,
    rotation: `${defaultProps.rotation.x} ${defaultProps.rotation.y} ${defaultProps.rotation.z}`,
    scale: `${defaultProps.scale.x} ${defaultProps.scale.y} ${defaultProps.scale.z}`,
  };

  const renderModelo3dHotspot = (conteudo, hotspot) => {
    const currentFloorY = floorY;
    const { isGround } = getModelHotspotPlacement(hotspot, currentFloorY);

    const groundingAttributes = isGround
      ? { "ground-model-on-floor": "contactShadow: 0" }
      : {
        "center-model-pivot": "",
        "ground-model-on-dome": `centerY: ${currentFloorY}; inset: 1.6; contactShadow: ${DEFAULT_MODEL_CONTACT_SHADOW_OPACITY}`,
      };

    return (
      <a-entity
        gltf-model={conteudo}
        position={defaultModelTransformProps.position}
        rotation={defaultModelTransformProps.rotation}
        scale={defaultModelTransformProps.scale}
        shadow="cast: true; receive: true"
        {...groundingAttributes}
      />
    );
  };

  const getHotspotIconConfig = () => {
    try {
      const stored = localStorage.getItem("hotspot_icon_config");
      return stored ? JSON.parse(stored) : { icon_type: "ring", icon_color: "#06b6d4", text_font: "roboto", custom_icons: {} };
    } catch {
      return { icon_type: "ring", icon_color: "#06b6d4", text_font: "roboto", custom_icons: {} };
    }
  };

  const resolveCustomHotspotIconUrl = (iconConfig, hotspot) => {
    if (!iconConfig || iconConfig.icon_type !== "custom") return "";

    const customIcons = iconConfig.custom_icons && typeof iconConfig.custom_icons === "object" ? iconConfig.custom_icons : {};
    const isNavigation = hotspot?.tipo === "navegacao" || hotspot?.id_ponto_destino || hotspot?.navigation_file_url || hotspot?.navigation_mode === "back";
    const typeKey = isNavigation ? "navegacao" : String(hotspot?.tipo || "");
    const storedValue = customIcons[typeKey] || customIcons[hotspot?.tipo] || customIcons.link || customIcons.default || "";

    if (!storedValue) return "";

    const normalizedPath = relativePathFromUploadsUrl(storedValue) || String(storedValue).replace(/^\/+/, "");
    return normalizedPath ? resolveUploadsUrl(normalizedPath) || "" : storedValue;
  };

  const renderCustomHotspotIcon = (iconConfig, hotspot) => {
    const { icon_type = "ring" } = iconConfig || {};
    const imageUrl = resolveCustomHotspotIconUrl(iconConfig, hotspot);

    if (icon_type === "custom" && imageUrl) {
      return (
        <a-entity>
          <a-image src={imageUrl} width="18" height="18" position="0 0 0" material="transparent: true; side: double; alphaTest: 0.050" />
        </a-entity>
      );
    }

    return null;
  };

  const tipoToAFrame = {
    texto: (conteudo) => {
      const iconConfig = getHotspotIconConfig();
      const textFont = iconConfig.text_font || "roboto";

      return (
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
            font={textFont}
          />
        </a-entity>
      );
    },

    imagem: (conteudo) => (
      (() => {
        const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), { tipo: "imagem" });
        if (customIcon) return customIcon;

        return (
          <a-entity>
            {conteudo ? (
              <a-image src={conteudo} width="30" height="30" position="0 0 0" material="transparent: true; alphaTest: 0.050" shadow="cast: true; receive: true" />
            ) : (
              <>
                <a-ring radius-inner="5" radius-outer="7" color="#06b6d4" material="side: double; alphaTest: 0.050" />
                <a-text value="Imagem?" color="white" width="70" align="center" position="0 9 0" />
              </>
            )}
          </a-entity>
        );
      })()
    ),

    imagem4p: () => (() => {
      const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), { tipo: "imagem4p" });
      if (customIcon) return customIcon;

      return (
        <a-entity>
          <a-ring radius-inner="5" radius-outer="7" color="#0ea5e9" material="side: double; alphaTest: 0.050" />
          <a-text value="Imagem 4p" color="white" width="80" align="center" position="0 9 0" />
        </a-entity>
      );
    })(),

    modelo3d: (conteudo, hotspot) => renderModelo3dHotspot(conteudo, hotspot),

    modelo3d_inspect: (conteudo, hotspot) => {
      const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), hotspot);
      if (customIcon) return customIcon;

      const payload = decodeInspect3dValue(conteudo);
      if (!payload) return null;
      const currentFloorY = floorY;
      const { isGround } = getModelHotspotPlacement(hotspot, currentFloorY);
      const isInspecting = inspectModeHotspotId === hotspot.id;

      const groundingAttributes = isGround
        ? { "ground-model-on-floor": "contactShadow: 0" }
        : {
          "center-model-pivot": "",
          "ground-model-on-dome": `centerY: ${currentFloorY}; inset: 1.6; contactShadow: ${DEFAULT_MODEL_CONTACT_SHADOW_OPACITY}`,
        };

      return (
        <a-entity
          gltf-model={payload.src}
          position={defaultModelTransformProps.position}
          rotation={defaultModelTransformProps.rotation}
          scale={defaultModelTransformProps.scale}
          shadow="cast: true; receive: true"
          inspect-3d={`axis: ${payload.axis}; speed: ${payload.rotationSpeed}; isInspecting: ${isInspecting}`}
          class="clickable"
          {...groundingAttributes}
        />
      );
    },

    audio: (conteudo) => (
      (() => {
        const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), { tipo: "audio" });
        if (customIcon) return customIcon;

        return (
          <a-entity>
            <a-ring radius-inner="5" radius-outer="7" color="#a855f7" material="side: double; alphaTest: 0.050" />
            <a-text value="Audio" color="white" width="60" align="center" position="0 9 0" />
            <a-entity
              sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: false`}
            ></a-entity>
          </a-entity>
        );
      })()
    ),

    audioespacial: (conteudo) => (
      (() => {
        const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), { tipo: "audioespacial" });
        if (customIcon) return customIcon;

        return (
          <a-entity>
            <a-ring radius-inner="5" radius-outer="7" color="#7c3aed" material="side: double; alphaTest: 0.050" />
            <a-text value="Audio 3D" color="white" width="80" align="center" position="0 9 0" />
            <a-entity
              sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: true; refDistance: 50; rolloffFactor: 1;`}
            ></a-entity>
          </a-entity>
        );
      })()
    ),

    video: (conteudo) => (
      (() => {
        const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), { tipo: "video" });
        if (customIcon) return customIcon;

        return (
          <a-entity>
            <a-ring radius-inner="5" radius-outer="7" color="#f59e0b" material="side: double; alphaTest: 0.050" />
            <a-text value={conteudo ? "Video" : "Video?"} color="white" width="60" align="center" position="0 9 0" />
          </a-entity>
        );
      })()
    ),

    link: (conteudo, hotspot) => {
      const customIcon = renderCustomHotspotIcon(getHotspotIconConfig(), hotspot);
      if (customIcon) return customIcon;

      const isNavigation = hotspot?.tipo === "navegacao" || hotspot?.id_ponto_destino || hotspot?.navigation_file_url || hotspot?.navigation_mode === "back";

      if (isNavigation) {
        const iconConfig = getHotspotIconConfig();
        const navColor = hotspot?.icon_color || iconConfig.icon_color || "#22c55e";

        if (iconConfig.icon_type === "sphere") {
          return (
            <a-entity>
              <a-sphere position="0 0 0" radius="10" color={navColor} material="opacity: 0.9; transparent: true; alphaTest: 0.050" />
              <a-text
                value={hotspot?.navigation_mode === "back" ? "← Voltar" : "→ Próximo"}
                color="white"
                width="90"
                align="center"
                position="0 16 0"
              />
            </a-entity>
          );
        } else if (iconConfig.icon_type === "arrow") {
          return (
            <a-entity>
              <a-triangle
                vertex-a="-6 8 0"
                vertex-b="6 8 0"
                vertex-c="0 -8 0"
                color={navColor}
                material="side: double; alphaTest: 0.050"
              />
              <a-text
                value={hotspot?.navigation_mode === "back" ? "Anterior" : "Próxima"}
                color="white"
                width="90"
                align="center"
                position="0 16 0"
              />
            </a-entity>
          );
        } else if (iconConfig.icon_type === "custom") {
          return (
            <a-entity>
              <a-box position="0 0 0" width="12" height="12" depth="12" color={navColor} material="opacity: 0.8; transparent: true; alphaTest: 0.050" />
              <a-text
                value={hotspot?.navigation_mode === "back" ? "←" : "→"}
                color="white"
                width="90"
                align="center"
                position="0 18 0"
              />
            </a-entity>
          );
        } else {
          // Default ring
          return (
            <a-entity>
              <a-ring
                radius-inner="8"
                radius-outer="12"
                color={navColor}
                position="0 0 0"
                opacity="0.95"
                material="side: double; alphaTest: 0.050"
              />
              <a-circle
                radius="7"
                color="#0b1b10"
                position="0 0 0.02"
                opacity="0.9"
                material="side: double; alphaTest: 0.050"
              />
              {hotspot?.navigation_mode === "back" ? (
                <a-triangle
                  vertex-a="2.5 4 0.05"
                  vertex-b="2.5 -4 0.05"
                  vertex-c="-4 0 0.05"
                  color={navColor}
                  material="side: double; alphaTest: 0.050"
                />
              ) : (
                <a-triangle
                  vertex-a="-2.5 4 0.05"
                  vertex-b="-2.5 -4 0.05"
                  vertex-c="4 0 0.05"
                  color={navColor}
                  material="side: double; alphaTest: 0.050"
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
          );
        }
      } else {
        return (
          <>
            <a-sphere position="0 0 0" radius="16" color="#ff2e63" />
            <a-link
              href={conteudo}
              title={conteudo}
              position="0 0 0.5"
              scale="16 16 1"
            />
          </>
        );
      }
    },
  };

  const contextMenuOptions = selectedHotspot
    ? [
      { label: "Editar Hotspot", value: "edit" },
      { label: "Eliminar Hotspot", value: "delete" },
      { label: "Editar panorama", value: "edit-dome" },
    ]
    : [
      { label: "Criar Hotspot", value: "create" },
      { label: "Editar panorama", value: "edit-dome" },
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
            placement: String(decodedContent.placement || ""),
            tipo: isNavigation ? "navegacao" : (h.tipo === "modelo3d" && decodedContent.value.startsWith(INSPECT3D_PREFIX) ? "modelo3d_inspect" : (h.tipo || "")),
            conteudo: isNavigation ? "" : decodedContent.value,
            view_path: decodedContent.view,
            navigation_mode: navigation.mode,
            id_ponto_destino: navigation.pointId,
            navigation_file_path: navigation.filePath,
            navigation_file_url: navigation.filePath ? resolveUploadsUrl(navigation.filePath) : "",
            icon_type: h.icon_type,
            icon_color: h.icon_color,
            hide_icon: Boolean(h.hide_icon),
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
      if (!showEditContextMenu) return;
      const btn = e?.detail?.mouseEvent?.button ?? 0;



      if (isPickingGroundPosition && editDialogOpen && editStickToGround && btn === 0) {
        const pointerClientX = Number(e?.clientX ?? e?.detail?.mouseEvent?.clientX);
        const pointerClientY = Number(e?.clientY ?? e?.detail?.mouseEvent?.clientY);
        const hit = getIntersectionFromPointer(pointerClientX, pointerClientY);
        if (hit?.point) {
          setPositionAndAnglesFromXYZ(hit.point.x, floorY, hit.point.z);
          setEditPlacement("ground");
        }
        return;
      }

      if (isCapturingImage4pPoints && editDialogOpen && editTipo === "imagem4p" && btn === 0) {
        const pointerClientX = Number(e?.clientX ?? e?.detail?.mouseEvent?.clientX);
        const pointerClientY = Number(e?.clientY ?? e?.detail?.mouseEvent?.clientY);
        const hit = getIntersectionFromPointer(pointerClientX, pointerClientY, { domeOnly: true });
        if (hit?.point) {
          const nextPoint = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
          setEditImage4pPoints((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            if (base.length === 0) {
              setPositionAndAnglesFromXYZ(nextPoint.x, nextPoint.y, nextPoint.z);
            }
            return [...base, nextPoint];
          });
        }
        return;
      }

      if (isCapturingImage4pMaskPoints && editDialogOpen && editTipo === "imagem4p" && btn === 0) {
        const pointerClientX = Number(e?.clientX ?? e?.detail?.mouseEvent?.clientX);
        const pointerClientY = Number(e?.clientY ?? e?.detail?.mouseEvent?.clientY);
        const hit = getIntersectionFromPointer(pointerClientX, pointerClientY, { domeOnly: true });
        if (hit?.point) {
          const nextPoint = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
          setEditImage4pOcclusionMaskPoints((prev) => [...(Array.isArray(prev) ? prev : []), nextPoint]);
        }
        return;
      }

      const isHotspot = e.target?.classList?.contains("hotspot-interaction");
      if (!isHotspot) {
        setSelectedHotspot(null);
        clickEventRef.current = e;
      }
    };

    if (showEditContextMenu) {
      scene.addEventListener("click", onClickScene);
    }

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e?.detail?.mouseEvent?.button ?? 0;
      const id = Number(e.currentTarget.dataset.id);
      const hotspot = hotspots.find((h) => h.id === id);
      if (hotspot) {
        if (hotspot.tipo === "modelo3d_inspect" && !editDialogOpen) {
          setInspectModeHotspotId((prev) => prev === hotspot.id ? null : hotspot.id);
          return;
        }

        if (showEditContextMenu) {
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
      if (showEditContextMenu) {
        scene.removeEventListener("click", onClickScene);
      }
      clickablePlanes.forEach((el) => {
        el.removeEventListener("click", handler);
      });
    };
  }, [
    showEditContextMenu,
    hotspots,
    navigateOnHotspot,
    activeEnvironment,
    isNavigationTransitioning,
    editDialogOpen,
    editTipo,
    editStickToGround,
    isPickingGroundPosition,
    floorY,
    domeDialogOpen,
    isCapturingImage4pPoints,
    isCapturingImage4pMaskPoints,
    domeRadius,
    domeVerticalOffset,
  ]);

  const isImage4pCaptureMode = editDialogOpen
    && editTipo === "imagem4p"
    && (isCapturingImage4pPoints || isCapturingImage4pMaskPoints);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!isImage4pCaptureMode || !sceneEl?.canvas) return;

    const canvas = sceneEl.canvas;
    image4pMagnifierCORSBlockedRef.current = false;

    const handleMove = (event) => {
      image4pMagnifierPointerRef.current = {
        clientX: Number(event.clientX) || 0,
        clientY: Number(event.clientY) || 0,
        active: true,
      };
    };

    const handleEnter = (event) => {
      image4pMagnifierPointerRef.current = {
        clientX: Number(event.clientX) || 0,
        clientY: Number(event.clientY) || 0,
        active: true,
      };
    };

    const handleLeave = () => {
      image4pMagnifierPointerRef.current = {
        ...image4pMagnifierPointerRef.current,
        active: false,
      };
    };

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseenter", handleEnter);
    canvas.addEventListener("mouseleave", handleLeave);

    const draw = () => {
      image4pMagnifierRafRef.current = requestAnimationFrame(draw);

      const overlayCanvas = image4pMagnifierCanvasRef.current;
      if (!overlayCanvas) return;

      const ctx = overlayCanvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const destCssSize = 220;
      const destPx = Math.round(destCssSize * dpr);

      if (overlayCanvas.width !== destPx || overlayCanvas.height !== destPx) {
        overlayCanvas.width = destPx;
        overlayCanvas.height = destPx;
        overlayCanvas.style.width = `${destCssSize}px`;
        overlayCanvas.style.height = `${destCssSize}px`;
      }

      const pointer = image4pMagnifierPointerRef.current;
      const cursorBoxEl = image4pMagnifierCursorBoxRef.current;
      if (cursorBoxEl) {
        if (!pointer?.active) {
          cursorBoxEl.style.display = "none";
        } else {
          const boxSize = 90;
          const left = (pointer.clientX - rect.left) - boxSize / 2;
          const top = (pointer.clientY - rect.top) - boxSize / 2;
          cursorBoxEl.style.display = "block";
          cursorBoxEl.style.left = `${left}px`;
          cursorBoxEl.style.top = `${top}px`;
          cursorBoxEl.style.width = `${boxSize}px`;
          cursorBoxEl.style.height = `${boxSize}px`;
        }
      }

      // Background
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (!pointer?.active || image4pMagnifierCORSBlockedRef.current) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = `${Math.round(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const msg = image4pMagnifierCORSBlockedRef.current
          ? "Zoom indisponível (CORS)"
          : "Move o rato no 360";
        ctx.fillText(msg, overlayCanvas.width / 2, overlayCanvas.height / 2);
        return;
      }

      // Convert client coords -> canvas internal coords
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (pointer.clientX - rect.left) * scaleX;
      const cy = (pointer.clientY - rect.top) * scaleY;

      const srcSize = Math.max(24, Math.round(90 * Math.max(scaleX, scaleY)));
      const half = srcSize / 2;
      const sx = Math.max(0, Math.min(canvas.width - srcSize, Math.round(cx - half)));
      const sy = Math.max(0, Math.min(canvas.height - srcSize, Math.round(cy - half)));

      try {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, sx, sy, srcSize, srcSize, 0, 0, overlayCanvas.width, overlayCanvas.height);
      } catch {
        image4pMagnifierCORSBlockedRef.current = true;
        return;
      }

      // Crosshair
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, Math.round(1 * dpr));
      ctx.beginPath();
      ctx.moveTo(overlayCanvas.width / 2, 0);
      ctx.lineTo(overlayCanvas.width / 2, overlayCanvas.height);
      ctx.moveTo(0, overlayCanvas.height / 2);
      ctx.lineTo(overlayCanvas.width, overlayCanvas.height / 2);
      ctx.stroke();

      // Border
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
      ctx.strokeRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    };

    image4pMagnifierRafRef.current = requestAnimationFrame(draw);

    return () => {
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseenter", handleEnter);
      canvas.removeEventListener("mouseleave", handleLeave);
      if (image4pMagnifierRafRef.current) {
        cancelAnimationFrame(image4pMagnifierRafRef.current);
        image4pMagnifierRafRef.current = null;
      }
      image4pMagnifierPointerRef.current = { clientX: 0, clientY: 0, active: false };
      const cursorBoxEl = image4pMagnifierCursorBoxRef.current;
      if (cursorBoxEl) cursorBoxEl.style.display = "none";
    };
  }, [isImage4pCaptureMode]);

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

  const getIntersectionFromPointer = (pointerClientX, pointerClientY, options = {}) => {
    if (!Number.isFinite(Number(pointerClientX)) || !Number.isFinite(Number(pointerClientY))) return null;

    const raycast = getPointerRaycaster(Number(pointerClientX), Number(pointerClientY));
    if (!raycast) return null;

    const { THREE, raycaster } = raycast;
    const floorY = Number(domeVerticalOffset) || 0;

    const candidates = [];

    const groundMesh = groundPlaneRef.current?.getObject3D?.("mesh");
    if (!options?.domeOnly && groundMesh) {
      const groundHits = raycaster.intersectObject(groundMesh, true);
      const firstGroundHit = groundHits.find((hit) => hit?.point);
      if (firstGroundHit?.point) {
        const point = firstGroundHit.point.clone();
        point.y = floorY;
        const horizontal = new THREE.Vector3(point.x, floorY, point.z);
        const center = new THREE.Vector3(0, floorY, 0);
        const horizontalDistance = horizontal.distanceTo(center);
        const maxDistance = Math.max(1, Number(domeRadius) || 1) * 0.98;
        if (horizontalDistance > maxDistance) {
          const dir = horizontal.sub(center).normalize();
          point.x = dir.x * maxDistance;
          point.z = dir.z * maxDistance;
        }
        candidates.push({ point, distance: firstGroundHit.distance, placement: "ground" });
      }
    }

    const domeMesh = panoramaNodeRef.current?.getObject3D?.("mesh");
    if (domeMesh) {
      const domeHits = raycaster.intersectObject(domeMesh, true);
      const firstDomeHit = domeHits.find((hit) => hit?.point);
      if (firstDomeHit?.point) {
        candidates.push({ point: firstDomeHit.point.clone(), distance: firstDomeHit.distance, placement: "dome" });
      }
    }

    if (candidates.length) {
      candidates.sort((a, b) => a.distance - b.distance);
      return { point: candidates[0].point, placement: candidates[0].placement };
    }

    const sphere = new THREE.Sphere(new THREE.Vector3(0, floorY, 0), domeRadius);
    const point = new THREE.Vector3();
    if (raycaster.ray.intersectSphere(sphere, point)) {
      return { point, placement: "dome" };
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

    const hit = getIntersectionFromPointer(pointerClientX, pointerClientY);
    if (!hit?.point) {
      console.warn("❌ Sem interseção com o dome/chão");
      return;
    }

    const intersection = hit.point;
    const placement = hit.placement;

    try {
      const res = await fetch(buildApiUrl("/hotspot/add"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`
        },
        body: JSON.stringify({
          id_ponto: pontoId,
          x: intersection.x,
          y: intersection.y,
          z: intersection.z,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData?.error || errorData?.message || `HTTP ${res.status}`;
        throw new Error(errorMessage);
      }

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
          placement,
          tipo: hotspotCriado.tipo || "",
          conteudo: hotspotCriado.conteudo || "",
          view_path: activeViewPath,
          navigation_mode: null,
          id_ponto_destino: "",
          navigation_file_path: "",
          navigation_file_url: "",
          icon_type: hotspotCriado.icon_type || "ring",
          icon_color: hotspotCriado.icon_color || "#06b6d4",
          hide_icon: Boolean(hotspotCriado.hide_icon),
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
        setEditPlacement(String(hotspotEditavel.placement || ""));
        setEditStickToGround(String(hotspotEditavel.placement || "") === "ground");
        setEditHideIcon(Boolean(hotspotEditavel.hide_icon));
        setPositionAndAnglesFromXYZ(hotspotEditavel.x, hotspotEditavel.y, hotspotEditavel.z);
        setEditPontoDestino(hotspotEditavel.id_ponto_destino || "");
        setEditNavigationSelection(null);
        setEditNavigationPath("");
        setEditNavigationMode("file");
        setEditModelSelection(null);
        setEditImageSelection(null);
        setEditImage4pSelection(null);
        setEditImage4pPreviewUrl("");
        setEditImage4pPoints([]);
        setEditImage4pOpacity(1);
        setEditImage4pBrightness(1);
        setEditImage4pInset(0.6);
        setEditImage4pRotateDeg(0);
        setEditImage4pFlipX(false);
        setEditImage4pFlipY(false);
        setEditImage4pDepthMode("none");
        setEditImage4pOcclusionMaskPoints([]);
        setEditImage4pOcclusionMaskInset(0);
        setEditInspect3dSrc(null);
        setEditInspect3dRotationSpeed(1);
        setEditInspect3dAxis("y");
        setEditInspect3dButtons([]);
        setIsCapturingImage4pPoints(false);
        setIsCapturingImage4pMaskPoints(false);
        setEditStep("type");
        setEditDialogOpen(true);
      }
    } catch (err) {
      console.error("❌ Erro ao guardar hotspot:", err);
      Swal.fire({
        title: "Erro ao criar hotspot",
        text: err?.message || "Erro desconhecido ao tentar guardar o hotspot.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
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
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`
        }
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
            text: "Seleciona ou faz upload de um ficheiro de imagem ou vídeo (HDR/EXR, JPG, PNG, GIF, WebP, BMP, SVG, AVIF ou MP4).",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }

        if (!/\.(hdr|exr|jpg|jpeg|png|gif|webp|bmp|svg|avif|mp4)$/i.test(navigationPath)) {
          Swal.fire({
            title: "Formato inválido",
            text: "Para navegação por ficheiro, usa formatos de imagem ou vídeo suportados (HDR/EXR, JPG, PNG, GIF, WebP, BMP, SVG, AVIF ou MP4).",
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

    if (editTipo === "modelo3d_inspect") {
      let finalModelSrc = editInspect3dSrc;
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

        finalModelSrc = resolvedModelUrl;
      }

      if (!String(finalModelSrc || "").trim()) {
        Swal.fire({
          title: "Modelo em falta",
          text: "Seleciona ou faz upload de um ficheiro GLB/GLTF para o hotspot de inspeção 3D.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }

      finalConteudoRaw = encodeInspect3dValue({
        src: finalModelSrc,
        rotationSpeed: editInspect3dRotationSpeed,
        axis: editInspect3dAxis,
        buttons: editInspect3dButtons
      });
    }

    if (editTipo === "imagem") {
      if (editImageSelection) {
        const resolvedImage = await resolveMediaSelection(editImageSelection, "media");
        const resolvedImageUrl = resolvedImage?.url || resolveUploadsUrl(resolvedImage?.path || "");

        if (!resolvedImageUrl) {
          Swal.fire({
            title: "Imagem inválida",
            text: "Não foi possível resolver o ficheiro de imagem selecionado.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }

        finalConteudoRaw = resolvedImageUrl;
      }

      if (!String(finalConteudoRaw || "").trim()) {
        Swal.fire({
          title: "Imagem em falta",
          text: "Seleciona ou faz upload de uma imagem.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }
    }

    if (editTipo === "imagem4p") {
      const resolvedImage = await resolveMediaSelection(editImage4pSelection, "media");
      const resolvedUrl = resolvedImage?.url || "";
      const finalSrc = resolvedUrl || String(editImage4pPreviewUrl || "").trim();

      if (!finalSrc) {
        Swal.fire({
          title: "Imagem em falta",
          text: "Seleciona ou faz upload de uma imagem para projetar.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }

      if (!Array.isArray(editImage4pPoints) || editImage4pPoints.length < 4) {
        Swal.fire({
          title: "Pontos insuficientes",
          text: "Seleciona pelo menos 4 pontos no 360 para projetar a imagem.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }

      if (editImage4pDepthMode === "occlusion-mask" && (!Array.isArray(editImage4pOcclusionMaskPoints) || editImage4pOcclusionMaskPoints.length < 3)) {
        Swal.fire({
          title: "Máscara incompleta",
          text: "Seleciona pelo menos 3 pontos para a máscara de oclusão.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }

      finalConteudoRaw = encodeImage4pValue({
        src: finalSrc,
        points: editImage4pPoints,
        opacity: editImage4pOpacity,
        brightness: editImage4pBrightness,
        inset: editImage4pInset,
        rotateDeg: editImage4pRotateDeg,
        flipX: editImage4pFlipX,
        flipY: editImage4pFlipY,
        depthMode: editImage4pDepthMode,
        occlusionMaskPoints: editImage4pOcclusionMaskPoints,
        occlusionMaskInset: editImage4pOcclusionMaskInset,
      });
    }

    const finalPlacement = editStickToGround ? "ground" : String(editPlacement || selectedHotspot.placement || "");
    const finalConteudo = encodeHotspotContent(finalConteudoRaw, activeViewPath, editScale, editYaw, editPitch, finalPlacement);
    const finalX = Number(editX);
    const finalY = editStickToGround ? floorY : Number(editY);
    const finalZ = Number(editZ);

    try {
      const res = await fetch(buildApiUrl(`/hotspot/${selectedHotspot.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`
        },
        body: JSON.stringify({
          tipo: finalTipo === "modelo3d_inspect" ? "modelo3d" : finalTipo,
          conteudo: finalConteudo,
          x: finalX,
          y: finalY,
          z: finalZ,
          hide_icon: Boolean(editHideIcon),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.details || data?.error || data?.message || `HTTP ${res.status}`;
        throw new Error(message);
      }
      console.log("✅ Hotspot atualizado:", data);
      const updatedLocal = {
        id: selectedHotspot.id,
        id_hotspot: selectedHotspot.id,
        tipo: editTipo,
        conteudo: editTipo === "navegacao" ? "" : finalConteudoRaw,
        view_path: activeViewPath,
        x: finalX,
        y: finalY,
        z: finalZ,
        rot_yaw: Number(editYaw) || 0,
        rot_pitch: Number(editPitch) || 0,
        scale: Number(editScale),
        placement: finalPlacement,
        navigation_mode: editTipo === "navegacao" ? editNavigationMode : null,
        id_ponto_destino: finalPontoDestino,
        navigation_file_path: finalNavigationPath,
        navigation_file_url: finalNavigationPath ? resolveUploadsUrl(finalNavigationPath) : "",
        icon_type: selectedHotspot.icon_type || "ring",
        icon_color: selectedHotspot.icon_color || "#06b6d4",
        hide_icon: Boolean(editHideIcon),
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
        text: err?.message || "Erro ao atualizar o hotspot.",
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
        wasd-controls="enabled: false"
        wasd-controls-enabled="false"
        raycaster="objects: .hotspot-interaction"
        cursor="rayOrigin: mouse"
      ></a-camera>

      <a-plane
        ref={groundPlaneRef}
        position={`0 ${floorY - 0.05} 0`}
        rotation="-90 0 0"
        width={Math.max(1500, Math.ceil(domeRadius * 3))}
        height={Math.max(1500, Math.ceil(domeRadius * 3))}
        material="color: #000; opacity: 0; transparent: true; side: double; depthWrite: false; depthTest: false"
        shadow="cast: false; receive: false"
      />

      <a-entity ref={ambientLightRef} light={`type: ambient; color: #ffffff; intensity: ${DEFAULT_AMBIENT_LIGHT_INTENSITY}`} />
      <a-entity
        ref={pointLightRef}
        position={DEFAULT_POINT_LIGHT_POSITION}
        light={`type: point; color: ${DEFAULT_POINT_LIGHT_COLOR}; intensity: ${DEFAULT_POINT_LIGHT_INTENSITY}; distance: ${DEFAULT_POINT_LIGHT_DISTANCE}; decay: 2; castShadow: true; shadowMapWidth: 2048; shadowMapHeight: 2048; shadowBias: ${DEFAULT_POINT_LIGHT_SHADOW_BIAS}`}
      />

      {parsedEnvironment?.mime?.startsWith("video/") && (
        <video style={{ display: "none" }} id="environment" ref={handleVideoRef} preload="auto" crossOrigin="anonymous" autoPlay loop muted playsInline>
          <source src={parsedEnvironment.url} type={parsedEnvironment.mime} />
        </video>
      )}

      {domeDialogOpen && showAlignmentGuides && (
        <a-entity position={`0 ${domeVerticalOffset} 0`}>
          <a-sphere
            radius={domeRadius * 0.98}
            segments-width="36"
            segments-height="18"
            material={`shader: flat; wireframe: true; color: rgba(255, 255, 255, ${alignmentGuidesOpacity * 0.4}); transparent: true; side: back`}
          ></a-sphere>

          {/* Equator (Horizonline) */}
          <a-entity
            geometry={`primitive: ring; radiusInner: ${domeRadius * 0.975}; radiusOuter: ${domeRadius * 0.98}; segmentsTheta: 64`}
            rotation="-90 0 0"
            material={`shader: flat; color: rgba(255, 80, 80, ${alignmentGuidesOpacity}); transparent: true; side: double`}
          ></a-entity>
        </a-entity>
      )}

      {panoramaSrc && panoramaKind === "image" && (
        <a-sky
          ref={panoramaNodeRef}
          src={panoramaSrc}
          radius={domeRadius}
          position={`0 ${domeVerticalOffset} 0`}
          rotation={effectivePanoramaRotation}
          scale={panoramaScale}
          shadow="cast: false; receive: true"
        />
      )}

      {panoramaSrc && panoramaKind === "video" && (
        <a-videosphere
          ref={panoramaNodeRef}
          src={panoramaSrc}
          radius={domeRadius}
          position={`0 ${domeVerticalOffset} 0`}
          rotation={effectivePanoramaRotation}
          scale={panoramaScale}
          shadow="cast: false; receive: true"
        />
      )}

      {warpOverlays.map((overlay) => (
        <a-entity
          key={`warp-${overlay.id}`}
          warp-image={`src: ${overlay.src}; points: ${encodeURIComponent(JSON.stringify(overlay.points || []))}; opacity: ${Number.isFinite(Number(overlay.opacity)) ? overlay.opacity : 1}; brightness: ${Number.isFinite(Number(overlay.brightness)) ? overlay.brightness : 1}; inset: ${Number.isFinite(Number(overlay.inset)) ? overlay.inset : 0.6}; rotateDeg: ${Number.isFinite(Number(overlay.rotateDeg)) ? overlay.rotateDeg : 0}; flipX: ${overlay.flipX ? true : false}; flipY: ${overlay.flipY ? true : false}; depthMode: ${overlay.depthMode === "occlusion-mask" ? "occlusion-mask" : "none"}; occlusionMaskPoints: ${encodeURIComponent(JSON.stringify(overlay.occlusionMaskPoints || []))}; occlusionMaskInset: ${Number.isFinite(Number(overlay.occlusionMaskInset)) ? overlay.occlusionMaskInset : 0}; doubleSided: true`}
        />
      ))}

      {editDialogOpen && editTipo === "imagem4p" && Array.isArray(editImage4pPoints) && editImage4pPoints.map((p, idx) => (
        <a-sphere
          key={`img4p-point-${idx}`}
          position={`${Number(p.x) || 0} ${Number(p.y) || 0} ${Number(p.z) || 0}`}
          radius="4"
          color="#ffffff"
          material="opacity: 0.85; transparent: true"
          shadow="cast: false; receive: false"
        />
      ))}

      {editDialogOpen && editTipo === "imagem4p" && Array.isArray(editImage4pOcclusionMaskPoints) && editImage4pOcclusionMaskPoints.map((p, idx) => (
        <a-sphere
          key={`img4p-mask-point-${idx}`}
          position={`${Number(p.x) || 0} ${Number(p.y) || 0} ${Number(p.z) || 0}`}
          radius="3.5"
          color="#22c55e"
          material="opacity: 0.85; transparent: true"
          shadow="cast: false; receive: false"
        />
      ))}



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
            : (pos.hide_icon && !canManageHotspots)
              ? null
              : tipoToAFrame[pos.tipo === "navegacao" ? "link" : pos.tipo]?.(pos.conteudo, pos) || null}

          {editDialogOpen && selectedHotspot?.id === pos.id && (
            <a-entity face-camera>
              <a-ring
                radius-inner="21"
                radius-outer="23"
                color="#facc15"
                material="side: double"
                animation="property: scale; from: 1 1 1; to: 1.15 1.15 1.15; dur: 800; dir: alternate; loop: true"
              />
            </a-entity>
          )}

          <a-plane
            className="clickable hotspot-interaction"
            data-id={pos.id}
            position="0 0 0"
            width="25"
            height="25"
            material="color: #fff; opacity: 0; side: double; alphaTest: 1.000"
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

  useEffect(() => {
    if (!editDialogOpen || !selectedHotspot) return;
    const sceneEl = sceneRef.current;
    if (!sceneEl || !sceneEl.camera) return;

    const cameraEl = sceneEl.querySelector('a-camera');
    if (!cameraEl) return;

    const lookControls = cameraEl.components['look-controls'];
    if (!lookControls) return;

    const THREE = window.THREE;
    if (!THREE) return;

    const x = Number(editX) || 0;
    const y = editStickToGround ? floorY : (Number(editY) || 0);
    const z = Number(editZ) || 0;

    const targetPos = new THREE.Vector3(x, y, z);
    const dir = new THREE.Vector3().subVectors(targetPos, new THREE.Vector3(0, 0, 0)).normalize();

    const pitch = Math.asin(dir.y);
    const yaw = Math.atan2(dir.x, dir.z) + Math.PI;

    lookControls.pitchObject.rotation.x = pitch;
    lookControls.yawObject.rotation.y = yaw;
  }, [editDialogOpen, selectedHotspot, editX, editY, editZ, editStickToGround, floorY]);

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
      {isPickingGroundPosition && (
        <div className="absolute top-2 right-2 z-20 rounded-md bg-black/75 px-3 py-2 text-xs text-white">
          Modo colocacao no plano ativo: clica no chao para mover o hotspot.
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
      <div className="h-full w-full relative" style={sceneWarpStyle}>
        {showEditContextMenu ? (
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
              if (!canManageHotspots) return;

              if (value === "create") {
                createHotspot();
              } else if (value === "edit") {
                if (selectedHotspot) {
                  setEditTipo(selectedHotspot.tipo || "");
                  setEditConteudo(selectedHotspot.conteudo || "");
                  setEditYaw(Number(selectedHotspot.rot_yaw) || 0);
                  setEditPitch(Number(selectedHotspot.rot_pitch) || 0);
                  setEditScale(Number(selectedHotspot.scale) || 1);
                  setEditPlacement(
                    String(
                      selectedHotspot.placement
                      || (Math.abs((Number(selectedHotspot.y) || 0) - floorY) <= 0.001 ? "ground" : "")
                    )
                  );
                  setEditStickToGround(
                    String(
                      selectedHotspot.placement
                      || (Math.abs((Number(selectedHotspot.y) || 0) - floorY) <= 0.001 ? "ground" : "")
                    ) === "ground"
                  );
                  setEditModelSelection(
                    selectedHotspot.tipo === "modelo3d" && relativePathFromUploadsUrl(selectedHotspot.conteudo || "")
                      ? createLibrarySelection(relativePathFromUploadsUrl(selectedHotspot.conteudo || ""))
                      : selectedHotspot.tipo === "modelo3d_inspect" && relativePathFromUploadsUrl(decodeInspect3dValue(selectedHotspot.conteudo || "")?.src || "")
                        ? createLibrarySelection(relativePathFromUploadsUrl(decodeInspect3dValue(selectedHotspot.conteudo || "")?.src || ""))
                        : null
                  );
                  setEditImageSelection(
                    selectedHotspot.tipo === "imagem" && relativePathFromUploadsUrl(selectedHotspot.conteudo || "")
                      ? createLibrarySelection(relativePathFromUploadsUrl(selectedHotspot.conteudo || ""))
                      : null
                  );

                  if (selectedHotspot.tipo === "imagem4p") {
                    const payload = decodeImage4pValue(selectedHotspot.conteudo || "");
                    const src = payload?.src || "";
                    setEditImage4pPoints(payload?.points || []);
                    setEditImage4pOpacity(Number.isFinite(Number(payload?.opacity)) ? Number(payload.opacity) : 1);
                    setEditImage4pBrightness(Number.isFinite(Number(payload?.brightness)) ? Number(payload.brightness) : 1);
                    setEditImage4pInset(Number.isFinite(Number(payload?.inset)) ? Number(payload.inset) : 0.6);
                    setEditImage4pRotateDeg(Number.isFinite(Number(payload?.rotateDeg)) ? Number(payload.rotateDeg) : 0);
                    setEditImage4pFlipX(Boolean(payload?.flipX));
                    setEditImage4pFlipY(Boolean(payload?.flipY));
                    setEditImage4pDepthMode(payload?.depthMode === "occlusion-mask" ? "occlusion-mask" : "none");
                    setEditImage4pOcclusionMaskPoints(payload?.occlusionMaskPoints || []);
                    setEditImage4pOcclusionMaskInset(Number.isFinite(Number(payload?.occlusionMaskInset)) ? Number(payload.occlusionMaskInset) : 0);
                    setEditImage4pPreviewUrl(src);
                    const rel = relativePathFromUploadsUrl(src);
                    setEditImage4pSelection(rel ? createLibrarySelection(rel) : null);
                    setIsCapturingImage4pPoints(false);
                    setIsCapturingImage4pMaskPoints(false);
                    setEditInspect3dSrc(null);
                    setEditInspect3dRotationSpeed(1);
                    setEditInspect3dAxis("y");
                    setEditInspect3dButtons([]);
                  } else if (selectedHotspot.tipo === "modelo3d_inspect") {
                    const payload = decodeInspect3dValue(selectedHotspot.conteudo || "");
                    const src = payload?.src || "";
                    setEditInspect3dSrc(src);
                    setEditInspect3dRotationSpeed(Number.isFinite(Number(payload?.rotationSpeed)) ? Number(payload.rotationSpeed) : 1);
                    setEditInspect3dAxis(["x", "y", "z"].includes(payload?.axis) ? payload.axis : "y");
                    setEditInspect3dButtons(Array.isArray(payload?.buttons) ? payload.buttons : []);
                    const rel = relativePathFromUploadsUrl(src);
                    setEditModelSelection(rel ? createLibrarySelection(rel) : null);
                    setEditImage4pSelection(null);
                    setEditImage4pPreviewUrl("");
                    setEditImage4pPoints([]);
                    setEditImage4pOpacity(1);
                    setEditImage4pBrightness(1);
                    setEditImage4pInset(0.6);
                    setEditImage4pRotateDeg(0);
                    setEditImage4pFlipX(false);
                    setEditImage4pFlipY(false);
                    setEditImage4pDepthMode("none");
                    setEditImage4pOcclusionMaskPoints([]);
                    setEditImage4pOcclusionMaskInset(0);
                    setIsCapturingImage4pPoints(false);
                    setIsCapturingImage4pMaskPoints(false);
                  } else {
                    setEditImage4pSelection(null);
                    setEditImage4pPreviewUrl("");
                    setEditImage4pPoints([]);
                    setEditImage4pOpacity(1);
                    setEditImage4pBrightness(1);
                    setEditImage4pInset(0.6);
                    setEditImage4pRotateDeg(0);
                    setEditImage4pFlipX(false);
                    setEditImage4pFlipY(false);
                    setEditImage4pDepthMode("none");
                    setEditImage4pOcclusionMaskPoints([]);
                    setEditImage4pOcclusionMaskInset(0);
                    setIsCapturingImage4pPoints(false);
                    setIsCapturingImage4pMaskPoints(false);
                    setEditInspect3dSrc(null);
                    setEditInspect3dRotationSpeed(1);
                    setEditInspect3dAxis("y");
                    setEditInspect3dButtons([]);
                  }
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
                  setEditHideIcon(Boolean(selectedHotspot.hide_icon));
                  setEditStep("type");
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

        {isImage4pCaptureMode && (
          <>
            <div
              ref={image4pMagnifierCursorBoxRef}
              className="absolute pointer-events-none rounded-sm border-2 border-white/70 outline outline-1 outline-black/50"
              style={{ display: "none" }}
            />
            <div className="absolute right-3 top-3 pointer-events-none rounded border border-black/30 bg-white/80 p-2">
              <div className="text-[11px] font-medium text-black mb-1">Zoom</div>
              <canvas ref={image4pMagnifierCanvasRef} className="block rounded border border-black/20" />
              <div className="mt-1 text-[10px] text-black/70">
                Mira no centro e clica para adicionar ponto.
              </div>
            </div>
          </>
        )}

        {inspectModeHotspotId && (() => {
          const hot = hotspots.find(h => h.id === inspectModeHotspotId);
          if (!hot) return null;
          const payload = decodeInspect3dValue(hot.conteudo);
          if (!payload) return null;

          return (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-end items-center pb-12 z-50">
              <button
                type="button"
                className="absolute top-4 right-4 pointer-events-auto bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold backdrop-blur-sm"
                onClick={() => setInspectModeHotspotId(null)}
              >
                ✕
              </button>
              <div className="flex gap-4 pointer-events-auto overflow-x-auto max-w-full px-4 py-2 drop-shadow-md">
                {payload.buttons?.map((btn, i) => (
                  <a
                    key={i}
                    href={btn.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white hover:bg-gray-100 text-black px-6 py-3 rounded-full font-medium whitespace-nowrap shadow-lg transition-transform hover:scale-105"
                  >
                    {btn.label}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
      <CustomDialog
        open={domeDialogOpen}
        onOpenChange={setDomeDialogOpen}
        title="Editar panorama"
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

          <div className="mt-2 rounded border border-black/10 p-2">
            <div className="text-xs font-semibold text-black/70 mb-2">Guias de Alinhamento</div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAlignmentGuides}
                onChange={(e) => setShowAlignmentGuides(Boolean(e.target.checked))}
              />
              Mostrar linhas-guia no ecrã
            </label>

            <label className="text-sm font-medium mt-2 block">
              Opacidade das guias: {alignmentGuidesOpacity.toFixed(2)}
            </label>
            <input
              className="w-full accent-black"
              type="range"
              min="0.2"
              max="1"
              step="0.01"
              value={alignmentGuidesOpacity}
              onChange={(e) => {
                const nextOpacity = parseFloat(e.target.value);
                if (!Number.isFinite(nextOpacity)) return;
                setAlignmentGuidesOpacity(Math.max(0.2, Math.min(1, nextOpacity)));
              }}
            />
          </div>

          <div className="mt-2 rounded border border-black/10 p-2">
            <div className="text-xs font-semibold text-black/70 mb-2">Alinhamento do Panorama</div>
            <div className="text-xs text-black/60 mb-2">
              O alinhamento é relativo à orientação atual da câmara quando este painel é aberto.
            </div>



            <label className="text-sm font-medium">Alinhamento (Roll): {Math.round(domeRotationZ)}°</label>
            <input
              className="w-full accent-black"
              type="range"
              min="-360"
              max="360"
              step="1"
              value={domeRotationZ}
              onChange={(e) => {
                const nextRotation = parseFloat(e.target.value);
                if (!Number.isFinite(nextRotation)) return;
                persistDomeSettingsForView({ rotationZ: nextRotation });
              }}
            />
            <input
              className="w-full rounded border border-black/20 px-2 py-1 text-sm"
              type="number"
              step="1"
              min="-360"
              max="360"
              value={domeRotationZ}
              onChange={(e) => {
                const nextRotation = parseFloat(e.target.value);
                if (!Number.isFinite(nextRotation)) return;
                persistDomeSettingsForView({ rotationZ: nextRotation });
              }}
            />

            <label className="text-sm font-medium mt-2">Rotacao Horizontal (Yaw relativo): {Math.round(relativeDomeRotationY)}°</label>
            <input
              className="w-full accent-black"
              type="range"
              min="-360"
              max="360"
              step="1"
              value={relativeDomeRotationY}
              onChange={(e) => {
                const nextRelativeRotation = parseFloat(e.target.value);
                if (!Number.isFinite(nextRelativeRotation)) return;
                persistDomeSettingsForView({
                  rotationY: nextRelativeRotation + (Number(cameraAlignmentBase.yaw) || 0),
                });
              }}
            />

            <label className="text-sm font-medium">Rotacao Vertical (Pitch relativo): {Math.round(relativeDomeRotationX)}°</label>
            <input
              className="w-full accent-black"
              type="range"
              min="-180"
              max="180"
              step="1"
              value={relativeDomeRotationX}
              onChange={(e) => {
                const nextRelativeRotation = parseFloat(e.target.value);
                if (!Number.isFinite(nextRelativeRotation)) return;
                persistDomeSettingsForView({
                  rotationX: nextRelativeRotation + (Number(cameraAlignmentBase.pitch) || 0),
                });
              }}
            />

            <div className="mt-2 grid grid-cols-1 gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={domeMirrorX}
                  onChange={(e) => persistDomeSettingsForView({ mirrorX: Boolean(e.target.checked) })}
                />
                Espelhar horizontalmente
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={domeMirrorY}
                  onChange={(e) => persistDomeSettingsForView({ mirrorY: Boolean(e.target.checked) })}
                />
                Espelhar verticalmente
              </label>
            </div>
          </div>
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
            {/* Tabs/Steps Navigation */}
            <div className="flex gap-1 mb-3 border-b border-black/10 overflow-x-auto">
              {["type", "content", "position", "transform", "styling", editTipo === "navegacao" ? "navigation" : null].filter(Boolean).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setEditStep(step)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-t border-b-2 transition-colors ${editStep === step
                    ? "border-b-black text-black"
                    : "border-b-transparent text-neutral-600 hover:text-black"
                    }`}
                >
                  {step === "type" && "Tipo"}
                  {step === "content" && "Conteúdo"}
                  {step === "position" && "Posição"}
                  {step === "transform" && "Transformação"}
                  {step === "styling" && "Estilo"}
                  {step === "navigation" && "Navegação"}
                </button>
              ))}
            </div>

            {/* Step 1: Tipo */}
            {editStep === "type" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Tipo de Hotspot:</label>
                <DropdownSingle
                  label={tipos.find(t => t.value === editTipo)?.label || "Seleciona o tipo"}
                  selectlabel="Tipo de Hotspot"
                  items={tipos}
                  onSelect={(value) => {
                    setEditTipo(value);
                    // Se muda para um tipo que não é navegacao e está no step navegacao, volta para styling
                    if (value !== "navegacao" && editStep === "navigation") {
                      setEditStep("styling");
                    }
                  }}
                  className="mt-1"
                />
              </div>
            )}

            {/* Step 2: Content */}
            {editStep === "content" && (
              <div className="flex flex-col gap-2">
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
                ) : editTipo === "modelo3d_inspect" ? (
                  <div className="flex flex-col gap-2">
                    <MediaSourceField
                      label="Modelo 3D Inspeção (GLB/GLTF)"
                      accept=".glb,.gltf,model/gltf+json,model/gltf-binary"
                      selection={editModelSelection}
                      onChange={(selection) => {
                        setEditModelSelection(selection);
                        if (!selection) {
                          setEditInspect3dSrc(null);
                          return;
                        }

                        if (selection.source === "library") {
                          setEditInspect3dSrc(selection.url || resolveUploadsUrl(selection.path || "") || "");
                          return;
                        }

                        setEditInspect3dSrc(selection.file?.name || "");
                      }}
                      destinationPath="modelos3d"
                      helperText="Selecione o modelo para rotação e inspeção."
                    />

                    <label className="text-sm font-medium mt-1">Eixo de Rotação:</label>
                    <select
                      value={editInspect3dAxis}
                      onChange={(e) => setEditInspect3dAxis(e.target.value)}
                      className="border rounded px-2 py-1 text-sm dark:bg-black"
                    >
                      <option value="x">X</option>
                      <option value="y">Y</option>
                      <option value="z">Z</option>
                    </select>

                    <label className="text-sm font-medium mt-1">Velocidade de Rotação:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editInspect3dRotationSpeed}
                      onChange={(e) => setEditInspect3dRotationSpeed(parseFloat(e.target.value))}
                      className="border rounded px-2 py-1 text-sm dark:bg-black"
                    />

                    <label className="text-sm font-medium mt-1">Botões de Ação:</label>
                    <div className="border border-black/10 rounded p-2 flex flex-col gap-2 max-h-40 overflow-y-auto">
                      {editInspect3dButtons.map((btn, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Label do botão"
                            value={btn.label}
                            onChange={(e) => {
                              const newBtns = [...editInspect3dButtons];
                              newBtns[index].label = e.target.value;
                              setEditInspect3dButtons(newBtns);
                            }}
                            className="border rounded px-2 py-1 text-sm flex-1 dark:bg-black"
                          />
                          <input
                            type="text"
                            placeholder="URL (https://...)"
                            value={btn.url}
                            onChange={(e) => {
                              const newBtns = [...editInspect3dButtons];
                              newBtns[index].url = e.target.value;
                              setEditInspect3dButtons(newBtns);
                            }}
                            className="border rounded px-2 py-1 text-sm flex-1 dark:bg-black"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newBtns = editInspect3dButtons.filter((_, i) => i !== index);
                              setEditInspect3dButtons(newBtns);
                            }}
                            className="text-red-500 hover:text-red-700 font-bold px-2"
                          >
                            X
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditInspect3dButtons([...editInspect3dButtons, { label: "", url: "" }])}
                        className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white self-start"
                      >
                        + Adicionar botão
                      </button>
                    </div>
                  </div>
                ) : editTipo === "imagem4p" ? (
                  <div className="flex flex-col gap-2">
                    <MediaSourceField
                      label="Imagem (warp 4 pontos)"
                      accept="image/*"
                      selection={editImage4pSelection}
                      onChange={(selection) => {
                        if (typeof editImage4pPreviewUrl === "string" && editImage4pPreviewUrl.startsWith("blob:")) {
                          try {
                            URL.revokeObjectURL(editImage4pPreviewUrl);
                          } catch {
                            // ignore
                          }
                        }

                        setEditImage4pSelection(selection);

                        if (!selection) {
                          setEditImage4pPreviewUrl("");
                          return;
                        }

                        if (selection.source === "library") {
                          setEditImage4pPreviewUrl(selection.url || resolveUploadsUrl(selection.path || "") || "");
                          return;
                        }

                        if (selection.source === "device" && selection.file) {
                          setEditImage4pPreviewUrl(URL.createObjectURL(selection.file));
                          return;
                        }

                        setEditImage4pPreviewUrl("");
                      }}
                      destinationPath="media"
                      helperText="Escolhe ou envia a imagem que queres projetar no outdoor/mupi."
                    />

                    <div className="rounded border border-black/10 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Pontos: {Array.isArray(editImage4pPoints) ? editImage4pPoints.length : 0} (mín. 4)</div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCapturingImage4pMaskPoints(false);
                            setIsCapturingImage4pPoints((prev) => !prev);
                          }}
                          className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                        >
                          {isCapturingImage4pPoints ? "Parar captura" : "Capturar no 360"}
                        </button>
                      </div>
                      {isCapturingImage4pPoints && (
                        <div className="mt-1 text-xs text-neutral-600">
                          Clica no 360 para adicionar pontos (em ordem à volta do outdoor).
                        </div>
                      )}

                      <div className="mt-3 rounded border border-black/10 p-2">
                        <label className="text-xs font-medium">Profundidade / Oclusão</label>
                        <select
                          value={editImage4pDepthMode}
                          onChange={(e) => setEditImage4pDepthMode(e.target.value === "occlusion-mask" ? "occlusion-mask" : "none")}
                          className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-black"
                        >
                          <option value="none">Sem oclusão</option>
                          <option value="occlusion-mask">Máscara de oclusão (objetos à frente)</option>
                        </select>

                        {editImage4pDepthMode === "occlusion-mask" && (
                          <>
                            <div className="mt-2 text-xs text-neutral-600">
                              Define uma máscara para os objetos em primeiro plano (ex.: poste). A imagem 4 pontos ficará atrás dessa máscara.
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Máscara: {Array.isArray(editImage4pOcclusionMaskPoints) ? editImage4pOcclusionMaskPoints.length : 0} pontos (mín. 3)</div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCapturingImage4pPoints(false);
                                  setIsCapturingImage4pMaskPoints((prev) => !prev);
                                }}
                                className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                              >
                                {isCapturingImage4pMaskPoints ? "Parar máscara" : "Capturar máscara no 360"}
                              </button>
                            </div>

                            {isCapturingImage4pMaskPoints && (
                              <div className="mt-1 text-xs text-neutral-600">
                                Clica no 360 para desenhar o contorno do objeto que deve ficar à frente.
                              </div>
                            )}

                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditImage4pOcclusionMaskPoints((prev) => (Array.isArray(prev) ? prev.slice(0, -1) : []))}
                                className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                              >
                                Remover último (máscara)
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditImage4pOcclusionMaskPoints([])}
                                className="rounded border border-red-600/30 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Limpar máscara
                              </button>
                            </div>

                            <div className="mt-2 flex flex-col gap-1">
                              <label className="text-xs font-medium">Inset da máscara (aprox. câmara)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={editImage4pOcclusionMaskInset}
                                onChange={(e) => {
                                  const next = parseFloat(e.target.value);
                                  if (!Number.isFinite(next)) return;
                                  setEditImage4pOcclusionMaskInset(next);
                                }}
                                className="border rounded px-2 py-1 text-sm dark:bg-black"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nx = Number(editX);
                            const ny = Number(editY);
                            const nz = Number(editZ);
                            if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return;
                            setEditImage4pPoints((prev) => [...(Array.isArray(prev) ? prev : []), { x: nx, y: ny, z: nz }]);
                          }}
                          className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                        >
                          Adicionar ponto (XYZ atual)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditImage4pPoints((prev) => (Array.isArray(prev) ? prev.slice(0, -1) : []))}
                          className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                        >
                          Remover último
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditImage4pPoints([])}
                          className="rounded border border-red-600/30 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Limpar
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium">Opacidade</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={editImage4pOpacity}
                            onChange={(e) => {
                              const next = parseFloat(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setEditImage4pOpacity(Math.max(0, Math.min(1, next)));
                            }}
                            className="w-full accent-black"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium">Brilho: {Number(editImage4pBrightness || 0).toFixed(2)}</label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={editImage4pBrightness}
                            onChange={(e) => {
                              const next = parseFloat(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setEditImage4pBrightness(Math.max(0, Math.min(5, next)));
                            }}
                            className="w-full accent-black"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium">Inset (evitar z-fight)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editImage4pInset}
                            onChange={(e) => {
                              const next = parseFloat(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setEditImage4pInset(next);
                            }}
                            className="border rounded px-2 py-1 text-sm dark:bg-black"
                          />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium">Rotação (°)</label>
                          <input
                            type="number"
                            step="1"
                            value={editImage4pRotateDeg}
                            onChange={(e) => {
                              const next = parseFloat(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setEditImage4pRotateDeg(next);
                            }}
                            className="border rounded px-2 py-1 text-sm dark:bg-black"
                          />
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={editImage4pFlipX}
                              onChange={(e) => setEditImage4pFlipX(Boolean(e.target.checked))}
                              className="accent-black"
                            />
                            Espelhar H
                          </label>
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={editImage4pFlipY}
                              onChange={(e) => setEditImage4pFlipY(Boolean(e.target.checked))}
                              className="accent-black"
                            />
                            Espelhar V
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : editTipo === "imagem" ? (
                  <MediaSourceField
                    label="Imagem (Media Library)"
                    accept="image/*"
                    selection={editImageSelection}
                    onChange={(selection) => {
                      setEditImageSelection(selection);
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
                    destinationPath="media"
                    helperText="Escolhe ou envia uma imagem no File Manager para exibir."
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
              </div>
            )}

            {/* Step 3: Position */}
            {editStep === "position" && (
              <div className="flex flex-col gap-2">
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

                <label className="inline-flex items-center gap-2 text-sm font-medium mt-2">
                  <input
                    type="checkbox"
                    checked={editStickToGround}
                    onChange={(e) => {
                      const enabled = Boolean(e.target.checked);
                      setEditStickToGround(enabled);
                      if (enabled) {
                        setPositionAndAnglesFromXYZ(editX, floorY, editZ);
                      }
                    }}
                    className="accent-black"
                  />
                  Stick to ground
                </label>

                {editStickToGround && (
                  <div className="rounded border border-black/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-700">Clica no plano para posicionar rapidamente.</span>
                      <button
                        type="button"
                        onClick={() => setIsPickingGroundPosition((prev) => !prev)}
                        className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                      >
                        {isPickingGroundPosition ? "Parar colocacao" : "Colocar no plano"}
                      </button>
                    </div>
                  </div>
                )}

                <label className="text-sm font-medium">
                  {editStickToGround ? "Posição Y (plano):" : "Posição Y:"} {editStickToGround ? (Number(editZ) || 0).toFixed(1) : (Number(editY) || 0).toFixed(1)}
                </label>
                <input
                  type="range"
                  min={positionSliderMin}
                  max={positionSliderMax}
                  step="0.1"
                  value={editStickToGround ? (Number(editZ) || 0) : (Number(editY) || 0)}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    if (!Number.isFinite(next)) return;
                    if (editStickToGround) {
                      setPositionAndAnglesFromXYZ(editX, floorY, next);
                      return;
                    }
                    setPositionAndAnglesFromXYZ(editX, next, editZ);
                  }}
                  className="w-full accent-black"
                />

                {!editStickToGround && (
                  <>
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
                  </>
                )}
              </div>
            )}

            {/* Step 4: Transform */}
            {editStep === "transform" && (
              <div className="flex flex-col gap-2">
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
              </div>
            )}

            {/* Step 5: Styling */}
            {editStep === "styling" && (
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={editHideIcon}
                    onChange={(e) => setEditHideIcon(Boolean(e.target.checked))}
                    className="accent-black"
                  />
                  Ocultar ícone de hotspot para utilizadores
                </label>
              </div>
            )}

            {/* Step 6: Navigation */}
            {editStep === "navigation" && (
              <div className="flex flex-col gap-2">
                {editTipo === "navegacao" ? (
                  <>
                    <label className="text-sm font-medium mt-2">Destino de navegação:</label>
                    <DropdownSingle
                      label={
                        editNavigationMode === "back"
                          ? "Anterior"
                          : (editNavigationMode === "point" ? "Outro ponto" : "Próxima vista (imagem/vídeo)")
                      }
                      selectlabel="Destino"
                      items={[
                        { label: "Próxima vista (imagem/vídeo)", value: "file" },
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
                        <label className="text-sm font-medium mt-2">Vista (imagem/vídeo):</label>
                        <MediaSourceField
                          label="Ficheiro de navegação"
                          accept="image/*,video/mp4,.hdr,.exr"
                          selection={editNavigationSelection}
                          onChange={(selection) => {
                            setEditNavigationSelection(selection);
                            setEditPontoDestino("");
                            setEditNavigationMode("file");
                          }}
                          destinationPath="pontos"
                          helperText="Escolhe ou envia um ficheiro de imagem ou vídeo para navegar entre vistas dentro deste ponto inicial."
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
                ) : (
                  <div className="text-xs text-neutral-600">
                    Navegação apenas disponível para hotspots do tipo "Navegação".
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CustomDialog>
    </div>
  );
};

export default dynamic(() => Promise.resolve(AFrameViewer), { ssr: false });