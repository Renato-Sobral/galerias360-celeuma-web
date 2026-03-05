"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvent } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getUserNameFromToken, getUserRoleFromToken } from "../components/jwtDecode";
import CustomMarker from "../components/CustomMarker";
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import MapClickReset from "../components/MapClickReset";
import RoutingMachine from "../components/RoutingMachine";
import MapUserRealTimeLocation from "../components/MapUserRealTimeLocation";
import { Switch } from "@/components/ui/switch";
import TooltipWrapper from "../components/TooltipWrapper";
import Swal from "sweetalert2";
import { Image, Pencil } from "lucide-react";
import 'aframe';

export default function MapComponent() {
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, latlng: null });
    const [formLateralOpen, setFormLateralOpen] = useState(false);
    const [formLateralAssetsOpen, setFormLateralAssetsOpen] = useState(false);
    const [coordinates, setCoordinates] = useState(null);
    const [pontos, setPontos] = useState([]);
    const [rotas, setRotas] = useState([]);
    const [trajetoPontos, setTrajetoPontos] = useState([]);
    const [pontoMenu, setPontoMenu] = useState({ visible: false, x: 0, y: 0, ponto: null });
    const [rotaSelecionada, setRotaSelecionada] = useState(null);
    const [showRoutes, setShowRoutes] = useState(false);
    const [pontoVisualizacoes, setPontoVisualizacoes] = useState(0);
    const userRole = getUserRoleFromToken();
    const [overlays, setOverlays] = useState([]);
    const [overlayDone, setOverlayDone] = useState(false);
    const overlayFetchStartedRef = useRef(false);
    const isAdmin = userRole === "Admin";

    /*IMAGE CONTROLS*/
    const [panelOpenImg, setPanelOpenImg] = useState(false);
    const [brightnessImg, setBrightnessImg] = useState(1);
    const [contrastImg, setContrastImg] = useState(1);
    const [saturationImg, setSaturationImg] = useState(1);
    const [hueImg, setHueImg] = useState(0);

    /*VIDEO CONTROLS*/
    const [panelOpenVideo, setPanelOpenVideo] = useState(false);
    const [brightnessVideo, setBrightnessVideo] = useState(1);
    const [contrastVideo, setContrastVideo] = useState(1);
    const [saturationVideo, setSaturationVideo] = useState(1);
    const [hueVideo, setHueVideo] = useState(0);

    /*3D MODEL CONTROLS*/
    const [panelOpen, setPanelOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: -10, z: -20 });
    const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
    const [scale, setScale] = useState({ x: 0.1, y: 0.1, z: 0.1 });
    const [ambientIntensity, setAmbientIntensity] = useState(0.7);
    const [directionalIntensity, setDirectionalIntensity] = useState(1);
    const [directionalPosition, setDirectionalPosition] = useState({ x: 1, y: 2, z: 3 });
    const [brightness, setBrightness] = useState(1);
    const [contrast, setContrast] = useState(1);
    const [saturation, setSaturation] = useState(1);
    const [hue, setHue] = useState(0);

    useEffect(() => {
        if (!showRoutes) {
            const map = document.querySelector(".leaflet-container")?._leaflet_map;
            if (map) {
                map.eachLayer((layer) => {
                    if (layer._container?.classList?.contains("leaflet-routing-container")) {
                        map.removeControl(layer);
                    }
                    if (layer._router || layer._routes) {
                        map.removeLayer(layer);
                    }
                });
            }
        }
    }, [showRoutes]);

    const loadPontos = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ponto/list`);
            if (!response.ok) throw new Error("Erro ao buscar pontos");
            const data = await response.json();
            setPontos(data.pontos);
        } catch (error) {
            console.error("Erro ao carregar pontos:", error);
        }
    }, []);

    const loadRotas = useCallback(async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trajeto/list`);
            const data = await res.json();
            if (res.ok) {
                setRotas(data.trajetos);
            } else {
                console.error(data.error || "Erro ao buscar trajetos");
            }
        } catch (err) {
            console.error("Erro ao buscar trajetos:", err);
        }
    }, []);

    const fetchPontoVisualizacoes = useCallback(async (pontoId) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/estatistica/visualizacoes/${pontoId}`);
            const data = await response.json();
            if (response.ok) {
                setPontoVisualizacoes((prev) => ({
                    ...prev,
                    [pontoId]: data.visualizacoes,
                }));
            } else {
                console.error("Erro ao carregar visualizações:", data.error);
            }
        } catch (error) {
            console.error("Erro ao buscar visualizações:", error);
        }
    }, []);

    useEffect(() => {
        loadPontos();
        loadRotas();
    }, [loadPontos, loadRotas]);

    useEffect(() => {
        pontos.forEach((ponto) => {
            if (ponto.id_ponto) {
                fetchPontoVisualizacoes(ponto.id_ponto);
            } else {
                console.error("ID do ponto é inválido ou indefinido");
            }
        });
    }, [pontos, fetchPontoVisualizacoes]);

    const handlePontoRightClick = useCallback((e, ponto) => {
        if (!isAdmin) return;
        e.originalEvent.preventDefault();
        setPontoMenu({ visible: true, x: e.containerPoint.x + 5, y: e.containerPoint.y + 5, ponto });
        setContextMenu({ visible: false, x: 0, y: 0, latlng: null });
    }, []);

    const handleTrajetoSelection = useCallback(() => {
        const ponto = pontoMenu.ponto;
        if (!ponto) return;

        if (!trajetoPontos.length) {
            setTrajetoPontos([ponto]);
        } else if (trajetoPontos.length === 1 && ponto.id_ponto !== trajetoPontos[0].id_ponto) {
            setTrajetoPontos(prev => [...prev, ponto]);
        }
        setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
    }, [pontoMenu.ponto, trajetoPontos]);

    const handleTrajetoSelectionFromPonto = useCallback((ponto) => {
        if (!isAdmin || !ponto) return;

        if (!trajetoPontos.length) {
            setTrajetoPontos([ponto]);
        } else if (trajetoPontos.length === 1 && ponto.id_ponto !== trajetoPontos[0].id_ponto) {
            setTrajetoPontos((prev) => [...prev, ponto]);
        }

        setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
    }, [isAdmin, trajetoPontos]);

    const handleGuardarTrajeto = useCallback(async () => {
        if (trajetoPontos.length < 2) return;

        const result = await Swal.fire({
            title: "Confirmar criação",
            text: `Queres criar este trajeto com ${trajetoPontos.length} ponto(s)?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sim, criar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#171717",
            cancelButtonColor: "#6b7280",
        });

        if (!result.isConfirmed) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trajeto/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pontos: trajetoPontos.map((p) => p.id_ponto),
                    description: `Trajeto criado via mapa (${trajetoPontos.length} pontos)`,
                    video: null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Erro ao guardar trajeto:", data.error);
                Swal.fire({
                    title: "Erro",
                    text: data.error || "Erro ao guardar trajeto.",
                    icon: "error",
                    confirmButtonColor: "#171717",
                });
            } else {
                Swal.fire({
                    title: "Criado!",
                    text: "Trajeto guardado com sucesso.",
                    icon: "success",
                    confirmButtonColor: "#171717",
                });
                setTrajetoPontos([]);
                loadRotas();
            }
        } catch (error) {
            console.error("Erro na requisição:", error);
            Swal.fire({
                title: "Erro",
                text: "Erro ao comunicar com o servidor.",
                icon: "error",
                confirmButtonColor: "#171717",
            });
        }
    }, [trajetoPontos, loadRotas]);

    const handleGetCoordinates = useCallback(() => {
        if (contextMenu.latlng) {
            navigator.clipboard.writeText(`${contextMenu.latlng.lat}, ${contextMenu.latlng.lng}`);
            setCoordinates(contextMenu.latlng);
        }
        setContextMenu({ visible: false });
    }, [contextMenu]);

    function MapClickHandler() {
        const isAdmin = getUserRoleFromToken() === "Admin";

        useMapEvent({
            contextmenu(e) {
                if (isAdmin) {
                    setContextMenu({
                        visible: true,
                        x: e.containerPoint.x + 5,
                        y: e.containerPoint.y + 5,
                        latlng: { lat: e.latlng.lat.toFixed(6), lng: e.latlng.lng.toFixed(6) }
                    });
                    setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
                }
            }
        });

        useEffect(() => {
            const handleClick = () => {
                setContextMenu({ visible: false, x: 0, y: 0, latlng: null });
                setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
            };
            window.addEventListener("click", handleClick);
            return () => window.removeEventListener("click", handleClick);
        }, []);

        return null;
    }

    const ContextMenu = () => contextMenu.visible && (
        <div
            className="absolute bg-white border border-gray-200 shadow-md rounded-md p-1"
            style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
        >
            <div
                onClick={handleGetCoordinates}
                className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer rounded"
            >
                Obter coordenadas
            </div>
        </div>
    );

    const PontoContextMenu = () => pontoMenu.visible && (
        <div
            className="absolute bg-white border border-gray-200 shadow-md rounded-md p-1"
            style={{ top: pontoMenu.y, left: pontoMenu.x, zIndex: 1000 }}
        >
            <div
                onClick={handleTrajetoSelection}
                className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer rounded"
            >
                {trajetoPontos.length === 0 ? "Adicionar Trajeto" : "Definir Fim do Trajeto"}
            </div>
        </div>
    );

    async function fetchOverlayPreferencial(idPreferencial = 1) {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/overlay/list`);
            if (!response.ok) {
                throw new Error(`Erro ao buscar overlay: ${response.statusText}`);
            }

            const data = await response.json();
            const overlays = Array.isArray(data?.overlays) ? data.overlays : [];

            if (!overlays.length) return null;

            const overlayPreferencial = overlays.find((overlay) => {
                const overlayId = overlay?.id ?? overlay?.id_overlay;
                return Number(overlayId) === Number(idPreferencial);
            });

            return overlayPreferencial ?? overlays[0];
        } catch (error) {
            console.warn("Erro ao buscar overlay:", error);
            return null;
        }
    }

    useEffect(() => {
        if (overlayFetchStartedRef.current) return;
        overlayFetchStartedRef.current = true;

        if (!overlayDone) {
            async function loadOverlay() {
                const overlay = await fetchOverlayPreferencial(1);
                if (overlay) {
                    console.log("Overlay carregado:", overlay);
                    setOverlays([overlay]);
                }

                // Mesmo que não exista overlay, evitar repetir fetch/erros
                setOverlayDone(true);
            }
            loadOverlay();
        }
    }, []);

    return (
        <div className="fixed top-0 h-screen w-screen">
            {overlays.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 10,
                        left: 10,
                        zIndex: 2000,
                        background: "rgba(0,0,0,0.5)",
                        padding: 8,
                        borderRadius: 8,
                    }}
                >
                    {overlays.map((overlay) => {
                        if (!overlay.conteudo) return null;

                        // Se for imagem
                        if (overlay.tipo === "imagem") {
                            return (
                                <div key={overlay.id}>
                                    <div style={{ "position": "relative" }}>
                                        <img
                                            src={`data:image/jpg;base64,${overlay.conteudo}`}
                                            alt="overlay"
                                            style={{
                                                maxWidth: "25vw",
                                                aspectRatio: "16:9",
                                                filter: `
                                                    brightness(${brightnessImg})
                                                    contrast(${contrastImg})
                                                    saturate(${saturationImg})
                                                    hue-rotate(${hueImg}deg)
                                                `,
                                                transition: "filter 0.3s ease-in-out"
                                            }}
                                        />
                                        {isAdmin && (
                                            <button
                                                onClick={() => setPanelOpenImg(true)}
                                                style={{
                                                    position: "absolute",
                                                    bottom: 10,
                                                    right: 10,
                                                    zIndex: 1000,
                                                    background: "rgba(0,0,0,0.7)",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: 8,
                                                    padding: "8px 12px",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <Image className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {/* PAINEL DE IMAGEM */}
                                    {panelOpenImg && isAdmin && (
                                        <div className="fixed top-1/2 -translate-y-1/2 bg-white shadow-xl rounded-xl right-4 w-[90vw] sm:w-[25%] h-[60%] overflow-y-auto z-50">
                                            <button onClick={() => setPanelOpenImg(false)} className="absolute text-black top-4 right-4">✕</button>
                                            <div className="p-6 space-y-4">
                                                <h2 className="text-lg text-black font-semibold mb-2">VFX - Imagem</h2>

                                                <label className="text-black">Brilho:</label>
                                                <input
                                                    type="range" min="0" max="2" step="0.05"
                                                    value={brightnessImg} onChange={(e) => setBrightnessImg(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Contraste:</label>
                                                <input
                                                    type="range" min="0" max="2" step="0.05"
                                                    value={contrastImg} onChange={(e) => setContrastImg(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Saturação:</label>
                                                <input
                                                    type="range" min="0" max="3" step="0.05"
                                                    value={saturationImg} onChange={(e) => setSaturationImg(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Matiz (Hue):</label>
                                                <input
                                                    type="range" min="0" max="360" step="1"
                                                    value={hueImg} onChange={(e) => setHueImg(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Se for vídeo
                        if (overlay.tipo === "video") {
                            return (
                                <div key={overlay.id}>
                                    <div style={{ position: "relative" }}>
                                        <video
                                            src={`data:video/mp4;base64,${overlay.conteudo}`}
                                            autoPlay
                                            loop
                                            muted
                                            style={{
                                                maxWidth: "25vw",
                                                aspectRatio: "16:9",
                                                filter: `
                                                    brightness(${brightnessVideo})
                                                    contrast(${contrastVideo})
                                                    saturate(${saturationVideo})
                                                    hue-rotate(${hueVideo}deg)
                                                `,
                                                transition: "filter 0.3s ease-in-out"
                                            }}
                                        />
                                        {isAdmin && (
                                            <button
                                                onClick={() => setPanelOpenVideo(true)}
                                                style={{
                                                    position: "absolute",
                                                    bottom: 10,
                                                    right: 10,
                                                    zIndex: 1000,
                                                    background: "rgba(0,0,0,0.7)",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: 8,
                                                    padding: "8px 12px",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <Image className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {panelOpenVideo && isAdmin && (
                                        <div className="fixed top-1/2 -translate-y-1/2 bg-white shadow-xl rounded-xl right-4 w-[90vw] sm:w-[25%] h-[60%] overflow-y-auto z-50">
                                            <button onClick={() => setPanelOpenVideo(false)} className="absolute text-black top-4 right-4">✕</button>
                                            <div className="p-6 space-y-4">
                                                <h2 className="text-lg text-black font-semibold mb-2">VFX - Vídeo</h2>

                                                <label className="text-black">Brilho:</label>
                                                <input
                                                    type="range" min="0" max="2" step="0.05"
                                                    value={brightnessVideo} onChange={(e) => setBrightnessVideo(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Contraste:</label>
                                                <input
                                                    type="range" min="0" max="2" step="0.05"
                                                    value={contrastVideo} onChange={(e) => setContrastVideo(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Saturação:</label>
                                                <input
                                                    type="range" min="0" max="3" step="0.05"
                                                    value={saturationVideo} onChange={(e) => setSaturationVideo(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Matiz (Hue):</label>
                                                <input
                                                    type="range" min="0" max="360" step="1"
                                                    value={hueVideo} onChange={(e) => setHueVideo(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Se for modelo 3D (GLB)
                        if (overlay.tipo === "modelo3d") {
                            // Para GLB base64, A-Frame precisa criar Blob URL
                            const blob = new Blob(
                                [Uint8Array.from(atob(overlay.conteudo), c => c.charCodeAt(0))],
                                { type: "model/gltf-binary" } // ou 'model/gltf-binary' mesmo
                            );
                            const url = URL.createObjectURL(blob);
                            return (
                                <div key={overlay.id}>
                                    <div
                                        className="mapModel"
                                        style={{
                                            position: "absolute",
                                            bottom: 10,
                                            left: 10,
                                            width: "25vw",  // define largura visível
                                            height: "25vw", // define altura visível
                                            zIndex: 1000,
                                            filter: `
                                                brightness(${brightness})
                                                contrast(${contrast})
                                                saturate(${saturation})
                                                hue-rotate(${hue}deg)
                                            `,
                                            transition: "filter 0.3s ease-in-out"
                                        }}
                                    >
                                        <a-scene embedded style={{ width: "100%", height: "100%" }}>
                                            <a-entity
                                                gltf-model={url}
                                                position={`${position.x} ${position.y} ${position.z}`}
                                                rotation={`${rotation.x} ${rotation.y} ${rotation.z}`}
                                                scale={`${scale.x} ${scale.y} ${scale.z}`}
                                                look-at="[camera]"
                                                ref={(el) => {
                                                    if (el && el.object3D) {
                                                        // calcula bounding box do modelo
                                                        const bbox = new THREE.Box3().setFromObject(el.object3D);
                                                        const center = bbox.getCenter(new THREE.Vector3());

                                                        // subtrai o centro para centralizar o modelo
                                                        el.object3D.position.sub(center);
                                                    }
                                                }}
                                            ></a-entity>

                                            <a-light type="ambient" color="#ffffff" intensity={ambientIntensity} />
                                            <a-light
                                                type="directional"
                                                color="#ffffff"
                                                intensity={directionalIntensity}
                                                position={`${directionalPosition.x} ${directionalPosition.y} ${directionalPosition.z}`}
                                            />

                                            <a-entity camera look-controls position="0 0 3"></a-entity>
                                        </a-scene>
                                        {isAdmin && (
                                            <button
                                                onClick={() => setPanelOpen(true)}
                                                style={{
                                                    position: "absolute",
                                                    bottom: 10,
                                                    right: 10,
                                                    zIndex: 1000,
                                                    background: "rgba(0,0,0,0.7)",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: 8,
                                                    padding: "8px 12px",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <Image className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {panelOpen && isAdmin && (
                                        <div
                                            className={`
                                            fixed top-1/2 -translate-y-1/2
                                            bg-white shadow-xl rounded-xl
                                            transition-all duration-300 ease-in-out transform
                                            right-4 w-[90vw] sm:w-[25%] h-[60%] overflow-y-auto
                                            z-50
                                        `}
                                        >
                                            <button
                                                onClick={() => setPanelOpen(false)}
                                                className="absolute top-4 right-4 text-gray-700 hover:text-black"
                                            >
                                                ✕
                                            </button>

                                            <div className="p-6 space-y-4">
                                                <h2 className="text-lg font-semibold text-black mb-2">Editar Modelo e Luzes</h2>

                                                <h3 className="text-black font-semibold">Modelo 3D</h3>

                                                <label className="text-black">Posição X:</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    step="0.1"
                                                    value={position.x}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setPosition({ ...position, x: parseFloat(e.target.value) })}
                                                />

                                                <label className="text-black">Posição Y:</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    step="0.1"
                                                    value={position.y}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setPosition({ ...position, y: parseFloat(e.target.value) })}
                                                />

                                                <label className="text-black">Posição Z:</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    step="0.1"
                                                    value={position.z}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setPosition({ ...position, z: parseFloat(e.target.value) })}
                                                />

                                                <label className="text-black">Rotação X:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="1"
                                                    value={rotation.x}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setRotation({ ...rotation, x: parseFloat(e.target.value) })}
                                                />

                                                <label className="text-black">Rotação Y:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="1"
                                                    value={rotation.y}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setRotation({ ...rotation, y: parseFloat(e.target.value) })}
                                                />

                                                <label className="text-black">Rotação Z:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="1"
                                                    value={rotation.z}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setRotation({ ...rotation, z: parseFloat(e.target.value) })}
                                                />

                                                <label className="text-black">Escala:</label>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="5"
                                                    step="0.1"
                                                    value={scale.x}
                                                    className="w-full accent-black"
                                                    onChange={(e) =>
                                                        setScale({
                                                            x: parseFloat(e.target.value),
                                                            y: parseFloat(e.target.value),
                                                            z: parseFloat(e.target.value),
                                                        })
                                                    }
                                                />

                                                <h3 className="text-black font-semibold mt-4">Luzes</h3>

                                                <label className="text-black">Intensidade Ambient:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="5"
                                                    step="0.1"
                                                    value={ambientIntensity}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
                                                />

                                                <label className="text-black">Intensidade Direcional:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="5"
                                                    step="0.1"
                                                    value={directionalIntensity}
                                                    className="w-full accent-black"
                                                    onChange={(e) => setDirectionalIntensity(parseFloat(e.target.value))}
                                                />

                                                <label className="text-black">Posição Direcional X:</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    step="0.1"
                                                    value={directionalPosition.x}
                                                    className="w-full accent-black"
                                                    onChange={(e) =>
                                                        setDirectionalPosition({ ...directionalPosition, x: parseFloat(e.target.value) })
                                                    }
                                                />

                                                <label className="text-black">Posição Direcional Y:</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    step="0.1"
                                                    value={directionalPosition.y}
                                                    className="w-full accent-black"
                                                    onChange={(e) =>
                                                        setDirectionalPosition({ ...directionalPosition, y: parseFloat(e.target.value) })
                                                    }
                                                />

                                                <label className="text-black">Posição Direcional Z:</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    step="0.1"
                                                    value={directionalPosition.z}
                                                    className="w-full accent-black"
                                                    onChange={(e) =>
                                                        setDirectionalPosition({ ...directionalPosition, z: parseFloat(e.target.value) })
                                                    }
                                                />

                                                <h3 className="text-black font-semibold">Efeitos Visuais (VFX)</h3>

                                                <label className="text-black">Brilho (Brightness):</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="0.05"
                                                    value={brightness}
                                                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Contraste (Contrast):</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="0.05"
                                                    value={contrast}
                                                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Saturação (Saturation):</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="3"
                                                    step="0.05"
                                                    value={saturation}
                                                    onChange={(e) => setSaturation(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />

                                                <label className="text-black">Matiz (Hue):</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="1"
                                                    value={hue}
                                                    onChange={(e) => setHue(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>
            )}
            <MapContainer center={[40.659773, -7.910792]} zoom={15} zoomControl={false} className="h-full w-full sm:w-[calc(100%-64px)]" doubleClickZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" style={{ zIndex: 1 }} />

                {pontos.map((ponto) => (
                    <CustomMarker
                        key={ponto.id_ponto}
                        id={ponto.id_ponto}
                        latitude={ponto.latitude}
                        longitude={ponto.longitude}
                        name={ponto.name}
                        description={ponto.description}
                        image={ponto.image}
                        views={pontoVisualizacoes[ponto.id_ponto] || 0}
                        eventHandlers={{
                            contextmenu: (e) => handlePontoRightClick(e, ponto)
                        }}
                        onAddTrajeto={isAdmin ? () => handleTrajetoSelectionFromPonto(ponto) : undefined}
                    />
                ))}

                {showRoutes && rotas.map((trajeto, index) => {
                    const coords = trajeto.pontos.map(p => [p.latitude, p.longitude]);
                    return (
                        <RoutingMachine
                            key={`routing-${trajeto.id_trajeto}`}
                            rotaId={trajeto.id_trajeto}
                            estatisticaRotaId={trajeto?.Rota?.id_rota ?? trajeto?.rota?.id_rota ?? trajeto?.id_rota}
                            coordinates={coords}
                            active={index === rotaSelecionada}
                            onClick={() => setRotaSelecionada(index)}
                        />
                    );
                })}
                <MapControls />
                <MapFunctions openFormLateral={() => setFormLateralOpen(true)} openFormLateralAssets={() => setFormLateralAssetsOpen(true)} isAdmin={isAdmin} />
                <FormLateral isOpen={formLateralOpen} onClose={() => setFormLateralOpen(false)} coordinates={coordinates} />
                <FormLateralAssets isOpen={formLateralAssetsOpen} onClose={() => setFormLateralAssetsOpen(false)} existingOverlay={overlays.length > 0 ? overlays[0] : null} />
                <div className="absolute top-5 left-5 z-[1000] flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center w-[90vw] max-w-md">
                    <SearchBar />
                    <div className="flex items-center bg-white bg-opacity-90 px-2 py-[7px] rounded-lg shadow-lg dark:bg-black/90 w-auto">
                        <label
                            htmlFor="routes-switch"
                            className="text-xs text-gray-700 mr-2 dark:text-white whitespace-nowrap"
                        >
                            Mostrar trajetos
                        </label>
                        <Switch
                            id="routes-switch"
                            checked={showRoutes}
                            onCheckedChange={setShowRoutes}
                            disabled={showRoutes}
                            className="dark:bg-white"
                        />
                    </div>
                </div>

                <MapClickHandler />
                <MapClickReset onClick={() => setRotaSelecionada(null)} />
                <MapUserRealTimeLocation />
            </MapContainer>

            {contextMenu.visible && <ContextMenu />}
            {pontoMenu.visible && <PontoContextMenu />}

            {trajetoPontos.length > 0 && (
                <div className="absolute bottom-5 left-5 bg-white shadow-lg rounded-md p-4 z-[1000]">
                    <h2 className="font-semibold mb-2">Novo Trajeto:</h2>
                    <ul className="list-disc ml-5">
                        {trajetoPontos.map((p, i) => (
                            <li key={i}>{p.name}</li>
                        ))}
                    </ul>
                    {trajetoPontos.length >= 2 && (
                        <button
                            className="mt-4 px-4 py-2 bg-[#171717] text-white rounded-md text-sm"
                            onClick={handleGuardarTrajeto}
                        >
                            Guardar Trajeto
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

function SearchBar() {
    const [query, setQuery] = useState("");
    const map = useMap();

    const handleSearch = async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (!query) return;

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
                const data = await response.json();

                if (data.length > 0) {
                    const { lat, lon } = data[0];
                    map.setView([parseFloat(lat), parseFloat(lon)], 18);
                } else {
                    alert("Localização não encontrada!");
                }
            } catch (error) {
                console.error("Erro ao buscar localização:", error);
            }
        }
    };

    return (
        <div className="top-5 mt-[-2px] ml-[40px] left-5 w-80 flex items-center bg-white bg-opacity-90 rounded-lg shadow-lg sm:mt-0 sm:ml-0 dark:bg-black/90" style={{ zIndex: 1000 }}>
            <input
                type="text"
                placeholder="Procurar Localização..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearch}
                className="pl-3 py-2 w-full bg-transparent border-none outline-none"
            />
        </div>
    );
}

function FormLateral({ isOpen, onClose, coordinates }) {
    const username = getUserNameFromToken();
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [image, setImage] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (coordinates) {
            setLat(coordinates.lat?.toString() || "");
            setLng(coordinates.lng?.toString() || "");
        }
    }, [coordinates]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name || !description || !lat || !lng || !image) {
            setError("Preenche todos os campos e carrega uma imagem.");
            return;
        }

        const result = await Swal.fire({
            title: "Confirmar criação",
            text: "Tens a certeza que queres criar este ponto?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sim, criar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#171717",
            cancelButtonColor: "#6b7280",
        });

        if (!result.isConfirmed) return;

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("latitude", lat);
        formData.append("longitude", lng);
        formData.append("image", image);
        formData.append("username", username);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ponto/create`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Erro ao criar ponto.");
            } else {
                setError("");
                setName("");
                setDescription("");
                setImage(null);
                onClose();
                Swal.fire({
                    title: "Criado!",
                    text: "Ponto criado com sucesso.",
                    icon: "success",
                    confirmButtonColor: "#171717",
                });
            }
        } catch (err) {
            setError("Erro ao enviar o formulário.");
        }
    };

    return (
        <div
            className={`
    fixed top-1/2 -translate-y-1/2
    bg-white shadow-xl rounded-xl
    transition-all duration-300 ease-in-out transform
    ${isOpen ? "opacity-95 right-4 sm:right-[88px]" : "opacity-0 right-[-400px]"}
    w-[90vw] sm:w-[25%]
    h-[70%]
    cursor-pointer
    overflow-hidden sm:overflow-visible
  `}
            style={{ zIndex: 1000, pointerEvents: isOpen ? "auto" : "none" }}
            onMouseMove={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-700 hover:text-black"
            >
                ✕
            </button>

            <div className="p-8 overflow-y-auto max-h-full">
                <h2 className="text-lg font-semibold mb-4">Adicionar Ponto</h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Nome do local"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descrição</label>
                        <textarea
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Descrição do local"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        ></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Latitude</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-lg"
                            value={lat}
                            readOnly
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Longitude</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-lg"
                            value={lng}
                            readOnly
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Carregar Imagem</label>
                        <input
                            type="file"
                            className="w-full py-2 rounded-lg"
                            onChange={handleImageChange}
                            accept="image/*"
                        />
                        {image && (
                            <img
                                src={URL.createObjectURL(image)}
                                alt="Preview"
                                className="mt-2 w-32 h-32 object-cover"
                            />
                        )}
                    </div>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <button
                        type="submit"
                        className="w-full bg-black text-white py-2 rounded-lg hover:opacity-95"
                    >
                        Adicionar
                    </button>
                </form>
            </div>
        </div>
    );
}

