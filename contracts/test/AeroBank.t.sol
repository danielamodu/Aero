// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {AeroBank} from "../src/AeroBank.sol";

contract AeroBankTest is Test {
    TestUSDC usdc;
    AeroBank bank;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.warp(100 days);
        usdc = new TestUSDC();
        bank = new AeroBank(usdc);
        vm.prank(alice);
        usdc.faucet();
        vm.prank(alice);
        usdc.transfer(address(bank), 5_000 * 1e6);
    }

    function test_buy() public {
        vm.prank(bob);
        bank.buy(250 * 1e6);
        assertEq(usdc.balanceOf(bob), 250 * 1e6);
    }

    function test_txCap() public {
        vm.prank(bob);
        vm.expectRevert("LIMIT");
        bank.buy(1_001 * 1e6);
    }

    function test_dailyCap() public {
        vm.startPrank(bob);
        bank.buy(1_000 * 1e6);
        bank.buy(1_000 * 1e6);
        vm.expectRevert("DAILY_LIMIT");
        bank.buy(1);
        vm.stopPrank();
    }

    function test_dailyResets() public {
        vm.startPrank(bob);
        bank.buy(1_000 * 1e6);
        bank.buy(1_000 * 1e6);
        vm.warp(block.timestamp + 1 days + 1);
        bank.buy(1_000 * 1e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(bob), 3_000 * 1e6);
    }

    function test_emptyReverts() public {
        // Drain the till, then buying must fail loudly.
        vm.prank(address(bank.owner()));
        bank.sweep(5_000 * 1e6, bob);
        vm.prank(bob);
        vm.expectRevert("EMPTY_TILL_REFILL");
        bank.buy(10 * 1e6);
    }

    function test_sweepOnlyOwner() public {
        vm.prank(bob);
        vm.expectRevert();
        bank.sweep(1, bob);
    }

    function test_topUp() public {
        vm.startPrank(alice);
        usdc.approve(address(bank), type(uint256).max);
        bank.topUp(500 * 1e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(bank)), 5_500 * 1e6);
    }
}
