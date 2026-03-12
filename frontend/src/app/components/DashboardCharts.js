"use client"

import { useEffect, useState, useMemo } from "react"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltipContent,
    ChartLegendContent,
} from "@/components/ui/chart"
import {
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts"
import { Monitor, Smartphone, Tablet, Globe, BarChart3, TrendingUp, History, Clock3, Route, MapPin } from "lucide-react"

const API = process.env.NEXT_PUBLIC_API_URL

const DEVICE_COLORS = {
    desktop: "hsl(var(--chart-1))",
    mobile: "hsl(var(--chart-2))",
    tablet: "hsl(var(--chart-3))",
}

const DEVICE_LABELS = {
    desktop: "Desktop",
    mobile: "Mobile",
    tablet: "Tablet",
}

const BROWSER_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
]

const SO_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
]

function useFetchData(endpoint, params = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    const queryString = useMemo(() => {
        const qs = new URLSearchParams(params).toString()
        return qs ? `?${qs}` : ""
    }, [JSON.stringify(params)])

    useEffect(() => {
        const controller = new AbortController()

        const fetchData = async () => {
            try {
                const res = await fetch(`${API}/estatistica/${endpoint}${queryString}`, {
                    signal: controller.signal,
                })
                if (!res.ok) throw new Error("Fetch error")
                const json = await res.json()
                setData(json.data || json)
            } catch (err) {
                if (err.name === "AbortError") return
                console.error(`Erro ao carregar ${endpoint}:`, err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
        return () => controller.abort()
    }, [endpoint, queryString])

    return { data, loading }
}

function DeviceIcon({ type, className }) {
    switch (type) {
        case "desktop":
            return <Monitor className={className} />
        case "mobile":
            return <Smartphone className={className} />
        case "tablet":
            return <Tablet className={className} />
        default:
            return <Globe className={className} />
    }
}

function formatAccessTime(value) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return "Data inválida"

    return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

/**
 * Gráfico de distribuição por dispositivo (Pie Chart)
 */
function DeviceChart() {
    const { data, loading } = useFetchData("dispositivos", { dias: 30 })

    if (loading) return <ChartSkeleton title="Dispositivos" />
    if (!data) return null

    const total = (data.desktop || 0) + (data.mobile || 0) + (data.tablet || 0)
    const pieData = Object.entries(data)
        .filter(([key]) => ["desktop", "mobile", "tablet"].includes(key))
        .map(([key, value]) => ({
            name: DEVICE_LABELS[key],
            value: value || 0,
            key,
            percentage: total > 0 ? ((value / total) * 100).toFixed(1) : 0,
        }))
        .filter((d) => d.value > 0)

    if (pieData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardDescription className="flex items-center gap-1">
                        <Monitor className="size-4" /> Dispositivos
                    </CardDescription>
                    <CardTitle className="text-lg">Sem dados</CardTitle>
                </CardHeader>
            </Card>
        )
    }

    const chartConfig = {}
    pieData.forEach((d) => {
        chartConfig[d.key] = { label: d.name, color: DEVICE_COLORS[d.key] }
    })

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                    <Monitor className="size-4" /> Dispositivos (últimos 30 dias)
                </CardDescription>
                <CardTitle className="text-lg">Distribuição por Dispositivo</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer config={chartConfig} className="mx-auto h-[260px] w-full max-w-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                            >
                                {pieData.map((entry) => (
                                    <Cell key={entry.key} fill={DEVICE_COLORS[entry.key]} stroke="none" />
                                ))}
                            </Pie>
                            <Legend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <div className="grid grid-cols-3 gap-2 mt-4">
                    {pieData.map((d) => (
                        <div key={d.key} className="flex flex-col items-center gap-1 text-center">
                            <DeviceIcon type={d.key} className="size-5 text-muted-foreground" />
                            <span className="text-sm font-medium">{d.value}</span>
                            <span className="text-xs text-muted-foreground">{d.percentage}%</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Gráfico de visualizações ao longo do tempo (Area Chart)
 */
function TimelineChart() {
    const [days, setDays] = useState(30)
    const { data, loading } = useFetchData("timeline", { dias: days })

    if (loading) return <ChartSkeleton title="Visualizações ao longo do tempo" wide />
    if (!data || data.length === 0) return null

    const chartConfig = {
        desktop: { label: "Desktop", color: DEVICE_COLORS.desktop },
        mobile: { label: "Mobile", color: DEVICE_COLORS.mobile },
        tablet: { label: "Tablet", color: DEVICE_COLORS.tablet },
    }

    const formatDate = (dateStr) => {
        const d = new Date(dateStr + "T00:00:00")
        return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
    }

    return (
        <Card className="col-span-1 lg:col-span-2 flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardDescription className="flex items-center gap-1">
                            <TrendingUp className="size-4" /> Tendência de Visualizações
                        </CardDescription>
                        <CardTitle className="text-lg mt-1">Visualizações ao Longo do Tempo</CardTitle>
                    </div>
                    <div className="flex gap-1">
                        {[7, 14, 30, 90].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${days === d
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                                    }`}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={DEVICE_COLORS.desktop} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={DEVICE_COLORS.desktop} stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={DEVICE_COLORS.mobile} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={DEVICE_COLORS.mobile} stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="fillTablet" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={DEVICE_COLORS.tablet} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={DEVICE_COLORS.tablet} stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                            <XAxis
                                dataKey="dia"
                                tickFormatter={formatDate}
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                minTickGap={40}
                            />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={30} />
                            <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                            <Area
                                type="monotone"
                                dataKey="desktop"
                                stackId="1"
                                stroke={DEVICE_COLORS.desktop}
                                fill="url(#fillDesktop)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="mobile"
                                stackId="1"
                                stroke={DEVICE_COLORS.mobile}
                                fill="url(#fillMobile)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="tablet"
                                stackId="1"
                                stroke={DEVICE_COLORS.tablet}
                                fill="url(#fillTablet)"
                                strokeWidth={2}
                            />
                            <Legend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

/**
 * Gráfico de distribuição por browser (Bar Chart horizontal)
 */
function BrowserChart() {
    const { data, loading } = useFetchData("browsers", { dias: 30 })

    if (loading) return <ChartSkeleton title="Browsers" />
    if (!data || data.length === 0) return null

    const chartConfig = {}
    data.forEach((d, i) => {
        chartConfig[d.browser] = { label: d.browser, color: BROWSER_COLORS[i % BROWSER_COLORS.length] }
    })

    const chartData = data.map((d, i) => ({
        ...d,
        fill: BROWSER_COLORS[i % BROWSER_COLORS.length],
    }))

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                    <Globe className="size-4" /> Browsers (últimos 30 dias)
                </CardDescription>
                <CardTitle className="text-lg">Distribuição por Browser</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                            <YAxis
                                type="category"
                                dataKey="browser"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11 }}
                                width={80}
                            />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Visualizações">
                                {chartData.map((entry, index) => (
                                    <Cell key={index} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

/**
 * Gráfico de distribuição por sistema operativo
 */
function SOChart() {
    const { data, loading } = useFetchData("so", { dias: 30 })

    if (loading) return <ChartSkeleton title="Sistemas Operativos" />
    if (!data || data.length === 0) return null

    const total = data.reduce((acc, d) => acc + d.total, 0)
    const pieData = data.map((d, i) => ({
        ...d,
        name: d.so,
        value: d.total,
        percentage: total > 0 ? ((d.total / total) * 100).toFixed(1) : 0,
        fill: SO_COLORS[i % SO_COLORS.length],
    }))

    const chartConfig = {}
    pieData.forEach((d, i) => {
        chartConfig[d.so] = { label: d.so, color: SO_COLORS[i % SO_COLORS.length] }
    })

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                    <Monitor className="size-4" /> Sistemas Operativos (últimos 30 dias)
                </CardDescription>
                <CardTitle className="text-lg">Distribuição por SO</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer config={chartConfig} className="mx-auto h-[260px] w-full max-w-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={index} fill={entry.fill} stroke="none" />
                                ))}
                            </Pie>
                            <Legend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

/**
 * Ranking de pontos mais visualizados (Bar Chart)
 */
function TopPontosChart() {
    const { data, loading } = useFetchData("top-pontos", { limit: 5, dias: 30 })

    if (loading) return <ChartSkeleton title="Top Pontos" />
    if (!data || data.length === 0) return null

    const chartConfig = {
        total: { label: "Visualizações", color: "hsl(var(--chart-1))" },
    }

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                    <BarChart3 className="size-4" /> Ranking (últimos 30 dias)
                </CardDescription>
                <CardTitle className="text-lg">Top 5 Pontos Mais Vistos</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                            <YAxis
                                type="category"
                                dataKey="nome"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11 }}
                                width={100}
                            />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="Visualizações" />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

function AccessHistoryCard() {
    const { data, loading } = useFetchData("historico", { limit: 12, dias: 30 })

    if (loading) return <ChartSkeleton title="Histórico de acessos" wide />
    if (!data || data.length === 0) return null

    return (
        <Card className="col-span-1 lg:col-span-2 flex flex-col">
            <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                    <History className="size-4" /> Histórico recente (últimos 30 dias)
                </CardDescription>
                <CardTitle className="text-lg">Dispositivos e Hora de Acesso</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="overflow-hidden rounded-xl border border-border">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_110px_120px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Acesso</span>
                        <span>Dispositivo</span>
                        <span>Hora</span>
                    </div>
                    <div className="divide-y divide-border">
                        {data.map((entry) => (
                            <div
                                key={entry.id_visualizacao}
                                className="grid grid-cols-[minmax(0,1.6fr)_110px_120px] gap-3 px-4 py-3 text-sm"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 font-medium text-foreground">
                                        {entry.tipo === "ponto" ? <MapPin className="size-4 shrink-0" /> : <Route className="size-4 shrink-0" />}
                                        <span className="truncate">{entry.referencia_nome}</span>
                                    </div>
                                    <div className="mt-1 truncate text-xs text-muted-foreground">
                                        {entry.browser} · {entry.sistema_operativo}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <DeviceIcon type={entry.dispositivo} className="size-4 shrink-0" />
                                    <span className="capitalize">{DEVICE_LABELS[entry.dispositivo] || entry.dispositivo}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock3 className="size-4 shrink-0" />
                                    <span>{formatAccessTime(entry.data_hora)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Skeleton de loading
 */
function ChartSkeleton({ title, wide = false }) {
    return (
        <Card className={`flex flex-col ${wide ? "col-span-1 lg:col-span-2" : ""}`}>
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center min-h-[250px]">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="h-24 w-24 bg-muted rounded-full" />
                    <div className="h-3 w-20 bg-muted rounded" />
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Componente principal — todos os gráficos da dashboard
 */
export default function DashboardCharts() {
    return (
        <div className="space-y-6">
            {/* Timeline — ocupa toda a largura */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TimelineChart />
            </div>

            {/* Gráficos de distribuição — grid 2×2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DeviceChart />
                <BrowserChart />
                <SOChart />
                <TopPontosChart />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AccessHistoryCard />
            </div>
        </div>
    )
}
