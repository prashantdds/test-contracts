// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./interfaces/ISubscription.sol";
import "./interfaces/IApplicationNFT.sol";
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
    ISubscription public Subscription;
    IApplicationNFT AppNFT;

    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");

    struct AppSubnet {
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
        bool noDeploy;
    }

    struct AppWithMultiplier
    {
        Multihash app;
        AppSubnet[] appSubnets;
    }

    // NFT id => App name => Multihash
    mapping(uint256 => mapping(string => Multihash)) public entries;

    mapping(uint256 => mapping(string => mapping(uint256 => AppSubnet))) public appSubnets;

    // NFT id => App id => App name
    mapping(uint256 => string[]) public appIDToNameList;


    event CreateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        address[] rlsAddresses,
        uint256[] licenseFactor,
        string appName,
        bytes32 digest,
        uint8[] hashAndSize,
        uint256[] subnetList,
        uint256[][][] multiplier,
        uint256[] resourceArray,
        string lastUpdatedTime,
        bool cidLock,
        bool noDeploy
    );

    event UpdateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        string appName,
        bytes32 digest,
        uint8[] hashAndSize,
        uint256[] subnetList,
        uint256[][][] multiplier,
        uint256[] resourceArray,
        string lastUpdatedTime,
        bool noDeploy
    );

    event EntryDeleted(uint256 nftID, string appName);

    function initialize(
        ISubscription _Subscription,
        IApplicationNFT _AppNFT
    ) public initializer {
        Subscription = _Subscription;
        AppNFT = _AppNFT;
    }

    function calculateResource(
        uint256 nftID,
        string memory appName,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory newResource,
        bool noDeploy
    )
    internal
    returns (int256[][] memory)
    {
        uint256[] memory curResource = entries[nftID][appName].resourceArray;
        int256[][] memory resourceParamList = new int256[][] (subnetList.length);

        if(entries[nftID][appName].noDeploy != noDeploy)
        {
            if(noDeploy)
            {
                for(uint256 i = 0; i < subnetList.length; i++)
                {
                    resourceParamList[i] = new int256[] (newResource.length);
                    uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetList[i]].currentMultiplier;
                    bool isActive = appSubnets[nftID][appName][subnetList[i]].active;

                    for(uint256 j = 0; j < currentMultiplier.length; j++)
                    {
                        resourceParamList[i][j] = (
                            - (int256(currentMultiplier[j]) * int256(curResource[j]))
                            );
                    }

                    appSubnets[nftID][appName][subnetList[i]].currentMultiplier = multiplier[i][0];
                    appSubnets[nftID][appName][subnetList[i]].replicaList = multiplier[i];

                    if(!isActive)
                    {
                        entries[nftID][appName].subnetList.push(subnetList[i]);
                        appSubnets[nftID][appName][subnetList[i]].active = true;
                    }
                }
            }
            else {
                for(uint256 i = 0; i < subnetList.length; i++)
                {
                    resourceParamList[i] = new int256[] (newResource.length);
                    uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetList[i]].currentMultiplier;
                    bool isActive = appSubnets[nftID][appName][subnetList[i]].active;

                    for(uint256 j = 0; j < newResource.length; j++)
                    {
                        resourceParamList[i][j] =
                            (int256(multiplier[i][0][j]) * int256(newResource[j]));
                    }

                    appSubnets[nftID][appName][subnetList[i]].currentMultiplier = multiplier[i][0];
                    appSubnets[nftID][appName][subnetList[i]].replicaList = multiplier[i];

                    if(!isActive)
                    {
                        entries[nftID][appName].subnetList.push(subnetList[i]);
                        appSubnets[nftID][appName][subnetList[i]].active = true;
                    }
                }
            }
        }
        else {
            if(!noDeploy)
            {
                for(uint256 i = 0; i < subnetList.length; i++)
                {
                    resourceParamList[i] = new int256[] (newResource.length);
                    uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetList[i]].currentMultiplier;
                    bool isActive = appSubnets[nftID][appName][subnetList[i]].active;
        
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

                    if(!isActive)
                    {
                        entries[nftID][appName].subnetList.push(subnetList[i]);
                        appSubnets[nftID][appName][subnetList[i]].active = true;
                    }
                }
            }
            else {
                for(uint256 i = 0; i < subnetList.length; i++)
                {
                    resourceParamList[i] = new int256[] (newResource.length);
                }
            }
        }


        return resourceParamList;
    }

    function calcResourceAndSubscribe(
        uint256 balanceToAdd,
        uint256 nftID,
        string memory appName,
        address[] memory rlsAddresses,
        uint256[] memory licenseFactor,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory newResource,
        bool noDeploy
    )
    internal
    {

        int256[][] memory resourceParamList = calculateResource(
            nftID,
            appName,
            subnetList,
            multiplier,
            newResource,
            noDeploy
        );

        Subscription.subscribeBatch(
            msg.sender,
            balanceToAdd,
            nftID,
            subnetList,
            rlsAddresses[0],
            rlsAddresses[1],
            rlsAddresses[2],
            rlsAddresses[3],
            licenseFactor,
            resourceParamList
        );
    }

    function createApp(
        uint256 balanceToAdd,
        uint256 nftID,
        address[] memory rlsAddresses,
        uint256[] memory licenseFactor,
        string memory appName,
        bytes32 digest,
        uint8[] memory hashAndSize,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory resourceArray,
        string memory lastUpdatedTime,
        bool[] memory cidLockAndNoDeploy
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
            licenseFactor,
            subnetList,
            multiplier,
            resourceArray,
            cidLockAndNoDeploy[1]
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
            cidLockAndNoDeploy[0],
            cidLockAndNoDeploy[1]
        );

        appIDToNameList[nftID].push(appName);

        emit CreateApp(
        balanceToAdd,
        nftID,
        rlsAddresses,
        licenseFactor,
        appName,
        digest,
        hashAndSize,
        subnetList,
        multiplier,
        resourceArray,
        lastUpdatedTime,
        cidLockAndNoDeploy[0],
        cidLockAndNoDeploy[1]
        );
    }


    function updateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        string memory appName,
        bytes32 digest,
        uint8[] memory hashAndSize,
        uint256[] memory subnetList,
        uint256[][][] memory multiplier,
        uint256[] memory resourceArray,
        string memory lastUpdatedTime,
        bool noDeploy
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
                "The number of replica values in replica array should be the greater than or equal to the count of existing replica values"
                );

            require(multiplier[i][0].length == resourceArray.length,
                "The number of replica values entered in the current replica array should be the same of the delta resource array length"
                );
        }
        
        int256[][] memory resourceParamList = calculateResource(
            nftID,
            appName,
            subnetList,
            multiplier,
            resourceArray,
            noDeploy
        );


        Subscription.subscribeToSubnetList(
            msg.sender,
            balanceToAdd,
            nftID,
            subnetList,
            resourceParamList
        );

        entries[nftID][appName].digest = digest;
        entries[nftID][appName].hashFunction = hashAndSize[0];
        entries[nftID][appName].size = hashAndSize[1];
        entries[nftID][appName].resourceArray = resourceArray;
        entries[nftID][appName].lastUpdatedTime = lastUpdatedTime;
        entries[nftID][appName].noDeploy = noDeploy;

        emit UpdateApp(
        balanceToAdd,
         nftID,
        appName,
        digest,
        hashAndSize,
        subnetList,
        multiplier,
        resourceArray,
        lastUpdatedTime,
        noDeploy
        );
    }

    /**
     * @dev deassociate any multihash entry to appName
     */

    function deleteApp(uint256 nftID, string memory appName)
        external
        hasPermission(nftID)
    {
        uint256[] memory emptyArray = new uint256[](0);
        require(entries[nftID][appName].digest != 0, "Already no data");

        uint256[] memory subnetList = entries[nftID][appName].subnetList;
        uint256 len = subnetList.length;
        uint256[] memory resourceArray = entries[nftID][appName].resourceArray;
        address nullAddress = address(0);

        int256[][] memory resourceParamList = new int256[][] (len);
        for(uint256 i = 0; i < len; i++)
        {
            uint256 subnetID = subnetList[i];
            resourceParamList[i] = new int256[] (resourceArray.length );

            uint256[] memory currentMultiplier = appSubnets[nftID][appName][subnetID].currentMultiplier;

            for(uint256 j = 0; j < resourceArray.length; j++)
            {
                resourceParamList[i][j] = -1 * int256(resourceArray[j]) * int256(currentMultiplier[j]);
            }

            delete appSubnets[nftID][appName][subnetID].currentMultiplier;
            delete appSubnets[nftID][appName][subnetID].replicaList;
            delete appSubnets[nftID][appName][subnetID];
        }

        Subscription.subscribeBatch(
            msg.sender,
            0,
            nftID,
            subnetList,
            nullAddress,
            nullAddress,
            nullAddress,
            nullAddress,
            emptyArray,
            resourceParamList
        );

        delete appIDToNameList[nftID][entries[nftID][appName].appID];
        
        delete entries[nftID][appName];
    
        emit EntryDeleted(nftID, appName);
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


    function getFullData(uint256 nftID, string memory appName)
        public
        view
        returns (
            AppWithMultiplier memory
        )
    {
        AppWithMultiplier memory fullAppData;
        fullAppData.app = entries[nftID][appName];

        uint256[] memory subnetList = entries[nftID][appName].subnetList;

        AppSubnet[] memory entryAppSubnets = new AppSubnet[](subnetList.length);

        for(uint j = 0; j < subnetList.length; j++)
        {
            entryAppSubnets[j] = appSubnets[nftID][appName][subnetList[j]];
        }
        fullAppData.appSubnets = entryAppSubnets;

        return fullAppData;
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
        returns (AppWithMultiplier[] memory)
    {
        AppWithMultiplier[] memory _entriesArr = new AppWithMultiplier[](appIDToNameList[_nftId].length);
        for (uint256 i = 0; i < appIDToNameList[_nftId].length; i++){
            string memory appName = appIDToNameList[_nftId][i];
            _entriesArr[i].app = entries[_nftId][appName];

            uint256[] memory subnetIds = entries[_nftId][appName].subnetList;
            AppSubnet[] memory entryAppSubnets = new AppSubnet[](subnetIds.length);

            for(uint j = 0; j < subnetIds.length; j++)
            {
                entryAppSubnets[j] = appSubnets[_nftId][appName][subnetIds[j]];
            }

            _entriesArr[i].appSubnets = entryAppSubnets;
        }
        return _entriesArr;
    }

    modifier hasPermission(uint256 _nftId) {
        require(
            AppNFT.ownerOf(_nftId) == msg.sender
            || AppNFT.hasRole(_nftId, CONTRACT_BASED_DEPLOYER, msg.sender),
            "Sender does not have CONTRACT_BASED_DEPLOYER role for the AppNFT"
        );
        _;
    }
}
