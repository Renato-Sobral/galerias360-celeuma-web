"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import "aframe";
import ContextMenuWrapper from "./ContextMenuWrapper";
import CustomDialog from "./CustomDialog";
import DropdownSingle from "./select";
import MediaSourceField from "./MediaSourceField";
import { Button } from "@/components/ui/button";
import Swal from "sweetalert2";
import {
  createLibrarySelection,
  resolveMediaSelection,
  resolveUploadsUrl,
  relativePathFromUploadsUrl,
  uploadFileToMediaLibrary,
} from "../lib/media-library";
import { getUserRoleFromToken, getUserRoleIdFromToken, getUserIdFromToken } from "./jwtDecode";

// Hook para drag-to-change em inputs numéricos (estilo Blender)
const useDragToChange = (value, onChange, sensitivity = 0.5) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startValueRef = useRef(value);
  const hasDraggedRef = useRef(false);

  const handleMouseDown = (e, inputRef) => {
    // Não inicia drag logo, espera para ver se o utilizador arrasta
    startXRef.current = e.clientX;
    startValueRef.current = Number(value) || 0;
    hasDraggedRef.current = false;
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (hasDraggedRef.current || !startXRef.current) return;

      const deltaX = e.clientX - startXRef.current;

      // Se moveu mais de 2 pixels, começa o drag
      if (Math.abs(deltaX) > 2) {
        hasDraggedRef.current = true;
        setIsDragging(true);
        document.body.style.cursor = "ew-resize";
      }
    };

    const handleMouseMove2 = (e) => {
      if (!hasDraggedRef.current || !isDragging) return;

      const deltaX = e.clientX - startXRef.current;
      let multiplier = sensitivity;

      if (e.shiftKey) multiplier *= 0.1; // Mais preciso
      if (e.ctrlKey || e.metaKey) multiplier *= 2; // Menos preciso

      const newValue = startValueRef.current + deltaX * multiplier;
      onChange(newValue);
    };

    const handleMouseUp = () => {
      document.body.style.userSelect = "";
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = "";
      }
      startXRef.current = 0;
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove2);
    } else {
      document.addEventListener("mousemove", handleMouseMove);
    }

    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousemove", handleMouseMove2);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, sensitivity, onChange]);

  return { isDragging, handleMouseDown };
};

