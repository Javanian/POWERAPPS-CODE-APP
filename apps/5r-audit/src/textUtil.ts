/**
 * Kolom SharePoint multi-line text (Note) mengembalikan rich-text HTML, mis.
 * `<div class="ExternalClass...">Balikpapan</div>`. Ambil teks bersihnya.
 */
export function plainText(value: unknown): string {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value)
  const trimmed = raw.trim()

  if (!trimmed || !trimmed.includes('<')) {
    return trimmed
  }

  try {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim()
  } catch {
    return trimmed.replace(/<[^>]+>/g, '').trim()
  }
}
