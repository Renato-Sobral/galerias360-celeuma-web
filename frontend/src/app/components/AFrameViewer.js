"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import "aframe";
import ContextMenuWrapper from "./ContextMenuWrapper";
import CustomDialog from "./CustomDialog";
import DropdownSingle from "./select";
import Swal from "sweetalert2";

const AFrameViewer = ({ environment, enableContextMenu = false, pontoId }) => {
  const sceneRef = useRef(null);
  const [hotspots, setHotspots] = useState([]);
  const clickEventRef = useRef(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTipo, setEditTipo] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const parsedEnvironment = base64ToBlob(environment);
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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
    { label: "Link", value: "link" },
  ];

  /*START Environment video handler*/
  const handleVideoRef = (el) => {
    videoRef.current = el;
    if (!el) return;

    el.addEventListener('canplay', () => setVideoReady(true));
    el.play().catch(() => console.log('Autoplay bloqueado'));
  };

  useEffect(() => {
    if (!detectBase64Type(environment).startsWith('video/')) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleCanPlay = () => setVideoReady(true);
    videoEl.addEventListener('canplay', handleCanPlay);
    
    // forçar autoplay
    videoEl.play().catch(() => {
      console.log('Autoplay bloqueado, precisa interação do usuário');
    });

    return () => videoEl.removeEventListener('canplay', handleCanPlay);
  }, [environment]);
  /*END Environment video handler*/

  /*START Environment file handler*/
  function detectBase64Type(base64) {
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
  /*END Environment file handler*/

  useEffect(() => {
    const el = document.querySelector('a-text');
    if (el) {
      el.object3D.renderOrder = 1;
    }
  }, []);

  const defaultProps = {
    position: { x: 0, y: 0, z: -5 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
  };

  const tipoToAFrame = {
    texto: (conteudo) => (
      <a-text
        font="kelsonsans"
        value={conteudo || "Texto em falta"}
        color="white"
        width="500"
        align="center"
        position="5 15 25"
        look-at="[camera]"
      />
    ),

    imagem: (conteudo) => (
      <a-image 
        src={conteudo} 
        position="5 15 25"
        width="400" 
        height="200" 
        opacity="1"
        transparent="false"  
        look-at="[camera]"
      />
    ),

    modelo3d: (conteudo) => (
      <a-entity
        gltf-model={conteudo}
        position={`${defaultProps.position.x} ${defaultProps.position.y} ${defaultProps.position.z}`}
        rotation={`${defaultProps.rotation.x} ${defaultProps.rotation.y} ${defaultProps.rotation.z}`}
        scale={`${defaultProps.scale.x} ${defaultProps.scale.y} ${defaultProps.scale.z}`}
        look-at="[camera]"
        style={{ position: "relative" }}
      >
        <button
          onClick={() => handleOpenEditor(conteudo)}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            zIndex: 2000,
          }}
        >
          ⚙️
        </button>
      </a-entity>
    ),

    audio: (conteudo) => (
      <a-entity
        sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: false`}
      ></a-entity>
    ),

    audioespacial: (conteudo) => (
      <a-entity
        position="5 15 25"
        sound={`src: url(${conteudo}); autoplay: true; loop: true; positional: true; refDistance: 50; rolloffFactor: 1;`}
      ></a-entity>
    ),

    video: (conteudo) => (
      <a-video src={conteudo} position="0 0 0" width="400" height="225" look-at="[camera]" controls />
    ),

    link: (conteudo) => (
      <>
          <a-sphere position="0 0 0" radius="16" color="#ff2e63" />
          <a-link
            href={conteudo}
            title={conteudo}
            position="0 0 0.5"
            scale="16 16 1"
            look-at="[camera]"
          />
      </>
    ),
  };

  const contextMenuOptions = selectedHotspot
    ? [
      { label: "Editar Hotspot", value: "edit" },
      { label: "Eliminar Hotspot", value: "delete" },
    ]
    : [{ label: "Criar Hotspot", value: "create" }];

  const fetchHotspots = async () => {
    try {
      const res = await fetch("http://localhost:3000/hotspot/");
      const data = await res.json();
      if (Array.isArray(data)) {
        const doPonto = data.filter(
          (h) => Number(h.id_ponto) === Number(pontoId)
        );
        const formatados = doPonto.map((h) => ({
          id: h.id_hotspot,
          id_hotspot: h.id_hotspot,
          x: parseFloat(h.x),
          y: parseFloat(h.y),
          z: parseFloat(h.z),
          tipo: h.tipo || "",
          conteudo: h.conteudo || "",
        }));
        setHotspots(formatados);
      }
    } catch (err) {
      console.error("❌ Erro ao buscar hotspots:", err);
    }
  };

  useEffect(() => {
    fetchHotspots();
  }, [pontoId]);

  useEffect(() => {
    if (!enableContextMenu) return;

    const scene = sceneRef.current;
    if (!scene) return;

    const onClickScene = (e) => {
      const isHotspot = e.target?.classList?.contains("hotspot-interaction");
      if (!isHotspot) {
        setSelectedHotspot(null);
        clickEventRef.current = e;
      }
    };

    scene.addEventListener("click", onClickScene);

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.detail.mouseEvent.button;
      const id = Number(e.currentTarget.dataset.id);
      const hotspot = hotspots.find((h) => h.id === id);
      if (hotspot) {
        setSelectedHotspot(hotspot);
        clickEventRef.current = e;
        console.log("🟥 Clique no HOTSPOT:", hotspot);
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
      scene.removeEventListener("click", onClickScene);
      clickablePlanes.forEach((el) => {
        el.removeEventListener("click", handler);
      });
    };
  }, [enableContextMenu, hotspots]);

  const createHotspot = async () => {
    const sceneEl = sceneRef.current;
    const event = clickEventRef.current;
    if (!sceneEl || !sceneEl.camera || !event) return;

    const THREE = window.THREE;
    if (!THREE) {
      console.error("THREE.js ainda não carregado");
      return;
    }

    const rect = sceneEl.canvas.getBoundingClientRect();
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, sceneEl.camera);

    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 500);
    const intersection = new THREE.Vector3();
    const hasIntersection = raycaster.ray.intersectSphere(sphere, intersection);

    if (!hasIntersection) {
      console.warn("❌ Sem interseção com a esfera");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/hotspot/add", {
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

      fetchHotspots();
    } catch (err) {
      console.error("❌ Erro ao guardar hotspot:", err);
    }
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
      const res = await fetch(`http://localhost:3000/hotspot/${id}`, {
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

    try {
      const res = await fetch(`http://localhost:3000/hotspot/${selectedHotspot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: editTipo, conteudo: editConteudo }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar hotspot");
      const data = await res.json();
      console.log("✅ Hotspot atualizado:", data);
      setHotspots((prev) =>
        prev.map((h) =>
          h.id === selectedHotspot.id ? { ...h, tipo: editTipo, conteudo: editConteudo } : h
        )
      );
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
      className="w-full h-full"
    >
      <a-camera
        position="0 0 0"
        camera
        look-controls
        wasd-controls-enabled="false"
        raycaster="objects: .clickable"
        cursor="rayOrigin: mouse"
      ></a-camera>

      {parsedEnvironment.mime.startsWith("image/") ? (
        <a-sky src={`data:${parsedEnvironment.mime};base64,${environment}`} rotation="0 -130 0" />
      ) : parsedEnvironment.mime.startsWith("video/") ? (
        <>
          <video style={{ 'display' : 'none' }} id="environment" ref={handleVideoRef} preload="auto" crossOrigin="anonymous" autoPlay loop muted playsInline>
            <source src={parsedEnvironment.url} type={parsedEnvironment.mime}></source>
          </video>
          {videoReady && <a-sky src="#environment" rotation="0 -130 0" />}
        </>
      ) : null}

      {hotspots.map((pos) => (
        <a-entity key={pos.id} position={`${pos.x} ${pos.y} ${pos.z}`}>
          {(!pos.tipo || !pos.conteudo)
            ? <a-sphere position="0 0 0" radius="16" color="red" />
            : tipoToAFrame[pos.tipo]?.(pos.conteudo, pos) || null}

          <a-plane
            class="clickable hotspot-interaction"
            data-id={pos.id}
            position="0 0 -5"
            width="25"
            height="25"
            material="color: #fff; opacity: 0"
            transparent="true"
            rotation="0 0 0"
            event-set__enter="_event: mouseenter; opacity: 0.15"
            event-set__leave="_event: mouseleave; opacity: 0"
          />
        </a-entity>
      ))}
    </a-scene>
  );

  return (
    <div className="relative w-full h-full">
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
      {enableContextMenu ? (
        <ContextMenuWrapper
          options={contextMenuOptions}
          onSelect={(value) => {
            if (value === "create") {
              createHotspot();
            } else if (value === "edit") {
              if (selectedHotspot) {
                setEditTipo(selectedHotspot.tipo || "");
                setEditConteudo(selectedHotspot.conteudo || "");
                setEditDialogOpen(true);
              }
            } else if (value === "delete") {
              deleteHotspot(selectedHotspot.id);
            }
          }}
        >
          {scene}
        </ContextMenuWrapper>
      ) : (
        scene
      )}
      <CustomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Editar Hotspot"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        onConfirm={updateHotspot}
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
            <input
              type="text"
              value={editConteudo}
              onChange={(e) => setEditConteudo(e.target.value)}
              className="border rounded px-2 py-1 dark:bg-black"
            />
          </div>
        )}
      </CustomDialog>
    </div>
  );
};

export default dynamic(() => Promise.resolve(AFrameViewer), { ssr: false });