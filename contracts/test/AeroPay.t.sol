// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {AeroNames} from "../src/AeroNames.sol";
import {AeroPay} from "../src/AeroPay.sol";

contract AeroPayTest is Test {
    TestUSDC usdc;
    AeroNames names;
    AeroPay pay;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.warp(100 days);
        usdc = new TestUSDC();
        names = new AeroNames();
        pay = new AeroPay();
        vm.prank(alice);
        usdc.faucet();
        vm.prank(bob);
        names.register("maya");
    }

    function test_payUsername() public {
        vm.startPrank(alice);
        usdc.approve(address(pay), type(uint256).max);
        pay.payUsername(address(names), address(usdc), "maya", 45 * 1e6, "dinner");
        vm.stopPrank();
        assertEq(usdc.balanceOf(bob), 45 * 1e6);
    }

    function test_payDirect() public {
        vm.startPrank(alice);
        usdc.approve(address(pay), type(uint256).max);
        pay.pay(address(usdc), bob, 12 * 1e6, "");
        vm.stopPrank();
        assertEq(usdc.balanceOf(bob), 12 * 1e6);
    }

    function test_unknownHandleReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(pay), type(uint256).max);
        vm.expectRevert("UNKNOWN_HANDLE");
        pay.payUsername(address(names), address(usdc), "ghost", 1 * 1e6, "");
        vm.stopPrank();
    }

    function test_longMemoReverts() public {
        string memory long = new string(141);
        vm.startPrank(alice);
        usdc.approve(address(pay), type(uint256).max);
        vm.expectRevert("MEMO_TOO_LONG");
        pay.pay(address(usdc), bob, 1 * 1e6, long);
        vm.stopPrank();
    }
}
