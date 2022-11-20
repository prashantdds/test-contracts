// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/IERC721.sol";
import "./MultiAccessControlUpgradeable.sol";

contract RoleControlV2 is MultiAccessControlUpgradeable {
    IERC721 public NFT_Address;

    bytes32 public constant READ = keccak256("READ");
    bytes32 public constant DEPLOYER = keccak256("DEPLOYER");
    bytes32 public constant ACCESS_MANAGER = keccak256("ACCESS_MANAGER");
    bytes32 public constant BILLING_MANAGER = keccak256("BILLING_MANAGER");
    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");

    function initialize(IERC721 _NFT_Address) public initializer {
        __AccessControl_init_unchained();
        NFT_Address = _NFT_Address;
    }

    function grantRole(
        uint256 _nftId,
        bytes32 role,
        address account
    ) public virtual override isNFTOwner(_nftId) {
        _grantRole(_nftId, role, account);
    }

    function revokeRole(
        uint256 _nftId,
        bytes32 role,
        address account
    ) public virtual override isNFTOwner(_nftId) {
        _revokeRole(_nftId, role, account);
    }

    function NFTOwner(uint256 _nftId) external view returns (address) {
        return NFT_Address.ownerOf(_nftId);
    }

    function getBytes32OfRole(string memory _roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_roleName));
    }

    function hasRoleOf(
        uint256 _nftId,
        string memory _roleName,
        address _account
    ) external view returns (bool) {
        return hasRole(_nftId, keccak256(bytes(_roleName)), _account);
    }

    modifier isNFTOwner(uint256 _nftId) {
        require(
            NFT_Address.ownerOf(_nftId) == _msgSender(),
            "Grant and Revoke role only allowed for NFT owner"
        );
        _;
    }
}
