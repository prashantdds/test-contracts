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
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256 duration
    ) internal view returns (uint256 computeCost) {
        uint256 computeCostPerSec = 0;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            if(!activeSubnets[i])
                continue;
    
            uint256[] memory computeRequired = SubscriptionContract
                .getComputesOfSubnet(nftId, subnetIds[i]);

            (, , , , uint256[] memory unitPrices, , , , ) = RegistrationContract
                .getSubnetAttributes(subnetIds[i]);

            for (uint256 j = 0; j < computeRequired.length; j++)
            {
                computeCostPerSec = computeCostPerSec.add(
                    computeRequired[j].mul(unitPrices[j])
                );
            }
        }
        // uint256 duration = block.timestamp.sub(lastBalanceUpdatedTime);
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

    function estimateBalanceForSubnet(
        uint256 nftId,
        uint256 subnetID,
        uint256 mintTime,
        uint256 computeCost,
        uint256 duration,
        uint256[5] memory costIncurredArr
    )
    internal
    view
    returns (uint256[5] memory)
    {
        // update R revenue of (1+R+S+T+U) revenue
        costIncurredArr[0] = costIncurredArr[0].add(
            r_licenseFee(nftId, subnetID)
                .mul(duration)
        );

        // update T revenue of (1+R+S+T+U) revenue
        costIncurredArr[2] = costIncurredArr[2].add(
            t_supportPercent(nftId, subnetID)
            .mul(computeCost)
            .div(100000)
        );

        costIncurredArr[4] = costIncurredArr[4].add(
            u_referralPercent(nftId, subnetID)
        )
        .mul(computeCost)
        .div(100000);

        // update (u) of of (1+R+S+T+U) revenue.
        if (mintTime.add(u_ReferralExpiry(nftId, subnetID)) > block.timestamp) {

            costIncurredArr[4] = costIncurredArr[4].add(
                v_platformPercent(nftId, subnetID)
                .sub(w_discountPercent(nftId, subnetID))
            )
            .mul(computeCost)
            .div(100000);
        }
        // add to Global DAO
        else {
            costIncurredArr[4] = costIncurredArr[4].add(
                v_platformPercent(nftId, subnetID)
                .mul(computeCost)
                .div(100000)
            );
        }

        return costIncurredArr;
    }

    function getRealtimeBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256[3] memory prevBalance,
        uint256 duration,
        uint256 mintTime
    ) external view returns (uint256[3] memory) {
        uint256 computeCost = getComputeCosts(
            nftId,
            subnetIds,
            activeSubnets,
            duration
        );

        uint256[5] memory costIncurredArr = [
            uint256(0),
            s_GlobalDAORate().mul(computeCost).div(100000),
            0,
            u_referralPercent(0,0 ).mul(computeCost).div(100000),
            0
        ]; //r,s,t,u

        for (uint256 i = 0; i < subnetIds.length; i++)
        {
            uint256 subnetID = subnetIds[i];
            costIncurredArr = estimateBalanceForSubnet(
                nftId,
                subnetID,
                mintTime,
                computeCost,
                duration,
                costIncurredArr
            );
        }

        return
            calculateUpdatedPrevBal(
                (
                    costIncurredArr[0] // r
                    .add(costIncurredArr[1]) // s
                        .add(costIncurredArr[2])
                        .add(costIncurredArr[3])
                        .add(computeCost) // t // u
                ), // 1
                prevBalance
            );
    }

    function getRealtimeCostIncurred(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256 duration,
        uint256 mintTime
    ) external view returns (uint256) {
        uint256 computeCost = getComputeCosts(
            nftId,
            subnetIds,
            activeSubnets,
            duration
        );

        uint256[5] memory costIncurredArr = [
            uint256(0),
            s_GlobalDAORate().mul(computeCost).div(100000),
            0,
            0,
            0
        ]; //r,s,t,u

        for (uint256 i = 0; i < subnetIds.length; i++)
        {
            uint256 subnetID = subnetIds[i];
            costIncurredArr = estimateBalanceForSubnet(
                nftId,
                subnetID,
                mintTime,
                computeCost,
                duration,
                costIncurredArr
            );
        }

        return (
            costIncurredArr[0] // r
            .add(costIncurredArr[1]) // s
                .add(costIncurredArr[2])
                .add(costIncurredArr[3])
                .add(costIncurredArr[4])
                .add(computeCost) // t // u
        );
    }


    function getUpdatedBalanceForSubnet(
        uint256 nftId,
        uint256 subnetID,
        uint256 mintTime,
        uint256 computeCost,
        uint256 duration,
        uint256[5] memory costIncurredArr
    )
    internal
    returns (uint256[5] memory)
    {
        // update R revenue of (1+R+S+T+U) revenue
        costIncurredArr[0] = costIncurredArr[0].add(
            r_licenseFee(nftId, subnetID)
                .mul(duration)
        );
        address toAddress = SubscriptionContract.getLicenseAddress(nftId, subnetID);
        balanceOfRev[toAddress] = balanceOfRev[toAddress].add(
            costIncurredArr[0]
        );

        // update T revenue of (1+R+S+T+U) revenue
        costIncurredArr[2] = costIncurredArr[2].add(
            t_supportPercent(nftId, subnetID)
            .mul(computeCost)
            .div(100000)
        );
        toAddress = SubscriptionContract.getSupportAddress(nftId, subnetID);
        balanceOfRev[toAddress]
            = balanceOfRev[toAddress].add(costIncurredArr[2]);


        costIncurredArr[3] = costIncurredArr[3].add(
            u_referralPercent(nftId, subnetID)
        )
        .mul(computeCost)
        .div(100000);

        // update (u) of of (1+R+S+T+U) revenue.
        if (mintTime.add(u_ReferralExpiry(nftId, subnetID)) > block.timestamp) {
            toAddress = SubscriptionContract
                .getReferralAddress(nftId, subnetID);
    
            balanceOfRev[toAddress] = balanceOfRev[
                toAddress
            ].add(costIncurredArr[3]);


        uint256 platformAmount = v_platformPercent(nftId, subnetID)
            .sub(w_discountPercent(nftId, subnetID));
        
        platformAmount = platformAmount.mul(computeCost)
        .div(100000);

        costIncurredArr[4] = costIncurredArr[4].add(platformAmount);


        toAddress = SubscriptionContract.getPlatformAddress(nftId, subnetID);
        balanceOfRev[toAddress]
            = balanceOfRev[toAddress].add(costIncurredArr[4]);
        }
        // add to Global DAO
        else {

            balanceOfRev[s_GlobalDAOAddress()] = balanceOfRev[
                s_GlobalDAOAddress()
            ].add(costIncurredArr[3]);

        costIncurredArr[4] = costIncurredArr[4].add(
            v_platformPercent(nftId, subnetID)
            .mul(computeCost)
            .div(100000)
        );
        toAddress = SubscriptionContract.getPlatformAddress(nftId, subnetID);
        balanceOfRev[toAddress]
            = balanceOfRev[toAddress].add(costIncurredArr[4]);
        }

        return costIncurredArr;
    }

    function getUpdatedBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256 mintTime,
        uint256[3] memory prevBalance,
        uint256 duration
        // uint256 lastBalanceUpdatedTime
    ) external returns (uint256[3] memory) {
        uint256 computeCost = getComputeCosts(
            nftId,
            subnetIds,
            activeSubnets,
            duration
        );

        if (computeCost > 100000) {
            uint256[5] memory costIncurredArr = [
                uint256(0),
                s_GlobalDAORate().mul(computeCost).div(100000),
                0,
                0,
                0
            ]; //r,s,t,u

            // update S revenue of (1+R+S+T+U) revenue
            balanceOfRev[s_GlobalDAOAddress()] = balanceOfRev[
                s_GlobalDAOAddress()
            ].add(costIncurredArr[1]);

        // update (1)(for subnetDAOWallet to SubnetDAODistributor contract) of (1+R+S+T+U) revenue
        balanceOfRev[address(SubnetDAODistributor)] = balanceOfRev[
            address(SubnetDAODistributor)
        ].add(computeCost);
        // SubnetDAODistributor.commitAssignedFor(
        //     subnetID,
        //     computeCost
        // );

            for (uint256 i = 0; i < subnetIds.length; i++)
            {
                if(!activeSubnets[i])
                    continue;


                costIncurredArr = getUpdatedBalanceForSubnet(
                    nftId,
                    subnetIds[i],
                    mintTime,
                    computeCost,
                    duration,
                    costIncurredArr
                );

            }

            return
                calculateUpdatedPrevBal(
                    (
                        costIncurredArr[0] // r
                        .add(costIncurredArr[1]) // s
                            .add(costIncurredArr[2]) // t 
                            .add(costIncurredArr[3]) // u
                            .add(costIncurredArr[4])
                            .add(computeCost) // 1
                    ), 
                    prevBalance
                );
        }
        return prevBalance;
    }
}
