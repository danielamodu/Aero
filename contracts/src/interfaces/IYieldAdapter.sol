// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IYieldAdapter — router-exclusive adapter for one yield market.
/// @notice Share balances and asset amounts use the adapter's own share units
///         and the underlying token's base units respectively.
interface IYieldAdapter {
    /// @notice The adapter's underlying token.
    function asset() external view returns (IERC20);

    /// @notice The only router authorized to deposit or withdraw adapter shares.
    function router() external view returns (address);

    /// @notice Human-readable market id, e.g. "benqi-usdc".
    function marketId() external view returns (string memory);

    /// @notice Annualized supply rate in basis points, using the protocol's rate.
    function liveApyBps() external view returns (uint256);

    /// @notice Convert `shares` owned by `owner` into underlying asset units.
    /// @dev Rounds down. Adapter implementations must report current recoverable
    ///      assets and may not include assets owned by other accounts.
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @notice Shares needed to withdraw at least `assets` underlying units.
    /// @dev Rounds up so the router can verify the amount actually received.
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @notice Adapter shares held by `account`.
    function sharesOf(address account) external view returns (uint256);

    /// @notice Pull `assets` from the authorized router and mint shares to it.
    function deposit(uint256 assets) external returns (uint256 shares);

    /// @notice Burn router-owned `shares` and return redeemed assets to router.
    function withdraw(uint256 shares) external returns (uint256 assets);
}
