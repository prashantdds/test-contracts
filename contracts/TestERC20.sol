// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract TestERC20 is
    ERC20Upgradeable
{
    function initialize() public initializer {
        __ERC20_init_unchained("TestERC20", "TERC20");
        _mint(msg.sender, 100000000000 ether);
    }
}
