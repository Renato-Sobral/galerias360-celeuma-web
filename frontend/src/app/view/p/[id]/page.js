"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, Info, MapPin, Eye, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [showInfo, setShowInfo] = useState(true);
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

  // DEBUG: log showInfo changes and global clicks to help diagnose auto-hide
  useEffect(() => {
    console.log("PontoDetail: showInfo ->", showInfo);
  }, [showInfo]);

  useEffect(() => {
    const onDocClick = (e) => {
      // Only log clicks when info is visible to reduce noise
      if (!showInfo) return;
      try {
        console.log("PontoDetail: global click on", e.target && (e.target.tagName || e.target.className));
      } catch (err) {
        console.log("PontoDetail: global click (unknown target)");
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [showInfo]);

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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.back()} variant="outline" className="w-full">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
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
        {/* Top bar with back button and info toggle */}
        <div className="absolute top-4 left-4 z-60 flex flex-col items-start gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="bg-background/80 backdrop-blur-sm border-border hover:bg-background/90"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant={showInfo ? "default" : "outline"}
            size="icon"
            onClick={() => setShowInfo(!showInfo)}
            className="bg-background/80 backdrop-blur-sm border-border hover:bg-background/90"
            aria-label={showInfo ? "Ocultar info" : "Mostrar info"}
            title={showInfo ? "Ocultar info" : "Mostrar info"}
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>

        {/* Info card for desktop */}
        {showInfo && !isMobile && (
          <div className="absolute top-28 left-4 right-4 bottom-4 pointer-events-none">
            <div className="absolute inset-0 max-w-sm h-fit pointer-events-auto z-50">
              <Card className="bg-background/95 backdrop-blur-md border-border shadow-lg z-50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2">
                        {ponto.name}
                      </CardTitle>
                      {categories.length > 0 && (
                        <CardDescription className="mt-1">
                          {categories.map((cat, i) => (
                            <Badge
                              key={cat.id ?? cat.name ?? i}
                              variant="secondary"
                              className="mr-1 mt-1"
                            >
                              {cat.name}
                            </Badge>
                          ))}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  {ponto.description && (
                    <p className="text-muted-foreground line-clamp-3">
                      {ponto.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    {ponto.latitude && ponto.longitude && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0 text-primary" />
                        <span>
                          {ponto.latitude.toFixed(6)}, {ponto.longitude.toFixed(6)}
                        </span>
                      </div>
                    )}

                    {visualizacoes > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Eye className="w-4 h-4 shrink-0 text-primary" />
                        <span>{visualizacoes} visualização(ões)</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* AFrame Viewer */}
        <AFrameComponent
          environment={ponto.environment}
          enableContextMenu={true}
          pontoId={pontoId}
          navigateOnHotspot={true}
        />
      </div>

      {/* Mobile drawer for info */}
      {isMobile && showInfo && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowInfo(false)}
          />

          {/* Drawer */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] rounded-t-2xl bg-background border-t border-border shadow-lg animate-in slide-in-from-bottom">
            {/* Header */}
            <div className="p-4 pb-3 border-b border-border flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold leading-none">
                  {ponto.name}
                </h2>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {categories.map((cat, i) => (
                      <Badge key={cat.id ?? cat.name ?? i} variant="secondary" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 -m-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {ponto.description && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Descrição</h3>
                  <p className="text-sm text-muted-foreground">{ponto.description}</p>
                </div>
              )}

              <div className="space-y-2">
                {ponto.latitude && ponto.longitude && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">
                      {ponto.latitude.toFixed(6)}, {ponto.longitude.toFixed(6)}
                    </span>
                  </div>
                )}

                {visualizacoes > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">
                      {visualizacoes} visualização(ões)
                    </span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
