// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {MockQiToken} from "../src/MockQiToken.sol";
import {BenqiAdapter} from "../src/BenqiAdapter.sol";
import {AeroRouter} from "../src/AeroRouter.sol";
import {AeroPay} from "../src/AeroPay.sol";
import {AeroBank} from "../src/AeroBank.sol";

/// @notice Deploys a fresh, self-consistent B2.1.1 mock router stack on Fuji.
/// @dev Usage: TEST_USDC_ADDR=0x… forge script script/DeployMore.s.sol --rpc-url fuji --broadcast
///      Needs DEPLOYER_KEY in env (Fuji-funded test key only).
contract DeployMore is Script {
    uint256 constant RATE_BENQI = 1_584_400_000;
    uint256 constant RATE_JOE = 950_640_000;

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(key);
        address usdcAddr = vm.envAddress("TEST_USDC_ADDR");
        require(usdcAddr.code.length > 0, "USDC_NOT_CONTRACT");
        require(IERC20Metadata(usdcAddr).decimals() == 6, "USDC_MUST_HAVE_6_DECIMALS");

        vm.startBroadcast(key);
        MockQiToken benqiMarket = new MockQiToken(IERC20(usdcAddr), RATE_BENQI, "Mock Benqi USDC", "mqiUSDC");
        MockQiToken joeMarket = new MockQiToken(IERC20(usdcAddr), RATE_JOE, "Mock Trader Joe USDC", "mjjUSDC");
        BenqiAdapter benqiAdapter = new BenqiAdapter(benqiMarket, "benqi-usdc-fuji-mock");
        BenqiAdapter joeAdapter = new BenqiAdapter(joeMarket, "joe-usdc-fuji-mock");

        address[] memory adapters = new address[](2);
        adapters[0] = address(benqiAdapter);
        adapters[1] = address(joeAdapter);
        uint256[] memory targets = new uint256[](2);
        targets[0] = 6000;
        targets[1] = 4000;
        AeroRouter router = new AeroRouter(IERC20(usdcAddr), adapters, targets);
        require(router.owner() == deployer, "ROUTER_OWNER_MISMATCH");
        require(benqiAdapter.owner() == deployer && joeAdapter.owner() == deployer, "ADAPTER_OWNER_MISMATCH");
        benqiAdapter.setRouter(address(router));
        joeAdapter.setRouter(address(router));
        require(router.configurationValid(), "ROUTER_CONFIGURATION_INVALID");
        require(router.deploymentVersion() == 2_111, "ROUTER_VERSION_MISMATCH");

        AeroPay pay = new AeroPay();
        AeroBank bank = new AeroBank(IERC20(usdcAddr));
        require(bank.owner() == deployer, "BANK_OWNER_MISMATCH");
        vm.stopBroadcast();

        console.log("MockBenqiMarket:", address(benqiMarket));
        console.log("BenqiAdapter:", address(benqiAdapter));
        console.log("MockJoeMarket:", address(joeMarket));
        console.log("JoeAdapter:", address(joeAdapter));
        console.log("AeroRouter B2.1.1:", address(router));
        console.log("AeroPay:", address(pay));
        console.log("AeroBank:", address(bank));
        console.log("Use the new router address only after this simulation validates successfully.");
    }
}
