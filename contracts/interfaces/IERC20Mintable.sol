// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IERC20Mintable is IERC20Upgradeable{
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
}