function FormLateralAssets({ isOpen, onClose, existingOverlay }) {
    const username = getUserNameFromToken();
    const [tipo, setTipo] = useState(existingOverlay?.tipo || "");
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (existingOverlay) {
            setTipo(existingOverlay.tipo);
            setFile(null); // não preenchemos o arquivo, só atualizamos se o usuário carregar outro
        } else {
            setTipo("");
            setFile(null);
        }
    }, [existingOverlay]);

    const handleFileChange = (e) => {
        const uploadedFile = e.target.files[0];
        if (uploadedFile) setFile(uploadedFile);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tipo && !existingOverlay) {
            setError("Seleciona um tipo.");
            return;
        }

        if (!file && !existingOverlay) {
            setError("Carrega um ficheiro.");
            return;
        }

        const result = await Swal.fire({
            title: existingOverlay ? "Confirmar atualização" : "Confirmar criação",
            text: existingOverlay
                ? "Tens a certeza que queres atualizar este asset?"
                : "Tens a certeza que queres criar este asset?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: existingOverlay ? "Atualizar" : "Criar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#171717",
            cancelButtonColor: "#6b7280",
        });
        if (!result.isConfirmed) return;

        const formData = new FormData();
        formData.append("tipo", tipo);
        if (file) formData.append("file", file);
        formData.append("username", username);

        try {
            const url = existingOverlay
                ? `${process.env.NEXT_PUBLIC_API_URL}/overlay/update/${existingOverlay.id}`
                : `${process.env.NEXT_PUBLIC_API_URL}/overlay/create`;

            const method = existingOverlay ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Erro ao processar o asset.");
            } else {
                setError("");
                setTipo("");
                setFile(null);
                onClose();
                Swal.fire({
                    title: existingOverlay ? "Atualizado!" : "Criado!",
                    text: existingOverlay
                        ? "Asset atualizado com sucesso."
                        : "Asset criado com sucesso.",
                    icon: "success",
                    confirmButtonColor: "#171717",
                });
            }
        } catch (err) {
            setError("Erro ao enviar o formulário.");
        }
    };

    return (
        <div
            className={`fixed top-1/2 -translate-y-1/2 bg-white shadow-xl rounded-xl
        transition-all duration-300 ease-in-out transform
        ${isOpen ? "opacity-95 right-4 sm:right-[88px]" : "opacity-0 right-[-400px]"}
        w-[90vw] sm:w-[25%] h-[50%] cursor-pointer overflow-hidden sm:overflow-visible`}
            style={{ zIndex: 1000, pointerEvents: isOpen ? "auto" : "none" }}
            onMouseMove={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-700 hover:text-black"
            >
                ✕
            </button>

            <div className="p-8 overflow-y-auto max-h-full">
                <h2 className="text-lg font-semibold mb-4">
                    {existingOverlay ? "Atualizar Asset" : "Adicionar Asset"}
                </h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="">Seleciona o tipo</option>
                            <option value="imagem">Imagem</option>
                            <option value="video">Vídeo</option>
                            <option value="modelo3d">Modelo 3D</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Carregar Ficheiro</label>
                        <input
                            type="file"
                            className="w-full py-2 rounded-lg"
                            onChange={handleFileChange}
                            accept="image/*,video/*,.glb,.ply,.splat"
                        />
                        {file && <span className="mt-2 block text-sm text-gray-600">{file.name}</span>}
                        {existingOverlay && !file && (
                            <span className="mt-2 block text-sm text-gray-600">Arquivo atual será mantido.</span>
                        )}
                    </div>

                    {error && <div className="text-red-600 text-sm">{error}</div>}

                    <button
                        type="submit"
                        className="w-full bg-black text-white py-2 rounded-lg hover:opacity-95"
                    >
                        {existingOverlay ? "Atualizar" : "Adicionar"}
                    </button>
                </form>
            </div>
        </div>
    );
}

