// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {MockQiToken} from "../src/MockQiToken.sol";
import {BenqiAdapter} from "../src/BenqiAdapter.sol";

/// @notice Deploys a standalone mock Benqi market and unbound adapter on Fuji.
///         This diagnostic stack is not accepted by the integrated deployment;
///         DeployMore creates and binds a fresh adapter pair atomically instead.
/// @dev Usage: TEST_USDC_ADDR=0x… forge script script/DeployBenqi.s.sol --rpc-url fuji --broadcast
///      Needs DEPLOYER_KEY in env (Fuji-funded test key only).
contract DeployBenqi is Script {
    uint256 constant RATE_5PCT = 1584400000; // ≈5% APR, 1e18-scaled per second

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address usdcAddr = vm.envAddress("TEST_USDC_ADDR");
        require(usdcAddr.code.length > 0, "USDC_NOT_CONTRACT");
        require(IERC20Metadata(usdcAddr).decimals() == 6, "USDC_MUST_HAVE_6_DECIMALS");
        vm.startBroadcast(key);
        MockQiToken market = new MockQiToken(IERC20(usdcAddr), RATE_5PCT, "Mock Benqi USDC", "mqiUSDC");
        BenqiAdapter adapter = new BenqiAdapter(market, "benqi-usdc-fuji-mock");
        // Seed market liquidity if the deployer holds anything (faucet may be cooling down).
        uint256 bal = TestUSDC(usdcAddr).balanceOf(msg.sender);
        if (bal > 100 * 1e6) {
            require(TestUSDC(usdcAddr).transfer(address(market), bal / 2), "SEED_TRANSFER_FAILED");
        }
        vm.stopBroadcast();
        console.log("MockQiToken:", address(market));
        console.log("BenqiAdapter:", address(adapter));
        console.log("Standalone adapter is unbound and is not a DeployMore input.");
    }
}
