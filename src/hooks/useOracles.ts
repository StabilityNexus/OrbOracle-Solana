"use client"

import { BN } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getOracleProgram } from '@/lib/oracleProgram'

const PRICE_DECIMALS = 6

const bnToDecimalString = (value?: BN | null, decimals = PRICE_DECIMALS) => {
  if (!value) {
    return '—'
  }
  const negative = value.isNeg()
  const base = negative ? value.neg() : value
  const scale = new BN(10).pow(new BN(decimals))
  const whole = base.div(scale)
  const fraction = base.mod(scale).toString().padStart(decimals, '0')
  const trimmedFraction = fraction.replace(/0+$/, '')
  const fractionPart = trimmedFraction.length > 0 ? `.${trimmedFraction}` : ''
  return `${negative ? '-' : ''}${whole.toString()}${fractionPart}`
}

const bnToFloat = (value?: BN | null, decimals = PRICE_DECIMALS) => {
  const decimalString = bnToDecimalString(value, decimals)
  if (decimalString === '—') {
    return 0
  }
  const numeric = Number(decimalString)
  return Number.isFinite(numeric) ? numeric : 0
}

const formatTimestamp = (value?: BN | null) => {
  if (!value) {
    return '—'
  }
  const timestamp = value.toNumber()
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

const toOracleDetail = (accountWithPk: AccountWithPublicKey<any>): OracleDetail => {
  const { publicKey, account } = accountWithPk

  const resolvePubkey = (value: any): string => {
    if (!value) return 'Unknown'
    if (typeof value === 'string') return value
    if (value?.toBase58) return value.toBase58()
    return new PublicKey(value).toBase58()
  }

  const priceHistory: PriceHistoryPoint[] = (account.priceHistory ?? []).map((record: any) => ({
    timestamp: record.timestamp instanceof BN ? record.timestamp.toNumber() : Number(record.timestamp ?? 0),
    aggregated: bnToFloat(record.aggregatedValue ?? null),
    latest: bnToFloat(record.latestValue ?? null),
  }))

  const targets: GovernanceTarget[] = (account.targets ?? []).map((target: any) => ({
    target: resolvePubkey(target.target),
    blacklistVotes: target.blacklistVotes?.toString?.() ?? '0',
    whitelistVotes: target.whitelistVotes?.toString?.() ?? '0',
    isBlacklisted: Boolean(target.isBlacklisted),
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
  const program = useMemo(() => getOracleProgram(connection, wallet.connected ? wallet : null), [connection, wallet.connected, wallet.publicKey])

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
  const program = useMemo(() => getOracleProgram(connection, wallet.connected ? wallet : null), [connection, wallet.connected, wallet.publicKey])

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
