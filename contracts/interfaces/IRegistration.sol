// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IRegistration {
    struct SubnetAttributes {
        uint256 subnetType;
        bool sovereignStatus;
        uint256 cloudProviderType;
        bool subnetStatusListed;
        uint256[] unitPrices;
        uint256[] otherAttributes; // eg. [1,2]
        uint256 maxClusters;
        uint256 supportFeeRate; // 1000 = 1%
        uint256 stackFeesReqd;
    }

    struct Cluster {
        address ClusterDAO;
        string DNSIP;
        uint8 listed;
        uint NFTidLocked;
    }

    struct PriceChangeRequest {
        uint256 timestamp;
        uint256[] unitPrices;
    }

    function getUnitPrices(uint256 subnetID)
    external
    view
    returns(
        uint256[] memory
    );

    function getUnitPricesList(uint256[] memory subnetList)
    external
    view
    returns(
        uint256[][] memory
    );

    function checkSubnetStatus1(uint256 subnetID)
    external
    view
    returns(bool);

    function checkSubnetStatus(uint256[] memory subnetList)
    external
    view
    returns(bool[] memory);

    function totalSubnets() external view returns (uint256);

    function subnetAttributes(uint256 _subnetId) external view returns(SubnetAttributes memory);

    function subnetClusters(uint256 _subnetId, uint256 _clusterId) external view returns(Cluster memory);

    function getSubnetAttributes(uint256 _subnetId) external view returns(uint256 subnetType, bool sovereignStatus, uint256 cloudProviderType, bool subnetStatusListed, uint256[] memory unitPrices, uint256[] memory otherAttributes, uint256 maxClusters, uint256 supportFeeRate, uint256 stackFeeReqd);

    function getClusterAttributes(uint256 _subnetId, uint256 _clusterId) external view returns(address ClusterDAO, string memory DNSIP, uint8 listed, uint NFTIdLocked);

    function subnetLocalDAO(uint256 subnetId) external view returns (address);

    function daoRate() external view returns (uint256);

    function hasPermissionToClusterList(uint256 subnetId, address user) external view returns (bool);

    function GLOBAL_DAO_ADDRESS() external view returns (address);
}
