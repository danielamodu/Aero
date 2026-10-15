// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {MockQiToken} from "../src/MockQiToken.sol";
import {BenqiAdapter} from "../src/BenqiAdapter.sol";

/// @notice Deploy the Benqi-compat market + adapter on Fuji (leaves the
///         existing tUSDC / vault / registry untouched).
/// @dev Usage: TEST_USDC_ADDR=0x… forge script script/DeployBenqi.s.sol --rpc-url fuji --broadcast
///      Needs DEPLOYER_KEY in env (Fuji-funded test key only).
contract DeployBenqi is Script {
    uint256 constant RATE_5PCT = 1584400000; // ≈5% APR, 1e18-scaled per second

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address usdcAddr = vm.envAddress("TEST_USDC_ADDR");
        vm.startBroadcast(key);
        MockQiToken market = new MockQiToken(IERC20(usdcAddr), RATE_5PCT, "Mock Benqi USDC", "mqiUSDC");
        BenqiAdapter adapter = new BenqiAdapter(market, "benqi-usdc-fuji-mock");
        // Seed market liquidity if the deployer holds anything (faucet may be cooling down).
        uint256 bal = TestUSDC(usdcAddr).balanceOf(msg.sender);
        if (bal > 100 * 1e6) {
            TestUSDC(usdcAddr).transfer(address(market), bal / 2);
        }
        vm.stopBroadcast();
        console.log("MockQiToken:", address(market));
        console.log("BenqiAdapter:", address(adapter));
        console.log("Set NEXT_PUBLIC_MOCK_QITOKEN / NEXT_PUBLIC_BENQI_ADAPTER to the above.");
    }
}
