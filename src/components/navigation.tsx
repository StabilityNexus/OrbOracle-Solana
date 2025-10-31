"use client"

import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import PillNav from "./PillNav"

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
)

const navItems = [
  { label: "Home", href: "/" },
  { label: "Explorer", href: "/explorer" },
  { label: "Create", href: "/create" },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-6">
      <div className="grid h-[64px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-white drop-shadow-sm transition-transform hover:scale-[1.02]"
        >
          <Image
            src="/OrbOracle.png"
            alt="OrbOracle logo"
            width={40}
            height={40}
            priority
          />
          <span className="text-xl font-semibold tracking-wide">OrbOracle</span>
        </Link>

        <div className="flex justify-center">
          <PillNav
            logo="/logo.svg"
            logoAlt="OracleNet Logo"
            items={navItems}
            activeHref={pathname}
            ease="power3.easeOut"
            baseColor="oklch(0.7 0.18 270)"
            pillColor="oklch(0.05 0 0)"
            hoveredPillTextColor="oklch(0.95 0 0)"
            pillTextColor="oklch(0.95 0 0)"
            className="!relative !top-0 !left-0 !w-auto"
          />
        </div>

        <div className="flex justify-end">
          <WalletMultiButton />
        </div>
      </div>
    </div>
  )
}
