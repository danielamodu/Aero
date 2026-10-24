## No trusted addresses are published here

Aero does not publish a current router or adapter address as a trusted deployment. The frontend reads addresses from `NEXT_PUBLIC_*` variables, and `lib/fuji-router-manifest.ts` is intentionally empty. The B2.2 report's predicted addresses are simulation output, not deployment identities.

{{badge:Blocked}} Trusted router manifest empty.  
{{badge:Blocked}} No verified production deployment.  
{{badge:Fuji}} Sandbox contracts are configured per environment.

If you find an address in a screenshot, a local `.env` file, an old report or a chat message, verify the chain, bytecode, constructor configuration and ownership before treating it as current.

## Contract set

| Contract | Purpose | Status |
|---|---|---|
| `TestUSDC` | Six-decimal test token with a faucet. | {{badge:Mock}} No cash value. |
| `AeroNames` | Handle registry. | {{badge:Implemented}} |
| `AeroPay` | Memo-bearing token payment. | {{badge:Implemented}} |
| `AeroBank` | Pre-funded sandbox inventory for the simulated card sheet. | {{badge:Mock}} |
| `AeroVault` | Synthetic-rate yield demo. | {{badge:Mock}} |
| `AeroRouter` | Share-accounted portfolio over adapters. | {{badge:Implemented}} {{badge:Mock}} |
| `BenqiAdapter` | Router-exclusive QiToken wrapper. | {{badge:Implemented}} |
| `MockQiToken` | Owner-rate-controlled mock market. | {{badge:Mock}} |

## TestUSDC

A standard six-decimal test ERC-20 with a faucet. The faucet has a 24-hour cooldown and a fixed claim. The token is not USDC, is not redeemable and has no cash value. The release validator recognizes the sandbox token address as a known test token and forbids it in production configuration.

## AeroNames

```solidity
function register(string calldata name) external;
function release() external;
function resolveAddress(string calldata name) external view returns (address);
function resolveUsername(address who) external view returns (string memory);
```

Rules:

- one active handle per address;
- 3–20 characters, lowercase `a-z`, `0-9`, `_`;
- registering a new handle releases the previous one;
- a handle resolves to the address that registered it;
- handles can be squatted, released and changed.

AeroNames is the authority for a handle on its Fuji instance. It is not an account, a recovery mechanism or proof of identity. Other wallets linked to the same Aero account do not become equivalent handle destinations.

## AeroPay

```solidity
uint256 public constant MAX_MEMO_BYTES = 140;

function pay(address token, address to, uint256 amount, string calldata memo) external;
function payUsername(
  address registry,
  address token,
  string calldata name,
  uint256 amount,
  string calldata memo
) external;

event Paid(
  address indexed from,
  address indexed to,
  address indexed token,
  uint256 amount,
  string memo,
  uint256 timestamp
);
```

Controls: nonzero recipient, memo length cap, SafeERC20 transfer, event emission. Gaps: arbitrary caller-supplied token, no zero-amount check, no token allowlist, no reversal, no idempotency. The frontend uses an unlimited approval in the sandbox.

## AeroBank

```solidity
uint256 public constant MAX_TX = 1_000 * 1e6;
uint256 public constant DAILY_LIMIT = 2_000 * 1e6;

function buy(uint256 usdcAmount) external;
function topUp(uint256 amount) external;
function sweep(uint256 amount, address to) external onlyOwner;
```

AeroBank distributes pre-funded test tokens. It is not a bank, on-ramp or card processor. Anyone can top up inventory; the owner can sweep it. The UI's card step is simulated and does not contact a payment provider.

## AeroVault

```solidity
function accrue() public;
function setRate(uint256 r) external onlyOwner;
function previewDeposit(uint256 assets) external view returns (uint256);
function previewWithdraw(uint256 shares) external view returns (uint256);
function deposit(uint256 assets) external returns (uint256 shares);
function withdraw(uint256 shares) external returns (uint256 assets);
```

The index grows by `ratePerSecond`. `setRate` accrues first. This is a synthetic demo; there is no external market. Accrual can exceed the finite seeded inventory.

## AeroRouter

```solidity
function deposit(uint256 assets, uint256 minShares) external returns (uint256 shares);
function withdraw(uint256 shares) external returns (uint256 assets);
function rebalance() external;
function setTargets(uint256[] calldata targetsBps) external onlyOwner;
function addAdapter(address adapter) external onlyOwner;
function removeAdapter(uint256 index) external onlyOwner;
function totalAssets() public view returns (uint256);
function convertToAssets(uint256 shares) public view returns (uint256);
function convertToShares(uint256 assets) public view returns (uint256);
function configurationValid() external view returns (bool);
```

Key invariants:

1. `totalAssets = router tUSDC balance + Σ adapter.convertToAssets(adapter.sharesOf(router))`.
2. Targets sum to exactly `10,000` BPS.
3. At most 16 adapters, unique and contract addresses with matching asset and router.
4. Deposit measures the exact token spend and adapter share mint.
5. Withdrawal uses idle assets first, then pro-rata invested slots.
6. A failed or short adapter redemption reverts the whole withdrawal.
7. Shares are burned before transfer; the recipient balance delta must equal the quoted assets.
8. An adapter with an outstanding router position cannot be removed.

Router ownership is a direct `Ownable`. There is no pause, timelock or multisig in source. `rebalance()` restores static targets and does not optimize yield.

## BenqiAdapter

```solidity
function setRouter(address router_) external onlyOwner;
function convertToAssets(uint256 shares) public view returns (uint256);
function convertToShares(uint256 assets) public view returns (uint256);
function sharesOf(address account) external view returns (uint256);
function deposit(uint256 assets) external onlyRouter returns (uint256 shares);
function withdraw(uint256 shares) external onlyRouter returns (uint256 assets);
function marketId() external view returns (string memory);
function liveApyBps() external view returns (uint256);
```

The adapter binds to one router, approves the market, and accepts deposits/withdrawals only from that router. Its shares retain the underlying token's raw-unit decimals. `liveApyBps()` annualizes the market's reported supply rate.

The supplied integrated deployment wraps **MockQiToken** markets. The “Joe” slot uses the same adapter implementation over a second mock market; there is no Trader Joe-specific adapter.

## MockQiToken

A minimal QiToken-style market with an owner-set supply rate. It supports the operations the adapter needs: `mint`, `redeemUnderlying`, `getAccountSnapshot`, `balanceOfUnderlying`, `supplyRatePerTimestamp`, `underlying` and token metadata. It exists only to exercise the router in the sandbox.

## Verification commands

```bash
cd contracts
forge build
forge test
forge build --sizes
```

Recorded sizes from B2.2:

| Contract | Runtime bytes | EIP-170 margin |
|---|---:|---:|
| `AeroRouter` | 16,269 | 8,307 |
| `BenqiAdapter` | 7,248 | 17,328 |
| `MockQiToken` | 4,038 | 20,538 |
| `AeroPay` | 1,476 | 23,100 |
| `AeroBank` | 2,327 | 22,249 |

These are build sizes, not proof of a deployed match. See [Security](/security/) and [Deployment and operations](/operations/).
