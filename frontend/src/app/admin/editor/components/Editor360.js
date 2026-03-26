import { useEffect, useMemo, useRef, useState } from "react";
import 'aframe';
import { ensurePanoramaDomeComponent } from "../../../lib/aframe-panorama-dome";

export default function Editor360({ file }) {
  const sceneRef = useRef(null);
  const domeEntityRef = useRef(null);
  const [domeComponentReady, setDomeComponentReady] = useState(false);
  const DEFAULT_PANORAMA_DOME_RADIUS = 700;
  const DEFAULT_PANORAMA_DOME_THETA_START_DEG = 0;
  const DEFAULT_PANORAMA_DOME_THETA_LENGTH_DEG = 90;
  const [imgURL, setImgURL] = useState(null);
  const [environmentError, setEnvironmentError] = useState("");
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [hue, setHue] = useState(0);
  const [domeRadius, setDomeRadius] = useState(DEFAULT_PANORAMA_DOME_RADIUS);
  const [domeThetaStartDeg, setDomeThetaStartDeg] = useState(DEFAULT_PANORAMA_DOME_THETA_START_DEG);
  const [domeThetaLengthDeg, setDomeThetaLengthDeg] = useState(DEFAULT_PANORAMA_DOME_THETA_LENGTH_DEG);
  const [domeVerticalOffset, setDomeVerticalOffset] = useState(0);
  const isHdrOrExrFile = /\.(hdr|exr)$/i.test(String(file?.name || ""));
  const domeThetaStartRad = useMemo(() => (domeThetaStartDeg * Math.PI) / 180, [domeThetaStartDeg]);
  const domeThetaLengthRad = useMemo(() => (domeThetaLengthDeg * Math.PI) / 180, [domeThetaLengthDeg]);
  const domeThetaEndRad = useMemo(() => {
    const end = domeThetaStartRad + domeThetaLengthRad;
    return Math.min(Math.PI, Math.max(0, end));
  }, [domeThetaLengthRad, domeThetaStartRad]);
  const domeFloorY = useMemo(() => domeRadius * Math.cos(domeThetaEndRad), [domeRadius, domeThetaEndRad]);
  const domeFloorRadius = useMemo(() => Math.max(40, domeRadius * Math.sin(domeThetaEndRad)), [domeRadius, domeThetaEndRad]);
  const domeFloorMaterial = useMemo(() => {
    if (!isHdrOrExrFile && imgURL) {
      return "shader: flat; src: #panorama; side: double; transparent: true; opacity: 0.98";
    }
    return "side: double; transparent: true; opacity: 0.92; roughness: 1; metalness: 0";
  }, [imgURL, isHdrOrExrFile]);

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
    const el = domeEntityRef.current;
    if (!el) return;

    const onError = (evt) => {
      const message = evt?.detail?.message;
      setEnvironmentError(message || "Nao foi possivel carregar o dome no editor.");
    };
    const onLoaded = () => setEnvironmentError("");

    el.addEventListener("panorama-dome-error", onError);
    el.addEventListener("panorama-dome-loaded", onLoaded);
    return () => {
      el.removeEventListener("panorama-dome-error", onError);
      el.removeEventListener("panorama-dome-loaded", onLoaded);
    };
  }, [imgURL, isHdrOrExrFile]);

  useEffect(() => {
    const el = domeEntityRef.current;
    if (!el) return;
    if (!imgURL) return;
    if (!domeComponentReady) return;

    el.setAttribute("panorama-dome", {
      kind: isHdrOrExrFile ? "hdr" : "image",
      src: imgURL,
      radius: domeRadius,
      rotationY: -90,
      opacity: 1,
      alignY: "center",
      model: "/models/Dome.fbx",
    });
  }, [domeComponentReady, domeRadius, imgURL, isHdrOrExrFile]);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setEnvironmentError("");

    if (isHdrOrExrFile) {
      setImgURL(url);
      return () => {
        URL.revokeObjectURL(url);
        setImgURL(null);
      };
    }

    // Carregar a imagem antes de usar no a-sky
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImgURL(url); // só atualiza quando a imagem estiver pronta
    };

    return () => {
      URL.revokeObjectURL(url);
      setImgURL(null);
    };
  }, [file, isHdrOrExrFile]);

  // HDR/EXR and images are now handled by the panorama-dome A-Frame component.

  // Aplicar filtros via CSS no canvas
  useEffect(() => {
    const canvas = sceneRef.current?.querySelector('canvas');
    if (canvas) {
      canvas.style.filter = `
        brightness(${brightness})
        contrast(${contrast})
        saturate(${saturation})
        hue-rotate(${hue}deg)
      `;
    }
  }, [brightness, contrast, saturation, hue]);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;

    const apply = () => {
      try {
        const renderer = sceneEl.renderer;
        if (renderer) {
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = window.THREE?.PCFSoftShadowMap ?? renderer.shadowMap.type;
          renderer.setClearColor?.(0x000000, 1);
        }

        sceneEl.object3D.traverse((obj) => {
          if (obj?.isLight) {
            obj.castShadow = true;
            if (obj.shadow) {
              obj.shadow.mapSize?.set?.(2048, 2048);
              obj.shadow.bias = -0.00008;
            }
          }
          if (obj?.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
      } catch {
        // ignore
      }
    };

    sceneEl.addEventListener("renderstart", apply);
    apply();
    return () => {
      sceneEl.removeEventListener("renderstart", apply);
    };
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: "800px", height: "600px", position: 'relative' }}>
        {environmentError && (
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 20, background: "#fef2f2", color: "#b91c1c", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
            {environmentError}
          </div>
        )}
        <a-scene
          ref={sceneRef}
          embedded
          vr-mode-ui="enabled: false"
          shadow="type: pcfsoft"
          style={{ width: '100%', height: '100%' }}
        >
          <a-assets>
            {imgURL && !isHdrOrExrFile && <img id="panorama" src={imgURL} crossOrigin="anonymous" />}
          </a-assets>

          {imgURL && <a-entity ref={domeEntityRef} position={`0 ${domeVerticalOffset} 0`} />}
          <a-camera wasd-controls-enabled="true" far={Math.max(50, Math.ceil(domeRadius * 1.05 + 10))}></a-camera>
        </a-scene>
      </div>

      <div style={{ marginLeft: "20px" }}>
        <h3>Dome 360</h3>
        <div>
          <label>Raio: {Math.round(domeRadius)}</label>
          <input
            type="range"
            min={300}
            max={1400}
            step={10}
            value={domeRadius}
            onChange={e => setDomeRadius(parseFloat(e.target.value))}
          />
        </div>
        <div>
          <label>Posição vertical: {Math.round(domeVerticalOffset)}</label>
          <input
            type="range"
            min={-2000}
            max={2000}
            step={1}
            value={domeVerticalOffset}
            onChange={e => setDomeVerticalOffset(parseFloat(e.target.value))}
          />
        </div>
        <div>
          <label>Início Vertical (theta-start): {Math.round(domeThetaStartDeg)}°</label>
          <input
            type="range"
            min={0}
            max={150}
            step={1}
            value={domeThetaStartDeg}
            onChange={e => {
              const nextStart = parseInt(e.target.value, 10);
              if (!Number.isFinite(nextStart)) return;
              setDomeThetaStartDeg(nextStart);
              setDomeThetaLengthDeg(prev => Math.min(prev, 180 - nextStart));
            }}
          />
        </div>
        <div>
          <label>Abertura Vertical (theta-length): {Math.round(domeThetaLengthDeg)}°</label>
          <input
            type="range"
            min={20}
            max={180 - domeThetaStartDeg}
            step={1}
            value={domeThetaLengthDeg}
            onChange={e => {
              const nextLength = parseInt(e.target.value, 10);
              if (!Number.isFinite(nextLength)) return;
              setDomeThetaLengthDeg(nextLength);
            }}
          />
        </div>

        <h3>VFX / Color Grading</h3>
        <div>
          <label>Brilho</label>
          <input type="range" min={0.1} max={2} step={0.01} value={brightness} onChange={e => setBrightness(parseFloat(e.target.value))} />
        </div>
        <div>
          <label>Contraste</label>
          <input type="range" min={0.1} max={2} step={0.01} value={contrast} onChange={e => setContrast(parseFloat(e.target.value))} />
        </div>
        <div>
          <label>Saturação</label>
          <input type="range" min={0} max={3} step={0.01} value={saturation} onChange={e => setSaturation(parseFloat(e.target.value))} />
        </div>
        <div>
          <label>Matiz</label>
          <input type="range" min={-180} max={180} step={1} value={hue} onChange={e => setHue(parseInt(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
