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
        market = new MockQiToken(usdc, 1584400000, "Mock Benqi USDC", "mqiUSDC");
        adapter = new BenqiAdapter(market, "benqi-usdc-fuji-mock");
        adapter.setRouter(address(this));
        usdc.faucet();
        assertTrue(usdc.transfer(address(market), 5_000 * 1e6));
        usdc.approve(address(adapter), type(uint256).max);
    }

    function test_marketIdPersists() public view {
        assertEq(adapter.marketId(), "benqi-usdc-fuji-mock");
    }

    function test_adapterShareDecimalsMatchSixDecimalUnderlying() public view {
        assertEq(adapter.decimals(), 6);
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

    function test_directUsersCannotDepositIntoRouterExclusiveAdapter() public {
        vm.expectRevert("ONLY_ROUTER");
        vm.prank(alice);
        adapter.deposit(1_000 * 1e6);
        assertEq(adapter.balanceOf(alice), 0);
    }

    function test_routerDepositWithdrawRoundTrip() public {
        uint256 beforeBalance = usdc.balanceOf(address(this));
        uint256 shares = adapter.deposit(1_000 * 1e6);
        assertGt(shares, 0);
        assertEq(adapter.balanceOf(address(this)), shares);
        vm.warp(block.timestamp + 30 days);
        uint256 assets = adapter.withdraw(shares);
        assertGe(assets, 1_000 * 1e6);
        assertEq(adapter.totalSupply(), 0);
        assertEq(adapter.balanceOf(address(this)), 0);
        assertEq(usdc.balanceOf(address(this)), beforeBalance + assets - 1_000 * 1e6);
    }

    function test_convertToAssetsUsesAdapterShareOwnership() public {
        uint256 shares = adapter.deposit(1_000 * 1e6);
        assertEq(adapter.convertToAssets(shares), 1_000 * 1e6);
        assertEq(adapter.convertToShares(500 * 1e6), shares / 2);
    }

    function test_zeroRouterCanOnlyBeSetOnce() public {
        vm.expectRevert("ROUTER_ALREADY_SET");
        adapter.setRouter(address(this));
    }
}
