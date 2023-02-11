// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

/**
 * @dev Required interface of an ERC721 compliant contract.
 */
interface IApplicationNFT is IERC721Upgradeable {

    function NFT_Address() external view returns(address);
    
    function getBytes32OfRole(string memory _roleName)
    external
    pure
    returns (bytes32);
    
    function hasRole(uint _appId, bytes32 role, address account) external view returns (bool);

}