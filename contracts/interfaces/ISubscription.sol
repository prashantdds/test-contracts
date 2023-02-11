// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubscription {

   function isBridgeRole()
    external
    view
    returns (bool);

    function getSubnetsOfNFT(
        uint256 nftID
    )
    external
    view
    returns(uint256[] memory);

    function getActiveSubnetsOfNFT(
        uint256 nftID
    )
    external
    view
    returns (bool[] memory);

    function getComputesOfSubnet(uint256 NFTid, uint256 subnetId) external view returns(uint256[] memory);
    function hasRole(bytes32 role, address account) external view returns(bool);

    function r_licenseFactor(uint256 nftID) external view returns (uint256[] memory);
    function t_supportFactor(uint256 nftID) external view returns (uint256[] memory);

    function u_referralFactor(uint256 nftID)
    external
    view
    returns (uint256);

    function v_platformFactor(uint256 nftID)
    external
    view
    returns (uint256);

    function w_discountFactor(uint256 nftID)
    external
    view
    returns (uint256);

    function getReferralAddress(uint256 nftID)
        external
        view
        returns (address);
    function getSupportAddress(uint256 nftID)
        external
        view
        returns (address);

    function getLicenseAddress(uint256 nftID)
        external
        view
        returns (address);

    function getPlatformAddress(uint256 nftID)
        external
        view
        returns (address);

    function getReferralDuration(uint256 nftID)
    external
    view
    returns(uint256);
    
    function getSupportFeesForNFT(uint256 nftID, uint256 subnetID)
    view
    external
    returns (uint256 supportFee);

    function GLOBAL_DAO_ADDRESS() external view returns (address);

    function subscribeBatch(
        address subscriber,
        uint256 _balanceToAdd,
        uint256 nftID,
        uint256[] memory subnetID,
        address referralAddress,
        address licenseAddress,
        address supportAddress,
        address platformAddress,
        uint256[] memory licenseFee,
        int256[][] memory _deltaCompute
    )
    external;

    function subscribeToSubnetList(
        address subscriber,
        uint256 balanceToAdd,
        uint256 nftID,
        uint256[] memory subnetList,
        int256[][] memory deltaCompute
    )
    external;
}


