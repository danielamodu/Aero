// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {MockQiToken} from "../src/MockQiToken.sol";
import {BenqiAdapter} from "../src/BenqiAdapter.sol";
import {AeroRouter} from "../src/AeroRouter.sol";
import {AeroPay} from "../src/AeroPay.sol";
import {AeroBank} from "../src/AeroBank.sol";

/// @notice Deploy round 2 on Fuji: Joe market + adapter, router, pay, bank.
///         Reuses the existing tUSDC / Benqi adapter / registry (untouched).
/// @dev Usage: TEST_USDC_ADDR=0x… BENQI_ADAPTER_ADDR=0x… NAMES_ADDR=0x…
///      forge script script/DeployMore.s.sol --rpc-url fuji --broadcast
///      Needs DEPLOYER_KEY in env (Fuji-funded test key only).
contract DeployMore is Script {
    uint256 constant RATE_3PCT = 950640000; // ≈3% APR, 1e18-scaled per second

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address usdcAddr = vm.envAddress("TEST_USDC_ADDR");
        address benqiAdapter = vm.envAddress("BENQI_ADAPTER_ADDR");
        address namesAddr = vm.envAddress("NAMES_ADDR");
        vm.startBroadcast(key);

        MockQiToken joeMarket = new MockQiToken(IERC20(usdcAddr), RATE_3PCT, "Mock Trader Joe USDC", "mjjUSDC");
        BenqiAdapter joeAdapter = new BenqiAdapter(joeMarket, "joe-usdc-fuji-mock");

        address[] memory adapters = new address[](2);
        adapters[0] = benqiAdapter;
        adapters[1] = address(joeAdapter);
        uint256[] memory targets = new uint256[](2);
        targets[0] = 6000;
        targets[1] = 4000;
        AeroRouter router = new AeroRouter(IERC20(usdcAddr), adapters, targets);

        AeroPay pay = new AeroPay();
        AeroBank bank = new AeroBank(IERC20(usdcAddr));
        vm.stopBroadcast();

        console.log("MockJoeMarket:", address(joeMarket));
        console.log("JoeAdapter:", address(joeAdapter));
        console.log("AeroRouter:", address(router));
        console.log("AeroPay:", address(pay));
        console.log("AeroBank:", address(bank));
        console.log("Set NEXT_PUBLIC_ROUTER / NEXT_PUBLIC_AEROPAY / NEXT_PUBLIC_BANK (+JOE_ADAPTER optional).");
    }
}
