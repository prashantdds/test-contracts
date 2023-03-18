// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubscription {

    struct NFTAttribute {
        uint256 createTime;
        address[] factorAddressList;
    }

    struct PlatformAddress {
        uint256 platformPercentage;
        uint256 discountPercentage;
        uint256 referralPercentage;
        uint256 referralExpiryDuration;
        bool active;
    }

    function getCreateTime(uint256 nftID)
    external
    view
    returns (uint256);

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

    function getNFTSubscription(uint256 nftID)
    external
    view
    returns(NFTAttribute memory nftAttribute);

    function getPlatformFactors(address platformAddress)
    external
    view
    returns (
        PlatformAddress memory
    );

    function hasRole(bytes32 role, address account) external view returns(bool);

    function getSupportFeesForNFT(uint256 nftID, uint256 subnetID)
    view
    external
    returns (uint256 supportFee);

    function GLOBAL_DAO_ADDRESS() external view returns (address);

    function subscribe(
        uint256 nftID,
        address[] memory addressList,
        uint256[] memory licenseFactor
    ) external;

    function getLicenseFactor(uint256 nftID)
    external
    view
    returns (uint256[] memory);

    function getSupportFactor(uint256 nftID)
    external
    view
    returns (uint256[] memory);

    function getNFTFactorAddress(uint256 nftID, uint256 factorID)
    external
    view
    returns(address);
}


