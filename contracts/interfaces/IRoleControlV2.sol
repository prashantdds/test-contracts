// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IRoleControlV2{
    function NFT_Address() external view returns(address);
    function getBytes32OfRole(string memory _roleName)
    external
    pure
    returns (bytes32);
    function hasRole(uint _appId, bytes32 role, address account) external view returns (bool);
}