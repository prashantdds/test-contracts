// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IBalanceCalculator {
    function getUpdatedBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        address nftMinter,
        uint256 mintTime,
        uint256[3] memory prevBalance,
        uint256 lastBalanceUpdatedTime
    ) external returns (uint256[3] memory prevBalanceUpdated);

    function getRealtimeBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        uint256[3] memory prevBalance,
        uint256 lastBalanceUpdatedTime
    ) external view returns (uint256[3] memory prevBalanceUpdated);

    function getRealtimeCostIncurred(
        uint256 nftId,
        uint256[] memory subnetIds,
        uint256 lastBalanceUpdatedTime
    ) external view returns (uint256);

    function receiveRevenueForAddress(address _userAddress) external;

}
