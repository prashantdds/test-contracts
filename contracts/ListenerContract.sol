// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ListenerContract is Initializable {

    event SetData(
        string _contractName, 
        address _contractAddress, 
        string  _functionName, 
        string  appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size,
        uint[] _resourceArray);

    event DeleteData(
        string  _contractName, 
        address _contractAddress, 
        string  _functionName, 
        string  appName);

    function initialize() public initializer {
    }

    function listen(
        string memory _contractName, 
        address _contractAddress, 
        string memory _functionName, 
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size,
        uint[] memory _resourceArray)
        external
        returns (bool)
    {
        emit SetData(_contractName, _contractAddress, _functionName, appName, _digest, _hashFunction, _size, _resourceArray);
        return true;
    }

    function listen(
        string memory _contractName, 
        address _contractAddress, 
        string memory _functionName, 
        string memory appName)
        external
        returns (bool)
    {
        emit DeleteData(_contractName, _contractAddress, _functionName, appName);
        return true;
    }
}