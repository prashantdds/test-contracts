// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IRoleControlV2{
    function NFT_Address() external view returns(address);
    function hasRole(uint _appId, bytes32 role, address account) external view returns (bool);
}