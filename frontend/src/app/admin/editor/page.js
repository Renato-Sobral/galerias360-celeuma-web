'use client';
import { useState } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../../components/protectedRoute";

const Editor3D = dynamic(() => import("./components/Editor3D"), { ssr: false });
const Editor360 = dynamic(() => import("./components/Editor360"), { ssr: false });

export default function EditorPage() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const ext = selectedFile.name.split(".").pop().toLowerCase();
    if (["gltf", "glb", "ply", "splat"].includes(ext)) {
      setFileType("3d");
    } else if (["jpg", "jpeg", "png", "hdr"].includes(ext)) {
      setFileType("360");
    } else {
      setFileType(null);
      alert("Tipo de ficheiro não suportado!");
    }
  };

  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor"]}>
      <div style={{ padding: "20px" }}>
        <h1>Editor</h1>
        {!file && <input type="file" onChange={handleFileChange} />}

        {file && fileType === "3d" && <Editor3D file={file} />}
        {file && fileType === "360" && <Editor360 file={file} />}
      </div>
    </ProtectedRoute>
  );
}