"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AFrameComponent = dynamic(() => import("../../../components/AFrameViewer"), {
  ssr: false,
});

export default function PontoDetail() {
  const { id } = useParams();
  const pontoId = typeof id === "string" ? id : String(id);
  const router = useRouter();

  const [ponto, setPonto] = useState(null);
  const [error, setError] = useState("");

  const jaRegistou = useRef(false); // 🛡️ proteção contra duplicação

  useEffect(() => {
    if (!pontoId) return;

    const key = `viewed-ponto-${pontoId}`;
    const jaVisualizado = sessionStorage.getItem(key);

    const fetchPontoDetail = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ponto/${pontoId}`);
        if (!response.ok) throw new Error("Failed to fetch ponto details");
        const data = await response.json();
        setPonto(data.ponto);
      } catch (err) {
        setError("Erro ao buscar detalhes do ponto.");
        console.error(err);
      }
    };

    const registarVisualizacao = async () => {
      if (jaVisualizado || jaRegistou.current) return;
      jaRegistou.current = true;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/estatistica/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "ponto",
            referencia_id: pontoId,
          }),
        });
        sessionStorage.setItem(key, "true");
      } catch (err) {
        console.error("Erro ao registar visualização:", err);
      }
    };

    fetchPontoDetail();
    registarVisualizacao();
  }, [pontoId]);

  if (error) return <p>{error}</p>;
  if (!ponto) return <p>Carregando...</p>;
  
  return (
    <div className="flex min-h-screen">
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute top-2 left-2 p-6 bg-white opacity-90 shadow-lg rounded-xl max-w-sm w-full h-auto z-10 dark:bg-black">
          <h2 className="font-bold text-lg dark:text-white">{ponto.name}</h2>
          <p className="text-sm text-gray-600 dark:text-white/60">{ponto.description}</p>
          <p className="text-sm text-gray-600 dark:text-white/60">
            Coordenadas: {ponto.latitude}, {ponto.longitude}
          </p>
        </div>
        <AFrameComponent
          environment={ponto.environment}
          enableContextMenu={true}
          pontoId={pontoId}
        />
      </div>
    </div>
  );
}
