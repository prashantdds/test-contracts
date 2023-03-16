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
        uint256 nftID,
        uint256 lastUpdateTime,
        uint256 totalBalance,
        uint256 accumComputeCost,
        uint256 accumDuration
    )
    external
    returns (uint256);

    function distributeRevenue(
        uint256 nftID,
        uint256 revenue,
        uint256 duration
    )
    external
    returns (uint256);

    function getUpdatedSubnetBalance(
        uint256 nftID,
        uint256 lastUpdateTime,
        uint256 totalBalance,
        uint256[] memory subnetList
    )
    external
    returns (uint256, uint256, uint256);

    function getUpdatedBalanceImmediate(
        uint256 nftID,
        uint256 lastUpdateTime,
        uint256 totalBalance
    )
    external
    returns (uint256, uint256, uint256);

    function getRealtimeCostIncurred(
        uint256 nftID,
        uint256[] memory subnetList,
        bool[] memory isSubscribedList,
        uint256 duration,
        uint256 mintTime
    ) external view returns (uint256);

}
