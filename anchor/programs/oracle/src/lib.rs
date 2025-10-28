#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{clock::Clock, program::invoke, system_instruction}; 
use anchor_spl::associated_token::AssociatedToken; 
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("9oPLPE3PC9ok7T8UL9ZMfrNyPkhtaHh1mM9wFk2fWEVJ");

const MAX_HISTORY_ENTRIES: usize = 128;
const MAX_TARGET_RECORDS: usize = 64;
const MAX_USER_VOTES: usize = 64;
const DENOMINATOR: u64 = 100_000;
const WAD: u128 = 1_000_000_000_000_000_000;

#[program]
pub mod oracle {
    use super::*;

    pub fn initialize(ctx: Context<InitializeOracle>, params: InitializeOracleParams) -> Result<()> {
        require!(!params.name.is_empty(), OracleError::InvalidName);
        require!(
            params.name.len() <= OracleState::MAX_NAME_LEN,
            OracleError::InvalidName
        );
        require!(
            params.description.len() <= OracleState::MAX_DESCRIPTION_LEN,
            OracleError::InvalidDescription
        );
        require!(params.reward_bps <= DENOMINATOR, OracleError::InvalidRewardRate);

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        let state = &mut ctx.accounts.oracle_state;
        let (expected_state, bump) = Pubkey::find_program_address(
            &[
                b"oracle",
                ctx.accounts.authority.key().as_ref(),
                ctx.accounts.weight_mint.key().as_ref(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(expected_state, state.key(), OracleError::InvalidPda);
        state.authority = ctx.accounts.authority.key();
        state.weight_mint = ctx.accounts.weight_mint.key();
        state.reward_bps = params.reward_bps;
        state.half_life_seconds = params.half_life_seconds;
        state.quorum = params.quorum;
        state.deposit_locking_period = params.deposit_locking_period;
        state.withdrawal_locking_period = params.withdrawal_locking_period;
        state.alpha = params.alpha;
        state.aggregated_value = 0;
        state.latest_value = 0;
        state.aggregated_weight = 0;
        state.last_submission_time = now;
        state.last_timestamp = now;
        state.total_deposited_tokens = 0;
        state.name = params.name;
        state.description = params.description;
        state.price_history = Vec::new();
        state.targets = Vec::new();
        state.bump = bump;

        Ok(())
    }

    pub fn fund(ctx: Context<FundOracle>, amount: u64) -> Result<()> {
        require!(amount > 0, OracleError::AmountMustBePositive);

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.funder.key(),
                &ctx.accounts.oracle_state.key(),
                amount,
            ),
            &[
                ctx.accounts.funder.to_account_info(),
                ctx.accounts.oracle_state.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let now = Clock::get()?.unix_timestamp;
        ctx.accounts.oracle_state.last_timestamp = now;

        emit!(Funded {
            from: ctx.accounts.funder.key(),
            amount,
        });

        Ok(())
    }

    pub fn deposit_tokens(ctx: Context<DepositTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, OracleError::AmountMustBePositive);

        let now = Clock::get()?.unix_timestamp;
        let state = &mut ctx.accounts.oracle_state;
        let user_state = &mut ctx.accounts.user_state;

        let (expected_user, user_bump) = Pubkey::find_program_address(
            &[
                b"user",
                state.key().as_ref(),
                ctx.accounts.user.key().as_ref(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(expected_user, user_state.key(), OracleError::InvalidPda);
        user_state.ensure_initialized(state.key(), ctx.accounts.user.key(), user_bump)?;

        unlock_tokens_if_possible(state, user_state, now);

        let transfer_accounts = token::Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.oracle_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts),
            amount,
        )?;

        user_state.locked_tokens = user_state 
            .locked_tokens
            .checked_add(amount)
            .ok_or(OracleError::MathOverflow)?;

        state.total_deposited_tokens = state
            .total_deposited_tokens
            .checked_add(amount)
            .ok_or(OracleError::MathOverflow)?;

        user_state.deposit_timestamp = now;
        user_state.last_operation_timestamp = now;
        state.last_timestamp = now;

        emit!(TokenDeposited {
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, OracleError::AmountMustBePositive);

        let now = Clock::get()?.unix_timestamp;
        let state = &mut ctx.accounts.oracle_state;
        let user_state = &mut ctx.accounts.user_state;

        unlock_tokens_if_possible(state, user_state, now);
        require!(
            user_state.unlocked_tokens >= amount,
            OracleError::InsufficientUnlockedTokens
        );

        let unlock_ready = user_state
            .last_operation_timestamp
            .checked_add(state.withdrawal_locking_period as i64)
            .ok_or(OracleError::MathOverflow)?;
        require!(now >= unlock_ready, OracleError::WithdrawalLocked);

        user_state.unlocked_tokens = user_state
            .unlocked_tokens
            .checked_sub(amount)
            .ok_or(OracleError::MathUnderflow)?;
        state.total_deposited_tokens = state
            .total_deposited_tokens
            .checked_sub(amount)
            .ok_or(OracleError::MathUnderflow)?;

        apply_new_weight_to_votes(state, user_state, user_state.unlocked_tokens)?;

        let bump_seed = &[state.bump];
        let signer_seeds: &[&[u8]] = &[
            b"oracle",
            state.authority.as_ref(),
            state.weight_mint.as_ref(),
            bump_seed,
        ];

        {
            let authority_info = state.to_account_info();
            let transfer_accounts = token::Transfer {
                from: ctx.accounts.oracle_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: authority_info.clone(),
            };
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_accounts,
                    &[signer_seeds],
                ),
                amount,
            )?;
        }

        state.last_timestamp = now;

        emit!(TokenWithdrawn {
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    pub fn submit_value(ctx: Context<SubmitValue>, new_value: i128) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        let user_state = &mut ctx.accounts.user_state;
        let now = Clock::get()?.unix_timestamp;

        require!(
            !state.is_blacklisted(&ctx.accounts.user.key()),
            OracleError::AccountBlacklisted
        );

        unlock_tokens_if_possible(state, user_state, now);
        require!(
            user_state.unlocked_tokens > 0,
            OracleError::NoUnlockedTokens
        );

        let weight = u128::from(user_state.unlocked_tokens);
        let elapsed_global = time_difference(now, state.last_submission_time);
        let decayed_q =
            decay::apply_decay(state.aggregated_weight, elapsed_global, state.half_life_seconds)?;

        let time_since_user = time_difference(now, user_state.last_submission_time);
        let old_weight = u128::from(user_state.weight);
        let user_weight_decayed =
            decay::apply_decay(old_weight, time_since_user, state.half_life_seconds)?;

        let decayed_q_i128 = to_i128(decayed_q)?;
        let user_weight_decayed_i128 = to_i128(user_weight_decayed)?;
        let weight_i128 = to_i128(weight)?;

        let mut numerator = state
            .aggregated_value
            .checked_mul(decayed_q_i128)
            .ok_or(OracleError::MathOverflow)?;

        if user_weight_decayed > 0 {
            numerator = numerator
                .checked_sub(
                    user_state
                        .last_submitted_price
                        .checked_mul(user_weight_decayed_i128)
                        .ok_or(OracleError::MathOverflow)?,
                )
                .ok_or(OracleError::MathUnderflow)?;
        }

        let new_q = decayed_q
            .checked_sub(user_weight_decayed)
            .ok_or(OracleError::MathUnderflow)?
            .checked_add(weight)
            .ok_or(OracleError::MathOverflow)?;
        require!(new_q > 0, OracleError::ZeroWeightAfterUpdate);

        numerator = numerator
            .checked_add(
                new_value
                    .checked_mul(weight_i128)
                    .ok_or(OracleError::MathOverflow)?,
            )
            .ok_or(OracleError::MathOverflow)?;

        let new_p = numerator
            .checked_div(to_i128(new_q)?)
            .ok_or(OracleError::MathUnderflow)?;

        let balance = state.to_account_info().lamports();
        let reward_pool = (u128::from(balance)
            .checked_mul(u128::from(state.reward_bps))
            .ok_or(OracleError::MathOverflow)?)
            / u128::from(DENOMINATOR);

        let reward = decay::calculate_reward(
            reward_pool,
            user_state.unlocked_tokens,
            time_since_user,
            decayed_q,
            state.alpha,
            state.half_life_seconds,
        )?;

        if reward > 0 {
            let state_info = state.to_account_info();
            let user_info = ctx.accounts.user.to_account_info();

            **state_info.try_borrow_mut_lamports()? = state_info
                .lamports()
                .checked_sub(reward)
                .ok_or(OracleError::MathUnderflow)?;
            **user_info.try_borrow_mut_lamports()? = user_info
                .lamports()
                .checked_add(reward)
                .ok_or(OracleError::MathOverflow)?;
        }

        state.aggregated_value = new_p;
        state.latest_value = new_value;
        state.aggregated_weight = new_q;
        state.last_submission_time = now;
        state.last_timestamp = now;

        user_state.last_submitted_price = new_value;
        user_state.weight = user_state.unlocked_tokens;
        user_state.last_submission_time = now;
        user_state.last_operation_timestamp = now;

        push_price_history(state, now, new_p, new_value)?;

        emit!(ValueSubmitted {
            submitter: ctx.accounts.user.key(),
            timestamp: now,
            submitted_value: new_value,
            aggregated_value: new_p,
            weight: user_state.unlocked_tokens,
            reward_lamports: reward,
        });

        Ok(())
    }

    pub fn update_user_vote_weights(ctx: Context<UpdateUserVoteWeights>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let state = &mut ctx.accounts.oracle_state;
        let user_state = &mut ctx.accounts.user_state;

        unlock_tokens_if_possible(state, user_state, now);
        require!(
            user_state.unlocked_tokens > 0,
            OracleError::NoUnlockedTokens
        );

        apply_new_weight_to_votes(state, user_state, user_state.unlocked_tokens)?;
        user_state.last_operation_timestamp = now;
        state.last_timestamp = now;

        Ok(())
    }

    pub fn vote_blacklist(ctx: Context<Vote>, target: Pubkey) -> Result<()> {
        process_vote(ctx, target, VoteKind::Blacklist)
    }

    pub fn vote_whitelist(ctx: Context<Vote>, target: Pubkey) -> Result<()> {
        process_vote(ctx, target, VoteKind::Whitelist)
    }
}

fn process_vote(ctx: Context<Vote>, target: Pubkey, kind: VoteKind) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let state = &mut ctx.accounts.oracle_state;
    let voter_state = &mut ctx.accounts.user_state;

    require!(
        !state.is_blacklisted(&ctx.accounts.user.key()),
        OracleError::AccountBlacklisted
    );

    unlock_tokens_if_possible(state, voter_state, now);
    let weight = voter_state.unlocked_tokens;
    require!(weight > 0, OracleError::NoUnlockedTokens);

    match kind {
        VoteKind::Blacklist => {
            require!(
                voter_state
                    .blacklist_votes
                    .iter()
                    .all(|vote| vote.target != target),
                OracleError::AlreadyVoted
            );
            require!(
                voter_state.blacklist_votes.len() < MAX_USER_VOTES,
                OracleError::TooManyVotes
            );
            let idx = state.upsert_target(target)?;
            state.targets[idx].blacklist_votes = state.targets[idx]
                .blacklist_votes
                .checked_add(weight)
                .ok_or(OracleError::MathOverflow)?;
            let changed = state.refresh_blacklist_status(idx);
            voter_state.blacklist_votes.push(UserVote { target, weight });
            if changed {
                emit!(BlacklistStatusChanged {
                    target,
                    is_blacklisted: state.targets[idx].is_blacklisted,
                });
            }
        }
        VoteKind::Whitelist => {
            require!(
                voter_state
                    .whitelist_votes
                    .iter()
                    .all(|vote| vote.target != target),
                OracleError::AlreadyVoted
            );
            require!(
                voter_state.whitelist_votes.len() < MAX_USER_VOTES,
                OracleError::TooManyVotes
            );
            let idx = state.upsert_target(target)?;
            state.targets[idx].whitelist_votes = state.targets[idx]
                .whitelist_votes
                .checked_add(weight)
                .ok_or(OracleError::MathOverflow)?;
            let changed = state.refresh_blacklist_status(idx);
            voter_state.whitelist_votes.push(UserVote { target, weight });
            if changed {
                emit!(BlacklistStatusChanged {
                    target,
                    is_blacklisted: state.targets[idx].is_blacklisted,
                });
            }
        }
    }

    voter_state.last_operation_timestamp = now;
    state.last_timestamp = now;

    emit!(Voted {
        target,
        voter: ctx.accounts.user.key(),
        is_blacklist: matches!(kind, VoteKind::Blacklist),
        weight,
    });

    Ok(())
}

fn unlock_tokens_if_possible(state: &Account<OracleState>, user_state: &mut Account<UserState>, now: i64) {
    if user_state.locked_tokens == 0 {
        return;
    }
    let unlock_ready = user_state
        .deposit_timestamp
        .saturating_add(state.deposit_locking_period as i64);
    if now >= unlock_ready {
        user_state.unlocked_tokens = user_state
            .unlocked_tokens
            .saturating_add(user_state.locked_tokens);
        user_state.locked_tokens = 0;
    }
}

fn apply_new_weight_to_votes(
    state: &mut Account<OracleState>,
    user_state: &mut Account<UserState>,
    new_weight: u64,
) -> Result<()> {
    for vote in user_state.blacklist_votes.iter_mut() {
        let idx = state.upsert_target(vote.target)?;
        state.targets[idx].blacklist_votes = state.targets[idx]
            .blacklist_votes
            .checked_sub(vote.weight)
            .ok_or(OracleError::MathUnderflow)?
            .checked_add(new_weight)
            .ok_or(OracleError::MathOverflow)?;
        vote.weight = new_weight;
        if state.refresh_blacklist_status(idx) {
            emit!(BlacklistStatusChanged {
                target: vote.target,
                is_blacklisted: state.targets[idx].is_blacklisted,
            });
        }
    }

    for vote in user_state.whitelist_votes.iter_mut() {
        let idx = state.upsert_target(vote.target)?;
        state.targets[idx].whitelist_votes = state.targets[idx]
            .whitelist_votes
            .checked_sub(vote.weight)
            .ok_or(OracleError::MathUnderflow)?
            .checked_add(new_weight)
            .ok_or(OracleError::MathOverflow)?;
        vote.weight = new_weight;
        if state.refresh_blacklist_status(idx) {
            emit!(BlacklistStatusChanged {
                target: vote.target,
                is_blacklisted: state.targets[idx].is_blacklisted,
            });
        }
    }

    Ok(())
}

fn push_price_history(
    state: &mut Account<OracleState>,
    timestamp: i64,
    aggregated_value: i128,
    latest_value: i128,
) -> Result<()> {
    if state.price_history.len() == MAX_HISTORY_ENTRIES {
        state.price_history.remove(0);
    }
    state.price_history.push(PriceRecord {
        timestamp,
        aggregated_value,
        latest_value,
    });
    Ok(())
}

fn time_difference(now: i64, previous: i64) -> u64 {
    if now <= previous {
        0
    } else {
        (now - previous) as u64
    }
}

fn to_i128(value: u128) -> Result<i128> {
    i128::try_from(value).map_err(|_| error!(OracleError::MathOverflow))
}

fn process_pow2_neg_int(k: u64) -> u128 {
    match k {
        0 => 1_000_000_000_000_000_000,
        1 => 500_000_000_000_000_000,
        2 => 250_000_000_000_000_000,
        3 => 125_000_000_000_000_000,
        4 => 62_500_000_000_000_000,
        5 => 31_250_000_000_000_000,
        6 => 15_625_000_000_000_000,
        7 => 7_812_500_000_000_000,
        8 => 3_906_250_000_000_000,
        9 => 1_953_125_000_000_000,
        10 => 976_562_500_000_000,
        11 => 488_281_250_000_000,
        12 => 244_140_625_000_000,
        13 => 122_070_312_500_000,
        14 => 61_035_156_250_000,
        15 => 30_517_578_125_000,
        16 => 15_258_789_062_500,
        17 => 7_629_394_531_250,
        18 => 3_814_697_265_625,
        19 => 1_907_348_632_812,
        20 => 953_674_316_406,
        21 => 476_837_158_203,
        22 => 238_418_579_102,
        23 => 119_209_289_551,
        24 => 59_604_644_775,
        25 => 29_802_322_388,
        26 => 14_901_161_194,
        27 => 7_450_580_597,
        28 => 3_725_290_298,
        29 => 1_862_645_149,
        30 => 931_322_574,
        31 => 465_661_287,
        32 => 232_830_643,
        33 => 116_415_322,
        34 => 58_207_661,
        35 => 29_103_831,
        36 => 14_551_915,
        37 => 7_275_958,
        38 => 3_637_979,
        39 => 1_818_989,
        40 => 909_495,
        41 => 454_747,
        42 => 227_373,
        43 => 113_687,
        44 => 56_843,
        45 => 28_422,
        46 => 14_211,
        47 => 7_105,
        48 => 3_553,
        49 => 1_776,
        50 => 888,
        51 => 444,
        52 => 222,
        53 => 111,
        54 => 56,
        55 => 28,
        56 => 14,
        57 => 7,
        58 => 3,
        59 => 2,
        60 => 1,
        _ => 0,
    }
}

mod decay {
    use super::*;

    pub fn apply_decay(value: u128, elapsed: u64, half_life_seconds: u64) -> Result<u128> {
        if value == 0 {
            return Ok(0);
        }
        if half_life_seconds == 0 || elapsed == 0 {
            return Ok(value);
        }
        let factor = decay_factor(elapsed, half_life_seconds);
        let decayed = value
            .checked_mul(factor)
            .ok_or(OracleError::MathOverflow)?
            .checked_div(WAD)
            .ok_or(OracleError::MathUnderflow)?;
        Ok(decayed)
    }

    pub fn decay_factor(elapsed: u64, half_life_seconds: u64) -> u128 {
        if elapsed == 0 || half_life_seconds == 0 {
            return WAD;
        }

        let scaled = (u128::from(elapsed) * u128::from(DENOMINATOR)) / u128::from(half_life_seconds);
        if scaled >= 61 * u128::from(DENOMINATOR) {
            return 1;
        }

        let k = (scaled / u128::from(DENOMINATOR)) as u64;
        let frac = scaled % u128::from(DENOMINATOR);

        if frac == 0 {
            return process_pow2_neg_int(k);
        }
        let hi = process_pow2_neg_int(k);
        let lo = if k < 60 {
            process_pow2_neg_int(k + 1)
        } else {
            0
        };

        hi - ((hi - lo) * frac / u128::from(DENOMINATOR))
    }

    fn activity_factor(elapsed: u64, half_life_seconds: u64) -> u128 {
        let decay = decay_factor(elapsed, half_life_seconds);
        if decay >= WAD {
            0
        } else {
            WAD - decay
        }
    }

    pub fn calculate_reward(
        reward_pool: u128,
        weight: u64,
        elapsed: u64,
        total_weight: u128,
        alpha: u64,
        half_life_seconds: u64,
    ) -> Result<u64> {
        if reward_pool == 0 || weight == 0 || total_weight == 0 {
            return Ok(0);
        }
        let activity = activity_factor(elapsed, half_life_seconds);
        if activity == 0 {
            return Ok(0);
        }
        let num = u128::from(weight)
            .checked_mul(activity)
            .ok_or(OracleError::MathOverflow)?
            .checked_div(WAD)
            .ok_or(OracleError::MathUnderflow)?;

        let reward = u128::from(alpha)
            .checked_mul(reward_pool)
            .ok_or(OracleError::MathOverflow)?
            .checked_mul(num)
            .ok_or(OracleError::MathOverflow)?
            .checked_div(total_weight)
            .ok_or(OracleError::MathUnderflow)?;

        u64::try_from(reward).map_err(|_| error!(OracleError::MathOverflow))
    }
}

#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    pub weight_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + OracleState::SPACE,
        seeds = [b"oracle", authority.key().as_ref(), weight_mint.key().as_ref()],
        bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = weight_mint,
        associated_token::authority = oracle_state,
    )]
    pub oracle_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundOracle<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(
        mut,
        seeds = [b"oracle", oracle_state.authority.as_ref(), oracle_state.weight_mint.as_ref()],
        bump = oracle_state.bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub weight_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"oracle", oracle_state.authority.as_ref(), oracle_state.weight_mint.as_ref()],
        bump = oracle_state.bump,
        constraint = oracle_state.weight_mint == weight_mint.key()
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        mut,
        associated_token::mint = weight_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = weight_mint,
        associated_token::authority = oracle_state,
    )]
    pub oracle_vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserState::SPACE,
        seeds = [b"user", oracle_state.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = user_state.owner == Pubkey::default() || user_state.owner == user.key()
    )]
    pub user_state: Account<'info, UserState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub weight_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"oracle", oracle_state.authority.as_ref(), oracle_state.weight_mint.as_ref()],
        bump = oracle_state.bump,
        constraint = oracle_state.weight_mint == weight_mint.key()
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        mut,
        associated_token::mint = weight_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = weight_mint,
        associated_token::authority = oracle_state,
    )]
    pub oracle_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"user", oracle_state.key().as_ref(), user.key().as_ref()],
        bump = user_state.bump,
        constraint = user_state.owner == user.key()
    )]
    pub user_state: Account<'info, UserState>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SubmitValue<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"oracle", oracle_state.authority.as_ref(), oracle_state.weight_mint.as_ref()],
        bump = oracle_state.bump,
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        mut,
        seeds = [b"user", oracle_state.key().as_ref(), user.key().as_ref()],
        bump = user_state.bump,
        constraint = user_state.owner == user.key()
    )]
    pub user_state: Account<'info, UserState>,
}

