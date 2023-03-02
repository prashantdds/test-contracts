// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "./interfaces/ISubnetDAODistributor.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IApplicationNFT.sol";
import "hardhat/console.sol";

contract SubscriptionBalanceCalculator is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    IRegistration public RegistrationContract;
    IApplicationNFT public ApplicationNFT;
    ISubscription public SubscriptionContract;
    ISubscriptionBalance public SubscriptionBalance;
    IERC20Upgradeable public XCTToken;
    ISubnetDAODistributor public SubnetDAODistributor;

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


    mapping(address => uint256) public balanceOfRev;

    event ReceivedRevenue(address benficiary, uint256 bal);

    function initialize(
        IRegistration _RegistrationContract,
        IApplicationNFT _ApplicationNFT,
        IERC20Upgradeable _XCTToken
    ) public initializer {
        __Ownable_init_unchained();
        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
 
    }

    modifier onlySubscriptionBalance() {
        require(
            address(SubscriptionBalance) == _msgSender(),
            "Only SubscriptionBalance can call this function"
        );
        _;
    }

    function setSubscriptionContract(address _Subscription) external onlyOwner {
        require(address(SubscriptionContract) == address(0), "Already set");
        SubscriptionContract = ISubscription(_Subscription);
    }

    function setSubscriptionBalanceContract(address _SubscriptionBalance)
        external
        onlyOwner
    {
        require(address(SubscriptionBalance) == address(0), "Already set");
        SubscriptionBalance = ISubscriptionBalance(_SubscriptionBalance);
    }

    function setSubnetDAODistributor(
        ISubnetDAODistributor _SubnetDAODistributor
    ) external onlyOwner {
        require(address(SubnetDAODistributor) == address(0), "Already set");
        SubnetDAODistributor = _SubnetDAODistributor;
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
        uint256[] memory subnetList = SubscriptionContract.getSubnetsOfNFT(nftID);
        bool[] memory activeSubnetList = SubscriptionContract.getActiveSubnetsOfNFT(nftID);

        uint256 cost;
        for (uint256 i = 0; i < subnetList.length; i++)
        {
            if(!activeSubnetList[i])
                continue;

            uint256[] memory computeRequired = SubscriptionContract
            .getComputesOfSubnet(nftID, subnetList[i]);

            cost += getComputeCosts(subnetList[i], computeRequired, 1);

            // console.log("cehcking subnet:", subnetList[i], cost );
        }

        uint256 u_referralFactor = SubscriptionContract.u_referralFactor(nftID);
        uint256[] memory t_supportFactor = SubscriptionContract.t_supportFactor(nftID);
        uint256 v_platformFactor = SubscriptionContract.v_platformFactor(nftID);
        uint256 w_discountFactor = SubscriptionContract.w_discountFactor(nftID);
        uint256[] memory r_licenseFactor = SubscriptionContract.r_licenseFactor(nftID);

        uint256 factor = s_GlobalDAORate()
            .add(t_supportFactor[0])
            .add(r_licenseFactor[0])
            .add(v_platformFactor)
            .add(u_referralFactor)
            .sub(w_discountFactor)
            .add(100000);
    

        if(cost == 0)
            return 0;

        return factor.mul(cost).div(100000) + r_licenseFactor[1] + t_supportFactor[1];
    }

    function dripRatePerSecOfSubnet(uint256 nftID, uint256 subnetID)
        public
        view
        returns (uint256)
    {

        uint256[] memory computeRequired = SubscriptionContract
        .getComputesOfSubnet(nftID, subnetID);

        uint256 cost = getComputeCosts(subnetID, computeRequired, 1);

        if(cost == 0)
            return 0;

        uint256 u_referralFactor = SubscriptionContract.u_referralFactor(nftID);
        uint256[] memory t_supportFactor = SubscriptionContract.t_supportFactor(nftID);
        uint256 v_platformFactor = SubscriptionContract.v_platformFactor(nftID);
        uint256 w_discountFactor = SubscriptionContract.w_discountFactor(nftID);
        uint256[] memory r_licenseFactor = SubscriptionContract.r_licenseFactor(nftID);

        uint256 factor = s_GlobalDAORate()
            .add(t_supportFactor[0])
            .add(r_licenseFactor[0])
            .add(v_platformFactor)
            .add(u_referralFactor)
            .sub(w_discountFactor)
            .add(100000);

        return factor.mul(cost).div(100000) + r_licenseFactor[1] + t_supportFactor[1];
    }


    function estimateDripRatePerSec (
        uint256[] calldata subnetList,
        uint256[] calldata dripFactor,
        uint256[][] calldata computeRequired
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

    function estimateDripRatePerSecOfSubnet(
        uint256 subnetID,
        uint256[] calldata dripFactor,
        uint256[] calldata computeRequired
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


        uint256 cost = getComputeCosts(subnetID, computeRequired, 1);

        return factor.mul(cost).div(100000) + dripFactor[DRF_ID_R2] + dripFactor[DRF_ID_T2];
    }

    function calculateUpdatedPrevBal(
        uint256 totalCostIncurred,
        uint256[3] memory prevBalance
    ) internal pure returns (uint256[3] memory prevBalanceUpdated) {
        uint256 balCostLeft = 0;
        prevBalanceUpdated = [prevBalance[0], prevBalance[1], prevBalance[2]];
        if (totalCostIncurred < prevBalance[0])
            prevBalanceUpdated[0] = prevBalance[0].sub(totalCostIncurred);
        else {
            balCostLeft = totalCostIncurred.sub(prevBalance[0]);
            prevBalanceUpdated[0] = 0;
            if (balCostLeft < prevBalance[1]) {
                prevBalanceUpdated[1] = prevBalance[1].sub(balCostLeft);
                balCostLeft = 0;
            } else {
                balCostLeft = balCostLeft.sub(prevBalance[1]);
                prevBalanceUpdated[1] = 0;
                if (balCostLeft < prevBalance[2]) {
                    prevBalanceUpdated[2] = prevBalance[2].sub(balCostLeft);
                    balCostLeft = 0;
                } else {
                    prevBalanceUpdated[2] = 0;
                }
            }
        }
    }

    function getComputeCosts(
        uint256 subnetID,
        uint256[] memory computeRequired,
        uint256 duration
    )
    internal
    view
    returns (uint256 computeCost)
    {
        uint256 computeCostPerSec = 0;

        (, , , , uint256[] memory unitPrices, , , , ) = RegistrationContract
            .getSubnetAttributes(subnetID);


        uint256 minLen = Math.min(unitPrices.length, computeRequired.length);
        for (uint256 j = 0; j < minLen; j++)
        {
            computeCostPerSec = computeCostPerSec.add(
                computeRequired[j].mul(unitPrices[j])
            );
        }


        computeCost = computeCostPerSec.mul(
            duration
        );
    }

    function receiveRevenue() external {
        receiveRevenueForAddress(_msgSender());
    }

    function receiveRevenueForAddressBulk(address[] memory _userAddresses)
        external
    {
        for (uint256 i = 0; i < _userAddresses.length; i++)
            receiveRevenueForAddress(_userAddresses[i]);
    }

    function receiveRevenueForAddress(address _userAddress) public {
        uint256 bal = balanceOfRev[_userAddress];
        XCTToken.transfer(_userAddress, bal);
        balanceOfRev[_userAddress] = 0;
        emit ReceivedRevenue(_userAddress, bal);
    }

    function withdrawBalance(address to, uint256 amount)
    public
    onlySubscriptionBalance
    {
        XCTToken.transfer(to, amount);
    }

    function estimateBalance(
        uint256 nftID,
        uint256 subnetID,
        uint256 mintTime,
        uint256 duration
    )
    internal
    view
    returns (uint256[] memory)
    {
            uint256[] memory costIncurredArr = new uint256[](PERCENT_COUNT);

            uint256[] memory computeRequired = SubscriptionContract
            .getComputesOfSubnet(nftID, subnetID);
            uint256 computeCost = getComputeCosts(subnetID, computeRequired, duration);


            if(computeCost == 0)
            {
                return costIncurredArr;
            }

            costIncurredArr[ADDR_ID_1] = computeCost;


            costIncurredArr[ADDR_ID_R] =
                SubscriptionContract.r_licenseFactor(nftID)[0]
                .mul(computeCost)
                .mul(duration);

            costIncurredArr[ADDR_ID_R] = costIncurredArr[ADDR_ID_R].add(
                SubscriptionContract.r_licenseFactor(nftID)[1]
                .mul(duration));


            costIncurredArr[ADDR_ID_S] = s_GlobalDAORate()
                .mul(computeCost)
                .div(100000);


            costIncurredArr[ADDR_ID_T] =
                SubscriptionContract.t_supportFactor(nftID)[0]
                .mul(computeCost)
                .div(100000);

            costIncurredArr[ADDR_ID_T] = costIncurredArr[ADDR_ID_T].add(
                SubscriptionContract.t_supportFactor(nftID)[1]
                .div(100000));

            costIncurredArr[ADDR_ID_U] =
                SubscriptionContract.u_referralFactor(nftID)
                .mul(computeCost)
                .div(100000);


            if (mintTime.add(SubscriptionContract.getReferralDuration(nftID)) > block.timestamp)
            {

                uint256 platformAmount = SubscriptionContract.v_platformFactor(nftID)
                    .sub(SubscriptionContract.w_discountFactor(nftID));

                platformAmount = platformAmount.mul(computeCost).div(100000);

                costIncurredArr[ADDR_ID_V] = platformAmount;
            }
            else {
                costIncurredArr[ADDR_ID_V] =
                    SubscriptionContract.v_platformFactor(nftID)
                    .mul(computeCost)
                    .div(100000);
            }


        return costIncurredArr;
    }


    function getRealtimeCostIncurred(
        uint256 nftID,
        uint256[] memory subnetList,
        bool[] memory isSubscribedList,
        uint256 duration,
        uint256 mintTime
    ) public view returns (uint256)
    {

        uint256 totalCostIncurred = 0;
        for(uint256 i = 0; i < subnetList.length; i++)
        {
            if(!isSubscribedList[i])
                continue;

            uint256[] memory costIncurredArr = estimateBalance(
                nftID,
                subnetList[i],
                mintTime,
                duration
            );

            for(uint256 j = 0; j < costIncurredArr.length; j++)
            {
                totalCostIncurred += costIncurredArr[j];
            }
        }


        return totalCostIncurred;
    }

    function getRealtimeBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256[3] memory prevBalance,
        uint256 duration,
        uint256 mintTime
    ) external view returns (uint256[3] memory) {


        uint256 totalCost = getRealtimeCostIncurred(
            nftId,
            subnetIds,
            activeSubnets,
            duration,
            mintTime
        );

        return
            calculateUpdatedPrevBal(
                totalCost,
                prevBalance
            );
    }


    function assignRevenues(
        uint256 nftID,
        uint256 subnetID,
        uint256 mintTime,
        uint256 duration
    )
    internal
    returns (uint256)
    {

        uint256[] memory costIncurredArr = estimateBalance(
            nftID,
            subnetID,
            mintTime,
            duration
        );

        // update (1)(for subnetDAOWallet to SubnetDAODistributor contract) of (1+R+S+T+U) revenue
        address toAddress = address(SubnetDAODistributor);
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[ADDR_ID_1]
        );
        SubnetDAODistributor.commitAssignedFor(
            subnetID,
            costIncurredArr[ADDR_ID_1]
        );


        toAddress = SubscriptionContract.getLicenseAddress(nftID);
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[ADDR_ID_R]
        );


        toAddress = s_GlobalDAOAddress();
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[ADDR_ID_S]
        );


        toAddress = SubscriptionContract.getSupportAddress(nftID);
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[ADDR_ID_T]
        );
    

        // update (u) of of (1+R+S+T+U) revenue.
        if (mintTime.add(SubscriptionContract.getReferralDuration(nftID)) > block.timestamp)
        {

            toAddress = SubscriptionContract.getReferralAddress(nftID);
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[ADDR_ID_U]
            );


            toAddress = SubscriptionContract.getPlatformAddress(nftID);
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[ADDR_ID_V]
            );
        }
        // add to Global DAO
        else {

            toAddress = s_GlobalDAOAddress();
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[ADDR_ID_U]
            );

            toAddress = SubscriptionContract.getPlatformAddress(nftID);
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[ADDR_ID_V]
            );
        }

        uint256 total = 0;
        for(uint256 i = 0; i < costIncurredArr.length; i++)
        {
            total += costIncurredArr[i];
        }

        return total;
    }

    function getUpdatedBalance(
        uint256 nftID,
        uint256[] memory subnetList,
        bool[] memory isSubscribedList,
        uint256 mintTime,
        uint256[3] memory prevBalance,
        uint256 duration
    )
    external
    returns (uint256[3] memory) 
    {

        uint256 totalCostIncurred = 0;
        for(uint256 i = 0; i < subnetList.length; i++)
        {
            if(!isSubscribedList[i])
                continue;

            totalCostIncurred += assignRevenues(
                nftID,
                subnetList[i],
                mintTime,
                duration
            );
        }

        return calculateUpdatedPrevBal(
                totalCostIncurred,
                prevBalance
            );
    }
}

