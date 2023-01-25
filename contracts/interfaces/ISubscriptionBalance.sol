// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubscriptionBalance {
    struct NFTBalance {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance; // prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
        uint256[] subnetIds; // cannot be changed unless delisted
        address NFTMinter;
        uint256 mintTime;
        uint256 endOfXCTBalance;
    }

    function nftBalances(uint256 nftId)
        external
        view
        returns (NFTBalance memory);

    function totalSubnets(uint256 nftId) external view returns (uint256);


    function estimateDripRatePerSecOfSubnet(
        uint subnetId,
        uint256 licenseFee,
        uint256 supportFee,
        uint256 platformFee,
        uint256 referralFee,
        uint256 discountFee,
        uint256[] memory computeRequired
        )
        external
        view
        returns (uint256);


    function estimateDripRatePerSec (
        uint256[] memory _subnetId,
        uint256[] memory _supportFee,
        uint256[] memory _platformFee,
        uint256[] memory _referralFee,
        uint256[] memory _discountFee,
        uint256[] memory _licenseFee,
        uint256[][] memory _computeRequired
    )
    external
    view
    returns (uint256);

    function dripRatePerSec(uint256 NFTid)
        external
        view
        returns (uint256 totalDripRate);

    function dripRatePerSecOfSubnet(uint256 NFTid, uint256 subnetId)
        external
        view
        returns (uint256);

    function ReferralPercent() external view returns (uint256);

    function ReferralRevExpirySecs() external view returns (uint256);

    function subscribeNew(
        uint256 _nftId,
        // uint256 _subnetId,
        address _minter
    ) external returns (bool);

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

    function addSubnetToNFT(uint256 _nftId, uint256 _subnetId)
        external
        returns (bool);

    function changeSubnet(
        uint256 _nftId,
        uint256 _currentSubnetId,
        uint256 _newSubnetId
    ) external returns (bool);

    function isBalancePresent(uint256 _nftId) external view returns (bool);

    function isSubscribed(uint256 nftID)
    external
    view
    returns (bool);

    function estimateUpdatedBalance(uint256 NFTid)
        external
        view
        returns (uint256[3] memory);

    function estimateTotalUpdatedBalance(uint256 NFTid)
        external
        view
        returns (uint256);
    
    function totalPrevBalance(uint256 nftID) external view returns (uint256);
}
