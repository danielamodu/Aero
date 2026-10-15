// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAeroNames {
    function resolveAddress(string calldata name) external view returns (address);
}

/// @title AeroPay — one-signature payments with a memo.
/// @notice Approve once, then every payment is a single transaction:
///         resolve (optional) + transfer + memo event.
contract AeroPay {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_MEMO_BYTES = 140;

    event Paid(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        string memo,
        uint256 timestamp
    );

    function pay(address token, address to, uint256 amount, string calldata memo) external {
        require(to != address(0), "BAD_TO");
        require(bytes(memo).length <= MAX_MEMO_BYTES, "MEMO_TOO_LONG");
        IERC20(token).safeTransferFrom(msg.sender, to, amount);
        emit Paid(msg.sender, to, token, amount, memo, block.timestamp);
    }

    function payUsername(
        address registry,
        address token,
        string calldata name,
        uint256 amount,
        string calldata memo
    ) external {
        address to = IAeroNames(registry).resolveAddress(name);
        require(to != address(0), "UNKNOWN_HANDLE");
        require(bytes(memo).length <= MAX_MEMO_BYTES, "MEMO_TOO_LONG");
        IERC20(token).safeTransferFrom(msg.sender, to, amount);
        emit Paid(msg.sender, to, token, amount, memo, block.timestamp);
    }
}
