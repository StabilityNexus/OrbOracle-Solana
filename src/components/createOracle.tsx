'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Check } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'
import { getOracleProgram, ORACLE_PROGRAM_ID } from '@/lib/oracleProgram'

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

interface DerivedAddresses {
  oracleState: string
  oracleVault: string
}

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
    } catch {
      setDerived(null)
    }
  }, [wallet.publicKey, weightToken])

  const handleCreate = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast({
        title: 'Wallet required',
        description: 'Connect a Solana wallet to continue.',
        variant: 'destructive',
      })
      return
    }

    if (!name || !description || !weightToken) {
      toast({
        title: 'Missing fields',
        description: 'Name, description, and weight token mint are required.',
        variant: 'destructive',
      })
      return
    }

    let weightMintKey: PublicKey
    try {
      weightMintKey = new PublicKey(weightToken)
    } catch {
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

      const mintAccount = await connection.getAccountInfo(weightMintKey)
      if (!mintAccount) {
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
        throw new Error('An oracle already exists for this wallet and mint. Choose a different weighting mint or use the explorer to manage the existing oracle.')
      }
      const existingVault = await connection.getAccountInfo(oracleVault)
      if (existingVault) {
        throw new Error('The derived oracle vault ATA already exists. Please pick a new mint or remove the existing oracle before creating a new one.')
      }

      const program = getOracleProgram(connection, wallet)

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
      toast({
        title: 'Oracle deployed',
        description: 'The oracle account has been initialized on-chain.',
      })
    } catch (error: any) {
      console.error('Oracle creation failed', error)
      toast({
        title: 'Failed to create oracle',
        description: error?.message ?? 'Check your inputs and validator status.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const isConnected = wallet.connected && !!wallet.publicKey

  return (
    <Card className="border border-primary/15 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl font-medium">Deploy Oracle Instance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Oracle Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Solana / USDC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the data feed and update cadence"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mint">Weight Token Mint</Label>
              <Input
                id="mint"
                value={weightToken}
                onChange={(e) => setWeightToken(e.target.value)}
                placeholder="Mint address (e.g. token used for weighting)"
              />
              {derived && (
                <p className="text-xs text-muted-foreground">
                  Oracle PDA {formatAddress(derived.oracleState)} · Vault {formatAddress(derived.oracleVault)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reward (basis points)</Label>
                <Input value={rewardBps} onChange={(e) => setRewardBps(e.target.value)} placeholder="1000" />
              </div>
              <div className="space-y-2">
                <Label>Half-life (seconds)</Label>
                <Input value={halfLifeSeconds} onChange={(e) => setHalfLifeSeconds(e.target.value)} placeholder="3600" />
              </div>
              <div className="space-y-2">
                <Label>Quorum (basis points)</Label>
                <Input value={quorumBps} onChange={(e) => setQuorumBps(e.target.value)} placeholder="2000" />
              </div>
              <div className="space-y-2">
                <Label>Alpha</Label>
                <Input value={alpha} onChange={(e) => setAlpha(e.target.value)} placeholder="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deposit Lock (seconds)</Label>
                <Input value={depositLock} onChange={(e) => setDepositLock(e.target.value)} placeholder="3600" />
              </div>
              <div className="space-y-2">
                <Label>Withdrawal Lock (seconds)</Label>
                <Input value={withdrawLock} onChange={(e) => setWithdrawLock(e.target.value)} placeholder="3600" />
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleCreate} disabled={!isConnected || loading} className="w-full md:w-auto">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deploying
            </>
          ) : (
            'Deploy Oracle'
          )}
        </Button>

        {!isConnected && (
          <p className="text-sm text-muted-foreground">
            Connect your wallet to deploy an oracle to the current cluster.
          </p>
        )}

        {signature && derived && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Check className="h-4 w-4" />
              Oracle deployed successfully
            </div>
            <p className="text-muted-foreground">
              Oracle account: <span className="text-foreground font-mono">{derived.oracleState}</span>
            </p>
            <p className="text-muted-foreground">
              Vault ATA: <span className="text-foreground font-mono">{derived.oracleVault}</span>
            </p>
            <p className="text-muted-foreground">
              Transaction: <span className="text-foreground font-mono break-all">{signature}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
