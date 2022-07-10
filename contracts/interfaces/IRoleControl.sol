// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";

interface IRoleControl is IAccessControlUpgradeable{

    function NFT_Address() external view returns(address);
    function NFTid() external view returns(uint);
}