import { useNavigate } from "react-router-dom"
import { Car, Gauge, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="h-full grid place-items-center">
      <div className="w-full max-w-7xl px-4 sm:px-8 text-center flex flex-col items-center space-y-6">
        <div className="flex items-center justify-center">
          <Gauge className="h-24 w-24 text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl sm:text-5xl leading-tight tracking-tight">Kilometer Kendaraan</h1>
        <p className="text-muted-foreground max-w-lg text-sm sm:text-base">
          Aplikasi pencatatan kilometer kendaraan operasional
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/input-km")}>
            <CardHeader>
              <Gauge className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Input Kilometer</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Car className="mr-2 h-4 w-4" />
                Buka Form
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/input-km?tab=report")}>
            <CardHeader>
              <ClipboardList className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Laporan</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <ClipboardList className="mr-2 h-4 w-4" />
                Buka Laporan
              </Button>
            </CardContent>
          </Card>
        </div>
        <ModeToggle />
      </div>
    </div>
  )
}
