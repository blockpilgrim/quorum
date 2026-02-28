import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function App() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-5xl font-bold tracking-tight">
            Cortex
          </h1>
          <p className="text-muted-foreground text-lg">
            Unified Tri-Model AI Workspace
          </p>
        </div>

        <div className="grid w-full max-w-lg grid-cols-3 gap-4">
          <div className="border-border bg-card flex flex-col items-center gap-2 rounded-lg border p-4">
            <div className="text-card-foreground text-sm font-medium">
              Claude
            </div>
            <div className="bg-chart-1 h-2 w-2 rounded-full" />
          </div>
          <div className="border-border bg-card flex flex-col items-center gap-2 rounded-lg border p-4">
            <div className="text-card-foreground text-sm font-medium">
              ChatGPT
            </div>
            <div className="bg-chart-2 h-2 w-2 rounded-full" />
          </div>
          <div className="border-border bg-card flex flex-col items-center gap-2 rounded-lg border p-4">
            <div className="text-card-foreground text-sm font-medium">
              Gemini
            </div>
            <div className="bg-chart-3 h-2 w-2 rounded-full" />
          </div>
        </div>

        <div className="flex w-full max-w-lg gap-2">
          <Input
            placeholder="Ask all three models..."
            disabled
            className="flex-1"
          />
          <Button disabled>Send</Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Phase 1 scaffold complete. Dev environment ready.
        </p>
      </div>
    </div>
  )
}

export default App
