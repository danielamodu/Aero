// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AeroBank — sandbox on-ramp settler for Aero testnet.
/// @notice Simulates "buy with card": a capped amount of test dollars per
///         buyer per day, settled 1:1 from pre-funded inventory. Anyone can
///         top up inventory; the owner can sweep leftovers. Testnet only —
///         mainnet swaps this settler for a real provider (Transak/MoonPay).
contract AeroBank is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public constant MAX_TX = 1_000 * 1e6;
    uint256 public constant DAILY_LIMIT = 2_000 * 1e6;

    mapping(address => uint256) public spentToday;
    mapping(address => uint256) public spentDay;

    event Settled(address indexed buyer, uint256 usdAmount, uint256 tusdcOut);
    event ToppedUp(address indexed from, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    constructor(IERC20 _usdc) Ownable(msg.sender) {
        usdc = _usdc;
    }

    function _day() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function buy(uint256 usdcAmount) external nonReentrant {
        require(usdcAmount > 0 && usdcAmount <= MAX_TX, "LIMIT");
        uint256 day = _day();
        if (spentDay[msg.sender] != day) {
            spentDay[msg.sender] = day;
            spentToday[msg.sender] = 0;
        }
        require(spentToday[msg.sender] + usdcAmount <= DAILY_LIMIT, "DAILY_LIMIT");
        require(usdc.balanceOf(address(this)) >= usdcAmount, "EMPTY_TILL_REFILL");
        spentToday[msg.sender] += usdcAmount;
        usdc.safeTransfer(msg.sender, usdcAmount);
        emit Settled(msg.sender, usdcAmount, usdcAmount);
    }

    /// @notice Anyone can refill sandbox inventory.
    function topUp(uint256 amount) external nonReentrant {
        require(amount > 0, "ZERO");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit ToppedUp(msg.sender, amount);
    }

    function sweep(uint256 amount, address to) external onlyOwner nonReentrant {
        usdc.safeTransfer(to, amount);
        emit Swept(to, amount);
    }
}
