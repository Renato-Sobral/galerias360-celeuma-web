"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

const AFrameComponent = dynamic(
  () => import("../../../../components/AFrameViewer"),
  { ssr: false }
);

export default function Hotspot() {
  const { id } = useParams();
  const pontoId = typeof id === "string" ? id : String(id);
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [hotspots, setHotspots] = useState([]);

  useEffect(() => {
    if (!pontoId) return;

    const fetchImage = async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/${pontoId}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Erro ao buscar o ponto");

        const data = await response.json();
        if (data?.ponto?.image) {
          setImage(`data:image/jpeg;base64,${data.ponto.image}`);
        } else {
          setError("Imagem não encontrada.");
        }
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar a imagem.");
      }
    };

    fetchImage();
  }, [pontoId]);

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 overflow-hidden relative">
        {image ? (
          <AFrameComponent imageUrl={image} enableContextMenu pontoId={pontoId}/>
        ) : (
          <div className="p-4 text-red-600">{error || "A carregar imagem..."}</div>
        )}
      </div>
    </div>
  );
}
