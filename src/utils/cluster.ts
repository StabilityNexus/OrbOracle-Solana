export type SolanaCluster = 'localnet' | 'devnet' | 'mainnet-beta' | 'testnet'

const KNOWN_CLUSTERS: SolanaCluster[] = ['localnet', 'devnet', 'mainnet-beta', 'testnet']
const FALLBACK_CLUSTER: SolanaCluster = 'devnet'

const resolveCluster = (value?: string | null): SolanaCluster => {
  if (!value) return FALLBACK_CLUSTER
  return (KNOWN_CLUSTERS.includes(value as SolanaCluster) ? value : FALLBACK_CLUSTER) as SolanaCluster
}

const envCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as string | undefined) ??
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as string | undefined)

export const DEFAULT_CLUSTER: SolanaCluster = resolveCluster(envCluster)

const DEFAULT_RPC_BY_CLUSTER: Record<SolanaCluster, string> = {
  localnet: 'http://127.0.0.1:8899',
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  testnet: 'https://api.testnet.solana.com',
}

const deriveWsEndpoint = (rpcUrl: string) => {
  if (rpcUrl.startsWith('https://')) return rpcUrl.replace('https://', 'wss://')
  if (rpcUrl.startsWith('http://')) return rpcUrl.replace('http://', 'ws://')
  return rpcUrl
}

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  DEFAULT_RPC_BY_CLUSTER[DEFAULT_CLUSTER]

export const WS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ??
  (DEFAULT_CLUSTER === 'localnet'
    ? 'ws://127.0.0.1:8900'
    : deriveWsEndpoint(RPC_ENDPOINT))

export const DEFAULT_COMMITMENT = 'confirmed' as const
