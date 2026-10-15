// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IYieldAdapter} from "./IYieldAdapter.sol";

/// @title IAeroRouter — mainnet interface. Mirrors the testnet AeroVault UX
///         (deposit/withdraw/previews, 1e18 index) so the frontend is unchanged.
interface IAeroRouter {
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event Rebalanced(uint256[] allocationsBps);
    event AdapterSet(address indexed adapter, bool allowed);
    event Paused();
    event Unpaused();

    function deposit(uint256 assets) external returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 assets);
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function previewWithdraw(uint256 shares) external view returns (uint256 assets);

    /// @notice Move funds toward the target allocation. Anyone may call when
    ///         drift exceeds the hysteresis band; callable incentive TBD.
    function rebalance() external;

    /// @notice Current target allocation in bps, parallel to `adapters()`.
    function targetAllocationBps() external view returns (uint256[] memory);
    function adapters() external view returns (IYieldAdapter[] memory);
    function paused() external view returns (bool);
}
