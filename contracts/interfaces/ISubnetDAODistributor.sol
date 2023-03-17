// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubnetDAODistributor {

    function commitAssignedFor(uint subnetId, uint revenue) external;
    function setClusterWeight(
        uint256 subnetID,
        uint256 clusterID,
        uint256 weight
    )
    external;
}
