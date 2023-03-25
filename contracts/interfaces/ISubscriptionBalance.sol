// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubscriptionBalance {
    struct NFTBalance {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance; // prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
        uint256[] subnetIds; // cannot be changed unless delisted
        uint256 mintTime;
        uint256 endOfXCTBalance;
    }

    function getBalanceEndTime(uint256 nftID)
    external
    view
    returns(uint256);

    function nftBalances(uint256 nftId)
        external
        view
        returns (NFTBalance memory);

    function totalSubnets(uint256 nftId) external view returns (uint256);

    function ReferralPercent() external view returns (uint256);

    function ReferralRevExpirySecs() external view returns (uint256);

    function subscribeNew(
        uint256 nftID
    ) external;

    function addBalanceWithoutUpdate(address nftOwner, uint256 nftID, uint256 balanceToAdd)
    external;

    function addBalance(address nftOwner, uint256 nftID, uint256 _balanceToAdd)
        external
        returns (
            bool
        );

    function prevBalances(uint256 nftID)
        external
        view
        returns (uint256[3] memory);

    function updateBalance(uint256 _nftId) external;

    function updateBalanceImmediate(
        uint256 nftID
    )
    external;

    function addSubnetToNFT(uint256 _nftId, uint256 _subnetId)
        external
        returns (bool);


    function isBalancePresent(uint256 _nftId) external view returns (bool);

    function estimateUpdatedBalance(uint256 NFTid)
        external
        view
        returns (uint256[3] memory);

    function estimateTotalUpdatedBalance(uint256 NFTid)
        external
        view
        returns (uint256);
    
    function totalPrevBalance(uint256 nftID) external view returns (uint256);


    function addRevBalance(address account, uint256 balance)
    external;

    function receiveRevenue()
    external;

    function receiveRevenueForAddressBulk(address[] memory _userAddresses)
    external;

    function receiveRevenueForAddress(address _userAddress)
    external;
}
