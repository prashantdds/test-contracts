// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IListener {
    function listen(
        string memory _contractName, 
        address _contractAddress, 
        string memory _functionName, 
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size,
        uint[] memory _resourceArray
    ) external returns (bool);

    function listen(
        string memory _contractName, 
        address _contractAddress, 
        string memory _functionName, 
        string memory appName
    ) external returns (bool);

}
