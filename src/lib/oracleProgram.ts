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

const enrichOracleIdl = (idl: Idl) => {
  const typeByName = new Map<string, any>()
  ;(idl.types ?? []).forEach((entry: any) => {
    typeByName.set(entry.name, entry.type)
  })

  const patchedAccounts = (idl.accounts ?? []).map((account: any) => {
    if (!account.type) {
      const typeDef = typeByName.get(account.name)
      if (typeDef) {
        const size = ACCOUNT_SIZES[account.name]
        const typeWithSize = size ? { ...typeDef, size } : typeDef
        return { ...account, type: typeWithSize, size: size ?? account.size }
      }
    }
    return account
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
