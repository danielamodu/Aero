// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TestUSDC} from "../src/TestUSDC.sol";

/// @notice One-off seed: split the deployer's tUSDC between the Joe market and the bank.
/// @dev Usage: TEST_USDC_ADDR=0x… JOE_MARKET=0x… BANK=0x…
///      forge script script/Seed.s.sol --rpc-url fuji --broadcast
///      NOTE: use vm.addr(key) explicitly — msg.sender is NOT the broadcaster in scripts.
contract Seed is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(key);
        address usdcAddr = vm.envAddress("TEST_USDC_ADDR");
        address joeMarket = vm.envAddress("JOE_MARKET");
        address bank = vm.envAddress("BANK");
        vm.startBroadcast(key);
        uint256 bal = TestUSDC(usdcAddr).balanceOf(deployer);
        if (bal > 300 * 1e6) {
            // transfer() sends the broadcaster's own tokens — no allowance or
            // msg.sender games involved.
            TestUSDC(usdcAddr).transfer(joeMarket, 200 * 1e6);
            TestUSDC(usdcAddr).transfer(bank, bal - 300 * 1e6);
        }
        vm.stopBroadcast();
    }
}
