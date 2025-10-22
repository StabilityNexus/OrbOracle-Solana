import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token'
import { Oracle } from '../target/types/oracle'

describe('oracle program integration', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Oracle as Program<Oracle>
  const wallet = provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }

  let weightMint: PublicKey
  let oracleState: PublicKey
  let oracleVault: PublicKey
  let userTokenAccount: PublicKey
  let userState: PublicKey

  const depositAmount = 1_000_000
  const submissionValue = new anchor.BN(123456)

  beforeAll(async () => {
    weightMint = await createMint(provider.connection, wallet.payer, wallet.publicKey, null, 6)

    const userToken = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      weightMint,
      wallet.publicKey,
    )
    userTokenAccount = userToken.address

    await mintTo(
      provider.connection,
      wallet.payer,
      weightMint,
      userTokenAccount,
      wallet.publicKey,
      depositAmount,
    )

    const seeds = [Buffer.from('oracle'), wallet.publicKey.toBuffer(), weightMint.toBuffer()]
    ;[oracleState] = PublicKey.findProgramAddressSync(seeds, program.programId)
    oracleVault = await getAssociatedTokenAddress(weightMint, oracleState, true)

    ;[userState] = PublicKey.findProgramAddressSync(
      [Buffer.from('user'), oracleState.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId,
    )
  })

  it('exposes a valid program id', () => {
    expect(program.programId).toBeInstanceOf(PublicKey)
  })

  it('initializes oracle state', async () => {
    const params = {
      name: 'Integration Test Oracle',
      description: 'Oracle initialized in automated test suite',
      rewardBps: new anchor.BN(500),
      halfLifeSeconds: new anchor.BN(120),
      quorum: new anchor.BN(100),
      depositLockingPeriod: new anchor.BN(0),
      withdrawalLockingPeriod: new anchor.BN(0),
      alpha: new anchor.BN(1),
    }

    const signature = await program.methods
      .initialize(params)
      .accounts({
        payer: wallet.publicKey,
        authority: wallet.publicKey,
        weightMint,
        oracleState,
        oracleVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc()

    expect(typeof signature).toBe('string')

    const state = await program.account.oracleState.fetch(oracleState)
    expect(state.authority.toBase58()).toBe(wallet.publicKey.toBase58())
    expect(state.weightMint.toBase58()).toBe(weightMint.toBase58())
    expect(state.name).toBe(params.name)
    expect(state.description).toBe(params.description)
    expect(state.rewardBps.eq(params.rewardBps)).toBe(true)
    expect(state.halfLifeSeconds.eq(params.halfLifeSeconds)).toBe(true)
    expect(state.quorum.eq(params.quorum)).toBe(true)
    expect(state.depositLockingPeriod.eq(params.depositLockingPeriod)).toBe(true)
    expect(state.withdrawalLockingPeriod.eq(params.withdrawalLockingPeriod)).toBe(true)
    expect(state.alpha.eq(params.alpha)).toBe(true)
    expect(state.priceHistory.length).toBe(0)
    expect(state.targets.length).toBe(0)

    const vaultAccount = await getAccount(provider.connection, oracleVault)
    expect(vaultAccount.owner.toBase58()).toBe(oracleState.toBase58())
    expect(vaultAccount.mint.toBase58()).toBe(weightMint.toBase58())
  }, 60000)

  it('deposits weight tokens and creates user state', async () => {
    const signature = await program.methods
      .depositTokens(new anchor.BN(depositAmount))
      .accounts({
        user: wallet.publicKey,
        weightMint,
        oracleState,
        userTokenAccount,
        oracleVault,
        userState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc()

    expect(typeof signature).toBe('string')

    const state = await program.account.oracleState.fetch(oracleState)
    expect(state.totalDepositedTokens.eq(new anchor.BN(depositAmount))).toBe(true)

    const userAccount = await program.account.userState.fetch(userState)
    expect(userAccount.lockedTokens.toNumber()).toBe(depositAmount)
    expect(userAccount.unlockedTokens.toNumber()).toBe(0)

    const vaultAccount = await getAccount(provider.connection, oracleVault)
    expect(Number(vaultAccount.amount)).toBe(depositAmount)
  }, 60000)

  const ensureOracleFunded = async (lamports: number | anchor.BN) => {
    const amount = anchor.BN.isBN(lamports) ? lamports : new anchor.BN(lamports)
    await program.methods
      .fund(amount)
      .accounts({
        funder: wallet.publicKey,
        oracleState,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  }

  it('submits an oracle value and records price history', async () => {
    await ensureOracleFunded(1_000_000)

    const signature = await program.methods
      .submitValue(submissionValue)
      .accounts({
        user: wallet.publicKey,
        oracleState,
        userState,
      })
      .rpc()

    expect(typeof signature).toBe('string')

    const state = await program.account.oracleState.fetch(oracleState)
    expect(state.latestValue.eq(submissionValue)).toBe(true)
    expect(state.priceHistory.length).toBeGreaterThan(0)
    const lastRecord = state.priceHistory[state.priceHistory.length - 1]
    expect(lastRecord.latestValue.eq(submissionValue)).toBe(true)

    const userAccount = await program.account.userState.fetch(userState)
    expect(userAccount.lastSubmittedPrice.eq(submissionValue)).toBe(true)
    expect(userAccount.unlockedTokens.toNumber()).toBe(depositAmount)
  }, 60000)

  it('allows submitting multiple oracle values sequentially', async () => {
    await ensureOracleFunded(1_000_000)

    const nextValue = submissionValue.add(new anchor.BN(654321))

    let signature: string
    try {
      signature = await program.methods
        .submitValue(nextValue)
        .accounts({
          user: wallet.publicKey,
          oracleState,
          userState,
        })
        .rpc()
    } catch (error: any) {
      console.error('second submission failed', error, error?.logs)
      throw error
    }

    expect(typeof signature).toBe('string')

    const state = await program.account.oracleState.fetch(oracleState)
    expect(state.latestValue.eq(nextValue)).toBe(true)
    expect(state.priceHistory.length).toBeGreaterThan(1)
    const lastRecord = state.priceHistory[state.priceHistory.length - 1]
    expect(lastRecord.latestValue.eq(nextValue)).toBe(true)

    const userAccount = await program.account.userState.fetch(userState)
    expect(userAccount.lastSubmittedPrice.eq(nextValue)).toBe(true)
    expect(userAccount.unlockedTokens.toNumber()).toBe(depositAmount)
  }, 60000)

  it('casts whitelist and blacklist votes', async () => {
    const whitelistTarget = anchor.web3.Keypair.generate().publicKey
    const whitelistSignature = await program.methods
      .voteWhitelist(whitelistTarget)
      .accounts({
        user: wallet.publicKey,
        oracleState,
        userState,
      })
      .rpc()

    expect(typeof whitelistSignature).toBe('string')

    const stateAfterWhitelist = await program.account.oracleState.fetch(oracleState)
    const whitelistRecord = stateAfterWhitelist.targets.find((record) =>
      record.target.toBase58() === whitelistTarget.toBase58(),
    )
    expect(whitelistRecord).toBeDefined()
    expect(whitelistRecord?.whitelistVotes.toNumber()).toBe(depositAmount)
    expect(whitelistRecord?.isBlacklisted).toBe(false)

    const blacklistTarget = anchor.web3.Keypair.generate().publicKey
    const blacklistSignature = await program.methods
      .voteBlacklist(blacklistTarget)
      .accounts({
        user: wallet.publicKey,
        oracleState,
        userState,
      })
      .rpc()

    expect(typeof blacklistSignature).toBe('string')

    const stateAfterBlacklist = await program.account.oracleState.fetch(oracleState)
    const blacklistRecord = stateAfterBlacklist.targets.find((record) =>
      record.target.toBase58() === blacklistTarget.toBase58(),
    )
    expect(blacklistRecord).toBeDefined()
    expect(blacklistRecord?.blacklistVotes.toNumber()).toBe(depositAmount)
  }, 60000)
})
