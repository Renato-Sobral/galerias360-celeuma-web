'use client';
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../../components/protectedRoute";
import MediaSourceField from "../../components/MediaSourceField";
import { fetchMediaFileAsFile, getAuthHeaders, getMediaApiUrl, resolveMediaSelection } from "../../lib/media-library";
import { Button } from "@/components/ui/button";

const Editor3D = dynamic(() => import("./components/Editor3D"), { ssr: false });
const Editor360 = dynamic(() => import("./components/Editor360"), { ssr: false });

export default function EditorPage() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assetPath, setAssetPath] = useState("");
  const [savedState3D, setSavedState3D] = useState(null);
  const [savedState360, setSavedState360] = useState(null);

  useEffect(() => {
    if (!selection) {
      setFile(null);
      setFileType(null);
      setAssetPath("");
      setSavedState3D(null);
      setSavedState360(null);
      setError("");
      return;
    }

    let cancelled = false;

    const loadSelectedAsset = async () => {
      setLoading(true);
      setError("");
      try {
        const resolved = await resolveMediaSelection(selection, "editor");
        const selectedFile = await fetchMediaFileAsFile(resolved.path, resolved.name);
        if (cancelled) return;

        setFile(selectedFile);
        setAssetPath(resolved.path || "");

        const ext = selectedFile.name.split(".").pop().toLowerCase();
        if (["gltf", "glb", "ply", "splat"].includes(ext)) {
          setFileType("3d");
        } else if (["jpg", "jpeg", "png", "hdr", "exr"].includes(ext)) {
          setFileType("360");
        } else {
          setFile(null);
          setFileType(null);
          setAssetPath("");
          setError("Tipo de ficheiro não suportado. Use imagens 360 ou modelos 3D compatíveis.");
        }
      } catch (error) {
        if (!cancelled) {
          setFile(null);
          setFileType(null);
          setAssetPath("");
          setError(error.message || "Erro ao abrir ficheiro.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSelectedAsset();
    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    if (!assetPath || !fileType) {
      setSavedState3D(null);
      setSavedState360(null);
      return;
    }

    let cancelled = false;

    const loadSavedState = async () => {
      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost";
        const url = new URL(getMediaApiUrl("/editor/state"), baseUrl);
        url.searchParams.set("type", fileType);
        url.searchParams.set("path", assetPath);

        const response = await fetch(url.toString(), {
          headers: {
            ...getAuthHeaders(),
          },
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Erro ao carregar configuracao guardada.");
        }

        if (cancelled) return;
        const settings = payload?.data?.settings || null;
        if (fileType === "3d") {
          setSavedState3D(settings);
          setSavedState360(null);
        } else {
          setSavedState360(settings);
          setSavedState3D(null);
        }
      } catch {
        if (cancelled) return;
        if (fileType === "3d") {
          setSavedState3D(null);
        } else {
          setSavedState360(null);
        }
      }
    };

    loadSavedState();

    return () => {
      cancelled = true;
    };
  }, [assetPath, fileType]);

  const saveEditorState = async (type, settings) => {
    if (!assetPath) {
      throw new Error("Nenhum ficheiro selecionado.");
    }

    const response = await fetch(getMediaApiUrl("/editor/state"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        type,
        path: assetPath,
        settings,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Erro ao guardar configuracao.");
    }

    if (type === "3d") {
      setSavedState3D(settings);
    } else if (type === "360") {
      setSavedState360(settings);
    }

    return payload?.data || null;
  };

  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor"]}>
      <div className="flex min-h-screen bg-background text-foreground">
        <div className="flex-1 p-4 sm:p-8 overflow-auto">
          <h1 className="text-xl font-semibold mb-6 sm:text-2xl text-center sm:text-left mt-1 sm:mt-0">
            Editor
          </h1>

          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 sm:p-5 bg-card text-card-foreground rounded-2xl border border-border shadow-sm space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Edite panoramas 360 e modelos 3D com ajustes de transformacao, luz e cor.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos suportados: .jpg, .jpeg, .png, .hdr, .exr, .gltf, .glb, .ply, .splat
                  </p>
                </div>
                {file && (
                  <div className="flex gap-2 items-center">
                    {fileType && <span className="text-xs text-muted-foreground rounded-md border border-border px-2 py-1">{fileType === "3d" ? "Modelo 3D" : "Panorama 360"}</span>}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFile(null);
                        setFileType(null);
                        setSelection(null);
                        setAssetPath("");
                        setSavedState3D(null);
                        setSavedState360(null);
                        setError("");
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>

              <div className="max-w-3xl space-y-2">
                <MediaSourceField
                  label="Ficheiro para editar"
                  accept="image/*,.hdr,.exr,.gltf,.glb,.ply,.splat"
                  selection={selection}
                  onChange={setSelection}
                  destinationPath="editor"
                  required
                />
                {loading && <p className="text-sm">A preparar ficheiro...</p>}
                {!loading && file && <p className="text-sm text-muted-foreground">A editar: {file.name}</p>}
                {error && <p className="text-sm text-red-700">{error}</p>}
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
              {!file && (
                <div className="h-[50vh] min-h-[280px] grid place-items-center text-center px-4">
                  <div>
                    <p className="text-sm font-medium">Seleciona um ficheiro para comecar</p>
                    <p className="text-xs text-muted-foreground mt-1">O editor abre automaticamente quando escolheres um asset.</p>
                  </div>
                </div>
              )}

              {file && fileType === "3d" && (
                <Editor3D
                  file={file}
                  initialSettings={savedState3D}
                  onSave={(settings) => saveEditorState("3d", settings)}
                />
              )}
              {file && fileType === "360" && (
                <Editor360
                  file={file}
                  initialSettings={savedState360}
                  onSave={(settings) => saveEditorState("360", settings)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}