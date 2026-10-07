import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Gauge } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils"

type LayoutProps = { showHeader?: boolean }

const navItems = [
  { to: "/", label: "Beranda", isActive: (path: string) => path === "/" },
  { to: "/input-km", label: "Input KM", isActive: (path: string, tab: string | null) => path === "/input-km" && tab !== "report" },
  { to: "/input-km?tab=report", label: "Laporan", isActive: (path: string, tab: string | null) => path === "/input-km" && tab === "report" },
]

export default function Layout({ showHeader = true }: LayoutProps) {
  const location = useLocation()
  const tab = new URLSearchParams(location.search).get("tab")

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {showHeader && (
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
            <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Gauge className="size-4" strokeWidth={2.2} />
              </span>
              <span className="hidden sm:inline">Vehicle Mileage</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm" aria-label="Navigasi utama">
              {navItems.map((item) => {
                const active = item.isActive(location.pathname, tab)
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium sm:px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      active && "bg-muted text-foreground",
                    )}
                  >
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
            <div className="ml-auto">
              <ModeToggle />
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 flex">
        <div className="flex-1 mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
