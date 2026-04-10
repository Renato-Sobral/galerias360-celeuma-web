import { useEffect, useRef, useState } from "react";
import 'aframe';
import { ensurePanoramaDomeComponent } from "../../../lib/aframe-panorama-dome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Editor360({ file, initialSettings, onSave }) {
  const sceneRef = useRef(null);
  const panoramaEntityRef = useRef(null);
  const [panoramaComponentReady, setPanoramaComponentReady] = useState(false);
  const DEFAULT_PANORAMA_RADIUS = 700;
  const [imgURL, setImgURL] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [environmentError, setEnvironmentError] = useState("");
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [hue, setHue] = useState(0);
  const [panoramaRadius, setPanoramaRadius] = useState(DEFAULT_PANORAMA_RADIUS);
  const [panoramaVerticalOffset, setPanoramaVerticalOffset] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const isHdrOrExrFile = /\.(hdr|exr)$/i.test(String(file?.name || ""));

  useEffect(() => {
    if (!initialSettings || typeof initialSettings !== "object") return;

    setBrightness(Number.isFinite(Number(initialSettings.brightness)) ? Number(initialSettings.brightness) : 1);
    setContrast(Number.isFinite(Number(initialSettings.contrast)) ? Number(initialSettings.contrast) : 1);
    setSaturation(Number.isFinite(Number(initialSettings.saturation)) ? Number(initialSettings.saturation) : 1);
    setHue(Number.isFinite(Number(initialSettings.hue)) ? Number(initialSettings.hue) : 0);
    setPanoramaRadius(Number.isFinite(Number(initialSettings.panoramaRadius)) ? Number(initialSettings.panoramaRadius) : DEFAULT_PANORAMA_RADIUS);
    setPanoramaVerticalOffset(Number.isFinite(Number(initialSettings.panoramaVerticalOffset)) ? Number(initialSettings.panoramaVerticalOffset) : 0);
  }, [initialSettings, file]);

  useEffect(() => {
    let mounted = true;
    ensurePanoramaDomeComponent()
      .catch(() => {
        // ignore; errors are surfaced via events when the entity tries to load
      })
      .finally(() => {
        if (!mounted) return;
        setPanoramaComponentReady(Boolean(window?.AFRAME?.components?.["panorama-dome"]));
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const el = panoramaEntityRef.current;
    if (!el) return;

    const onError = (evt) => {
      const message = evt?.detail?.message;
      setEnvironmentError(message || "Nao foi possivel carregar o panorama no editor.");
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
    const el = panoramaEntityRef.current;
    if (!el) return;
    if (!imgURL) return;
    if (!panoramaComponentReady) return;

    el.setAttribute("panorama-dome", {
      kind: isHdrOrExrFile ? "hdr" : "image",
      src: imgURL,
      radius: panoramaRadius,
      rotationY: -90,
      opacity: 1,
    });
  }, [imgURL, isHdrOrExrFile, panoramaComponentReady, panoramaRadius]);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setEnvironmentError("");
    setLoadingImage(true);

    if (isHdrOrExrFile) {
      setImgURL(url);
      setLoadingImage(false);
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
      setLoadingImage(false);
    };
    img.onerror = () => {
      setEnvironmentError("Nao foi possivel carregar a imagem selecionada.");
      setLoadingImage(false);
    };

    return () => {
      URL.revokeObjectURL(url);
      setImgURL(null);
    };
  }, [file, isHdrOrExrFile]);

  const resetGrading = () => {
    setBrightness(1);
    setContrast(1);
    setSaturation(1);
    setHue(0);
    setPanoramaRadius(DEFAULT_PANORAMA_RADIUS);
    setPanoramaVerticalOffset(0);
  };

  const handleSave = async () => {
    if (!onSave) return;

    setSaveLoading(true);
    setSaveMessage("");
    setSaveError("");

    try {
      await onSave({
        brightness,
        contrast,
        saturation,
        hue,
        panoramaRadius,
        panoramaVerticalOffset,
      });
      setSaveMessage("Edicoes guardadas.");
    } catch (err) {
      setSaveError(err?.message || "Nao foi possivel guardar as edicoes.");
    } finally {
      setSaveLoading(false);
    }
  };

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
    <div className="grid gap-4 xl:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Visualizador 360</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-[54vh] min-h-[420px] max-h-[780px] w-full overflow-hidden rounded-lg border border-border bg-black">
            {loadingImage && (
              <div style={{ position: "absolute", top: 8, left: 8, zIndex: 20, background: "#f3f4f6", color: "#111827", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
                A carregar panorama...
              </div>
            )}
            {environmentError && (
              <div style={{ position: "absolute", top: loadingImage ? 40 : 8, left: 8, zIndex: 20, background: "#fef2f2", color: "#b91c1c", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
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

              {imgURL && <a-entity ref={panoramaEntityRef} position={`0 ${panoramaVerticalOffset} 0`} />}
              <a-camera wasd-controls-enabled="true" far={Math.max(50, Math.ceil(panoramaRadius * 1.05 + 10))}></a-camera>
            </a-scene>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-4 xl:self-start">
        <CardHeader className="pb-3">
          <CardTitle>Ajustes 360</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 xl:max-h-[78vh] xl:overflow-y-auto xl:pr-1">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetGrading}>
              Resetar ajustes
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saveLoading || !onSave}>
              {saveLoading ? "A guardar..." : "Guardar"}
            </Button>
          </div>
          {saveMessage && <p className="text-xs text-emerald-700">{saveMessage}</p>}
          {saveError && <p className="text-xs text-red-700">{saveError}</p>}

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Panorama</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Raio: {Math.round(panoramaRadius)}</label>
              <input
                className="w-full"
                type="range"
                min={300}
                max={1400}
                step={10}
                value={panoramaRadius}
                onChange={e => setPanoramaRadius(parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Posicao vertical: {Math.round(panoramaVerticalOffset)}</label>
              <input
                className="w-full"
                type="range"
                min={-2000}
                max={2000}
                step={1}
                value={panoramaVerticalOffset}
                onChange={e => setPanoramaVerticalOffset(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">VFX / Color Grading</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Brilho: {brightness.toFixed(2)}</label>
              <input className="w-full" type="range" min={0.1} max={2} step={0.01} value={brightness} onChange={e => setBrightness(parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Contraste: {contrast.toFixed(2)}</label>
              <input className="w-full" type="range" min={0.1} max={2} step={0.01} value={contrast} onChange={e => setContrast(parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Saturacao: {saturation.toFixed(2)}</label>
              <input className="w-full" type="range" min={0} max={3} step={0.01} value={saturation} onChange={e => setSaturation(parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Matiz: {Math.round(hue)} deg</label>
              <input className="w-full" type="range" min={-180} max={180} step={1} value={hue} onChange={e => setHue(parseInt(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
