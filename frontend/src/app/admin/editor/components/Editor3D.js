'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
//import { SplatMesh } from "three/examples/jsm/objects/SplatMesh.js"; // se tiver 3DGS

const API = process.env.NEXT_PUBLIC_API_URL;

const HDRI_PRESETS = [
  { value: "none", label: "Sem HDRI" },
  { value: "german_town_street_4k.exr", label: "German Town Street" },
  { value: "pink_sunrise_2k.exr", label: "Pink Sunrise" },
  { value: "quattro_canti_4k.exr", label: "Quattro Canti" },
  { value: "zawiszy_czarnego_4k.exr", label: "Zawiszy Czarnego" },
];

const ROOT_SELECTION_KEY = "__root__";

function getHdriUrl(fileName) {
  if (!fileName || fileName === "none") return null;
  const encoded = encodeURIComponent(fileName);
  if (!API) return `/uploads/pontos/${encoded}`;
  return `${String(API).replace(/\/$/, "")}/uploads/pontos/${encoded}`;
}

function NumberAxisInput({ label, value, step = 0.1, onChange }) {
  return (
    <label className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
      <span className="font-semibold">{label}</span>
      <input
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value || 0))}
      />
    </label>
  );
}

extend({ OrbitControls });

function disposeModel(node) {
  if (!node) return;
  node.traverse?.((child) => {
    if (child?.geometry?.dispose) child.geometry.dispose();
    if (Array.isArray(child?.material)) {
      child.material.forEach((material) => material?.dispose?.());
    } else {
      child?.material?.dispose?.();
    }
  });
}

function Controls() {
  const { camera, gl } = useThree();
  const controls = useRef();
  useFrame(() => controls.current?.update());
  return <orbitControls ref={controls} args={[camera, gl.domElement]} />;
}

function SelectionOutline({ target, color = "#22d3ee" }) {
  const { scene } = useThree();
  const helperRef = useRef(null);

  useEffect(() => {
    if (!target) return;

    const box = new THREE.Box3().setFromObject(target);
    const helper = new THREE.Box3Helper(box, new THREE.Color(color));
    helper.renderOrder = 999;
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.95;
    scene.add(helper);
    helperRef.current = helper;

    return () => {
      scene.remove(helper);
      helper.geometry?.dispose?.();
      helper.material?.dispose?.();
      helperRef.current = null;
    };
  }, [scene, target, color]);

  useFrame(() => {
    if (!target || !helperRef.current) return;
    helperRef.current.box.setFromObject(target);
  });

  return null;
}

function applyEnvSettings(scene, intensity, rotationDeg) {
  const rotationRad = (rotationDeg * Math.PI) / 180;

  scene.traverse((obj) => {
    if (!obj?.isMesh || !obj?.material) return;

    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => {
      if (material && "envMapIntensity" in material) {
        material.envMapIntensity = intensity;
      }
      if (material && "envMapRotation" in material && material.envMapRotation) {
        material.envMapRotation.set(0, rotationRad, 0);
        material.needsUpdate = true;
      }
    });
  });
}

function createEmptyMeshStats() {
  return {
    objects: 0,
    vertices: 0,
    edges: 0,
    faces: 0,
    triangles: 0,
  };
}

function computeGeometryStats(geometry) {
  if (!geometry?.attributes?.position) {
    return createEmptyMeshStats();
  }

  const stats = createEmptyMeshStats();
  stats.objects = 1;
  stats.vertices = geometry.attributes.position.count || 0;

  const indexArray = geometry.index?.array;
  const triangles = indexArray
    ? Math.floor(indexArray.length / 3)
    : Math.floor((geometry.attributes.position.count || 0) / 3);

  stats.triangles = triangles;
  stats.faces = triangles;

  const edgeSet = new Set();

  const pushEdge = (a, b) => {
    const min = a < b ? a : b;
    const max = a < b ? b : a;
    edgeSet.add(`${min}_${max}`);
  };

  if (indexArray) {
    for (let i = 0; i + 2 < indexArray.length; i += 3) {
      const a = indexArray[i];
      const b = indexArray[i + 1];
      const c = indexArray[i + 2];
      pushEdge(a, b);
      pushEdge(b, c);
      pushEdge(c, a);
    }
  } else {
    const vertexCount = geometry.attributes.position.count || 0;
    for (let i = 0; i + 2 < vertexCount; i += 3) {
      pushEdge(i, i + 1);
      pushEdge(i + 1, i + 2);
      pushEdge(i + 2, i);
    }
  }

  stats.edges = edgeSet.size;
  return stats;
}

