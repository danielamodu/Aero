// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "../src/TestUSDC.sol";

contract TestUSDCTest is Test {
    TestUSDC usdc;
    address alice = address(0xA11CE);

    function setUp() public {
        usdc = new TestUSDC();
    }

    function test_meta() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.symbol(), "tUSDC");
    }

    function test_faucetMints() public {
        vm.warp(100 days); // forge starts at timestamp 1; skip past the cooldown window
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 10_000 * 1e6);
    }

    function test_faucetCooldown() public {
        vm.warp(100 days);
        vm.startPrank(alice);
        usdc.faucet();
        vm.expectRevert("TOO_SOON");
        usdc.faucet();
        vm.warp(block.timestamp + 1 days);
        usdc.faucet();
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 20_000 * 1e6);
    }
}
