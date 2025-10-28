"use client"

import { BN } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import type { PublicKeyInitData } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getOracleProgram } from '@/lib/oracleProgram'

const PRICE_DECIMALS = 6

const toBn = (value?: BN | number | string | { toNumber?: () => number; toString?: () => string } | null): BN | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof BN) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    return new BN(Math.trunc(value))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    try {
      return new BN(trimmed)
    } catch {
      return null
    }
  }

  if (typeof value === 'object') {
    try {
      if ('toNumber' in value && typeof value.toNumber === 'function') {
        const numeric = value.toNumber()
        if (Number.isFinite(numeric)) {
          return new BN(Math.trunc(numeric))
        }
      }
      if ('toString' in value && typeof value.toString === 'function') {
        const str = value.toString()
        if (str) {
          return new BN(str)
        }
      }
    } catch {
      return null
    }
  }

  return null
}

const bnToDecimalString = (
  value?: BN | number | string | { toNumber?: () => number; toString?: () => string } | null,
  decimals = PRICE_DECIMALS,
) => {
  const bnValue = toBn(value)
  if (!bnValue) {
    return '—'
  }
  const negative = bnValue.isNeg()
  const base = negative ? bnValue.neg() : bnValue
  const scale = new BN(10).pow(new BN(decimals))
  const whole = base.div(scale)
  const fraction = base.mod(scale).toString().padStart(decimals, '0')
  const trimmedFraction = fraction.replace(/0+$/, '')
  const fractionPart = trimmedFraction.length > 0 ? `.${trimmedFraction}` : ''
  return `${negative ? '-' : ''}${whole.toString()}${fractionPart}`
}

const bnToFloat = (
  value?: BN | number | string | { toNumber?: () => number; toString?: () => string } | null,
  decimals = PRICE_DECIMALS,
) => {
  const decimalString = bnToDecimalString(value, decimals)
  if (decimalString === '—') {
    return 0
  }
  const numeric = Number(decimalString)
  return Number.isFinite(numeric) ? numeric : 0
}

const formatTimestamp = (value?: BN | number | string | { toNumber?: () => number; toString?: () => string } | null) => {
  const bnValue = toBn(value)
  if (!bnValue) {
    return '—'
  }
  const timestamp = bnValue.toNumber()
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '—'
  }
  return new Date(timestamp * 1000).toLocaleString()
}

export interface PriceHistoryPoint {
  timestamp: number
  aggregated: number
  latest: number
}

export interface GovernanceTarget {
  target: string
  blacklistVotes: string
  whitelistVotes: string
  isBlacklisted: boolean
}

export interface OracleSummary {
  id: string
  address: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'maintenance'
  category: string
  updateFrequency: string
  accuracy: string
  lastSubmissionTime: string
  lastTimestamp: string
  lastUpdate: string
  aggregatedValue: string
  latestValue: string
}

export interface OracleDetail extends OracleSummary {
  authority: string
  weightMint: string
  totalDepositedTokens: string
  aggregatedWeight: string
  rewardBps: number
  halfLifeSeconds: number
  quorum: number
  depositLockingPeriod: number
  withdrawalLockingPeriod: number
  alpha: number
  priceHistory: PriceHistoryPoint[]
  targets: GovernanceTarget[]
}

type AccountWithPublicKey<T> = {
  publicKey: PublicKey
  account: T
}

type PriceHistoryRecord = {
  timestamp?: BN | number | null
  aggregatedValue?: BN | number | null
  latestValue?: BN | number | null
}

type GovernanceTargetRaw = {
  target?: PublicKey | string | null
  blacklistVotes?: BN | number | string | null
  whitelistVotes?: BN | number | string | null
  isBlacklisted?: boolean | null
}

type OracleAccountRaw = {
  name?: string | null
  description?: string | null
  authority?: PublicKey | string | null
  weightMint?: PublicKey | string | null
  totalDepositedTokens?: BN | number | string | null
  aggregatedWeight?: BN | number | string | null
  rewardBps?: BN | number | null
  halfLifeSeconds?: BN | number | null
  quorum?: BN | number | null
  depositLockingPeriod?: BN | number | null
  withdrawalLockingPeriod?: BN | number | null
  alpha?: BN | number | null
  priceHistory?: PriceHistoryRecord[] | null
  targets?: GovernanceTargetRaw[] | null
  lastSubmissionTime?: BN | number | null
  lastTimestamp?: BN | number | null
  aggregatedValue?: BN | number | null
  latestValue?: BN | number | null
}

