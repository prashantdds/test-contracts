// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/IRoleControlV2.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Stores IPFS (multihash) hash by address. A multihash entry is in the format
 * of <varint hash function code><varint digest size in bytes><hash function output>
 * Referred from https://github.com/saurfang/ipfs-multihash-on-solidity
 *
 * Currently IPFS hash is 34 bytes long with first two segments represented as a single byte (uint8)
 * The digest is 32 bytes long and can be stored using bytes32 efficiently.
 */
contract ContractBasedDeploymentV2 is Initializable {
    IRoleControlV2 public RoleControlV2;
    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");

    struct Multihash {
        uint256 appID;
        string appName;
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
        uint256[] resourceArray;
    }

    // NFT id => App name => Multihash
    mapping(uint256 => mapping(string => Multihash)) public entries;

    // NFT id => App id => App name
    mapping(uint256 => mapping(uint256 => string)) public appIDToName;

    // NFT id => app id counter
    mapping(uint256 => uint256) lastAppId;

    event EntrySet(
        string indexed appName,
        uint256 appId,
        bytes32 digest,
        uint8 hashFunction,
        uint8 size,
        uint256[] resourceArray
    );

    event EntryDeleted(string indexed appName);

    function initialize(IRoleControlV2 _RoleControlV2) public initializer {
        RoleControlV2 = _RoleControlV2;
    }

    function getNFTAddress() external view returns (address) {
        return address(RoleControlV2.NFT_Address());
    }

    /**
     * @dev associate a multihash entry to appName
     * @param _digest hash digest produced by hashing content using hash function
     * @param _hashFunction hashFunction code for the hash function used
     * @param _size length of the digest
     */
    function createData(
        uint256 _nftId,
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size,
        uint256[] memory _resourceArray
    ) external hasPermission(_nftId) {
        require(entries[_nftId][appName].digest == 0, "Already set");
        entries[_nftId][appName] = Multihash(
            lastAppId[_nftId],
            appName,
            _digest,
            _hashFunction,
            _size,
            _resourceArray
        );
        appIDToName[_nftId][lastAppId[_nftId]] = appName;
        emit EntrySet(
            appName,
            lastAppId[_nftId],
            _digest,
            _hashFunction,
            _size,
            _resourceArray
        );
        lastAppId[_nftId] = lastAppId[_nftId] + 1;
        // ListenerContract.listen("ContractBasedDeployment", address(this), "createData", appName, _digest, _hashFunction, _size, _resourceArray);
    }

    /**
     * @dev associate a multihash entry to appName
     * @param _digest hash digest produced by hashing content using hash function
     * @param _hashFunction hashFunction code for the hash function used
     * @param _size length of the digest
     */
    function updateData(
        uint256 _nftId,
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size,
        uint256[] memory _resourceArray
    ) external hasPermission(_nftId) {
        require(entries[_nftId][appName].digest != 0, "Already no data");
        uint256 appId = entries[_nftId][appName].appID;
        entries[_nftId][appName] = Multihash(
            appId,
            appName,
            _digest,
            _hashFunction,
            _size,
            _resourceArray
        );
        // resourceArray[appName] = _resourceArray;
        emit EntrySet(
            appName,
            appId,
            _digest,
            _hashFunction,
            _size,
            _resourceArray
        );
        // ListenerContract.listen("ContractBasedDeployment", address(this), "updateData", appName, _digest, _hashFunction, _size, _resourceArray);
    }

    /**
     * @dev deassociate any multihash entry to appName
     */
    function deleteData(uint256 _nftId, string memory appName)
        external
        hasPermission(_nftId)
    {
        require(entries[_nftId][appName].digest != 0, "Already no data");
        delete entries[_nftId][appName];
        emit EntryDeleted(appName);
        // ListenerContract.listen("ContractBasedDeployment", address(this), "deleteData", appName);
    }

    /**
     * @dev retrieve multihash entry associated with an appName
     * @param appName name of app used as key
     */
    function getData(uint256 _nftId, string memory appName)
        public
        view
        returns (
            bytes32 digest,
            uint8 hashfunction,
            uint8 size
        )
    {
        Multihash memory entry = entries[_nftId][appName];
        return (entry.digest, entry.hashFunction, entry.size);
    }

    function getDataByNames(uint256 _nftId, string[] memory _appNames)
        public
        view
        returns (Multihash[] memory _entries)
    {
        for (uint256 i = 0; i < _appNames.length; i++) {
            Multihash memory entry = entries[_nftId][_appNames[i]];
            _entries[i] = (entry);
        }
    }

    function getFullData(uint256 _nftId, string memory appName)
        public
        view
        returns (
            bytes32 digest,
            uint8 hashfunction,
            uint8 size,
            uint256[] memory _resourceArray
        )
    {
        Multihash memory entry = entries[_nftId][appName];
        return (
            entry.digest,
            entry.hashFunction,
            entry.size,
            entry.resourceArray
        );
    }

    function getDataByIds(uint256 _nftId, uint256[] memory AppIds)
        public
        view
        returns (Multihash[] memory _entries)
    {
        for (uint256 i = 0; i < AppIds.length; i++)
            _entries[i] = (entries[_nftId][(appIDToName[_nftId][AppIds[i]])]);
        return _entries;
    }

    function getDataArray(uint256 _nftId)
        public
        view
        returns (Multihash[] memory _entries)
    {
        for (uint256 i = 0; i < lastAppId[_nftId]; i++)
            _entries[i] = (entries[_nftId][(appIDToName[_nftId][i])]);
        return _entries;
    }

    modifier hasPermission(uint256 _nftId) {
        require(
            RoleControlV2.hasRole(_nftId, CONTRACT_BASED_DEPLOYER, msg.sender),
            "CONTRACT_BASED_DEPLOYER permission not there in RoleControlV2"
        );
        _;
    }
}
