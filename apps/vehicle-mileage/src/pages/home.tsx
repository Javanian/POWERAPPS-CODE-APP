import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Car, ClipboardList, Gauge, Route } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchKilometerRecords } from "@/services/kilometer-service"

const numberFormat = new Intl.NumberFormat("id-ID")

export default function HomePage() {
  // Shares the "kilometer-records" cache with the report page.
  const { data: records, isLoading } = useQuery({
    queryKey: ["kilometer-records"],
    queryFn: () => fetchKilometerRecords(),
    staleTime: 30 * 1000,
  })

  const stats = useMemo(() => {
    const rows = records ?? []
    const onTrip = rows.filter((row) => row.KilometerKembali == null).length
    const distance = rows.reduce((total, row) => {
      if (row.KilometerKembali == null || row.KilometerBerangkat == null) return total
      return total + Math.max(0, row.KilometerKembali - row.KilometerBerangkat)
    }, 0)
    return { trips: rows.length, onTrip, distance }
  }, [records])

  const statItems = [
    { label: "Perjalanan tercatat", value: numberFormat.format(stats.trips), icon: Route },
    { label: "Sedang di jalan", value: numberFormat.format(stats.onTrip), icon: Car },
    { label: "Total jarak", value: `${numberFormat.format(stats.distance)} km`, icon: Gauge },
  ]

  return (
    <div className="px-4 py-10 sm:px-6 sm:py-14 space-y-10">
      <section className="max-w-2xl space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Kendaraan operasional
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Catat kilometer kendaraan tanpa kertas.</h1>
        <p className="text-base text-muted-foreground">
          Driver mengisi kilometer saat berangkat dan kembali. Jarak dihitung otomatis dan laporan siap kapan saja.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Ringkasan">
        {statItems.map((item) => (
          <Card key={item.label} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex items-center gap-4 p-3 sm:p-5">
              <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
                <item.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground sm:text-sm">{item.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-20" />
                ) : (
                  <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{item.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Aksi">
        <ActionCard
          to="/input-km"
          icon={Gauge}
          title="Input kilometer"
          description="Isi data keberangkatan, lalu lengkapi kilometer saat kendaraan kembali."
          primary
        />
        <ActionCard
          to="/input-km?tab=report"
          icon={ClipboardList}
          title="Laporan perjalanan"
          description="Cari per driver, nomor polisi, atau mobil dan lihat kendaraan yang belum kembali."
        />
      </section>
    </div>
  )
}

function ActionCard({
  to,
  icon: Icon,
  title,
  description,
  primary = false,
}: {
  to: string
  icon: typeof Gauge
  title: string
  description: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "group flex items-start gap-4 rounded-xl bg-primary p-6 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          : "group flex items-start gap-4 rounded-xl border bg-card p-6 shadow-xs transition-colors hover:border-foreground/20"
      }
    >
      <span
        className={
          primary
            ? "grid size-10 shrink-0 place-items-center rounded-lg bg-white/15"
            : "grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"
        }
      >
        <Icon className="size-5" />
      </span>
      <span className="flex-1 space-y-1">
        <span className="block font-semibold">{title}</span>
        <span className={primary ? "block text-sm text-primary-foreground/80" : "block text-sm text-muted-foreground"}>
          {description}
        </span>
      </span>
      <ArrowRight className="mt-1 size-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