function addMeshStats(target, value) {
  target.objects += value.objects;
  target.vertices += value.vertices;
  target.edges += value.edges;
  target.faces += value.faces;
  target.triangles += value.triangles;
}

function collectSelectableObjects(model) {
  if (!model) return [];

  const entries = [{
    key: ROOT_SELECTION_KEY,
    uuid: model.uuid,
    label: "Modelo inteiro",
  }];

  const walk = (node, pathKey = "") => {
    node.children?.forEach((child, index) => {
      const nextPathKey = pathKey ? `${pathKey}/${index}` : String(index);
      if (child?.isMesh) {
        entries.push({
          key: nextPathKey,
          uuid: child.uuid,
          label: child.name?.trim() || `Objeto ${entries.length}`,
        });
      }
      walk(child, nextPathKey);
    });
  };

  walk(model);
  return entries;
}

function getNodeBySelectionKey(model, selectionKey) {
  if (!model) return null;
  if (!selectionKey || selectionKey === ROOT_SELECTION_KEY) return model;

  const indices = String(selectionKey)
    .split("/")
    .map((chunk) => parseInt(chunk, 10))
    .filter((value) => Number.isFinite(value));

  let current = model;
  for (const index of indices) {
    if (!current?.children?.[index]) return null;
    current = current.children[index];
  }

  return current;
}

function getNodeStats(node) {
  const total = createEmptyMeshStats();
  if (!node) return total;

  if (node.isMesh && node.geometry) {
    return computeGeometryStats(node.geometry);
  }

  node.traverse?.((candidate) => {
    if (!candidate?.isMesh || !candidate?.geometry) return;
    addMeshStats(total, computeGeometryStats(candidate.geometry));
  });

  return total;
}

function computeModelStats(model, selectedNode) {
  const total = createEmptyMeshStats();
  const selected = getNodeStats(selectedNode || model);

  if (!model) {
    return { selected, total };
  }

  model.traverse?.((node) => {
    if (!node?.isMesh || !node?.geometry) return;
    const next = computeGeometryStats(node.geometry);
    addMeshStats(total, next);
  });

  return { selected, total };
}

function getNodeMaterials(node) {
  const materials = [];
  if (!node) return materials;

  const pushMaterials = (candidate) => {
    if (!candidate?.isMesh || !candidate.material) return;
    if (Array.isArray(candidate.material)) {
      candidate.material.forEach((material) => {
        if (material) materials.push(material);
      });
      return;
    }
    materials.push(candidate.material);
  };

  if (node.isMesh) {
    pushMaterials(node);
    return materials;
  }

  node.traverse?.((candidate) => pushMaterials(candidate));
  return materials;
}

function applyNodeVisualSettings(node, { visible, wireframe, opacity }) {
  if (!node) return;

  if (node.isMesh) {
    node.visible = visible;
  } else {
    node.traverse?.((candidate) => {
      if (candidate?.isMesh) candidate.visible = visible;
    });
  }

  const materials = getNodeMaterials(node);
  materials.forEach((material) => {
    if ("wireframe" in material) material.wireframe = wireframe;
    if ("opacity" in material) material.opacity = opacity;
    if ("transparent" in material) material.transparent = opacity < 1;
    material.needsUpdate = true;
  });
}

function readNodeVisualSettings(node) {
  if (!node) {
    return { visible: true, wireframe: false, opacity: 1 };
  }

  let visible = true;
  if (node.isMesh) {
    visible = node.visible;
  } else {
    let meshFound = false;
    node.traverse?.((candidate) => {
      if (!candidate?.isMesh || meshFound) return;
      visible = candidate.visible;
      meshFound = true;
    });
  }

  const materials = getNodeMaterials(node);
  const firstMaterial = materials[0];

  return {
    visible,
    wireframe: Boolean(firstMaterial?.wireframe),
    opacity: Number.isFinite(firstMaterial?.opacity) ? firstMaterial.opacity : 1,
  };
}

