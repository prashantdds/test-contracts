// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface ILinkContract {

    function isLinkedTo(
        address customNFTcontract,
        uint customNFTid,
        uint NFTid
    ) external view returns (bool);

}
