"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { PriceChart } from "@/components/price-chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useOracle } from "@/hooks/useOracles"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token"
import { getOracleProgram, ORACLE_PROGRAM_ID } from "@/lib/oracleProgram"
import {
  ArrowLeft,
  Clock,
  Copy,
  Download,
  HandCoins,
  History,
  Loader2,
  Send,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PRICE_DECIMALS = 6

const formatBps = (value: number) => {
  if (!Number.isFinite(value)) return "—"
  return `${(value / 100).toFixed(2)}%`
}

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "—"
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (remaining > 0 || parts.length === 0) parts.push(`${remaining}s`)
  return parts.join(" ")
}

const formatNumberWithGrouping = (value: string) => {
  if (!value) return "0"
  const numericString = value.toString()
  if (!/^-?\d+$/.test(numericString)) {
    return numericString
  }
  const isNegative = numericString.startsWith("-")
  const digits = isNegative ? numericString.slice(1) : numericString
  const groups: string[] = []
  for (let i = digits.length; i > 0; i -= 3) {
    groups.push(digits.slice(Math.max(i - 3, 0), i))
  }
  const formatted = groups.reverse().join(",")
  return `${isNegative ? "-" : ""}${formatted}`
}

const formatTokenAmount = (value: number, fractionDigits = 4) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })

const formatHistoryTimestamp = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return new Date(value * 1000).toLocaleString()
}

const parsePriceInput = (raw: string, decimals: number): BN => {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Enter a price value to submit.")
  }

  const negative = trimmed.startsWith("-")
  const unsigned = negative ? trimmed.slice(1) : trimmed.startsWith("+") ? trimmed.slice(1) : trimmed

  if (!unsigned) {
    throw new Error("Enter a valid numeric value.")
  }

  const parts = unsigned.split(".")
  if (parts.length > 2) {
    throw new Error("Use at most one decimal separator.")
  }

  const [wholePartRaw, fractionalRaw = ""] = parts
  const wholePart = wholePartRaw === "" ? "0" : wholePartRaw

  if (!/^\d+$/.test(wholePart)) {
    throw new Error("Price must be a numeric value.")
  }
  if (!/^\d*$/.test(fractionalRaw)) {
    throw new Error("Price must be a numeric value.")
  }
  if (fractionalRaw.length > decimals) {
    throw new Error(`Use at most ${decimals} decimal places.`)
  }

  const fractionalPadded = (fractionalRaw + "0".repeat(decimals)).slice(0, decimals)
  const combined = (wholePart + fractionalPadded).replace(/^0+(?=\d)/, "")
  const bn = new BN(combined || "0")
  return negative && !bn.isZero() ? bn.neg() : bn
}

type UserStateSnapshot = {
  locked: number
  unlocked: number
  depositTimestamp: number
  lastOperationTimestamp: number
}

