// Base64 adds about 33% to the payload; compress images before upload.

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

// The flow expects a full data URI and decodes it with dataUriToBinary().
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

// Downscale previews to avoid decoding full-resolution photos for thumbnails.
export async function makePreviewObjectUrl(file: File, maxDim = 240): Promise<string> {
  const smallBlob = await compressImage(file, maxDim, 0.6)
  return URL.createObjectURL(smallBlob)
}
