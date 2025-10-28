import { AnchorProvider, Program } from '@coral-xyz/anchor'
import type { Idl } from '@coral-xyz/anchor'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
import rawOracleIdl from '../../anchor/target/idl/oracle.json'
import type { Oracle } from '../../anchor/target/types/oracle'
import { DEFAULT_COMMITMENT } from '@/utils/cluster'

const ACCOUNT_SIZES: Record<string, number> = {
  OracleState: 8841,
  UserState: 5290,
}

type IdlTypeEntry = {
  name: string
  type: unknown
}

type IdlAccountEntry = {
  name: string
  type?: unknown
  size?: number
} & Record<string, unknown>

const enrichOracleIdl = (idl: Idl) => {
  const typeByName = new Map<string, unknown>()
  ;(idl.types ?? []).forEach((entry) => {
    const typedEntry = entry as Partial<IdlTypeEntry>
    if (typedEntry?.name && typedEntry.type) {
      typeByName.set(typedEntry.name, typedEntry.type)
    }
  })

  const patchedAccounts = (idl.accounts ?? []).map((account) => {
    const typedAccount = account as IdlAccountEntry
    if (!typedAccount.type && typedAccount.name) {
      const typeDef = typeByName.get(typedAccount.name)
      if (typeDef) {
        const size = ACCOUNT_SIZES[typedAccount.name]
        const typeWithSize = size ? { ...(typeDef as Record<string, unknown>), size } : typeDef
        return { ...typedAccount, type: typeWithSize, size: size ?? typedAccount.size }
      }
    }
    return typedAccount
  })

  return { ...idl, accounts: patchedAccounts }
}

const oracleIdl = enrichOracleIdl(rawOracleIdl as Idl)

export const ORACLE_PROGRAM_ID = new PublicKey(oracleIdl.address)

export type OracleProgram = Program<Oracle>

interface AnchorWallet {
  publicKey: PublicKey
  signTransaction: NonNullable<WalletContextState['signTransaction']>
  signAllTransactions: NonNullable<WalletContextState['signAllTransactions']>
}

const isAnchorWallet = (wallet: WalletContextState): wallet is WalletContextState & AnchorWallet => {
  return !!wallet?.publicKey && !!wallet?.signTransaction
}

const readonlyWallet: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new WalletNotConnectedError()
  },
  signAllTransactions: async () => {
    throw new WalletNotConnectedError()
  },
}

export const createAnchorProvider = (
  connection: Connection,
  wallet: WalletContextState | null,
) => {
  const anchorWallet = wallet && isAnchorWallet(wallet) ? wallet : readonlyWallet
  return new AnchorProvider(connection, anchorWallet, {
    commitment: DEFAULT_COMMITMENT,
  })
}

export const getOracleProgram = (
  connection: Connection,
  wallet: WalletContextState | null,
): OracleProgram => {
  const provider = createAnchorProvider(connection, wallet)
  return new Program(oracleIdl as Idl, provider) as OracleProgram
}

export const getReadOnlyOracleProgram = (connection: Connection): OracleProgram =>
  getOracleProgram(connection, null)

export const ORACLE_IDL = oracleIdl
