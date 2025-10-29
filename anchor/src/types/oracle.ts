/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/oracle.json`.
 */
export type Oracle = {
  "address": "9oPLPE3PC9ok7T8UL9ZMfrNyPkhtaHh1mM9wFk2fWEVJ",
  "metadata": {
    "name": "oracle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Oracle program translated from Solidity"
  },
  "instructions": [
    {
      "name": "depositTokens",
      "discriminator": [
        176,
        83,
        229,
        18,
        191,
        143,
        176,
        150
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "weightMint"
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "weightMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "oracleVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "weightMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fund",
      "discriminator": [
        218,
        188,
        111,
        221,
        152,
        113,
        174,
        7
      ],
      "accounts": [
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "weightMint"
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "weightMint"
              }
            ]
          }
        },
        {
          "name": "oracleVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "weightMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeOracleParams"
            }
          }
        }
      ]
    },
    {
      "name": "submitValue",
      "discriminator": [
        200,
        19,
        205,
        48,
        129,
        237,
        209,
        223
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newValue",
          "type": "i128"
        }
      ]
    },
    {
      "name": "updateUserVoteWeights",
      "discriminator": [
        145,
        4,
        15,
        172,
        0,
        39,
        22,
        7
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "voteBlacklist",
      "discriminator": [
        50,
        191,
        156,
        171,
        117,
        193,
        217,
        166
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "target",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "voteWhitelist",
      "discriminator": [
        143,
        5,
        118,
        62,
        182,
        242,
        171,
        94
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "target",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdrawTokens",
      "discriminator": [
        2,
        4,
        225,
        61,
        19,
        182,
        106,
        170
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "weightMint"
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.authority",
                "account": "oracleState"
              },
              {
                "kind": "account",
                "path": "oracle_state.weight_mint",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "weightMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "oracleVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "weightMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "oracleState"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "oracleState",
      "discriminator": [
        97,
        156,
        157,
        189,
        194,
        73,
        8,
        15
      ]
    },
    {
      "name": "userState",
      "discriminator": [
        72,
        177,
        85,
        249,
        76,
        167,
        186,
        126
      ]
    }
  ],
  "events": [
    {
      "name": "blacklistStatusChanged",
      "discriminator": [
        199,
        100,
        107,
        197,
        207,
        115,
        231,
        166
      ]
    },
    {
      "name": "funded",
      "discriminator": [
        67,
        84,
        56,
        88,
        192,
        12,
        201,
        177
      ]
    },
    {
      "name": "tokenDeposited",
      "discriminator": [
        104,
        7,
        18,
        187,
        94,
        141,
        251,
        120
      ]
    },
    {
      "name": "tokenWithdrawn",
      "discriminator": [
        35,
        57,
        130,
        51,
        154,
        247,
        155,
        142
      ]
    },
    {
      "name": "valueSubmitted",
      "discriminator": [
        171,
        199,
        35,
        217,
        159,
        103,
        239,
        220
      ]
    },
    {
      "name": "voted",
      "discriminator": [
        189,
        74,
        101,
        127,
        109,
        214,
        95,
        130
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidName",
      "msg": "Invalid oracle name provided"
    },
    {
      "code": 6001,
      "name": "invalidDescription",
      "msg": "Invalid oracle description provided"
    },
    {
      "code": 6002,
      "name": "invalidRewardRate",
      "msg": "Reward rate must be less than or equal to denominator"
    },
    {
      "code": 6003,
      "name": "invalidPda",
      "msg": "Provided account does not match derived PDA"
    },
    {
      "code": 6004,
      "name": "amountMustBePositive",
      "msg": "Amount must be positive"
    },
    {
      "code": 6005,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6006,
      "name": "mathUnderflow",
      "msg": "Math underflow"
    },
    {
      "code": 6007,
      "name": "withdrawalLocked",
      "msg": "Withdrawal still locked"
    },
    {
      "code": 6008,
      "name": "insufficientUnlockedTokens",
      "msg": "Insufficient unlocked tokens"
    },
    {
      "code": 6009,
      "name": "accountBlacklisted",
      "msg": "Account is blacklisted"
    },
    {
      "code": 6010,
      "name": "noUnlockedTokens",
      "msg": "No unlocked tokens available"
    },
    {
      "code": 6011,
      "name": "zeroWeightAfterUpdate",
      "msg": "Weight updates resulted in zero total weight"
    },
    {
      "code": 6012,
      "name": "alreadyVoted",
      "msg": "User has already voted on this target"
    },
    {
      "code": 6013,
      "name": "tooManyVotes",
      "msg": "Exceeded vote capacity for user"
    },
    {
      "code": 6014,
      "name": "tooManyTargets",
      "msg": "Exceeded governance target capacity"
    },
    {
      "code": 6015,
      "name": "invalidAuthority",
      "msg": "Account authority does not match expected value"
    }
  ],
  "types": [
    {
      "name": "blacklistStatusChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "isBlacklisted",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "funded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "initializeOracleParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "rewardBps",
            "type": "u64"
          },
          {
            "name": "halfLifeSeconds",
            "type": "u64"
          },
          {
            "name": "quorum",
            "type": "u64"
          },
          {
            "name": "depositLockingPeriod",
            "type": "u64"
          },
          {
            "name": "withdrawalLockingPeriod",
            "type": "u64"
          },
          {
            "name": "alpha",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "oracleState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "weightMint",
            "type": "pubkey"
          },
          {
            "name": "rewardBps",
            "type": "u64"
          },
          {
            "name": "halfLifeSeconds",
            "type": "u64"
          },
          {
            "name": "quorum",
            "type": "u64"
          },
          {
            "name": "depositLockingPeriod",
            "type": "u64"
          },
          {
            "name": "withdrawalLockingPeriod",
            "type": "u64"
          },
          {
            "name": "alpha",
            "type": "u64"
          },
          {
            "name": "aggregatedValue",
            "type": "i128"
          },
          {
            "name": "latestValue",
            "type": "i128"
          },
          {
            "name": "aggregatedWeight",
            "type": "u128"
          },
          {
            "name": "lastSubmissionTime",
            "type": "i64"
          },
          {
            "name": "lastTimestamp",
            "type": "i64"
          },
          {
            "name": "totalDepositedTokens",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "priceHistory",
            "type": {
              "vec": {
                "defined": {
                  "name": "priceRecord"
                }
              }
            }
          },
          {
            "name": "targets",
            "type": {
              "vec": {
                "defined": {
                  "name": "targetVotes"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "priceRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "aggregatedValue",
            "type": "i128"
          },
          {
            "name": "latestValue",
            "type": "i128"
          }
        ]
      }
    },
    {
      "name": "targetVotes",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "blacklistVotes",
            "type": "u64"
          },
          {
            "name": "whitelistVotes",
            "type": "u64"
          },
          {
            "name": "isBlacklisted",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "tokenDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oracle",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "lockedTokens",
            "type": "u64"
          },
          {
            "name": "unlockedTokens",
            "type": "u64"
          },
          {
            "name": "depositTimestamp",
            "type": "i64"
          },
          {
            "name": "lastOperationTimestamp",
            "type": "i64"
          },
          {
            "name": "lastSubmissionTime",
            "type": "i64"
          },
          {
            "name": "lastSubmittedPrice",
            "type": "i128"
          },
          {
            "name": "weight",
            "type": "u64"
          },
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "blacklistVotes",
            "type": {
              "vec": {
                "defined": {
                  "name": "userVote"
                }
              }
            }
          },
          {
            "name": "whitelistVotes",
            "type": {
              "vec": {
                "defined": {
                  "name": "userVote"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "userVote",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "weight",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "valueSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "submitter",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "submittedValue",
            "type": "i128"
          },
          {
            "name": "aggregatedValue",
            "type": "i128"
          },
          {
            "name": "weight",
            "type": "u64"
          },
          {
            "name": "rewardLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "voted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "isBlacklist",
            "type": "bool"
          },
          {
            "name": "weight",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
