// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";

contract TestXCTERC20 is
    ERC20Upgradeable, AccessControlUpgradeable, ERC20BurnableUpgradeable

{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function initialize() public initializer {
        __ERC20_init_unchained("TestXCTERC20", "TXCTERC20");
        __AccessControl_init_unchained();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE){
        _mint(to, amount);
    }
}