// Componente para input numérico com drag (estilo Blender)
function DragNumberInput({ label, value, onChange, step = 0.1 }) {
  const inputRef = useRef(null);
  const { isDragging, handleMouseDown } = useDragToChange(value, onChange, step);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // When external value changes and we're not editing, ensure displayed value updates
  useEffect(() => {
    if (!isEditing) setEditValue("");
  }, [value, isEditing]);

  const handleInputMouseDown = (e) => {
    handleMouseDown(e, inputRef);
    // don't immediately clear; wait to see if the user drags (isDragging will become true)
  };

  const handleMouseUp = () => {
    // If the user didn't start dragging, treat as a click -> enter edit mode and clear
    if (!isDragging) {
      setIsEditing(true);
      setEditValue("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const commitEdit = () => {
    const raw = String(editValue || "").trim().replace(",", ".");
    const next = parseFloat(raw);
    if (Number.isFinite(next)) onChange(next);
    setIsEditing(false);
    setEditValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      commitEdit();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue("");
      inputRef.current?.blur();
    }
  };

  const handleChange = (e) => {
    if (isEditing) {
      setEditValue(e.target.value);
    } else {
      const next = parseFloat(e.target.value);
      if (!Number.isFinite(next)) return;
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium">{label}</label>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        step={step}
        value={isEditing ? editValue : (Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "0.0")}
        onChange={handleChange}
        onMouseDown={handleInputMouseDown}
        onMouseUp={handleMouseUp}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (isEditing) commitEdit(); }}
        className={`border rounded px-2 py-1 text-sm dark:bg-black cursor-ew-resize ${isDragging ? "ring-2 ring-cyan-500" : ""}`}
      />
    </div>
  );
}

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

  const isAdminUser = useMemo(() => String(userRole || "").toLowerCase() === "admin", [userRole]);

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
  const DEFAULT_HOTSPOT_CUSTOM_CONFIG = {
    enabled: false,
    allow_content: { enabled: false, maxLength: 20000 },
    allow_position: { enabled: false, range: 250 },
    allow_transform: {
      enabled: false,
      scale: { min: HOTSPOT_SCALE_MIN, max: 10 },
      yaw: { min: -360, max: 360 },
      pitch: { min: -180, max: 180 },
    },
  };
  const HOTSPOT_DEFAULT_ICON_PATHS = {
    texto: "icons/Text.png",
    audio: "icons/Audio.png",
    audioespacial: "icons/Audio3D.png",
    imagem: "icons/Imagem.png",
    imagem4p: "icons/Imagem4P.png",
    modelo3d: "icons/Modelo3D.png",
    modelo3d_inspect: "icons/InspecaoModelo3D.png",
    link: "icons/Link.png",
    navegacao: "icons/Navegacao.png",
    video: "icons/Video.png",
  };
  const DEFAULT_HOTSPOT_ICON_CONFIG = {
    icon_type: "default",
    icon_color: "#06b6d4",
    text_font: "roboto",
    custom_icons: {},
  };
  const DEFAULT_PANORAMA_DOME_RADIUS = 700;
  // Hotspots não devem ficar perto demais da câmara — distância mínima em unidades do mundo
  const MIN_HOTSPOT_DISTANCE_FROM_CAMERA = 50;
  const DEFAULT_DOME_ROTATION_Y = -130;
  const DEFAULT_DOME_ROTATION_X = 0;
  const DEFAULT_DOME_ROTATION_Z = 0;
  const DEFAULT_DOME_MIRROR_X = false;
  const DEFAULT_DOME_MIRROR_Y = false;
  const DEFAULT_AMBIENT_LIGHT_INTENSITY = 1.5;
  const DEFAULT_POINT_LIGHT_INTENSITY = 1;
  const DEFAULT_POINT_LIGHT_COLOR = "#ffffff";
  const DEFAULT_POINT_LIGHT_DISTANCE = 2200;
  const formatNumberOneDecimal = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n ?? "");
    // uma casa decimal e vírgula como separador decimal
    return num.toFixed(1).replace(".", ",");
  };
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

  const normalizeHotspotCustomConfig = (rawConfig) => {
    const cfg = (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) ? rawConfig : {};
    const allowContent = (cfg.allow_content && typeof cfg.allow_content === 'object') ? cfg.allow_content : {};
    const allowPosition = (cfg.allow_position && typeof cfg.allow_position === 'object') ? cfg.allow_position : {};
    const allowTransform = (cfg.allow_transform && typeof cfg.allow_transform === 'object') ? cfg.allow_transform : {};

    const scaleCfg = (allowTransform.scale && typeof allowTransform.scale === 'object') ? allowTransform.scale : {};
    const yawCfg = (allowTransform.yaw && typeof allowTransform.yaw === 'object') ? allowTransform.yaw : {};
    const pitchCfg = (allowTransform.pitch && typeof allowTransform.pitch === 'object') ? allowTransform.pitch : {};

    return {
      enabled: Boolean(cfg.enabled),
      allow_content: {
        enabled: Boolean(allowContent.enabled),
        maxLength: Math.max(0, Math.floor(toFiniteNumber(allowContent.maxLength, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_content.maxLength))),
      },
      allow_position: {
        enabled: Boolean(allowPosition.enabled),
        range: Math.max(0, toFiniteNumber(allowPosition.range, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_position.range)),
      },
      allow_transform: {
        enabled: Boolean(allowTransform.enabled),
        scale: {
          min: Math.max(HOTSPOT_SCALE_MIN, toFiniteNumber(scaleCfg.min, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_transform.scale.min)),
          max: Math.max(HOTSPOT_SCALE_MIN, toFiniteNumber(scaleCfg.max, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_transform.scale.max)),
        },
        yaw: {
          min: toFiniteNumber(yawCfg.min, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_transform.yaw.min),
          max: toFiniteNumber(yawCfg.max, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_transform.yaw.max),
        },
        pitch: {
          min: toFiniteNumber(pitchCfg.min, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_transform.pitch.min),
          max: toFiniteNumber(pitchCfg.max, DEFAULT_HOTSPOT_CUSTOM_CONFIG.allow_transform.pitch.max),
        },
      },
    };
  };

  const normalizeUserOverrides = (rawOverrides) => {
    const obj = (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) ? rawOverrides : {};
    const out = {};
    if (typeof obj.conteudo === 'string') out.conteudo = obj.conteudo;
    for (const key of ['dx', 'dy', 'dz', 'scale', 'rot_yaw', 'rot_pitch']) {
      const num = Number(obj[key]);
      if (Number.isFinite(num)) out[key] = num;
    }
    return out;
  };

  const getUserCustomizationStorageKey = (userId, pointId) => {
    const safeUserId = Number.isFinite(Number(userId)) ? Number(userId) : "guest";
    const safePointId = String(pointId || pontoId || "default");
    return `galerias360:userHotspotCustomizations:${safeUserId}:${safePointId}`;
  };

  const filterOverridesByCustomConfig = (overrides, customConfig, hotspotType = "") => {
    const cfg = normalizeHotspotCustomConfig(customConfig);
    if (!cfg.enabled) return {};

    const out = {};
    if (cfg.allow_content.enabled && typeof overrides.conteudo === 'string') {
      if (String(hotspotType || "") === "imagem4p") {
        out.conteudo = overrides.conteudo;
      } else {
        out.conteudo = overrides.conteudo.slice(0, cfg.allow_content.maxLength);
      }
    }
    if (cfg.allow_position.enabled) {
      const range = cfg.allow_position.range;
      for (const key of ['dx', 'dy', 'dz']) {
        if (typeof overrides[key] === 'number') {
          out[key] = Math.max(-range, Math.min(range, overrides[key]));
        }
      }
    }
    if (cfg.allow_transform.enabled) {
      if (typeof overrides.scale === 'number') {
        out.scale = Math.max(cfg.allow_transform.scale.min, Math.min(cfg.allow_transform.scale.max, overrides.scale));
      }
      if (typeof overrides.rot_yaw === 'number') {
        out.rot_yaw = Math.max(cfg.allow_transform.yaw.min, Math.min(cfg.allow_transform.yaw.max, overrides.rot_yaw));
      }
      if (typeof overrides.rot_pitch === 'number') {
        out.rot_pitch = Math.max(cfg.allow_transform.pitch.min, Math.min(cfg.allow_transform.pitch.max, overrides.rot_pitch));
      }
    }
    return out;
  };

  const applyUserOverridesToHotspot = (hotspot, rawOverrides) => {
    const cfg = normalizeHotspotCustomConfig(hotspot?.custom_config);
    if (!cfg.enabled) return hotspot;

    const overrides = filterOverridesByCustomConfig(normalizeUserOverrides(rawOverrides), cfg);
    if (!overrides || Object.keys(overrides).length === 0) return hotspot;

    const baseX = toFiniteNumber(hotspot?.x, 0);
    const baseY = toFiniteNumber(hotspot?.y, 0);
    const baseZ = toFiniteNumber(hotspot?.z, 0);

    return {
      ...hotspot,
      x: typeof overrides.dx === 'number' ? baseX + overrides.dx : hotspot.x,
      y: typeof overrides.dy === 'number' ? baseY + overrides.dy : hotspot.y,
      z: typeof overrides.dz === 'number' ? baseZ + overrides.dz : hotspot.z,
      scale: typeof overrides.scale === 'number' ? overrides.scale : hotspot.scale,
      rot_yaw: typeof overrides.rot_yaw === 'number' ? overrides.rot_yaw : hotspot.rot_yaw,
      rot_pitch: typeof overrides.rot_pitch === 'number' ? overrides.rot_pitch : hotspot.rot_pitch,
      conteudo: typeof overrides.conteudo === 'string' ? overrides.conteudo : hotspot.conteudo,
    };
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

  const resolveModel3dSrc = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return "";

    if (
      value.startsWith("http://")
      || value.startsWith("https://")
      || value.startsWith("blob:")
      || value.startsWith("data:")
    ) {
      return value;
    }

    const relFromUploads = relativePathFromUploadsUrl(value);
    if (relFromUploads) {
      return resolveUploadsUrl(relFromUploads) || value;
    }

    // Legacy/hand-entered values might already be relative to /uploads.
    const looksLikeModelFile = /\.(glb|gltf|obj)(\?|#|$)/i.test(value);
    if (looksLikeModelFile) {
      const safeRel = value.replace(/^\/+/, "");
      return resolveUploadsUrl(safeRel) || value;
    }

    return value;
  };

  const encodeDestinationPointContent = (targetPontoId) => `${NAV_POINT_PREFIX}${targetPontoId}`;
  const encodeDestinationFileContent = (targetFilePath) => `${NAV_FILE_PREFIX}${targetFilePath}`;
  const encodeDestinationBackContent = () => NAV_BACK_VALUE;

  const normalizeModelOffset = (offset) => ({
    x: toFiniteNumber(offset?.x, 0),
    y: toFiniteNumber(offset?.y, 0),
    z: toFiniteNumber(offset?.z, 0),
  });

  const normalizeModelScale = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0.01, parsed);
  };

  const encodeHotspotContent = (rawValue, viewPath, scale = 1, rotYaw = 0, rotPitch = 0, placement = "", modelOffset = null, modelScale = null, inspectModelOffset = null, inspectModelScale = null) => {
    const normalizedOffset = modelOffset ? normalizeModelOffset(modelOffset) : null;
    const normalizedModelScale = modelScale == null ? null : normalizeModelScale(modelScale);
    const normalizedInspectOffset = inspectModelOffset ? normalizeModelOffset(inspectModelOffset) : null;
    const normalizedInspectModelScale = inspectModelScale == null ? null : normalizeModelScale(inspectModelScale);
    const payload = {
      value: String(rawValue || ""),
      view: String(viewPath || "").replace(/^\/+/, ""),
      scale: Number.isFinite(Number(scale))
        ? Math.max(HOTSPOT_SCALE_MIN, Number(scale))
        : 1,
      rotYaw: Number.isFinite(Number(rotYaw)) ? Number(rotYaw) : 0,
      rotPitch: Number.isFinite(Number(rotPitch)) ? Number(rotPitch) : 0,
      placement: String(placement || ""),
      ...(normalizedOffset ? { modelOffset: normalizedOffset } : {}),
      ...(normalizedModelScale != null ? { modelScale: normalizedModelScale } : {}),
      ...(normalizedInspectOffset ? { inspectModelOffset: normalizedInspectOffset } : {}),
      ...(normalizedInspectModelScale != null ? { inspectModelScale: normalizedInspectModelScale } : {}),
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
      return {
        value,
        view: "",
        scale: 1,
        rotYaw: 0,
        rotPitch: 0,
        placement: "",
        modelOffset: { x: 0, y: 0, z: 0 },
        modelScale: 1,
        inspectModelOffset: { x: 0, y: 0, z: 0 },
        inspectModelScale: 1,
      };
    }

    try {
      const encoded = value.slice(HOTSPOT_META_PREFIX.length);
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json);
      const modelOffset = normalizeModelOffset(parsed?.modelOffset);
      const modelScale = normalizeModelScale(parsed?.modelScale);
      const inspectModelOffset = normalizeModelOffset(parsed?.inspectModelOffset ?? parsed?.modelOffset);
      const inspectModelScale = normalizeModelScale(parsed?.inspectModelScale ?? parsed?.modelScale);
      return {
        value: String(parsed?.value || ""),
        view: String(parsed?.view || "").replace(/^\/+/, ""),
        scale: Number.isFinite(Number(parsed?.scale))
          ? Math.max(HOTSPOT_SCALE_MIN, Number(parsed.scale))
          : 1,
        rotYaw: Number.isFinite(Number(parsed?.rotYaw)) ? Number(parsed.rotYaw) : 0,
        rotPitch: Number.isFinite(Number(parsed?.rotPitch)) ? Number(parsed.rotPitch) : 0,
        placement: String(parsed?.placement || ""),
        modelOffset,
        modelScale,
        inspectModelOffset,
        inspectModelScale,
      };
    } catch {
      return {
        value,
        view: "",
        scale: 1,
        rotYaw: 0,
        rotPitch: 0,
        placement: "",
        modelOffset: { x: 0, y: 0, z: 0 },
        modelScale: 1,
        inspectModelOffset: { x: 0, y: 0, z: 0 },
        inspectModelScale: 1,
      };
    }
  };

  const compressImageFile = async (file) => {
    const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
    const MAX_DIMENSION = 1024; // smaller for performance

    return new Promise((resolve, reject) => {
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`Imagem demasiado grande. Máximo: 2MB. Tamanho: ${(file.size / 1024 / 1024).toFixed(2)}MB`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onload = () => {
                       try {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // Redimensionar se necessário
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
              const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
                         if (!ctx) {
                           reject(new Error("Falha ao criar contexto canvas"));
                           return;
                         }
            ctx.drawImage(img, 0, 0, width, height);

               // Converter para JPEG comprimido com qualidade progressiva
               let quality = 0.8;
               const attemptCompress = () => {
                 canvas.toBlob((blob) => {
                   if (!blob) {
                     if (quality > 0.3) {
                       quality -= 0.1;
                       attemptCompress();
                     } else {
                       reject(new Error("Falha ao comprimir imagem"));
                     }
                     return;
                   }

                   const compressedReader = new FileReader();
                   compressedReader.onload = () => {
                     const dataUrl = String(compressedReader.result || "");
                     if (!dataUrl.startsWith("data:")) {
                       reject(new Error("Falha ao converter imagem para data URL"));
                       return;
                     }
                     resolve(dataUrl);
                   };
                   compressedReader.onerror = () => reject(new Error("Falha ao ler blob comprimido"));
                   compressedReader.readAsDataURL(blob);
                 }, "image/jpeg", quality);
               };
               attemptCompress();
             } catch (error) {
               reject(error);
             }
          };
          img.onerror = () => reject(new Error("Falha ao carregar imagem"));
          img.src = String(e.target?.result || "");
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Falha ao ler ficheiro"));
      reader.readAsDataURL(file);
    });
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
      axis: (payload?.axis && typeof payload.axis === 'object') ? payload.axis : { x: false, y: true, z: false },
      autoRotate: Boolean(payload?.autoRotate),
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
      
      // Normalizar axis (pode ser string legacy ou novo objeto booleano)
      let axisObj = { x: false, y: true, z: false };
      if (parsed?.axis && typeof parsed.axis === 'object' && !Array.isArray(parsed.axis)) {
        axisObj = {
          x: Boolean(parsed.axis.x),
          y: Boolean(parsed.axis.y),
          z: Boolean(parsed.axis.z),
        };
      }
      
      return {
        src: String(parsed?.src || ""),
        rotationSpeed: Number.isFinite(Number(parsed?.rotationSpeed)) ? Number(parsed.rotationSpeed) : 1,
        axis: axisObj,
        autoRotate: Boolean(parsed?.autoRotate),
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
  const fileInputRef = useRef(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStep, setEditStep] = useState("type");
  const [domeDialogOpen, setDomeDialogOpen] = useState(false);
  const [domeEditStep, setDomeEditStep] = useState("guides");
  const [showAlignmentGuides, setShowAlignmentGuides] = useState(true);
  const [alignmentGuidesOpacity, setAlignmentGuidesOpacity] = useState(0.65);
  const [editTipo, setEditTipo] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const [editX, setEditX] = useState(0);
  const [editY, setEditY] = useState(0);
  const [editZ, setEditZ] = useState(0);
  const [editStickToGround, setEditStickToGround] = useState(false);
  const [editHideIcon, setEditHideIcon] = useState(false);
  const [editCustomConfig, setEditCustomConfig] = useState(() => DEFAULT_HOTSPOT_CUSTOM_CONFIG);
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
  const [editModelOffsetX, setEditModelOffsetX] = useState(0);
  const [editModelOffsetY, setEditModelOffsetY] = useState(0);
  const [editModelOffsetZ, setEditModelOffsetZ] = useState(0);
  const [editModelScale, setEditModelScale] = useState(1);
  const [editInspectModelOffsetX, setEditInspectModelOffsetX] = useState(0);
  const [editInspectModelOffsetY, setEditInspectModelOffsetY] = useState(0);
  const [editInspectModelOffsetZ, setEditInspectModelOffsetZ] = useState(0);
  const [editInspectModelScale, setEditInspectModelScale] = useState(1);
  const [editPlacement, setEditPlacement] = useState("");
  const [editPontoDestino, setEditPontoDestino] = useState("");
  const [editNavigationSelection, setEditNavigationSelection] = useState(null);
  const [editNavigationPath, setEditNavigationPath] = useState("");
  const [editNavigationMode, setEditNavigationMode] = useState("file");
  const [editModelSelection, setEditModelSelection] = useState(null);
  const [editImageSelection, setEditImageSelection] = useState(null);
  const [editImage4pSelection, setEditImage4pSelection] = useState(null);
  const [editImage4pTab, setEditImage4pTab] = useState("files");
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
  const editImage4pHasOcclusion = editImage4pDepthMode === "occlusion-mask";
  const [inspectModeHotspotId, setInspectModeHotspotId] = useState(null);
  const inspectModeHotspotIdRef = useRef(null);
  const [inspectModelRotationAxes, setInspectModelRotationAxes] = useState({ x: false, y: true, z: false });
  const [inspectAutoRotate, setInspectAutoRotate] = useState(false);
  const [editInspect3dSrc, setEditInspect3dSrc] = useState(null);
  const [editInspect3dRotationSpeed, setEditInspect3dRotationSpeed] = useState(1);
  const [editInspect3dAxis, setEditInspect3dAxis] = useState({ x: false, y: true, z: false });
  const [editInspect3dAutoRotate, setEditInspect3dAutoRotate] = useState(false);
  const [editInspect3dButtons, setEditInspect3dButtons] = useState([]);
  const [inspectModelYaw, setInspectModelYaw] = useState(0);
  const [inspectModelPitch, setInspectModelPitch] = useState(0);
  const [inspectModelRoll, setInspectModelRoll] = useState(0);
  const inspectMouseDownRef = useRef(false);
  const inspectMouseStartRef = useRef({ x: 0, y: 0 });
  const inspectModelRef = useRef(null);
  const [inspectModelWorldPos, setInspectModelWorldPos] = useState(null);
  const [inspectAnimating, setInspectAnimating] = useState(false);
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
  const domeSettingsSaveTimerRef = useRef(null);
  const userCustomSyncTimerRef = useRef(null);
  const userCustomSyncPendingRef = useRef(null);
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

  const [myHotspotCustomizations, setMyHotspotCustomizations] = useState({});
  const [userCustomMenuOpen, setUserCustomMenuOpen] = useState(false);
  const [userCustomHotspot, setUserCustomHotspot] = useState(null);
  const [userCustomDraft, setUserCustomDraft] = useState({ dx: 0, dy: 0, dz: 0, scale: 1, rot_yaw: 0, rot_pitch: 0, conteudo: "" });
  const [userCustomDraftFileName, setUserCustomDraftFileName] = useState("");
  const [userCustomSaving, setUserCustomSaving] = useState(false);
  const currentUserId = useMemo(() => getUserIdFromToken(), []);
  const userCustomStorageKey = useMemo(
    () => getUserCustomizationStorageKey(currentUserId, activePontoId || pontoId),
    [activePontoId, currentUserId, pontoId]
  );

  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    inspectModeHotspotIdRef.current = inspectModeHotspotId;
  }, [inspectModeHotspotId]);

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
    if (!pontoId || !currentViewPath) return;

    if (domeSettingsSaveTimerRef.current) {
      window.clearTimeout(domeSettingsSaveTimerRef.current);
    }

    domeSettingsSaveTimerRef.current = window.setTimeout(async () => {
      try {
        const viewKey = currentDomeViewKey;
        const settings = domeSettingsByView[viewKey];
        if (!settings) return;

        const response = await fetch(
          `${buildApiUrl(`/ponto/${pontoId}/alinhamento`)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`
            },
            body: JSON.stringify({
              vista_path: currentViewPath,
              ...settings
            })
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          console.warn("Falha ao guardar alinhamento do panorama.", payload?.message || response.statusText);
        }
      } catch (error) {
        console.warn("Falha ao guardar alinhamento do panorama.", error);
      }
    }, 800);

    return () => {
      if (domeSettingsSaveTimerRef.current) {
        window.clearTimeout(domeSettingsSaveTimerRef.current);
        domeSettingsSaveTimerRef.current = null;
      }
    };
  }, [API_BASE, buildApiUrl, currentDomeViewKey, currentViewPath, domeSettingsLoaded, domeSettingsByView, pontoId]);

  useEffect(() => {
    if (!domeSettingsLoaded) return;
    if (!pontoId || !currentViewPath) return;

    const raw = localStorage.getItem(domeSettingsStorageKey);
    if (raw) return;

    let cancelled = false;

    const loadAlinhamentoFromDatabase = async () => {
      try {
        const response = await fetch(
          `${buildApiUrl(`/ponto/${pontoId}/alinhamento?vista_path=${encodeURIComponent(currentViewPath)}`)}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`
            }
          }
        );

        if (!response.ok) return;

        const payload = await response.json().catch(() => null);
        if (!payload?.success || !payload?.data) return;

        if (cancelled) return;

        const { radius, verticalOffset, rotationX, rotationY, rotationZ, mirrorX, mirrorY } = payload.data;
        const settings = {
          radius: Number.isFinite(Number(radius)) ? Number(radius) : DEFAULT_PANORAMA_DOME_RADIUS,
          verticalOffset: Number.isFinite(Number(verticalOffset)) ? Number(verticalOffset) : 0,
          rotationX: Number.isFinite(Number(rotationX)) ? Number(rotationX) : DEFAULT_DOME_ROTATION_X,
          rotationY: Number.isFinite(Number(rotationY)) ? Number(rotationY) : DEFAULT_DOME_ROTATION_Y,
          rotationZ: Number.isFinite(Number(rotationZ)) ? Number(rotationZ) : DEFAULT_DOME_ROTATION_Z,
          mirrorX: Boolean(mirrorX),
          mirrorY: Boolean(mirrorY)
        };

        setDomeSettingsByView((prev) => ({
          ...prev,
          [currentDomeViewKey]: settings
        }));
      } catch (error) {
        console.warn("Falha ao carregar alinhamento do panorama da BD.", error);
      }
    };

    loadAlinhamentoFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, buildApiUrl, currentDomeViewKey, currentViewPath, domeSettingsLoaded, domeSettingsStorageKey, pontoId]);

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
    { label: "Áudio", value: "audio" },
    { label: "Áudio Espacial", value: "audioespacial" },
    { label: "Imagem", value: "imagem" },
    { label: "Imagem (4 pontos)", value: "imagem4p" },
    { label: "Link", value: "link" },
    { label: "Modelo 3D", value: "modelo3d" },
    { label: "Modelo 3D (Inspect)", value: "modelo3d_inspect" },
    { label: "Navegação", value: "navegacao" },
    { label: "Texto", value: "texto" },
    { label: "Vídeo", value: "video" },
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
    // Garantir distância mínima ao centro (e, indiretamente, prevenir valores muito pequenos)
    let finalX = nx;
    let finalY = ny;
    let finalZ = nz;
    let finalRadius = spherical.radius;

    if (Number.isFinite(finalRadius) && finalRadius < MIN_HOTSPOT_DISTANCE_FROM_CAMERA) {
      const factor = MIN_HOTSPOT_DISTANCE_FROM_CAMERA / finalRadius;
      finalX = nx * factor;
      finalY = ny * factor;
      finalZ = nz * factor;
      finalRadius = MIN_HOTSPOT_DISTANCE_FROM_CAMERA;
    }

    setEditX(finalX);
    setEditY(finalY);
    setEditZ(finalZ);
    setEditRadius(finalRadius);
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
        model_offset: (editTipo === "modelo3d" || editTipo === "modelo3d_inspect")
          ? { x: toFiniteNumber(editModelOffsetX, 0), y: toFiniteNumber(editModelOffsetY, 0), z: toFiniteNumber(editModelOffsetZ, 0) }
          : (hotspot.model_offset || { x: 0, y: 0, z: 0 }),
        model_scale: (editTipo === "modelo3d" || editTipo === "modelo3d_inspect")
          ? normalizeModelScale(editModelScale)
          : normalizeModelScale(hotspot.model_scale),
        inspect_model_offset: editTipo === "modelo3d_inspect"
          ? { x: toFiniteNumber(editInspectModelOffsetX, 0), y: toFiniteNumber(editInspectModelOffsetY, 0), z: toFiniteNumber(editInspectModelOffsetZ, 0) }
          : (hotspot.inspect_model_offset || hotspot.model_offset || { x: 0, y: 0, z: 0 }),
        inspect_model_scale: editTipo === "modelo3d_inspect"
          ? normalizeModelScale(editInspectModelScale)
          : normalizeModelScale(hotspot.inspect_model_scale ?? hotspot.model_scale),
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
    editModelOffsetX,
    editModelOffsetY,
    editModelOffsetZ,
    editModelScale,
    editInspectModelOffsetX,
    editInspectModelOffsetY,
    editInspectModelOffsetZ,
    editInspectModelScale,
    editPlacement,
    editPontoDestino,
    editNavigationPath,
    editNavigationSelection,
    editNavigationMode,
  ]);

  const effectiveHotspots = useMemo(() => {
    if (canManageHotspots) return previewHotspots;

    const list = Array.isArray(previewHotspots) ? previewHotspots : [];
    return list.map((hotspot) => {
      const overrides = myHotspotCustomizations?.[hotspot?.id];
      return applyUserOverridesToHotspot(hotspot, overrides);
    });
  }, [applyUserOverridesToHotspot, canManageHotspots, myHotspotCustomizations, previewHotspots]);

  const warpOverlays = useMemo(() => {
    const result = (Array.isArray(effectiveHotspots) ? effectiveHotspots : [])
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
    return result;
  }, [effectiveHotspots]);

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
          this._forceRebuild = false;
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
          const srcChanged = oldData?.src !== src;
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
            mesh.frustumCulled = true;
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
                occlusionMaskMesh.frustumCulled = true;
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

          if (!this._texture || srcChanged) {
            // Clean up old mesh immediately if src changed
            if (srcChanged && (this._group || this._mesh)) {
              this.el.removeObject3D("mesh");
              this._group = null;
              this._mesh = null;
              this._occlusionMaskMesh = null;
            }

            this._texture?.dispose?.();
            this._texture = null;
            this._forceRebuild = true;

            this._textureLoader.load(
              src,
              (tex) => {
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.magFilter = THREE.LinearFilter;
                tex.minFilter = THREE.LinearFilter;
                tex.generateMipmaps = false;
                tex.needsUpdate = true;
                this._texture = tex;
                buildOrUpdateMesh(tex);
              },
              undefined,
              () => {
                // ignore load errors; leave empty
              }
            );
          } else if (this._forceRebuild && this._texture) {
            buildOrUpdateMesh(this._texture);
            this._forceRebuild = false;
          } else if (this._texture) {
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
            // AmbientLight não suporta sombras
            if (!obj.isAmbientLight) {
              obj.castShadow = true;
            }
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

  // Gerenciar modo inspect 3D: travar a câmara a apontar para o hotspot e preparar a rotação do modelo
  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl?.camera) return;

    const cameraEl = sceneEl.querySelector("a-camera");
    if (!cameraEl) return;

    if (inspectModeHotspotId) {
      const hotspot = hotspots.find((h) => h.id === inspectModeHotspotId);
      if (hotspot) {
        // Remover componente look-controls da câmara
        cameraEl.removeAttribute("look-controls");
        const tx = Number(hotspot.x) || 0;
        const ty = Number(hotspot.y) || 0;
        const tz = Number(hotspot.z) || 0;
        sceneEl.camera.lookAt(tx, ty, tz);
      }
      setInspectModelYaw(0);
      setInspectModelPitch(0);
      setInspectModelRoll(0);

      // Tecla ESC para sair
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          setInspectModeHotspotId(null);
        }
      };
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      // Re-adicionar componente look-controls quando sair do modo inspect
      cameraEl.setAttribute("look-controls", "");
      setInspectModelYaw(0);
      setInspectModelPitch(0);
      setInspectModelRoll(0);
      setInspectAutoRotate(false);
      setInspectModelWorldPos(null);
      setInspectAnimating(false);
    }
  }, [inspectModeHotspotId, hotspots, inspectModelWorldPos]);

  // Controles de mouse para rodar o modelo
  useEffect(() => {
    if (!inspectModeHotspotId) return;

    const sceneEl = sceneRef.current;
    if (!sceneEl?.canvas) return;

    const MOUSE_SENSITIVITY = 0.5; // graus por pixel

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      inspectMouseDownRef.current = true;
      inspectMouseStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!inspectMouseDownRef.current) return;

      const deltaX = e.clientX - inspectMouseStartRef.current.x;
      const deltaY = e.clientY - inspectMouseStartRef.current.y;

      inspectMouseStartRef.current = { x: e.clientX, y: e.clientY };

      // Aplicar rotação apenas nos eixos habilitados
      if (inspectModelRotationAxes.y) {
        setInspectModelYaw((prev) => prev + deltaX * MOUSE_SENSITIVITY);
      }
      if (inspectModelRotationAxes.x) {
        setInspectModelPitch((prev) => prev + deltaY * MOUSE_SENSITIVITY);
      }
      if (inspectModelRotationAxes.z) {
        // Para o eixo Z (roll), usar a magnitude do movimento
        const deltaLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const sign = deltaX > 0 ? 1 : -1;
        setInspectModelRoll((prev) => prev + sign * deltaLength * MOUSE_SENSITIVITY * 0.1);
      }
    };

    const handleMouseUp = () => {
      inspectMouseDownRef.current = false;
    };

    const canvas = sceneEl.canvas;
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      inspectMouseDownRef.current = false;
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [inspectModeHotspotId, inspectModelRotationAxes]);

  useEffect(() => {
    const modelEl = inspectModelRef.current;
    if (!modelEl) return;

    modelEl.setAttribute("rotation", `${inspectModelPitch} ${inspectModelYaw} ${inspectModelRoll}`);
  }, [inspectModelPitch, inspectModelYaw, inspectModelRoll, inspectModeHotspotId]);

  // Animação automática de rotação
  useEffect(() => {
    if (!inspectModeHotspotId || !inspectAutoRotate) return;

    let animationFrameId;
    const autoRotateSpeed = 1; // graus por frame a ~60fps = ~60 graus por segundo

    const animate = () => {
      if (inspectMouseDownRef.current) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      if (inspectModelRotationAxes.y) {
        setInspectModelYaw((prev) => prev + autoRotateSpeed);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [inspectModeHotspotId, inspectAutoRotate, inspectModelRotationAxes.y]);

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
    const modelSrc = resolveModel3dSrc(conteudo);
    const modelOffset = normalizeModelOffset(hotspot?.model_offset);
    const modelScale = normalizeModelScale(hotspot?.model_scale);

    const modelToUse = modelSrc || conteudo;
    const isOBJ = String(modelToUse || "").toLowerCase().split("?")[0].split("#")[0].endsWith(".obj");

    const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), hotspot);

    return (
      <a-entity key={`model-${conteudo}`}>
        <a-entity
          key={`model-wrap-${conteudo}`}
          position={`${modelOffset.x} ${modelOffset.y} ${modelOffset.z}`}
        >
          <a-entity
            key={`model-entity-${conteudo}`}
            {...(isOBJ ? { "obj-model": `obj: ${modelToUse}` } : { "gltf-model": modelToUse })}
            position="0 0 0"
            rotation="0 0 0"
            scale={`${modelScale} ${modelScale} ${modelScale}`}
            shadow="cast: true; receive: true"
          />
        </a-entity>
        {hotspotIcon && !(hotspot?.hide_icon && !canManageHotspots) && (
          <a-entity key={`icon-${conteudo}`}>
            {hotspotIcon}
          </a-entity>
        )}
      </a-entity>
    );
  };

  const normalizeHotspotIconType = (iconType) => (String(iconType || "").toLowerCase() === "custom" ? "custom" : "default");

  const normalizeStoredHotspotIconType = (iconType) => normalizeHotspotIconType(iconType);

  const getHotspotIconTypeKey = (hotspot) => {
    const isNavigation = hotspot?.tipo === "navegacao" || hotspot?.id_ponto_destino || hotspot?.navigation_file_url || hotspot?.navigation_mode === "back";
    return isNavigation ? "navegacao" : String(hotspot?.tipo || "");
  };

  const resolveHotspotIconPath = (iconConfig, hotspot) => {
    const typeKey = getHotspotIconTypeKey(hotspot);
    const iconType = normalizeHotspotIconType(iconConfig?.icon_type);

    if (iconType === "custom") {
      const customIcons = iconConfig?.custom_icons && typeof iconConfig.custom_icons === "object" ? iconConfig.custom_icons : {};
      return customIcons[typeKey] || customIcons.default || "";
    }

    return HOTSPOT_DEFAULT_ICON_PATHS[typeKey] || "";
  };

  const resolveHotspotIconUrl = (iconConfig, hotspot) => {
    const storedValue = resolveHotspotIconPath(iconConfig, hotspot);
    if (!storedValue) return "";

    const normalizedPath = relativePathFromUploadsUrl(storedValue) || String(storedValue).replace(/^\/+/, "");
    return normalizedPath ? resolveUploadsUrl(normalizedPath) || "" : storedValue;
  };

  const renderHotspotIcon = (iconConfig, hotspot) => {
    const imageUrl = resolveHotspotIconUrl(iconConfig, hotspot);
    if (!imageUrl) return null;

    return (
      <a-entity>
        <a-image src={imageUrl} width="8" height="8" position="0 0 0" material="transparent: true; side: double; alphaTest: 0.050" />
      </a-entity>
    );
  };

  const getHotspotIconConfig = () => {
    try {
      const stored = localStorage.getItem("hotspot_icon_config");
      if (!stored) return DEFAULT_HOTSPOT_ICON_CONFIG;

      const parsed = JSON.parse(stored);
      const customIcons = parsed?.custom_icons && typeof parsed.custom_icons === "object" ? parsed.custom_icons : {};

      return {
        ...DEFAULT_HOTSPOT_ICON_CONFIG,
        ...parsed,
        icon_type: normalizeHotspotIconType(parsed?.icon_type),
        custom_icons: {
          ...customIcons,
        },
      };
    } catch {
      return DEFAULT_HOTSPOT_ICON_CONFIG;
    }
  };

  const tipoToAFrame = {
    texto: (conteudo, hotspot) => {
      const iconConfig = getHotspotIconConfig();
      const hotspotIcon = renderHotspotIcon(iconConfig, hotspot);
      const textFont = iconConfig.text_font || "roboto";

      return (
        <a-entity>
          {hotspotIcon && !(hotspot?.hide_icon && !canManageHotspots) && (
            <a-entity>
              {hotspotIcon}
            </a-entity>
          )}

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
        const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), { tipo: "imagem" });
        if (hotspotIcon) return hotspotIcon;

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
      const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), { tipo: "imagem4p" });
      return hotspotIcon;
    })(),

    modelo3d: (conteudo, hotspot) => renderModelo3dHotspot(conteudo, hotspot),

    modelo3d_inspect: (conteudo, hotspot) => {
      const payload = decodeInspect3dValue(conteudo);
      const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), hotspot);
      const isInspecting = inspectModeHotspotId === hotspot.id;
      const previewModelOffset = normalizeModelOffset(hotspot?.model_offset);
      const previewModelScale = normalizeModelScale(hotspot?.model_scale);
      const inspectModelOffset = normalizeModelOffset(hotspot?.inspect_model_offset ?? hotspot?.model_offset);
      const inspectModelScale = normalizeModelScale(hotspot?.inspect_model_scale ?? hotspot?.model_scale);
      const previewScale = Math.max(0.08, previewModelScale * 0.2);
      const previewRotation = `${Number(hotspot?.rot_pitch) || 0} ${Number(hotspot?.rot_yaw) || 0} 0`;

      if (!payload) return hotspotIcon;

      const modelSrc = resolveModel3dSrc(payload.src);
      const modelToUse = modelSrc || payload.src;
      const isOBJ = String(modelToUse || "").toLowerCase().split("?")[0].split("#")[0].endsWith(".obj");

      if (!isInspecting) {
        if (hotspot?.hide_icon && !canManageHotspots) return null;
        return (
          <a-entity>
            {hotspotIcon}
            <a-entity
              position={`${previewModelOffset.x} ${previewModelOffset.y} ${previewModelOffset.z}`}
            >
              <a-entity
                key={`inspect-preview-${modelToUse}`}
                {...(isOBJ ? { "obj-model": `obj: ${modelToUse}` } : { "gltf-model": modelToUse })}
                position="0 0 0"
                rotation={previewRotation}
                scale={`${previewScale} ${previewScale} ${previewScale}`}
                shadow="cast: true; receive: true"
              />
            </a-entity>
          </a-entity>
        );
      }

      const modelRotation = `${inspectModelPitch} ${inspectModelYaw} 0`;

      // Posição mundial calculada à frente da câmara
      const wx = inspectModelWorldPos?.x ?? (Number(hotspot.x) || 0);
      const wy = inspectModelWorldPos?.y ?? (Number(hotspot.y) || 0);
      const wz = inspectModelWorldPos?.z ?? (Number(hotspot.z) || 0);

      // Posição de origem para a animação de entrada
      const ox = Number(hotspot.x) || 0;
      const oy = Number(hotspot.y) || 0;
      const oz = Number(hotspot.z) || 0;

      return (
        <a-entity
          key={`inspect-wrap-${modelToUse}-${isInspecting}`}
          position={`${wx} ${wy} ${wz}`}
        >
          <a-entity
            position={`${inspectModelOffset.x} ${inspectModelOffset.y} ${inspectModelOffset.z}`}
          >
            <a-entity
              key={`inspect-${modelToUse}-${isInspecting}`}
              ref={inspectModelRef}
              {...(isOBJ ? { "obj-model": `obj: ${modelToUse}` } : { "gltf-model": modelToUse })}
              position="0 0 0"
              rotation={modelRotation}
              scale={`${inspectModelScale} ${inspectModelScale} ${inspectModelScale}`}
              shadow="cast: true; receive: true"
              {...(inspectAnimating ? {
                "animation__entrypos": `property: position; from: ${ox - wx} ${oy - wy} ${oz - wz}; to: 0 0 0; dur: 500; easing: easeOutCubic`,
                "animation__entryscale": `property: scale; from: ${inspectModelScale * 0.4} ${inspectModelScale * 0.4} ${inspectModelScale * 0.4}; to: ${inspectModelScale} ${inspectModelScale} ${inspectModelScale}; dur: 500; easing: easeOutBack`,
              } : {})}
            />
          </a-entity>
        </a-entity>
      );
    },

    audio: (conteudo) => (
      (() => {
        const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), { tipo: "audio" });
        if (hotspotIcon) return hotspotIcon;

        return (
          <a-entity>
            <a-entity
              sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: false`}
            ></a-entity>
          </a-entity>
        );
      })()
    ),

    audioespacial: (conteudo) => (
      (() => {
        const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), { tipo: "audioespacial" });
        if (hotspotIcon) return hotspotIcon;

        return (
          <a-entity>
            <a-entity
              sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: true; refDistance: 50; rolloffFactor: 1;`}
            ></a-entity>
          </a-entity>
        );
      })()
    ),

    video: (conteudo) => (() => {
      const hotspotIcon = renderHotspotIcon(getHotspotIconConfig(), { tipo: "video" });
      if (hotspotIcon) return hotspotIcon;

      return (
        <a-entity>
          <a-text value={conteudo ? "Video" : "Video?"} color="white" width="60" align="center" position="0 9 0" />
        </a-entity>
      );
    })(),

    link: (conteudo, hotspot) => renderHotspotIcon(getHotspotIconConfig(), hotspot),
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
          const modelOffset = normalizeModelOffset(decodedContent.modelOffset);
          const modelScale = normalizeModelScale(decodedContent.modelScale);
          const inspectModelOffset = normalizeModelOffset(decodedContent.inspectModelOffset ?? decodedContent.modelOffset);
          const inspectModelScale = normalizeModelScale(decodedContent.inspectModelScale ?? decodedContent.modelScale);
          return {
            id: h.id_hotspot,
            id_hotspot: h.id_hotspot,
            x: parseFloat(h.x),
            y: parseFloat(h.y),
            z: parseFloat(h.z),
            scale: decodedContent.scale || 1,
            rot_yaw: decodedContent.rotYaw || 0,
            rot_pitch: decodedContent.rotPitch || 0,
            placement: String(decodedContent.placement || h.placement || ""),
            tipo: isNavigation ? "navegacao" : (h.tipo === "modelo3d" && decodedContent.value.startsWith(INSPECT3D_PREFIX) ? "modelo3d_inspect" : (h.tipo || "")),
            conteudo: isNavigation ? "" : decodedContent.value,
            model_offset: modelOffset,
            model_scale: modelScale,
            inspect_model_offset: inspectModelOffset,
            inspect_model_scale: inspectModelScale,
            view_path: decodedContent.view,
            navigation_mode: navigation.mode,
            id_ponto_destino: navigation.pointId,
            navigation_file_path: navigation.filePath,
            navigation_file_url: navigation.filePath ? resolveUploadsUrl(navigation.filePath) : "",
            icon_type: normalizeStoredHotspotIconType(h.icon_type),
            icon_color: h.icon_color,
            hide_icon: Boolean(h.hide_icon),
            custom_config: h.custom_config || null,
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
    setUserCustomMenuOpen(false);
    setUserCustomHotspot(null);
  }, [activePontoId]);

  useEffect(() => {
    if (canManageHotspots) {
      setMyHotspotCustomizations({});
      return;
    }

    let localParsed = {};
    try {
      const raw = localStorage.getItem(userCustomStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          localParsed = parsed;
        }
      }
    } catch {
      // ignore corrupted storage
    }

    setMyHotspotCustomizations(localParsed);

    const token = typeof window !== "undefined" ? (localStorage.getItem("authToken") || "") : "";
    if (!token) return;
    const idPonto = Number(activePontoId || pontoId);
    if (!Number.isInteger(idPonto) || idPonto <= 0) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const url = API_BASE
          ? `${API_BASE}/hotspot/custom/me?id_ponto=${encodeURIComponent(String(idPonto))}`
          : `/hotspot/custom/me?id_ponto=${encodeURIComponent(String(idPonto))}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          return;
        }

        const data = payload?.data;
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          return;
        }

        if (cancelled) return;
        try {
          localStorage.setItem(userCustomStorageKey, JSON.stringify(data));
        } catch {
          // ignore storage errors
        }
        setMyHotspotCustomizations(data);
      } catch {
        // ignore network errors
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [API_BASE, activePontoId, canManageHotspots, pontoId, userCustomStorageKey]);

  useEffect(() => {
    return () => {
      if (userCustomSyncTimerRef.current) {
        window.clearTimeout(userCustomSyncTimerRef.current);
        userCustomSyncTimerRef.current = null;
      }
      userCustomSyncPendingRef.current = null;
    };
  }, []);

  const canUserEditContentForHotspot = (hotspot) => {
    const tipo = String(hotspot?.tipo || "");
    return ["texto", "link", "audio", "audioespacial", "video", "imagem", "imagem4p"].includes(tipo);
  };

  const openUserCustomizationMenu = (hotspot) => {
    if (canManageHotspots) return;
    if (!hotspot) return;

    const cfg = normalizeHotspotCustomConfig(hotspot.custom_config);
    const hasAny = cfg.enabled && (
      Boolean(cfg.allow_content?.enabled)
      || Boolean(cfg.allow_position?.enabled)
      || Boolean(cfg.allow_transform?.enabled)
    );
    if (!hasAny) return;

    const existing = normalizeUserOverrides(myHotspotCustomizations?.[hotspot.id]);
    setUserCustomHotspot(hotspot);
    setUserCustomDraft({
      dx: typeof existing.dx === 'number' ? existing.dx : 0,
      dy: typeof existing.dy === 'number' ? existing.dy : 0,
      dz: typeof existing.dz === 'number' ? existing.dz : 0,
      scale: typeof existing.scale === 'number' ? existing.scale : toFiniteNumber(hotspot.scale, 1),
      rot_yaw: typeof existing.rot_yaw === 'number' ? existing.rot_yaw : toFiniteNumber(hotspot.rot_yaw, 0),
      rot_pitch: typeof existing.rot_pitch === 'number' ? existing.rot_pitch : toFiniteNumber(hotspot.rot_pitch, 0),
      conteudo: typeof existing.conteudo === 'string' ? existing.conteudo : String(hotspot.conteudo || ""),
    });
    setUserCustomDraftFileName("");
    setUserCustomMenuOpen(true);
  };

  const persistUserCustomization = async (hotspot, overrides) => {
    const nextStore = { ...(myHotspotCustomizations && typeof myHotspotCustomizations === 'object' ? myHotspotCustomizations : {}) };
    if (overrides && Object.keys(overrides).length > 0) {
      nextStore[hotspot.id] = overrides;
    } else {
      delete nextStore[hotspot.id];
    }

    try {
      localStorage.setItem(userCustomStorageKey, JSON.stringify(nextStore));
      setMyHotspotCustomizations(nextStore);

      const token = typeof window !== "undefined" ? (localStorage.getItem("authToken") || "") : "";
      if (token) {
        userCustomSyncPendingRef.current = {
          hotspotId: hotspot.id,
          overrides: normalizeUserOverrides(overrides),
          token,
        };

        if (userCustomSyncTimerRef.current) {
          window.clearTimeout(userCustomSyncTimerRef.current);
        }

        userCustomSyncTimerRef.current = window.setTimeout(async () => {
          const pending = userCustomSyncPendingRef.current;
          userCustomSyncPendingRef.current = null;
          userCustomSyncTimerRef.current = null;
          if (!pending) return;

          try {
            const url = API_BASE
              ? `${API_BASE}/hotspot/${encodeURIComponent(String(pending.hotspotId))}/custom/me`
              : `/hotspot/${encodeURIComponent(String(pending.hotspotId))}/custom/me`;
            const response = await fetch(url, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${pending.token}`,
              },
              body: JSON.stringify({ overrides: pending.overrides }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
              console.warn("Falha ao sincronizar personalização do hotspot.", payload?.message || response.statusText);
            }
          } catch (error) {
            console.warn("Falha ao sincronizar personalização do hotspot.", error);
          }
        }, 600);
      }

      return normalizeUserOverrides(overrides);
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        alert("Espaço de armazenamento cheio! Tente uma imagem menor ou mais comprimida.");
        throw new Error("Armazenamento local cheio");
      }
      throw error;
    }
  };

  const saveUserCustomization = async () => {
    if (!userCustomHotspot) return;
    const hotspot = userCustomHotspot;
    const cfg = normalizeHotspotCustomConfig(hotspot.custom_config);
    if (!cfg.enabled) return;

    const eps = 1e-4;
    const baseScale = toFiniteNumber(hotspot.scale, 1);
    const baseYaw = toFiniteNumber(hotspot.rot_yaw, 0);
    const basePitch = toFiniteNumber(hotspot.rot_pitch, 0);
    const baseConteudo = String(hotspot.conteudo || "");

    let overrides = {};
    if (cfg.allow_position.enabled) {
      const dx = toFiniteNumber(userCustomDraft.dx, 0);
      const dy = toFiniteNumber(userCustomDraft.dy, 0);
      const dz = toFiniteNumber(userCustomDraft.dz, 0);
      if (Math.abs(dx) > eps) overrides.dx = dx;
      if (Math.abs(dy) > eps) overrides.dy = dy;
      if (Math.abs(dz) > eps) overrides.dz = dz;
    }

    if (cfg.allow_transform.enabled) {
      const scale = toFiniteNumber(userCustomDraft.scale, baseScale);
      const yaw = toFiniteNumber(userCustomDraft.rot_yaw, baseYaw);
      const pitch = toFiniteNumber(userCustomDraft.rot_pitch, basePitch);
      if (Math.abs(scale - baseScale) > eps) overrides.scale = scale;
      if (Math.abs(yaw - baseYaw) > eps) overrides.rot_yaw = yaw;
      if (Math.abs(pitch - basePitch) > eps) overrides.rot_pitch = pitch;
    }

    if (cfg.allow_content.enabled && canUserEditContentForHotspot(hotspot)) {
      const conteudo = String(userCustomDraft.conteudo || "");
      if (conteudo !== baseConteudo) overrides.conteudo = conteudo;
    }

    overrides = filterOverridesByCustomConfig(normalizeUserOverrides(overrides), cfg, hotspot?.tipo);

    setUserCustomSaving(true);
    try {
      await persistUserCustomization(hotspot, overrides);
    } finally {
      setUserCustomSaving(false);
    }
  };

  const resetUserCustomization = async () => {
    if (!userCustomHotspot) return;
    const hotspot = userCustomHotspot;
    const cfg = normalizeHotspotCustomConfig(hotspot.custom_config);
    if (!cfg.enabled) return;

    setUserCustomSaving(true);
    try {
      // Se for imagem4p, deletar a imagem customizada antes de repor
      if (String(hotspot.tipo || "") === "imagem4p" && cfg.allow_content.enabled) {
        const draftRaw = String(userCustomDraft.conteudo || "");
        const draftPayload = decodeImage4pValue(draftRaw);
        const customSrc = draftPayload?.src || "";
        
        const officialPayload = decodeImage4pValue(String(hotspot.conteudo || ""));
        const officialSrc = String(officialPayload?.src || "");
        const customSrcRel = relativePathFromUploadsUrl(customSrc);
        const officialSrcRel = relativePathFromUploadsUrl(officialSrc);
        const isPrimaryImage = Boolean(customSrcRel && officialSrcRel && customSrcRel === officialSrcRel);

        if (customSrc && customSrc.includes("/uploads/") && !isPrimaryImage) {
          const customPath = relativePathFromUploadsUrl(customSrc);
          if (customPath && customPath.trim()) {
            try {
              const token = localStorage.getItem("authToken") || "";
              const deleteUrl = API_BASE
                ? `${API_BASE}/media/item?path=${encodeURIComponent(customPath)}`
                : `/media/item?path=${encodeURIComponent(customPath)}`;
              
              console.log("🗑️ Deletando imagem customizada ao repor:", { customPath, deleteUrl });
              
              const deleteResponse = await fetch(deleteUrl, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              
              if (!deleteResponse.ok) {
                console.warn("⚠️ Falha ao deletar imagem customizada:", deleteResponse.status, deleteResponse.statusText);
              } else {
                console.log("✅ Imagem customizada deletada ao repor");
              }
            } catch (deleteError) {
              console.warn("⚠️ Erro ao deletar imagem customizada:", deleteError);
            }
          }
        } else if (isPrimaryImage && !isAdminUser) {
          console.log("🔒 Imagem principal de hotspot imagem4p protegida: delete ignorado no repor");
        }
      }

      await persistUserCustomization(hotspot, {});
      setUserCustomDraft({
        dx: 0,
        dy: 0,
        dz: 0,
        scale: toFiniteNumber(hotspot.scale, 1),
        rot_yaw: toFiniteNumber(hotspot.rot_yaw, 0),
        rot_pitch: toFiniteNumber(hotspot.rot_pitch, 0),
        conteudo: String(hotspot.conteudo || ""),
      });
      setUserCustomDraftFileName("");
    } finally {
      setUserCustomSaving(false);
    }
  };

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
        if (!editDialogOpen) {
          setSelectedHotspot(null);
        }
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
          if (inspectModeHotspotIdRef.current === hotspot.id) return;

          const sceneEl = sceneRef.current;
          const THREE = window?.THREE;
          if (THREE && sceneEl?.camera) {
            sceneEl.camera.lookAt(
              Number(hotspot.x) || 0,
              Number(hotspot.y) || 0,
              Number(hotspot.z) || 0
            );
            const camDir = new THREE.Vector3();
            sceneEl.camera.getWorldDirection(camDir);
            const camPos = new THREE.Vector3();
            sceneEl.camera.getWorldPosition(camPos);
            const targetPos = camPos.clone().add(camDir.clone().multiplyScalar(0.1));
            setInspectModelWorldPos({ x: targetPos.x, y: targetPos.y, z: targetPos.z });
          }

          setInspectAnimating(true);
          setInspectModeHotspotId(hotspot.id);
          
          // Carregar os eixos de rotação permitidos e configurações do hotspot
          const inspect3dPayload = decodeInspect3dValue(hotspot.conteudo || "");
          if (inspect3dPayload?.axis) {
            setInspectModelRotationAxes(inspect3dPayload.axis);
          } else {
            setInspectModelRotationAxes({ x: false, y: true, z: false });
          }
          setInspectAutoRotate(Boolean(inspect3dPayload?.autoRotate));
          
          setTimeout(() => setInspectAnimating(false), 520);
          return;
        }

        if (!showEditContextMenu && !editDialogOpen && btn === 0) {
          const cfg = normalizeHotspotCustomConfig(hotspot.custom_config);
          const hasAny = cfg.enabled && (
            Boolean(cfg.allow_content?.enabled)
            || Boolean(cfg.allow_position?.enabled)
            || Boolean(cfg.allow_transform?.enabled)
          );
          if (hasAny) {
            openUserCustomizationMenu(hotspot);
            return;
          }
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

    const handleHotspotHoverEnter = (e) => {
      const hotspotRoot = e.currentTarget?.closest?.(".hotspot-root");
      const glowRing = hotspotRoot?.querySelector?.(".hotspot-hover-glow");
      if (!glowRing) return;
      glowRing.setAttribute("visible", "true");
      glowRing.setAttribute("opacity", "1");
    };

    const handleHotspotHoverLeave = (e) => {
      const hotspotRoot = e.currentTarget?.closest?.(".hotspot-root");
      const glowRing = hotspotRoot?.querySelector?.(".hotspot-hover-glow");
      if (!glowRing) return;
      glowRing.setAttribute("visible", "false");
      glowRing.setAttribute("opacity", "0");
    };

    const clickablePlanes = scene.querySelectorAll(".hotspot-interaction");
    clickablePlanes.forEach((el) => {
      el.addEventListener("click", handler);
      el.addEventListener("mouseenter", handleHotspotHoverEnter);
      el.addEventListener("mouseleave", handleHotspotHoverLeave);
    });

    return () => {
      if (showEditContextMenu) {
        scene.removeEventListener("click", onClickScene);
      }
      clickablePlanes.forEach((el) => {
        el.removeEventListener("click", handler);
        el.removeEventListener("mouseenter", handleHotspotHoverEnter);
        el.removeEventListener("mouseleave", handleHotspotHoverLeave);
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
    const previousCanvasCursor = canvas.style.cursor;
    const previousBodyCursor = document.body.style.cursor;
    canvas.style.cursor = "crosshair";
    document.body.style.cursor = "crosshair";
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
      canvas.style.cursor = previousCanvasCursor;
      document.body.style.cursor = previousBodyCursor;
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
    // Evitar criar hotspots muito perto da câmara: empurra o ponto para fora se necessário
    try {
      const sceneEl = sceneRef.current;
      const THREE = window?.THREE;
      if (THREE && sceneEl?.camera) {
        const cameraWorldPos = new THREE.Vector3();
        sceneEl.camera.getWorldPosition(cameraWorldPos);
        const dist = cameraWorldPos.distanceTo(intersection);
        if (dist < MIN_HOTSPOT_DISTANCE_FROM_CAMERA) {
          const dir = intersection.clone().sub(cameraWorldPos).normalize();
          const pushed = cameraWorldPos.clone().add(dir.multiplyScalar(MIN_HOTSPOT_DISTANCE_FROM_CAMERA));
          // manter Y se for colocação no chão
          if (placement === "ground") pushed.y = intersection.y;
          intersection.copy(pushed);
          console.warn(`Hotspot muito perto da câmara: deslocado para distância mínima (${MIN_HOTSPOT_DISTANCE_FROM_CAMERA}).`);
        }
      }
    } catch (err) {
      console.warn("Não foi possível validar distância da câmara para hotspot:", err);
    }

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
          model_offset: { x: 0, y: 0, z: 0 },
          model_scale: 1,
          view_path: activeViewPath,
          navigation_mode: null,
          id_ponto_destino: "",
          navigation_file_path: "",
          navigation_file_url: "",
          icon_type: normalizeStoredHotspotIconType(hotspotCriado.icon_type || "default"),
          icon_color: hotspotCriado.icon_color || "#06b6d4",
          hide_icon: Boolean(hotspotCriado.hide_icon),
          custom_config: hotspotCriado.custom_config || null,
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
        setEditModelOffsetX(0);
        setEditModelOffsetY(0);
        setEditModelOffsetZ(0);
        setEditModelScale(1);
        setEditPlacement(String(hotspotEditavel.placement || ""));
        setEditStickToGround(String(hotspotEditavel.placement || "") === "ground");
        setEditHideIcon(Boolean(hotspotEditavel.hide_icon));
        setEditCustomConfig(normalizeHotspotCustomConfig(hotspotEditavel.custom_config));
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
        setEditInspect3dAxis({ x: false, y: true, z: false });
        setEditInspect3dAutoRotate(false);
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
        try {
          const resolvedModel = await resolveMediaSelection(editModelSelection, "modelos3d");
          console.log("🔍 Modelo 3D resolvido:", { selection: editModelSelection, resolved: resolvedModel });
          
          if (!resolvedModel) {
            throw new Error("Seleção de modelo inválida (nenhuma resolução retornada)");
          }
          
          const resolvedModelUrl = resolvedModel.url || resolveUploadsUrl(resolvedModel.path || "");
          console.log("🔗 URL final do modelo:", resolvedModelUrl);

          if (!resolvedModelUrl) {
            throw new Error(`Não foi possível gerar URL: path="${resolvedModel.path}", url="${resolvedModel.url}"`);
          }

          finalConteudoRaw = resolvedModelUrl;
        } catch (error) {
          console.error("❌ Erro ao resolver modelo 3D:", error);
          Swal.fire({
            title: "Modelo inválido",
            text: error.message || "Não foi possível resolver o ficheiro 3D selecionado.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }
      }

      if (!String(finalConteudoRaw || "").trim()) {
        Swal.fire({
          title: "Modelo em falta",
          text: "Seleciona ou faz upload de um ficheiro GLB/GLTF/OBJ para o hotspot de modelo 3D.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }
    }

    if (editTipo === "modelo3d_inspect") {
      let finalModelSrc = editInspect3dSrc;
      if (editModelSelection) {
        try {
          const resolvedModel = await resolveMediaSelection(editModelSelection, "modelos3d");
          console.log("🔍 Modelo 3D (inspect) resolvido:", { selection: editModelSelection, resolved: resolvedModel });
          
          if (!resolvedModel) {
            throw new Error("Seleção de modelo inválida (nenhuma resolução retornada)");
          }
          
          const resolvedModelUrl = resolvedModel.url || resolveUploadsUrl(resolvedModel.path || "");
          console.log("🔗 URL final do modelo (inspect):", resolvedModelUrl);

          if (!resolvedModelUrl) {
            throw new Error(`Não foi possível gerar URL: path="${resolvedModel.path}", url="${resolvedModel.url}"`);
          }

          finalModelSrc = resolvedModelUrl;
        } catch (error) {
          console.error("❌ Erro ao resolver modelo 3D (inspect):", error);
          Swal.fire({
            title: "Modelo inválido",
            text: error.message || "Não foi possível resolver o ficheiro 3D selecionado.",
            icon: "warning",
            confirmButtonColor: "#171717",
          });
          return;
        }
      }

      if (!String(finalModelSrc || "").trim()) {
        Swal.fire({
          title: "Modelo em falta",
          text: "Seleciona ou faz upload de um ficheiro GLB/GLTF/OBJ para o hotspot de inspeção 3D.",
          icon: "warning",
          confirmButtonColor: "#171717",
        });
        return;
      }

      finalConteudoRaw = encodeInspect3dValue({
        src: finalModelSrc,
        rotationSpeed: editInspect3dRotationSpeed,
        axis: editInspect3dAxis,
        autoRotate: editInspect3dAutoRotate,
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

    const finalPlacement = editStickToGround ? "ground" : editPlacement;
    const finalModelOffset = (editTipo === "modelo3d" || editTipo === "modelo3d_inspect")
      ? { x: toFiniteNumber(editModelOffsetX, 0), y: toFiniteNumber(editModelOffsetY, 0), z: toFiniteNumber(editModelOffsetZ, 0) }
      : null;
    const finalModelScale = (editTipo === "modelo3d" || editTipo === "modelo3d_inspect")
      ? normalizeModelScale(editModelScale)
      : null;
    const finalInspectModelOffset = editTipo === "modelo3d_inspect"
      ? { x: toFiniteNumber(editInspectModelOffsetX, 0), y: toFiniteNumber(editInspectModelOffsetY, 0), z: toFiniteNumber(editInspectModelOffsetZ, 0) }
      : null;
    const finalInspectModelScale = editTipo === "modelo3d_inspect"
      ? normalizeModelScale(editInspectModelScale)
      : null;
    const finalConteudo = encodeHotspotContent(
      finalConteudoRaw,
      activeViewPath,
      editScale,
      editYaw,
      editPitch,
      finalPlacement,
      finalModelOffset,
      finalModelScale,
      finalInspectModelOffset,
      finalInspectModelScale
    );
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
          placement: finalPlacement,
          hide_icon: Boolean(editHideIcon),
          custom_config: editCustomConfig?.enabled ? editCustomConfig : { enabled: false },
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
        model_offset: finalModelOffset ? normalizeModelOffset(finalModelOffset) : (selectedHotspot?.model_offset || { x: 0, y: 0, z: 0 }),
        model_scale: finalModelScale ?? normalizeModelScale(selectedHotspot?.model_scale),
        inspect_model_offset: finalInspectModelOffset ? normalizeModelOffset(finalInspectModelOffset) : (selectedHotspot?.inspect_model_offset || selectedHotspot?.model_offset || { x: 0, y: 0, z: 0 }),
        inspect_model_scale: finalInspectModelScale ?? normalizeModelScale(selectedHotspot?.inspect_model_scale ?? selectedHotspot?.model_scale),
        navigation_mode: editTipo === "navegacao" ? editNavigationMode : null,
        id_ponto_destino: finalPontoDestino,
        navigation_file_path: finalNavigationPath,
        navigation_file_url: finalNavigationPath ? resolveUploadsUrl(finalNavigationPath) : "",
        icon_type: normalizeStoredHotspotIconType(selectedHotspot.icon_type || "default"),
        icon_color: selectedHotspot.icon_color || "#06b6d4",
        hide_icon: Boolean(editHideIcon),
        custom_config: editCustomConfig?.enabled ? editCustomConfig : { enabled: false },
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
          data-warp-src={overlay.src}
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



      {effectiveHotspots.map((pos) => (
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

          {editDialogOpen && selectedHotspot?.id === pos.id && (
            <a-entity face-camera>
              <a-ring
                radius-inner="6"
                radius-outer="7"
                color="#ffffff"
                material="side: double; transparent: true; opacity: 0.7"
                animation__pulse="property: scale; from: 1 1 1; to: 1.22 1.22 1.22; dur: 650; dir: alternate; easing: easeInOutSine; loop: true"
                animation__fade="property: material.opacity; from: 0.35; to: 0.95; dur: 650; dir: alternate; easing: easeInOutSine; loop: true"
              />
            </a-entity>
          )}

          {/* Glow effect on hover */}
          {!(pos.hide_icon && !canManageHotspots) && (
            <a-entity face-camera>
              <a-ring
                className="hotspot-hover-glow"
                radius-inner="4"
                radius-outer="4.5"
                color="#ffffff"
                material="side: double; emissive: #ffffff; emissiveIntensity: 0.35; transparent: true; opacity: 0.28"
                animation="property: scale; from: 1 1 1; to: 1.03 1.03 1.03; dur: 850; dir: alternate; loop: true"
                visible="false"
                opacity="0"
              />
            </a-entity>
          )}

          {!(pos.hide_icon && !canManageHotspots) && (
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
            />
          )}
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
                  const loadedModelOffset = normalizeModelOffset(selectedHotspot.model_offset);
                  setEditModelOffsetX(loadedModelOffset.x);
                  setEditModelOffsetY(loadedModelOffset.y);
                  setEditModelOffsetZ(loadedModelOffset.z);
                  setEditModelScale(normalizeModelScale(selectedHotspot.model_scale));
                  const loadedInspectModelOffset = normalizeModelOffset(selectedHotspot.inspect_model_offset ?? selectedHotspot.model_offset);
                  setEditInspectModelOffsetX(loadedInspectModelOffset.x);
                  setEditInspectModelOffsetY(loadedInspectModelOffset.y);
                  setEditInspectModelOffsetZ(loadedInspectModelOffset.z);
                  setEditInspectModelScale(normalizeModelScale(selectedHotspot.inspect_model_scale ?? selectedHotspot.model_scale));
                  const placement = String(
                    selectedHotspot.placement
                    || (Math.abs((Number(selectedHotspot.y) || 0) - floorY) <= 0.001 ? "ground" : "dome")
                  );
                  setEditPlacement(placement);
                  setEditStickToGround(placement === "ground");
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
                    setEditInspect3dAxis({ x: false, y: true, z: false });
                    setEditInspect3dAutoRotate(false);
                    setEditInspect3dButtons([]);
                  } else if (selectedHotspot.tipo === "modelo3d_inspect") {
                    const payload = decodeInspect3dValue(selectedHotspot.conteudo || "");
                    const src = payload?.src || "";
                    setEditInspect3dSrc(src);
                    setEditInspect3dRotationSpeed(Number.isFinite(Number(payload?.rotationSpeed)) ? Number(payload.rotationSpeed) : 1);
                    setEditInspect3dAxis(payload?.axis || { x: false, y: true, z: false });
                    setEditInspect3dAutoRotate(Boolean(payload?.autoRotate));
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
                    setEditInspect3dAxis({ x: false, y: true, z: false });
                    setEditInspect3dAutoRotate(false);
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
                  setEditCustomConfig(normalizeHotspotCustomConfig(selectedHotspot.custom_config));
                  setEditStep("type");
                  setEditDialogOpen(true);
                }
              } else if (value === "delete") {
                deleteHotspot(selectedHotspot.id);
              } else if (value === "edit-dome") {
                setDomeEditStep("guides");
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
            <div className="absolute inset-0 pointer-events-none z-50">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute top-4 right-4 pointer-events-auto h-12 w-12 rounded-md border-0 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95 hover:text-foreground"
                onClick={() => {
                  setInspectModeHotspotId(null);
                  setInspectModelWorldPos(null);
                  setInspectAnimating(false);
                  setInspectModelYaw(0);
                  setInspectModelPitch(0);
                  setInspectModelRoll(0);
                  setInspectAutoRotate(false);
                }}
                title="Fechar (ESC)"
              >
                ✕
              </Button>

              {payload.buttons && payload.buttons.length > 0 && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-auto flex gap-3 flex-wrap justify-center max-w-2xl">
                {payload.buttons?.map((btn, i) => (
                  <Button key={i} asChild variant="outline" className="rounded-md border-0 bg-background/85 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95 hover:text-foreground">
                    <a href={btn.url || "#"} target="_blank" rel="noopener noreferrer">
                      {btn.label}
                    </a>
                  </Button>
                ))}
                </div>
              )}
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
        contentClassName="!left-auto !top-auto !right-4 !bottom-4 !translate-x-0 !translate-y-0 !w-[520px] max-w-[92vw] max-h-[78vh] p-4"
        bodyClassName="max-h-[58vh] pr-1"
      >
        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm font-medium">Vista: {currentViewPath || "vista inicial"}</label>

          <div className="flex gap-1 mb-1 border-b border-black/10 overflow-x-auto">
            {[
              { value: "guides", label: "Guias" },
              { value: "alignment", label: "Alinhamento" },
              { value: "mirror", label: "Espelho" },
            ].map((step) => (
              <button
                key={step.value}
                type="button"
                onClick={() => setDomeEditStep(step.value)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-t border-b-2 transition-colors ${domeEditStep === step.value
                  ? "border-b-black text-black"
                  : "border-b-transparent text-neutral-600 hover:text-black"
                  }`}
              >
                {step.label}
              </button>
            ))}
          </div>

          {domeEditStep === "guides" && (
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
          )}

          {domeEditStep === "alignment" && (
            <div className="mt-2 rounded border border-black/10 p-2">
              <div className="text-xs font-semibold text-black/70 mb-2">Alinhamento do Panorama</div>
              <div className="text-xs text-black/60 mb-2">
                O alinhamento é relativo à orientação atual da câmara quando este painel é aberto.
              </div>



              <label className="text-sm font-medium">Alinhamento (Roll): {formatNumberOneDecimal(domeRotationZ)}°</label>
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

              <label className="text-sm font-medium mt-2">Rotacao Horizontal (Yaw relativo): {formatNumberOneDecimal(relativeDomeRotationY)}°</label>
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

              <label className="text-sm font-medium">Rotacao Vertical (Pitch relativo): {formatNumberOneDecimal(relativeDomeRotationX)}°</label>
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

            </div>
          )}

          {domeEditStep === "mirror" && (
            <div className="mt-2 rounded border border-black/10 p-2">
              <div className="text-xs font-semibold text-black/70 mb-2">Espelhamento do Panorama</div>
              <div className="mt-1 grid grid-cols-1 gap-2">
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
          )}
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
              {["type", "content", "position", "transform", "styling", "custom", editTipo === "navegacao" ? "navigation" : null].filter(Boolean).map((step) => (
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
                  {step === "custom" && "Customizável"}
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
                    label="Modelo 3D (GLB/GLTF/OBJ)"
                    accept=".glb,.gltf,.obj,model/gltf+json,model/gltf-binary"
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
                    helperText="Escolhe ou envia um ficheiro GLB/GLTF/OBJ no File Manager para importar no A-Frame."
                  />
                ) : editTipo === "modelo3d_inspect" ? (
                  <div className="flex flex-col gap-2">
                    <MediaSourceField
                      label="Modelo 3D Inspeção (GLB/GLTF/OBJ)"
                      accept=".glb,.gltf,.obj,model/gltf+json,model/gltf-binary"
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

                    <label className="text-sm font-medium mt-1">Eixos de Rotação:</label>
                    <div className="flex gap-4 items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editInspect3dAxis.x}
                          onChange={(e) => setEditInspect3dAxis({ ...editInspect3dAxis, x: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Eixo X</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editInspect3dAxis.y}
                          onChange={(e) => setEditInspect3dAxis({ ...editInspect3dAxis, y: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Eixo Y</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editInspect3dAxis.z}
                          onChange={(e) => setEditInspect3dAxis({ ...editInspect3dAxis, z: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Eixo Z</span>
                      </label>
                    </div>

                    <label className="text-sm font-medium mt-1">Velocidade de Rotação:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editInspect3dRotationSpeed}
                      onChange={(e) => setEditInspect3dRotationSpeed(parseFloat(e.target.value))}
                      className="border rounded px-2 py-1 text-sm dark:bg-black"
                    />

                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={editInspect3dAutoRotate}
                        onChange={(e) => setEditInspect3dAutoRotate(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Rotação Automática</span>
                    </label>

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
                    />

                    <div className="rounded border border-black/10 p-3">
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

                      <div className="mt-3 flex flex-col gap-3">
                        <div className="rounded border border-black/10 bg-black/[0.02] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-black/60">Captura e aparência</div>

                          <div className="mt-3 flex flex-wrap gap-2">
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
                              Remover último ponto
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditImage4pPoints([])}
                              className="rounded border border-red-600/30 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Limpar pontos
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                                className="rounded border border-black/20 px-2 py-1 text-sm dark:bg-black"
                              />
                            </div>
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
                                className="rounded border border-black/20 px-2 py-1 text-sm dark:bg-black"
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-4">
                            <label className="inline-flex items-center gap-2 text-xs font-medium">
                              <input
                                type="checkbox"
                                checked={editImage4pFlipX}
                                onChange={(e) => setEditImage4pFlipX(Boolean(e.target.checked))}
                                className="accent-black"
                              />
                              Espelhar H
                            </label>

                            <label className="inline-flex items-center gap-2 text-xs font-medium">
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

                        <div className="rounded border border-black/10 bg-black/[0.02] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-black/60">Oclusão / profundidade</div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${editImage4pHasOcclusion ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
                              {editImage4pHasOcclusion ? "Ativa" : "Sem oclusão"}
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-neutral-600">
                            Se ativa, a imagem 4 pontos passa atrás de uma máscara desenhada em 360 para respeitar objetos em primeiro plano.
                          </div>

                          <label className="mt-3 block text-xs font-medium">Modo de profundidade</label>
                          <select
                            value={editImage4pDepthMode}
                            onChange={(e) => setEditImage4pDepthMode(e.target.value === "occlusion-mask" ? "occlusion-mask" : "none")}
                            className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm dark:bg-black"
                          >
                            <option value="none">Sem oclusão</option>
                            <option value="occlusion-mask">Máscara de oclusão (objetos à frente)</option>
                          </select>

                          <div className="mt-3 rounded border border-black/10 bg-white/70 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Máscara</div>
                              <div className="text-xs text-neutral-600">{Array.isArray(editImage4pOcclusionMaskPoints) ? editImage4pOcclusionMaskPoints.length : 0} pontos</div>
                            </div>

                            <div className="mt-1 text-xs text-neutral-600">
                              Mínimo recomendado: 3 pontos. O inset ajusta o plano virtual da máscara.
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCapturingImage4pPoints(false);
                                  setIsCapturingImage4pMaskPoints((prev) => !prev);
                                }}
                                className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                                disabled={!editImage4pHasOcclusion}
                              >
                                {isCapturingImage4pMaskPoints ? "Parar captura da máscara" : "Capturar máscara no 360"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditImage4pOcclusionMaskPoints((prev) => (Array.isArray(prev) ? prev.slice(0, -1) : []))}
                                className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                                disabled={!editImage4pHasOcclusion}
                              >
                                Remover último
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditImage4pOcclusionMaskPoints([])}
                                className="rounded border border-red-600/30 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                disabled={!editImage4pHasOcclusion}
                              >
                                Limpar máscara
                              </button>
                            </div>

                            {isCapturingImage4pMaskPoints && (
                              <div className="mt-2 text-xs text-neutral-600">
                                Clica no 360 para desenhar o contorno do objeto que deve ficar à frente.
                              </div>
                            )}

                            <div className="mt-2 flex flex-col gap-1">
                              <label className="text-xs font-medium">Inset da máscara</label>
                              <input
                                type="number"
                                step="0.1"
                                value={editImage4pOcclusionMaskInset}
                                onChange={(e) => {
                                  const next = parseFloat(e.target.value);
                                  if (!Number.isFinite(next)) return;
                                  setEditImage4pOcclusionMaskInset(next);
                                }}
                                className="rounded border border-black/20 px-2 py-1 text-sm dark:bg-black"
                                disabled={!editImage4pHasOcclusion}
                              />
                            </div>
                          </div>
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
                <div className="grid grid-cols-3 gap-2">
                  <DragNumberInput
                    label="X"
                    value={Number(editX) || 0}
                    onChange={(next) => setPositionAndAnglesFromXYZ(next, editY, editZ)}
                    step={0.1}
                  />
                  <DragNumberInput
                    label={editStickToGround ? "Y (plano)" : "Y"}
                    value={editStickToGround ? (Number(editZ) || 0) : (Number(editY) || 0)}
                    onChange={(next) => {
                      if (editStickToGround) {
                        setPositionAndAnglesFromXYZ(editX, floorY, next);
                        return;
                      }
                      setPositionAndAnglesFromXYZ(editX, next, editZ);
                    }}
                    step={0.1}
                  />
                  {!editStickToGround && (
                    <DragNumberInput
                      label="Z"
                      value={Number(editZ) || 0}
                      onChange={(next) => setPositionAndAnglesFromXYZ(editX, editY, next)}
                      step={0.1}
                    />
                  )}
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={editStickToGround}
                    onChange={(e) => {
                      const enabled = Boolean(e.target.checked);
                      setEditStickToGround(enabled);
                      if (enabled) {
                        setPositionAndAnglesFromXYZ(editX, floorY, editZ);
                        setEditPlacement("ground");
                      } else {
                        setEditPlacement("dome");
                      }
                    }}
                    className="accent-black"
                  />
                  Stick to ground
                </label>

                {editStickToGround && (
                  <div className="rounded border border-black/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-700">Clica no plano para posicionar.</span>
                      <button
                        type="button"
                        onClick={() => setIsPickingGroundPosition((prev) => !prev)}
                        className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                      >
                        {isPickingGroundPosition ? "Parar" : "Colocar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Transform */}
            {editStep === "transform" && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <DragNumberInput
                    label="Inclinação (°)"
                    value={Math.round(editPitch)}
                    onChange={(next) => setEditPitch(next)}
                    step={1}
                  />
                  <DragNumberInput
                    label="Guinada (°)"
                    value={Math.round(editYaw)}
                    onChange={(next) => setEditYaw(next)}
                    step={1}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <DragNumberInput
                    label="Raio (centro)"
                    value={Math.round(editRadius)}
                    onChange={(next) => setPositionFromRadius(next)}
                    step={1}
                  />
                  <DragNumberInput
                    label="Escala"
                    value={(Number(editScale) || 1).toFixed(2)}
                    onChange={(next) => setEditScale(Math.max(HOTSPOT_SCALE_MIN, next))}
                    step={0.05}
                  />
                </div>

                {(editTipo === "modelo3d" || editTipo === "modelo3d_inspect") && (
                  <div className="rounded border border-black/10 p-2 mt-1">
                    <div className="text-xs font-semibold text-black/70 mb-2">Posição do objeto no preview</div>
                    <div className="grid grid-cols-3 gap-2">
                      <DragNumberInput
                        label="Obj X"
                        value={Number(editModelOffsetX) || 0}
                        onChange={(next) => setEditModelOffsetX(next)}
                        step={0.1}
                      />
                      <DragNumberInput
                        label="Obj Y"
                        value={Number(editModelOffsetY) || 0}
                        onChange={(next) => setEditModelOffsetY(next)}
                        step={0.1}
                      />
                      <DragNumberInput
                        label="Obj Z"
                        value={Number(editModelOffsetZ) || 0}
                        onChange={(next) => setEditModelOffsetZ(next)}
                        step={0.1}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <DragNumberInput
                        label="Obj Scale"
                        value={(normalizeModelScale(editModelScale) || 1).toFixed(2)}
                        onChange={(next) => setEditModelScale(Math.max(0.01, next))}
                        step={0.05}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-600">
                      Move e escala só o modelo 3D dentro do hotspot (o ícone não muda). A posição do hotspot continua a mover ambos.
                    </div>
                  </div>
                )}

                {editTipo === "modelo3d_inspect" && (
                  <div className="rounded border border-cyan-300/70 bg-cyan-50/40 p-2 mt-1">
                    <div className="text-xs font-semibold text-cyan-900 mb-2">Posição do modelo em inspeção</div>
                    <div className="grid grid-cols-3 gap-2">
                      <DragNumberInput
                        label="Inspec X"
                        value={Number(editInspectModelOffsetX) || 0}
                        onChange={(next) => setEditInspectModelOffsetX(next)}
                        step={0.1}
                      />
                      <DragNumberInput
                        label="Inspec Y"
                        value={Number(editInspectModelOffsetY) || 0}
                        onChange={(next) => setEditInspectModelOffsetY(next)}
                        step={0.1}
                      />
                      <DragNumberInput
                        label="Inspec Z"
                        value={Number(editInspectModelOffsetZ) || 0}
                        onChange={(next) => setEditInspectModelOffsetZ(next)}
                        step={0.1}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <DragNumberInput
                        label="Inspec Scale"
                        value={(normalizeModelScale(editInspectModelScale) || 1).toFixed(2)}
                        onChange={(next) => setEditInspectModelScale(Math.max(0.01, next))}
                        step={0.05}
                      />
                    </div>
                  </div>
                )}
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

            {/* Step: Custom (per-user overrides) */}
            {editStep === "custom" && (
              <div className="flex flex-col gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(editCustomConfig?.enabled)}
                    onChange={(e) => setEditCustomConfig((prev) => ({
                      ...normalizeHotspotCustomConfig(prev),
                      enabled: Boolean(e.target.checked),
                    }))}
                    className="accent-black"
                  />
                  Permitir personalização pelo utilizador (só para ele)
                </label>

                <div className="rounded border border-black/10 p-2">
                  <div className="text-xs font-semibold text-black/70 mb-2">Opções permitidas</div>

                  <div className="grid grid-cols-1 gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(editCustomConfig?.allow_content?.enabled)}
                        onChange={(e) => setEditCustomConfig((prev) => {
                          const base = normalizeHotspotCustomConfig(prev);
                          return {
                            ...base,
                            allow_content: {
                              ...base.allow_content,
                              enabled: Boolean(e.target.checked),
                            },
                          };
                        })}
                        className="accent-black"
                        disabled={!editCustomConfig?.enabled}
                      />
                      Conteúdo (texto/URL)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-neutral-700">
                        Máx. chars
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={Number(editCustomConfig?.allow_content?.maxLength) || 0}
                          onChange={(e) => {
                            const next = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setEditCustomConfig((prev) => {
                              const base = normalizeHotspotCustomConfig(prev);
                              return {
                                ...base,
                                allow_content: { ...base.allow_content, maxLength: next },
                              };
                            });
                          }}
                          className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm"
                          disabled={!editCustomConfig?.enabled}
                        />
                      </label>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(editCustomConfig?.allow_position?.enabled)}
                        onChange={(e) => setEditCustomConfig((prev) => {
                          const base = normalizeHotspotCustomConfig(prev);
                          return {
                            ...base,
                            allow_position: {
                              ...base.allow_position,
                              enabled: Boolean(e.target.checked),
                            },
                          };
                        })}
                        className="accent-black"
                        disabled={!editCustomConfig?.enabled}
                      />
                      Posição (dx/dy/dz)
                    </label>
                    <label className="text-xs text-neutral-700">
                      Range (±)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={Number(editCustomConfig?.allow_position?.range) || 0}
                        onChange={(e) => {
                          const next = Math.max(0, Number(e.target.value) || 0);
                          setEditCustomConfig((prev) => {
                            const base = normalizeHotspotCustomConfig(prev);
                            return {
                              ...base,
                              allow_position: { ...base.allow_position, range: next },
                            };
                          });
                        }}
                        className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm"
                        disabled={!editCustomConfig?.enabled}
                      />
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(editCustomConfig?.allow_transform?.enabled)}
                        onChange={(e) => setEditCustomConfig((prev) => {
                          const base = normalizeHotspotCustomConfig(prev);
                          return {
                            ...base,
                            allow_transform: {
                              ...base.allow_transform,
                              enabled: Boolean(e.target.checked),
                            },
                          };
                        })}
                        className="accent-black"
                        disabled={!editCustomConfig?.enabled}
                      />
                      Transformação (escala/rotação)
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-neutral-700">
                        Escala min
                        <input
                          type="number"
                          step="0.1"
                          value={Number(editCustomConfig?.allow_transform?.scale?.min) || HOTSPOT_SCALE_MIN}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setEditCustomConfig((prev) => {
                              const base = normalizeHotspotCustomConfig(prev);
                              return {
                                ...base,
                                allow_transform: {
                                  ...base.allow_transform,
                                  scale: { ...base.allow_transform.scale, min: next },
                                },
                              };
                            });
                          }}
                          className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm"
                          disabled={!editCustomConfig?.enabled}
                        />
                      </label>

                      <label className="text-xs text-neutral-700">
                        Escala max
                        <input
                          type="number"
                          step="0.1"
                          value={Number(editCustomConfig?.allow_transform?.scale?.max) || 0}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setEditCustomConfig((prev) => {
                              const base = normalizeHotspotCustomConfig(prev);
                              return {
                                ...base,
                                allow_transform: {
                                  ...base.allow_transform,
                                  scale: { ...base.allow_transform.scale, max: next },
                                },
                              };
                            });
                          }}
                          className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm"
                          disabled={!editCustomConfig?.enabled}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-neutral-600">
                    Nota: estas mudanças são guardadas apenas para o próprio utilizador (não alteram o hotspot global).
                  </div>
                </div>
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

      {userCustomMenuOpen && userCustomHotspot && !canManageHotspots && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[560px] max-w-[94vw] -translate-x-1/2 rounded-xl border border-black/10 bg-white/90 p-3 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-black">Customizável</div>
              <div className="text-[11px] text-neutral-600">
                Hotspot #{userCustomHotspot.id} • {String(userCustomHotspot.tipo || "")}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUserCustomMenuOpen(false);
                  setUserCustomHotspot(null);
                }}
                className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                disabled={userCustomSaving}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={resetUserCustomization}
                className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black hover:text-white"
                disabled={userCustomSaving}
              >
                Repor
              </button>
              <button
                type="button"
                onClick={saveUserCustomization}
                className="rounded bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-black/90 disabled:opacity-50"
                disabled={userCustomSaving}
              >
                Guardar
              </button>
            </div>
          </div>

          {(() => {
            const cfg = normalizeHotspotCustomConfig(userCustomHotspot.custom_config);
            return (
              <div className="mt-3 flex flex-col gap-3">
                {cfg.allow_content.enabled && canUserEditContentForHotspot(userCustomHotspot) && (
                  String(userCustomHotspot.tipo || "") === "imagem4p"
                    ? (() => {
                      const draftRaw = String(userCustomDraft.conteudo || "");
                      const baseRaw = String(userCustomHotspot.conteudo || "");
                      const payload = decodeImage4pValue(draftRaw) || decodeImage4pValue(baseRaw) || {
                        src: "",
                        points: [],
                        opacity: 1,
                        brightness: 1,
                        inset: 0.6,
                        rotateDeg: 0,
                        flipX: false,
                        flipY: false,
                        depthMode: "none",
                        occlusionMaskPoints: [],
                        occlusionMaskInset: 0,
                      };

                      const updatePayload = async (partial, fileName = null) => {
                        const next = {
                          ...payload,
                          ...partial,
                        };
                        const encoded = encodeImage4pValue(next);
                        const nextDraft = { ...userCustomDraft, conteudo: encoded };
                        setUserCustomDraft(nextDraft);
                        if (fileName !== null) {
                          setUserCustomDraftFileName(fileName || "");
                        }
                        await persistUserCustomization(userCustomHotspot, filterOverridesByCustomConfig(normalizeUserOverrides({ conteudo: encoded }), cfg, userCustomHotspot?.tipo));
                      };

                      const handleLocalImageFile = async (file) => {
                        if (!file) return;
                        try {
                          setUserCustomSaving(true);

                          // Remover imagem anterior se existir e for URL backend
                          const draftRaw = String(userCustomDraft.conteudo || "");
                          const draftPayload = decodeImage4pValue(draftRaw);
                          const oldSrc = draftPayload?.src || "";
                          
                          const officialPayload = decodeImage4pValue(String(userCustomHotspot?.conteudo || ""));
                          const officialSrc = String(officialPayload?.src || "");
                          const oldSrcRel = relativePathFromUploadsUrl(oldSrc);
                          const officialSrcRel = relativePathFromUploadsUrl(officialSrc);
                          const isPrimaryImage = Boolean(oldSrcRel && officialSrcRel && oldSrcRel === officialSrcRel);

                          if (oldSrc && oldSrc.includes("/uploads/") && !isPrimaryImage) {
                            const oldPath = relativePathFromUploadsUrl(oldSrc);
                            if (oldPath && oldPath.trim()) {
                              try {
                                const token = localStorage.getItem("authToken") || "";
                                const deleteUrl = API_BASE
                                  ? `${API_BASE}/media/item?path=${encodeURIComponent(oldPath)}`
                                  : `/media/item?path=${encodeURIComponent(oldPath)}`;
                                
                                console.log("🗑️ Deletando imagem anterior:", { oldPath, deleteUrl });
                                
                                const deleteResponse = await fetch(deleteUrl, {
                                  method: "DELETE",
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                  },
                                });
                                
                                if (!deleteResponse.ok) {
                                  console.warn("⚠️ Falha ao deletar imagem anterior:", deleteResponse.status, deleteResponse.statusText);
                                } else {
                                  console.log("✅ Imagem anterior deletada");
                                }
                              } catch (deleteError) {
                                console.warn("⚠️ Erro ao deletar imagem anterior:", deleteError);
                              }
                            }
                          } else if (isPrimaryImage && !isAdminUser) {
                            console.log("🔒 Imagem principal de hotspot imagem4p protegida: delete ignorado");
                          }

                          // Upload da nova imagem
                          const uploadedFile = await uploadFileToMediaLibrary(file, "customs");
                          void updatePayload({ src: uploadedFile.url }, file.name || "");
                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : "Erro ao fazer upload de imagem";
                          alert(errorMsg);
                        } finally {
                          setUserCustomSaving(false);
                        }
                      };

                      return (
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <div className="text-sm font-medium text-foreground mb-2">Imagem 4P (conteúdo)</div>

                          <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                              <Button
                                variant={editImage4pTab === "files" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setEditImage4pTab("files")}
                              >
                                Ficheiros
                              </Button>
                              <Button
                                variant={editImage4pTab === "url" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setEditImage4pTab("url")}
                              >
                                URL
                              </Button>
                            </div>

                            <div
                              onDrop={(e) => { e.preventDefault(); handleLocalImageFile(e.dataTransfer?.files?.[0] || null); }}
                              onDragOver={(e) => e.preventDefault()}
                              className="min-h-[120px] rounded-md border border-dashed border-border flex items-center justify-center p-4 bg-background"
                            >
                              {editImage4pTab === "files" && (
                                <div className="flex flex-col items-center gap-2 w-full">
                                  <div className="text-sm text-muted-foreground">Arraste a imagem aqui ou escolha um ficheiro</div>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleLocalImageFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    disabled={userCustomSaving}
                                  />
                                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={userCustomSaving}>
                                    Escolher ficheiro
                                  </Button>
                                </div>
                              )}

                              {editImage4pTab === "url" && (
                                <div className="w-full px-2">
                                  <div className="text-sm text-muted-foreground mb-2">Cole uma URL de imagem</div>
                                  <input
                                    type="text"
                                    value={String(payload.src || "")}
                                    onChange={(e) => { void updatePayload({ src: e.target.value }); }}
                                    className="w-full rounded border border-input px-2 py-1 text-sm"
                                    placeholder="Cole uma URL externa"
                                    maxLength={cfg.allow_content.maxLength}
                                    disabled={userCustomSaving}
                                  />
                                </div>
                              )}
                            </div>

                            
                          </div>
                        </div>
                      );
                    })()
                    : (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-black">Conteúdo</label>
                        <textarea
                          rows={2}
                          value={String(userCustomDraft.conteudo || "")}
                          onChange={(e) => setUserCustomDraft((prev) => ({ ...prev, conteudo: e.target.value }))}
                          className="w-full rounded border border-black/20 px-2 py-1 text-sm"
                          maxLength={cfg.allow_content.maxLength}
                          disabled={userCustomSaving}
                        />
                      </div>
                    )
                )}

                {cfg.allow_position.enabled && (
                  <div className="rounded border border-black/10 p-2">
                    <div className="text-xs font-semibold text-black/70 mb-2">Posição (delta)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <DragNumberInput
                        label="dx"
                        value={toFiniteNumber(userCustomDraft.dx, 0)}
                        onChange={(next) => setUserCustomDraft((prev) => ({
                          ...prev,
                          dx: Math.max(-cfg.allow_position.range, Math.min(cfg.allow_position.range, next)),
                        }))}
                        step={0.1}
                      />
                      <DragNumberInput
                        label="dy"
                        value={toFiniteNumber(userCustomDraft.dy, 0)}
                        onChange={(next) => setUserCustomDraft((prev) => ({
                          ...prev,
                          dy: Math.max(-cfg.allow_position.range, Math.min(cfg.allow_position.range, next)),
                        }))}
                        step={0.1}
                      />
                      <DragNumberInput
                        label="dz"
                        value={toFiniteNumber(userCustomDraft.dz, 0)}
                        onChange={(next) => setUserCustomDraft((prev) => ({
                          ...prev,
                          dz: Math.max(-cfg.allow_position.range, Math.min(cfg.allow_position.range, next)),
                        }))}
                        step={0.1}
                      />
                    </div>
                  </div>
                )}

                {cfg.allow_transform.enabled && (
                  <div className="rounded border border-black/10 p-2">
                    <div className="text-xs font-semibold text-black/70 mb-2">Transformação</div>
                    <div className="grid grid-cols-3 gap-2">
                      <DragNumberInput
                        label="Escala"
                        value={toFiniteNumber(userCustomDraft.scale, toFiniteNumber(userCustomHotspot.scale, 1))}
                        onChange={(next) => setUserCustomDraft((prev) => ({
                          ...prev,
                          scale: Math.max(cfg.allow_transform.scale.min, Math.min(cfg.allow_transform.scale.max, next)),
                        }))}
                        step={0.05}
                      />
                      <DragNumberInput
                        label="Yaw (°)"
                        value={toFiniteNumber(userCustomDraft.rot_yaw, toFiniteNumber(userCustomHotspot.rot_yaw, 0))}
                        onChange={(next) => setUserCustomDraft((prev) => ({
                          ...prev,
                          rot_yaw: Math.max(cfg.allow_transform.yaw.min, Math.min(cfg.allow_transform.yaw.max, next)),
                        }))}
                        step={1}
                      />
                      <DragNumberInput
                        label="Pitch (°)"
                        value={toFiniteNumber(userCustomDraft.rot_pitch, toFiniteNumber(userCustomHotspot.rot_pitch, 0))}
                        onChange={(next) => setUserCustomDraft((prev) => ({
                          ...prev,
                          rot_pitch: Math.max(cfg.allow_transform.pitch.min, Math.min(cfg.allow_transform.pitch.max, next)),
                        }))}
                        step={1}
                      />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-neutral-600">
                  Estas alterações são visíveis apenas para o teu utilizador.
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default dynamic(() => Promise.resolve(AFrameViewer), { ssr: false });