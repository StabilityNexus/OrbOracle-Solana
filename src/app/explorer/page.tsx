"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { OracleCard } from "@/components/oracle-card"
import { Input } from "@/components/ui/input"
import { useOracles } from "@/hooks/useOracles"
import { Loader2, Search } from "lucide-react"

const pageStyle = { fontStyle: "oblique 12deg" as const }

export default function ExplorerPage() {
  const [query, setQuery] = useState("")
  const { oracles, loading, error } = useOracles()

  const activeOracles = useMemo(
    () => oracles.filter((oracle) => oracle.status === "active"),
    [oracles],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return activeOracles
    const needle = query.toLowerCase()
    return activeOracles.filter((oracle) =>
      oracle.name.toLowerCase().includes(needle) || oracle.description.toLowerCase().includes(needle),
    )
  }, [activeOracles, query])

  const renderContent = () => {
    if (loading) {
      return (
        <StateMessage
          icon={<Loader2 className="h-12 w-12 animate-spin text-primary" />}
          title="Syncing on-chain data"
          description="Retrieving the latest oracle accounts from the cluster."
        />
      )
    }

    if (error) {
      return (
        <StateMessage
          icon={<Search className="h-10 w-10 text-destructive/70" />}
          title="Unable to load explorer"
          description={error}
          footer="Check your RPC connection and try again."
        />
      )
    }

    if (oracles.length === 0) {
      return (
        <StateMessage
          icon={<Search className="h-10 w-10 text-primary/60" />}
          title="No oracles yet"
          description="Deploy your first oracle to light up the dashboard."
          action={<Link href="/create" className="text-primary hover:text-primary/80 transition-colors">Create oracle</Link>}
        />
      )
    }

    if (filtered.length === 0) {
      return (
        <StateMessage
          icon={<Search className="h-10 w-10 text-muted-foreground" />}
          title="Nothing matches your search"
          description="Adjust your query or clear the filter."
          action={
            <button
              onClick={() => setQuery("")}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Clear search
            </button>
          }
        />
      )
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((oracle) => (
          <OracleCard key={oracle.id} oracle={oracle} />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={pageStyle}>
      <Navigation />

      <main className="container mx-auto px-6 pt-24 pb-16 space-y-12">
        <header className="flex flex-col gap-4 text-left max-w-3xl">
          <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Explorer</span>
          <h1
            className="text-4xl sm:text-5xl font-medium bg-gradient-to-r from-foreground via-primary to-primary/70 bg-clip-text text-transparent"
            style={{ fontStyle: "oblique 15deg" }}
          >
            Discover live Orb Oracles
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Browse active oracle instances and drill into their configuration, governance, and recent submissions.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Chip label="Total" value={oracles.length} />
            <Chip label="Active" value={activeOracles.length} highlight />
          </div>
        </header>

        <section className="max-w-md">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 focus-within:border-primary/40 focus-within:bg-card/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name or description"
              className="border-none bg-transparent px-0 py-0 text-sm focus-visible:ring-0"
            />
          </div>
        </section>

        <section>{renderContent()}</section>
      </main>
    </div>
  )
}

function StateMessage({
  icon,
  title,
  description,
  footer,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  footer?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/30 px-6 py-20 text-center backdrop-blur">
      {icon}
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {footer ? <p className="text-xs text-muted-foreground/80">{footer}</p> : null}
      {action}
    </div>
  )
}

function Chip({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
        highlight
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-card/30 text-muted-foreground"
      }`}
    >
      <span className="text-[10px] uppercase tracking-[0.3em]">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </span>
  )
}