#[derive(Accounts)]
pub struct UpdateUserVoteWeights<'info> {
    #[account(mut)] 
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"oracle", oracle_state.authority.as_ref(), oracle_state.weight_mint.as_ref()],
        bump = oracle_state.bump,
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        mut,
        seeds = [b"user", oracle_state.key().as_ref(), user.key().as_ref()],
        bump = user_state.bump,
        constraint = user_state.owner == user.key()
    )]
    pub user_state: Account<'info, UserState>,
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"oracle", oracle_state.authority.as_ref(), oracle_state.weight_mint.as_ref()],
        bump = oracle_state.bump,
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        mut,
        seeds = [b"user", oracle_state.key().as_ref(), user.key().as_ref()],
        bump = user_state.bump,
        constraint = user_state.owner == user.key()
    )]
    pub user_state: Account<'info, UserState>,
}

#[account]
pub struct OracleState {
    pub authority: Pubkey,
    pub weight_mint: Pubkey,
    pub reward_bps: u64,
    pub half_life_seconds: u64,
    pub quorum: u64,
    pub deposit_locking_period: u64,
    pub withdrawal_locking_period: u64,
    pub alpha: u64,
    pub aggregated_value: i128,
    pub latest_value: i128,
    pub aggregated_weight: u128,
    pub last_submission_time: i64,
    pub last_timestamp: i64,
    pub total_deposited_tokens: u64,
    pub bump: u8,
    pub name: String,
    pub description: String,
    pub price_history: Vec<PriceRecord>,
    pub targets: Vec<TargetVotes>,
}

