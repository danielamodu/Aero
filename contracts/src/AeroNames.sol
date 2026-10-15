// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AeroNames — @username registry for Aero testnet.
/// @notice One lowercase handle per address (3–20 chars: a-z, 0-9, _).
///         Registering a new handle releases the old one.
contract AeroNames {
    mapping(bytes32 => address) private _owners;
    mapping(address => bytes32) private _names;
    mapping(bytes32 => string) private _spellings;

    event Registered(bytes32 indexed nameHash, string name, address indexed owner);
    event Released(bytes32 indexed nameHash, address indexed owner);

    function _valid(bytes memory b) internal pure returns (bool) {
        if (b.length < 3 || b.length > 20) return false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x5f;
            if (!ok) return false;
        }
        return true;
    }

    function register(string calldata name) external {
        bytes memory b = bytes(name);
        require(_valid(b), "BAD_NAME");
        bytes32 h = keccak256(b);
        require(_owners[h] == address(0), "TAKEN");
        bytes32 old = _names[msg.sender];
        if (old != bytes32(0)) {
            delete _owners[old];
            delete _spellings[old];
            emit Released(old, msg.sender);
        }
        _owners[h] = msg.sender;
        _names[msg.sender] = h;
        _spellings[h] = name;
        emit Registered(h, name, msg.sender);
    }

    function release() external {
        bytes32 h = _names[msg.sender];
        require(h != bytes32(0), "NONE");
        delete _names[msg.sender];
        delete _owners[h];
        delete _spellings[h];
        emit Released(h, msg.sender);
    }

    function resolveAddress(string calldata name) external view returns (address) {
        return _owners[keccak256(bytes(name))];
    }

    function resolveUsername(address who) external view returns (string memory) {
        return _spellings[_names[who]];
    }
}
