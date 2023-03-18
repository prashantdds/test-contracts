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
    mapping(uint256 => mapping(uint256 => uint256)) public weights;

    // subnet id => total weight in UINT(1,2,3.. )
    mapping(uint256 => uint256) public totalWeights;

    // subnet id => commited revenue for particular subnet id
    mapping(uint256 => uint256) public commitAssigned;

    event WeightAdded(uint256 subnetID, uint256 clusterID, uint256 weight);
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

    function getWeightsFor(uint256 subnetId, uint256 clusterId)
        external
        view
        returns (uint256)
    {
        return weights[subnetId][clusterId];
    }

    // BalanceCalculator can only call this function to commit based on calculation
    function commitAssignedFor(uint256 subnetId, uint256 revenue)
        external 
        returns (bool)
    {
        require(
            msg.sender == address(SubscriptionBalanceCalculator),
            "Only callable by calculator"
        );
        commitAssigned[subnetId] = commitAssigned[subnetId].add(revenue);
        return true;
    }

    function setClusterWeight(
        uint256 subnetID,
        uint256 clusterID,
        uint256 weight
    )
    external
    hasPermission(subnetID)
    {
        uint256 oldWeight = weights[subnetID][clusterID];
        uint256 totalWeight = totalWeights[subnetID];
        
        if(totalWeight > 0)
            assignRevenues(subnetID);
    
        weights[subnetID][clusterID] = weight;
        totalWeights[subnetID] = totalWeights[subnetID].sub(oldWeight).add(weight);

        emit WeightAdded(subnetID, clusterID, weight);
    }


    function assignRevenues(uint256 subnetID)
    public {
        uint256 totalWeight = totalWeights[subnetID];
        uint256 totalClusters = Registration.getClusterCount(subnetID);
        uint256 subnetRevenue = commitAssigned[subnetID];

        if(subnetRevenue == 0)
            return;
        
        if(totalClusters == 0)
            return;

        for(uint256 i = 0; i < totalClusters; i++)
        {
            if(Registration.isClusterListed(subnetID, i))
            {
                address walletAddress = Registration.getClusterWalletAddress(subnetID, i);
                uint256 weight = weights[subnetID][i];
                uint256 rev = weight.mul(subnetRevenue).div(totalWeight);
                SubscriptionBalance.addRevBalance(walletAddress, rev);
            }
        }
        commitAssigned[subnetID] = 0;
    }

    modifier hasPermission(uint256 subnetID) {
        require(
            msg.sender == address(Registration) || Registration.hasPermissionToClusterList(subnetID, msg.sender),
            // "Registration: Only Registration contract or WHITELIST_ROLE or Local DAO can add/reset weights to whitelisted addresses"
            "No permission to change weights"
        );
        _;
    }
}
