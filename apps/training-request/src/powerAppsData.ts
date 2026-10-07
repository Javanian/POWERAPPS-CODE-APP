const defaultTimeoutMs = 12000

export function withPowerAppsTimeout<T>(promise: Promise<T>, timeoutMs = defaultTimeoutMs) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(
        new Error(
          'koneksi Power Apps data bridge belum merespons. Gunakan npx power-apps run untuk test data SharePoint.',
        ),
      )
    }, timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

export function getPowerAppsErrorMessage(error: unknown, context: string) {
  if (error instanceof Error && error.message) {
    return `${context}: ${error.message}`
  }

  return `${context}. Jalankan melalui Power Apps local play jika koneksi belum tersedia di Vite biasa.`
}
