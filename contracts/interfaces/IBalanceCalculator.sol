// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IBalanceCalculator {
    
    function getUpdatedBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256 mintTime,
        uint256[3] memory prevBalance,
        uint256 duration
        // ,
        // uint256 lastBalanceUpdatedTime
    ) external returns (uint256[3] memory);


    function getRealtimeBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256[3] memory prevBalance,
        uint256 lastBalanceUpdatedTime
    ) external view returns (uint256[3] memory prevBalanceUpdated);

    function getRealtimeCostIncurred(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256 lastBalanceUpdatedTime
    ) external view returns (uint256);

    function receiveRevenueForAddress(address _userAddress) external;

    function withdrawBalance(address to, uint256 amount)
    external;
}
