// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IERC721.sol";

contract SubscriptionBalanceCalculator is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    IRegistration public RegistrationContract;
    IERC721 public ApplicationNFT;
    ISubscription public SubscriptionContract;
    ISubscriptionBalance public SubscriptionBalance;
    IERC20Upgradeable public XCTToken;
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

    function t_supportFeeAddress(uint256 _tokenId)
        public
        view
        returns (address)
    {
        return ApplicationNFT.ownerOf(_tokenId);
    }

    function s_GlobalDAOAddress() public view returns (address) {
        return RegistrationContract.GLOBAL_DAO_ADDRESS();
    }

    // r address is NFT minter address => nftBalances[_nftId].nftMinter

    function subnetDAOWalletFor1(uint256 _subnetId)
        public
        view
        returns (address)
    {
        return RegistrationContract.subnetLocalDAO(_subnetId);
    }

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

    function t_SupportFeeRate(uint256 _subnetId)
        public
        view
        returns (uint256 fee)
    {
        (, , , , , , , fee, ) = RegistrationContract.getSubnetAttributes(
            _subnetId
        );
    }

    function u_ReferralPercent() public view returns (uint256) {
        return SubscriptionBalance.ReferralPercent();
    }

    function u_ReferralExpiry() public view returns (uint256) {
        return SubscriptionBalance.ReferralRevExpirySecs();
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
        uint256 lastBalanceUpdatedTime
    ) internal view returns (uint256 computeCost) {
        uint256 computeCostPerSec = 0;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            uint256[] memory computeRequired = SubscriptionContract
                .getComputesOfSubnet(nftId, subnetIds[i]);
            (, , , , uint256[] memory unitPrices, , , , ) = RegistrationContract
                .getSubnetAttributes(subnetIds[i]);
            for (uint256 j = 0; j < computeRequired.length; j++) {
                computeCostPerSec = computeCostPerSec.add(
                    computeRequired[j].mul(unitPrices[j])
                );
            }
        }
        computeCost = computeCostPerSec.mul(
            block.timestamp.sub(lastBalanceUpdatedTime)
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


    function getRealtimeBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        uint256[3] memory prevBalance,
        uint256 lastBalanceUpdatedTime
    ) external view returns (uint256[3] memory) {
        uint256 computeCost = getComputeCosts(
            nftId,
            subnetIds,
            lastBalanceUpdatedTime
        );

        uint256[4] memory costIncurredArr = [
            uint256(0),
            s_GlobalDAORate().mul(computeCost).div(100000),
            0,
            u_ReferralPercent().mul(computeCost).div(100000)
        ]; //r,s,t,u

        for (uint256 i = 0; i < subnetIds.length; i++) {
            costIncurredArr[0] = costIncurredArr[0].add(
                r_licenseFee(nftId, subnetIds[i])
                    .mul(computeCost)
                    .div(100000)
            );
            costIncurredArr[2] = costIncurredArr[2].add(
                t_SupportFeeRate(subnetIds[i]).mul(computeCost).div(
                    100000
                )
            );
        }

        return calculateUpdatedPrevBal(
            (
                costIncurredArr[0] // r
                .add(costIncurredArr[1]) // s
                .add(costIncurredArr[2]) // t
                .add
                (costIncurredArr[3]).add(computeCost) // u
            ), // 1
            prevBalance
        );

    }


    function getRealtimeCostIncurred(
        uint256 nftId,
        uint256[] memory subnetIds,
        uint256[3] memory prevBalance,
        uint256 lastBalanceUpdatedTime
    ) external view returns (uint256) {
        uint256 computeCost = getComputeCosts(
            nftId,
            subnetIds,
            lastBalanceUpdatedTime
        );

        uint256[4] memory costIncurredArr = [
            uint256(0),
            s_GlobalDAORate().mul(computeCost).div(100000),
            0,
            u_ReferralPercent().mul(computeCost).div(100000)
        ]; //r,s,t,u

        for (uint256 i = 0; i < subnetIds.length; i++) {
            costIncurredArr[0] = costIncurredArr[0].add(
                r_licenseFee(nftId, subnetIds[i])
                    .mul(computeCost)
                    .div(100000)
            );
            costIncurredArr[2] = costIncurredArr[2].add(
                t_SupportFeeRate(subnetIds[i]).mul(computeCost).div(
                    100000
                )
            );
        }

        return (
                costIncurredArr[0] // r
                .add(costIncurredArr[1]) // s
                .add(costIncurredArr[2]) // t
                .add
                (costIncurredArr[3]).add(computeCost) // u
            );

    }


    function getUpdatedBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        address nftMinter,
        uint256 mintTime,
        uint256[3] memory prevBalance,
        uint256 lastBalanceUpdatedTime
    ) external returns (uint256[3] memory) {
        uint256 computeCost = getComputeCosts(
            nftId,
            subnetIds,
            lastBalanceUpdatedTime
        );

        if (computeCost > 100000) {
            uint256[4] memory costIncurredArr = [
                uint256(0),
                s_GlobalDAORate().mul(computeCost).div(100000),
                0,
                u_ReferralPercent().mul(computeCost).div(100000)
            ]; //r,s,t,u

            // update S revenue of (1+R+S+T+U) revenue
            balanceOfRev[s_GlobalDAOAddress()] = balanceOfRev[
                s_GlobalDAOAddress()
            ].add(costIncurredArr[1]);

            uint256 nftIdCopy = nftId;
            uint256[] memory subnetIdsCopy = subnetIds;
            address nftMinterCopy = nftMinter;
            uint256 mintTimeCopy = mintTime;

            for (uint256 i = 0; i < subnetIdsCopy.length; i++) {
                costIncurredArr[0] = costIncurredArr[0].add(
                    r_licenseFee(nftIdCopy, subnetIdsCopy[i])
                        .mul(computeCost)
                        .div(100000)
                );
                costIncurredArr[2] = costIncurredArr[2].add(
                    t_SupportFeeRate(subnetIdsCopy[i]).mul(computeCost).div(
                        100000
                    )
                );

                // update (1)(for subnetDAOWallet) of (1+R+S+T+U) revenue
                balanceOfRev[
                    subnetDAOWalletFor1(subnetIdsCopy[i])
                ] = balanceOfRev[subnetDAOWalletFor1(subnetIdsCopy[i])].add(
                    computeCost
                );

                // update (u) of of (1+R+S+T+U) revenue
                if (mintTimeCopy.add(u_ReferralExpiry()) > block.timestamp) {
                    address ReferrerAddress = SubscriptionContract
                        .getReferralAddress(nftIdCopy, subnetIdsCopy[i]);

                    balanceOfRev[ReferrerAddress] = balanceOfRev[
                        ReferrerAddress
                    ].add(costIncurredArr[3]);
                }
                // add to Global DAO
                else {
                    balanceOfRev[s_GlobalDAOAddress()] = balanceOfRev[
                        s_GlobalDAOAddress()
                    ].add(costIncurredArr[3]);
                }
            }
            // update R revenue of (1+R+S+T+U) revenue
            balanceOfRev[nftMinterCopy] = balanceOfRev[nftMinterCopy].add(
                costIncurredArr[0]
            );

            // update T revenue of (1+R+S+T+U) revenue
            balanceOfRev[t_supportFeeAddress(nftIdCopy)] = balanceOfRev[
                t_supportFeeAddress(nftIdCopy)
            ].add(costIncurredArr[2]);

            return calculateUpdatedPrevBal(
                (
                    costIncurredArr[0] // r
                    .add(costIncurredArr[1]) // s
                    .add(costIncurredArr[2]) // t
                    .add(costIncurredArr[3]).add(computeCost) // u
                ), // 1
                prevBalance
            );
        }
        return prevBalance;
    }
}