function MapControls() {
    const map = useMap();
    const [zoomLevel, setZoomLevel] = useState(map.getZoom());

    useEffect(() => {
        const handleZoom = () => setZoomLevel(map.getZoom());
        map.on("zoomend", handleZoom);
        return () => {
            map.off("zoomend", handleZoom);
        };
    }, [map]);

    const zoomIn = () => {
        const newZoom = zoomLevel + 1;
        if (newZoom !== zoomLevel) {
            map.setZoom(newZoom);
            setZoomLevel(newZoom);
        }
    };

    const zoomOut = () => {
        const newZoom = zoomLevel - 1;
        if (newZoom !== zoomLevel) {
            map.setZoom(newZoom);
            setZoomLevel(newZoom);
        }
    };

    return (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 transform flex-col gap-2 bg-white bg-opacity-90 p-2 rounded-lg shadow-lg dark:bg-black/90 hidden sm:flex"
            style={{ zIndex: 1000, cursor: "pointer" }}>
            <TooltipWrapper content="Zoom In" sideOffset={12}>
                <button onClick={zoomIn} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path>
                    </svg>
                </button>
            </TooltipWrapper>
            <TooltipWrapper content="Zoom Out" sideOffset={12}>
                <button onClick={zoomOut} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"></path>
                    </svg>
                </button>
            </TooltipWrapper>
        </div>
    );
}

function MapFunctions({ openFormLateral, openFormLateralAssets, isAdmin }) {
    if (!isAdmin) return null;
    return (
        <div className="absolute right-5 bottom-2 -translate-y-1/2 transform flex flex-col gap-2 bg-white bg-opacity-90 p-2 rounded-lg shadow-lg dark:bg-black/90" style={{ zIndex: 1000, cursor: "pointer" }}>
            <TooltipWrapper content="Adicionar Assets" sideOffset={12}>
                <button onClick={openFormLateralAssets} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <Image className="w-4 h-4" />
                </button>
            </TooltipWrapper>
            <TooltipWrapper content="Adicionar Ponto" sideOffset={12}>
                <button onClick={openFormLateral} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin-plus"><path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738" /><circle cx="12" cy="10" r="3" /><path d="M16 18h6" /><path d="M19 15v6" /></svg>
                </button>
            </TooltipWrapper>
        </div>
    );
}
