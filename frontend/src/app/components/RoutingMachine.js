"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import Swal from "sweetalert2";
import { getUserRoleFromToken } from "./jwtDecode";

const RoutingMachine = ({ coordinates, active = false, visible = true, onClick, rotaId, estatisticaRotaId, showDetails = true, onRouteReady, onRouteGeometry, onRouteRecomputeStart }) => {
  const map = useMap();
  const controlRef = useRef(null);
  const clickLayersRef = useRef([]);
  const directionMarkersRef = useRef([]);
  const onClickRef = useRef(onClick);
  const onRouteReadyRef = useRef(onRouteReady);
  const onRouteGeometryRef = useRef(onRouteGeometry);
  const onRouteRecomputeStartRef = useRef(onRouteRecomputeStart);
  const routeActionsInsertedRef = useRef(false);
  const videoAvailabilityRef = useRef(undefined);
  const videoAvailabilityPromiseRef = useRef(null);
  const hasRouteDetailsRef = useRef(false);
  const routeReadyNotifiedRef = useRef(false);
  const visibleRef = useRef(visible);
  const routeCoordinatesRef = useRef([]);
  const isAdmin = useMemo(() => getUserRoleFromToken() === "Admin", []);

  // Estados para controlar modal e URL do vídeo
  const [modalOpen, setModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isDirectionReversed, setIsDirectionReversed] = useState(false);

  const normalizedCoordinates = useMemo(() => {
    if (!Array.isArray(coordinates)) return [];

    return coordinates
      .map(([lat, lng]) => [Number.parseFloat(lat), Number.parseFloat(lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }, [coordinates]);

  const routeCoordinates = useMemo(() => {
    if (!isDirectionReversed) return normalizedCoordinates;
    return [...normalizedCoordinates].reverse();
  }, [normalizedCoordinates, isDirectionReversed]);

  const coordinatesSignature = useMemo(
    () => routeCoordinates.map(([lat, lng]) => `${lat},${lng}`).join("|"),
    [routeCoordinates]
  );

  const waypointsFromSignature = useMemo(() => {
    if (!coordinatesSignature) return [];

    return coordinatesSignature
      .split("|")
      .map((pair) => pair.split(",").map((value) => Number.parseFloat(value)))
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }, [coordinatesSignature]);

  const handlePlayClick = async () => {
    if (!rotaId) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trajeto/video/${rotaId}`);
      if (!response.ok) throw new Error("Erro ao buscar vídeo");

      const data = await response.json();
      const fullUrl = `${process.env.NEXT_PUBLIC_API_URL}/${data.videoPath}`;

      setVideoUrl(fullUrl);
      setModalOpen(true);
    } catch (error) {
      console.error("Erro ao carregar vídeo:", error);
      Swal.fire({
        title: "Erro",
        text: "Não foi possível carregar o vídeo do trajeto.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const checkVideoAvailable = async () => {
    if (!rotaId) return false;

    if (videoAvailabilityRef.current !== undefined) {
      return Boolean(videoAvailabilityRef.current);
    }

    if (videoAvailabilityPromiseRef.current) {
      return videoAvailabilityPromiseRef.current;
    }

    const promise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/trajeto/video/${rotaId}`)
      .then(async (response) => {
        if (!response.ok) return false;
        const data = await response.json().catch(() => null);
        return Boolean(data?.videoPath);
      })
      .catch(() => false)
      .then((available) => {
        videoAvailabilityRef.current = available;
        videoAvailabilityPromiseRef.current = null;
        return available;
      });

    videoAvailabilityPromiseRef.current = promise;
    return promise;
  };

  const ensureRouteActionsRow = async (container) => {
    if (!container || routeActionsInsertedRef.current) return;

    const alt = container.querySelector(".leaflet-routing-alt");
    if (!alt) return;

    const [hasVideo, adminCanReverse] = await Promise.all([
      checkVideoAvailable(),
      Promise.resolve(Boolean(isAdmin)),
    ]);

    const shouldShowVideo = Boolean(rotaId && hasVideo);
    const shouldShowReverse = Boolean(adminCanReverse);
    if (!shouldShowVideo && !shouldShowReverse) return;

    const h3 = alt.querySelector("h3");
    const actionRow = document.createElement("div");
    actionRow.className = "route-actions-row";

    if (shouldShowVideo) {
      const button = document.createElement("button");
      button.className = "video-play-button";
      button.title = "Ver vídeo do trajeto";
      button.setAttribute("type", "button");

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "currentColor");

      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", "M8 5v14l11-7z");
      svg.appendChild(path);

      button.appendChild(svg);

      const span = document.createElement("span");
      span.textContent = "Ver vídeo do trajeto";
      button.appendChild(span);

      button.addEventListener("click", handlePlayClick);
      actionRow.appendChild(button);
    }

    if (shouldShowReverse) {
      const invertButton = document.createElement("button");
      invertButton.className = "route-reverse-button";
      invertButton.title = "Inverter direção da rota";
      invertButton.setAttribute("type", "button");
      invertButton.textContent = "Inverter direção";
      invertButton.addEventListener("click", () => {
        onRouteRecomputeStartRef.current?.();
        setIsDirectionReversed((prev) => !prev);
      });
      actionRow.appendChild(invertButton);
    }

    if (h3?.parentNode) {
      h3.parentNode.insertBefore(actionRow, h3.nextSibling);
    } else {
      alt.prepend(actionRow);
    }

    routeActionsInsertedRef.current = true;
  };

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    onRouteReadyRef.current = onRouteReady;
  }, [onRouteReady]);

  useEffect(() => {
    onRouteGeometryRef.current = onRouteGeometry;
  }, [onRouteGeometry]);

  useEffect(() => {
    onRouteRecomputeStartRef.current = onRouteRecomputeStart;
  }, [onRouteRecomputeStart]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const clearClickLayers = () => {
    clickLayersRef.current.forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    clickLayersRef.current = [];
  };

  const clearDirectionMarkers = () => {
    directionMarkersRef.current.forEach((marker) => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    directionMarkersRef.current = [];
  };

  const addDirectionMarkers = (routeCoordinates) => {
    clearDirectionMarkers();

    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 3) {
      return;
    }

    const markerStep = Math.max(10, Math.floor(routeCoordinates.length / 14));

    for (let i = markerStep; i < routeCoordinates.length - 1; i += markerStep) {
      const prev = routeCoordinates[i - 1];
      const current = routeCoordinates[i];
      const next = routeCoordinates[Math.min(i + 1, routeCoordinates.length - 1)];

      if (!prev || !current || !next) continue;

      const prevPoint = map.latLngToLayerPoint(prev);
      const nextPoint = map.latLngToLayerPoint(next);
      const deltaX = nextPoint.x - prevPoint.x;
      const deltaY = nextPoint.y - prevPoint.y;
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      const arrowIcon = L.divIcon({
        className: "route-direction-arrow",
        iconSize: [8, 8],
        iconAnchor: [4, 4],
        html: `
          <svg
            width="8"
            height="8"
            viewBox="0 0 12 12"
            style="display:block; transform: rotate(${angle}deg); transform-origin: center;"
          >
            <path d="M1 2 L11 6 L1 10 Z" fill="#ffffff" stroke="#111827" stroke-opacity="0.1" stroke-width="1.4" />
          </svg>
        `,
      });

      const marker = L.marker(current, {
        icon: arrowIcon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 600,
      }).addTo(map);

      directionMarkersRef.current.push(marker);
    }
  };

  const setControlLineVisibility = (isVisible) => {
    const line = controlRef.current?._line;
    if (!line) return;

    const style = isVisible
      ? { color: "hsl(var(--primary))", weight: 5, opacity: 1 }
      : { color: "hsl(var(--primary))", weight: 0, opacity: 0 };

    if (typeof line.setStyle === "function") {
      line.setStyle(style);
    }

    if (line._layers && typeof line._layers === "object") {
      Object.values(line._layers).forEach((layer) => {
        if (layer && typeof layer.setStyle === "function") {
          layer.setStyle(style);
        }
      });
    }
  };

  const bindClickLayer = (routeLayer) => {
    const clickLayer = L.polyline(routeLayer, {
      color: "transparent",
      weight: 20,
      opacity: 0,
    }).addTo(map);
    clickLayersRef.current.push(clickLayer);

    clickLayer.on("click", (event) => {
      if (!visibleRef.current) return;

      if (event?.originalEvent?.stopPropagation) {
        event.originalEvent.stopPropagation();
      }
      if (event) {
        L.DomEvent.stopPropagation(event);
      }

      onClickRef.current?.();

      if (!showDetails) return;

      const control = controlRef.current;
      const container = control?._container;
      if (!container) return;

      container.classList.remove("leaflet-routing-container-hide");

      container.classList.add("route-details-panel");
      container.setAttribute("role", "dialog");
      container.setAttribute("aria-label", "Detalhes do trajeto");

      const statsRouteId = estatisticaRotaId ?? rotaId;
      const canRegisterStats = Number.isFinite(Number(statsRouteId)) && Number(statsRouteId) > 0;
      const key = `viewed-rota-${statsRouteId}`;
      if (canRegisterStats && !sessionStorage.getItem(key)) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/estatistica/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "rota",
            referencia_id: statsRouteId,
          }),
        })
          .then(() => {
            sessionStorage.setItem(key, "true");
          })
          .catch((error) => {
            console.error("Erro ao registar visualização da rota:", error);
          });
      }

      container.style.display = "block";
      container.style.pointerEvents = "auto";
      container.style.zIndex = "9999";

      const altEl = container.querySelector(".leaflet-routing-alt");
      if (altEl) {
        altEl.style.maxHeight = "none";
        altEl.style.overflowY = "visible";
      }

      ensureRouteActionsRow(container);
    });
  };

  const applyVisibility = () => {
    const shouldShow = Boolean(visibleRef.current);
    setControlLineVisibility(shouldShow);

    const container = controlRef.current?._container;
    if (!shouldShow) {
      clearClickLayers();
      clearDirectionMarkers();

      if (container) {
        container.style.display = "none";
        container.style.pointerEvents = "none";
        container.classList.add("leaflet-routing-container-hide");
      }
      return;
    }

    if (routeCoordinatesRef.current.length > 0 && clickLayersRef.current.length === 0) {
      addDirectionMarkers(routeCoordinatesRef.current);
      bindClickLayer(routeCoordinatesRef.current);
    }
  };

  useEffect(() => {
    if (!map || waypointsFromSignature.length < 2) return;

    routeReadyNotifiedRef.current = false;

    if (!controlRef.current) {
      const control = L.Routing.control({
        waypoints: waypointsFromSignature.map(([lat, lng]) => L.latLng(lat, lng)),
        lineOptions: {
          styles: [{ color: "hsl(var(--primary))", weight: 5 }],
        },
        formatter: new L.Routing.Formatter({
          language: "pt-PT",
          units: "metric",
        }),
        router: L.Routing.osrmv1({
          serviceUrl: "https://router.project-osrm.org/route/v1",
          language: "pt-PT",
          // para caminho a pé: adicionar profile 'foot' se necessário via router customizado
        }),
        defaultErrorHandler: null,
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        createMarker: () => null,
      });

      control.on("routesfound", (e) => {
        if (!routeReadyNotifiedRef.current) {
          onRouteReadyRef.current?.();
          routeReadyNotifiedRef.current = true;
        }

        hasRouteDetailsRef.current = true;

        const routeLayer = e.routes[0].coordinates;
        onRouteGeometryRef.current?.(
          routeLayer
            .map((point) => [Number(point?.lat), Number(point?.lng)])
            .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
        );
        routeCoordinatesRef.current = routeLayer;
        clearClickLayers();
        clearDirectionMarkers();
        applyVisibility();

        control._container.style.display = "none";
      });

      control.on("routingerror", () => {
        if (!routeReadyNotifiedRef.current) {
          onRouteReadyRef.current?.();
          routeReadyNotifiedRef.current = true;
        }

        hasRouteDetailsRef.current = false;
        clearClickLayers();
        clearDirectionMarkers();

        const container = control._container;
        if (container) {
          container.style.display = "none";
          container.style.pointerEvents = "none";
        }
      });

      control.addTo(map);
      control.route();
      if (control._container) {
        if (showDetails) {
          control._container.classList.add("route-details-panel");
          control._container.setAttribute("role", "dialog");
          control._container.setAttribute("aria-label", "Detalhes do trajeto");
        }
        control._container.style.display = "none";
        control._container.style.pointerEvents = "none";
      }
      controlRef.current = control;
    }

    return () => {
      clearClickLayers();
      clearDirectionMarkers();

      if (controlRef.current) {
        controlRef.current.off();
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }

      routeActionsInsertedRef.current = false;
      videoAvailabilityRef.current = undefined;
      videoAvailabilityPromiseRef.current = null;
      routeCoordinatesRef.current = [];
    };
  }, [map, coordinatesSignature, waypointsFromSignature, rotaId, estatisticaRotaId]);

  useEffect(() => {
    applyVisibility();
  }, [visible]);

  useEffect(() => {
    if (!showDetails) return;

    const container = controlRef.current?._container;
    if (container) {
      const canShow = visible && active && hasRouteDetailsRef.current;
      container.style.display = canShow ? "block" : "none";
      container.style.pointerEvents = canShow ? "auto" : "none";
      if (canShow) {
        container.classList.add("route-details-panel");
        container.classList.remove("leaflet-routing-container-hide");
      } else {
        container.classList.add("leaflet-routing-container-hide");
      }
    }
  }, [active, showDetails, visible]);

  return (
    <>
      {/* Modal do vídeo */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Vídeo do trajeto"
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video bg-black">
              <video
                src={videoUrl}
                controls
                autoPlay
                className="h-full w-full object-contain"
              />
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar vídeo"
            >
              &times;
            </button>
          </div>
        </div>
      )}

    </>
  );
};

export default RoutingMachine;
