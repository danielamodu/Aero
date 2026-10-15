// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IQiToken} from "./interfaces/IQiToken.sol";

/// @title MockQiToken — Compound-ABI-compatible USDC market for Aero testnet.
/// @notice Speaks the same surface as Benqi's QiToken (mint/redeem/
///         redeemUnderlying/exchangeRateStored/supplyRatePerBlock/
///         balanceOfUnderlying) so the BenqiAdapter needs no changes between
///         this mock and Benqi mainnet. Rate is owner-set for demo purposes.
contract MockQiToken is ERC20, Ownable, IQiToken {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlyingAsset;
    uint8 private constant QDEC = 8;

    /// @notice Exchange rate: underlying units per qi unit, 1e18-scaled.
    ///         Starts at 0.02 (like cUSDC: 2e16). Matches Compound convention
    ///         exactly: assets = qi * rate / 1e18, no extra decimals factor.
    uint256 public exchangeRateStored;
    /// @notice Simulated per-second growth, 1e18-scaled (≈5% APR default).
    uint256 public ratePerSecond;
    uint256 public lastAccrual;

    event Mint(address indexed minter, uint256 mintAmount, uint256 mintTokens);
    event Redeem(address indexed redeemer, uint256 redeemTokens, uint256 redeemAmount);
    event RateUpdated(uint256 ratePerSecond);

    constructor(IERC20 _underlying, uint256 _ratePerSecond, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {        underlyingAsset = _underlying;
        exchangeRateStored = 2e16;
        ratePerSecond = _ratePerSecond;
        lastAccrual = block.timestamp;
    }

    function decimals() public pure override returns (uint8) {
        return QDEC;
    }

    function underlying() external view returns (address) {
        return address(underlyingAsset);
    }

    function accrue() public {
        uint256 dt = block.timestamp - lastAccrual;
        if (dt > 0) {
            exchangeRateStored = exchangeRateStored + (exchangeRateStored * ratePerSecond * dt) / 1e18;
            lastAccrual = block.timestamp;
        }
    }

    function setRate(uint256 r) external onlyOwner {
        accrue();
        ratePerSecond = r;
        emit RateUpdated(r);
    }

    /// @notice Per-timestamp rate, like real Benqi (not per-block).
    function supplyRatePerTimestamp() external view returns (uint256) {
        return ratePerSecond;
    }

    function getAccountSnapshot(address owner) external view returns (uint256, uint256, uint256, uint256) {
        return (0, balanceOf(owner), 0, exchangeRateStored);
    }

    function balanceOfUnderlying(address owner) external view returns (uint256) {
        return (balanceOf(owner) * exchangeRateStored) / 1e18;
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        accrue();
        uint256 mintTokens = (mintAmount * 1e18) / exchangeRateStored;
        require(mintTokens > 0, "ZERO_TOKENS");
        underlyingAsset.safeTransferFrom(msg.sender, address(this), mintAmount);
        _mint(msg.sender, mintTokens);
        emit Mint(msg.sender, mintAmount, mintTokens);
        return 0;
    }

    function redeem(uint256 redeemTokens) external returns (uint256) {
        accrue();
        uint256 redeemAmount = (redeemTokens * exchangeRateStored) / 1e18;
        require(redeemAmount > 0, "ZERO_AMOUNT");
        _burn(msg.sender, redeemTokens);
        underlyingAsset.safeTransfer(msg.sender, redeemAmount);
        emit Redeem(msg.sender, redeemTokens, redeemAmount);
        return 0;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        accrue();
        uint256 redeemTokens = (redeemAmount * 1e18) / exchangeRateStored;
        require(redeemTokens > 0, "ZERO_TOKENS");
        _burn(msg.sender, redeemTokens);
        underlyingAsset.safeTransfer(msg.sender, redeemAmount);
        emit Redeem(msg.sender, redeemTokens, redeemAmount);
        return 0;
    }
}
