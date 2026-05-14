"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, MapPin, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const AFrameComponent = dynamic(() => import("../../../components/AFrameViewer"), {
  ssr: false,
});

const API = process.env.NEXT_PUBLIC_API_URL;

export default function PontoDetail() {
  const { id } = useParams();
  const pontoId = typeof id === "string" ? id : String(id);
  const router = useRouter();

  const [ponto, setPonto] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visualizacoes, setVisualizacoes] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const jaRegistou = useRef(false);

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!pontoId) return;

    const key = `viewed-ponto-${pontoId}`;
    const jaVisualizado = sessionStorage.getItem(key);

    const fetchPontoDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API}/ponto/${pontoId}`);
        if (!response.ok) throw new Error("Failed to fetch ponto details");
        const data = await response.json();
        setPonto(data.ponto);

        // Fetch categories
        if (data.ponto?.categorias) {
          setCategories(
            Array.isArray(data.ponto.categorias) ? data.ponto.categorias : []
          );
        }

        // Set visualizations count
        if (data.ponto?.visualizacoes) {
          setVisualizacoes(data.ponto.visualizacoes);
        }
      } catch (err) {
        setError("Erro ao buscar detalhes do ponto.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const registarVisualizacao = async () => {
      if (jaVisualizado || jaRegistou.current) return;
      jaRegistou.current = true;

      try {
        await fetch(`${API}/estatistica/`, {
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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md bg-background border border-border rounded-lg shadow-lg p-6">
          <h1 className="text-lg font-semibold text-destructive mb-4">Erro</h1>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.back()} variant="outline" className="w-full">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !ponto) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando ponto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Viewer */}
      <div className="flex-1 overflow-hidden relative">
        {/* Top bar with back button and info */}
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="h-12 w-12 shrink-0 bg-background/80 backdrop-blur-sm border-border hover:bg-background/90"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex h-12 max-w-xs items-center bg-background/80 backdrop-blur-sm border border-border rounded-md px-4">
            <p className="text-sm font-semibold truncate text-foreground">
              {ponto.name}
            </p>
          </div>
        </div>

        {/* AFrame Viewer */}
        <AFrameComponent
          environment={ponto.environment}
          enableContextMenu={true}
          pontoId={pontoId}
          navigateOnHotspot={true}
        />
      </div>
    </div>
  );
}
