// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestUSDC — faucet-minted test dollars for Aero testnet (6 decimals, like USDC).
/// @notice Worthless by design. Anyone can claim 10,000 tUSDC every 24h.
contract TestUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastClaim;

    event Claimed(address indexed to, uint256 amount);

    constructor() ERC20("Test USDC", "tUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        require(block.timestamp - lastClaim[msg.sender] >= FAUCET_COOLDOWN, "TOO_SOON");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit Claimed(msg.sender, FAUCET_AMOUNT);
    }
}
