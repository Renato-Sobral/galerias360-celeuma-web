import { useEffect, useState } from "react"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUpIcon, MapPin, Waypoints, Eye, Monitor, Smartphone, Tablet } from "lucide-react"

export default function StatisticsCards() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const API = process.env.NEXT_PUBLIC_API_URL

    useEffect(() => {
        const controller = new AbortController()

        const fetchStats = async () => {
            try {
                const cacheKey = "dashboard:stats:v2"
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

    const dispositivos = stats.dispositivos || { desktop: 0, mobile: 0, tablet: 0 }
    const totalDispositivos = dispositivos.desktop + dispositivos.mobile + dispositivos.tablet
    const pctDesktop = totalDispositivos > 0 ? ((dispositivos.desktop / totalDispositivos) * 100).toFixed(0) : 0
    const pctMobile = totalDispositivos > 0 ? ((dispositivos.mobile / totalDispositivos) * 100).toFixed(0) : 0
    const pctTablet = totalDispositivos > 0 ? ((dispositivos.tablet / totalDispositivos) * 100).toFixed(0) : 0

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

            {/* Dispositivos */}
            <Card className="relative flex flex-col">
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardDescription className="flex items-center gap-1">
                            <Monitor className="size-4" />
                            Dispositivos
                        </CardDescription>
                        <Badge variant="outline" className="flex gap-1 rounded-lg text-xs shrink-0">
                            <TrendingUpIcon className="size-3" />
                            +{stats.novosPontos + stats.novosTrajetos} conteúdo
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1" title="Desktop">
                            <Monitor className="size-4 text-[hsl(var(--chart-1))]" />
                            <span className="font-semibold">{pctDesktop}%</span>
                        </div>
                        <div className="flex items-center gap-1" title="Mobile">
                            <Smartphone className="size-4 text-[hsl(var(--chart-2))]" />
                            <span className="font-semibold">{pctMobile}%</span>
                        </div>
                        <div className="flex items-center gap-1" title="Tablet">
                            <Tablet className="size-4 text-[hsl(var(--chart-3))]" />
                            <span className="font-semibold">{pctTablet}%</span>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        </div>
    )
}
