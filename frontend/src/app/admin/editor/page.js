'use client';
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../../components/protectedRoute";
import MediaSourceField from "../../components/MediaSourceField";
import { fetchMediaFileAsFile, resolveMediaSelection } from "../../lib/media-library";

const Editor3D = dynamic(() => import("./components/Editor3D"), { ssr: false });
const Editor360 = dynamic(() => import("./components/Editor360"), { ssr: false });

export default function EditorPage() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selection) {
      setFile(null);
      setFileType(null);
      return;
    }

    let cancelled = false;

    const loadSelectedAsset = async () => {
      setLoading(true);
      try {
        const resolved = await resolveMediaSelection(selection, "editor");
        const selectedFile = await fetchMediaFileAsFile(resolved.path, resolved.name);
        if (cancelled) return;

        setFile(selectedFile);

        const ext = selectedFile.name.split(".").pop().toLowerCase();
        if (["gltf", "glb", "ply", "splat"].includes(ext)) {
          setFileType("3d");
        } else if (["jpg", "jpeg", "png", "hdr", "exr"].includes(ext)) {
          setFileType("360");
        } else {
          setFile(null);
          setFileType(null);
          alert("Tipo de ficheiro não suportado!");
        }
      } catch (error) {
        if (!cancelled) {
          setFile(null);
          setFileType(null);
          alert(error.message || "Erro ao abrir ficheiro.");
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

  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor"]}>
      <div style={{ padding: "20px" }}>
        <h1>Editor</h1>
        {!file && (
          <div style={{ maxWidth: "640px", marginBottom: "16px" }}>
            <MediaSourceField
              label="Ficheiro para editar"
              accept="image/*,.hdr,.exr,.gltf,.glb,.ply,.splat"
              selection={selection}
              onChange={setSelection}
              destinationPath="editor"
              required
            />
            {loading && <p style={{ marginTop: "8px", fontSize: "14px" }}>A preparar ficheiro...</p>}
          </div>
        )}

        {file && fileType === "3d" && <Editor3D file={file} />}
        {file && fileType === "360" && <Editor360 file={file} />}
      </div>
    </ProtectedRoute>
  );
}