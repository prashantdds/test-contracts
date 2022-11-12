// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/IRoleControl.sol";
import "./interfaces/IListener.sol";
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

    IListener public ListenerContract;

    struct Multihash {
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
    }

    mapping(string => Multihash) private entries;
    mapping(string => uint[]) private resourceArray;

    event EntrySet(
        string indexed appName,
        bytes32 digest,
        uint8 hashFunction,
        uint8 size,
        uint[] resourceArray
    );

    event EntryDeleted(string indexed appName);

    function initialize(IRoleControl _RoleControl, IListener _ListenerContract) public initializer {
        RoleControl = _RoleControl;
        ListenerContract = _ListenerContract;
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
        uint8 _size,
        uint[] memory _resourceArray
    ) external hasPermission {
        require(entries[appName].digest == 0, "Already set");
        Multihash memory entry = Multihash(_digest, _hashFunction, _size);
        entries[appName] = entry;
        resourceArray[appName] = _resourceArray;
        emit EntrySet(appName, _digest, _hashFunction, _size, _resourceArray);
        ListenerContract.listen("ContractBasedDeployment", address(this), "createData", appName, _digest, _hashFunction, _size, _resourceArray);
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
        uint8 _size,
        uint[] memory _resourceArray
    ) external hasPermission {
        require(entries[appName].digest != 0, "Already no data");
        Multihash memory entry = Multihash(_digest, _hashFunction, _size);
        entries[appName] = entry;
        resourceArray[appName] = _resourceArray;
        emit EntrySet(appName, _digest, _hashFunction, _size, _resourceArray);
        ListenerContract.listen("ContractBasedDeployment", address(this), "updateData", appName, _digest, _hashFunction, _size, _resourceArray);
    }

    /**
     * @dev deassociate any multihash entry to appName
     */
    function deleteData(string memory appName) external hasPermission {
        require(entries[appName].digest != 0, "Already no data");
        delete entries[appName];
        delete resourceArray[appName];
        emit EntryDeleted(appName);
        ListenerContract.listen("ContractBasedDeployment", address(this), "deleteData", appName);
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
        Multihash memory entry = entries[appName];
        return (entry.digest, entry.hashFunction, entry.size);
    }

    /**
     * @dev retrieve full data with an appName
     * @param appName name of app used as key
     */
    function getFullData(string memory appName)
        public
        view
        returns (
            bytes32 digest,
            uint8 hashfunction,
            uint8 size,
            uint[] memory _resourceArray
        )
    {
        Multihash memory entry = entries[appName];
        return (entry.digest, entry.hashFunction, entry.size, resourceArray[appName]);
    }

    modifier hasPermission() {
        require(
            RoleControl.hasRole(CONTRACT_BASED_DEPLOYER, msg.sender),
            "CONTRACT_BASED_DEPLOYER permission not there in RoleControl"
        );
        _;
    }
}
