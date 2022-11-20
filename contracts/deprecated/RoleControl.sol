// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IERC721.sol";

contract RoleControl is AccessControlUpgradeable {

    IERC721 public NFT_Address;
    uint256 public NFTid;

    bytes32 public constant READ =
        keccak256("READ");
    bytes32 public constant DEPLOYER =
        keccak256("DEPLOYER");
    bytes32 public constant ACCESS_MANAGER =
        keccak256("ACCESS_MANAGER");
    bytes32 public constant BILLING_MANAGER =
        keccak256("BILLING_MANAGER");
    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");
   

    function initialize(
        IERC721 _NFT_Address,
        uint256 _NFTid,
        address _AdminAddress
    ) public initializer {
        __AccessControl_init_unchained();

        _grantRole(DEFAULT_ADMIN_ROLE, _AdminAddress);
        _grantRole(READ, _AdminAddress);
        _grantRole(DEPLOYER, _AdminAddress);
        _grantRole(ACCESS_MANAGER, _AdminAddress);
        _grantRole(BILLING_MANAGER, _AdminAddress);
        _grantRole(CONTRACT_BASED_DEPLOYER, _AdminAddress);

        NFT_Address = _NFT_Address;
        NFTid = _NFTid;
    }

    function grantRole(bytes32 role, address account) public virtual override isNFTOwner {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual override isNFTOwner {
        _revokeRole(role, account);
    }

    function NFTOwner() external view returns(address){
        return NFT_Address.ownerOf(NFTid);
    }

    function getBytes32OfRole(string memory _roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_roleName));
    }

    function hasRoleOf(string memory _roleName, address _account)         
        external
        view
        returns (bool)
    {
        return hasRole(keccak256(bytes(_roleName)),_account);
    }

    modifier isNFTOwner(){
        require(NFT_Address.ownerOf(NFTid)==_msgSender(),"Grant and Revoke role only allowed for NFT owner");
        _;
    }

}