// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IYieldAdapter — one protocol market behind the AeroRouter.
/// @notice Implemented per market (Benqi, Trader Joe, …). All amounts in USDC base units.
interface IYieldAdapter {
    /// @notice Human-readable market id, e.g. "benqi-usdc".
    function marketId() external view returns (string memory);

    /// @notice Live supply rate in basis points / year, from the protocol itself.
    function liveApyBps() external view returns (uint256);

    /// @notice Underlying USDC currently deployed in this market.
    function balance() external view returns (uint256);

    /// @notice Pull `assets` USDC from the router into the market.
    function deposit(uint256 assets) external;

    /// @notice Pull `assets` USDC back to the router. Reverts if illiquid.
    function withdraw(uint256 assets) external;
}
