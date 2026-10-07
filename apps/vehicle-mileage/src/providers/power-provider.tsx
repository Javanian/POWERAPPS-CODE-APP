import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type PowerAppStatus = "initializing" | "ready" | "error"

type PowerAppContextType = {
  status: PowerAppStatus
  error: string | null
}

const PowerAppContext = createContext<PowerAppContextType>({
  status: "initializing",
  error: null,
})

export function usePowerApp() {
  return useContext(PowerAppContext)
}

type PowerProviderProps = {
  children: ReactNode
}

export function PowerProvider({ children }: PowerProviderProps) {
  const [status, setStatus] = useState<PowerAppStatus>("initializing")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        if (!cancelled) setStatus("initializing")

        const { getContext } = await import("@microsoft/power-apps/app")
        await getContext()

        if (!cancelled) {
          setStatus("ready")
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to initialize Power Apps"
          setError(message)
          setStatus("error")
          console.error("PowerProvider:", message)
        }
      }
    }

    initialize()

    return () => {
      cancelled = true
    }
  }, [])

  if (status === "error") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <h1 className="text-xl font-semibold">Gagal menginisialisasi Power Apps</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Pastikan PAC CLI sudah terautentikasi dan local dev server berjalan di port 3000.
          </p>
        </div>
      </div>
    )
  }

  if (status === "initializing") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Menghubungkan ke Power Platform...</p>
        </div>
      </div>
    )
  }

  return (
    <PowerAppContext.Provider value={{ status, error }}>
      {children}
    </PowerAppContext.Provider>
  )
}
