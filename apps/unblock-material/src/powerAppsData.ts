const defaultTimeoutMs = 12000;

export function withPowerAppsTimeout<T>(promise: Promise<T>, timeoutMs = defaultTimeoutMs) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Power Apps data bridge belum merespons. Jalankan dengan npx power-apps run untuk test data SharePoint."));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

export function getPowerAppsErrorMessage(error: unknown, context: string) {
  if (error instanceof Error && error.message) {
    return `${context}: ${error.message}`;
  }

  return `${context}. Pastikan aplikasi dijalankan melalui Power Apps local play.`;
}
