// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/IRoleControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Stores IPFS (multihash) hash by address. A multihash entry is in the format
 * of <varint hash function code><varint digest size in bytes><hash function output>
 * Referred from https://github.com/saurfang/ipfs-multihash-on-solidity
 *
 * Currently IPFS hash is 34 bytes long with first two segments represented as a single byte (uint8)
 * The digest is 32 bytes long and can be stored using bytes32 efficiently.
 */
contract ContractBasedDeployment is Initializable {
    IRoleControl public RoleControl;
    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");

    struct Multihash {
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
    }

    mapping(string => Multihash) private entries;

    event EntrySet(
        string indexed appName,
        bytes32 digest,
        uint8 hashFunction,
        uint8 size
    );

    event EntryDeleted(string indexed appName);

    function initialize(IRoleControl _RoleControl) public initializer {
        RoleControl = _RoleControl;
    }

    function getNFTAddress() external view returns (address) {
        return address(RoleControl.NFT_Address());
    }

    function getNFTId() external view returns (uint256) {
        return RoleControl.NFTid();
    }

    /**
     * @dev associate a multihash entry to appName
     * @param _digest hash digest produced by hashing content using hash function
     * @param _hashFunction hashFunction code for the hash function used
     * @param _size length of the digest
     */
    function createData(
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size
    ) external hasPermission {
        require(entries[appName].digest == 0, "Already set");
        Multihash memory entry = Multihash(_digest, _hashFunction, _size);
        entries[appName] = entry;
        emit EntrySet(appName, _digest, _hashFunction, _size);
    }

    /**
     * @dev associate a multihash entry to appName
     * @param _digest hash digest produced by hashing content using hash function
     * @param _hashFunction hashFunction code for the hash function used
     * @param _size length of the digest
     */
    function updateData(
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size
    ) external hasPermission {
        require(entries[appName].digest != 0, "Already no data");
        Multihash memory entry = Multihash(_digest, _hashFunction, _size);
        entries[appName] = entry;
        emit EntrySet(appName, _digest, _hashFunction, _size);
    }

    /**
     * @dev deassociate any multihash entry to appName
     */
    function deleteData(string memory appName) external hasPermission {
        require(entries[appName].digest != 0, "Already no data");
        delete entries[appName];
        emit EntryDeleted(appName);
    }

    /**
     * @dev retrieve multihash entry associated with an appName
     * @param appName name of app used as key
     */
    function getData(string memory appName)
        public
        view
        returns (
            bytes32 digest,
            uint8 hashfunction,
            uint8 size
        )
    {
        Multihash storage entry = entries[appName];
        return (entry.digest, entry.hashFunction, entry.size);
    }

    modifier hasPermission() {
        require(
            RoleControl.hasRole(CONTRACT_BASED_DEPLOYER, msg.sender),
            "CONTRACT_BASED_DEPLOYER permission not there in RoleControl"
        );
        _;
    }
}
