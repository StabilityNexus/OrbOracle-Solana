'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Check, ArrowRight, Info, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'
import { getOracleProgram, ORACLE_PROGRAM_ID } from '@/lib/oracleProgram'
import { DEFAULT_CLUSTER } from '@/utils/cluster'

const toBN = (value: string, fallback = 0): BN => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return new BN(fallback)
  }
  return new BN(Math.trunc(numeric))
}

const formatAddress = (value: string) => {
  if (!value) return '—'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error.length > 0) {
    return error
  }
  return fallback
}

interface DerivedAddresses {
  oracleState: string
  oracleVault: string
}

type OracleFormField =
  | 'name'
  | 'description'
  | 'weightToken'
  | 'rewardBps'
  | 'halfLifeSeconds'
  | 'quorumBps'
  | 'depositLock'
  | 'withdrawLock'
  | 'alpha'

export default function CreateOracleIntegrated() {
  const { toast } = useToast()
  const { connection } = useConnection()
  const wallet = useWallet()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weightToken, setWeightToken] = useState('')
  const [rewardBps, setRewardBps] = useState('1000')
  const [halfLifeSeconds, setHalfLifeSeconds] = useState('3600')
  const [quorumBps, setQuorumBps] = useState('2000')
  const [depositLock, setDepositLock] = useState('3600')
  const [withdrawLock, setWithdrawLock] = useState('3600')
  const [alpha, setAlpha] = useState('1')

  const [loading, setLoading] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [derived, setDerived] = useState<DerivedAddresses | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<OracleFormField, string>>>({})

  const program = useMemo(
    () => getOracleProgram(connection, wallet.connected ? wallet : null),
    [connection, wallet]
  )

  useEffect(() => {
    if (!wallet.publicKey || !weightToken) {
      setDerived(null)
      return
    }

    try {
      const weightMintKey = new PublicKey(weightToken)
      const [oracleState] = PublicKey.findProgramAddressSync(
        [Buffer.from('oracle'), wallet.publicKey.toBuffer(), weightMintKey.toBuffer()],
        ORACLE_PROGRAM_ID
      )
      const vault = getAssociatedTokenAddressSync(weightMintKey, oracleState, true)
      setDerived({ oracleState: oracleState.toBase58(), oracleVault: vault.toBase58() })
      setErrors((prev) => ({ ...prev, weightToken: undefined }))
    } catch {
      setDerived(null)
    }
  }, [wallet.publicKey, weightToken])

  const resetForm = useCallback(() => {
    setName('')
    setDescription('')
    setWeightToken('')
    setRewardBps('1000')
    setHalfLifeSeconds('3600')
    setQuorumBps('2000')
    setDepositLock('3600')
    setWithdrawLock('3600')
    setAlpha('1')
    setErrors({})
    setDerived(null)
    setSignature(null)
    setSubmitted(false)
  }, [])

  const validateInputs = useCallback(() => {
    const newErrors: Partial<Record<OracleFormField, string>> = {}

    if (!name.trim()) newErrors.name = 'Oracle name is required'
    if (!description.trim()) newErrors.description = 'Description is required'

    const mint = weightToken.trim()
    if (!mint) {
      newErrors.weightToken = 'Weight token mint is required'
    } else {
      try {
        // Valid base58 check
        new PublicKey(mint)
      } catch {
        newErrors.weightToken = 'Invalid mint address'
      }
    }

    const rewardNumber = Number(rewardBps)
    if (rewardBps.trim() === '') {
      newErrors.rewardBps = 'Reward is required'
    } else if (!Number.isFinite(rewardNumber) || rewardNumber < 0) {
      newErrors.rewardBps = 'Reward must be a non-negative number'
    }

    const halfLifeNumber = Number(halfLifeSeconds)
    if (halfLifeSeconds.trim() === '') {
      newErrors.halfLifeSeconds = 'Half-life is required'
    } else if (!Number.isFinite(halfLifeNumber) || halfLifeNumber < 0) {
      newErrors.halfLifeSeconds = 'Half-life must be a non-negative number'
    }

    const quorumNumber = Number(quorumBps)
    if (quorumBps.trim() === '') {
      newErrors.quorumBps = 'Quorum is required'
    } else if (!Number.isFinite(quorumNumber) || quorumNumber < 0 || quorumNumber > 10000) {
      newErrors.quorumBps = 'Quorum must be between 0 and 10000'
    }

    const depositNumber = Number(depositLock)
    if (depositLock.trim() === '') {
      newErrors.depositLock = 'Deposit lock period is required'
    } else if (!Number.isFinite(depositNumber) || depositNumber < 0) {
      newErrors.depositLock = 'Deposit lock must be a non-negative number'
    }

    const withdrawNumber = Number(withdrawLock)
    if (withdrawLock.trim() === '') {
      newErrors.withdrawLock = 'Withdrawal lock period is required'
    } else if (!Number.isFinite(withdrawNumber) || withdrawNumber < 0) {
      newErrors.withdrawLock = 'Withdrawal lock must be a non-negative number'
    }

    const alphaNumber = Number(alpha)
    if (alpha.trim() === '') {
      newErrors.alpha = 'Alpha is required'
    } else if (!Number.isFinite(alphaNumber) || alphaNumber < 0) {
      newErrors.alpha = 'Alpha must be a non-negative number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [alpha, depositLock, description, halfLifeSeconds, name, quorumBps, rewardBps, weightToken, withdrawLock])

  const onCopy = useCallback(
    async (value: string, key: string) => {
      if (!value) return

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(value)
          setCopiedKey(key)
          setTimeout(() => setCopiedKey(null), 1500)
          toast({
            title: 'Copied!',
            description: 'Value copied to clipboard.',
          })
        }
      } catch (error) {
        console.error('Copy failed', error)
      }
    },
    [toast]
  )

  const handleCreate = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast({
        title: 'Wallet required',
        description: 'Connect a Solana wallet to continue.',
        variant: 'destructive',
      })
      return
    }

    if (!validateInputs()) {
      toast({
        title: 'Fix errors before submitting',
        description: 'Please resolve highlighted fields and try again.',
        variant: 'destructive',
      })
      return
    }

    let weightMintKey: PublicKey
    try {
      weightMintKey = new PublicKey(weightToken)
      setErrors((prev) => ({ ...prev, weightToken: undefined }))
    } catch {
      setErrors((prev) => ({ ...prev, weightToken: 'Invalid mint address' }))
      toast({
        title: 'Invalid mint address',
        description: 'Provide a valid SPL token mint address.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      setSignature(null)
      setSubmitted(false)

      const mintAccount = await connection.getAccountInfo(weightMintKey)
      if (!mintAccount) {
        setErrors((prev) => ({ ...prev, weightToken: 'Weight token mint account not found on this cluster' }))
        throw new Error('Weight token mint account not found on this cluster')
      }
      if (!mintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
        throw new Error(
          'Weight token mint must be owned by the SPL Token program (Tokenkeg...). Please create the mint with the classic SPL Token program.'
        )
      }

      const [oracleState] = PublicKey.findProgramAddressSync(
        [Buffer.from('oracle'), wallet.publicKey.toBuffer(), weightMintKey.toBuffer()],
        ORACLE_PROGRAM_ID
      )
      const oracleVault = getAssociatedTokenAddressSync(weightMintKey, oracleState, true)

      const existingState = await connection.getAccountInfo(oracleState)
      if (existingState) {
        throw new Error(
          'An oracle already exists for this wallet and mint. Choose a different weighting mint or use the explorer to manage the existing oracle.'
        )
      }
      const existingVault = await connection.getAccountInfo(oracleVault)
      if (existingVault) {
        throw new Error(
          'The derived oracle vault ATA already exists. Please pick a new mint or remove the existing oracle before creating a new one.'
        )
      }

      const params = {
        name: name.trim(),
        description: description.trim(),
        rewardBps: toBN(rewardBps),
        halfLifeSeconds: toBN(halfLifeSeconds),
        quorum: toBN(quorumBps),
        depositLockingPeriod: toBN(depositLock),
        withdrawalLockingPeriod: toBN(withdrawLock),
        alpha: toBN(alpha),
      }

      const signatureResult = await program.methods
        .initialize(params)
        .accounts({
          payer: wallet.publicKey,
          authority: wallet.publicKey,
          weightMint: weightMintKey,
          oracleState,
          oracleVault,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        } as never)
        .rpc()

      setSignature(signatureResult)
      setSubmitted(true)
      toast({
        title: 'Oracle deployed',
        description: 'The oracle account has been initialized on-chain.',
      })
    } catch (error: unknown) {
      console.error('Oracle creation failed', error)
      toast({
        title: 'Failed to create oracle',
        description: getErrorMessage(error, 'Check your inputs and validator status.'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const cluster = DEFAULT_CLUSTER
  const explorerQuery = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  const explorerBase = 'https://explorer.solana.com'
  const hasExplorer = cluster !== 'localnet'

  const txExplorerUrl = signature && hasExplorer ? `${explorerBase}/tx/${signature}${explorerQuery}` : ''
  const oracleExplorerUrl =
    derived && hasExplorer ? `${explorerBase}/address/${derived.oracleState}${explorerQuery}` : ''

  const isConnected = wallet.connected && !!wallet.publicKey

  if (submitted) {
    return (
      <div
        className="relative min-h-screen flex items-center justify-center bg-background font-[oblique] tracking-wide"
        style={{ fontStyle: 'oblique 12deg' }}
      >
        <Card className="bg-background/95 backdrop-blur-sm border-primary/30 shadow-xl w-full max-w-3xl mx-auto">
          <CardContent className="space-y-6 py-10 px-8 text-center">
            <div className="space-y-3">
              <h2 className="text-3xl font-medium text-slate-100" style={{ fontStyle: 'oblique 15deg' }}>
                Oracle Created Successfully!
              </h2>
              <p className="text-base text-slate-200">
                Your oracle has been deployed on {cluster === 'mainnet-beta' ? 'mainnet-beta' : cluster}.
              </p>
            </div>

            {signature && (
              <div className="bg-slate-800/60 border border-primary/20 rounded-lg p-4 text-left font-mono text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-blue-300 font-medium">Transaction Signature</span>
                  <button
                    type="button"
                    onClick={() => onCopy(signature, 'signature')}
                    className="inline-flex items-center gap-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 px-2 py-1 rounded transition-colors"
                  >
                    {copiedKey === 'signature' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <p className="truncate text-slate-100 mt-2">{signature}</p>
              </div>
            )}

            {derived && (
              <div className="grid gap-3 sm:grid-cols-2 text-left">
                <div className="bg-slate-800/60 border border-primary/20 rounded-lg p-4 font-mono text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-blue-300 font-medium">Oracle PDA</span>
                    <button
                      type="button"
                      onClick={() => onCopy(derived.oracleState, 'oracleState')}
                      className="inline-flex items-center gap-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 px-2 py-1 rounded transition-colors"
                    >
                      {copiedKey === 'oracleState' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  </div>
                  <p className="truncate text-slate-100 mt-2">{derived.oracleState}</p>
                </div>
                <div className="bg-slate-800/60 border border-primary/20 rounded-lg p-4 font-mono text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-blue-300 font-medium">Oracle Vault ATA</span>
                    <button
                      type="button"
                      onClick={() => onCopy(derived.oracleVault, 'oracleVault')}
                      className="inline-flex items-center gap-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 px-2 py-1 rounded transition-colors"
                    >
                      {copiedKey === 'oracleVault' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  </div>
                  <p className="truncate text-slate-100 mt-2">{derived.oracleVault}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 justify-center items-center pt-4">
              {txExplorerUrl && (
                <Link href={txExplorerUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="h-10 px-4 border-blue-200 hover:bg-blue-600/10">
                    View Transaction
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              {oracleExplorerUrl && (
                <Link href={oracleExplorerUrl} target="_blank" rel="noreferrer">
                  <Button className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
                    View Oracle Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/explorer">
                <Button variant="outline" className="h-10 px-4 border-blue-200 hover:bg-blue-600/10">
                  Browse Oracles
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4 border-blue-200 hover:bg-blue-600/10"
                onClick={resetForm}
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="font-[oblique] tracking-wide text-slate-100" style={{ fontStyle: 'oblique 15deg' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleCreate()
        }}
        className="space-y-8"
      >
        <Card className="border-2 border-blue-200 bg-card shadow-sm max-w-4xl mx-auto">
          <CardHeader className="border-b border-blue-100">
            <CardTitle className="text-slate-100 text-xl">Oracle Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="name" className="text-slate-100 text-md">
                  Name *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('name')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('name')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'name' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Display name for your oracle
                  </div>
                )}
              </div>
              <Input
                id="name"
                placeholder="SOL / USD Oracle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.name ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="description" className="text-slate-100 text-md">
                  Description *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('description')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('description')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'description' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Detailed description of your oracle&apos;s purpose
                  </div>
                )}
              </div>
              <Textarea
                id="description"
                placeholder="Describe your oracle's purpose and data source"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.description ? 'border-red-500' : ''
                }`}
                rows={4}
                required
              />
              {errors.description && <p className="text-red-400 text-xs">{errors.description}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-card shadow-sm max-w-4xl mx-auto">
          <CardHeader className="border-b border-blue-100">
            <CardTitle className="text-xl text-slate-100">Oracle Parameters</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-1 md:col-span-2">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="weightToken" className="text-slate-100 text-md">
                  Weight Token Mint *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('weightToken')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('weightToken')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'weightToken' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    SPL token mint used to weight oracle participation
                  </div>
                )}
              </div>
              <Input
                id="weightToken"
                placeholder="Token mint address"
                value={weightToken}
                onChange={(e) => setWeightToken(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 font-mono border border-blue-100 ${
                  errors.weightToken ? 'border-red-500' : ''
                }`}
                required
              />
              {derived && (
                <p className="text-xs text-blue-200/80">
                  Oracle PDA {formatAddress(derived.oracleState)} · Vault {formatAddress(derived.oracleVault)}
                </p>
              )}
              {errors.weightToken && <p className="text-red-400 text-xs">{errors.weightToken}</p>}
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="rewardBps" className="text-slate-100 text-md">
                  Reward (basis points) *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('rewardBps')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('rewardBps')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'rewardBps' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Example: 1000 = 1.00% reward slice
                  </div>
                )}
              </div>
              <Input
                id="rewardBps"
                type="number"
                min={0}
                placeholder="1000"
                value={rewardBps}
                onChange={(e) => setRewardBps(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.rewardBps ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.rewardBps && <p className="text-red-400 text-xs">{errors.rewardBps}</p>}
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="halfLifeSeconds" className="text-slate-100 text-md">
                  Half-life (seconds) *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('halfLifeSeconds')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('halfLifeSeconds')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'halfLifeSeconds' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Controls exponential moving average decay
                  </div>
                )}
              </div>
              <Input
                id="halfLifeSeconds"
                type="number"
                min={0}
                placeholder="3600"
                value={halfLifeSeconds}
                onChange={(e) => setHalfLifeSeconds(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.halfLifeSeconds ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.halfLifeSeconds && <p className="text-red-400 text-xs">{errors.halfLifeSeconds}</p>}
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="quorumBps" className="text-slate-100 text-md">
                  Quorum (basis points) *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('quorumBps')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('quorumBps')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'quorumBps' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Minimum participation required (0 - 10000)
                  </div>
                )}
              </div>
              <Input
                id="quorumBps"
                type="number"
                min={0}
                max={10000}
                placeholder="2000"
                value={quorumBps}
                onChange={(e) => setQuorumBps(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.quorumBps ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.quorumBps && <p className="text-red-400 text-xs">{errors.quorumBps}</p>}
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="depositLock" className="text-slate-100 text-md">
                  Deposit Lock (seconds) *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('depositLock')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('depositLock')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'depositLock' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Time deposited weighting tokens remain locked
                  </div>
                )}
              </div>
              <Input
                id="depositLock"
                type="number"
                min={0}
                placeholder="3600"
                value={depositLock}
                onChange={(e) => setDepositLock(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.depositLock ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.depositLock && <p className="text-red-400 text-xs">{errors.depositLock}</p>}
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="withdrawLock" className="text-slate-100 text-md">
                  Withdrawal Lock (seconds) *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('withdrawLock')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('withdrawLock')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'withdrawLock' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Time period before withdrawals can be executed
                  </div>
                )}
              </div>
              <Input
                id="withdrawLock"
                type="number"
                min={0}
                placeholder="3600"
                value={withdrawLock}
                onChange={(e) => setWithdrawLock(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.withdrawLock ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.withdrawLock && <p className="text-red-400 text-xs">{errors.withdrawLock}</p>}
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center gap-2">
                <Label htmlFor="alpha" className="text-slate-100 text-md">
                  Alpha *
                </Label>
                <button
                  type="button"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                  onMouseEnter={() => setShowTooltip('alpha')}
                  onMouseLeave={() => setShowTooltip(null)}
                  onFocus={() => setShowTooltip('alpha')}
                  onBlur={() => setShowTooltip(null)}
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip === 'alpha' && (
                  <div className="absolute left-0 top-full mt-2 z-10 bg-slate-800 text-slate-100 text-xs p-2 rounded shadow-lg">
                    Scalar in reward formula. Keep small unless necessary.
                  </div>
                )}
              </div>
              <Input
                id="alpha"
                type="number"
                min={0}
                placeholder="1"
                value={alpha}
                onChange={(e) => setAlpha(e.target.value)}
                className={`border-0 bg-slate-800/50 text-slate-100 placeholder:text-slate-400 border border-blue-100 ${
                  errors.alpha ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.alpha && <p className="text-red-400 text-xs">{errors.alpha}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            type="submit"
            size="lg"
            className="bg-black border border-white hover:bg-primary max-w-4xl mx-auto border-slate-400 text-white"
            disabled={loading || !isConnected}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Oracle...
              </>
            ) : !isConnected ? (
              'Connect Wallet to Create Oracle'
            ) : (
              <>
                Create Oracle
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
