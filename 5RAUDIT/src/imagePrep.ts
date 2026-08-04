// Persiapan gambar di sisi klien sebelum upload (lihat restapi.md §5).
// base64 menggembungkan payload ~33% — selalu kompres dulu.

const allowedTypes = ['image/png', 'image/jpeg'] // .jpg & .jpeg dua-duanya 'image/jpeg'
const maxSizeBytes = 20 * 1024 * 1024

export function validateImage(file: File) {
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Hanya PNG atau JPEG.')
  }

  if (file.size > maxSizeBytes) {
    throw new Error('File terlalu besar (maks 20 MB).')
  }
}

export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // PNG dipertahankan agar transparansi tidak hilang
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Kompresi gambar gagal'))), type, quality),
  )
}

/**
 * Kirim data URI UTUH ("data:image/jpeg;base64,...") ke flow, JANGAN buang
 * prefix. Di flow dipasangkan dengan `dataUriToBinary()` — bukan
 * `base64ToBinary()`. Alasannya mode gagal: kalau base64 mentah salah/rusak,
 * `base64ToBinary` tetap "sukses" dan menghasilkan file korup diam-diam;
 * `dataUriToBinary` gagal KERAS bila input bukan data URI valid → flow run
 * merah, ketahuan seketika. Bonus: content-type ikut terbawa, SharePoint tidak
 * menebak dari ekstensi.
 */
export async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function extensionForType(mimeType: string) {
  return mimeType === 'image/png' ? 'png' : 'jpg'
}

/**
 * Object URL preview KECIL (async). JANGAN pakai URL.createObjectURL(file)
 * langsung untuk <img> preview — itu memaksa browser men-decode foto full-res
 * (4–12MP) di main thread cuma untuk thumbnail → tablet "not responding".
 * Di sini gambar di-downscale dulu (createImageBitmap async) jadi ~240px.
 */
export async function makePreviewObjectUrl(file: File, maxDim = 240): Promise<string> {
  const smallBlob = await compressImage(file, maxDim, 0.6)
  return URL.createObjectURL(smallBlob)
}
