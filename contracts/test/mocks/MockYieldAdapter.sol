// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IYieldAdapter} from "../../src/interfaces/IYieldAdapter.sol";

/// @notice Test-only router-exclusive adapter with controllable loss and failures.
contract MockYieldAdapter is ERC20, IYieldAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable override asset;
    address public override router;
    address public immutable owner;
    string private _marketId;
    bool public failWithdraw;
    uint16 public payoutBps = 10_000;
    uint256 public maxWithdrawAssets = type(uint256).max;
    uint256 public rateBps = 500;
    uint256 public withdrawCount;
    bool public suppressDepositMint;
    bool public misreportDepositShares;
    uint16 public retainedDepositValueBps = 10_000;

    constructor(IERC20 asset_, string memory marketId_)
        ERC20("Mock Yield Share", "mYS")
    {
        asset = asset_;
        owner = msg.sender;
        _marketId = marketId_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyRouter() {
        require(router != address(0) && msg.sender == router, "ONLY_ROUTER");
        _;
    }

    function setRouter(address router_) external onlyOwner {
        require(router == address(0), "ROUTER_ALREADY_SET");
        require(router_ != address(0) && router_.code.length > 0, "INVALID_ROUTER");
        router = router_;
    }

    function setWithdrawBehavior(bool shouldFail, uint16 payoutBps_, uint256 maxAssets) external onlyOwner {
        require(payoutBps_ <= 10_000, "INVALID_PAYOUT_BPS");
        failWithdraw = shouldFail;
        payoutBps = payoutBps_;
        maxWithdrawAssets = maxAssets;
    }

    function setRateBps(uint256 rateBps_) external onlyOwner {
        rateBps = rateBps_;
    }

    function setDepositBehavior(bool suppressMint, bool misreportShares) external onlyOwner {
        suppressDepositMint = suppressMint;
        misreportDepositShares = misreportShares;
    }

    function setRetainedDepositValueBps(uint16 bps) external onlyOwner {
        require(bps <= 10_000, "INVALID_RETAINED_VALUE");
        retainedDepositValueBps = bps;
    }

    function decimals() public view override returns (uint8) {
        return IERC20Metadata(address(asset)).decimals();
    }

    function simulateLoss(uint256 assets) external onlyOwner {
        asset.safeTransfer(address(0xdead), assets);
    }

    function marketId() external view override returns (string memory) {
        return _marketId;
    }

    function liveApyBps() external view override returns (uint256) {
        return rateBps;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (shares == 0) return 0;
        uint256 supply = totalSupply();
        require(supply > 0, "NO_SHARES");
        return Math.mulDiv(shares, asset.balanceOf(address(this)), supply);
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        if (assets == 0) return 0;
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        uint256 total = asset.balanceOf(address(this));
        require(total > 0, "NO_ASSETS");
        return Math.mulDiv(assets, supply, total, Math.Rounding.Ceil);
    }

    function sharesOf(address account) external view override returns (uint256) {
        return balanceOf(account);
    }

    function deposit(uint256 assets) external override onlyRouter returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        uint256 supply = totalSupply();
        uint256 total = asset.balanceOf(address(this));
        shares = supply == 0 ? assets : Math.mulDiv(assets, supply, total);
        require(shares > 0, "ZERO_SHARES");
        asset.safeTransferFrom(msg.sender, address(this), assets);
        uint256 removedValue = Math.mulDiv(assets, 10_000 - retainedDepositValueBps, 10_000);
        if (removedValue > 0) asset.safeTransfer(address(0xdead), removedValue);
        if (!suppressDepositMint) _mint(router, shares);
        if (misreportDepositShares) shares += 1;
    }

    function withdraw(uint256 shares) external override onlyRouter returns (uint256 assets) {
        require(!failWithdraw, "MOCK_WITHDRAW_FAILED");
        require(shares > 0 && shares <= balanceOf(router), "INVALID_SHARES");
        assets = convertToAssets(shares);
        require(assets <= maxWithdrawAssets, "MOCK_ILLIQUID");
        withdrawCount++;
        _burn(router, shares);
        uint256 payout = Math.mulDiv(assets, payoutBps, 10_000);
        asset.safeTransfer(router, payout);
        return payout;
    }
}
