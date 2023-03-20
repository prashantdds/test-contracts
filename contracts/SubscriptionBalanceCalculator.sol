// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "./interfaces/ISubnetDAODistributor.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./interfaces/IContractBasedDeployment.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IApplicationNFT.sol";

contract SubscriptionBalanceCalculator is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;


    IRegistration public RegistrationContract;
    ISubscription public SubscriptionContract;
    ISubscriptionBalance public SubscriptionBalance;
    ISubnetDAODistributor public SubnetDAODistributor;
    IContractBasedDeployment public AppDeployment;

    uint32 constant public PERCENT_COUNT = 6;
    uint32 constant public ADDR_ID_1 = 0;
    uint32 constant public ADDR_ID_R = 1;
    uint32 constant public ADDR_ID_S = 2;
    uint32 constant public ADDR_ID_T = 3;
    uint32 constant public ADDR_ID_U = 4;
    uint32 constant public ADDR_ID_V = 5;


    uint32 constant public DRF_ID_R1 = 0;
    uint32 constant public DRF_ID_R2 = 1;
    uint32 constant public DRF_ID_T1 = 2;
    uint32 constant public DRF_ID_T2 = 3;
    uint32 constant public DRF_ID_U = 4;
    uint32 constant public DRF_ID_V = 5;
    uint32 constant public DRF_ID_W = 6;


    uint256 public constant LICENSE_ADDR_ID = 0;
    uint256 public constant REFERRAL_ADDR_ID = 1;
    uint256 public constant SUPPORT_ADDR_ID = 2;
    uint256 public constant PLATFORM_ADDR_ID = 3;


    // struct Factor{
    //     uint256 factor1;
    //     uint256 factor2;
    //     uint256 referralExpiryTime;
    //     uint256 discount;
    //     bool active;
    // }

    // mapping(address => uint256) public cachedFactor;

    function initialize(
        IRegistration _RegistrationContract
    ) public initializer {
        __Ownable_init_unchained();
        RegistrationContract = _RegistrationContract;
    }

    modifier onlySubscriptionBalance() {
        require(
            address(SubscriptionBalance) == _msgSender(),
            "Only callable by SubBalance"
        );
        _;
    }

    function setSubscriptionContract(address _Subscription) external onlyOwner {
        SubscriptionContract = ISubscription(_Subscription);
    }

    function setSubscriptionBalanceContract(address _SubscriptionBalance)
        external
        onlyOwner
    {
        SubscriptionBalance = ISubscriptionBalance(_SubscriptionBalance);
    }

    function setSubnetDAODistributor(
        ISubnetDAODistributor _SubnetDAODistributor
    ) external onlyOwner {
        SubnetDAODistributor = _SubnetDAODistributor;
    }

    function setAppDeployment(
        IContractBasedDeployment _AppDeployment
    )
    external onlyOwner {
        AppDeployment = _AppDeployment;
    }

    function s_GlobalDAOAddress() public view returns (address) {
        return RegistrationContract.GLOBAL_DAO_ADDRESS();
    }


    function s_GlobalDAORate() public view returns (uint256) {
        return RegistrationContract.daoRate();
    }

    function dripRatePerSec(uint256 nftID)
        public
        view
        returns (uint256)
    {
        uint256[] memory subnetList = AppDeployment.getActiveSubnetsOfNFT(nftID);

        uint256 cost;
        for (uint256 i = 0; i < subnetList.length; i++)
        {
            uint32[] memory computeRequired = AppDeployment
            .getComputesOfSubnet(nftID, subnetList[i]);

            cost += getComputeCosts(subnetList[i], computeRequired, 1);
        }

        ISubscription.NFTAttribute memory nftAttrib = SubscriptionContract.getNFTSubscription(nftID);
        ISubscription.PlatformAddress memory platformAttrib
            = SubscriptionContract.getPlatformFactors(nftAttrib.factorAddressList[PLATFORM_ADDR_ID]);

        uint256 u_referralFactor = platformAttrib.referralPercentage;
        uint256[] memory t_supportFactor = SubscriptionContract.getSupportFactor(nftID);
        uint256 v_platformFactor = platformAttrib.platformPercentage;
        uint256 w_discountFactor = platformAttrib.discountPercentage;
        uint256[] memory r_licenseFactor = SubscriptionContract.getLicenseFactor(nftID);

        uint256 factor = s_GlobalDAORate()
            .add(t_supportFactor[0])
            .add(r_licenseFactor[0])
            .add(v_platformFactor)
            .add(u_referralFactor)
            .add(100000);

        if(nftAttrib.createTime.add(platformAttrib.referralExpiryDuration) > block.timestamp) {
            factor = factor.sub(w_discountFactor);
        }

        if(cost == 0)
            return 0;

        return factor.mul(cost).div(100000) + r_licenseFactor[1] + t_supportFactor[1];
    }

    function dripRatePerSecOfSubnet(uint256 nftID, uint256 subnetID)
        public
        view
        returns (uint256)
    {

        uint32[] memory computeRequired = AppDeployment
        .getComputesOfSubnet(nftID, subnetID);

        uint256 cost = getComputeCosts(subnetID, computeRequired, 1);

        if(cost == 0)
            return 0;

        ISubscription.NFTAttribute memory nftAttrib = SubscriptionContract.getNFTSubscription(nftID);
        ISubscription.PlatformAddress memory platformAttrib
            = SubscriptionContract.getPlatformFactors(nftAttrib.factorAddressList[PLATFORM_ADDR_ID]);

        uint256 u_referralFactor = platformAttrib.referralPercentage;
        uint256[] memory t_supportFactor = SubscriptionContract.getSupportFactor(nftID);
        uint256 v_platformFactor = platformAttrib.platformPercentage;
        uint256 w_discountFactor = platformAttrib.discountPercentage;
        uint256[] memory r_licenseFactor = SubscriptionContract.getLicenseFactor(nftID);

        uint256 factor = s_GlobalDAORate()
            .add(t_supportFactor[0])
            .add(r_licenseFactor[0])
            .add(v_platformFactor)
            .add(u_referralFactor)
            .add(100000);

        if(nftAttrib.createTime.add(platformAttrib.referralExpiryDuration) > block.timestamp) {
            factor = factor.sub(w_discountFactor);
        }

        return factor.mul(cost).div(100000) + r_licenseFactor[1] + t_supportFactor[1];
    }


    function estimateDripRatePerSec (
        uint256[] calldata subnetList,
        uint256[] calldata dripFactor,
        uint32[][] calldata computeRequired
    )
    public
    view
    returns (uint256)
    {
        uint256 factor = s_GlobalDAORate()
            + dripFactor[DRF_ID_R1]
            + dripFactor[DRF_ID_T1]
            + dripFactor[DRF_ID_U]
            + dripFactor[DRF_ID_V]
            - dripFactor[DRF_ID_W]
            + 100000;

        uint256 cost;
        for(uint256 i = 0; i < subnetList.length ; i++)
        {
            cost += getComputeCosts(subnetList[i], computeRequired[i], 1);
        }
    
        return factor.mul(cost).div(100000) + dripFactor[DRF_ID_R2] + dripFactor[DRF_ID_T2];
    }

    function getComputeCosts(
        uint256 subnetID,
        uint32[] memory computeRequired,
        uint256 duration
    )
    public
    view
    returns (uint256 computeCost)
    {
        uint256 computeCostPerSec = 0;
        
        uint256[] memory unitPrices = RegistrationContract
            .getUnitPrices(subnetID);

        uint256 minLen = Math.min(unitPrices.length, computeRequired.length);
        for (uint256 j = 0; j < minLen; j++)
        {
            computeCostPerSec = computeCostPerSec.add(
                uint256(computeRequired[j]).mul(unitPrices[j])
            );
        }

        computeCost = computeCostPerSec.mul(
            duration
        );
    }

    // function saveFactorInCache(
    //     uint256 nftID
    // )
    // external
    // {
    //     uint256 createTime = SubscriptionContract.getCreateTime(nftID);
    //     address platformAddress = SubscriptionContract.getNFTFactorAddress(nftID, PLATFORM_ADDR_ID);
    //     ISubscription.PlatformAddress memory platformAttrib
    //         = SubscriptionContract.getPlatformFactors(platformAddress);
    
    
    //     uint256[] memory supportFactor = SubscriptionContract.getSupportFactor(nftID);
    //     uint256[] memory licenseFactor = SubscriptionContract.getLicenseFactor(nftID);

    //     uint256 dripRate = supportFactor[0]
    //         .add(licenseFactor[0])
    //         .add(platformAttrib.platformPercentage)
    //         .add(platformAttrib.referralPercentage)
    //         .add(100000);
    // }

    function distributeRevenue(
        uint256 nftID,
        uint256 revenue,
        uint256 duration
    )
    public
    onlySubscriptionBalance
    returns (uint256)
    {
        uint cost;
        uint256 totalCost;

        ISubscription.NFTAttribute memory nftAttrib = SubscriptionContract.getNFTSubscription(nftID);
        ISubscription.PlatformAddress memory platformAttrib
            = SubscriptionContract.getPlatformFactors(nftAttrib.factorAddressList[PLATFORM_ADDR_ID]);
        uint256 daoRate = s_GlobalDAORate();
        address daoAddress = s_GlobalDAOAddress();

        uint256[] memory supportFactor = SubscriptionContract.getSupportFactor(nftID);
        uint256[] memory licenseFactor = SubscriptionContract.getLicenseFactor(nftID);

        cost = revenue.mul(daoRate).div(100000);
        totalCost = totalCost.add(cost);
        SubscriptionBalance.addRevBalance(daoAddress, cost);


        cost = revenue.mul(licenseFactor[0]).div(100000);
        cost = cost.add(licenseFactor[1].mul(duration));
        totalCost = totalCost.add(cost);
        SubscriptionBalance.addRevBalance(nftAttrib.factorAddressList[LICENSE_ADDR_ID], cost);


        cost = revenue.mul(supportFactor[0]).div(100000);
        cost = cost.add(supportFactor[1].mul(duration));
        totalCost = totalCost.add(cost);
        SubscriptionBalance.addRevBalance(nftAttrib.factorAddressList[SUPPORT_ADDR_ID], cost);

        cost = revenue.mul(platformAttrib.referralPercentage).div(100000);
        totalCost = totalCost.add(cost);

        if (nftAttrib.createTime.add(platformAttrib.referralExpiryDuration) > block.timestamp)
        {
            SubscriptionBalance.addRevBalance(nftAttrib.factorAddressList[REFERRAL_ADDR_ID],
            cost);

            cost = revenue.mul(platformAttrib.platformPercentage 
                - platformAttrib.discountPercentage).div(100000);
            totalCost = totalCost.add(cost);
            // dripRate = dripRate.add(sendCost);
            SubscriptionBalance.addRevBalance(nftAttrib.factorAddressList[PLATFORM_ADDR_ID], cost);
        }
        else 
        {
            SubscriptionBalance.addRevBalance(daoAddress, cost);
            cost = revenue.mul(platformAttrib.platformPercentage).div(100000);
            totalCost = totalCost.add(cost);
            // dripRate = dripRate.add(sendCost);
            SubscriptionBalance.addRevBalance(nftAttrib.factorAddressList[PLATFORM_ADDR_ID], cost);
        }


        return totalCost;
    }

    function getUpdatedSubnetBalance(
        uint256 nftID,
        uint256 lastUpdateTime,
        uint256 totalBalance,
        uint256[] memory subnetList
    )
    public
    onlySubscriptionBalance
    returns (uint256, uint256, uint256)
    {
        uint256 totalComputeCost;
        uint256[] memory computeCost = new uint256[](subnetList.length);

        for (uint256 i = 0; i < subnetList.length; i++)
        {
            uint32[] memory computeRequired = AppDeployment
            .getComputesOfSubnet(nftID, subnetList[i]);

            uint256 cost = getComputeCosts(subnetList[i], computeRequired, 1);
            computeCost[i] = cost;
            totalComputeCost += cost;
        }

        if(totalComputeCost == 0)
            return (0, 0, 0);

        uint256 createTime = SubscriptionContract.getCreateTime(nftID);
        address platformAddress = SubscriptionContract.getNFTFactorAddress(nftID, PLATFORM_ADDR_ID);
        ISubscription.PlatformAddress memory platformAttrib
            = SubscriptionContract.getPlatformFactors(platformAddress);
    
    
        uint256[] memory supportFactor = SubscriptionContract.getSupportFactor(nftID);
        uint256[] memory licenseFactor = SubscriptionContract.getLicenseFactor(nftID);


        if(createTime == 0)
            return (0, 0, 0);


        uint256 dripRate = s_GlobalDAORate()
            .add(supportFactor[0])
            .add(licenseFactor[0])
            .add(platformAttrib.platformPercentage)
            .add(platformAttrib.referralPercentage)
            .add(100000);

        
        if(createTime.add(platformAttrib.referralExpiryDuration) > block.timestamp)
        {
            dripRate = dripRate.sub(platformAttrib.discountPercentage);
        }


        dripRate = dripRate.mul(totalComputeCost).div(100000);
        dripRate = dripRate.add(supportFactor[1]).add(licenseFactor[1]);


        createTime = totalBalance.div(dripRate);
        if((lastUpdateTime + createTime) > block.timestamp) {
            createTime = block.timestamp - lastUpdateTime;
        }

        if(createTime == 0)
            return (0, 0, 0);

        for(uint i = 0; i < subnetList.length; i++)
        {
            uint256 curCost = computeCost[i].mul(createTime);

            SubnetDAODistributor.commitAssignedFor(
                subnetList[i],
                curCost
            );
        }

        totalComputeCost = totalComputeCost.mul(createTime);
        dripRate = dripRate.mul(createTime);

        // SubscriptionBalance.addRevBalance(address(SubnetDAODistributor), totalComputeCost);

        return (dripRate, totalComputeCost, createTime);
    }

    function getUpdatedBalanceImmediate(
        uint256 nftID,
        uint256 lastUpdateTime,
        uint256 totalBalance
    )
    external
    onlySubscriptionBalance
    returns (uint256, uint256, uint256)
    {
        uint256[] memory subnetList = AppDeployment.getActiveSubnetsOfNFT(nftID);

        (uint256 totalCostIncurred, uint256 remCost, uint256 balanceDuration) = getUpdatedSubnetBalance(
                nftID,
                lastUpdateTime,
                totalBalance,
                subnetList
        );

        return (totalCostIncurred, remCost, balanceDuration);
    }

    function getUpdatedBalance(
        uint256 nftID,
        uint256 lastUpdateTime,
        uint256 totalBalance,
        uint256 accumComputeCost,
        uint256 accumDuration
    )
    external
    onlySubscriptionBalance
    returns (uint256) 
    {
        uint256[] memory subnetList = AppDeployment.getActiveSubnetsOfNFT(nftID);

        (uint256 totalCostIncurred, uint256 remCost, uint256 balanceDuration) = getUpdatedSubnetBalance(
                nftID,
                lastUpdateTime,
                totalBalance,
                subnetList
        );

        accumComputeCost += remCost;
        accumDuration += balanceDuration;
        
        distributeRevenue(
            nftID,
            accumComputeCost,
            accumDuration
        );

        return totalCostIncurred;
    }
}

