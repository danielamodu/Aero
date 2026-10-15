// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {AeroVault} from "../src/AeroVault.sol";
import {AeroNames} from "../src/AeroNames.sol";

/// @notice Deploy the Aero testnet stack to Fuji.
/// @dev Usage: forge script script/Deploy.s.sol --rpc-url fuji --broadcast
///      Needs DEPLOYER_KEY in env (a Fuji-funded test key — never mainnet)
///      and a `[rpc_endpoints] fuji = "https://api.avax-test.network/ext/bc/C/rpc"`
///      entry in contracts/foundry.toml.
contract Deploy is Script {
    // ≈5% APR, 1e18-scaled per second.
    uint256 constant RATE_5PCT = 1584400000;

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(key);
        TestUSDC usdc = new TestUSDC();
        AeroVault vault = new AeroVault(usdc, RATE_5PCT);
        AeroNames names = new AeroNames();
        // Seed the mock vault with yield so withdrawals cover accrual
        // (one faucet claim = 10k; keep 1k dust, seed the rest).
        usdc.faucet();
        usdc.transfer(address(vault), 9_000 * 10 ** 6);
        vm.stopBroadcast();
        console.log("TestUSDC:", address(usdc));
        console.log("AeroVault:", address(vault));
        console.log("AeroNames:", address(names));
        console.log("Set NEXT_PUBLIC_TEST_USDC / NEXT_PUBLIC_AERO_VAULT / NEXT_PUBLIC_AERO_NAMES to the above.");
    }
}
