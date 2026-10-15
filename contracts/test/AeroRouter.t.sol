// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {MockQiToken} from "../src/MockQiToken.sol";
import {BenqiAdapter} from "../src/BenqiAdapter.sol";
import {AeroRouter} from "../src/AeroRouter.sol";

contract AeroRouterTest is Test {
    TestUSDC usdc;
    MockQiToken benqiMarket;
    MockQiToken joeMarket;
    BenqiAdapter benqiAdapter;
    BenqiAdapter joeAdapter;
    AeroRouter router;
    address alice = address(0xA11CE);

    function _adapters() internal view returns (address[] memory a) {
        a = new address[](2);
        a[0] = address(benqiAdapter);
        a[1] = address(joeAdapter);
    }

    function _targets(uint256 b, uint256 j) internal pure returns (uint256[] memory t) {
        t = new uint256[](2);
        t[0] = b;
        t[1] = j;
    }

    function setUp() public {
        vm.warp(100 days);
        usdc = new TestUSDC();
        // Benqi side earns ≈5%, Joe side ≈3%.
        benqiMarket = new MockQiToken(usdc, 1584400000, "Mock Benqi USDC", "mqiUSDC");
        joeMarket = new MockQiToken(usdc, 950640000, "Mock Trader Joe USDC", "mjjUSDC");
        benqiAdapter = new BenqiAdapter(benqiMarket, "benqi-test");
        joeAdapter = new BenqiAdapter(joeMarket, "joe-test");
        address[] memory a = _adapters();
        router = new AeroRouter(usdc, a, _targets(6000, 4000));
        vm.prank(alice);
        usdc.faucet();
        // Seed both markets so redemptions always clear.
        vm.startPrank(alice);
        usdc.transfer(address(benqiMarket), 2_000 * 1e6);
        usdc.transfer(address(joeMarket), 2_000 * 1e6);
        usdc.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function test_allocatesByTarget() public {
        vm.prank(alice);
        router.deposit(1_000 * 1e6);
        assertEq(benqiAdapter.balance(), 600 * 1e6);
        assertEq(joeAdapter.balance(), 400 * 1e6);
    }

    function test_liveApyIsWeighted() public {
        vm.prank(alice);
        router.deposit(1_000 * 1e6);
        // Integer math: benqi reads 499 bps, joe 299 bps →
        // (600 × 499 + 400 × 299) / 1000 = 419.
        assertEq(router.liveApyBps(), 419);
    }

    function test_rebalanceRestoresTargets() public {
        vm.prank(alice);
        router.deposit(1_000 * 1e6);
        // Rates differ, so time drifts the ratio off 60/40 (needs ~180d to clear the 25bps band).
        vm.warp(block.timestamp + 180 days);
        benqiMarket.accrue();
        joeMarket.accrue();
        router.rebalance();
        uint256 total = router.totalAssets();
        uint256 benqiShare = (benqiAdapter.balance() * 10_000) / total;
        assertGe(benqiShare, 5950);
        assertLe(benqiShare, 6050);
    }

    function test_rebalanceSkipsWhenInBand() public {
        vm.prank(alice);
        router.deposit(1_000 * 1e6);
        vm.expectRevert("IN_BAND");
        router.rebalance();
    }

    function test_withdrawRoundTrip() public {
        vm.startPrank(alice);
        uint256 shares = router.deposit(1_000 * 1e6);
        vm.warp(block.timestamp + 30 days);
        uint256 assets = router.withdraw(shares);
        vm.stopPrank();
        assertGe(assets, 1_000 * 1e6);
    }

    function test_targetsMustSum() public {
        address[] memory a = _adapters();
        vm.expectRevert("MUST_SUM_10000");
        router.setTargets(_targets(5000, 4000));
        a;
    }
}
