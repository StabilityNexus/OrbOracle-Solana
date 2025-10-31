import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Navigation } from "@/components/navigation"
import { ArrowRight, CheckCircle2, Database, Shield, Sparkles, Zap } from "lucide-react"
import Orb from "@/components/Orb"

export default function HomePage() {
  const differentiators = [
    {
      title: "Deterministic Latency",
      description:
        "Sub-second finality across Solana, Ethereum, and cross-chain relays keeps on-chain logic perfectly in sync.",
      icon: Zap,
    },
    {
      title: "Cryptographic Trust",
      description:
        "Multi-signature attestation pipelines, signed payloads, and slashable operators guarantee tamper-proof delivery.",
      icon: Shield,
    },
    {
      title: "Universal Data Fabric",
      description:
        "Ingest price feeds, rates, weather, IoT, and enterprise systems through a single GraphQL and gRPC interface.",
      icon: Database,
    },
    {
      title: "Programmable Automation",
      description:
        "Compose fallbacks, thresholds, and circuit breakers with OrbOracle scripting primitives to harden critical flows.",
      icon: Sparkles,
    },
  ]

  const deliveryHighlights = [
    "Rust and TypeScript SDKs with generated account types and schema validation.",
    "Deterministic failover routes with notarized audit trails for every data hop.",
    "Real-time observability, incident webhooks, and configurable alert channels.",
  ]

  return (
    <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={{ fontStyle: 'oblique 12deg' }}>
      {/* <SplashCursor /> */}
      <Navigation />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div style={{ 
            width: '100vw', 
            height: '100vh', 
            position: 'absolute', 
            top: '0', 
            left: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ 
              width: 'min(90vw, 90vh)', 
              height: 'min(90vw, 90vh)', 
              maxWidth: '800px',
              maxHeight: '800px'
            }}>
              <Orb
                hoverIntensity={1.7}
                rotateOnHover={true}
                hue={300}
                forceHoverState={false}
              />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 text-center z-10 relative">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-medium mb-8 text-balance tracking-wide" style={{ fontStyle: 'oblique 15deg' }}>
              Orb Oracle: 
              <div><span className="text-primary">The Price of Everything</span></div>
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 bg-white text-black hover:bg-gray-100">
                <Link href="/create">
                  Get Started
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 bg-transparent border-gray-600 text-gray-400 hover:bg-gray-800">
                <Link href="/explorer">Explore Oracles</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="relative border-t border-border/40 bg-gradient-to-b from-background via-background/80 to-background/40 py-24">
        <div className="container mx-auto px-4">
          <div className="grid gap-16 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h2 className="text-3xl md:text-4xl font-medium tracking-wide" style={{ fontStyle: 'oblique 15deg' }}>
                Why choose OrbOracle?
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                OrbOracle is a battle-tested data plane engineered for teams that cannot afford downtime.
                Every packet is notarized, every validator is observable, and every update arrives on time.
              </p>

              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {differentiators.map(({ title, description, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-[0_18px_42px_-28px_rgba(135,96,255,0.4)] backdrop-blur"
                  >
                    <Icon className="mb-4 h-7 w-7 text-primary" />
                    <h3 className="text-xl font-semibold tracking-wide">{title}</h3>
                    <p className="mt-3 text-sm text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="border-t border-border/40 bg-primary/5 py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-medium tracking-wide" style={{ fontStyle: 'oblique 15deg' }}>
              Ready to build the future?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Spin up your first OrbOracle feed, stream it into Solana programs, automate failovers, and monitor everything from a single dashboard.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/create">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-8 bg-transparent border-border text-foreground hover:bg-card/60"
              >
                <Link href="/explorer">Browse live feeds</Link>
              </Button>
            </div>

            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Join engineers shipping on Solana, Ethereum, Sui, Base &amp; more
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