export default function InteractionClient() {
  const searchParams = useSearchParams()
  const params = useParams<{ oracleId?: string | string[] }>()

  const queryFromSearch = searchParams ? searchParams.get("oracle") ?? searchParams.get("oracleId") ?? "" : ""
  const queryOracle = queryFromSearch.trim()
  const pathOracleParam = params?.oracleId
  const pathOracleId = Array.isArray(pathOracleParam) ? pathOracleParam[0] : pathOracleParam
  const normalizedPathOracle = typeof pathOracleId === "string" ? pathOracleId.trim() : ""
  const activeOracleId = (queryOracle || normalizedPathOracle || "").trim() || undefined

  const { connection } = useConnection()
  const wallet = useWallet()
  const program = useMemo(() => getOracleProgram(connection, wallet.connected ? wallet : null), [connection, wallet.connected, wallet])
  const { toast } = useToast()
  const { oracle, loading, error, refetch } = useOracle(activeOracleId)

  const priceHistory = useMemo(() => oracle?.priceHistory ?? [], [oracle?.priceHistory])

  const [submitValue, setSubmitValue] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [voteTarget, setVoteTarget] = useState("")
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isSubmittingPrice, setIsSubmittingPrice] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [userTokenBalance, setUserTokenBalance] = useState<number | null>(null)
  const [userStateInfo, setUserStateInfo] = useState<UserStateSnapshot | null>(null)
  const [showVoteHistory, setShowVoteHistory] = useState(false)

  useEffect(() => {
    setSubmitValue("")
    setVoteTarget("")
    setDepositAmount("")
    setWithdrawAmount("")
  }, [activeOracleId])

  const handleCopy = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast({ title: "Copied", description: `${label} copied to clipboard.` })
      } catch (copyError) {
        console.error("Failed to copy value", copyError)
        toast({ title: "Copy failed", description: "Unable to copy to clipboard.", variant: "destructive" })
      }
    },
    [toast],
  )

  const deriveUserStatePda = useCallback(
    (oraclePk: PublicKey, userPk: PublicKey) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("user"), oraclePk.toBuffer(), userPk.toBuffer()],
        ORACLE_PROGRAM_ID,
      ),
    [],
  )

  const deriveOracleAccounts = useCallback(
    (oraclePk: PublicKey, userPk: PublicKey) => {
      if (!oracle) {
        throw new Error("Oracle data unavailable")
      }
      const weightMintPk = new PublicKey(oracle.weightMint)
      const userTokenAccount = getAssociatedTokenAddressSync(weightMintPk, userPk, false)
      const oracleVaultPk = getAssociatedTokenAddressSync(weightMintPk, oraclePk, true)
      const [userStatePk] = deriveUserStatePda(oraclePk, userPk)
      return { weightMintPk, userTokenAccount, oracleVaultPk, userStatePk }
    },
    [oracle, deriveUserStatePda],
  )

  useEffect(() => {
    let cancelled = false

    const fetchUserSnapshot = async () => {
      if (!oracle || !wallet.connected || !wallet.publicKey) {
        if (!cancelled) {
          setUserTokenBalance(null)
          setUserStateInfo(null)
        }
        return
      }

      try {
        const oraclePk = new PublicKey(oracle.address)
        const { userTokenAccount, userStatePk } = deriveOracleAccounts(oraclePk, wallet.publicKey)

        let balanceValue = 0
        try {
          const accountInfo = await connection.getAccountInfo(userTokenAccount)
          if (accountInfo) {
            const tokenBalance = await connection.getTokenAccountBalance(userTokenAccount)
            const decimals = tokenBalance.value.decimals ?? 0
            balanceValue = Number(tokenBalance.value.amount) / Math.pow(10, decimals)
          }
        } catch {
          balanceValue = 0
        }
        if (!cancelled) {
          setUserTokenBalance(balanceValue)
        }

        try {
          const account = await program.account.userState.fetch(userStatePk)
          if (!cancelled && account) {
            const lockedRaw = account.lockedTokens as unknown as BN | number | undefined
            const unlockedRaw = account.unlockedTokens as unknown as BN | number | undefined
            const locked = typeof lockedRaw === "number" ? lockedRaw : lockedRaw?.toNumber?.() ?? 0
            const unlocked = typeof unlockedRaw === "number" ? unlockedRaw : unlockedRaw?.toNumber?.() ?? 0
            const depositTimestamp =
              typeof account.depositTimestamp === "number"
                ? account.depositTimestamp
                : account.depositTimestamp?.toNumber?.() ?? 0
            const lastOperationTimestamp =
              typeof account.lastOperationTimestamp === "number"
                ? account.lastOperationTimestamp
                : account.lastOperationTimestamp?.toNumber?.() ?? 0

            setUserStateInfo({
              locked,
              unlocked,
              depositTimestamp,
              lastOperationTimestamp,
            })
          }
        } catch {
          if (!cancelled) {
            setUserStateInfo(null)
          }
        }
      } catch {
        if (!cancelled) {
          setUserTokenBalance(null)
          setUserStateInfo(null)
        }
      }
    }

    void fetchUserSnapshot()

    return () => {
      cancelled = true
    }
  }, [oracle, wallet.connected, wallet.publicKey, connection, deriveOracleAccounts, program])

  const ensureAssociatedTokenAccount = useCallback(
    async (mintPk: PublicKey, ownerPk: PublicKey, ataPk: PublicKey) => {
      const existing = await connection.getAccountInfo(ataPk)
      if (existing) {
        return
      }

      if (!wallet.connected || !wallet.publicKey) {
        throw new Error("Wallet not connected")
      }

      const instruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        ataPk,
        ownerPk,
        mintPk,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      )

      const transaction = new Transaction().add(instruction)

      if (wallet.sendTransaction) {
        const signature = await wallet.sendTransaction(transaction, connection)
        await connection.confirmTransaction(signature, "confirmed")
        return
      }

      if (wallet.signTransaction) {
        const latestBlockhash = await connection.getLatestBlockhash()
        transaction.recentBlockhash = latestBlockhash.blockhash
        transaction.feePayer = wallet.publicKey
        const signedTx = await wallet.signTransaction(transaction)
        const signature = await connection.sendRawTransaction(signedTx.serialize())
        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        )
        return
      }

      throw new Error("Wallet does not support sending transactions")
    },
    [connection, wallet.connected, wallet.publicKey, wallet.sendTransaction, wallet.signTransaction],
  )

  const depositTokens = useCallback(async () => {
    if (!oracle) {
      toast({ title: "Oracle not loaded", description: "Load oracle data before depositing.", variant: "destructive" })
      return
    }
    if (!wallet.connected || !wallet.publicKey) {
      toast({ title: "Wallet required", description: "Connect your wallet to deposit tokens.", variant: "destructive" })
      return
    }

    let amountBn: BN
    try {
      amountBn = new BN(depositAmount)
    } catch {
      toast({ title: "Invalid amount", description: "Enter a whole-number token amount.", variant: "destructive" })
      return
    }
    if (amountBn.lte(new BN(0))) {
      toast({ title: "Invalid amount", description: "Deposit amount must be positive.", variant: "destructive" })
      return
    }

    try {
      setIsDepositing(true)
      const oraclePk = new PublicKey(oracle.address)
      const { weightMintPk, userTokenAccount, oracleVaultPk, userStatePk } = deriveOracleAccounts(oraclePk, wallet.publicKey)

      await ensureAssociatedTokenAccount(weightMintPk, wallet.publicKey, userTokenAccount)
      await ensureAssociatedTokenAccount(weightMintPk, oraclePk, oracleVaultPk)

      await program.methods
        .depositTokens(amountBn)
        .accounts({
          user: wallet.publicKey,
          weightMint: weightMintPk,
          oracleState: oraclePk,
          userTokenAccount,
          oracleVault: oracleVaultPk,
          userState: userStatePk,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()

      toast({ title: "Deposit complete", description: "Tokens deposited into the oracle vault." })
      setDepositAmount("")
      void refetch()
    } catch (depositError: any) {
      console.error("Failed to deposit tokens", depositError)
      toast({
        title: "Deposit failed",
        description: depositError?.message ?? "Unable to deposit tokens.",
        variant: "destructive",
      })
    } finally {
      setIsDepositing(false)
    }
  }, [oracle, wallet.connected, wallet.publicKey, depositAmount, deriveOracleAccounts, ensureAssociatedTokenAccount, program, toast, refetch])

  const withdrawTokens = useCallback(async () => {
    if (!oracle) {
      toast({ title: "Oracle not loaded", description: "Load oracle data before withdrawing.", variant: "destructive" })
      return
    }
    if (!wallet.connected || !wallet.publicKey) {
      toast({ title: "Wallet required", description: "Connect your wallet to withdraw tokens.", variant: "destructive" })
      return
    }

    let amountBn: BN
    try {
      amountBn = new BN(withdrawAmount)
    } catch {
      toast({ title: "Invalid amount", description: "Enter a whole-number token amount.", variant: "destructive" })
      return
    }
    if (amountBn.lte(new BN(0))) {
      toast({ title: "Invalid amount", description: "Withdrawal amount must be positive.", variant: "destructive" })
      return
    }

    try {
      setIsWithdrawing(true)
      const oraclePk = new PublicKey(oracle.address)
      const { weightMintPk, userTokenAccount, oracleVaultPk, userStatePk } = deriveOracleAccounts(oraclePk, wallet.publicKey)

      await ensureAssociatedTokenAccount(weightMintPk, wallet.publicKey, userTokenAccount)

      await program.methods
        .withdrawTokens(amountBn)
        .accounts({
          user: wallet.publicKey,
          weightMint: weightMintPk,
          oracleState: oraclePk,
          userTokenAccount,
          oracleVault: oracleVaultPk,
          userState: userStatePk,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      toast({ title: "Withdrawal complete", description: "Tokens withdrawn from the oracle vault." })
      setWithdrawAmount("")
      void refetch()
    } catch (withdrawError: any) {
      console.error("Failed to withdraw tokens", withdrawError)
      toast({
        title: "Withdrawal failed",
        description: withdrawError?.message ?? "Unable to withdraw tokens.",
        variant: "destructive",
      })
    } finally {
      setIsWithdrawing(false)
    }
  }, [oracle, wallet.connected, wallet.publicKey, withdrawAmount, deriveOracleAccounts, ensureAssociatedTokenAccount, program, toast, refetch])

  const submitPrice = useCallback(async () => {
    if (!oracle) {
      toast({ title: "Oracle not loaded", description: "Load oracle data before submitting.", variant: "destructive" })
      return
    }
    if (!wallet.connected || !wallet.publicKey) {
      toast({ title: "Wallet required", description: "Connect your wallet to submit a price.", variant: "destructive" })
      return
    }

    let priceBn: BN
    try {
      priceBn = parsePriceInput(submitValue, PRICE_DECIMALS)
    } catch (parseError: any) {
      toast({
        title: "Invalid value",
        description: parseError?.message ?? "Enter a numeric value with up to six decimal places.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmittingPrice(true)
      const oraclePk = new PublicKey(oracle.address)
      const [userState] = deriveUserStatePda(oraclePk, wallet.publicKey)

      await program.methods
        .submitValue(priceBn)
        .accounts({
          user: wallet.publicKey,
          oracleState: oraclePk,
          userState,
        })
        .rpc()

      toast({ title: "Value submitted", description: "Oracle value submission succeeded." })
      setSubmitValue("")
      void refetch()
    } catch (submitError: any) {
      console.error("Failed to submit value", submitError)
      toast({
        title: "Submission failed",
        description: submitError?.message ?? "Unable to submit value.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingPrice(false)
    }
  }, [oracle, wallet.connected, wallet.publicKey, submitValue, program, deriveUserStatePda, refetch, toast])

  const vote = useCallback(
    async (kind: "blacklist" | "whitelist") => {
      if (!oracle) {
        toast({ title: "Oracle not loaded", description: "Load oracle data before voting.", variant: "destructive" })
        return
      }
      if (!wallet.connected || !wallet.publicKey) {
        toast({ title: "Wallet required", description: "Connect your wallet to vote.", variant: "destructive" })
        return
      }
      let targetPk: PublicKey
      try {
        targetPk = new PublicKey(voteTarget)
      } catch {
        toast({ title: "Invalid target", description: "Enter a valid target public key.", variant: "destructive" })
        return
      }

      try {
        setIsVoting(true)
        const oraclePk = new PublicKey(oracle.address)
        const [userState] = deriveUserStatePda(oraclePk, wallet.publicKey)

        const method =
          kind === "blacklist"
            ? program.methods.voteBlacklist(targetPk)
            : program.methods.voteWhitelist(targetPk)

        await method
          .accounts({
            user: wallet.publicKey,
            oracleState: oraclePk,
            userState,
          })
          .rpc()

        toast({
          title: kind === "blacklist" ? "Blacklist vote recorded" : "Whitelist vote recorded",
          description: "Your vote has been submitted on-chain.",
        })
        setVoteTarget("")
        void refetch()
      } catch (voteError: any) {
        console.error("Failed to vote", voteError)
        toast({
          title: "Voting failed",
          description: voteError?.message ?? "Unable to submit vote.",
          variant: "destructive",
        })
      } finally {
        setIsVoting(false)
      }
    },
    [oracle, wallet.connected, wallet.publicKey, voteTarget, program, deriveUserStatePda, refetch, toast],
  )

  const totalLockedTokens = userStateInfo?.locked ?? 0
  const totalUnlockedTokens = userStateInfo?.unlocked ?? 0
  const totalDepositedTokens = totalLockedTokens + totalUnlockedTokens
  const userHasDeposits = totalDepositedTokens > 0
  const userWalletTokenBalance = userTokenBalance ?? 0
  const userHasWeightTokens = userHasDeposits || userWalletTokenBalance > 0
  const walletConnected = wallet.connected && !!wallet.publicKey

  const hasOracle = Boolean(oracle)
  const initialLoading = loading && !hasOracle && !error
  const isRefreshing = loading && hasOracle
  const isConnected = wallet.connected && !!wallet.publicKey
  const derivedAccounts = useMemo(() => {
    if (!oracle || !wallet.publicKey) {
      return null
    }

    try {
      const oraclePk = new PublicKey(oracle.address)
      const { userTokenAccount, oracleVaultPk, userStatePk } = deriveOracleAccounts(oraclePk, wallet.publicKey)
      return {
        oracleVault: oracleVaultPk.toBase58(),
        userTokenAccount: userTokenAccount.toBase58(),
        userState: userStatePk.toBase58(),
      }
    } catch (deriveError) {
      console.error("Failed to derive user accounts", deriveError)
      return null
    }
  }, [oracle, wallet.publicKey, deriveOracleAccounts])

  const recentHistory = useMemo(() => priceHistory.slice(-5).reverse(), [priceHistory])
  const voteTargets = useMemo(() => {
    if (!oracle) return []
    return (oracle.targets ?? []).filter((target) => Number(target.blacklistVotes ?? "0") > 0)
  }, [oracle])

  useEffect(() => {
    if (voteTargets.length === 0 && showVoteHistory) {
      setShowVoteHistory(false)
    }
  }, [voteTargets.length, showVoteHistory])

  const handleRefresh = useCallback(async () => {
    try {
      await refetch()
    } catch (refreshError: any) {
      console.error("Failed to refresh oracle", refreshError)
      toast({
        title: "Refresh failed",
        description: refreshError?.message ?? "Unable to refresh oracle data.",
        variant: "destructive",
      })
    }
  }, [refetch, toast])

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={{ fontStyle: "oblique 12deg" }}>
        <Navigation />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">Loading oracle details from Solana…</p>
            <p className="text-sm text-muted-foreground">Fetching the latest on-chain state for this oracle.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={{ fontStyle: "oblique 12deg" }}>
        <Navigation />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <Card className="mx-auto max-w-3xl border border-destructive/30 bg-destructive/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-destructive">Failed to load oracle</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Verify that the oracle account exists on the current cluster and try refreshing.</p>
              <Link href="/explorer" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Explorer
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!activeOracleId) {
    return (
      <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={{ fontStyle: "oblique 12deg" }}>
        <Navigation />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <Card className="mx-auto max-w-3xl border border-primary/20 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Select an oracle</CardTitle>
              <CardDescription>Choose an oracle from the explorer or provide an address in the URL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Use the oracle explorer to browse existing deployments, then open one to view its dashboard.</p>
              <Link href="/explorer" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Browse Oracles
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!oracle) {
    return (
      <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={{ fontStyle: "oblique 12deg" }}>
        <Navigation />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <Card className="mx-auto max-w-3xl border border-primary/20 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Oracle not found</CardTitle>
              <CardDescription>The requested oracle account is unavailable on the current cluster.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Double-check the URL or choose another oracle from the explorer.</p>
              <Link href="/explorer" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Return to Explorer
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const accountRows = [
    { label: "Oracle Address", value: oracle.address, copyLabel: "Oracle address" },
    { label: "Oracle Authority", value: oracle.authority, copyLabel: "Authority address" },
    { label: "Weight Mint", value: oracle.weightMint, copyLabel: "Weight mint address" },
  ]

  if (derivedAccounts) {
    accountRows.push({ label: "Oracle Vault ATA", value: derivedAccounts.oracleVault, copyLabel: "Oracle vault address" })
    if (walletConnected) {
      accountRows.push({ label: "Your Token ATA", value: derivedAccounts.userTokenAccount, copyLabel: "User token account" })
      accountRows.push({ label: "User State PDA", value: derivedAccounts.userState, copyLabel: "User state account" })
    }
  }

  const priceChartCard = (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <TrendingUp className="h-5 w-5 text-primary" />
          Price Chart & Analytics
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Rolling submissions plotted for quick trend inspection.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <PriceChart data={priceHistory} loading={isRefreshing} />
      </CardContent>
    </Card>
  );
  
  const currentValuesCard = (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <Clock className="h-5 w-5 text-primary" />
          Current Oracle Values
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Latest submissions and aggregated value pulled from chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-card/40 px-4 py-3 mt-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground/70">Aggregated</div>
            <div className="text-xl font-semibold text-foreground">{oracle.aggregatedValue}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/20"
          >
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-card/40 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground/70">Latest Submission</div>
            <div className="text-lg font-medium text-foreground">{oracle.latestValue}</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {oracle.lastSubmissionTime}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  const submitValueCard = (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <Send className="h-5 w-5 text-primary" />
          Submit Price Value
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Provide a new price update using your unlocked weighting tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
            <div className="text-muted-foreground/80">Unlocked Tokens</div>
            <div className="text-foreground font-medium">{formatTokenAmount(totalUnlockedTokens)} tokens</div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
            <div className="text-muted-foreground/80">Locked Tokens</div>
            <div className="text-foreground font-medium">{formatTokenAmount(totalLockedTokens)} tokens</div>
          </div>
        </div>
        <div className="space-y-2">
          <Input
            id="submit-value"
            placeholder="Enter price value (e.g., 2500.123456)"
            value={submitValue}
            onChange={(event) => setSubmitValue(event.target.value)}
            disabled={!walletConnected || isSubmittingPrice}
            className="h-12 bg-card/50 border border-primary/20 rounded-xl font-light transition-all duration-300 focus:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:bg-card/70"
          />
        </div>
        <Button
          onClick={submitPrice}
          disabled={!walletConnected || isSubmittingPrice}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-primary/20 h-12 rounded-xl transition-all duration-300"
        >
          {isSubmittingPrice ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Value
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );


  const depositCard = (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <HandCoins className="h-5 w-5 text-primary" />
          Deposit Weight Tokens
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Lock tokens to gain submission power and governance rights.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
            <div className="text-muted-foreground/80">Wallet Balance</div>
            <div className="text-foreground font-medium">{formatTokenAmount(userWalletTokenBalance)} tokens</div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
            <div className="text-muted-foreground/80">Locked</div>
            <div className="text-foreground font-medium">{formatTokenAmount(totalLockedTokens)} tokens</div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
            <div className="text-muted-foreground/80">Unlocked</div>
            <div className="text-foreground font-medium">{formatTokenAmount(totalUnlockedTokens)} tokens</div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deposit-amount" className="text-foreground font-medium">Amount</Label>
          <Input
            id="deposit-amount"
            type="number"
            placeholder="Enter amount to deposit"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            disabled={!walletConnected || isDepositing}
            className="h-12 bg-card/50 border border-primary/20 rounded-xl font-light transition-all duration-300 focus:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:bg-card/70"
          />
        </div>
        <Button
          onClick={depositTokens}
          disabled={!walletConnected || isDepositing}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-primary/20 h-12 rounded-xl transition-all duration-300"
        >
          {isDepositing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Depositing…
            </>
          ) : (
            <>
              <HandCoins className="mr-2 h-4 w-4" />
              Deposit Tokens
            </>
          )}
        </Button>
        {!walletConnected && <p className="text-xs text-muted-foreground">Connect your wallet to deposit weighting tokens.</p>}
      </CardContent>
    </Card>
  )

  const withdrawCard = (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <Download className="h-5 w-5 text-destructive" />
          Withdraw Weight Tokens
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Release unlocked tokens from the oracle vault back to your wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-4 text-xs text-destructive/80">
          Withdrawal lock period: {formatDuration(oracle.withdrawalLockingPeriod)}
        </div>
        <div className="space-y-2">
          <Label htmlFor="withdraw-amount" className="text-foreground font-medium">Amount</Label>
          <Input
            id="withdraw-amount"
            type="number"
            placeholder="Enter amount to withdraw"
            value={withdrawAmount}
            onChange={(event) => setWithdrawAmount(event.target.value)}
            disabled={!walletConnected || isWithdrawing}
            className="h-12 bg-card/50 border border-primary/20 rounded-xl font-light transition-all duration-300 focus:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:bg-card/70"
          />
        </div>
        <Button
          onClick={withdrawTokens}
          disabled={!walletConnected || isWithdrawing}
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl transition-all duration-300"
        >
          {isWithdrawing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Withdrawing…
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Withdraw Tokens
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )

  const governanceCard = (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <Shield className="h-5 w-5 text-primary" />
          Governance Voting
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Submit blacklist or whitelist votes weighted by your deposited tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vote-target" className="text-foreground font-medium">Target Address</Label>
          <Input
            id="vote-target"
            placeholder="Enter target public key"
            value={voteTarget}
            onChange={(event) => setVoteTarget(event.target.value)}
            disabled={!walletConnected || isVoting}
            className="h-12 bg-card/50 border border-primary/20 rounded-xl font-light transition-all duration-300 focus:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:bg-card/70"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={() => vote("blacklist")}
            disabled={!walletConnected || isVoting}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl transition-all duration-300"
          >
            {isVoting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Voting…
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Vote Blacklist
              </>
            )}
          </Button>
          <Button
            onClick={() => vote("whitelist")}
            disabled={!walletConnected || isVoting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-xl transition-all duration-300"
          >
            {isVoting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Voting…
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Vote Whitelist
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  const renderOracleOverviewCard = () => (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader>
        <CardTitle>Oracle Overview</CardTitle>
        <CardDescription>Essential addresses and totals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {accountRows.map((item) => (
            <div key={item.label} className="rounded-xl border border-primary/20 bg-card/40 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-left">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80">{item.label}</div>
                  <code className="text-sm text-primary break-all">{item.value}</code>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => handleCopy(item.value, item.copyLabel)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-3 text-left">
            <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80">Total Deposited Tokens</div>
            <div className="text-lg font-medium text-foreground">{formatNumberWithGrouping(oracle.totalDepositedTokens)}</div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-3 text-left">
            <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80">Aggregated Weight</div>
            <div className="text-lg font-medium text-foreground">{formatNumberWithGrouping(oracle.aggregatedWeight)}</div>
          </div>
        </div>

        {walletConnected && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Position</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80">Wallet Balance</div>
                <div className="text-sm font-medium text-foreground">{formatTokenAmount(userWalletTokenBalance)} tokens</div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80">Locked Tokens</div>
                <div className="text-sm font-medium text-foreground">{formatTokenAmount(totalLockedTokens)} tokens</div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80">Unlocked Tokens</div>
                <div className="text-sm font-medium text-foreground">{formatTokenAmount(totalUnlockedTokens)} tokens</div>
              </div>
            </div>
            {userHasDeposits && userStateInfo?.depositTimestamp ? (
              <p className="text-xs text-muted-foreground">
                Deposited since {formatHistoryTimestamp(userStateInfo.depositTimestamp)}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderOracleConfigurationCard = () => (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader>
        <CardTitle>Oracle Parameters</CardTitle>
        <CardDescription>Immutable values that govern weighting and decay.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Reward Rate</dt>
            <dd className="text-sm font-medium text-foreground">{oracle.rewardBps} bps · {formatBps(oracle.rewardBps)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Quorum</dt>
            <dd className="text-sm font-medium text-foreground">{formatBps(oracle.quorum)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Half-life</dt>
            <dd className="text-sm font-medium text-foreground">{formatDuration(oracle.halfLifeSeconds)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Deposit Lock</dt>
            <dd className="text-sm font-medium text-foreground">{formatDuration(oracle.depositLockingPeriod)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Withdrawal Lock</dt>
            <dd className="text-sm font-medium text-foreground">{formatDuration(oracle.withdrawalLockingPeriod)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Alpha</dt>
            <dd className="text-sm font-medium text-foreground">{oracle.alpha.toString()}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )

  const renderVoteHistoryCard = () => (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground font-medium">
              <Shield className="h-5 w-5 text-primary" />
              Target Vote History
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Review addresses receiving blacklist or whitelist votes.
            </CardDescription>
          </div>
          {voteTargets.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary/20"
              onClick={() => setShowVoteHistory((prev) => !prev)}
            >
              {showVoteHistory ? "Hide Addresses" : "View Addresses"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {voteTargets.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No governance votes recorded yet.
          </div>
        ) : showVoteHistory ? (
          <div className="overflow-x-auto rounded-xl border border-primary/20 bg-card/40">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Whitelist Votes</th>
                  <th className="px-4 py-3 font-medium text-right">Blacklist Votes</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {voteTargets.map((target) => (
                  <tr key={target.target} className="text-foreground/90">
                    <td className="px-4 py-3 break-all">{target.target}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                          target.isBlacklisted ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        }`}
                      >
                        {target.isBlacklisted ? "Blacklisted" : "Whitelisted"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatNumberWithGrouping(target.whitelistVotes ?? "0")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatNumberWithGrouping(target.blacklistVotes ?? "0")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleCopy(target.target, "Target address")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">Click "View Addresses" to inspect vote distribution across targets.</p>
        )}
      </CardContent>
    </Card>
  )

  const renderRecentActivityCard = () => (
    <Card className="border border-primary/20 bg-card/30 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-foreground font-medium">
          <History className="h-5 w-5 text-primary" />
          Recent Activity & History
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Latest submissions with aggregated and raw values.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentHistory.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No price submissions recorded yet. Submit a value to start building history.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentHistory.map((entry) => (
              <div
                key={`${entry.timestamp}-${entry.latest}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-card/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{formatHistoryTimestamp(entry.timestamp)}</p>
                  <p className="text-xs text-muted-foreground">Aggregated • {entry.aggregated.toFixed(6)}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-primary">Latest • {entry.latest.toFixed(6)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const shouldShowSubmit = userHasDeposits
  const shouldShowDeposit = userHasWeightTokens
  const shouldShowWithdraw = userHasDeposits
  const shouldShowGovernance = userHasDeposits

  return (
    <div className="min-h-screen bg-background font-[oblique] tracking-wide" style={{ fontStyle: "oblique 12deg" }}>
      <Navigation />
      <div className="container mx-auto px-6 pt-24 pb-16 space-y-12">
        <header className="flex flex-col gap-4 text-left max-w-3xl">
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Explorer
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/40 px-3 py-1 uppercase tracking-[0.35em]">
              <Clock className="h-3.5 w-3.5" />
              {isRefreshing ? "Refreshing…" : `Last update · ${oracle.lastUpdate ?? "Unknown"}`}
            </div>
          </div>
          <h1
            className="text-4xl sm:text-5xl font-medium bg-gradient-to-r from-foreground via-primary to-primary/70 bg-clip-text text-transparent"
            style={{ fontStyle: "oblique 15deg" }}
          >
            {oracle.name ?? "Oracle Dashboard"}
          </h1>
          {oracle.description && <p className="text-sm sm:text-base text-muted-foreground">{oracle.description}</p>}
        </header>

        {priceChartCard}

        <div className={`grid gap-6 ${shouldShowSubmit ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
          {currentValuesCard}
          {shouldShowSubmit ? submitValueCard : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-1">{renderOracleOverviewCard()}</div>

        {!userHasWeightTokens && (
          <div className="grid gap-6 lg:grid-cols-1">{renderOracleConfigurationCard()}</div>
        )}

        {shouldShowDeposit && (
          <div className={`grid gap-6 ${shouldShowWithdraw ? "lg:grid-cols-2" : ""}`}>
            {depositCard}
            {shouldShowWithdraw ? withdrawCard : null}
          </div>
        )}

        {userHasWeightTokens && !userHasDeposits && (
          <div className="grid gap-6 lg:grid-cols-1">{renderOracleConfigurationCard()}</div>
        )}

        {shouldShowGovernance && (
          <div className="grid gap-6 lg:grid-cols-2">
            {governanceCard}
            {renderOracleConfigurationCard()}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-1">{renderVoteHistoryCard()}</div>
        <div className="grid gap-6 lg:grid-cols-1">{renderRecentActivityCard()}</div>
      </div>
    </div>
  )
}