impl OracleState {
    pub const MAX_NAME_LEN: usize = 64;
    pub const MAX_DESCRIPTION_LEN: usize = 256;
    pub const MAX_HISTORY_CAPACITY: usize = MAX_HISTORY_ENTRIES;
    pub const MAX_TARGET_CAPACITY: usize = MAX_TARGET_RECORDS;
    const PRICE_RECORD_SIZE: usize = 8 + 16 + 16;
    const TARGET_VOTES_SIZE: usize = 32 + 8 + 8 + 1;
    pub const SPACE: usize =
        32 + // authority
        32 + // weight_mint
        8 + // reward_bps
        8 + // half_life_seconds
        8 + // quorum
        8 + // deposit_locking_period
        8 + // withdrawal_locking_period
        8 + // alpha
        16 + // aggregated_value
        16 + // latest_value
        16 + // aggregated_weight
        8 + // last_submission_time
        8 + // last_timestamp
        8 + // total_deposited_tokens
        1 + // bump
        4 + Self::MAX_NAME_LEN +
        4 + Self::MAX_DESCRIPTION_LEN +
        4 + Self::MAX_HISTORY_CAPACITY * Self::PRICE_RECORD_SIZE +
        4 + Self::MAX_TARGET_CAPACITY * Self::TARGET_VOTES_SIZE +
        64; // buffer for future extensions

