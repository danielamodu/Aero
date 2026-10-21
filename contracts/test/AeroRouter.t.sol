// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {AeroRouter} from "../src/AeroRouter.sol";
import {MockYieldAdapter} from "./mocks/MockYieldAdapter.sol";

contract MockDecimalsERC20 is ERC20 {
    uint8 private immutable _mockDecimals;

    constructor(uint8 decimals_) ERC20("Mock Decimal Asset", "MDA") {
        _mockDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _mockDecimals;
    }
}

contract AeroRouterTest is Test {
    TestUSDC usdc;
    MockYieldAdapter adapterA;
    MockYieldAdapter adapterB;
    AeroRouter router;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address attacker = address(0xBAD);

    function _adapters(address a, address b) internal pure returns (address[] memory result) {
        result = new address[](2);
        result[0] = a;
        result[1] = b;
    }

    function _targets(uint256 a, uint256 b) internal pure returns (uint256[] memory result) {
        result = new uint256[](2);
        result[0] = a;
        result[1] = b;
    }

    function setUp() public {
        vm.warp(100 days);
        usdc = new TestUSDC();
        adapterA = new MockYieldAdapter(usdc, "market-a");
        adapterB = new MockYieldAdapter(usdc, "market-b");
        router = new AeroRouter(usdc, _adapters(address(adapterA), address(adapterB)), _targets(6000, 4000));
        adapterA.setRouter(address(router));
        adapterB.setRouter(address(router));

        vm.prank(alice);
        usdc.faucet();
        vm.prank(bob);
        usdc.faucet();
        vm.prank(alice);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(router), type(uint256).max);
    }

    function _deposit(address user, uint256 assets) internal returns (uint256 shares) {
        uint256 minShares = router.previewDeposit(assets);
        vm.prank(user);
        shares = router.deposit(assets, minShares);
    }

    function _targetSum() internal view returns (uint256 sum) {
        for (uint256 i = 0; i < router.slotCount(); i++) {
            (, uint256 target) = router.slots(i);
            sum += target;
        }
    }

    function test_allocatesByTargetAndCountsRouterSharesOnly() public {
        _deposit(alice, 1_000 * 1e6);
        assertEq(router.slotAssets(0), 600 * 1e6);
        assertEq(router.slotAssets(1), 400 * 1e6);
        assertEq(router.totalAssets(), 1_000 * 1e6);
    }

    function test_liveApyIsWeightedByRouterOwnedAssets() public {
        adapterA.setRateBps(500);
        adapterB.setRateBps(300);
        _deposit(alice, 1_000 * 1e6);
        assertEq(router.liveApyBps(), 420);
    }

    function test_rebalanceRestoresTargetsAfterMarketDonation() public {
        _deposit(alice, 1_000 * 1e6);
        deal(address(usdc), address(adapterA), 100 * 1e6);
        router.rebalance();
        uint256 total = router.totalAssets();
        assertApproxEqAbs(router.slotAssets(0), (total * 6000) / 10_000, 1);
        assertApproxEqAbs(router.slotAssets(1), (total * 4000) / 10_000, 1);
    }

    function test_rebalanceSkipsWhenInBand() public {
        _deposit(alice, 1_000 * 1e6);
        vm.expectRevert("IN_BAND");
        router.rebalance();
    }

    function test_firstAndSubsequentDepositsMintAtCurrentSharePrice() public {
        uint256 firstShares = _deposit(alice, 100 * 1e6);
        uint256 secondShares = _deposit(bob, 200 * 1e6);
        assertEq(firstShares, 100 * 1e18);
        assertEq(secondShares, 200 * 1e18);
        assertEq(router.totalAssets(), 300 * 1e6);
        assertEq(router.previewWithdraw(firstShares), 100 * 1e6);
    }

    function test_allocationRoundingRemainsInIdleAndIsAccounted() public {
        uint256 shares = _deposit(alice, 3);
        assertEq(shares, 3e12);
        assertEq(usdc.balanceOf(address(router)), 1);
        assertEq(router.totalAssets(), 3);
        assertEq(router.sharePrice(), 1e6);
    }

    function test_directAdapterUsersAreRejectedAndRouterOwnsAdapterShares() public {
        vm.expectRevert("ONLY_ROUTER");
        vm.prank(alice);
        adapterA.deposit(100 * 1e6);

        _deposit(alice, 100 * 1e6);
        assertEq(adapterA.balanceOf(alice), 0);
        assertEq(adapterA.balanceOf(address(router)), 60 * 1e6);
        assertEq(router.slotAssets(0), 60 * 1e6);
    }

    function test_directDonationAccruesToExistingShareholders() public {
        _deposit(alice, 1_000 * 1e6);
        vm.prank(alice);
        assertTrue(usdc.transfer(address(router), 100 * 1e6));
        assertEq(router.totalAssets(), 1_100 * 1e6);
        assertApproxEqAbs(router.sharePrice(), 1_100_000, 1);
        uint256 shares = router.balanceOf(alice);
        vm.prank(alice);
        uint256 received = router.withdraw(shares);
        assertApproxEqAbs(received, 1_100 * 1e6, 1);
        assertLe(router.totalAssets(), 1);
    }

    function test_preShareDonationBlocksDepositUntilOwnerRecoversIt() public {
        deal(address(usdc), address(router), 10 * 1e6);
        assertEq(router.totalAssets(), 10 * 1e6);
        vm.expectRevert("ORPHANED_ASSETS");
        router.deposit(1 * 1e6, 0);
        router.recoverOrphanedAssets(address(this));
        _deposit(alice, 1 * 1e6);
        assertEq(router.totalAssets(), 1 * 1e6);
    }

    function test_virtualOffsetPreventsClassicDonationInflationAttack() public {
        deal(address(usdc), attacker, 2_000_000);
        vm.startPrank(attacker);
        usdc.approve(address(router), type(uint256).max);
        uint256 seedShares = router.previewDeposit(1);
        router.deposit(1, seedShares);
        assertTrue(usdc.transfer(address(router), 1_000_000));
        vm.stopPrank();

        uint256 victimAssets = 2_000_000;
        uint256 victimShares = router.previewDeposit(victimAssets);
        vm.prank(alice);
        router.deposit(victimAssets, victimShares);

        vm.prank(attacker);
        uint256 attackerOut = router.withdraw(seedShares);
        assertLt(attackerOut, 1_000_001);

        uint256 victimShareBalance = router.balanceOf(alice);
        vm.prank(alice);
        uint256 victimOut = router.withdraw(victimShareBalance);
        assertGe(victimOut + 1, victimAssets);

        // Model the attacker also controlling the router owner key and sweeping
        // any value left after the last shareholder fully exits.
        uint256 attackerBeforeRecovery = usdc.balanceOf(attacker);
        router.recoverOrphanedAssets(attacker);
        uint256 orphanRecovery = usdc.balanceOf(attacker) - attackerBeforeRecovery;
        assertEq(router.totalSupply(), 0);
        assertLe(attackerOut + orphanRecovery, 1_000_002);
        assertLe(victimAssets - victimOut, 1);
    }

    function testFuzz_virtualOffsetBoundsRepeatedDonationAttack(
        uint32 seedInput,
        uint32 donationInput,
        uint32 victimInput
    ) public {
        uint256 seed = uint256(seedInput % 1_000_000) + 1;
        uint256 donation = uint256(donationInput % 2_000_000) + 1;
        uint256 victimAssets = uint256(victimInput % 5_000_000) + 2_000_000;
        deal(address(usdc), attacker, seed + donation);
        deal(address(usdc), alice, victimAssets);

        vm.startPrank(attacker);
        usdc.approve(address(router), type(uint256).max);
        uint256 attackerShares = router.previewDeposit(seed);
        router.deposit(seed, attackerShares);
        uint256 installment = donation / 4;
        for (uint256 i = 0; i < 4; i++) {
            uint256 amount = i == 3 ? donation - (installment * 3) : installment;
            assertTrue(usdc.transfer(address(router), amount));
        }
        vm.stopPrank();

        vm.prank(alice);
        usdc.approve(address(router), type(uint256).max);
        uint256 victimShares = router.previewDeposit(victimAssets);
        vm.prank(alice);
        router.deposit(victimAssets, victimShares);

        vm.prank(attacker);
        uint256 attackerOut = router.withdraw(attackerShares);
        assertLe(attackerOut, seed + donation);
        uint256 victimShareBalance = router.balanceOf(alice);
        vm.prank(alice);
        assertGe(router.withdraw(victimShareBalance) + 1, victimAssets);
        uint256 orphanRecovery;
        if (router.totalAssets() > 0) {
            uint256 attackerBeforeRecovery = usdc.balanceOf(attacker);
            router.recoverOrphanedAssets(attacker);
            orphanRecovery = usdc.balanceOf(attacker) - attackerBeforeRecovery;
        }
        assertLe(attackerOut + orphanRecovery, seed + donation + 1);
    }

    function test_constructorAcceptsOnlySixDecimalAsset() public {
        assertEq(router.virtualShares(), 1e12);

        MockDecimalsERC20 zeroDecimals = new MockDecimalsERC20(0);
        vm.expectRevert("ASSET_MUST_HAVE_6_DECIMALS");
        new AeroRouter(zeroDecimals, new address[](0), new uint256[](0));

        MockDecimalsERC20 eightDecimals = new MockDecimalsERC20(8);
        vm.expectRevert("ASSET_MUST_HAVE_6_DECIMALS");
        new AeroRouter(eightDecimals, new address[](0), new uint256[](0));

        MockDecimalsERC20 eighteenDecimals = new MockDecimalsERC20(18);
        vm.expectRevert("ASSET_MUST_HAVE_6_DECIMALS");
        new AeroRouter(eighteenDecimals, new address[](0), new uint256[](0));
    }

    function test_minSharesRejectsPriceMovementAfterPreview() public {
        _deposit(alice, 100 * 1e6);
        uint256 preview = router.previewDeposit(100 * 1e6);
        vm.prank(alice);
        assertTrue(usdc.transfer(address(router), 100 * 1e6));
        vm.prank(bob);
        vm.expectRevert("SLIPPAGE");
        router.deposit(100 * 1e6, preview);
    }

    function test_adapterDepositWithoutMintRevertsAndRollsBack() public {
        adapterA.setDepositBehavior(true, false);
        uint256 beforeRouter = usdc.balanceOf(address(router));
        uint256 beforeAdapter = usdc.balanceOf(address(adapterA));
        uint256 minShares = router.previewDeposit(100 * 1e6);
        vm.expectRevert("ZERO_ADAPTER_SHARES");
        vm.prank(alice);
        router.deposit(100 * 1e6, minShares);
        assertEq(usdc.balanceOf(address(router)), beforeRouter);
        assertEq(usdc.balanceOf(address(adapterA)), beforeAdapter);
        assertEq(router.totalSupply(), 0);
    }

    function test_adapterDepositWrongShareReportRevertsAndRollsBack() public {
        adapterA.setDepositBehavior(false, true);
        uint256 beforeAdapter = usdc.balanceOf(address(adapterA));
        uint256 minShares = router.previewDeposit(100 * 1e6);
        vm.expectRevert("ADAPTER_SHARE_MISMATCH");
        vm.prank(alice);
        router.deposit(100 * 1e6, minShares);
        assertEq(usdc.balanceOf(address(adapterA)), beforeAdapter);
        assertEq(router.totalSupply(), 0);
    }

    function test_adapterDepositUnderlyingValueShortfallRevertsAndRollsBack() public {
        adapterA.setRetainedDepositValueBps(9_000);
        uint256 minShares = router.previewDeposit(100 * 1e6);
        uint256 beforeAdapter = usdc.balanceOf(address(adapterA));
        vm.expectRevert("ADAPTER_VALUE_SHORTFALL");
        vm.prank(alice);
        router.deposit(100 * 1e6, minShares);
        assertEq(usdc.balanceOf(address(adapterA)), beforeAdapter);
        assertEq(router.totalSupply(), 0);
    }

    function test_routerShareDecimalsAndConfigurationGate() public view {
        assertEq(router.decimals(), 18);
        assertEq(adapterA.decimals(), 6);
        assertTrue(router.configurationValid());
    }

    function test_withdrawUsesIdleUsdcBeforeAdapters() public {
        _deposit(alice, 1_000 * 1e6);
        vm.prank(alice);
        assertTrue(usdc.transfer(address(router), 100 * 1e6));
        uint256 beforeBalance = usdc.balanceOf(alice);
        uint256 sharesToWithdraw = (router.balanceOf(alice) * 9) / 100;
        vm.prank(alice);
        uint256 received = router.withdraw(sharesToWithdraw);
        assertApproxEqAbs(received, 99 * 1e6, 2);
        assertEq(usdc.balanceOf(alice) - beforeBalance, received);
        assertEq(adapterA.withdrawCount(), 0);
        assertEq(adapterB.withdrawCount(), 0);
    }

    function test_adapterSharePriceChangesAreReflectedInRouterAssets() public {
        _deposit(alice, 1_000 * 1e6);
        deal(address(usdc), address(adapterA), 660 * 1e6);
        assertEq(router.slotAssets(0), 660 * 1e6);
        assertEq(router.totalAssets(), 1_060 * 1e6);
        assertApproxEqAbs(router.sharePrice(), 1_060_000, 1);
    }

    function test_marketLossReducesSharePriceAndWithdrawableAssets() public {
        _deposit(alice, 1_000 * 1e6);
        adapterA.simulateLoss(300 * 1e6);
        assertEq(router.totalAssets(), 700 * 1e6);
        assertApproxEqAbs(router.sharePrice(), 700_000, 1);
        uint256 shares = router.balanceOf(alice);
        vm.prank(alice);
        assertEq(router.withdraw(shares), 700 * 1e6);
    }

    function test_totalLossBlocksFurtherDepositsAndWithdrawals() public {
        _deposit(alice, 100 * 1e6);
        adapterA.simulateLoss(60 * 1e6);
        adapterB.simulateLoss(40 * 1e6);
        assertEq(router.totalAssets(), 0);
        vm.expectRevert("TOTAL_LOSS");
        router.previewDeposit(1e6);
        vm.prank(bob);
        vm.expectRevert("TOTAL_LOSS");
        router.deposit(1e6, 0);
        uint256 shares = router.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert("NO_ASSETS");
        router.withdraw(shares);
    }

    function test_duplicateAdapterRejectedAtConstructionAndRegistration() public {
        vm.expectRevert("DUPLICATE_ADAPTER");
        new AeroRouter(usdc, _adapters(address(adapterA), address(adapterA)), _targets(5000, 5000));

        router.setTargets(_targets(10_000, 0));
        vm.expectRevert("DUPLICATE_ADAPTER");
        router.addAdapter(address(adapterA));
        assertEq(_targetSum(), 10_000);
    }

    function test_zeroAddressAndNonContractAdaptersRejected() public {
        address[] memory zeroAdapters = _adapters(address(0), address(adapterB));
        vm.expectRevert("ZERO_ADAPTER");
        new AeroRouter(usdc, zeroAdapters, _targets(5000, 5000));

        address[] memory noCode = _adapters(address(0xBEEF), address(adapterB));
        vm.expectRevert("ADAPTER_NOT_CONTRACT");
        new AeroRouter(usdc, noCode, _targets(5000, 5000));
    }

    function test_incompatibleAdapterAssetRejected() public {
        TestUSDC otherAsset = new TestUSDC();
        MockYieldAdapter incompatible = new MockYieldAdapter(otherAsset, "wrong-asset");
        address[] memory one = new address[](1);
        one[0] = address(incompatible);
        uint256[] memory allToOne = new uint256[](1);
        allToOne[0] = 10_000;
        vm.expectRevert("ASSET_MISMATCH");
        new AeroRouter(usdc, one, allToOne);
    }

    function test_incompatibleAdapterWithoutConversionInterfaceRejected() public {
        address[] memory one = new address[](1);
        one[0] = address(usdc);
        uint256[] memory allToOne = new uint256[](1);
        allToOne[0] = 10_000;
        vm.expectRevert();
        new AeroRouter(usdc, one, allToOne);
    }

    function test_addAndRemovePreserveAllocationInvariant() public {
        router.setTargets(_targets(10_000, 0));
        MockYieldAdapter third = new MockYieldAdapter(usdc, "market-c");
        third.setRouter(address(router));
        router.addAdapter(address(third));
        assertEq(router.slotCount(), 3);
        assertEq(_targetSum(), 10_000);

        vm.expectRevert("TARGET_NOT_ZERO");
        router.removeAdapter(0);
        uint256[] memory invalidTargets = new uint256[](3);
        invalidTargets[0] = 9000;
        vm.expectRevert("MUST_SUM_10000");
        router.setTargets(invalidTargets);

        uint256[] memory targets = new uint256[](3);
        targets[0] = 10_000;
        router.setTargets(targets);
        assertEq(_targetSum(), 10_000);
        router.removeAdapter(2);
        assertEq(router.slotCount(), 2);
        assertEq(_targetSum(), 10_000);
        router.removeAdapter(1);
        assertEq(router.slotCount(), 1);
        assertEq(_targetSum(), 10_000);
        vm.expectRevert("LAST_ADAPTER");
        router.removeAdapter(0);
    }

    function test_cannotRemoveAdapterWithRouterSharesEvenIfTargetIsZero() public {
        _deposit(alice, 1_000 * 1e6);
        router.setTargets(_targets(10_000, 0));
        vm.expectRevert("POSITION_NOT_EMPTY");
        router.removeAdapter(1);
    }

    function test_routerDoesNotLeaveStandingAdapterAllowances() public {
        _deposit(alice, 1_000 * 1e6);
        assertEq(usdc.allowance(address(router), address(adapterA)), 0);
        assertEq(usdc.allowance(address(router), address(adapterB)), 0);
    }

    function test_illiquidAdapterRevertsAtomicallyWithoutBurningShares() public {
        _deposit(alice, 1_000 * 1e6);
        uint256 shares = router.balanceOf(alice);
        uint256 adapterSharesBefore = adapterA.balanceOf(address(router));
        adapterA.setWithdrawBehavior(false, 10_000, 100 * 1e6);
        vm.prank(alice);
        vm.expectRevert("ADAPTER_WITHDRAW_FAILED");
        router.withdraw(shares);
        assertEq(router.balanceOf(alice), shares);
        assertEq(adapterA.balanceOf(address(router)), adapterSharesBefore);
    }

    function test_adapterRevertRevertsEntireWithdrawal() public {
        _deposit(alice, 1_000 * 1e6);
        uint256 shares = router.balanceOf(alice);
        adapterA.setWithdrawBehavior(true, 10_000, type(uint256).max);
        vm.prank(alice);
        vm.expectRevert("ADAPTER_WITHDRAW_FAILED");
        router.withdraw(shares);
        assertEq(router.balanceOf(alice), shares);
    }

    function test_partialAdapterReturnRevertsWithoutBurningShares() public {
        _deposit(alice, 1_000 * 1e6);
        uint256 shares = router.balanceOf(alice);
        adapterA.setWithdrawBehavior(false, 9_000, type(uint256).max);
        vm.prank(alice);
        vm.expectRevert("ADAPTER_SHORTFALL");
        router.withdraw(shares);
        assertEq(router.balanceOf(alice), shares);
        assertEq(router.totalAssets(), 1_000 * 1e6);
    }

    function test_oneFailingAdapterRollsBackEarlierLiquidRedemption() public {
        _deposit(alice, 1_000 * 1e6);
        uint256 shares = router.balanceOf(alice);
        uint256 adapterAShares = adapterA.balanceOf(address(router));
        uint256 adapterBShares = adapterB.balanceOf(address(router));
        adapterB.setWithdrawBehavior(true, 10_000, type(uint256).max);
        vm.prank(alice);
        vm.expectRevert("ADAPTER_WITHDRAW_FAILED");
        router.withdraw(shares);
        assertEq(router.balanceOf(alice), shares);
        assertEq(adapterA.balanceOf(address(router)), adapterAShares);
        assertEq(adapterB.balanceOf(address(router)), adapterBShares);
        assertEq(router.totalAssets(), 1_000 * 1e6);
    }

    function test_completeRouterWithdrawalReturnsAllAssetsAndBurnsShares() public {
        _deposit(alice, 1_000 * 1e6);
        uint256 shares = router.balanceOf(alice);
        vm.prank(alice);
        uint256 received = router.withdraw(shares);
        assertEq(received, 1_000 * 1e6);
        assertEq(router.balanceOf(alice), 0);
        assertEq(router.totalSupply(), 0);
        assertEq(adapterA.balanceOf(address(router)), 0);
        assertEq(adapterB.balanceOf(address(router)), 0);
    }
}
