// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IBridge {

    function rootToChildToken(
        address rootAddress
    ) external view returns (address);
}
