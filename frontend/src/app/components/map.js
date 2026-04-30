"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { MapContainer, TileLayer, Polyline, useMap, useMapEvent } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getUserNameFromToken, getUserRoleFromToken } from "../components/jwtDecode";
import CustomMarker from "../components/CustomMarker";
import MultiCategoryPicker from "../components/MultiCategoryPicker";
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import MapClickReset from "../components/MapClickReset";
import RoutingMachine from "../components/RoutingMachine";
import MapUserRealTimeLocation from "../components/MapUserRealTimeLocation";
import { Switch } from "@/components/ui/switch";
import TooltipWrapper from "../components/TooltipWrapper";
import MediaSourceField from "../components/MediaSourceField";
import Swal from "sweetalert2";
import { Layers, Loader2, LocateFixed, Pencil } from "lucide-react";
import { createLibrarySelection, resolveMediaSelection } from "../lib/media-library";

const MAP_VIEWS = {
    osm_hot: {
        label: "Ruas (OSM HOT)",
        url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>',
        maxZoom: 20,
    },
    satelite: {
        label: "Satélite (Esri)",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
    },
    carto_voyager: {
        label: "Carto Voyager",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
    },
};

const ROUTE_GEOMETRY_CACHE_KEY = "route-geometry-cache-v1";
const SHOW_ROUTES_CACHE_KEY = "show-routes-enabled-v1";

const API_BASE =
    (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL.trim())
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
        : "";

const buildApiUrl = (path) => {
    if (!API_BASE) return path;
    return `${API_BASE}${path}`;
};

const logNetworkError = (scope, url, error) => {
    console.error(`${scope}: falha de rede ao contactar ${url}. Verifica NEXT_PUBLIC_API_URL, backend ativo e CORS.`, error);
};

const getInitialShowRoutesValue = () => {
    if (typeof window === "undefined") return false;

    try {
        return localStorage.getItem(SHOW_ROUTES_CACHE_KEY) === "true";
    } catch {
        return false;
    }
};