const toOracleDetail = (accountWithPk: AccountWithPublicKey<OracleAccountRaw>): OracleDetail => {
  const { publicKey, account } = accountWithPk

  const resolvePubkey = (value: unknown): string => {
    if (!value) return 'Unknown'
    if (typeof value === 'string') return value
    if (value instanceof PublicKey) return value.toBase58()
    if (
      typeof value === 'object' &&
      value !== null &&
      'toBase58' in value &&
      typeof (value as { toBase58?: () => string }).toBase58 === 'function'
    ) {
      return (value as { toBase58: () => string }).toBase58()
    }
    try {
      return new PublicKey(value as PublicKeyInitData).toBase58()
    } catch {
      return 'Unknown'
    }
  }

  const priceHistoryRecords = Array.isArray(account.priceHistory) ? account.priceHistory : []
  const priceHistory: PriceHistoryPoint[] = priceHistoryRecords.map((record) => ({
    timestamp: record?.timestamp instanceof BN ? record.timestamp.toNumber() : Number(record?.timestamp ?? 0),
    aggregated: bnToFloat(record?.aggregatedValue ?? null),
    latest: bnToFloat(record?.latestValue ?? null),
  }))

  const targetRecords = Array.isArray(account.targets) ? account.targets : []
  const targets: GovernanceTarget[] = targetRecords.map((target) => ({
    target: resolvePubkey(target?.target ?? null),
    blacklistVotes: target?.blacklistVotes?.toString?.() ?? '0',
    whitelistVotes: target?.whitelistVotes?.toString?.() ?? '0',
    isBlacklisted: Boolean(target?.isBlacklisted),
  }))

  const halfLifeSeconds = account.halfLifeSeconds instanceof BN ? account.halfLifeSeconds.toNumber() : Number(account.halfLifeSeconds ?? 0)

  return {
    id: publicKey.toBase58(),
    address: publicKey.toBase58(),
    name: account.name ?? 'Unnamed Oracle',
    description: account.description ?? 'No description provided',
    status: 'active',
    category: 'Price Feed',
    updateFrequency: halfLifeSeconds > 0 ? `${halfLifeSeconds}s` : 'manual',
    accuracy: 'On-chain verified',
    lastSubmissionTime: formatTimestamp(account.lastSubmissionTime ?? null),
    lastTimestamp: formatTimestamp(account.lastTimestamp ?? null),
    lastUpdate: formatTimestamp(account.lastTimestamp ?? null),
    aggregatedValue: bnToDecimalString(account.aggregatedValue ?? null),
    latestValue: bnToDecimalString(account.latestValue ?? null),
    authority: resolvePubkey(account.authority),
    weightMint: resolvePubkey(account.weightMint),
    totalDepositedTokens: account.totalDepositedTokens?.toString?.() ?? '0',
    aggregatedWeight: account.aggregatedWeight?.toString?.() ?? '0',
    rewardBps: account.rewardBps instanceof BN ? account.rewardBps.toNumber() : Number(account.rewardBps ?? 0),
    halfLifeSeconds,
    quorum: account.quorum instanceof BN ? account.quorum.toNumber() : Number(account.quorum ?? 0),
    depositLockingPeriod:
      account.depositLockingPeriod instanceof BN ? account.depositLockingPeriod.toNumber() : Number(account.depositLockingPeriod ?? 0),
    withdrawalLockingPeriod:
      account.withdrawalLockingPeriod instanceof BN ? account.withdrawalLockingPeriod.toNumber() : Number(account.withdrawalLockingPeriod ?? 0),
    alpha: account.alpha instanceof BN ? account.alpha.toNumber() : Number(account.alpha ?? 0),
    priceHistory,
    targets,
  }
}

const toOracleSummary = (detail: OracleDetail): OracleSummary => ({
  id: detail.id,
  address: detail.address,
  name: detail.name,
  description: detail.description,
  status: detail.status,
  category: detail.category,
  updateFrequency: detail.updateFrequency,
  accuracy: detail.accuracy,
  lastSubmissionTime: detail.lastSubmissionTime,
  lastTimestamp: detail.lastTimestamp,
  lastUpdate: detail.lastUpdate,
  aggregatedValue: detail.aggregatedValue,
  latestValue: detail.latestValue,
})

export function useOracles() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const program = useMemo(() => getOracleProgram(connection, wallet.connected ? wallet : null), [connection, wallet])

  const [oracles, setOracles] = useState<OracleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOracles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const accounts = await program.account.oracleState.all()
      const details = accounts.map(toOracleDetail).map(toOracleSummary)
      setOracles(details)
    } catch (err) {
      console.error('Failed to fetch oracles', err)
      setError('Failed to fetch oracles from the Solana cluster')
      setOracles([])
    } finally {
      setLoading(false)
    }
  }, [program])

  useEffect(() => {
    void fetchOracles()
  }, [fetchOracles])

  return {
    oracles,
    loading,
    error,
    refetch: fetchOracles,
  }
}

export function useOracle(address?: string) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const program = useMemo(() => getOracleProgram(connection, wallet.connected ? wallet : null), [connection, wallet])

  const [oracle, setOracle] = useState<OracleDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(address))
  const [error, setError] = useState<string | null>(null)

  const fetchOracle = useCallback(async () => {
    if (!address) {
      setOracle(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const publicKey = new PublicKey(address)
      const account = await program.account.oracleState.fetch(publicKey)
      setOracle(toOracleDetail({ publicKey, account }))
    } catch (err) {
      console.error('Failed to fetch oracle', err)
      setError('Unable to fetch oracle account data')
      setOracle(null)
    } finally {
      setLoading(false)
    }
  }, [address, program])

  useEffect(() => {
    void fetchOracle()
  }, [fetchOracle])

  return {
    oracle,
    loading,
    error,
    refetch: fetchOracle,
  }
}
