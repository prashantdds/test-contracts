// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IContractBasedDeployment {
    
    function getComputesOfSubnet(uint256 NFTid, uint256 subnetId) external view returns(uint32[] memory);

    function getActiveSubnetsOfNFT(
        uint256 nftID
    )
    external
    view
    returns (uint256[] memory);
}
