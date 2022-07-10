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

    function nftBalances(uint256 nftId) external view returns(NFTBalance memory);
    function totalSubnets(uint256 nftId) external view returns(uint256);

    function dripRatePerSec(uint256 NFTid)
        external
        view
        returns (uint256 totalDripRate);

    function dripRatePerSecOfSubnet(uint256 NFTid, uint256 subnetId)
        external
        view
        returns (uint256);

    function ReferralPercent() external view returns(uint256);
    function ReferralRevExpirySecs() external view returns(uint256);

    function subscribeNew(uint256 _nftId, uint256 _balanceToAdd, uint256 _subnetId, address _minter) external returns(bool);
    function refreshEndOfBalance(uint256 _nftId) external returns(bool);
    function refreshBalance(uint256 _nftId) external returns(bool);
    function addSubnetToNFT(
        uint256 _nftId,
        uint256 _subnetId
    ) external returns(bool);
    function changeSubnet(uint256 _nftId, uint256 _currentSubnetId, uint256 _newSubnetId) external returns(bool);

}
