// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubscription {

    function getComputesOfSubnet(uint256 NFTid, uint256 subnetId) external view returns(uint256[] memory);
    function hasRole(bytes32 role, address account) external view returns(bool);

    function r_licenseFee(uint256 _nftId, uint256 _subnetId) external view returns (uint256);
    function getReferralAddress(uint256 _nftId, uint256 _subnetId)
        external
        view
        returns (address);
        
    function GLOBAL_DAO_ADDRESS() external view returns (address);
}


