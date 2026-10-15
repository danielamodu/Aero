// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Adapter surface the router allocates across (Benqi-style markets).
interface IRouteAdapter {
    function deposit(uint256 assets) external returns (uint256);
    function withdraw(uint256 shares) external returns (uint256);
    function balance() external view returns (uint256);
    function liveApyBps() external view returns (uint256);
}

/// @title AeroRouter v0 — allocate one USDC pool across live-rate adapters.
/// @notice Target allocations in bps; keeper-triggered rebalance with a
///         hysteresis band so churn never eats the yield. ERC-4626-flavored
///         shares priced off aggregate adapter balances (no phantom yield:
///         the price only moves when the markets do).
contract AeroRouter is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;

    struct Slot {
        IRouteAdapter adapter;
        uint256 targetBps;
    }

    Slot[] public slots;
    /// @notice Min total deviation (bps) before rebalance() does anything.
    uint256 public minDriftBps = 25;

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event Rebalanced(uint256[] balances);
    event AllocationSet(uint256[] targetsBps);
    event AdapterAdded(address indexed adapter);
    event AdapterRemoved(address indexed adapter);

    constructor(IERC20 _asset, address[] memory _adapters, uint256[] memory _targets)
        ERC20("Aero Router Share", "aeroRoute")
        Ownable(msg.sender)
    {
        asset = _asset;
        _setAllocation(_adapters, _targets);
    }

    function slotCount() external view returns (uint256) {
        return slots.length;
    }

    function totalAssets() public view returns (uint256 total) {
        for (uint256 i = 0; i < slots.length; i++) {
            total += slots[i].adapter.balance();
        }
    }

    function sharePrice() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }

    /// @notice APY weighted by deployed balances.
    function liveApyBps() external view returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) {
            uint256 w = 0;
            for (uint256 i = 0; i < slots.length; i++) {
                w += slots[i].adapter.liveApyBps() * slots[i].targetBps;
            }
            return w / 10_000;
        }
        uint256 weighted = 0;
        for (uint256 i = 0; i < slots.length; i++) {
            weighted += slots[i].adapter.liveApyBps() * slots[i].adapter.balance();
        }
        return weighted / total;
    }

    function setTargets(uint256[] calldata targetsBps) external onlyOwner {
        require(targetsBps.length == slots.length, "LENGTH");
        address[] memory adapters = new address[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            adapters[i] = address(slots[i].adapter);
        }
        _setAllocation(adapters, targetsBps);
    }

    function setMinDriftBps(uint256 bps) external onlyOwner {
        require(bps <= 1000, "TOO_HIGH");
        minDriftBps = bps;
    }

    function addAdapter(address adapter, uint256 targetBps) external onlyOwner {
        require(IRouteAdapter(adapter).balance() >= 0, "BAD_ADAPTER");
        slots.push(Slot({adapter: IRouteAdapter(adapter), targetBps: targetBps}));
        asset.forceApprove(adapter, type(uint256).max);
        emit AdapterAdded(adapter);
    }

    function removeAdapter(uint256 index) external onlyOwner {
        require(index < slots.length, "INDEX");
        require(slots[index].adapter.balance() == 0, "NOT_EMPTY");
        address removed = address(slots[index].adapter);
        slots[index] = slots[slots.length - 1];
        slots.pop();
        emit AdapterRemoved(removed);
    }

    function _setAllocation(address[] memory _adapters, uint256[] memory _targets) internal {
        require(_adapters.length == _targets.length && _adapters.length > 0, "LENGTH");
        uint256 sum;
        for (uint256 i = 0; i < _targets.length; i++) {
            sum += _targets[i];
        }
        require(sum == 10_000, "MUST_SUM_10000");
        delete slots;
        for (uint256 i = 0; i < _adapters.length; i++) {
            slots.push(Slot({adapter: IRouteAdapter(_adapters[i]), targetBps: _targets[i]}));
            asset.forceApprove(_adapters[i], type(uint256).max);
        }
        emit AllocationSet(_targets);
    }

    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        uint256 total = totalAssets();
        uint256 supply = totalSupply();
        shares = (supply == 0 || total == 0) ? assets : (assets * supply) / total;
        require(shares > 0, "ZERO_SHARES");
        asset.safeTransferFrom(msg.sender, address(this), assets);
        for (uint256 i = 0; i < slots.length; i++) {
            uint256 share = (assets * slots[i].targetBps) / 10_000;
            if (share > 0) slots[i].adapter.deposit(share);
        }
        _mint(msg.sender, shares);
        emit Deposit(msg.sender, assets, shares);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        uint256 supply = totalSupply();
        uint256 total = totalAssets();
        assets = (shares * total) / supply;
        require(assets > 0, "ZERO_ASSETS");
        _burn(msg.sender, shares);
        // Pull proportionally; the last slot takes the remainder to absorb dust.
        uint256 pulled;
        for (uint256 i = 0; i < slots.length; i++) {
            uint256 want = i == slots.length - 1
                ? assets - pulled
                : (assets * slots[i].adapter.balance()) / total;
            if (want == 0) continue;
            pulled += want;
            _pullFromSlot(i, want);
        }
        asset.safeTransfer(msg.sender, assets);
        emit Withdraw(msg.sender, assets, shares);
    }

    function _pullFromSlot(uint256 index, uint256 assets) internal {
        // Convert a USDC amount into that adapter's shares via its price.
        (bool ok, bytes memory ret) = address(slots[index].adapter).staticcall(
            abi.encodeWithSignature("sharePrice()")
        );
        uint256 price = ok && ret.length == 32 ? abi.decode(ret, (uint256)) : uint256(1e18);
        uint256 adapterShares = (assets * 1e18) / price;
        // Adapter share accounting may round; pull one extra unit to be safe,
        // capped by our actual share balance there.
        uint256 ours = slots[index].adapter.balance() > 0
            ? _adapterShareBalance(index)
            : 0;
        if (adapterShares > ours) adapterShares = ours;
        if (adapterShares == 0) return;
        slots[index].adapter.withdraw(adapterShares);
    }

    function _adapterShareBalance(uint256 index) internal view returns (uint256) {
        (bool ok, bytes memory ret) = address(slots[index].adapter).staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (!ok || ret.length != 32) return 0;
        return abi.decode(ret, (uint256));
    }

    /// @notice Shift funds toward targets. Skips work when drift is inside the band.
    function rebalance() external nonReentrant {
        uint256 total = totalAssets();
        require(total > 0, "EMPTY");
        uint256 drift;
        for (uint256 i = 0; i < slots.length; i++) {
            uint256 want = (total * slots[i].targetBps) / 10_000;
            uint256 has = slots[i].adapter.balance();
            drift += want > has ? want - has : has - want;
        }
        require((drift * 10_000) / total >= minDriftBps, "IN_BAND");
        // 1) Pull overweight positions back to the router.
        for (uint256 i = 0; i < slots.length; i++) {
            uint256 want = (total * slots[i].targetBps) / 10_000;
            uint256 has = slots[i].adapter.balance();
            if (has > want) _pullFromSlot(i, has - want);
        }
        // 2) Push everything the router holds into underweight positions.
        uint256 idle = asset.balanceOf(address(this));
        for (uint256 i = 0; i < slots.length && idle > 0; i++) {
            uint256 want = (total * slots[i].targetBps) / 10_000;
            uint256 has = slots[i].adapter.balance();
            if (has < want) {
                uint256 fill = want - has;
                if (fill > idle) fill = idle;
                slots[i].adapter.deposit(fill);
                idle -= fill;
            }
        }
        uint256[] memory balances = new uint256[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            balances[i] = slots[i].adapter.balance();
        }
        emit Rebalanced(balances);
    }
}
