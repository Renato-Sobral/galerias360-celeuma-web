"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import Swal from "sweetalert2";

const RoutingMachine = ({ coordinates, active = false, onClick, rotaId, estatisticaRotaId }) => {
  const map = useMap();
  const controlRef = useRef(null);
  const clickLayersRef = useRef([]);
  const onClickRef = useRef(onClick);
  const videoInsertedRef = useRef(false);
  const hasRouteDetailsRef = useRef(false);

  // Estados para controlar modal e URL do vídeo
  const [modalOpen, setModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  const normalizedCoordinates = useMemo(() => {
    if (!Array.isArray(coordinates)) return [];

    return coordinates
      .map(([lat, lng]) => [Number.parseFloat(lat), Number.parseFloat(lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }, [coordinates]);

  const coordinatesSignature = useMemo(
    () => normalizedCoordinates.map(([lat, lng]) => `${lat},${lng}`).join("|"),
    [normalizedCoordinates]
  );

  const waypointsFromSignature = useMemo(() => {
    if (!coordinatesSignature) return [];

    return coordinatesSignature
      .split("|")
      .map((pair) => pair.split(",").map((value) => Number.parseFloat(value)))
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }, [coordinatesSignature]);

  const handlePlayClick = async () => {
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

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  const clearClickLayers = () => {
    clickLayersRef.current.forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    clickLayersRef.current = [];
  };

  useEffect(() => {
    if (!map || waypointsFromSignature.length < 2) return;

    if (!controlRef.current) {
      const control = L.Routing.control({
        waypoints: waypointsFromSignature.map(([lat, lng]) => L.latLng(lat, lng)),
        lineOptions: {
          styles: [{ color: "hsl(var(--primary))", weight: 5 }],
        },
        router: L.Routing.osrmv1({
          serviceUrl: "https://router.project-osrm.org/route/v1",
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
        hasRouteDetailsRef.current = true;
        clearClickLayers();

        const routeLayer = e.routes[0].coordinates;

        const clickLayer = L.polyline(routeLayer, {
          color: "transparent",
          weight: 20,
          opacity: 0,
        }).addTo(map);
        clickLayersRef.current.push(clickLayer);

        clickLayer.on("click", (event) => {
          if (event?.originalEvent?.stopPropagation) {
            event.originalEvent.stopPropagation();
          }
          if (event) {
            L.DomEvent.stopPropagation(event);
          }

          const container = control._container;
          if (!container) return;

          // Remove a classe que esconde o conteúdo (.leaflet-routing-alt)
          container.classList.remove("leaflet-routing-container-hide");

          const isDark = document.documentElement.classList.contains("dark");

          onClickRef.current?.();

          const statsRouteId = estatisticaRotaId ?? rotaId;
          const key = `viewed-rota-${statsRouteId}`;
          if (!sessionStorage.getItem(key)) {
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

          Object.assign(container.style, {
            display: "block",
            zIndex: "9999",
            position: "absolute",
            top: "20px",
            right: "20px",
            backgroundColor: isDark
              ? "rgba(0, 0, 0, 0.95)"
              : "rgba(255, 255, 255, 0.9)",
            color: isDark ? "#ffffff" : "#0A0A0A",
            padding: "16px",
            width: "20vw",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            maxHeight: "40vh",
            overflowY: "auto",
          });

          // Remover scroll interno do .leaflet-routing-alt para evitar scroll duplo
          const altEl = container.querySelector(".leaflet-routing-alt");
          if (altEl) {
            altEl.style.maxHeight = "none";
            altEl.style.overflowY = "visible";
          }

          if (isDark) {
            const icons = container.querySelectorAll(".leaflet-routing-icon");
            icons.forEach((icon) => {
              icon.style.filter = "brightness(0) invert(1)";
            });
          }

          const styleTagId = "routing-hover-style";
          if (!document.getElementById(styleTagId)) {
            const style = document.createElement("style");
            style.id = styleTagId;
            style.innerHTML = `
              .leaflet-routing-container tr:hover {
                background-color: ${isDark ? "rgba(255, 255, 255, 0.1)" : "#f0f0f0"
              };
              }
            `;
            document.head.appendChild(style);
          }

          if (!videoInsertedRef.current) {
            const alt = container.querySelector(".leaflet-routing-alt");
            if (alt && !alt.querySelector(".video-play-button")) {
              const h3 = alt.querySelector("h3");

              const button = document.createElement("button");
              button.className = "video-play-button";
              button.title = "Ver vídeo do trajeto";
              button.setAttribute("type", "button");
              Object.assign(button.style, {
                marginTop: "8px",
                marginBottom: "12px",
                fontSize: "14px",
                color: isDark ? "#f3f3f3" : "#0A0A0A",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                borderRadius: "4px",
                transition: "background-color 0.3s ease",
              });
              button.onmouseover = () => {
                button.style.backgroundColor = isDark
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(0, 0, 0, 0.1)";
              };
              button.onmouseout = () => {
                button.style.backgroundColor = "transparent";
              };

              // Ícone SVG de play
              const svgNS = "http://www.w3.org/2000/svg";
              const svg = document.createElementNS(svgNS, "svg");
              svg.setAttribute("width", "16");
              svg.setAttribute("height", "16");
              svg.setAttribute("viewBox", "0 0 24 24");
              svg.setAttribute("fill", isDark ? "#f3f3f3" : "#0A0A0A");

              const path = document.createElementNS(svgNS, "path");
              path.setAttribute("d", "M8 5v14l11-7z"); // triângulo play
              svg.appendChild(path);

              button.appendChild(svg);

              const span = document.createElement("span");
              span.textContent = "Ver vídeo do trajeto";
              button.appendChild(span);

              button.addEventListener("click", handlePlayClick);

              if (h3?.parentNode) {
                h3.parentNode.insertBefore(button, h3.nextSibling);
              } else {
                alt.prepend(button);
              }

              videoInsertedRef.current = true;
            }
          }

          if (isDark) {
            const elements = container.querySelectorAll(
              "h3, a, span, div, button"
            );
            elements.forEach((el) => {
              el.style.color = "#f3f3f3";
            });
          }

          console.log("ID do trajeto clicado:", rotaId);
        });

        control._container.style.display = "none";
      });

      control.on("routingerror", () => {
        hasRouteDetailsRef.current = false;
        clearClickLayers();

        const container = control._container;
        if (container) {
          container.style.display = "none";
          container.style.pointerEvents = "none";
        }
      });

      control.addTo(map);
      control.route();
      if (control._container) {
        control._container.style.display = "none";
        control._container.style.pointerEvents = "none";
      }
      controlRef.current = control;
    }

    return () => {
      clearClickLayers();

      if (controlRef.current) {
        controlRef.current.off();
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }

      videoInsertedRef.current = false;
    };
  }, [map, coordinatesSignature, waypointsFromSignature, rotaId, estatisticaRotaId]);

  useEffect(() => {
    const container = controlRef.current?._container;
    if (container) {
      const canShow = active && hasRouteDetailsRef.current;
      container.style.display = canShow ? "block" : "none";
      container.style.pointerEvents = canShow ? "auto" : "none";
      if (canShow) {
        container.classList.remove("leaflet-routing-container-hide");
      } else {
        container.classList.add("leaflet-routing-container-hide");
      }
    }
  }, [active]);

  return (
    <>
      {/* Modal do vídeo */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
            padding: "1rem",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              position: "relative",
              background: "#000",
              width: "80vw",
              maxWidth: "1200px",
              aspectRatio: "16 / 9",
              borderRadius: 8,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={videoUrl}
              controls
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: 0,
                margin: 0,
                padding: 0,
                display: "block",
                backgroundColor: "#000",
              }}
            />
            <button
              onClick={() => setModalOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
              }}
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
