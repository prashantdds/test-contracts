// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract TokensRecoverableOwner is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function recoverTokens(IERC20Upgradeable token) public onlyOwner  {
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }

    function recoverERC1155(IERC1155Upgradeable token, uint256 tokenId, uint256 amount) public onlyOwner  
    {        
        token.safeTransferFrom(address(this),msg.sender,tokenId,amount,"0x");
    }

    function recoverERC721(IERC721Upgradeable token, uint256 tokenId) public onlyOwner 
    {        
        token.safeTransferFrom(address(this),msg.sender,tokenId);
    }

    function recoverETH(uint256 amount) public onlyOwner  {
        payable(msg.sender).transfer(amount);
    }

}