    fn is_blacklisted(&self, target: &Pubkey) -> bool {
        self.targets
            .iter()
            .find(|record| &record.target == target)
            .map(|record| record.is_blacklisted)
            .unwrap_or(false)
    }

    fn upsert_target(&mut self, target: Pubkey) -> Result<usize> {
        if let Some((index, _)) = self
            .targets
            .iter()
            .enumerate()
            .find(|(_, record)| record.target == target)
        {
            return Ok(index);
        }

        require!(
            self.targets.len() < MAX_TARGET_RECORDS,
            OracleError::TooManyTargets
        );
        self.targets.push(TargetVotes::new(target));
        Ok(self.targets.len() - 1)
    }

    fn refresh_blacklist_status(&mut self, idx: usize) -> bool {
        let record = &mut self.targets[idx];
        let total_votes = record
            .blacklist_votes
            .saturating_add(record.whitelist_votes);
        let should_blacklist =
            record.blacklist_votes > record.whitelist_votes && total_votes > self.quorum;
        let changed = record.is_blacklisted != should_blacklist;
        record.is_blacklisted = should_blacklist;
        changed
    }
}

#[account]
pub struct UserState {
    pub oracle: Pubkey,
    pub owner: Pubkey,
    pub locked_tokens: u64,
    pub unlocked_tokens: u64,
    pub deposit_timestamp: i64,
    pub last_operation_timestamp: i64,
    pub last_submission_time: i64,
    pub last_submitted_price: i128,
    pub weight: u64,
    pub initialized: bool,
    pub bump: u8,
    pub blacklist_votes: Vec<UserVote>,
    pub whitelist_votes: Vec<UserVote>,
}