function SceneEnvironment({ hdriUrl, blur, intensity, rotation, worldOpacity, sceneWorldEnabled, onError }) {
  const { scene, gl } = useThree();
  const envTextureRef = useRef(null);
  const sourceTextureRef = useRef(null);
  const [environmentLoadedAt, setEnvironmentLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let nextEnvRenderTarget = null;
    let nextSourceTexture = null;

    if (envTextureRef.current) {
      envTextureRef.current.dispose();
      envTextureRef.current = null;
    }
    if (sourceTextureRef.current) {
      sourceTextureRef.current.dispose?.();
      sourceTextureRef.current = null;
    }

    if (!hdriUrl) {
      scene.environment = null;
      scene.background = null;
      scene.backgroundBlurriness = 0;
      if ("backgroundIntensity" in scene) {
        scene.backgroundIntensity = 0;
      }
      return;
    }

    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    const normalizedUrl = String(hdriUrl).toLowerCase();
    const loader = normalizedUrl.includes(".exr") ? new EXRLoader() : new RGBELoader();

    loader.load(
      hdriUrl,
      (texture) => {
        if (cancelled) {
          texture.dispose?.();
          pmrem.dispose();
          return;
        }

        texture.mapping = THREE.EquirectangularReflectionMapping;
        const renderTarget = pmrem.fromEquirectangular(texture);
        pmrem.dispose();

        nextSourceTexture = texture;
        nextEnvRenderTarget = renderTarget;
        envTextureRef.current = renderTarget.texture;
        sourceTextureRef.current = texture;

        scene.environment = envTextureRef.current;
        scene.background = sourceTextureRef.current;
        setEnvironmentLoadedAt(Date.now());
      },
      undefined,
      () => {
        pmrem.dispose();
        onError?.("Nao foi possivel carregar o HDRI selecionado.");
      }
    );

    return () => {
      cancelled = true;

      // Detach first so renderer won't read disposed textures on the next frame.
      scene.environment = null;
      scene.background = null;
      scene.backgroundBlurriness = 0;
      if ("backgroundIntensity" in scene) {
        scene.backgroundIntensity = 0;
      }

      if (nextEnvRenderTarget) nextEnvRenderTarget.dispose();
      if (nextSourceTexture) nextSourceTexture.dispose?.();

    };
  }, [hdriUrl, gl, onError, scene]);

  useEffect(() => {
    if (!hdriUrl || !envTextureRef.current || !sourceTextureRef.current) {
      scene.environment = null;
      scene.background = null;
      scene.backgroundBlurriness = 0;
      if ("backgroundIntensity" in scene) {
        scene.backgroundIntensity = 0;
      }
      return;
    }

    scene.environment = sceneWorldEnabled ? envTextureRef.current : null;
    scene.background = sceneWorldEnabled ? sourceTextureRef.current : null;
    scene.backgroundBlurriness = sceneWorldEnabled ? blur : 0;
    if ("backgroundIntensity" in scene) {
      scene.backgroundIntensity = sceneWorldEnabled ? worldOpacity : 0;
    }
  }, [hdriUrl, blur, worldOpacity, scene, sceneWorldEnabled, environmentLoadedAt]);

  useEffect(() => {
    if (!hdriUrl) return;
    applyEnvSettings(scene, intensity, rotation);
  }, [hdriUrl, intensity, rotation, scene, environmentLoadedAt]);

  return null;
}

