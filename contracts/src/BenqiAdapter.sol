// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IYieldAdapter} from "./interfaces/IYieldAdapter.sol";
import {IQiToken} from "./interfaces/IQiToken.sol";

/// @title BenqiAdapter — IYieldAdapter over a Compound-style QiToken market.
/// @notice Same ABI Benqi mainnet markets expose, so mainnet migration is an
///         address change, not a rewrite. On testnet it also acts as its own
///         mini-vault (user shares), so the flow is demoable end to end.
///         Benqi rates are per-TIMESTAMP (not per-block): APY uses seconds/year.
contract BenqiAdapter is ERC20, Ownable, ReentrancyGuard, IYieldAdapter {
    using SafeERC20 for IERC20;

    uint256 public constant SECONDS_PER_YEAR = 31_557_600;

    IQiToken public immutable market;
    IERC20 public immutable asset;
    string private _marketId;

    event UserDeposit(address indexed user, uint256 assets, uint256 shares);
    event UserWithdraw(address indexed user, uint256 assets, uint256 shares);

    constructor(IQiToken _market, string memory marketId_) ERC20("Aero Benqi Share", "aqiUSDC") Ownable(msg.sender) {
        market = _market;
        marketId_ = marketId_;
        asset = IERC20(_market.underlying());
        asset.forceApprove(address(market), type(uint256).max);
    }

    function marketId() external view returns (string memory) {
        return _marketId;
    }

    function liveApyBps() external view returns (uint256) {
        return (market.supplyRatePerTimestamp() * SECONDS_PER_YEAR * 10_000) / 1e18;
    }

    /// @notice Uses getAccountSnapshot: balanceOfUnderlying accrues (not a view on Benqi).
    function _marketBalance() internal view returns (uint256) {
        (uint256 err, uint256 qiBalance,, uint256 exchangeRate) = market.getAccountSnapshot(address(this));
        require(err == 0, "SNAPSHOT_FAILED");
        return (qiBalance * exchangeRate) / 1e18;
    }

    function balance() external view returns (uint256) {
        return _marketBalance();
    }

    function sharePrice() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (_marketBalance() * 1e18) / supply;
    }

    function _depositIntoMarket(uint256 assets) internal {
        uint256 err = market.mint(assets);
        require(err == 0, "MINT_FAILED");
    }

    /// @notice Supply USDC, receive adapter shares priced off live market balance.
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        uint256 supply = totalSupply();
        uint256 marketBalance = market.balanceOfUnderlying(address(this));
        shares = supply == 0 ? assets : (assets * supply) / marketBalance;
        require(shares > 0, "ZERO_SHARES");
        asset.safeTransferFrom(msg.sender, address(this), assets);
        _depositIntoMarket(assets);
        _mint(msg.sender, shares);
        emit UserDeposit(msg.sender, assets, shares);
    }

    /// @notice Burn shares, receive USDC redeemed from the market.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        uint256 supply = totalSupply();
        uint256 marketBalance = market.balanceOfUnderlying(address(this));
        assets = (shares * marketBalance) / supply;
        require(assets > 0, "ZERO_ASSETS");
        _burn(msg.sender, shares);
        uint256 err = market.redeemUnderlying(assets);
        require(err == 0, "REDEEM_FAILED");
        asset.safeTransfer(msg.sender, assets);
        emit UserWithdraw(msg.sender, assets, shares);
    }
}
