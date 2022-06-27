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
    }

    struct Cluster {
        address ClusterDAO;
        string DNSIP;
        bool listed;
    }

    struct PriceChangeRequest {
        uint256 timestamp;
        uint256[] unitPrices;
    }

    function subnetAttributes(uint _subnetId) external view returns(SubnetAttributes memory);

    function subnetClusters(uint _subnetId, uint _clusterId) external view returns(Cluster memory);

    function getSubnetAttributes(uint _subnetId) external view returns(uint256 subnetType, bool sovereignStatus, uint256 cloudProviderType, bool subnetStatusListed, uint256[] memory unitPrices, uint256[] memory otherAttributes, uint256 maxClusters, uint256 supportFeeRate);

    function getClusterAttributes(uint _subnetId, uint _clusterId) external view returns(address ClusterDAO, string memory DNSIP, bool listed);

    function subnetLocalDAO(uint256 subnetId) external view returns (address);

    function daoRate() external view returns (uint256);

    function GLOBAL_DAO_ADDRESS() external view returns (address);
}