export default function MapComponent() {
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, latlng: null });
    const [formLateralOpen, setFormLateralOpen] = useState(false);
    const [coordinates, setCoordinates] = useState(null);
    const [editingPonto, setEditingPonto] = useState(null);
    const [pontos, setPontos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [selectedCategoriaFilter, setSelectedCategoriaFilter] = useState("all");
    const [rotas, setRotas] = useState([]);
    const [trajetoPontos, setTrajetoPontos] = useState([]);
    const [pontoMenu, setPontoMenu] = useState({ visible: false, x: 0, y: 0, ponto: null });
    const [rotaSelecionada, setRotaSelecionada] = useState(null);
    const [showRoutes, setShowRoutes] = useState(getInitialShowRoutesValue);
    const [mapView, setMapView] = useState("carto_voyager");
    const [mapViewMenuOpen, setMapViewMenuOpen] = useState(false);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [routesInitialized, setRoutesInitialized] = useState(getInitialShowRoutesValue);
    const [readyRouteKeys, setReadyRouteKeys] = useState(() => new Set());
    const [routeGeometryCache, setRouteGeometryCache] = useState({});
    const userRole = getUserRoleFromToken();
    const pendingRouteKeysRef = useRef(new Set());
    const readyRouteKeysRef = useRef(new Set());
    const mapViewMenuRef = useRef(null);
    const isAdmin = userRole === "Admin";
    const selectedMapView = MAP_VIEWS[mapView] || MAP_VIEWS.carto_voyager;

    const getCoordinatesSignature = useCallback((coords = []) => (
        coords
            .map(([lat, lng]) => `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`)
            .join("|")
    ), []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(ROUTE_GEOMETRY_CACHE_KEY);
            if (!raw) return;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return;

            setRouteGeometryCache(parsed);
        } catch (error) {
            console.error("Erro ao carregar cache de trajetos:", error);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(SHOW_ROUTES_CACHE_KEY, String(showRoutes));
        } catch (error) {
            console.error("Erro ao guardar preferência de mostrar trajetos:", error);
        }

        if (showRoutes) {
            setRoutesInitialized(true);
        }
    }, [showRoutes]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!mapViewMenuRef.current?.contains(event.target)) {
                setMapViewMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
        if (!showRoutes) {
            setRoutesLoading(false);
            pendingRouteKeysRef.current.clear();
        }
    }, [showRoutes]);

    const getRouteKey = useCallback((trajeto, index) => {
        const value = trajeto?.id_trajeto ?? trajeto?.Rota?.id_rota ?? trajeto?.rota?.id_rota ?? index;
        return String(value);
    }, []);

    const handleRouteReady = useCallback((routeKey) => {
        if (!showRoutes) return;

        const key = String(routeKey);
        readyRouteKeysRef.current.add(key);
        setReadyRouteKeys((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });
        if (!pendingRouteKeysRef.current.has(key)) return;

        pendingRouteKeysRef.current.delete(key);
        if (pendingRouteKeysRef.current.size === 0) {
            setRoutesLoading(false);
        }
    }, [showRoutes]);

    const handleRouteRecomputeStart = useCallback((routeKey) => {
        if (!showRoutes) return;

        const key = String(routeKey);
        readyRouteKeysRef.current.delete(key);
        setReadyRouteKeys((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
        pendingRouteKeysRef.current.add(key);
        setRoutesLoading(true);
    }, [showRoutes]);

    const handleRouteGeometryComputed = useCallback((routeKey, signature, geometry) => {
        if (!routeKey || !signature || !Array.isArray(geometry) || geometry.length < 2) return;

        setRouteGeometryCache((prev) => {
            const existing = prev[routeKey];
            if (existing?.signature === signature) return prev;

            const next = {
                ...prev,
                [routeKey]: {
                    signature,
                    geometry,
                    updatedAt: Date.now(),
                },
            };

            try {
                localStorage.setItem(ROUTE_GEOMETRY_CACHE_KEY, JSON.stringify(next));
            } catch (error) {
                console.error("Erro ao guardar cache de trajetos:", error);
            }

            return next;
        });
    }, []);

    const loadPontos = useCallback(async () => {
        const url = buildApiUrl("/ponto/list");
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Erro ao buscar pontos");
            const data = await response.json();
            setPontos(data.pontos);
        } catch (error) {
            logNetworkError("Erro ao carregar pontos", url, error);
        }
    }, []);

    const loadCategorias = useCallback(async () => {
        const url = buildApiUrl("/categoria/list");
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Erro ao buscar categorias");
            const data = await response.json();
            setCategorias(data.categorias || []);
        } catch (error) {
            logNetworkError("Erro ao carregar categorias", url, error);
        }
    }, []);

    const loadRotas = useCallback(async () => {
        const url = buildApiUrl("/trajeto/list");
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
                setRotas(data.trajetos);
            } else {
                console.error(data.error || "Erro ao buscar trajetos");
            }
        } catch (err) {
            logNetworkError("Erro ao buscar trajetos", url, err);
        }
    }, []);

    useEffect(() => {
        loadPontos();
        loadRotas();
        loadCategorias();
    }, [loadPontos, loadRotas, loadCategorias]);

    const pontosFiltrados = useMemo(() => pontos.filter((ponto) => {
        if (selectedCategoriaFilter === "all") return true;
        const categoriasPonto =
            ponto?.categorias ||
            ponto?.CategoriaPonto ||
            ponto?.categorias_ponto ||
            (ponto?.categoria ? [ponto.categoria] : []);

        const listaCategorias = Array.isArray(categoriasPonto) ? categoriasPonto : [categoriasPonto];
        return listaCategorias.some((categoria) => String(categoria?.id_categoria) === String(selectedCategoriaFilter));
    }), [pontos, selectedCategoriaFilter]);

    const pontosVisiveisPorId = useMemo(() => new Set(
        pontosFiltrados
            .map((ponto) => ponto?.id_ponto)
            .filter((id) => id !== undefined && id !== null)
            .map((id) => String(id))
    ), [pontosFiltrados]);

    const pontosVisiveisPorCoordenadas = useMemo(() => new Set(
        pontosFiltrados
            .filter((ponto) => Number.isFinite(Number(ponto?.latitude)) && Number.isFinite(Number(ponto?.longitude)))
            .map((ponto) => `${Number(ponto.latitude).toFixed(6)}:${Number(ponto.longitude).toFixed(6)}`)
    ), [pontosFiltrados]);

    const rotasVisiveis = useMemo(() => rotas.filter((trajeto) => {
        const pontosTrajeto = Array.isArray(trajeto?.pontos) ? trajeto.pontos : [];

        const pontosVisiveisNoTrajeto = pontosTrajeto.filter((ponto) => {
            const idPonto = ponto?.id_ponto;
            if (idPonto !== undefined && idPonto !== null) {
                return pontosVisiveisPorId.has(String(idPonto));
            }

            if (!Number.isFinite(Number(ponto?.latitude)) || !Number.isFinite(Number(ponto?.longitude))) {
                return false;
            }

            const chaveCoordenadas = `${Number(ponto.latitude).toFixed(6)}:${Number(ponto.longitude).toFixed(6)}`;
            return pontosVisiveisPorCoordenadas.has(chaveCoordenadas);
        });

        return pontosVisiveisNoTrajeto.length >= 2;
    }), [rotas, pontosVisiveisPorId, pontosVisiveisPorCoordenadas]);

    useEffect(() => {
        if (!showRoutes) return;

        const routeKeys = rotasVisiveis
            .map((trajeto, index) => getRouteKey(trajeto, index))
            .filter(Boolean);

        if (routeKeys.length === 0) {
            setRoutesLoading(false);
            pendingRouteKeysRef.current.clear();
            return;
        }

        const pendingKeys = routeKeys.filter((key) => !readyRouteKeysRef.current.has(key));
        pendingRouteKeysRef.current = new Set(pendingKeys);
        setRoutesLoading(pendingKeys.length > 0);
    }, [showRoutes, rotasVisiveis, getRouteKey]);

    const handleShowRoutesChange = useCallback((checked) => {
        setShowRoutes(checked);

        if (!checked) {
            setRoutesLoading(false);
            pendingRouteKeysRef.current.clear();
            setRotaSelecionada(null);
            return;
        }

        setRoutesInitialized(true);

        const hasRoutes = rotasVisiveis.length > 0;
        setRoutesLoading(hasRoutes);
    }, [rotasVisiveis.length]);

    const handlePontoRightClick = useCallback((e, ponto) => {
        if (!isAdmin) return;
        e.originalEvent.preventDefault();
        setPontoMenu({ visible: true, x: e.containerPoint.x + 5, y: e.containerPoint.y + 5, ponto });
        setContextMenu({ visible: false, x: 0, y: 0, latlng: null });
    }, [isAdmin]);

    const addPontoToTrajeto = useCallback((ponto) => {
        if (!ponto) return;

        setTrajetoPontos((prev) => {
            const alreadySelected = prev.some((selected) => selected.id_ponto === ponto.id_ponto);
            if (alreadySelected) return prev;
            return [...prev, ponto];
        });
    }, []);

    const handleTrajetoSelection = useCallback(() => {
        const ponto = pontoMenu.ponto;
        if (!ponto) return;

        addPontoToTrajeto(ponto);
        setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
    }, [addPontoToTrajeto, pontoMenu.ponto]);

    const handleTrajetoSelectionFromPonto = useCallback((ponto) => {
        if (!isAdmin || !ponto) return;

        addPontoToTrajeto(ponto);
        setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
    }, [addPontoToTrajeto, isAdmin]);

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

        const url = buildApiUrl("/trajeto/create");
        try {
            const response = await fetch(url, {
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
                    title: data.reused ? "Já existia" : "Criado!",
                    text: data.reused
                        ? "Este trajeto já estava guardado e foi reutilizado."
                        : "Trajeto guardado com sucesso.",
                    icon: "success",
                    confirmButtonColor: "#171717",
                });
                setTrajetoPontos([]);
                loadRotas();
            }
        } catch (error) {
            logNetworkError("Erro ao guardar trajeto", url, error);
            Swal.fire({
                title: "Erro",
                text: "Erro ao comunicar com o servidor.",
                icon: "error",
                confirmButtonColor: "#171717",
            });
        }
    }, [trajetoPontos, loadRotas]);

    const handleCreatePoint = useCallback(() => {
        if (contextMenu.latlng) {
            setEditingPonto(null);
            setCoordinates(contextMenu.latlng);
            setFormLateralOpen(true);
        }
        setContextMenu({ visible: false, x: 0, y: 0, latlng: null });
    }, [contextMenu.latlng]);

    const handleEditPoint = useCallback(() => {
        if (!pontoMenu.ponto) return;

        setEditingPonto(pontoMenu.ponto);
        setCoordinates({
            lat: pontoMenu.ponto.latitude,
            lng: pontoMenu.ponto.longitude,
        });
        setFormLateralOpen(true);
        setPontoMenu({ visible: false, x: 0, y: 0, ponto: null });
    }, [pontoMenu.ponto]);

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
                onClick={handleCreatePoint}
                className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer rounded"
            >
                Criar ponto
            </div>
        </div>
    );

    const PontoContextMenu = () => pontoMenu.visible && (
        <div
            className="absolute bg-white border border-gray-200 shadow-md rounded-md p-1"
            style={{ top: pontoMenu.y, left: pontoMenu.x, zIndex: 1000 }}
        >
            <div
                onClick={handleEditPoint}
                className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer rounded"
            >
                Editar ponto
            </div>
            <div
                onClick={handleTrajetoSelection}
                className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer rounded"
            >
                Adicionar ao Trajeto
            </div>
        </div>
    );

    return (
        <div className="fixed top-0 h-screen w-screen">
            <MapContainer center={[40.659773, -7.910792]} zoom={15} zoomControl={false} className="h-full w-full" doubleClickZoom={false}>
                <TileLayer
                    key={mapView}
                    url={selectedMapView.url}
                    attribution={selectedMapView.attribution}
                    maxZoom={selectedMapView.maxZoom}
                    style={{ zIndex: 1 }}
                />

                {pontosFiltrados.map((ponto) => (
                    <CustomMarker
                        key={ponto.id_ponto}
                        id={ponto.id_ponto}
                        latitude={ponto.latitude}
                        longitude={ponto.longitude}
                        name={ponto.name}
                        description={ponto.description}
                        categoryName={
                            (Array.isArray(ponto?.categorias) && ponto.categorias.length
                                ? ponto.categorias.map((categoria) => categoria.name).join(", ")
                                : ponto?.CategoriaPonto?.name ||
                                ponto?.categorias_ponto?.name ||
                                ponto?.categoria?.name) ||
                            "Sem categoria"
                        }
                        image={ponto.image}
                        imageUrl={ponto.imageUrl}
                        views={ponto.visualizacoes || 0}
                        eventHandlers={{
                            contextmenu: (e) => handlePontoRightClick(e, ponto)
                        }}
                        onAddTrajeto={isAdmin ? () => handleTrajetoSelectionFromPonto(ponto) : undefined}
                    />
                ))}

                {(showRoutes || routesInitialized) && rotasVisiveis.map((trajeto, index) => {
                    const coords = trajeto.pontos.map(p => [p.latitude, p.longitude]);
                    const routeKey = getRouteKey(trajeto, index);
                    const coordsSignature = getCoordinatesSignature(coords);
                    const cachedEntry = routeGeometryCache?.[routeKey];
                    const cachedGeometry =
                        cachedEntry?.signature === coordsSignature && Array.isArray(cachedEntry.geometry)
                            ? cachedEntry.geometry
                            : null;

                    return (
                        <Fragment key={`route-wrapper-${routeKey}`}>
                            {showRoutes && cachedGeometry && !readyRouteKeys.has(String(routeKey)) && (
                                <Polyline
                                    key={`cached-routing-${routeKey}`}
                                    positions={cachedGeometry}
                                    pathOptions={{ color: "hsl(var(--primary))", weight: 5, opacity: 0.9 }}
                                />
                            )}

                            <RoutingMachine
                                key={`routing-${routeKey}`}
                                rotaId={trajeto.id_trajeto}
                                estatisticaRotaId={trajeto?.Rota?.id_rota ?? trajeto?.rota?.id_rota ?? trajeto?.id_rota}
                                coordinates={coords}
                                active={index === rotaSelecionada}
                                visible={showRoutes}
                                onClick={() => setRotaSelecionada(index)}
                                onRouteReady={() => handleRouteReady(routeKey)}
                                onRouteGeometry={(geometry) => handleRouteGeometryComputed(String(routeKey), coordsSignature, geometry)}
                                onRouteRecomputeStart={() => handleRouteRecomputeStart(routeKey)}
                            />
                        </Fragment>
                    );
                })}
                {trajetoPontos.length >= 2 && (
                    <RoutingMachine
                        key={`draft-routing-${trajetoPontos.map((p) => p.id_ponto).join("-")}`}
                        coordinates={trajetoPontos.map((p) => [p.latitude, p.longitude])}
                        active={false}
                        showDetails={false}
                    />
                )}
                <MapControls />
                <MapFunctions openFormLateral={() => setFormLateralOpen(true)} isAdmin={isAdmin} />
                <FormLateral
                    isOpen={formLateralOpen}
                    onClose={() => {
                        setFormLateralOpen(false);
                        setEditingPonto(null);
                    }}
                    coordinates={coordinates}
                    categorias={categorias}
                    existingPonto={editingPonto}
                    onSaved={loadPontos}
                />
                <div className="absolute top-5 left-5 z-[1000] flex flex-wrap gap-2 sm:gap-3 items-center max-w-[calc(100vw-40px)]">
                    <SearchBar />
                    <div ref={mapViewMenuRef} className="relative flex items-center shrink-0">
                        <button
                            type="button"
                            aria-label="Selecionar vista do mapa"
                            title={`Vista atual: ${selectedMapView.label}`}
                            onClick={() => setMapViewMenuOpen((prev) => !prev)}
                            className="flex items-center justify-center bg-white bg-opacity-90 p-2 rounded-lg shadow-lg dark:bg-black/90"
                        >
                            <Layers className="h-4 w-4 text-foreground" />
                        </button>

                        {mapViewMenuOpen && (
                            <div className="absolute top-[calc(100%+6px)] left-0 min-w-44 max-h-64 overflow-auto rounded-lg border border-border bg-background shadow-lg">
                                <ul className="py-1">
                                    {Object.entries(MAP_VIEWS).map(([value, config]) => (
                                        <li key={value}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMapView(value);
                                                    setMapViewMenuOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-xs hover:bg-muted ${mapView === value ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                                            >
                                                {config.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap items-center bg-white bg-opacity-90 px-2 py-[7px] gap-2 rounded-lg shadow-lg dark:bg-black/90 w-full sm:w-auto">
                        <select
                            value={selectedCategoriaFilter}
                            onChange={(e) => setSelectedCategoriaFilter(e.target.value)}
                            className="w-full sm:w-56 text-xs bg-transparent border border-border rounded px-2 py-1 text-gray-700 dark:text-white"
                            aria-label="Filtrar pontos por categoria"
                        >
                            <option value="all">Todas as categorias</option>
                            {categorias.map((categoria) => (
                                <option key={categoria.id_categoria} value={String(categoria.id_categoria)}>
                                    {categoria.name}
                                </option>
                            ))}
                        </select>

                        <label
                            htmlFor="routes-switch"
                            className="text-xs text-gray-700 mr-2 dark:text-white whitespace-nowrap"
                        >
                            Mostrar trajetos
                        </label>
                        <Switch
                            id="routes-switch"
                            checked={showRoutes}
                            onCheckedChange={handleShowRoutesChange}
                            className="dark:bg-white"
                        />
                        {routesLoading && (
                            <span className="ml-2 inline-flex items-center text-muted-foreground" aria-label="A carregar trajetos">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            </span>
                        )}
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
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const map = useMap();
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    const fetchLocations = useCallback(async (term) => {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(term)}`);
        const data = await response.json();

        return (Array.isArray(data) ? data : [])
            .map((item) => ({
                id: item.place_id,
                label: item.display_name,
                lat: Number.parseFloat(item.lat),
                lon: Number.parseFloat(item.lon),
            }))
            .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
    }, []);

    const selectLocation = useCallback((location) => {
        map.setView([location.lat, location.lon], 18);
        setQuery(location.label);
        setShowDropdown(false);
    }, [map]);

    useEffect(() => {
        const trimmed = query.trim();

        if (trimmed.length < 3) {
            setResults([]);
            setHasSearched(false);
            setShowDropdown(false);
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            return;
        }

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            try {
                setIsSearching(true);
                const items = await fetchLocations(trimmed);
                setResults(items);
                setShowDropdown(true);
                setHasSearched(true);
            } catch (error) {
                console.error("Erro ao buscar localização:", error);
                setResults([]);
                setShowDropdown(true);
                setHasSearched(true);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, fetchLocations]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!wrapperRef.current?.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const handleKeyDown = async (e) => {
        if (e.key === "Escape") {
            setShowDropdown(false);
            return;
        }

        if (e.key !== "Enter") return;

        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;

        if (results.length > 0) {
            selectLocation(results[0]);
            return;
        }

        try {
            setIsSearching(true);
            const items = await fetchLocations(trimmed);
            setResults(items);
            setShowDropdown(true);
            setHasSearched(true);

            if (items.length > 0) {
                selectLocation(items[0]);
            }
        } catch (error) {
            console.error("Erro ao buscar localização:", error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div
            ref={wrapperRef}
            className="w-full sm:w-[24rem] xl:w-[28rem] flex items-center bg-white bg-opacity-90 rounded-lg shadow-lg dark:bg-black/90 shrink-0"
            style={{ zIndex: 1000 }}
        >
            <div className="relative w-full">
                <input
                    type="text"
                    placeholder="Procurar Localização..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.trim().length >= 3) setShowDropdown(true);
                    }}
                    onKeyDown={handleKeyDown}
                    className="pl-3 py-2 w-full bg-transparent border-none outline-none"
                />

                {showDropdown && (
                    <div className="absolute top-[calc(100%+6px)] left-0 right-0 max-h-64 overflow-auto rounded-lg border border-border bg-background shadow-lg">
                        {isSearching ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">A pesquisar...</div>
                        ) : results.length > 0 ? (
                            <ul className="py-1">
                                {results.map((location) => (
                                    <li key={location.id}>
                                        <button
                                            type="button"
                                            onClick={() => selectLocation(location)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                            title={location.label}
                                        >
                                            {location.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : hasSearched ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Sem resultados.</div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

function FormLateral({ isOpen, onClose, coordinates, categorias = [], existingPonto = null, onSaved }) {
    useMapInteractionLock(isOpen);

    const username = getUserNameFromToken();
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [idCategorias, setIdCategorias] = useState([]);
    const [imageSelection, setImageSelection] = useState(null);
    const [error, setError] = useState("");
    const [categoriasLocais, setCategoriasLocais] = useState(categorias);

    useEffect(() => {
        setCategoriasLocais(categorias);
    }, [categorias]);

    useEffect(() => {
        if (coordinates) {
            setLat(coordinates.lat?.toString() || "");
            setLng(coordinates.lng?.toString() || "");
        }
    }, [coordinates]);

    useEffect(() => {
        if (!existingPonto) {
            setName("");
            setDescription("");
            setIdCategorias([]);
            setImageSelection(null);
            setError("");
            return;
        }

        const categoriasDoPonto =
            existingPonto?.categorias ||
            (existingPonto?.CategoriaPonto ? [existingPonto.CategoriaPonto] : []) ||
            (existingPonto?.categoria ? [existingPonto.categoria] : []);

        setName(existingPonto.name || "");
        setDescription(existingPonto.description || "");
        setLat(existingPonto.latitude?.toString() || "");
        setLng(existingPonto.longitude?.toString() || "");
        setIdCategorias((categoriasDoPonto || []).map((categoria) => String(categoria.id_categoria)));
        setImageSelection(createLibrarySelection(existingPonto.imagePath));
        setError("");
    }, [existingPonto]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name || !description || !lat || !lng || idCategorias.length === 0 || !imageSelection) {
            setError("Preenche todos os campos e carrega uma imagem.");
            return;
        }

        const result = await Swal.fire({
            title: existingPonto ? "Confirmar atualização" : "Confirmar criação",
            text: existingPonto ? "Tens a certeza que queres atualizar este ponto?" : "Tens a certeza que queres criar este ponto?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: existingPonto ? "Sim, atualizar" : "Sim, criar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#171717",
            cancelButtonColor: "#6b7280",
        });

        if (!result.isConfirmed) return;

        const resolvedImage = await resolveMediaSelection(imageSelection, "pontos");
        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("latitude", lat);
        formData.append("longitude", lng);
        formData.append("id_categorias", JSON.stringify(idCategorias));
        formData.append("imagePath", resolvedImage?.path || "");
        formData.append("username", username);

        const url = existingPonto
            ? buildApiUrl(`/ponto/update/${existingPonto.id_ponto}`)
            : buildApiUrl("/ponto/create");

        try {
            const response = await fetch(url, {
                method: existingPonto ? "PATCH" : "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || (existingPonto ? "Erro ao atualizar ponto." : "Erro ao criar ponto."));
            } else {
                setError("");
                setName("");
                setDescription("");
                setIdCategorias([]);
                setImageSelection(null);
                onSaved?.();
                onClose();
                Swal.fire({
                    title: existingPonto ? "Atualizado!" : "Criado!",
                    text: existingPonto ? "Ponto atualizado com sucesso." : "Ponto criado com sucesso.",
                    icon: "success",
                    confirmButtonColor: "#171717",
                });
            }
        } catch (err) {
            logNetworkError(existingPonto ? "Erro ao atualizar ponto" : "Erro ao criar ponto", url, err);
            setError("Erro ao enviar o formulário.");
        }
    };

    const handleCreateCategoria = async (categoriaName) => {
        const url = buildApiUrl("/categoria/create");
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
            },
            body: JSON.stringify({ name: categoriaName }),
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || payload.message || "Não foi possível criar a categoria.");
        }

        if (payload.categoria) {
            setCategoriasLocais((prev) => {
                const exists = prev.some((categoria) => String(categoria.id_categoria) === String(payload.categoria.id_categoria));
                if (exists) return prev;
                return [...prev, payload.categoria].sort((left, right) => left.name.localeCompare(right.name));
            });
        }

        return payload.categoria;
    };

    return (
        <div
            className={`
    fixed top-1/2 -translate-y-1/2
    bg-white shadow-xl rounded-xl
    transition-all duration-300 ease-in-out transform
    ${isOpen ? "opacity-95 right-4 sm:right-24 lg:right-28" : "opacity-0 right-[-400px]"}
    w-[90vw] sm:w-[32rem] lg:w-[36rem] sm:max-w-[calc(100vw-8rem)]
    h-[70%]
    cursor-pointer
    overflow-hidden sm:overflow-visible
  `}
            style={{
                zIndex: 1000,
                pointerEvents: isOpen ? "auto" : "none",
                touchAction: "pan-y",
                overscrollBehavior: "contain",
            }}
            onMouseMove={(e) => {
                stopMapEventPropagation(e);
            }}
            onWheel={stopMapEventPropagation}
            onTouchStart={stopMapEventPropagation}
            onTouchMove={stopMapEventPropagation}
            onPointerDown={stopMapEventPropagation}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-700 hover:text-black"
            >
                ✕
            </button>

            <div
                className="p-8 overflow-y-auto max-h-full"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}
                onWheel={stopMapEventPropagation}
                onTouchStart={stopMapEventPropagation}
                onTouchMove={stopMapEventPropagation}
            >
                <h2 className="text-lg font-semibold mb-4">{existingPonto ? "Editar Ponto" : "Adicionar Ponto"}</h2>
                <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Nome</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Nome do local"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="sm:col-span-2">
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
                        <label className="block text-sm font-medium text-gray-700">Categorias</label>
                        <MultiCategoryPicker
                            categorias={categoriasLocais}
                            selectedIds={idCategorias}
                            onChange={setIdCategorias}
                            allowCreate
                            onCreateCategory={handleCreateCategoria}
                        />
                    </div>
                    <div>
                        <MediaSourceField
                            label="Carregar Imagem"
                            accept="image/*"
                            selection={imageSelection}
                            onChange={setImageSelection}
                            destinationPath="pontos"
                            required
                        />
                    </div>

                    {error && <div className="text-red-600 text-sm sm:col-span-2">{error}</div>}
                    <button
                        type="submit"
                        className="w-full bg-black text-white py-2 rounded-lg hover:opacity-95 sm:col-span-2"
                    >
                        {existingPonto ? "Guardar alterações" : "Adicionar"}
                    </button>
                </form>
            </div>
        </div>
    );
}

function stopMapEventPropagation(event) {
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
}

function useMapInteractionLock(active) {
    const map = useMap();
    const interactionStateRef = useRef(null);

    useEffect(() => {
        if (!map) return;

        const interactions = [
            ["dragging", map.dragging],
            ["touchZoom", map.touchZoom],
            ["scrollWheelZoom", map.scrollWheelZoom],
            ["doubleClickZoom", map.doubleClickZoom],
            ["boxZoom", map.boxZoom],
            ["keyboard", map.keyboard],
            ["tap", map.tap],
        ];

        const restoreInteractions = () => {
            if (!interactionStateRef.current) return;

            interactions.forEach(([name, handler]) => {
                const wasEnabled = interactionStateRef.current[name];
                if (wasEnabled) {
                    handler?.enable?.();
                }
            });

            interactionStateRef.current = null;
        };

        if (active) {
            if (!interactionStateRef.current) {
                interactionStateRef.current = Object.fromEntries(
                    interactions.map(([name, handler]) => [name, handler?.enabled?.() ?? false])
                );
            }

            interactions.forEach(([, handler]) => {
                handler?.disable?.();
            });
        } else {
            restoreInteractions();
        }

        return restoreInteractions;
    }, [active, map]);
}

function MapControls() {
    const map = useMap();
    const [zoomLevel, setZoomLevel] = useState(map.getZoom());
    const requestBrowserLocation = useCallback((options) => new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    }), []);

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

    const goToMyLocation = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (typeof window === "undefined" || !navigator.geolocation) {
            Swal.fire({
                title: "Geolocalização indisponível",
                text: "Este browser não suporta geolocalização.",
                icon: "warning",
                confirmButtonColor: "#171717",
            });
            return;
        }

        const isLocalHost =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1";

        if (!window.isSecureContext && !isLocalHost) {
            Swal.fire({
                title: "Localização bloqueada",
                text: "A geolocalização requer HTTPS ou localhost.",
                icon: "warning",
                confirmButtonColor: "#171717",
            });
            return;
        }

        const centerMap = (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
        };

        const handleLocationError = (errorEvent) => {
            let message = "Não foi possível obter a tua localização.";

            if (errorEvent?.code === 1) {
                message = "Permissão de localização negada. Ativa a localização no browser/dispositivo.";
            } else if (errorEvent?.code === 2) {
                message = "Localização indisponível neste momento. Tenta novamente em instantes.";
            } else if (errorEvent?.code === 3) {
                message = "Tempo limite excedido ao obter a localização. Garante GPS ativo e boa rede/sinal.";
            }

            Swal.fire({
                title: "Localização",
                text: message,
                icon: "warning",
                confirmButtonColor: "#171717",
            });
        };

        const attempts = [
            {
                enableHighAccuracy: false,
                timeout: 30000,
                maximumAge: 300000,
            },
            {
                enableHighAccuracy: true,
                timeout: 45000,
                maximumAge: 0,
            },
            {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: Infinity,
            },
        ];

        let lastError = null;

        for (const options of attempts) {
            try {
                const position = await requestBrowserLocation(options);
                centerMap(position);
                return;
            } catch (errorEvent) {
                lastError = errorEvent;

                if (errorEvent?.code !== 3) {
                    break;
                }
            }
        }

        handleLocationError(lastError);
    };

    return (
        <div
            className="fixed right-4 top-1/2 z-[1100] flex -translate-y-1/2 transform flex-col gap-2 rounded-lg bg-white/90 p-2 shadow-lg dark:bg-black/90 sm:right-5"
            style={{ cursor: "pointer", display: "flex", pointerEvents: "auto" }}
        >
            <TooltipWrapper content="Ir para a minha localização" sideOffset={12}>
                <button type="button" onClick={goToMyLocation} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <LocateFixed className="w-4 h-4" />
                </button>
            </TooltipWrapper>
            <TooltipWrapper content="Zoom In" sideOffset={12}>
                <button type="button" onClick={zoomIn} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path>
                    </svg>
                </button>
            </TooltipWrapper>
            <TooltipWrapper content="Zoom Out" sideOffset={12}>
                <button type="button" onClick={zoomOut} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"></path>
                    </svg>
                </button>
            </TooltipWrapper>
        </div>
    );
}

function MapFunctions({ openFormLateral, isAdmin }) {
    if (!isAdmin) return null;
    return (
        <div
            className="fixed bottom-5 right-4 z-[1100] flex flex-col gap-2 rounded-lg bg-white/90 p-2 shadow-lg dark:bg-black/90 sm:right-5"
            style={{ cursor: "pointer", display: "flex", pointerEvents: "auto" }}
        >
            <TooltipWrapper content="Adicionar Ponto" sideOffset={12}>
                <button type="button" onClick={openFormLateral} className="p-2 bg-black bg-opacity-10 hover:bg-opacity-10 rounded-md dark:bg-black">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin-plus"><path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738" /><circle cx="12" cy="10" r="3" /><path d="M16 18h6" /><path d="M19 15v6" /></svg>
                </button>
            </TooltipWrapper>
        </div>
    );
}
