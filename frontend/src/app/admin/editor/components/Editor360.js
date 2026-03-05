import { useEffect, useRef, useState } from "react";
import 'aframe';

export default function Editor360({ file }) {
  const sceneRef = useRef(null);
  const [imgURL, setImgURL] = useState(null);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [hue, setHue] = useState(0);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);

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
  }, [file]);

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
        <a-scene
          ref={sceneRef}
          embedded
          vr-mode-ui="enabled: false"
          style={{ width: '100%', height: '100%' }}
        >
          <a-assets>
            {imgURL && <img id="panorama" src={imgURL} crossOrigin="anonymous" />}
          </a-assets>

          {imgURL && <a-sky id="sky" src="#panorama" rotation="0 -90 0"></a-sky>}
          <a-camera wasd-controls-enabled="true"></a-camera>
        </a-scene>
      </div>

      <div style={{ marginLeft: "20px" }}>
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
