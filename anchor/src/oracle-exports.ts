// Here we export some useful types and functions for interacting with the Oracle Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import OracleIDL from './idl/oracle.json'
import type { Oracle } from './types/oracle'

// Re-export the generated IDL and type
export { Oracle, OracleIDL }

// The programId is imported from the program IDL.
export const ORACLE_PROGRAM_ID = new PublicKey(OracleIDL.address)

// This is a helper function to get the Oracle Anchor program.
export function getOracleProgram(provider: AnchorProvider, address?: PublicKey): Program<Oracle> {
  return new Program({ ...OracleIDL, address: address ? address.toBase58() : OracleIDL.address } as Oracle, provider)
}

// This is a helper function to get the program ID for the Oracle program depending on the cluster.
export function getOracleProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
      return new PublicKey('9oPLPE3PC9ok7T8UL9ZMfrNyPkhtaHh1mM9wFk2fWEVJ')
    case 'testnet':
    case 'mainnet-beta':
    default:
      return ORACLE_PROGRAM_ID
  }
}
