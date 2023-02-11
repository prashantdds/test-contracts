// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IBalanceCalculator {
    
    function dripRatePerSec(uint256 nftID)
    external
    view
    returns (uint256);

    function dripRatePerSecOfSubnet(uint256 nftID, uint256 subnetID)
    external
    view
    returns (uint256);

    function estimateDripRatePerSec (
        uint256[] memory subnetList,
        uint256 t_supportPercent,
        uint256 v_platformPercent,
        uint256 u_referralPercent,
        uint256 w_discountPercent,
        uint256 r_licenseFee,
        uint256[][] memory computeRequired
    )
    external
    view
    returns (uint256); 


    function estimateDripRatePerSecOfSubnet(
        uint256 subnetID,
        uint256 t_supportPercent,
        uint256 v_platformPercent,
        uint256 u_referralPercent,
        uint256 w_discountPercent,
        uint256 r_licenseFee,
        uint256[] memory computeRequired
    )
    external
    view
    returns (uint256);

    function getUpdatedBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256 mintTime,
        uint256[3] memory prevBalance,
        uint256 duration
    ) external returns (uint256[3] memory);


    function getRealtimeBalance(
        uint256 nftId,
        uint256[] memory subnetIds,
        bool[] memory activeSubnets,
        uint256[3] memory prevBalance,
        uint256 duration,
        uint256 mintTime
    ) external view returns (uint256[3] memory);

    function getRealtimeCostIncurred(
        uint256 nftID,
        uint256[] memory subnetList,
        bool[] memory isSubscribedList,
        uint256 duration,
        uint256 mintTime
    ) external view returns (uint256);

    function receiveRevenueForAddress(address _userAddress) external;

    function withdrawBalance(address to, uint256 amount)
    external;
}