export default function Editor3D({ file, initialSettings, onSave }) {
  const [model, setModel] = useState(null);
  const [selectedObjectKey, setSelectedObjectKey] = useState(ROOT_SELECTION_KEY);
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [scale, setScale] = useState([1, 1, 1]);
  const [position, setPosition] = useState([0, 0, 0]);
  const [selectionVisible, setSelectionVisible] = useState(true);
  const [selectionWireframe, setSelectionWireframe] = useState(false);
  const [selectionOpacity, setSelectionOpacity] = useState(1);
  const [lightIntensity, setLightIntensity] = useState(1);
  const [sceneLightsEnabled, setSceneLightsEnabled] = useState(true);
  const [sceneWorldEnabled, setSceneWorldEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hdriPreset, setHdriPreset] = useState(HDRI_PRESETS[1].value);
  const [hdriRotation, setHdriRotation] = useState(0);
  const [hdriBlur, setHdriBlur] = useState(0);
  const [hdriIntensity, setHdriIntensity] = useState(1);
  const [worldOpacity, setWorldOpacity] = useState(1);
  const [hdriError, setHdriError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const loadedSettingsKeyRef = useRef("");
  const hdriUrl = useMemo(() => getHdriUrl(hdriPreset), [hdriPreset]);
  const selectableObjects = useMemo(() => collectSelectableObjects(model), [model]);
  const selectableObjectMap = useMemo(() => {
    const entries = selectableObjects.map((item) => [item.key, item]);
    return new Map(entries);
  }, [selectableObjects]);
  const selectableObjectKeyByUuid = useMemo(() => {
    const entries = selectableObjects.map((item) => [item.uuid, item.key]);
    return new Map(entries);
  }, [selectableObjects]);
  const selectedNode = useMemo(() => {
    const selected = getNodeBySelectionKey(model, selectedObjectKey);
    return selected || model;
  }, [model, selectedObjectKey]);
  const modelStats = useMemo(() => computeModelStats(model, selectedNode), [model, selectedNode]);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const ext = file.name.split(".").pop().toLowerCase();
    let cancelled = false;

    setLoading(true);
    setError("");
    setSelectedObjectKey(ROOT_SELECTION_KEY);
    loadedSettingsKeyRef.current = "";
    setModel((prev) => {
      disposeModel(prev);
      return null;
    });

    if (ext === "gltf" || ext === "glb") {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          if (cancelled) return;
          setModel(gltf.scene);
          setLoading(false);
        },
        undefined,
        () => {
          if (cancelled) return;
          setError("Nao foi possivel carregar o modelo GLTF/GLB.");
          setLoading(false);
        }
      );
    } else if (ext === "ply") {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (cancelled) return;
        const contents = event.target.result; // ArrayBuffer
        const loader = new PLYLoader();
        let geometry = null;

        try {
          // tenta parse como ASCII
          const text = new TextDecoder().decode(contents);
          geometry = loader.parse(text);
        } catch (asciiErr) {
          try {
            // se falhar, tenta parse binário
            geometry = loader.parse(contents);
          } catch (binaryErr) {
            console.error("Não foi possível carregar o PLY:", asciiErr, binaryErr);
            setError("Erro: ficheiro PLY invalido ou nao suportado.");
            setLoading(false);
            return;
          }
        }

        if (geometry) {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ color: 0xdddddd });
          const mesh = new THREE.Mesh(geometry, material);
          setModel(mesh);
          setLoading(false);
        }
      };

      reader.onerror = () => {
        if (cancelled) return;
        setError("Nao foi possivel ler o ficheiro PLY.");
        setLoading(false);
      };

      // lê como ArrayBuffer (necessário para binário)
      reader.readAsArrayBuffer(file);
    } else {
      setError("Formato nao suportado no editor 3D.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      disposeModel(model);
    };
  }, [model]);

  useEffect(() => {
    if (!model || !selectedNode) return;

    const stamp = `${model.uuid}:${JSON.stringify(initialSettings || {})}`;
    if (loadedSettingsKeyRef.current === stamp) return;
    loadedSettingsKeyRef.current = stamp;

    if (initialSettings && typeof initialSettings === "object") {
      const nextRootPosition = Array.isArray(initialSettings.position) ? initialSettings.position : [0, 0, 0];
      const nextRootRotation = Array.isArray(initialSettings.rotation) ? initialSettings.rotation : [0, 0, 0];
      const nextRootScale = Array.isArray(initialSettings.scale) ? initialSettings.scale : [1, 1, 1];

      model.position.set(
        Number.isFinite(Number(nextRootPosition[0])) ? Number(nextRootPosition[0]) : 0,
        Number.isFinite(Number(nextRootPosition[1])) ? Number(nextRootPosition[1]) : 0,
        Number.isFinite(Number(nextRootPosition[2])) ? Number(nextRootPosition[2]) : 0
      );
      model.rotation.set(
        Number.isFinite(Number(nextRootRotation[0])) ? Number(nextRootRotation[0]) : 0,
        Number.isFinite(Number(nextRootRotation[1])) ? Number(nextRootRotation[1]) : 0,
        Number.isFinite(Number(nextRootRotation[2])) ? Number(nextRootRotation[2]) : 0
      );
      model.scale.set(
        Math.max(0.001, Number.isFinite(Number(nextRootScale[0])) ? Number(nextRootScale[0]) : 1),
        Math.max(0.001, Number.isFinite(Number(nextRootScale[1])) ? Number(nextRootScale[1]) : 1),
        Math.max(0.001, Number.isFinite(Number(nextRootScale[2])) ? Number(nextRootScale[2]) : 1)
      );

      if (Array.isArray(initialSettings.objectTransforms)) {
        initialSettings.objectTransforms.forEach((entry) => {
          const targetNode = getNodeBySelectionKey(model, entry?.key);
          if (!targetNode) return;

          const nextPosition = Array.isArray(entry.position) ? entry.position : [0, 0, 0];
          const nextRotation = Array.isArray(entry.rotation) ? entry.rotation : [0, 0, 0];
          const nextScale = Array.isArray(entry.scale) ? entry.scale : [1, 1, 1];

          targetNode.position.set(
            Number.isFinite(Number(nextPosition[0])) ? Number(nextPosition[0]) : targetNode.position.x,
            Number.isFinite(Number(nextPosition[1])) ? Number(nextPosition[1]) : targetNode.position.y,
            Number.isFinite(Number(nextPosition[2])) ? Number(nextPosition[2]) : targetNode.position.z
          );
          targetNode.rotation.set(
            Number.isFinite(Number(nextRotation[0])) ? Number(nextRotation[0]) : targetNode.rotation.x,
            Number.isFinite(Number(nextRotation[1])) ? Number(nextRotation[1]) : targetNode.rotation.y,
            Number.isFinite(Number(nextRotation[2])) ? Number(nextRotation[2]) : targetNode.rotation.z
          );
          targetNode.scale.set(
            Math.max(0.001, Number.isFinite(Number(nextScale[0])) ? Number(nextScale[0]) : targetNode.scale.x),
            Math.max(0.001, Number.isFinite(Number(nextScale[1])) ? Number(nextScale[1]) : targetNode.scale.y),
            Math.max(0.001, Number.isFinite(Number(nextScale[2])) ? Number(nextScale[2]) : targetNode.scale.z)
          );

          applyNodeVisualSettings(targetNode, {
            visible: Boolean(entry.visible ?? true),
            wireframe: Boolean(entry.wireframe ?? false),
            opacity: Number.isFinite(Number(entry.opacity)) ? Number(entry.opacity) : 1,
          });
        });
      }

      setLightIntensity(Number.isFinite(Number(initialSettings.lightIntensity)) ? Number(initialSettings.lightIntensity) : 1);
      setSceneLightsEnabled(Boolean(initialSettings.sceneLightsEnabled ?? true));
      setSceneWorldEnabled(Boolean(initialSettings.sceneWorldEnabled ?? true));
      setHdriPreset(HDRI_PRESETS.some((p) => p.value === initialSettings.hdriPreset) ? initialSettings.hdriPreset : HDRI_PRESETS[1].value);
      setHdriRotation(Number.isFinite(Number(initialSettings.hdriRotation)) ? Number(initialSettings.hdriRotation) : 0);
      setHdriBlur(Number.isFinite(Number(initialSettings.hdriBlur)) ? Number(initialSettings.hdriBlur) : 0);
      setHdriIntensity(Number.isFinite(Number(initialSettings.hdriIntensity)) ? Number(initialSettings.hdriIntensity) : 1);
      setWorldOpacity(Number.isFinite(Number(initialSettings.worldOpacity)) ? Number(initialSettings.worldOpacity) : 1);

      const nextSelectionKey = selectableObjectMap.has(initialSettings.selectedObjectKey)
        ? initialSettings.selectedObjectKey
        : ROOT_SELECTION_KEY;
      setSelectedObjectKey(nextSelectionKey);
    } else {
      setSelectedObjectKey(ROOT_SELECTION_KEY);
    }
  }, [model, selectedNode, initialSettings, selectableObjectMap]);

  useEffect(() => {
    if (!selectedNode) return;

    setPosition([selectedNode.position.x, selectedNode.position.y, selectedNode.position.z]);
    setRotation([selectedNode.rotation.x, selectedNode.rotation.y, selectedNode.rotation.z]);
    setScale([selectedNode.scale.x, selectedNode.scale.y, selectedNode.scale.z]);

    const visual = readNodeVisualSettings(selectedNode);
    setSelectionVisible(visual.visible);
    setSelectionWireframe(visual.wireframe);
    setSelectionOpacity(visual.opacity);
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedNode) return;
    selectedNode.position.set(position[0], position[1], position[2]);
    selectedNode.updateMatrixWorld(true);
  }, [selectedNode, position]);

  useEffect(() => {
    if (!selectedNode) return;
    selectedNode.rotation.set(rotation[0], rotation[1], rotation[2]);
    selectedNode.updateMatrixWorld(true);
  }, [selectedNode, rotation]);

  useEffect(() => {
    if (!selectedNode) return;
    selectedNode.scale.set(scale[0], scale[1], scale[2]);
    selectedNode.updateMatrixWorld(true);
  }, [selectedNode, scale]);

  useEffect(() => {
    if (!selectedNode) return;
    applyNodeVisualSettings(selectedNode, {
      visible: selectionVisible,
      wireframe: selectionWireframe,
      opacity: selectionOpacity,
    });
  }, [selectedNode, selectionVisible, selectionWireframe, selectionOpacity]);

  const resetTransform = () => {
    const resetPosition = [0, 0, 0];
    const resetRotation = [0, 0, 0];
    const resetScale = [1, 1, 1];

    setPosition(resetPosition);
    setRotation(resetRotation);
    setScale(resetScale);
    setSelectionVisible(true);
    setSelectionWireframe(false);
    setSelectionOpacity(1);

    setLightIntensity(1);
    setSceneLightsEnabled(true);
    setSceneWorldEnabled(true);
    setHdriPreset(HDRI_PRESETS[1].value);
    setHdriRotation(0);
    setHdriBlur(0);
    setHdriIntensity(1);
    setWorldOpacity(1);
    setHdriError("");
  };

  const positionValues = position.map((v) => Number(v.toFixed(3)));
  const rotationDegrees = rotation.map((v) => Number(((v * 180) / Math.PI).toFixed(2)));
  const scaleValues = scale.map((v) => Number(v.toFixed(3)));

  const updateVector3 = (setter, current, index, nextValue) => {
    const next = [...current];
    next[index] = Number.isFinite(nextValue) ? nextValue : 0;
    setter(next);
  };

  const handleSave = async () => {
    if (!onSave) return;

    setSaveLoading(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const objectTransforms = selectableObjects
        .filter((entry) => entry.key !== ROOT_SELECTION_KEY)
        .map((entry) => {
          const node = getNodeBySelectionKey(model, entry.key);
          if (!node) return null;

          const visuals = readNodeVisualSettings(node);
          return {
            key: entry.key,
            position: [node.position.x, node.position.y, node.position.z],
            rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
            scale: [node.scale.x, node.scale.y, node.scale.z],
            visible: visuals.visible,
            wireframe: visuals.wireframe,
            opacity: visuals.opacity,
          };
        })
        .filter(Boolean);

      await onSave({
        selectedObjectKey,
        position: model ? [model.position.x, model.position.y, model.position.z] : [0, 0, 0],
        rotation: model ? [model.rotation.x, model.rotation.y, model.rotation.z] : [0, 0, 0],
        scale: model ? [model.scale.x, model.scale.y, model.scale.z] : [1, 1, 1],
        objectTransforms,
        lightIntensity,
        sceneLightsEnabled,
        sceneWorldEnabled,
        hdriPreset,
        hdriRotation,
        hdriBlur,
        hdriIntensity,
        worldOpacity,
      });
      setSaveMessage("Edicoes guardadas.");
    } catch (err) {
      setSaveError(err?.message || "Nao foi possivel guardar as edicoes.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="grid gap-4 xl:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Visualizador 3D</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-[54vh] min-h-[420px] max-h-[780px] w-full overflow-hidden rounded-lg border border-border bg-black">
            {loading && (
              <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "#f3f4f6", color: "#111827", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
                A carregar modelo...
              </div>
            )}
            {error && (
              <div style={{ position: "absolute", top: loading ? 40 : 8, left: 8, zIndex: 10, background: "#fef2f2", color: "#b91c1c", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
                {error}
              </div>
            )}
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 10,
                background: "rgba(31, 41, 55, 0.72)",
                color: "#f9fafb",
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.3,
                minWidth: 170,
                pointerEvents: "none",
                backdropFilter: "blur(2px)",
              }}
            >
              <div>Objects {modelStats.selected.objects} / {modelStats.total.objects}</div>
              <div>Vertices {modelStats.selected.vertices} / {modelStats.total.vertices}</div>
              <div>Edges {modelStats.selected.edges} / {modelStats.total.edges}</div>
              <div>Faces {modelStats.selected.faces} / {modelStats.total.faces}</div>
              <div>Triangles {modelStats.selected.triangles} / {modelStats.total.triangles}</div>
            </div>
            <Canvas style={{ width: "100%", height: "100%", background: "#000" }}>
              <gridHelper args={[40, 40, "#6b7280", "#374151"]} position={[0, 0, 0]} />
              <axesHelper args={[2.5]} position={[0, 0, 0]} />
              <ambientLight intensity={sceneLightsEnabled ? 0.5 : 0} />
              <directionalLight position={[5, 10, 5]} intensity={sceneLightsEnabled ? lightIntensity : 0} />
              <SceneEnvironment
                hdriUrl={hdriUrl}
                blur={hdriBlur}
                intensity={hdriIntensity}
                rotation={hdriRotation}
                worldOpacity={worldOpacity}
                sceneWorldEnabled={sceneWorldEnabled}
                onError={setHdriError}
              />
              <Controls />
              {selectedNode && <SelectionOutline target={selectedNode} />}
              {model && (
                <primitive
                  object={model}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const objectUuid = event?.object?.uuid;
                    if (!objectUuid) return;
                    const objectKey = selectableObjectKeyByUuid.get(objectUuid);
                    if (!objectKey) return;
                    setSelectedObjectKey(objectKey);
                  }}
                />
              )}
            </Canvas>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-4 xl:self-start">
        <CardHeader className="pb-3">
          <CardTitle>Ajustes 3D</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 xl:max-h-[78vh] xl:overflow-y-auto xl:pr-1">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Selecao de objeto</h3>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedObjectKey}
              onChange={(e) => setSelectedObjectKey(e.target.value)}
            >
              {selectableObjects.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Dica: tambem podes clicar diretamente num objeto no visualizador para o selecionar.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Transform (Blender style)</h3>
            <div className="rounded-md border border-border p-3 space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Location</div>
                <div className="space-y-1.5">
                  <NumberAxisInput label="X" value={positionValues[0]} step={0.01} onChange={(value) => updateVector3(setPosition, position, 0, value)} />
                  <NumberAxisInput label="Y" value={positionValues[1]} step={0.01} onChange={(value) => updateVector3(setPosition, position, 1, value)} />
                  <NumberAxisInput label="Z" value={positionValues[2]} step={0.01} onChange={(value) => updateVector3(setPosition, position, 2, value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Rotation (deg)</div>
                <div className="space-y-1.5">
                  <NumberAxisInput label="X" value={rotationDegrees[0]} step={0.1} onChange={(value) => updateVector3(setRotation, rotation, 0, (value * Math.PI) / 180)} />
                  <NumberAxisInput label="Y" value={rotationDegrees[1]} step={0.1} onChange={(value) => updateVector3(setRotation, rotation, 1, (value * Math.PI) / 180)} />
                  <NumberAxisInput label="Z" value={rotationDegrees[2]} step={0.1} onChange={(value) => updateVector3(setRotation, rotation, 2, (value * Math.PI) / 180)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Scale</div>
                <div className="space-y-1.5">
                  <NumberAxisInput label="X" value={scaleValues[0]} step={0.01} onChange={(value) => updateVector3(setScale, scale, 0, Math.max(0.001, value))} />
                  <NumberAxisInput label="Y" value={scaleValues[1]} step={0.01} onChange={(value) => updateVector3(setScale, scale, 1, Math.max(0.001, value))} />
                  <NumberAxisInput label="Z" value={scaleValues[2]} step={0.01} onChange={(value) => updateVector3(setScale, scale, 2, Math.max(0.001, value))} />
                </div>
              </div>
            </div>
            <div className="rounded-md border border-border p-3 space-y-3">
              <div className="text-xs font-medium text-foreground">Opcoes da selecao</div>
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectionVisible}
                  onChange={(e) => setSelectionVisible(e.target.checked)}
                />
                Visivel
              </label>
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectionWireframe}
                  onChange={(e) => setSelectionWireframe(e.target.checked)}
                />
                Wireframe
              </label>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Opacidade: {selectionOpacity.toFixed(2)}</label>
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectionOpacity}
                  onChange={(e) => setSelectionOpacity(parseFloat(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={resetTransform}>
                Resetar ajustes
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={saveLoading || !onSave}>
                {saveLoading ? "A guardar..." : "Guardar"}
              </Button>
            </div>
            {saveMessage && <p className="text-xs text-emerald-700">{saveMessage}</p>}
            {saveError && <p className="text-xs text-red-700">{saveError}</p>}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Lighting</h3>
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              <input type="checkbox" checked={sceneLightsEnabled} onChange={(e) => setSceneLightsEnabled(e.target.checked)} />
              Scene Lights
            </label>
            <label className="text-xs text-muted-foreground">Intensidade das luzes: {lightIntensity.toFixed(1)}</label>
            <input className="w-full" type="range" min={0} max={5} step={0.1} value={lightIntensity} onChange={(e) => setLightIntensity(parseFloat(e.target.value))} />

            <label className="text-xs text-muted-foreground flex items-center gap-2">
              <input type="checkbox" checked={sceneWorldEnabled} onChange={(e) => setSceneWorldEnabled(e.target.checked)} />
              Scene World
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">World HDRI</h3>
            <label className="text-xs text-muted-foreground">Preset HDRI</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={hdriPreset}
              onChange={(e) => {
                setHdriPreset(e.target.value);
                setHdriError("");
              }}
            >
              {HDRI_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
            {hdriError && <p className="text-xs text-red-700">{hdriError}</p>}

            {hdriPreset !== "none" && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Rotation: {Math.round(hdriRotation)} deg</label>
                <input className="w-full" type="range" min={-180} max={180} step={1} value={hdriRotation} onChange={(e) => setHdriRotation(parseFloat(e.target.value))} />

                <label className="text-xs text-muted-foreground">Strength: {hdriIntensity.toFixed(3)}</label>
                <input className="w-full" type="range" min={0} max={5} step={0.001} value={hdriIntensity} onChange={(e) => setHdriIntensity(parseFloat(e.target.value))} />

                <label className="text-xs text-muted-foreground">World Opacity: {worldOpacity.toFixed(3)}</label>
                <input className="w-full" type="range" min={0} max={1} step={0.001} value={worldOpacity} onChange={(e) => setWorldOpacity(parseFloat(e.target.value))} />

                <label className="text-xs text-muted-foreground">Blur do ambiente: {hdriBlur.toFixed(2)}</label>
                <input className="w-full" type="range" min={0} max={1} step={0.01} value={hdriBlur} onChange={(e) => setHdriBlur(parseFloat(e.target.value))} />

                <Button type="button" size="sm" variant="outline" onClick={() => setHdriPreset("none")}>
                  Remover HDRI
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
