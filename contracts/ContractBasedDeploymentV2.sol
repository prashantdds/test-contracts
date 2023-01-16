// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/IRoleControlV2.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IERC721.sol";
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
    ISubscription public Subscription;
    IERC721 AppNFT;

    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");

    struct Multihash {
        uint256 appID;
        string appName;
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
        uint256[][] subnetIdList;
        uint256[] resourceArray;
        string lastUpdatedTime;
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
        uint256[][] subnetIDList,
        uint256[] resourceArray,
        string lastUpdatedTime
    );

    event EntryDeleted(string indexed appName);

    function initialize(
        IRoleControlV2 _RoleControlV2,
        ISubscription _Subscription,
        IERC721 _AppNFT
    ) public initializer {
        RoleControlV2 = _RoleControlV2;
        Subscription = _Subscription;
        AppNFT = _AppNFT;
    }

    function getNFTAddress() external view returns (address) {
        return address(RoleControlV2.NFT_Address());
    }
    

        // address subscriber,
        // bool isExistingNFT,
        // uint256 _balanceToAdd,
        // uint256 _nftId,
        // uint256 _subnetId,
        // address _referralAddress,
        // address _licenseAddress,
        // address _supportAddress,
        // uint256 _licenseFee,
        // uint256[] memory _computeRequired


    /**
     * @dev associate a multihash entry to appName
     * @param _digest hash digest produced by hashing content using hash function
     * @param _hashFunction hashFunction code for the hash function used
     * @param _size length of the digest
     */

    function subscribeAndCreateData(
        uint256 _balanceToAdd,
        address[][] memory _rlsAddresses,
        uint256[] memory _licenseFee,
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size,
        uint256[][] memory _subnetIDList,
        uint256[] memory _resourceArray,
        string memory lastUpdatedTime
    ) external {
        require(_resourceArray.length > 0, "Resource array should have replica count and count of resource types");

        for(uint256 i = 0; i < _subnetIDList.length; i++)
        {
            require(_subnetIDList[i][0] <= _subnetIDList[i][1], "max replica count should be greater or equal to the min replica count");
        }

        uint256 nftID = AppNFT.getCurrentTokenId() + 1;


        entries[nftID][appName] = Multihash(
            lastAppId[nftID],
            appName,
            _digest,
            _hashFunction,
            _size,
            _subnetIDList,
            _resourceArray,
            lastUpdatedTime
        );
        
        appIDToName[nftID][lastAppId[nftID]] = appName;
        
        emit EntrySet(
            appName,
            lastAppId[nftID],
            _digest,
            _hashFunction,
            _size,
            _subnetIDList,
            _resourceArray,
            lastUpdatedTime
        );

        lastAppId[nftID] = lastAppId[nftID] + 1;

        subscribe(
            _balanceToAdd,
            _rlsAddresses,
            _licenseFee,
            _subnetIDList,
            _resourceArray
        );



        // ListenerContract.listen("ContractBasedDeployment", address(this), "createData", appName, _digest, _hashFunction, _size, _resourceArray);
    }

    function subscribe(
        uint256 _balanceToAdd,
        address[][] memory _rlsAddresses,
        uint256[] memory _licenseFee,
        uint256[][] memory _subnetIDList,
        uint256[] memory _resourceArray
    )
    internal
    {
        uint256[] memory subnetParamList = new uint256[](_subnetIDList.length);
        for(uint256 i = 0; i < _subnetIDList.length; i++)
        {
            subnetParamList[i] = _subnetIDList[i][2];
        }

        uint256[][] memory resourceParamList = new uint256[][] (_subnetIDList.length);
        for(uint256 i = 0; i < _subnetIDList.length; i++)
        {
            resourceParamList[i] = new uint256[] (_resourceArray.length);
            
            for(uint256 j = 0; j < _resourceArray.length; j++)
            {
                resourceParamList[i][j] = _resourceArray[j];
            }
            
        }

        Subscription.subscribeBatch(
            msg.sender,
            false,
            _balanceToAdd,
            0,
            subnetParamList,
            _rlsAddresses[0],
            _rlsAddresses[1],
            _rlsAddresses[2],
            _licenseFee,
            resourceParamList
        );
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
        uint256[][] memory _subnetIDList,
        uint256[] memory _resourceArray,
        string memory lastUpdatedTime
    ) external hasPermission(_nftId) {
        require(entries[_nftId][appName].digest == 0, "Already set");
        require(_resourceArray.length > 0, "Resource array should have replica count and count of resource types");

        for(uint256 i = 0; i < _subnetIDList.length; i++)
        {
            require(_subnetIDList[i][0] <= _subnetIDList[i][1], "max replica count should be greater or equal to the min replica count");
        }

        entries[_nftId][appName] = Multihash(
            lastAppId[_nftId],
            appName,
            _digest,
            _hashFunction,
            _size,
            _subnetIDList,
            _resourceArray,
            lastUpdatedTime
        );
        appIDToName[_nftId][lastAppId[_nftId]] = appName;
        emit EntrySet(
            appName,
            lastAppId[_nftId],
            _digest,
            _hashFunction,
            _size,
            _subnetIDList,
            _resourceArray,
            lastUpdatedTime
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
        uint256[][] memory _subnetIDList,
        uint256[] memory _resourceArray,
        string memory lastUpdatedTime
    ) external hasPermission(_nftId) {
        require(entries[_nftId][appName].digest != 0, "Already no data");
        require(_resourceArray.length > 0, "Resource array should have replica count and count of resource types");

        for(uint256 i = 0; i < _subnetIDList.length; i++)
        {
            require(_subnetIDList[i][0] <= _subnetIDList[i][1], "max replica count should be greater or equal to the min replica count");
        }

        uint256 appId = entries[_nftId][appName].appID;

        entries[_nftId][appName] = Multihash(
            appId,
            appName,
            _digest,
            _hashFunction,
            _size,
            _subnetIDList,
            _resourceArray,
            lastUpdatedTime
        );
        // resourceArray[appName] = _resourceArray;
        emit EntrySet(
            appName,
            appId,
            _digest,
            _hashFunction,
            _size,
            _subnetIDList,
            _resourceArray,
            lastUpdatedTime
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
            uint8 size,
            string memory lastUpdatedTime
        )
    {
        Multihash memory entry = entries[_nftId][appName];
        return (entry.digest, entry.hashFunction, entry.size, entry.lastUpdatedTime);
    }

    function getDataByNames(uint256 _nftId, string[] memory _appNames)
        public
        view
        returns (Multihash[] memory _entries)
    {
        _entries = new Multihash[](_appNames.length);
        for (uint256 i = 0; i < _appNames.length; i++){
            _entries[i] = entries[_nftId][_appNames[i]];
        }
    }

    function getFullData(uint256 _nftId, string memory appName)
        public
        view
        returns (
            bytes32 digest,
            uint8 hashfunction,
            uint8 size,
            uint256[][] memory subnetIDList,
            uint256[] memory resourceArray,
            string memory lastUpdatedTime
        )
    {
        Multihash memory entry = entries[_nftId][appName];
        return (
            entry.digest,
            entry.hashFunction,
            entry.size,
            entry.subnetIdList,
            entry.resourceArray,
            entry.lastUpdatedTime
        );
    }

    function getDataByIds(uint256 _nftId, uint256[] memory AppIds)
        public
        view
        returns (Multihash[] memory)
    {
        Multihash[] memory _entriesArr = new Multihash[](AppIds.length);
        for (uint256 i = 0; i < AppIds.length; i++){
            string memory appName = appIDToName[_nftId][AppIds[i]];
            _entriesArr[i] = entries[_nftId][appName];
        }
        return _entriesArr;
    }

    function getDataArray(uint256 _nftId)
        public
        view
        returns (Multihash[] memory)
    {
        Multihash[] memory _entriesArr = new Multihash[](lastAppId[_nftId]);
        for (uint256 i = 0; i < lastAppId[_nftId]; i++){
            string memory appName = appIDToName[_nftId][i];
            _entriesArr[i] = entries[_nftId][appName];
        }
        return _entriesArr;
    }

    modifier hasPermission(uint256 _nftId) {
        require(
            RoleControlV2.hasRole(_nftId, CONTRACT_BASED_DEPLOYER, msg.sender),
            "CONTRACT_BASED_DEPLOYER permission not there in RoleControlV2"
        );
        _;
    }
}
