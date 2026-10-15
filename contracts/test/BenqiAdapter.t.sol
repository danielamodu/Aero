// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {MockQiToken} from "../src/MockQiToken.sol";
import {BenqiAdapter} from "../src/BenqiAdapter.sol";

contract BenqiAdapterTest is Test {
    TestUSDC usdc;
    MockQiToken market;
    BenqiAdapter adapter;
    address alice = address(0xA11CE);

    function setUp() public {
        vm.warp(100 days);
        usdc = new TestUSDC();
        market = new MockQiToken(usdc, 1584400000); // ≈5% APR
        adapter = new BenqiAdapter(market, "benqi-usdc-fuji-mock");
        vm.prank(alice);
        usdc.faucet();
        // Seed market liquidity so redemptions always clear.
        vm.prank(alice);
        usdc.transfer(address(market), 5_000 * 1e6);
    }

    function test_liveApyTracksMockRate() public view {
        uint256 bps = adapter.liveApyBps();
        assertGe(bps, 490);
        assertLe(bps, 510);
    }

    function test_rateChangeMovesApy() public {
        market.setRate(1584400000 * 2);
        uint256 bps = adapter.liveApyBps();
        assertGe(bps, 980);
        assertLe(bps, 1020);
    }

    function test_depositWithdrawRoundTrip() public {
        vm.startPrank(alice);
        usdc.approve(address(adapter), type(uint256).max);
        uint256 shares = adapter.deposit(1_000 * 1e6);
        assertGt(shares, 0);
        vm.warp(block.timestamp + 30 days);
        uint256 assets = adapter.withdraw(shares);
        vm.stopPrank();
        assertGe(assets, 1_000 * 1e6);
        assertEq(adapter.balanceOf(alice), 0);
    }

    function test_balanceReflectsMarket() public {
        vm.startPrank(alice);
        usdc.approve(address(adapter), type(uint256).max);
        adapter.deposit(1_000 * 1e6);
        vm.stopPrank();
        assertGe(adapter.balance(), 1_000 * 1e6);
    }
}
