import { useEffect, useState } from "react"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUpIcon, MapPin, Waypoints, Eye } from "lucide-react"

export default function StatisticsCards() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const API = process.env.NEXT_PUBLIC_API_URL

    useEffect(() => {
        const controller = new AbortController()

        const fetchStats = async () => {
            try {
                const cacheKey = "dashboard:stats:v1"
                const cachedRaw = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey) : null

                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw)
                    if (cached?.timestamp && Date.now() - cached.timestamp < 30_000 && cached?.data) {
                        setStats(cached.data)
                        setLoading(false)
                        return
                    }
                }

                const res = await fetch(`${API}/estatistica/resumo`, {
                    signal: controller.signal,
                    cache: "no-store",
                })
                if (!res.ok) throw new Error("Erro ao carregar estatísticas")
                const data = await res.json()
                setStats(data)
                if (typeof window !== "undefined") {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }))
                }
            } catch (err) {
                if (err.name === "AbortError") return
                console.error("Erro ao carregar estatísticas:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()

        return () => controller.abort()
    }, [API])

    if (loading && !stats) return <p>A carregar estatísticas...</p>
    if (!stats) return <p className="text-muted-foreground">Sem dados estatísticos.</p>

    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 @container/card">
            {/* Total de Visualizações */}
            <Card className="relative flex flex-col">
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardDescription className="flex items-center gap-1"><Eye className="size-4" />Total de Visualizações</CardDescription>
                        <Badge variant="outline" className="flex gap-1 rounded-lg text-xs shrink-0">
                            <TrendingUpIcon className="size-3" />
                            +{stats.percentagemVisualizacoes}% este mês
                        </Badge>
                    </div>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                        {stats.totalVisualizacoes}
                    </CardTitle>
                </CardHeader>
            </Card>

            {/* Ponto mais visto */}
            <Card className="relative flex flex-col">
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardDescription className="flex items-center gap-1">
                            <MapPin className="size-4" />
                            Ponto mais visto
                        </CardDescription>
                        <Badge variant="outline" className="flex gap-1 rounded-lg text-xs shrink-0">
                            <TrendingUpIcon className="size-3" />
                            {stats.pontoMaisVisto?.total || 0} visualizações
                        </Badge>
                    </div>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                        {stats.pontoMaisVisto?.nome || "—"}
                    </CardTitle>
                </CardHeader>
            </Card>

            {/* Trajeto mais visto */}
            <Card className="relative flex flex-col">
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardDescription className="flex items-center gap-1">
                            <Waypoints className="size-4" />
                            Trajeto mais visto
                        </CardDescription>
                        <Badge variant="outline" className="flex gap-1 rounded-lg text-xs shrink-0">
                            <TrendingUpIcon className="size-3" />
                            {stats.rotaMaisVista?.total || 0} visualizações
                        </Badge>
                    </div>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                        {stats.rotaMaisVista?.nome || "—"}
                    </CardTitle>
                </CardHeader>
            </Card>

            {/* Conteúdo disponível */}
            <Card className="relative flex flex-col">
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardDescription>Conteúdo disponível</CardDescription>
                        <Badge variant="outline" className="flex gap-1 rounded-lg text-xs shrink-0">
                            <TrendingUpIcon className="size-3" />
                            +{stats.novosPontos + stats.novosTrajetos} este mês
                        </Badge>
                    </div>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                        {stats.totalPontos} ponto(s) • {stats.totalTrajetos} trajeto(s)
                    </CardTitle>
                </CardHeader>
            </Card>
        </div>
    )
}
