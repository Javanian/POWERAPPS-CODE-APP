import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { useSearchParams } from "react-router-dom"
import {
  CalendarIcon, Plus, Loader2, Car,
  Search, Pencil, ListFilter, X, AlertCircle, CheckCircle2, Clock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import {
  fetchVehicles, fetchDrivers,
  createKilometerRecord, fetchKilometerRecords, updateKilometerRecord,
} from "@/services/kilometer-service"
import type { KilometerFormData, KilometerEditData, KilometerRecord } from "@/types/vehicle"

const INITIAL_FORM: KilometerFormData = {
  namaDriver: "",
  nomorPolisi: "",
  mobil: "",
  tanggalBerangkat: "",
  tanggalKembali: "",
  kilometerBerangkat: "",
  kilometerKembali: "",
}

const EMPTY_EDIT: KilometerEditData = {
  tanggalKembali: "",
  kilometerKembali: "",
}

function parseDatePart(dt?: string): string {
  if (!dt) return ""
  return dt.substring(0, 10)
}

function parseTimePart(dt?: string): string {
  if (!dt || !dt.includes("T")) return ""
  return dt.substring(11, 16)
}

function buildDateTime(date: string, time: string): string {
  if (!date) return ""
  if (!time) return `${date}T00:00:00`
  return `${date}T${time}:00`
}

const WIB_OFFSET_MINUTES = 7 * 60

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0")
}

function parseLocalDateTime(dateTime: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  const match = dateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  }
}

function formatWibDateTime(date: Date): string {
  const wibTime = new Date(date.getTime() + WIB_OFFSET_MINUTES * 60 * 1000)
  const day = padDatePart(wibTime.getUTCDate())
  const month = padDatePart(wibTime.getUTCMonth() + 1)
  const year = wibTime.getUTCFullYear()
  const hour = padDatePart(wibTime.getUTCHours())
  const minute = padDatePart(wibTime.getUTCMinutes())
  return `${day}/${month}/${year} ${hour}:${minute}`
}

function formatWibDateTimeInput(date: Date): string {
  const wibTime = new Date(date.getTime() + WIB_OFFSET_MINUTES * 60 * 1000)
  const year = wibTime.getUTCFullYear()
  const month = padDatePart(wibTime.getUTCMonth() + 1)
  const day = padDatePart(wibTime.getUTCDate())
  const hour = padDatePart(wibTime.getUTCHours())
  const minute = padDatePart(wibTime.getUTCMinutes())
  const second = padDatePart(wibTime.getUTCSeconds())
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

function toSharePointDateTime(dateTime: string): string {
  if (!dateTime) return ""
  const parts = parseLocalDateTime(dateTime)
  if (!parts) return dateTime
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute - WIB_OFFSET_MINUTES,
    parts.second
  )
  return new Date(utcTime).toISOString()
}

function toLocalDateTimeInput(dateStr?: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return formatWibDateTimeInput(date)
}

function toDateTimeMillis(dateStr?: string): number | null {
  if (!dateStr) return null
  const parts = parseLocalDateTime(dateStr)
  const time = parts
    ? Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute - WIB_OFFSET_MINUTES, parts.second)
    : new Date(dateStr).getTime()
  return Number.isNaN(time) ? null : time
}

function formatDateTimeDisplay(dateStr?: string): string {
  if (!dateStr) return "-"
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    return formatWibDateTime(date)
  } catch {
    return dateStr
  }
}

function calcDistance(awal?: number, akhir?: number): number | null {
  if (awal != null && akhir != null && akhir > awal) return akhir - awal
  return null
}

