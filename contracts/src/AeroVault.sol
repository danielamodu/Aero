// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AeroVault — mock yield vault for Aero testnet.
/// @notice Interest is simulated by a fixed per-second rate set by the owner.
///         This stands in for Benqi/Trader Joe routing until mainnet. Testnet only.
contract AeroVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    /// @notice Growth per second, 1e18-scaled. 5% APR ≈ 1584400000.
    uint256 public ratePerSecond;
    /// @notice Share price, 1e18-scaled. Only grows via accrue().
    uint256 public index;
    uint256 public lastAccrual;

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event RateUpdated(uint256 ratePerSecond);

    constructor(IERC20 _asset, uint256 _ratePerSecond) ERC20("Aero Test Vault Share", "atUSDC") Ownable(msg.sender) {
        asset = _asset;
        ratePerSecond = _ratePerSecond;
        index = 1e18;
        lastAccrual = block.timestamp;
    }

    function _currentIndex() internal view returns (uint256) {
        uint256 dt = block.timestamp - lastAccrual;
        if (dt == 0) return index;
        return index + (index * ratePerSecond * dt) / 1e18;
    }

    function accrue() public {
        uint256 current = _currentIndex();
        if (current != index) {
            index = current;
            lastAccrual = block.timestamp;
        }
    }

    function setRate(uint256 r) external onlyOwner {
        accrue();
        ratePerSecond = r;
        emit RateUpdated(r);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return (assets * 1e18) / _currentIndex();
    }

    function previewWithdraw(uint256 shares) external view returns (uint256) {
        return (shares * _currentIndex()) / 1e18;
    }

    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        accrue();
        shares = (assets * 1e18) / index;
        require(shares > 0, "ZERO_SHARES");
        asset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, shares);
        emit Deposit(msg.sender, assets, shares);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        accrue();
        assets = (shares * index) / 1e18;
        require(assets > 0, "ZERO_ASSETS");
        _burn(msg.sender, shares);
        asset.safeTransfer(msg.sender, assets);
        emit Withdraw(msg.sender, assets, shares);
    }
}
