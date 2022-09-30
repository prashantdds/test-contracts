// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ISubnetDAODistributor {

    function commitAssignedFor(uint subnetId, uint revenue) external;
    function addWeight(
        uint256 subnetId,
        address _revenueAddress,
        uint256 _weight
    ) external;
}
