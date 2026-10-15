// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Benqi QiToken market surface (Compound fork with per-TIMESTAMP rates).
/// @dev Verified against Benqi's QiToken.sol: rates are per-second
///      (supplyRatePerTimestamp), and balanceOfUnderlying accrues (not a view).
///      Views must use getAccountSnapshot instead.
interface IQiToken is IERC20 {
    function underlying() external view returns (address);
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function supplyRatePerTimestamp() external view returns (uint256);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function getAccountSnapshot(address account) external view returns (uint256, uint256, uint256, uint256);
}
