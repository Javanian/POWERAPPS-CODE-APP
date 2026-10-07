import type { ListKendaraanRead } from "@/generated/models/ListKendaraanModel"
import type { ListDriverRead } from "@/generated/models/ListDriverModel"
import type { DATAKILOMETERMOBILRead } from "@/generated/models/DATAKILOMETERMOBILModel"

export type Vehicle = ListKendaraanRead
export type Driver = ListDriverRead
export type KilometerRecord = DATAKILOMETERMOBILRead

export interface KilometerFormData {
  namaDriver: string
  nomorPolisi: string
  mobil: string
  tanggalBerangkat: string
  tanggalKembali: string
  kilometerBerangkat: string
  kilometerKembali: string
}

export interface KilometerEditData {
  tanggalKembali: string
  kilometerKembali: string
}