impl UserState {
    pub const MAX_VOTES: usize = MAX_USER_VOTES;
    const USER_VOTE_SIZE: usize = 32 + 8;
    pub const SPACE: usize =
        32 + // oracle
        32 + // owner
        8 + // locked_tokens
        8 + // unlocked_tokens
        8 + // deposit_timestamp
        8 + // last_operation_timestamp
        8 + // last_submission_time
        16 + // last_submitted_price
        8 + // weight
        1 + // initialized
        1 + // bump
        4 + Self::MAX_VOTES * Self::USER_VOTE_SIZE + // blacklist_votes
        4 + Self::MAX_VOTES * Self::USER_VOTE_SIZE + // whitelist_votes
        32; // buffer for future fields

    fn ensure_initialized(&mut self, oracle: Pubkey, owner: Pubkey, bump: u8) -> Result<()> {
        if !self.initialized {
            self.oracle = oracle;
            self.owner = owner;
            self.initialized = true;
            self.bump = bump;
        } else {
            require!(
                self.oracle == oracle && self.owner == owner,
                OracleError::InvalidAuthority
            );
        }
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PriceRecord {
    pub timestamp: i64,
    pub aggregated_value: i128,
    pub latest_value: i128,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TargetVotes {
    pub target: Pubkey,
    pub blacklist_votes: u64,
    pub whitelist_votes: u64,
    pub is_blacklisted: bool,
}

impl TargetVotes {
    fn new(target: Pubkey) -> Self {
        Self {
            target,
            blacklist_votes: 0,
            whitelist_votes: 0,
            is_blacklisted: false,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UserVote {
    pub target: Pubkey,
    pub weight: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeOracleParams {
    pub name: String,
    pub description: String,
    pub reward_bps: u64,
    pub half_life_seconds: u64,
    pub quorum: u64,
    pub deposit_locking_period: u64,
    pub withdrawal_locking_period: u64,
    pub alpha: u64,
}

#[derive(Clone, Copy)]
enum VoteKind {
    Blacklist,
    Whitelist,
}

#[event]
pub struct ValueSubmitted {
    pub submitter: Pubkey,
    pub timestamp: i64,
    pub submitted_value: i128,
    pub aggregated_value: i128,
    pub weight: u64,
    pub reward_lamports: u64,
}

#[event]
pub struct Funded {
    pub from: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokenDeposited {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokenWithdrawn {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Voted {
    pub target: Pubkey,
    pub voter: Pubkey,
    pub is_blacklist: bool,
    pub weight: u64,
}

#[event]
pub struct BlacklistStatusChanged {
    pub target: Pubkey,
    pub is_blacklisted: bool,
}

#[error_code]
pub enum OracleError {
    #[msg("Invalid oracle name provided")]
    InvalidName,
    #[msg("Invalid oracle description provided")]
    InvalidDescription,
    #[msg("Reward rate must be less than or equal to denominator")]
    InvalidRewardRate,
    #[msg("Provided account does not match derived PDA")]
    InvalidPda,
    #[msg("Amount must be positive")]
    AmountMustBePositive,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Math underflow")]
    MathUnderflow,
    #[msg("Withdrawal still locked")]
    WithdrawalLocked,
    #[msg("Insufficient unlocked tokens")]
    InsufficientUnlockedTokens,
    #[msg("Account is blacklisted")]
    AccountBlacklisted,
    #[msg("No unlocked tokens available")]
    NoUnlockedTokens,
    #[msg("Weight updates resulted in zero total weight")]
    ZeroWeightAfterUpdate,
    #[msg("User has already voted on this target")]
    AlreadyVoted,
    #[msg("Exceeded vote capacity for user")]
    TooManyVotes,
    #[msg("Exceeded governance target capacity")]
    TooManyTargets,
    #[msg("Account authority does not match expected value")]
    InvalidAuthority,
}
