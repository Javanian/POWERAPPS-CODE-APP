import type { IGetAllOptions } from "@/generated/models/CommonModels"
import type { IOperationResult } from "@microsoft/power-apps/data"
import { DATAKILOMETERMOBILService } from "@/generated/services/DATAKILOMETERMOBILService"
import { ListKendaraanService } from "@/generated/services/ListKendaraanService"
import { ListDriverService } from "@/generated/services/ListDriverService"
import type { DATAKILOMETERMOBILRead, DATAKILOMETERMOBILWrite } from "@/generated/models/DATAKILOMETERMOBILModel"
import type { ListKendaraanRead } from "@/generated/models/ListKendaraanModel"
import type { ListDriverRead } from "@/generated/models/ListDriverModel"

function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    throw new Error("Operation failed")
  }
  return result.data
}

export async function fetchVehicles(): Promise<ListKendaraanRead[]> {
  const options: IGetAllOptions = {
    select: ["ID", "Title", "nomor_polisi", "jenis_kendaraan"],
    orderBy: ["Title asc"],
  }
  const result = await ListKendaraanService.getAll(options)
  return unwrap(result)
}

export async function fetchDrivers(): Promise<ListDriverRead[]> {
  const options: IGetAllOptions = {
    select: ["ID", "Title", "nama_driver"],
    orderBy: ["Title asc"],
  }
  const result = await ListDriverService.getAll(options)
  return unwrap(result)
}

export async function fetchKilometerRecords(options?: Partial<IGetAllOptions>): Promise<DATAKILOMETERMOBILRead[]> {
  const defaults: IGetAllOptions = {
    orderBy: ["Created desc"],
    top: 50,
  }
  const result = await DATAKILOMETERMOBILService.getAll({ ...defaults, ...options })
  return unwrap(result)
}

export async function createKilometerRecord(record: Omit<DATAKILOMETERMOBILWrite, "ID">): Promise<DATAKILOMETERMOBILRead> {
  const result = await DATAKILOMETERMOBILService.create(record)
  return unwrap(result)
}

export async function updateKilometerRecord(
  id: string,
  changes: Partial<Omit<DATAKILOMETERMOBILWrite, "ID">>
): Promise<DATAKILOMETERMOBILRead> {
  const result = await DATAKILOMETERMOBILService.update(id, changes)
  return unwrap(result)
}
