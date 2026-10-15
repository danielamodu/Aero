// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AeroNames} from "../src/AeroNames.sol";

contract AeroNamesTest is Test {
    AeroNames names;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        names = new AeroNames();
    }

    function test_registerAndResolve() public {
        vm.prank(alice);
        names.register("maya");
        assertEq(names.resolveAddress("maya"), alice);
        assertEq(names.resolveUsername(alice), "maya");
    }

    function test_rejectsBadNames() public {
        vm.startPrank(alice);
        vm.expectRevert("BAD_NAME");
        names.register("ab");
        vm.expectRevert("BAD_NAME");
        names.register("Maya"); // uppercase
        vm.expectRevert("BAD_NAME");
        names.register("with space");
        vm.expectRevert("BAD_NAME");
        names.register("with-dash");
        vm.stopPrank();
    }

    function test_rejectsTaken() public {
        vm.prank(alice);
        names.register("maya");
        vm.prank(bob);
        vm.expectRevert("TAKEN");
        names.register("maya");
    }

    function test_reregisterReleasesOld() public {
        vm.startPrank(alice);
        names.register("maya");
        names.register("leo");
        vm.stopPrank();
        assertEq(names.resolveAddress("maya"), address(0));
        assertEq(names.resolveAddress("leo"), alice);
        assertEq(names.resolveUsername(alice), "leo");
    }

    function test_release() public {
        vm.startPrank(alice);
        names.register("maya");
        names.release();
        vm.stopPrank();
        assertEq(names.resolveAddress("maya"), address(0));
        assertEq(bytes(names.resolveUsername(alice)).length, 0);
    }

    function test_unknownResolvesEmpty() public {
        assertEq(names.resolveAddress("nobody"), address(0));
        assertEq(bytes(names.resolveUsername(bob)).length, 0);
    }
}
