// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IYieldAdapter} from "./interfaces/IYieldAdapter.sol";

/// @title AeroRouter — share-accounted USDC portfolio over exclusive adapters.
/// @notice Adapter positions are valued only through shares held by this router.
///         Router idle USDC and direct donations are included in totalAssets.
///         Donations made while shares exist accrue to those shareholders. A
///         first deposit is blocked while unowned assets exist; the owner may
///         recover those assets only while there are no router shares/positions.
contract AeroRouter is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_ADAPTERS = 16;
    /// @notice One virtual underlying base unit prevents a zero-asset divisor.
    uint256 public constant VIRTUAL_ASSETS = 1;
    /// @notice Version required by the client before it enables router actions.
    uint256 public constant deploymentVersion = 2_111;

    IERC20 public immutable asset;
    /// @notice Virtual shares normalize underlying units to the router's 18 decimals.
    uint256 public immutable virtualShares;

    struct Slot {
        IYieldAdapter adapter;
        uint256 targetBps;
    }

    Slot[] public slots;
    /// @notice Minimum total allocation drift in basis points before rebalance.
    uint256 public minDriftBps = 25;

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event Rebalanced(uint256[] balances);
    event AllocationSet(uint256[] targetsBps);
    event AdapterAdded(address indexed adapter);
    event AdapterRemoved(address indexed adapter);
    event OrphanedAssetsRecovered(address indexed receiver, uint256 assets);

    constructor(IERC20 _asset, address[] memory _adapters, uint256[] memory _targets)
        ERC20("Aero Router Share", "aeroRoute")
        Ownable(msg.sender)
    {
        require(address(_asset) != address(0), "ZERO_ASSET");
        require(address(_asset).code.length > 0, "ASSET_NOT_CONTRACT");
        asset = _asset;
        uint8 assetDecimals = IERC20Metadata(address(_asset)).decimals();
        require(assetDecimals <= 18, "ASSET_DECIMALS_TOO_HIGH");
        virtualShares = 10 ** (18 - uint256(assetDecimals));
        _validateTargets(_targets, _adapters.length);
        require(_adapters.length > 0, "NO_ADAPTERS");
        require(_adapters.length <= MAX_ADAPTERS, "TOO_MANY_ADAPTERS");

        for (uint256 i = 0; i < _adapters.length; i++) {
            require(_adapters[i] != address(0), "ZERO_ADAPTER");
            require(_adapters[i].code.length > 0, "ADAPTER_NOT_CONTRACT");
            for (uint256 j = 0; j < i; j++) {
                require(_adapters[j] != _adapters[i], "DUPLICATE_ADAPTER");
            }
        }
        for (uint256 i = 0; i < _adapters.length; i++) {
            _validateAdapter(_adapters[i], true);
            slots.push(Slot({adapter: IYieldAdapter(_adapters[i]), targetBps: _targets[i]}));
        }
        emit AllocationSet(_targets);
    }

    function slotCount() external view returns (uint256) {
        return slots.length;
    }

    /// @notice Assets in one slot attributable only to router-owned shares.
    function slotAssets(uint256 index) public view returns (uint256) {
        Slot storage slot = slots[index];
        return slot.adapter.convertToAssets(slot.adapter.sharesOf(address(this)));
    }

    function totalAssets() public view returns (uint256 total) {
        total = asset.balanceOf(address(this));
        for (uint256 i = 0; i < slots.length; i++) {
            total += slotAssets(i);
        }
    }

    /// @notice Convert raw 18-decimal router shares to raw underlying units.
    /// @dev Rounds down. Virtual assets/shares are the ERC-4626 inflation defense.
    function convertToAssets(uint256 shares) public view returns (uint256 assets) {
        return Math.mulDiv(shares, totalAssets() + VIRTUAL_ASSETS, totalSupply() + virtualShares);
    }

    /// @notice Convert raw underlying units to raw 18-decimal router shares.
    /// @dev Rounds down; deposits can supply `minShares` to bound execution slippage.
    function convertToShares(uint256 assets) public view returns (uint256 shares) {
        uint256 total = totalAssets();
        uint256 supply = totalSupply();
        _requireDepositState(total, supply);
        return Math.mulDiv(assets, supply + virtualShares, total + VIRTUAL_ASSETS);
    }

    /// @notice Raw underlying base units represented by one whole router share.
    function sharePrice() public view returns (uint256) {
        return convertToAssets(1e18);
    }

    function previewDeposit(uint256 assets) public view returns (uint256 shares) {
        return convertToShares(assets);
    }

    function previewWithdraw(uint256 shares) public view returns (uint256 assets) {
        return convertToAssets(shares);
    }

    /// @notice Verify the complete adapter set is bound and matches this router.
    /// @dev Used by clients as a configuration gate after post-deployment binding.
    function configurationValid() external view returns (bool) {
        if (address(asset).code.length == 0 || slots.length == 0) return false;
        uint256 targetSum;
        for (uint256 i = 0; i < slots.length; i++) {
            IYieldAdapter candidate = slots[i].adapter;
            targetSum += slots[i].targetBps;
            try candidate.asset() returns (IERC20 adapterAsset) {
                if (address(adapterAsset) != address(asset)) return false;
            } catch { return false; }
            try candidate.router() returns (address assignedRouter) {
                if (assignedRouter != address(this)) return false;
            } catch { return false; }
            try candidate.convertToAssets(candidate.sharesOf(address(this))) returns (uint256) { }
            catch { return false; }
            try candidate.convertToShares(0) returns (uint256) { }
            catch { return false; }
            try candidate.liveApyBps() returns (uint256) { }
            catch { return false; }
            try candidate.marketId() returns (string memory) { }
            catch { return false; }
        }
        return targetSum == BPS_DENOMINATOR;
    }

    /// @notice APY-style annualized rate weighted by router-owned market assets.
    ///         Idle USDC contributes zero. This does not alter allocation targets.
    function liveApyBps() external view returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) {
            uint256 targetWeighted;
            for (uint256 i = 0; i < slots.length; i++) {
                targetWeighted += slots[i].adapter.liveApyBps() * slots[i].targetBps;
            }
            return targetWeighted / BPS_DENOMINATOR;
        }

        uint256 weighted;
        for (uint256 i = 0; i < slots.length; i++) {
            weighted += slots[i].adapter.liveApyBps() * slotAssets(i);
        }
        return weighted / total;
    }

    function setTargets(uint256[] calldata targetsBps) external onlyOwner {
        require(targetsBps.length == slots.length, "LENGTH");
        _validateTargets(targetsBps, slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            slots[i].targetBps = targetsBps[i];
        }
        emit AllocationSet(targetsBps);
    }

    function setMinDriftBps(uint256 bps) external onlyOwner {
        require(bps <= 1000, "TOO_HIGH");
        minDriftBps = bps;
    }

    /// @notice Register an adapter at zero weight. Update all targets with
    ///         setTargets in a separate call to allocate weight to it.
    function addAdapter(address adapter) external onlyOwner {
        require(slots.length < MAX_ADAPTERS, "TOO_MANY_ADAPTERS");
        for (uint256 i = 0; i < slots.length; i++) {
            require(address(slots[i].adapter) != adapter, "DUPLICATE_ADAPTER");
        }
        _validateAdapter(adapter, false);
        slots.push(Slot({adapter: IYieldAdapter(adapter), targetBps: 0}));
        _assertAllocationInvariant();
        emit AdapterAdded(adapter);
        emit AllocationSet(_currentTargets());
    }

    /// @notice An adapter can be removed only after its target is zero and the
    ///         router holds no adapter shares there.
    function removeAdapter(uint256 index) external onlyOwner {
        require(index < slots.length, "INDEX");
        require(slots.length > 1, "LAST_ADAPTER");
        require(slots[index].targetBps == 0, "TARGET_NOT_ZERO");
        require(slots[index].adapter.sharesOf(address(this)) == 0, "POSITION_NOT_EMPTY");

        address removed = address(slots[index].adapter);
        slots[index] = slots[slots.length - 1];
        slots.pop();
        _assertAllocationInvariant();
        emit AdapterRemoved(removed);
        emit AllocationSet(_currentTargets());
    }

    /// @notice Recover direct donations made before any router shares exist.
    ///         Donations with shareholders are included in their share value.
    function recoverOrphanedAssets(address receiver) external onlyOwner nonReentrant {
        require(receiver != address(0), "ZERO_RECEIVER");
        require(totalSupply() == 0, "SHARES_EXIST");
        for (uint256 i = 0; i < slots.length; i++) {
            require(slots[i].adapter.sharesOf(address(this)) == 0, "POSITIONS_EXIST");
        }
        uint256 amount = asset.balanceOf(address(this));
        require(amount > 0, "NO_ORPHANED_ASSETS");
        asset.safeTransfer(receiver, amount);
        emit OrphanedAssetsRecovered(receiver, amount);
    }

    function deposit(uint256 assets, uint256 minShares) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        uint256 total = totalAssets();
        uint256 supply = totalSupply();
        _requireDepositState(total, supply);
        shares = Math.mulDiv(assets, supply + virtualShares, total + VIRTUAL_ASSETS);
        require(shares > 0, "ZERO_SHARES");
        require(shares >= minShares, "SLIPPAGE");

        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), assets);
        require(asset.balanceOf(address(this)) - beforeBalance == assets, "ASSET_TRANSFER_SHORTFALL");

        for (uint256 i = 0; i < slots.length; i++) {
            uint256 allocation = Math.mulDiv(assets, slots[i].targetBps, BPS_DENOMINATOR);
            if (allocation > 0) _depositIntoSlot(i, allocation);
        }

        _mint(msg.sender, shares);
        _assertAllocationInvariant();
        emit Deposit(msg.sender, assets, shares);
    }

    /// @notice All-or-nothing pro-rata withdrawal. Idle USDC is consumed first.
    ///         If any required adapter redemption fails or returns less than
    ///         requested, the whole transaction reverts and shares remain intact.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        uint256 supply = totalSupply();
        require(shares > 0 && shares <= balanceOf(msg.sender), "INVALID_SHARES");
        require(supply > 0, "NO_SHARES");

        uint256 total = totalAssets();
        require(total > 0, "NO_ASSETS");
        assets = convertToAssets(shares);
        require(assets > 0, "ZERO_ASSETS");

        uint256 idle = asset.balanceOf(address(this));
        uint256 neededFromAdapters = assets > idle ? assets - idle : 0;
        if (neededFromAdapters > 0) {
            uint256 invested = total - idle;
            require(invested > 0, "INSUFFICIENT_LIQUIDITY");
            _redeemProRata(neededFromAdapters, invested, shares == supply);
        }

        require(asset.balanceOf(address(this)) >= assets, "INSUFFICIENT_LIQUIDITY");
        _burn(msg.sender, shares);
        uint256 receiverBefore = asset.balanceOf(msg.sender);
        asset.safeTransfer(msg.sender, assets);
        require(asset.balanceOf(msg.sender) - receiverBefore == assets, "ASSET_TRANSFER_SHORTFALL");
        _assertAllocationInvariant();
        emit Withdraw(msg.sender, assets, shares);
    }

    function _redeemProRata(uint256 needed, uint256 invested, bool redeemAll) internal {
        uint256 requested;
        uint256 lastInvestedSlot = type(uint256).max;
        for (uint256 i = 0; i < slots.length; i++) {
            if (slotAssets(i) > 0) lastInvestedSlot = i;
        }

        for (uint256 i = 0; i < slots.length; i++) {
            uint256 value = slotAssets(i);
            if (value == 0) continue;
            uint256 want = i == lastInvestedSlot
                ? needed - requested
                : Math.mulDiv(needed, value, invested);
            if (want == 0) continue;
            requested += want;
            _redeemFromSlot(i, want, value, redeemAll);
        }
    }

    function _redeemFromSlot(uint256 index, uint256 assets, uint256 slotValue, bool redeemAll) internal {
        IYieldAdapter adapter = slots[index].adapter;
        uint256 ownedShares = adapter.sharesOf(address(this));
        uint256 shares = redeemAll || assets >= slotValue
            ? ownedShares
            : adapter.convertToShares(assets);
        if (shares > ownedShares) shares = ownedShares;
        require(shares > 0, "ZERO_ADAPTER_SHARES");

        uint256 beforeBalance = asset.balanceOf(address(this));
        try adapter.withdraw(shares) returns (uint256) {
            // Trust the measured token delta, not the adapter's return value.
        } catch {
            revert("ADAPTER_WITHDRAW_FAILED");
        }
        uint256 received = asset.balanceOf(address(this)) - beforeBalance;
        require(received >= assets, "ADAPTER_SHORTFALL");
    }

    function _depositIntoSlot(uint256 index, uint256 assets) internal {
        IYieldAdapter adapter = slots[index].adapter;
        uint256 beforeBalance = asset.balanceOf(address(this));
        uint256 beforeShares = adapter.sharesOf(address(this));
        uint256 beforeValue = adapter.convertToAssets(beforeShares);
        asset.forceApprove(address(adapter), assets);
        uint256 reportedShares = adapter.deposit(assets);
        asset.forceApprove(address(adapter), 0);
        require(beforeBalance - asset.balanceOf(address(this)) == assets, "ADAPTER_DEPOSIT_MISMATCH");
        uint256 afterShares = adapter.sharesOf(address(this));
        require(afterShares > beforeShares, "ZERO_ADAPTER_SHARES");
        uint256 mintedShares = afterShares - beforeShares;
        require(mintedShares == reportedShares, "ADAPTER_SHARE_MISMATCH");

        uint256 afterValue = adapter.convertToAssets(afterShares);
        uint256 roundingBound = adapter.convertToAssets(1);
        if (roundingBound == 0) roundingBound = 1;
        uint256 minimumIncrease = assets > roundingBound ? assets - roundingBound : 0;
        require(afterValue >= beforeValue + minimumIncrease, "ADAPTER_VALUE_SHORTFALL");
    }

    function _requireDepositState(uint256 total, uint256 supply) internal pure {
        if (supply == 0) require(total == 0, "ORPHANED_ASSETS");
        else require(total > 0, "TOTAL_LOSS");
    }

    /// @notice Shift router-owned funds toward target weights. This is static
    ///         target rebalancing; it does not optimize for the highest rate.
    function rebalance() external nonReentrant {
        uint256 total = totalAssets();
        require(total > 0, "EMPTY");
        uint256 drift;
        for (uint256 i = 0; i < slots.length; i++) {
            uint256 want = Math.mulDiv(total, slots[i].targetBps, BPS_DENOMINATOR);
            uint256 has = slotAssets(i);
            drift += want > has ? want - has : has - want;
        }
        require(Math.mulDiv(drift, BPS_DENOMINATOR, total) >= minDriftBps, "IN_BAND");

        for (uint256 i = 0; i < slots.length; i++) {
            uint256 want = Math.mulDiv(total, slots[i].targetBps, BPS_DENOMINATOR);
            uint256 has = slotAssets(i);
            if (has > want) _redeemFromSlot(i, has - want, has, false);
        }

        uint256 idle = asset.balanceOf(address(this));
        for (uint256 i = 0; i < slots.length && idle > 0; i++) {
            uint256 want = Math.mulDiv(total, slots[i].targetBps, BPS_DENOMINATOR);
            uint256 has = slotAssets(i);
            if (has < want) {
                uint256 fill = want - has;
                if (fill > idle) fill = idle;
                _depositIntoSlot(i, fill);
                idle -= fill;
            }
        }

        uint256[] memory balances = new uint256[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) balances[i] = slotAssets(i);
        _assertAllocationInvariant();
        emit Rebalanced(balances);
    }

    function _validateAdapter(address adapter, bool allowUnbound) internal view {
        require(adapter != address(0), "ZERO_ADAPTER");
        require(adapter.code.length > 0, "ADAPTER_NOT_CONTRACT");
        IYieldAdapter candidate = IYieldAdapter(adapter);
        require(address(candidate.asset()) == address(asset), "ASSET_MISMATCH");
        address assignedRouter = candidate.router();
        require(
            assignedRouter == address(this) || (allowUnbound && assignedRouter == address(0)),
            "ROUTER_MISMATCH"
        );
        // These required interface calls also reject adapters missing an
        // explicit share conversion surface. No 1:1 fallback is used.
        candidate.convertToAssets(0);
        candidate.convertToShares(0);
        candidate.sharesOf(address(this));
        candidate.liveApyBps();
        candidate.marketId();
    }

    function _validateTargets(uint256[] memory targetsBps, uint256 expectedLength) internal pure {
        require(targetsBps.length == expectedLength, "LENGTH");
        uint256 sum;
        for (uint256 i = 0; i < targetsBps.length; i++) sum += targetsBps[i];
        require(sum == BPS_DENOMINATOR, "MUST_SUM_10000");
    }

    function _assertAllocationInvariant() internal view {
        uint256 sum;
        for (uint256 i = 0; i < slots.length; i++) sum += slots[i].targetBps;
        require(sum == BPS_DENOMINATOR, "ALLOCATION_INVARIANT");
    }

    function _currentTargets() internal view returns (uint256[] memory targets) {
        targets = new uint256[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) targets[i] = slots[i].targetBps;
    }
}
