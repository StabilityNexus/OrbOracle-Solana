'use client'

import { ReactNode, useMemo } from 'react'
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  SolongWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { DEFAULT_CLUSTER, DEFAULT_COMMITMENT, RPC_ENDPOINT, WS_ENDPOINT } from '@/utils/cluster'

const mapClusterToNetwork = (cluster: typeof DEFAULT_CLUSTER): WalletAdapterNetwork => {
  switch (cluster) {
    case 'mainnet-beta':
      return WalletAdapterNetwork.Mainnet
    case 'testnet':
      return WalletAdapterNetwork.Testnet
    case 'devnet':
    case 'localnet':
    default:
      return WalletAdapterNetwork.Devnet
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_ENDPOINT, [])
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: mapClusterToNetwork(DEFAULT_CLUSTER) }),
      new SolongWalletAdapter(),
      new LedgerWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: DEFAULT_COMMITMENT, wsEndpoint: WS_ENDPOINT }}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
