// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {AeroVault} from "../src/AeroVault.sol";

contract AeroVaultTest is Test {
    TestUSDC usdc;
    AeroVault vault;
    address alice = address(0xA11CE);

    uint256 constant RATE_5PCT = 1584400000; // ≈5% APR, 1e18-scaled per second

    function setUp() public {
        vm.warp(100 days); // deploy at a sane timestamp so the vault index starts clean
        usdc = new TestUSDC();
        vault = new AeroVault(usdc, RATE_5PCT);
        vm.prank(alice);
        usdc.faucet();
    }

    function test_depositMintsShares() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000 * 1e6);
        uint256 shares = vault.deposit(1_000 * 1e6);
        vm.stopPrank();
        assertEq(shares, 1_000 * 1e6); // index starts at 1e18
        assertEq(vault.balanceOf(alice), shares);
    }

    function test_accruesAboutFivePercentYearly() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000 * 1e6);
        uint256 shares = vault.deposit(1_000 * 1e6);
        vm.warp(block.timestamp + 365 days);
        uint256 assets = vault.previewWithdraw(shares);
        vm.stopPrank();
        // linear 5% for 365/365.25 of a year ≈ 1049.86
        assertGe(assets, 1_049 * 1e6);
        assertLe(assets, 1_051 * 1e6);
    }

    function test_withdrawRoundTrip() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000 * 1e6);
        uint256 shares = vault.deposit(1_000 * 1e6);
        // Mock vaults don't generate yield by themselves — subsidize it like
        // Benqi/Trader Joe would on mainnet, then withdraw after 30 days.
        usdc.transfer(address(vault), 100 * 1e6);
        vm.warp(block.timestamp + 30 days);
        vault.withdraw(shares);
        vm.stopPrank();
        assertEq(vault.balanceOf(alice), 0);
        assertGt(usdc.balanceOf(alice), 9_000 * 1e6); // faucet 10k minus 1k deposit, plus yield
    }

    function test_onlyOwnerSetsRate() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setRate(0);
        vault.setRate(0);
        assertEq(vault.ratePerSecond(), 0);
    }
}
