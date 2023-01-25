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

    function r_licenseFee(uint256 _nftId, uint256 _subnetId) external view returns (uint256);
    function t_supportPercent(uint256 _nftId, uint256 _subnetId) external view returns (uint256);

    function u_referralPercent(uint256 nftID, uint256 subnetID)
    external
    view
    returns (uint256);

    function v_platformPercent(uint256 nftID, uint256 subnetID)
    external
    view
    returns (uint256);

    function w_discountPercent(uint256 nftID, uint256 subnetID)
    external
    view
    returns (uint256);

    function getReferralAddress(uint256 _nftId, uint256 _subnetId)
        external
        view
        returns (address);
    function getSupportAddress(uint256 _nftId, uint256 _subnetId)
        external
        view
        returns (address);

    function getLicenseAddress(uint256 _nftId, uint256 _subnetId)
        external
        view
        returns (address);

    function getPlatformAddress(uint256 _nftId, uint256 _subnetId)
        external
        view
        returns (address);

    function getReferralDuration(uint256 nftID, uint256 subnetID)
    external
    view
    returns(uint256);
    
    function getSupportFeesForNFT(uint256 nftID, uint256 subnetID)
    view
    external
    returns (uint256 supportFee);

    function GLOBAL_DAO_ADDRESS() external view returns (address);


    function subscribe(
        address subscriber,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256 _subnetId,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        address _platformAddress,
        uint256 _licenseFee,
        int256[] memory _deltaCompute
    )
    external;

    function subscribeBatch(
        address subscriber,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256[] memory _subnetId,
        address[] memory _referralAddress,
        address[] memory _licenseAddress,
        address[] memory _supportAddress,
        address[] memory _platformAddress,
        uint256[] memory _licenseFee,
        int256[][] memory _deltaCompute
    )
    external;
}


