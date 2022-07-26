// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/IBridge.sol";
import "./TokensRecoverableOwner.sol";

contract LinkNFTs is TokensRecoverableOwner {
    IERC721 public App_NFT_Address;

    // Custom NFT address => Custom NFT id => App NFT id
    mapping(address => mapping(uint256 => uint256[])) public links;

    // App NFT id => true if linked
    mapping(uint256 => bool) public isLinked;
    mapping(address => mapping(uint256 => mapping(uint256=>bool))) public isLinkedTo;

    function initialize(IERC721 _App_NFT_Address) public initializer {
        __Ownable_init_unchained();
        App_NFT_Address = _App_NFT_Address;
    }

    function getAllLinks(address customNFTAddress, uint256 customNFTid)
        external
        view
        returns (uint256[] memory)
    {
        return links[customNFTAddress][customNFTid];
    }

    function getChainId() external view returns(uint){
        return block.chainid;
    }

    function linkTo(
        uint256 AppNFTid,
        address CustomNFTAddress,
        uint256 CustomNFTid
    ) external {
        require(!isLinked[AppNFTid], "AppNFTid already linked");
        require(
            IERC721(CustomNFTAddress).ownerOf(CustomNFTid) == msg.sender &&
                App_NFT_Address.ownerOf(AppNFTid) == msg.sender,
            "CustomNFTid or AppNFTid not owned"
        );
        address childAddress;
        if (block.chainid != 31337)
            // chain id of hardhat should be replaced by chainid of StackOS
            childAddress = IBridge(CustomNFTAddress).rootToChildToken(
                CustomNFTAddress
            );
        else childAddress = CustomNFTAddress;

        links[childAddress][CustomNFTid].push(AppNFTid);
        isLinked[AppNFTid] = true;
        isLinkedTo[childAddress][CustomNFTid][AppNFTid] = true;

        App_NFT_Address.safeTransferFrom(
            msg.sender,
            address(this),
            AppNFTid,
            "0x"
        );
    }

    function onERC721Received(
        address _operator,
        address _from,
        uint256 _id,
        bytes calldata _data
    ) external returns (bytes4) {
        return 0x150b7a02;
    }
}
