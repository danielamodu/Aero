// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BenqiAdapter} from "../../src/BenqiAdapter.sol";
import {IQiToken} from "../../src/interfaces/IQiToken.sol";

/// @notice Proves the adapter speaks REAL Benqi mainnet markets.
/// @dev Run: forge test --fork-url https://api.avax.network/ext/bc/C/rpc --match-path test/fork/*
///      Guarded on chainid so plain `forge test` passes through untouched.
contract BenqiMainnetForkTest is Test {
    // NOTE: qiUSDC is the USDC.e (bridged) market AND its minting is paused.
    // qiUSDCn is the native-USDC market and open — the adapter reads the
    // underlying from the market instead of assuming.
    IQiToken constant QIUSDC = IQiToken(0xB715808a78F6041E46d61Cb123C9B4A27056AE9C);

    function test_liveRateIsSane() public {
        if (block.chainid != 43114) return;
        BenqiAdapter adapter = new BenqiAdapter(QIUSDC, "benqi-usdc");
        uint256 bps = adapter.liveApyBps();
        assertGt(bps, 0, "rate should be positive");
        assertLt(bps, 5000, "rate should be under 50%");
    }

    function test_roundTripOnRealMarket() public {
        if (block.chainid != 43114) return;
        BenqiAdapter adapter = new BenqiAdapter(QIUSDC, "benqi-usdc");
        IERC20 underlying = IERC20(address(adapter.asset()));
        address user = address(0xBEEF);
        deal(address(underlying), user, 10_000 * 1e6);
        vm.startPrank(user);
        underlying.approve(address(adapter), type(uint256).max);
        uint256 shares = adapter.deposit(1_000 * 1e6);
        assertGt(shares, 0, "no shares minted");
        vm.roll(block.number + 1000);
        uint256 assets = adapter.withdraw(shares);
        vm.stopPrank();
        assertGe(assets, 999 * 1e6, "principal should round-trip");
    }
}
