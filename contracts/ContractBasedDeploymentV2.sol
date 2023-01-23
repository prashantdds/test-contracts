// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/IRoleControlV2.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

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

    struct AppSubnet {
        // uint256 minReplica;
        // uint256 maxReplica;
        uint256[] currentMultiplier;
        uint256[][] replicaList;
        bool active;
    }

    struct Multihash {
        uint256 appID;
        string appName;
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
        uint256[] subnetList;
        uint256[] resourceArray;
        string lastUpdatedTime;
        bool cidLock;
    }

    // NFT id => App name => Multihash
    mapping(uint256 => mapping(string => Multihash)) public entries;

    mapping(uint256 => mapping(string => mapping(uint256 => AppSubnet))) appSubnets;

    // NFT id => App id => App name
    mapping(uint256 => string[]) public appIDToNameList;

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
        string lastUpdatedTime,
        bool cidLock
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

    function calcResourceAndSubscribe(
        uint256 balanceToAdd,
        uint256 nftID,
        string memory appName,
        address[][] memory rlsAddresses,
        uint256[] memory licenseFee,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory newResource
    )
    internal
    {
        uint256[] memory curResource = entries[nftID][appName].resourceArray;
        int256[][] memory resourceParamList = new int256[][] (subnetList.length);

        for(uint256 i = 0; i < subnetList.length; i++)
        {
            resourceParamList[i] = new int256[] (newResource.length);
            uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetList[i]].currentMultiplier;

            for(uint256 j = 0; j < currentMultiplier.length; j++)
            {
                resourceParamList[i][j] = (
                    (int256(multiplier[i][0][j]) * int256(newResource[j]))
                    - (int256(currentMultiplier[j]) * int256(curResource[j]))
                    );
            }
            
            for(uint256 j = currentMultiplier.length; j < newResource.length; j++)
            {
                resourceParamList[i][j] = int256(multiplier[i][0][j]) * int256(newResource[j]); 
            }
            
            appSubnets[nftID][appName][subnetList[i]].currentMultiplier = multiplier[i][0];
            appSubnets[nftID][appName][subnetList[i]].replicaList = multiplier[i];
        }


        Subscription.subscribeBatch(
            msg.sender,
            balanceToAdd,
            nftID,
            subnetList,
            rlsAddresses[0],
            rlsAddresses[1],
            rlsAddresses[2],
            licenseFee,
            resourceParamList
        );
    }

    function createApp(
        uint256 balanceToAdd,
        uint256 nftID,
        address[][] memory rlsAddresses,
        uint256[] memory licenseFee,
        string memory appName,
        bytes32 digest,
        uint8[] memory hashAndSize,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory resourceArray,
        string memory lastUpdatedTime,
        bool cidLock
    )
    external
    hasPermission(nftID)
    {
        require(entries[nftID][appName].digest == 0, "Data already set");
        require(resourceArray.length > 0, "Resource array should have replica count and count of resource types");

        require(subnetList.length == multiplier.length,
            "The number of entries in the multiplier should be of the same length of the subnet array");

        for(uint256 i = 0; i < subnetList.length; i++)
        {
            require(multiplier[i].length >= 1,
                "Multiplier should have atleast current replica counts");

            require(multiplier[i][0].length == resourceArray.length,
                "The number of replica values entered in the current replica array should be the same of the delta resource array length");
        }

        calcResourceAndSubscribe(
            balanceToAdd,
            nftID,
            appName,
            rlsAddresses,
            licenseFee,
            subnetList,
            multiplier,
            resourceArray
        );

        entries[nftID][appName] = Multihash(
            appIDToNameList[nftID].length,
            appName,
            digest,
            hashAndSize[0],
            hashAndSize[1],
            subnetList,
            resourceArray,
            lastUpdatedTime,
            cidLock
        );

        appIDToNameList[nftID].push(appName);
    }


    function updateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        address[][] memory rlsAddresses,
        uint256[] memory licenseFee,
        string memory appName,
        bytes32 digest,
        uint8[] memory hashAndSize,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory resourceArray,
        string memory lastUpdatedTime
    )
    external
    hasPermission(nftID)
    {
        require(entries[nftID][appName].digest != 0, "Already no data");
        require(resourceArray.length > 0, "Resource array should have replica count and count of resource types");

        if(entries[nftID][appName].cidLock)
        {
            require(
                entries[nftID][appName].digest == digest
                && entries[nftID][appName].hashFunction == hashAndSize[0]
                && entries[nftID][appName].size == hashAndSize[1]
                ,"The CID in this app is locked, and cannot be changed"
            );
        }

        require(subnetList.length == multiplier.length,
            "The number of entries in the multiplier should be of the same length of the subnet array");

        for(uint256 i = 0; i < subnetList.length; i++)
        {
            require(multiplier[i].length >= 1,
                "Multiplier should have atleast current replica counts");

            uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetList[i]].currentMultiplier;

            require(multiplier[i][0].length >= currentMultiplier.length,
                // "The number of replica values entered in the current replica array should be the same of the resource array length"
                "The number of replica values in replica array should be the greater than or equal to the count of existing replica values"
                );

            require(multiplier[i][0].length == currentMultiplier.length,
                "The number of replica values entered in the current replica array should be the same of the delta resource array length");
        }

        calcResourceAndSubscribe(
            balanceToAdd,
            nftID,
            appName,
            rlsAddresses,
            licenseFee,
            subnetList,
            multiplier,
            resourceArray
        );


        entries[nftID][appName] = Multihash(
            entries[nftID][appName].appID,
            appName,
            digest,
            hashAndSize[0],
            hashAndSize[1],
            subnetList,
            resourceArray,
            lastUpdatedTime,
            entries[nftID][appName].cidLock
        );
    }

    /**
     * @dev deassociate any multihash entry to appName
     */

    function deleteApp(uint256 nftID, string memory appName)
        external
        hasPermission(nftID)
    {
        require(entries[nftID][appName].digest != 0, "Already no data");

        uint256[] memory subnetList = entries[nftID][appName].subnetList;
        uint256 len = subnetList.length;
        uint256[] memory resourceArray = entries[nftID][appName].resourceArray;

        address[][] memory rlsAddresses = new address[][](3);

        for(uint i = 0; i < 3; i++)
        {
            rlsAddresses[i] = new address[](len);
        }

        uint256[] memory licenseFee = new uint256[](len);

        int256[][] memory resourceParamList = new int256[][] (len);
        for(uint256 i = 0; i < len; i++)
        {
            resourceParamList[i] = new int256[] (resourceArray.length );
            // uint256[][][] memory multiplier = entries[_nftId][appName].multiplier;

    // mapping(uint256 => mapping(string => mapping(uint256 => AppSubnet))) appSubnets;
            uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetList[i]].currentMultiplier;

            for(uint256 j = 0; j < resourceArray.length; j++)
            {
                resourceParamList[i][j] = -1 * int256(resourceArray[j]) * int256(currentMultiplier[j]);
            }   
        }

        Subscription.subscribeBatch(
            msg.sender,
            0,
            nftID,
            subnetList,
            rlsAddresses[0],
            rlsAddresses[1],
            rlsAddresses[2],
            licenseFee,
            resourceParamList
        );

        delete appIDToNameList[entries[nftID][appName].appID];
        
        delete entries[nftID][appName];
    
    //     emit EntryDeleted(appName);
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
            // uint256[][] memory subnetIDList,
            uint256[] memory resourceArray,
            string memory lastUpdatedTime,
            bool cidLock
        )
    {
        Multihash memory entry = entries[_nftId][appName];
        return (
            entry.digest,
            entry.hashFunction,
            entry.size,
            // entry.subnetIdList,
            entry.resourceArray,
            entry.lastUpdatedTime,
            entry.cidLock
        );
    }

    function getDataByIds(uint256 _nftId, uint256[] memory AppIds)
        public
        view
        returns (Multihash[] memory)
    {
        Multihash[] memory _entriesArr = new Multihash[](AppIds.length);
        for (uint256 i = 0; i < AppIds.length; i++){
            string memory appName = appIDToNameList[_nftId][AppIds[i]];
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
        for (uint256 i = 0; i < appIDToNameList[_nftId].length; i++){
            string memory appName = appIDToNameList[_nftId][i];
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
