// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IYieldAdapter} from "./interfaces/IYieldAdapter.sol";
import {IQiToken} from "./interfaces/IQiToken.sol";

/// @title BenqiAdapter — router-exclusive IYieldAdapter over a QiToken market.
/// @notice This adapter accepts deposits and withdrawals only from its one-time
///         configured router. Bind it with setRouter after deploying the router.
contract BenqiAdapter is ERC20, Ownable, ReentrancyGuard, IYieldAdapter {
    using SafeERC20 for IERC20;

    uint256 public constant SECONDS_PER_YEAR = 31_557_600;

    IQiToken public immutable market;
    IERC20 public immutable override asset;
    address public override router;
    string private _marketId;

    event RouterSet(address indexed router);
    event UserDeposit(uint256 assets, uint256 shares);
    event UserWithdraw(uint256 assets, uint256 shares);

    modifier onlyRouter() {
        require(router != address(0) && msg.sender == router, "ONLY_ROUTER");
        _;
    }

    constructor(IQiToken _market, string memory marketId_)
        ERC20("Aero Benqi Share", "aqiUSDC")
        Ownable(msg.sender)
    {
        require(address(_market) != address(0) && address(_market).code.length > 0, "INVALID_MARKET");
        address underlying = _market.underlying();
        require(underlying != address(0) && underlying.code.length > 0, "INVALID_ASSET");
        require(bytes(marketId_).length > 0, "EMPTY_MARKET_ID");
        market = _market;
        _marketId = marketId_;
        asset = IERC20(underlying);
        asset.forceApprove(address(market), type(uint256).max);
    }

    /// @notice Bind once, after deploying the router that will own this adapter.
    function setRouter(address router_) external onlyOwner {
        require(router == address(0), "ROUTER_ALREADY_SET");
        require(router_ != address(0) && router_.code.length > 0, "INVALID_ROUTER");
        router = router_;
        emit RouterSet(router_);
    }

    function marketId() external view override returns (string memory) {
        return _marketId;
    }

    /// @notice Adapter shares retain the underlying's raw-unit semantics.
    function decimals() public view override returns (uint8) {
        return IERC20Metadata(address(asset)).decimals();
    }

    function liveApyBps() external view override returns (uint256) {
        return (market.supplyRatePerTimestamp() * SECONDS_PER_YEAR * 10_000) / 1e18;
    }

    /// @notice Uses getAccountSnapshot because the protocol's accruing balance
    ///         call is not a view. The result is the adapter's aggregate market
    ///         position; router ownership is applied by converting its shares.
    function _marketBalance() internal view returns (uint256) {
        (uint256 err, uint256 qiBalance,, uint256 exchangeRate) = market.getAccountSnapshot(address(this));
        require(err == 0, "SNAPSHOT_FAILED");
        return Math.mulDiv(qiBalance, exchangeRate, 1e18);
    }

    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        if (shares == 0) return 0;
        uint256 supply = totalSupply();
        require(supply > 0, "NO_ADAPTER_SHARES");
        return Math.mulDiv(shares, _marketBalance(), supply);
    }

    function sharesOf(address account) external view override returns (uint256) {
        return balanceOf(account);
    }

    /// @notice Preview shares for a withdrawal; rounds up to avoid under-pulling.
    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        if (assets == 0) return 0;
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        uint256 currentAssets = _marketBalance();
        require(currentAssets > 0, "NO_MARKET_ASSETS");
        return Math.mulDiv(assets, supply, currentAssets, Math.Rounding.Ceil);
    }

    /// @notice Retained as a market-level view for diagnostics. Router accounting
    ///         must use convertToAssets(balanceOf(router)) instead.
    function marketAssets() external view returns (uint256) {
        return _marketBalance();
    }

    /// @notice Legacy informational quote; not used by AeroRouter.
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return Math.mulDiv(_marketBalance(), 1e18, supply);
    }

    function _depositIntoMarket(uint256 assets) internal {
        uint256 err = market.mint(assets);
        require(err == 0, "MINT_FAILED");
    }

    function deposit(uint256 assets) external override onlyRouter nonReentrant returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        uint256 supply = totalSupply();
        uint256 marketBalance = market.balanceOfUnderlying(address(this));
        shares = supply == 0 ? assets : Math.mulDiv(assets, supply, marketBalance);
        require(shares > 0, "ZERO_SHARES");

        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), assets);
        require(asset.balanceOf(address(this)) - beforeBalance == assets, "ASSET_TRANSFER_SHORTFALL");
        _depositIntoMarket(assets);
        _mint(router, shares);
        emit UserDeposit(assets, shares);
    }

    function withdraw(uint256 shares) external override onlyRouter nonReentrant returns (uint256 assets) {
        uint256 supply = totalSupply();
        require(shares > 0 && shares <= balanceOf(router), "INVALID_SHARES");
        uint256 marketBalance = market.balanceOfUnderlying(address(this));
        require(supply > 0, "NO_ADAPTER_SHARES");
        assets = shares == supply ? marketBalance : Math.mulDiv(shares, marketBalance, supply);
        require(assets > 0, "ZERO_ASSETS");

        _burn(router, shares);
        uint256 beforeBalance = asset.balanceOf(address(this));
        uint256 err = market.redeemUnderlying(assets);
        require(err == 0, "REDEEM_FAILED");
        require(asset.balanceOf(address(this)) - beforeBalance >= assets, "MARKET_SHORTFALL");
        asset.safeTransfer(router, assets);
        emit UserWithdraw(assets, shares);
    }
}
