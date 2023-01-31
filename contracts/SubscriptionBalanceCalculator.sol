// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "./interfaces/ISubnetDAODistributor.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IERC721.sol";
import "hardhat/console.sol";

contract SubscriptionBalanceCalculator is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    IRegistration public RegistrationContract;
    IERC721 public ApplicationNFT;
    ISubscription public SubscriptionContract;
    ISubscriptionBalance public SubscriptionBalance;
    IERC20Upgradeable public XCTToken;
    ISubnetDAODistributor public SubnetDAODistributor;

    uint32 constant public PERCENT_COUNT = 6;
    uint32 constant public PERCENT_ID_1 = 0;
    uint32 constant public PERCENT_ID_R = 1;
    uint32 constant public PERCENT_ID_S = 2;
    uint32 constant public PERCENT_ID_T = 3;
    uint32 constant public PERCENT_ID_U = 4;
    uint32 constant public PERCENT_ID_V = 5;

    mapping(address => uint256) public balanceOfRev;

    event ReceivedRevenue(address benficiary, uint256 bal);

    function initialize(
        IRegistration _RegistrationContract,
        IERC721 _ApplicationNFT,
        IERC20Upgradeable _XCTToken
    ) public initializer {
        __Ownable_init_unchained();
        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
 
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

    // 1 part is SubnetDAODistributor smart contract
    // r address is NFT minter address => nftBalances[_nftId].nftMinter

    function r_licenseFee(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (uint256)
    {
        return SubscriptionContract.r_licenseFee(_nftId, _subnetId);
    }

    function s_GlobalDAORate() public view returns (uint256) {
        return RegistrationContract.daoRate();
    }

    function t_supportPercent(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (uint256 fee)
    {
        // (, , , , , , , fee, ) = RegistrationContract.getSubnetAttributes(
        //     _subnetId
        // );
        return SubscriptionContract.t_supportPercent(_nftId, _subnetId);
    }

    function u_referralPercent(uint256 nftID, uint256 subnetID) public view returns (uint256) {
        return SubscriptionContract.u_referralPercent(nftID, subnetID);
    }

    function v_platformPercent(uint256 nftID, uint256 subnetID) public view returns (uint256) {
        return SubscriptionContract.v_platformPercent(nftID, subnetID);
    }

    function w_discountPercent(uint256 nftID, uint256 subnetID) public view returns (uint256) {
        return SubscriptionContract.w_discountPercent(nftID, subnetID);
    }

    function u_ReferralExpiry(uint256 nftID, uint256 subnetID) public view returns (uint256) {
        return SubscriptionContract.getReferralDuration(nftID, subnetID);
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
        uint256 nftID,
        uint256 subnetID,
        uint256 duration
    ) internal view returns (uint256 computeCost) {
        uint256 computeCostPerSec = 0;
        uint256[] memory computeRequired = SubscriptionContract
            .getComputesOfSubnet(nftID, subnetID);

        (, , , , uint256[] memory unitPrices, , , , ) = RegistrationContract
            .getSubnetAttributes(subnetID);

        for (uint256 j = 0; j < computeRequired.length; j++)
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

            uint256 computeCost = getComputeCosts(nftID, subnetID, duration);

            costIncurredArr[PERCENT_ID_1] = costIncurredArr[PERCENT_ID_1].add(
                computeCost
            );


            // update R revenue of (1+R+S+T+U) revenue
            costIncurredArr[PERCENT_ID_R] = costIncurredArr[PERCENT_ID_R].add(
                r_licenseFee(nftID, subnetID)
                    .mul(duration)
            );

            costIncurredArr[PERCENT_ID_S] = costIncurredArr[PERCENT_ID_S].add(
                s_GlobalDAORate()
                .mul(computeCost)
                .div(100000)
            );


            // update T revenue of (1+R+S+T+U) revenue
            costIncurredArr[PERCENT_ID_T] = costIncurredArr[PERCENT_ID_T].add(
                t_supportPercent(nftID, subnetID)
                .mul(computeCost)
                .div(100000)
            );

            costIncurredArr[PERCENT_ID_U] = costIncurredArr[PERCENT_ID_U].add(
                u_referralPercent(nftID, subnetID)
                .mul(computeCost)
                .div(100000)
            );

            // update (u) of of (1+R+S+T+U) revenue.
            if (mintTime.add(u_ReferralExpiry(nftID, subnetID)) > block.timestamp)
            {

                uint256 platformAmount = v_platformPercent(nftID, subnetID)
                    .sub(w_discountPercent(nftID, subnetID));
                platformAmount = platformAmount.mul(computeCost).div(100000);

                costIncurredArr[PERCENT_ID_V] = costIncurredArr[PERCENT_ID_V].add(
                    platformAmount
                );
            }
            // add to Global DAO
            else {
                costIncurredArr[PERCENT_ID_V] = costIncurredArr[PERCENT_ID_V].add(
                    v_platformPercent(nftID, subnetID)
                    .mul(computeCost)
                    .div(100000)
                );
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
            costIncurredArr[PERCENT_ID_1]
        );
        SubnetDAODistributor.commitAssignedFor(
            subnetID,
            costIncurredArr[PERCENT_ID_1]
        );


        toAddress = SubscriptionContract.getLicenseAddress(nftID, subnetID);
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[PERCENT_ID_R]
        );


        toAddress = s_GlobalDAOAddress();
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[PERCENT_ID_S]
        );


        toAddress = SubscriptionContract.getSupportAddress(nftID, subnetID);
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[PERCENT_ID_T]
        );
    

        // update (u) of of (1+R+S+T+U) revenue.
        if (mintTime.add(u_ReferralExpiry(nftID, subnetID)) > block.timestamp)
        {

            toAddress = SubscriptionContract.getReferralAddress(nftID, subnetID);
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[PERCENT_ID_U]
            );


            toAddress = SubscriptionContract.getPlatformAddress(nftID, subnetID);
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[PERCENT_ID_V]
            );
        }
        // add to Global DAO
        else {

            toAddress = s_GlobalDAOAddress();
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[PERCENT_ID_U]
            );

            toAddress = SubscriptionContract.getPlatformAddress(nftID, subnetID);
            balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
                costIncurredArr[PERCENT_ID_V]
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

