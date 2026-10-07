const defaultTimeoutMs = 15000

function readErrorField(error: Record<string, unknown>, field: string) {
  const value = error[field]

  return typeof value === 'string' && value.trim() ? value : null
}

export function withPowerAppsTimeout<T>(promise: Promise<T>, timeoutMs = defaultTimeoutMs) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Power Apps request timeout. Jalankan melalui npx power-apps run untuk test connector.'))
    }, timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

export function getPowerAppsOperationErrorDetail(error: unknown) {
  if (!error) {
    return 'Unknown error (empty response)'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>
    const directMessage = readErrorField(errorRecord, 'message')
    const status = readErrorField(errorRecord, 'status')
    const requestId = readErrorField(errorRecord, 'requestId')
    const nestedError = errorRecord.error
    const nestedMessage =
      typeof nestedError === 'object' && nestedError
        ? readErrorField(nestedError as Record<string, unknown>, 'message')
        : null
    const detail = [directMessage ?? nestedMessage, status ? `status ${status}` : null, requestId ? `requestId ${requestId}` : null]
      .filter(Boolean)
      .join(' | ')

    if (detail) {
      return detail
    }

    try {
      const serialized = JSON.stringify(error)

      if (serialized && serialized !== '{}') {
        return serialized
      }
    } catch {
      return Object.prototype.toString.call(error)
    }
  }

  return 'Unknown error'
}

export function getPowerAppsErrorMessage(error: unknown, context: string) {
  if (error instanceof Error && error.message) {
    return `${context}: ${error.message}`
  }

  if (typeof error === 'string' && error.trim()) {
    return `${context}: ${error}`
  }

  return `${context}: ${getPowerAppsOperationErrorDetail(error)}`
}
