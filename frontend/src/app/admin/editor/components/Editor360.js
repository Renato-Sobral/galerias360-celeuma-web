import { useEffect, useMemo, useRef, useState } from "react";
import 'aframe';

export default function Editor360({ file }) {
  const sceneRef = useRef(null);
  const hdrSphereRef = useRef(null);
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

  const disposeHdrSphere = () => {
    const mesh = hdrSphereRef.current;
    if (!mesh) return;

    if (mesh.parent) mesh.parent.remove(mesh);
    if (mesh.material?.map) mesh.material.map.dispose();
    mesh.material?.dispose?.();
    mesh.geometry?.dispose?.();
    hdrSphereRef.current = null;
  };

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

  useEffect(() => {
    let cancelled = false;

    const loadHdrOrExr = async () => {
      const sceneEl = sceneRef.current;
      if (!sceneEl) return;

      if (!isHdrOrExrFile || !imgURL) {
        disposeHdrSphere();
        return;
      }

      try {
        const THREE = await import("three");
        const isExr = /\.exr$/i.test(String(file?.name || ""));
        const loaderModule = isExr
          ? await import("three/examples/jsm/loaders/EXRLoader.js")
          : await import("three/examples/jsm/loaders/RGBELoader.js");
        const Loader = isExr ? loaderModule.EXRLoader : loaderModule.RGBELoader;
        const loader = new Loader();

        loader.load(
          imgURL,
          (texture) => {
            if (cancelled) {
              texture.dispose();
              return;
            }

            disposeHdrSphere();
            texture.mapping = THREE.EquirectangularReflectionMapping;

            const geometry = new THREE.SphereGeometry(
              domeRadius,
              64,
              32,
              0,
              Math.PI * 2,
              domeThetaStartRad,
              domeThetaLengthRad
            );
            geometry.scale(-1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ map: texture });
            const mesh = new THREE.Mesh(geometry, material);

            sceneEl.object3D.add(mesh);
            hdrSphereRef.current = mesh;
          },
          undefined,
          () => {
            if (cancelled) return;
            setEnvironmentError("Nao foi possivel carregar o ficheiro HDR/EXR no editor.");
          }
        );
      } catch (_error) {
        if (cancelled) return;
        setEnvironmentError("Nao foi possivel carregar o ficheiro HDR/EXR no editor.");
      }
    };

    loadHdrOrExr();

    return () => {
      cancelled = true;
      disposeHdrSphere();
    };
  }, [domeRadius, domeThetaLengthRad, domeThetaStartRad, file?.name, imgURL, isHdrOrExrFile]);

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
          style={{ width: '100%', height: '100%' }}
        >
          <a-assets>
            {imgURL && !isHdrOrExrFile && <img id="panorama" src={imgURL} crossOrigin="anonymous" />}
          </a-assets>

          {imgURL && !isHdrOrExrFile && (
            <a-sky
              id="sky"
              src="#panorama"
              rotation="0 -90 0"
              radius={domeRadius}
              theta-start={domeThetaStartDeg}
              theta-length={domeThetaLengthDeg}
            ></a-sky>
          )}
          <a-circle
            position={`0 ${domeFloorY.toFixed(3)} 0`}
            rotation="-90 0 0"
            radius={domeFloorRadius}
            color={isHdrOrExrFile ? "#202632" : "#ffffff"}
            material={domeFloorMaterial}
          />
          <a-ring
            position={`0 ${(domeFloorY + 0.02).toFixed(3)} 0`}
            rotation="-90 0 0"
            radius-inner={Math.max(1, domeFloorRadius - Math.max(10, domeFloorRadius * 0.03))}
            radius-outer={domeFloorRadius}
            color={isHdrOrExrFile ? "#7f8ea3" : "#ffffff"}
            material={isHdrOrExrFile
              ? "side: double; transparent: true; opacity: 0.35"
              : "side: double; transparent: true; opacity: 0.12"}
          />
          <a-camera wasd-controls-enabled="true"></a-camera>
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
