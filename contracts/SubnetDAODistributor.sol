// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IBalanceCalculator.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "./interfaces/IRegistration.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./TokensRecoverable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

// 1 part of (1+r+s+t+u) Revenue is collected in contract and
// assigned to revenue addresses
// Assigned revenues can be claimed anytime

contract SubnetDAODistributor is PausableUpgradeable, TokensRecoverable {
    using SafeMathUpgradeable for uint256;

    IBalanceCalculator public SubscriptionBalanceCalculator;
    ISubscriptionBalance public SubscriptionBalance;
    IERC20Upgradeable public XCTToken;
    IRegistration public Registration;

    // subnet id => revenue address => weight in UINT(1,2,3.. )
    mapping(uint256 => mapping(address => uint256)) public weights;

    // subnet id => total weight in UINT(1,2,3.. )
    mapping(uint256 => uint256) public totalWeights;

    // subnet id => total revenue for distribution, not yet assigned to any reveue address
    mapping(uint256 => uint256) public revenueCollectedToDistribute;

    // revenue address => revenue available for claim
    mapping(address => uint256) public balanceOfAssignedRevenue;

    // subnet id => commited revenue for particular subnet id
    mapping(uint256 => uint256) public commitAssigned;

    // subnet id => revenueAddresses
    mapping(uint256 => address[]) public revenueAddresses;

    event WeightAdded(uint256 subnetId, address revenueAddress, uint256 weight);
    event RevenueCollected(uint256 subnetId);
    event RevenuesAssignedToAll();
    event RevenueClaimedFor(address revenueAddress, uint256 revenueAmt);
    event WeightReset(uint256 subnetId);

    function initialize(
        IERC20Upgradeable _XCTToken,
        ISubscriptionBalance _SubscriptionBalance,
        IBalanceCalculator _SubscriptionBalanceCalculator,
        IRegistration _Registration
    ) public initializer {
        XCTToken = _XCTToken;
        Registration = _Registration;
        SubscriptionBalanceCalculator = _SubscriptionBalanceCalculator;
        SubscriptionBalance = _SubscriptionBalance;
    }

    function getWeightsFor(uint256 subnetId, address revenueAddress)
        external
        view
        returns (uint256)
    {
        return weights[subnetId][revenueAddress];
    }

    // BalanceCalculator can only call this function to commit based on calculation
    function commitAssignedFor(uint256 subnetId, uint256 revenue)
        external 
        returns (bool)
    {
        require(
            msg.sender == address(SubscriptionBalanceCalculator),
            "SubscriptionBalanceCalculator can only call this function to commit revenue for subnet id"
        );
        commitAssigned[subnetId] = commitAssigned[subnetId].add(revenue);
        return true;
    }

    function addWeight(
        uint256 subnetId,
        address _revenueAddress,
        uint256 _weight
    ) external hasPermission(subnetId) {
        // collect revenue every time new weight is added
        if(revenueAddresses[subnetId].length>0)
            collectAndAssignRevenues(subnetId);

        // maintain revenueAddresses and totalWeights
        if(weights[subnetId][_revenueAddress]==0){
            revenueAddresses[subnetId].push(_revenueAddress);
            totalWeights[subnetId] = totalWeights[subnetId].add(_weight);
        }
        // when weights are updated, add new weight and remove old weight from totalWeight
        else
            totalWeights[subnetId] = totalWeights[subnetId].add(_weight).sub(weights[subnetId][_revenueAddress]);

        // new weight assigned
        weights[subnetId][_revenueAddress] = _weight;
        emit WeightAdded(subnetId, _revenueAddress, _weight);
    }

    function resetWeights(uint256 subnetId) external hasPermission(subnetId) {
        address[] memory empArr;
        for (uint256 i = 0; i < revenueAddresses[subnetId].length; i++)
            weights[subnetId][revenueAddresses[subnetId][i]] = 0;
        revenueAddresses[subnetId] = empArr;
        totalWeights[subnetId] = 0;
        emit WeightReset(subnetId);
    }

    function collectRevenueToDistribute(uint256 subnetId) public {
        SubscriptionBalance.receiveRevenueForAddress(address(this));
        uint256 currBalance = XCTToken.balanceOf(address(this));
        // assign received revenue to subnet id as per the commit
        require(
            commitAssigned[subnetId] <= currBalance,
            "Commited is more than collected revenue within contract"
        );
        revenueCollectedToDistribute[subnetId] = revenueCollectedToDistribute[
            subnetId
        ].add(commitAssigned[subnetId]);
        // reset commit
        commitAssigned[subnetId] = 0;
        emit RevenueCollected(subnetId);
    }

    function assignRevenues(uint256 subnetId) public {
        for (uint256 i = 0; i < revenueAddresses[subnetId].length; i++) {
            address revAddress = revenueAddresses[subnetId][i];
            uint256 weight = weights[subnetId][revAddress];
            uint256 totalWeight = totalWeights[subnetId];
            uint256 revenueShare = weight
                .mul(revenueCollectedToDistribute[subnetId])
                .div(totalWeight);
            balanceOfAssignedRevenue[revAddress] = balanceOfAssignedRevenue[
                revAddress
            ].add(revenueShare);
        }
        // reset as collected revenue is assigned to addresses based on weights
        revenueCollectedToDistribute[subnetId] = 0;
        emit RevenuesAssignedToAll();
    }

    function collectAndAssignRevenues(uint256 subnetId) public {
        collectRevenueToDistribute(subnetId);
        assignRevenues(subnetId);
    }

    function claimAllRevenueFor(address revAddress) public {
        XCTToken.transfer(revAddress, balanceOfAssignedRevenue[revAddress]);
        emit RevenueClaimedFor(
            revAddress,
            balanceOfAssignedRevenue[revAddress]
        );
        balanceOfAssignedRevenue[revAddress] = 0;
    }

    function claimAllRevenue() public {
        claimAllRevenueFor(msg.sender);
    }

    modifier hasPermission(uint256 subnetId) {
        require(
            msg.sender == address(Registration) || Registration.hasPermissionToClusterList(subnetId, msg.sender),
            "Registration: Only Registration contract or WHITELIST_ROLE or Local DAO can add/reset weights to whitelisted addresses"
        );
        _;
    }
}