export default function KilometerFormPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  // The tab lives in the URL so header links and the browser back button switch it.
  const activeTab = searchParams.get("tab") === "report" ? "report" : "input"
  const setActiveTab = (tab: string) => setSearchParams(tab === "report" ? { tab: "report" } : {}, { replace: true })

  const [form, setForm] = useState<KilometerFormData>({ ...INITIAL_FORM })
  const [dateBerangkatOpen, setDateBerangkatOpen] = useState(false)
  const [dateKembaliOpen, setDateKembaliOpen] = useState(false)

  const [search, setSearch] = useState("")
  const [showPendingOnly, setShowPendingOnly] = useState(false)

  const [editRecord, setEditRecord] = useState<KilometerRecord | null>(null)
  const [editData, setEditData] = useState<KilometerEditData>({ ...EMPTY_EDIT })
  const [editDateOpen, setEditDateOpen] = useState(false)

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: fetchVehicles,
    staleTime: 10 * 60 * 1000,
  })

  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
    staleTime: 10 * 60 * 1000,
  })

  const { data: allRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["kilometer-records"],
    queryFn: () => fetchKilometerRecords(),
    staleTime: 30 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: createKilometerRecord,
    onSuccess: () => {
      toast.success("Data kilometer berhasil disimpan")
      queryClient.invalidateQueries({ queryKey: ["kilometer-records"] })
      setForm({ ...INITIAL_FORM })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan data")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<{ TanggalKembali: string; KilometerKembali: number }> }) =>
      updateKilometerRecord(id, changes),
    onSuccess: () => {
      toast.success("Data kilometer kembali berhasil diupdate")
      queryClient.invalidateQueries({ queryKey: ["kilometer-records"] })
      setEditRecord(null)
      setEditData({ ...EMPTY_EDIT })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Gagal mengupdate data")
    },
  })

  const totalKM = useMemo(() => {
    const awal = parseFloat(form.kilometerBerangkat)
    const akhir = parseFloat(form.kilometerKembali)
    return calcDistance(awal, akhir)
  }, [form.kilometerBerangkat, form.kilometerKembali])

  const isValid = useMemo(() => {
    if (!form.namaDriver.trim()) return false
    if (!form.nomorPolisi.trim()) return false
    if (!form.tanggalBerangkat) return false
    if (!form.kilometerBerangkat) return false
    const kmAwal = parseFloat(form.kilometerBerangkat)
    if (isNaN(kmAwal)) return false
    if (form.kilometerKembali) {
      const kmAkhir = parseFloat(form.kilometerKembali)
      if (isNaN(kmAkhir) || kmAkhir <= kmAwal) return false
    }
    if (form.tanggalKembali && form.tanggalKembali < form.tanggalBerangkat) return false
    return true
  }, [form])

  const editTotalKM = useMemo(() => {
    if (!editRecord) return null
    const akhir = parseFloat(editData.kilometerKembali)
    return calcDistance(editRecord.KilometerBerangkat, akhir)
  }, [editRecord, editData.kilometerKembali])

  const editIsValid = useMemo(() => {
    if (!editRecord) return false
    if (!editData.tanggalKembali) return false
    if (!editData.kilometerKembali) return false
    const kmAkhir = parseFloat(editData.kilometerKembali)
    if (isNaN(kmAkhir)) return false
    const kmAwal = editRecord.KilometerBerangkat ?? 0
    if (kmAkhir <= kmAwal) return false
    const tanggalBerangkat = toDateTimeMillis(editRecord.TanggalBerangkat)
    const tanggalKembali = toDateTimeMillis(editData.tanggalKembali)
    if (tanggalBerangkat != null && tanggalKembali != null && tanggalKembali < tanggalBerangkat) return false
    return true
  }, [editRecord, editData])

  const filteredRecords = useMemo(() => {
    if (!allRecords) return []
    let list = allRecords
    if (showPendingOnly) {
      list = list.filter((r) => r.KilometerKembali == null)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) =>
        (r.NamaDriver?.toLowerCase().includes(q)) ||
        (r.NomorPolisi?.toLowerCase().includes(q)) ||
        (r.Mobil?.toLowerCase().includes(q))
      )
    }
    return list
  }, [allRecords, search, showPendingOnly])

  const updateField = useCallback(<K extends keyof KilometerFormData>(key: K, value: KilometerFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || createMutation.isPending) return

    createMutation.mutate({
      Title: `${form.nomorPolisi.trim()} - ${format(new Date(form.tanggalBerangkat), "dd/MM/yyyy HH:mm")}`,
      NamaDriver: form.namaDriver.trim(),
      NomorPolisi: form.nomorPolisi.trim(),
      Mobil: form.mobil.trim() || undefined,
      TanggalBerangkat: toSharePointDateTime(form.tanggalBerangkat),
      TanggalKembali: form.tanggalKembali ? toSharePointDateTime(form.tanggalKembali) : undefined,
      KilometerBerangkat: parseFloat(form.kilometerBerangkat),
      KilometerKembali: form.kilometerKembali ? parseFloat(form.kilometerKembali) : undefined,
    })
  }

  const openEditDialog = (record: KilometerRecord) => {
    setEditRecord(record)
    setEditData({
      tanggalKembali: toLocalDateTimeInput(record.TanggalKembali),
      kilometerKembali: record.KilometerKembali?.toString() ?? "",
    })
    setEditDateOpen(false)
  }

  const handleEditSubmit = () => {
    if (!editRecord || !editIsValid || updateMutation.isPending) return
    updateMutation.mutate({
      id: editRecord.ID!.toString(),
      changes: {
        TanggalKembali: toSharePointDateTime(editData.tanggalKembali),
        KilometerKembali: parseFloat(editData.kilometerKembali),
      },
    })
  }

  return (
    <div className="px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {activeTab === "report" ? "Laporan perjalanan" : "Input kilometer"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeTab === "report"
            ? "Cari perjalanan dan lengkapi kilometer kendaraan yang belum kembali."
            : "Isi data keberangkatan sekarang, lalu lengkapi kilometer saat kendaraan kembali."}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>

        <TabsContent value="input" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Input Kilometer Kendaraan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="namaDriver">Nama Driver *</Label>
                    {driversLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={form.namaDriver}
                        onValueChange={(v) => updateField("namaDriver", v)}
                      >
                        <SelectTrigger id="namaDriver">
                          <SelectValue placeholder="Pilih atau ketik driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers?.map((d) => (
                            <SelectItem key={d.ID} value={d.nama_driver ?? d.Title ?? ""}>
                              {d.nama_driver ?? d.Title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Ketik nama driver..."
                      value={form.namaDriver}
                      onChange={(e) => updateField("namaDriver", e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nomorPolisi">Nomor Polisi *</Label>
                    {vehiclesLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={form.nomorPolisi}
                        onValueChange={(v) => {
                          updateField("nomorPolisi", v)
                          const vehicle = vehicles?.find((veh) => veh.nomor_polisi === v)
                          if (vehicle) {
                            updateField("mobil", vehicle.jenis_kendaraan ?? vehicle.Title ?? "")
                          }
                        }}
                      >
                        <SelectTrigger id="nomorPolisi">
                          <SelectValue placeholder="Pilih nomor polisi" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles?.map((v) => (
                            <SelectItem key={v.ID} value={v.nomor_polisi ?? ""}>
                              {v.nomor_polisi} {v.jenis_kendaraan ? `(${v.jenis_kendaraan})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Ketik nomor polisi..."
                      value={form.nomorPolisi}
                      onChange={(e) => updateField("nomorPolisi", e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobil">Mobil</Label>
                    <Input
                      id="mobil"
                      placeholder="Nama / jenis mobil"
                      value={form.mobil}
                      onChange={(e) => updateField("mobil", e.target.value)}
                    />
                  </div>

                  <div />
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Keberangkatan
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tanggal & Jam Berangkat *</Label>
                      <div className="flex gap-2">
                        <Popover open={dateBerangkatOpen} onOpenChange={setDateBerangkatOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1 justify-start text-left font-normal",
                                !parseDatePart(form.tanggalBerangkat) && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {parseDatePart(form.tanggalBerangkat)
                                ? format(new Date(form.tanggalBerangkat), "PPP", { locale: id })
                                : "Pilih tanggal"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.tanggalBerangkat ? new Date(form.tanggalBerangkat) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  updateField(
                                    "tanggalBerangkat",
                                    buildDateTime(format(date, "yyyy-MM-dd"), parseTimePart(form.tanggalBerangkat))
                                  )
                                  setDateBerangkatOpen(false)
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          className="w-[110px] shrink-0"
                          value={parseTimePart(form.tanggalBerangkat)}
                          onChange={(e) =>
                            updateField(
                              "tanggalBerangkat",
                              buildDateTime(parseDatePart(form.tanggalBerangkat), e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kmBerangkat">Kilometer Berangkat *</Label>
                      <Input
                        id="kmBerangkat"
                        type="number"
                        placeholder="0"
                        min={0}
                        value={form.kilometerBerangkat}
                        onChange={(e) => updateField("kilometerBerangkat", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Kepulangan (opsional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tanggal & Jam Kembali</Label>
                      <div className="flex gap-2">
                        <Popover open={dateKembaliOpen} onOpenChange={setDateKembaliOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1 justify-start text-left font-normal",
                                !parseDatePart(form.tanggalKembali) && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {parseDatePart(form.tanggalKembali)
                                ? format(new Date(form.tanggalKembali), "PPP", { locale: id })
                                : "Isi saat kembali"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.tanggalKembali ? new Date(form.tanggalKembali) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  updateField(
                                    "tanggalKembali",
                                    buildDateTime(format(date, "yyyy-MM-dd"), parseTimePart(form.tanggalKembali))
                                  )
                                  setDateKembaliOpen(false)
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          className="w-[110px] shrink-0"
                          value={parseTimePart(form.tanggalKembali)}
                          onChange={(e) =>
                            updateField(
                              "tanggalKembali",
                              buildDateTime(parseDatePart(form.tanggalKembali), e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kmKembali">Kilometer Kembali</Label>
                      <Input
                        id="kmKembali"
                        type="number"
                        placeholder="Isi saat kendaraan kembali"
                        min={0}
                        value={form.kilometerKembali}
                        onChange={(e) => updateField("kilometerKembali", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {totalKM !== null && (
                  <div className="rounded-lg bg-muted p-4 flex items-center justify-between">
                    <span className="text-sm font-medium">Total Jarak</span>
                    <span className="text-2xl font-bold tabular-nums">{totalKM.toLocaleString("id-ID")} km</span>
                  </div>
                )}

                {form.kilometerBerangkat && form.kilometerKembali && totalKM !== null && totalKM <= 0 && (
                  <p className="text-sm text-destructive">Kilometer kembali harus lebih besar dari kilometer berangkat</p>
                )}
                {form.tanggalBerangkat && form.tanggalKembali && form.tanggalKembali < form.tanggalBerangkat && (
                  <p className="text-sm text-destructive">Tanggal kembali tidak boleh sebelum tanggal berangkat</p>
                )}

                <Button type="submit" disabled={!isValid || createMutation.isPending} className="w-full">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Simpan Data Kilometer
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListFilter className="h-5 w-5" />
                Laporan Kilometer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari driver, nomor polisi, atau mobil..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant={showPendingOnly ? "default" : "outline"}
                  onClick={() => setShowPendingOnly(!showPendingOnly)}
                  className="shrink-0"
                >
                  {showPendingOnly && <X className="mr-2 h-4 w-4" />}
                  Belum Kembali
                </Button>
              </div>

              {recordsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredRecords.length > 0 ? (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap">Tgl Berangkat</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap">Tgl Kembali</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap">Driver</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap">No Polisi</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap">Mobil</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap text-right">KM Awal</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap text-right">KM Akhir</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap text-right">Total</th>
                          <th className="pb-2 font-medium text-muted-foreground whitespace-nowrap text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((r) => {
                          const kmAwal = r.KilometerBerangkat
                          const kmAkhir = r.KilometerKembali
                          const total = calcDistance(kmAwal, kmAkhir)
                          const isPending = kmAkhir == null
                          return (
                            <tr key={r.ID} className={cn("border-b last:border-0", isPending && "bg-amber-50 dark:bg-amber-950/20")}>
                              <td className="py-2 whitespace-nowrap">{formatDateTimeDisplay(r.TanggalBerangkat)}</td>
                              <td className="py-2 whitespace-nowrap">{formatDateTimeDisplay(r.TanggalKembali)}</td>
                              <td className="py-2 whitespace-nowrap">{r.NamaDriver ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{r.NomorPolisi ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{r.Mobil ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap text-right tabular-nums">{kmAwal?.toLocaleString("id-ID") ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap text-right tabular-nums">
                                {isPending ? <span className="text-muted-foreground italic text-xs">belum isi</span> : kmAkhir?.toLocaleString("id-ID")}
                              </td>
                              <td className="py-2 whitespace-nowrap text-right tabular-nums font-medium">
                                {total != null ? total.toLocaleString("id-ID") : "-"}
                              </td>
                              <td className="py-2 whitespace-nowrap text-center">
                                <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(r)} title={isPending ? "Isi kilometer kembali" : "Edit"}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {filteredRecords.map((r) => {
                      const kmAwal = r.KilometerBerangkat
                      const kmAkhir = r.KilometerKembali
                      const total = calcDistance(kmAwal, kmAkhir)
                      const isPending = kmAkhir == null
                      return (
                        <div
                          key={r.ID}
                          className={cn(
                            "rounded-lg border p-3 space-y-3",
                            isPending && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isPending ? (
                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{r.NamaDriver ?? "-"}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.NomorPolisi ?? "-"} {r.Mobil ? `\u00B7 ${r.Mobil}` : ""}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => openEditDialog(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Berangkat</span>
                              <p className="font-medium">{formatDateTimeDisplay(r.TanggalBerangkat)}</p>
                              <p className="tabular-nums">{kmAwal?.toLocaleString("id-ID") ?? "-"} km</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Kembali</span>
                              <p className="font-medium">{formatDateTimeDisplay(r.TanggalKembali)}</p>
                              {isPending ? (
                                <p className="text-muted-foreground italic">belum isi</p>
                              ) : (
                                <p className="tabular-nums">{kmAkhir?.toLocaleString("id-ID")} km</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t pt-2">
                            <span className="text-xs text-muted-foreground">Total Jarak</span>
                            <span className="text-sm font-bold tabular-nums">
                              {total != null ? `${total.toLocaleString("id-ID")} km` : "-"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {search || showPendingOnly ? "Tidak ada data yang cocok" : "Belum ada data kilometer"}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Menampilkan {filteredRecords.length} dari {allRecords?.length ?? 0} record
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editRecord !== null} onOpenChange={(open) => { if (!open) { setEditRecord(null); setEditData({ ...EMPTY_EDIT }) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Kilometer Kembali</DialogTitle>
            <DialogDescription>
              {editRecord && (
                <span>
                  {editRecord.NomorPolisi} - {editRecord.NamaDriver}
                  <br />
                  Berangkat: {formatDateTimeDisplay(editRecord.TanggalBerangkat)} | KM: {editRecord.KilometerBerangkat?.toLocaleString("id-ID")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tanggal & Jam Kembali *</Label>
              <div className="flex gap-2">
                <Popover open={editDateOpen} onOpenChange={setEditDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !parseDatePart(editData.tanggalKembali) && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      {parseDatePart(editData.tanggalKembali)
                        ? format(new Date(editData.tanggalKembali), "PPP", { locale: id })
                        : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editData.tanggalKembali ? new Date(editData.tanggalKembali) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setEditData((prev) => ({
                            ...prev,
                            tanggalKembali: buildDateTime(format(date, "yyyy-MM-dd"), parseTimePart(prev.tanggalKembali)),
                          }))
                          setEditDateOpen(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  className="w-[110px] shrink-0"
                  value={parseTimePart(editData.tanggalKembali)}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      tanggalKembali: buildDateTime(parseDatePart(prev.tanggalKembali), e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editKmKembali">Kilometer Kembali *</Label>
              <Input
                id="editKmKembali"
                type="number"
                placeholder="0"
                min={0}
                value={editData.kilometerKembali}
                onChange={(e) => setEditData((prev) => ({ ...prev, kilometerKembali: e.target.value }))}
              />
            </div>

            {editTotalKM !== null && (
              <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                <span className="text-sm font-medium">Total Jarak</span>
                <span className="text-xl font-bold tabular-nums">{editTotalKM.toLocaleString("id-ID")} km</span>
              </div>
            )}

            {editData.kilometerKembali && editTotalKM !== null && editTotalKM <= 0 && (
              <p className="text-sm text-destructive">Kilometer kembali harus lebih besar dari kilometer berangkat</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRecord(null); setEditData({ ...EMPTY_EDIT }) }}>
              Batal
            </Button>
            <Button onClick={handleEditSubmit} disabled={!editIsValid || updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
