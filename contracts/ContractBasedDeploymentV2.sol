// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "./interfaces/ISubscription.sol";
import "./interfaces/IApplicationNFT.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "./interfaces/IRegistration.sol";

/**
 * @dev Stores IPFS (multihash) hash by address. A multihash entry is in the format
 * of <varint hash function code><varint digest size in bytes><hash function output>
 * Referred from https://github.com/saurfang/ipfs-multihash-on-solidity
 *
 * Currently IPFS hash is 34 bytes long with first two segments represented as a single byte (uint8)
 * The digest is 32 bytes long and can be stored using bytes32 efficiently.
 */
contract ContractBasedDeploymentV2 is OwnableUpgradeable {
    ISubscription public Subscription;
    ISubscriptionBalance public SubscriptionBalance;
    IApplicationNFT AppNFT;
    IRegistration Registration;


    bytes32 public constant DEPLOYER =
        keccak256("DEPLOYER");
        

    struct Multihash {
        bytes32 appName;
        uint256 timestamp;
        bytes32 digest;
        uint16[] resourceArray;
        uint8 hashFunction;
        uint8 size;
        bool cidLock;
        bool active;
    }

    struct SubnetEntryID {
        uint8 entryID;
        uint8 appCount;
    }

    struct FullAppData {
        uint256 appID;
        uint256[] subnetList;
        uint8[][] currentReplica;
        Multihash app;
    }

    mapping(uint256 => mapping(uint256 => Multihash)) public entries;
    mapping(uint256 => mapping(uint256 => mapping(uint256 => uint8[]))) public appCurrentReplica;
    mapping(uint256 => mapping(uint256 => uint256)) public appSubnetBitmap;
    mapping(uint256 => mapping(bytes32 => bool)) appNameCheck;

    mapping(uint256 => mapping(uint256 => uint32[])) public nftSubnetResource;
    mapping(uint256 => mapping(uint256 => SubnetEntryID)) public nftSubnetEntry;

    mapping(uint256 => uint256) public nftActiveSubnetCheck;
    mapping(uint256 => uint256[]) public nftAllSubnets;
    mapping(uint256 => uint16) public nftAppCount;
    mapping(uint256 => bool) nftSubnetLock;

    mapping(uint256 => uint256) public lastAppID;

    event CreateApp(
        uint256 nftID,
        uint256 appID,
        bytes32 appName,
        bytes32 digest,
        uint8[2] hashAndSize,
        uint256[] subnetList,
        uint8[][] multiplier,
        uint16[] resourceArray,
        bool cidLock
        );

    event CreateAppBatch(
        uint256 nftID,
        uint256[] appID,
        bytes32[] appName,
        bytes32[] digest,
        uint8[2][] hashAndSize,
        uint256[][] subnetList,
        uint8[][][] multiplier,
        uint16[][] resourceArray,
        bool[] cidLock
    );

    event UpdateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        uint256 appID,
        bytes32 appName,
        bytes32 digest,
        uint8[] hashAndSize,
        uint256[] subnetList,
        uint8[][] multiplier,
        uint16[] resourceArray
    );

    event UpdateCID(
        uint256 nftID,
        uint256 appID,
        bytes32 digest,
        uint8 hashFunction,
        uint8 size
    );

    event UpdateResource(
        uint256 nftID,
        uint256 appID,
        uint256[] subnetList,
        uint8[][] currentReplicaList,
        uint16[] resource
    );

    event DeleteApp(uint256 nftID, uint256 appID);

    function initialize(
        ISubscription _Subscription,
        IApplicationNFT _AppNFT,
        ISubscriptionBalance _SubscriptionBalance,
        IRegistration _Registration
    ) public initializer {
        __Ownable_init();
        Subscription = _Subscription;
        SubscriptionBalance = _SubscriptionBalance;
        AppNFT = _AppNFT;
        Registration = _Registration;

    }

    function setParamSubnetResource(
        uint256 nftID,
        uint256 appID,
        uint256 subnetID,
        uint16[] memory curResource,
        uint16[] memory newResource,
        uint8[] memory newMul
    )
    internal
    {
        uint256 subLen = nftSubnetResource[nftID][subnetID].length;
        uint8[] memory oldMul = appCurrentReplica[nftID][appID][subnetID];

        require(newMul.length == newResource.length, "replica resource size mismatch");

        uint256 maxlen;
        if(newResource.length > oldMul.length) {
            maxlen = oldMul.length;
        }
        else {
            maxlen = newResource.length;
        }


        for(uint i; i < maxlen;)
        {
            uint32 val = nftSubnetResource[nftID][subnetID][i];
            uint32 oldVal = val;

            val -= (uint32(oldMul[i]) * curResource[i]);
            val += (uint32(newMul[i]) * newResource[i]);


            if(oldVal != val)
                nftSubnetResource[nftID][subnetID][i] = val;

            if(oldMul[i] != newMul[i])
            {
                appCurrentReplica[nftID][appID][subnetID][i] = newMul[i];
            }

            unchecked {
                ++i;
            }
        }
        
        for(uint i = maxlen; i < subLen;)
        {
            if(newMul[i] == 0 || newResource[i] == 0)
            {
                unchecked {
                    ++i;
                }
                continue;
            }

            nftSubnetResource[nftID][subnetID][i] += (uint32(newMul[i]) * newResource[i]);

            unchecked {
                ++i;
            }
        }

        for(uint i = subLen; i < newResource.length;)
        {
            if(newMul[i] == 0 || newResource[i] == 0)
            {
                nftSubnetResource[nftID][subnetID].push(0);
                unchecked {
                    ++i;
                }
                continue;
            }

            nftSubnetResource[nftID][subnetID].push(uint32(newMul[i]) * newResource[i]);

            unchecked {
                ++i;
            }
        }

        appCurrentReplica[nftID][appID][subnetID] = newMul;
    }

    function setNonParamSubnetResource(
        uint256 nftID,
        uint256 appID,
        uint256 subnetID,
        uint16[] memory curResource,
        uint16[] memory newResource
    )
    internal
    {
        uint256 maxlen = nftSubnetResource[nftID][subnetID].length;
        uint8[] memory oldMul = appCurrentReplica[nftID][appID][subnetID];
        uint32[] memory subnetResource;

        if(maxlen > newResource.length)
        {
            subnetResource = new uint32[](maxlen);
        }
        else {
            subnetResource = new uint32[](newResource.length);
        }

        for(uint i = 0; i < maxlen;)
        {
            subnetResource[i] = nftSubnetResource[nftID][subnetID][i];

            unchecked {
                ++i;
            }
        }

        if(newResource.length > oldMul.length) {
            maxlen = oldMul.length;
        }
        else {
            maxlen = newResource.length;
        }
    
        for(uint i; i < maxlen;)
        {
            uint32 val = subnetResource[i];

            val -= (uint32(oldMul[i]) * curResource[i]);
            val += (uint32(oldMul[i]) * newResource[i]);

            subnetResource[i] = val;

            unchecked {
                ++i;
            }
        }

        nftSubnetResource[nftID][subnetID] = subnetResource;
    }


    function removeSubnet(
        uint256 nftID,
        uint256 appID,
        bool deleteCurrentReplica
    )
    internal
    {
        uint256 appBitmap = appSubnetBitmap[nftID][appID];
        uint256 subnetListLen = nftAllSubnets[nftID].length;
        uint16[] memory resource = entries[nftID][appID].resourceArray;

        for(uint i = 0; i < subnetListLen; i++)
        {
            if((appBitmap & (1 << i)) > 0)
            {
                uint256 subnetID = nftAllSubnets[nftID][i];
                uint8[] memory mul = appCurrentReplica[nftID][appID][subnetID];
                for(uint j = 0; j < mul.length; j++)
                {
                    nftSubnetResource[nftID][subnetID][j] -= mul[j]*resource[j];
                }

                uint8 appCount = nftSubnetEntry[nftID][subnetID].appCount;
                if(appCount == 1)
                {
                    nftSubnetEntry[nftID][subnetID].appCount = 0;
                    nftActiveSubnetCheck[nftID] ^= 1 << i;
                }
                else {
                    nftSubnetEntry[nftID][subnetID].appCount = appCount - 1;
                }

                if(deleteCurrentReplica)
                {
                    delete appCurrentReplica[nftID][appID][subnetID];
                }
            }
        }
    }

    function addSubnets(
        uint256 nftID,
        uint256[] memory paramSubnetList,
        uint256 appBitmap,
        uint256 subnetBitmap
    )
    internal
    returns(uint256, uint256)
    {
        uint256 paramBitmap;
        uint256 subListLen = nftAllSubnets[nftID].length;
        uint256 subnetBitmap2 = subnetBitmap;
        uint8 j;

        for(uint i; i < paramSubnetList.length;)
        {
            uint256 subnetID = paramSubnetList[i];
            SubnetEntryID memory subnetEntry = nftSubnetEntry[nftID][subnetID];

            if(subnetEntry.appCount == 0)
            {
                if(subnetEntry.entryID > 0)
                {
                    nftSubnetEntry[nftID][subnetID].appCount = 1;
                    paramBitmap |= 1 << subnetEntry.entryID;
                    if(j <= subnetEntry.entryID)
                        subnetBitmap2 |= 1 << (subnetEntry.entryID - j);
                }
                else if(subListLen > 0 && nftAllSubnets[nftID][0] == subnetID)
                {
                    nftSubnetEntry[nftID][subnetID].appCount = 1;
                    paramBitmap |= 1;
                    if(j == 0)
                        subnetBitmap2 |= 1;
                }
                else {
                    while(subnetBitmap2 != 0)
                    {
                        if((subnetBitmap2 & 1) == 0)
                        {
                            nftAllSubnets[nftID][j] = subnetID;
                            paramBitmap |= 1 << j;
                            nftSubnetEntry[nftID][subnetID] = SubnetEntryID(
                                j,1
                            );
                            subnetBitmap2 = subnetBitmap2 >> 1;
                            j++;
                            break;
                        }
                        subnetBitmap2 = subnetBitmap2 >> 1;
                        unchecked {
                            ++j;
                        }
                    }

                    if(subnetBitmap2 == 0)
                    {
                        nftAllSubnets[nftID].push(subnetID);
                        nftSubnetEntry[nftID][subnetID] = SubnetEntryID(
                            uint8(subListLen),
                            1
                        );
                        paramBitmap |= 1 << (subListLen);
                        subListLen += 1;
                        j+=1;
                    }
                }
            }
        else {
                if((paramBitmap & (1 << subnetEntry.entryID)) > 0)
                {
                    revert("duplicate subnet ids");
                }
                paramBitmap = paramBitmap | ( 1 << subnetEntry.entryID);
                if((appBitmap & (1 << subnetEntry.entryID)) == 0)
                {
                    nftSubnetEntry[nftID][subnetID].appCount = subnetEntry.appCount + 1;
                }

            }
            subnetBitmap |= paramBitmap;

            unchecked {
                ++i;
            }
        }

        nftActiveSubnetCheck[nftID] = subnetBitmap;

        require(subListLen < 256, "max active subnets reached");

        return (paramBitmap, subListLen);
    }

    function calculateResource(
        uint256 nftID,
        uint256 appID,
        uint8[][] memory multiplier,
        uint16[] memory newResource,
        uint256[] memory paramSubnetList
    )
    internal
    {
        uint256 prevSubnetBitmap = Registration.totalSubnets();
        {
            bool[] memory activeSubnetList = Registration.checkSubnetStatus(paramSubnetList);
            
            for(uint i; i < paramSubnetList.length; i++)
            {
                uint256 subnetID = paramSubnetList[i];
                        require(
                prevSubnetBitmap > subnetID,
                "subnet does not exist"
            );

            require(
                activeSubnetList[i],
                "Delisted subnet given"
            );
            }
        }

        prevSubnetBitmap = nftActiveSubnetCheck[nftID];
        if(prevSubnetBitmap > 0)
        {
            SubscriptionBalance.updateBalanceImmediate(nftID);
        }

        uint256 appBitmap = appSubnetBitmap[nftID][appID];
        (uint256 paramBitmap, uint256 subListLen) = addSubnets(nftID, paramSubnetList, appBitmap, prevSubnetBitmap);
        uint16[] memory curResource = entries[nftID][appID].resourceArray;
        appBitmap |= paramBitmap;

        if((paramBitmap & (~prevSubnetBitmap)) > 0)
        {
            if(nftSubnetLock[nftID]) {
                revert("cannot change subnet list");
            }
        }
   
        for(uint i; i < subListLen; i++)
        {
            if(((appBitmap & (1 << i)) == 0) || ((paramBitmap & (1 << i)) > 0))
            {
                continue;
            }

            setNonParamSubnetResource(
                nftID,
                appID,
                nftAllSubnets[nftID][i],
                curResource,
                newResource
            );
        }

        for(uint i = 0; i < paramSubnetList.length; i++)
        {
            setParamSubnetResource(
                nftID,
                appID,
                paramSubnetList[i],
                curResource,
                newResource,
                multiplier[i]
            );
        }
        
        appSubnetBitmap[nftID][appID] = appBitmap;
    }

    function subscribe(
        uint256 balanceToAdd,
        uint256 nftID,
        address[] memory rlsAddresses,
        uint256[] memory licenseFactor
    )
    internal
    {
        Subscription.subscribe(
            nftID,
            rlsAddresses,
            licenseFactor
        );

        if(balanceToAdd > 0)
        {
            SubscriptionBalance.addBalanceWithoutUpdate(msg.sender, nftID, balanceToAdd );
        }
    }


    function subscribeAndCreateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        address[] memory rlsAddresses,
        uint256[] memory licenseFactor,
        bytes32 appName,
        bytes32 digest,
        uint8[2] memory hashAndSize,
        uint256[] memory subnetList,
        uint8[][] memory multiplier,
        uint16[] memory resourceArray,
        bool cidLock
    )
    external
    hasPermission(nftID)
    {
        uint16 appCount = nftAppCount[nftID];
        require(subnetList.length == multiplier.length,
            "wrong multiplier length");
        require(appCount < 255, "app count exceeded 255");
        require(!appNameCheck[nftID][appName], "app name already exists");

        subscribe(
            balanceToAdd,
            nftID,
            rlsAddresses,
            licenseFactor
        );

        uint256 appID = lastAppID[nftID];

        calculateResource(
            nftID,
            appID,
            multiplier,
            resourceArray,
            subnetList
        );

        entries[nftID][appID] = Multihash(
            appName,
            block.timestamp,
            digest,
            resourceArray,
            hashAndSize[0],
            hashAndSize[1],
            cidLock,
            true
        );

        lastAppID[nftID] = appID + 1;
        nftAppCount[nftID] = appCount + 1;
        
        appNameCheck[nftID][appName] = true;


        emit CreateApp(
            nftID,
            appID,
            appName,
            digest,
            hashAndSize,
            subnetList,
            multiplier,
            resourceArray,
            cidLock
        );
    }

    function createAppBatch(
        uint256 balanceToAdd,
        uint256 nftID,
        bytes32[] memory appName,
        bytes32[] memory digest,
        uint8[2][] memory hashAndSize,
        uint256[][] memory subnetList,
        uint8[][][] memory multiplier,
        uint16[][] memory resourceArray,
        bool[] memory cidLock
    )
    external
    hasPermission(nftID)
    {
        {
            uint16 appCount = nftAppCount[nftID];
            require(appCount + appName.length < 255, "app count exceeded 256");

            nftAppCount[nftID] = appCount + uint16(appName.length);
        }

        uint256 appID = lastAppID[nftID];
        require(appID > 0, "Subscription not done");

        uint256[] memory appIDList = new uint256[](appName.length);
        
        for(uint i = 0; i < appName.length; i++)
        {
            require(!appNameCheck[nftID][appName[i]], "App name already exists");
            require(subnetList[i].length == multiplier[i].length,
            "wrong multiplier length");

            calculateResource(
                nftID,
                appID,
                multiplier[i],
                resourceArray[i],
                subnetList[i]
            );

            entries[nftID][appID] = Multihash(
                appName[i],
                block.timestamp,
                digest[i],
                resourceArray[i],
                hashAndSize[i][0],
                hashAndSize[i][1],
                cidLock[i],
                true
            );

            appNameCheck[nftID][appName[i]] = true;
            appIDList[i] = appID;
            appID += 1;
        }

        if(balanceToAdd > 0)
        {
            SubscriptionBalance.addBalanceWithoutUpdate(msg.sender, nftID, balanceToAdd);
        }

        lastAppID[nftID] = appID;


        emit CreateAppBatch(
            nftID,
            appIDList,
            appName,
            digest,
            hashAndSize,
            subnetList,
            multiplier,
            resourceArray,
            cidLock
        );
    }

    function createApp(
        uint256 balanceToAdd,
        uint256 nftID,
        bytes32 appName,
        bytes32 digest,
        uint8[2] memory hashAndSize,
        uint256[] memory subnetList,
        uint8[][] memory multiplier,
        uint16[] memory resourceArray,
        bool cidLock
    )
    public
    hasPermission(nftID)
    {
        uint16 appCount = nftAppCount[nftID];
        require(subnetList.length == multiplier.length,
            "wrong multiplier length");
        require(appCount < 255, "app count exceeded 256");
        require(!appNameCheck[nftID][appName], "App name already exists");


        uint256 appID = lastAppID[nftID];
        require(appID > 0, "Subscription not done");

        calculateResource(
            nftID,
            appID,
            multiplier,
            resourceArray,
            subnetList
        );

        if(balanceToAdd > 0)
        {
            SubscriptionBalance.addBalanceWithoutUpdate(msg.sender, nftID, balanceToAdd);
        }

        entries[nftID][appID] = Multihash(
            appName,
            block.timestamp,
            digest,
            resourceArray,
            hashAndSize[0],
            hashAndSize[1],
            cidLock,
            true
        );

        lastAppID[nftID] = appID + 1;
        nftAppCount[nftID] = appCount + 1;
        appNameCheck[nftID][appName] = true;

        emit CreateApp(
            nftID,
            appID,
            appName,
            digest,
            hashAndSize,
            subnetList,
            multiplier,
            resourceArray,
            cidLock
        );
    }

    function updateCID(
        uint256 nftID,
        uint256 appID,
        bytes32 digest,
        uint8[2] memory hashAndSize
    )
    external
    hasPermission(nftID)
    {
        require(entries[nftID][appID].active, "App doesnt exist");
        if(entries[nftID][appID].cidLock)
        {
            require(
                entries[nftID][appID].digest == digest
                && entries[nftID][appID].hashFunction == hashAndSize[0]
                && entries[nftID][appID].size == hashAndSize[1]
                ,"The CID in this app is locked, and cannot be changed"
            );
        }
        entries[nftID][appID].digest = digest;
        entries[nftID][appID].hashFunction = hashAndSize[0];
        entries[nftID][appID].size = hashAndSize[1];

        emit UpdateCID(
            nftID,
            appID,
            digest,
            hashAndSize[0],
            hashAndSize[1]
        );
    }


    function updateResource(
        uint256 nftID,
        uint256 appID,
        uint256[] memory paramSubnetList,
        uint8[][] memory multiplier,
        uint16[] memory resourceArray
    )
    external
    hasPermission(nftID)
    {
        require(entries[nftID][appID].active, "App doesnt exist");
        require(paramSubnetList.length == multiplier.length,
            "wrong multiplier length");

        calculateResource(
            nftID,
            appID,
            multiplier,
            resourceArray,
            paramSubnetList
        );

        uint256[] memory subnetList;
        uint8[][] memory currentReplicaList;
        (subnetList, currentReplicaList) = getCurrentReplica(nftID, appID);

        emit UpdateResource(
            nftID,
            appID,
            subnetList,
            currentReplicaList,
            resourceArray
        );
    }

    function updateMultiplier(
        uint256 nftID,
        uint256 appID,
        uint256[] memory paramSubnetList,
        uint8[][] memory multiplier
    )
    external
    hasPermission(nftID)
    {

        require(entries[nftID][appID].active, "App doesnt exist");
        require(paramSubnetList.length == multiplier.length,
            "wrong multiplier length");

        uint16[] memory resourceArray = entries[nftID][appID].resourceArray;

        calculateResource(
            nftID,
            appID,
            multiplier,
            resourceArray,
            paramSubnetList
        );

        uint256[] memory subnetList;
        uint8[][] memory currentReplicaList;
        (subnetList, currentReplicaList) = getCurrentReplica(nftID, appID);

        emit UpdateResource(
            nftID,
            appID,
            subnetList,
            currentReplicaList,
            resourceArray
        );
    }

    function setSubnetLock(uint256 nftID)
    external
    hasPermission(nftID)
    {
        nftSubnetLock[nftID] = true;
    }

    function updateApp(
        uint256 balanceToAdd,
        uint256 nftID,
        uint256 appID,
        bytes32 digest,
        uint8[] memory hashAndSize,
        uint256[] memory subnetList,
        uint8[][] memory multiplier,
        uint16[] memory resourceArray
    )
    external
    hasPermission(nftID)
    {
        require(entries[nftID][appID].active, "App doesnt exist");
        require(subnetList.length == multiplier.length,
            "wrong multiplier length");

        calculateResource(
            nftID,
            appID,
            multiplier,
            resourceArray,
            subnetList
        );

        if(balanceToAdd > 0)
        {
            SubscriptionBalance.addBalanceWithoutUpdate(msg.sender, nftID, balanceToAdd);
        }

        if(!entries[nftID][appID].cidLock)
        {
            entries[nftID][appID].digest = digest;
            entries[nftID][appID].hashFunction = hashAndSize[0];
            entries[nftID][appID].size = hashAndSize[1];
        }

        entries[nftID][appID].resourceArray = resourceArray;
        entries[nftID][appID].timestamp = block.timestamp;


        uint256[] memory subnetList;
        uint8[][] memory currentReplicaList;
        (subnetList, currentReplicaList) = getCurrentReplica(nftID, appID);
        bytes32 appName = entries[nftID][appID].appName;

        emit UpdateApp(
            balanceToAdd,
            nftID,
            appID,
            appName,
            digest,
            hashAndSize,
            subnetList,
            currentReplicaList,
            resourceArray
        );
    }

    /**
     * @dev deassociate any multihash entry to appName
     */

    function deleteApp(uint256 nftID, uint256 appID)
        external
        hasPermission(nftID)
    {
        SubscriptionBalance.updateBalanceImmediate(nftID);
        removeSubnet(nftID, appID, true);

        entries[nftID][appID].active = false;
        nftAppCount[nftID] -=1;
    
        emit DeleteApp(nftID, appID);
    }


    function getComputesOfSubnet(uint256 nftID, uint256 subnetID) external view returns(uint32[] memory)
    {
        return nftSubnetResource[nftID][subnetID];
    }


    function getActiveSubnetsOfNFT(
        uint256 nftID
    )
    public
    view
    returns (
        uint256[] memory
    )
    {
        uint256 activeSubnetLen;
        uint256 subnetLen = nftAllSubnets[nftID].length;
        uint256 activeBitmap = nftActiveSubnetCheck[nftID];

        for(uint i = 0; i < subnetLen; i++)
        {
            if((activeBitmap & (1 << i)) > 0)
            {
                ++activeSubnetLen;
            }
        }

        uint256[] memory subnetList = new uint256[](activeSubnetLen);

        uint j;
        for(uint i = 0; i < subnetLen; i++)
        {
            if((activeBitmap &  (1 << i)) > 0)
            {
                subnetList[j] = nftAllSubnets[nftID][i];
                j++;
            }
        }


        return (
            subnetList
        );
    }

    function getSubnetsOfApp(
        uint256 nftID,
        uint256 appID
    )
    public
    view
    returns (
        uint256[] memory
    )
    {
        uint256 activeSubnetLen;
        uint256 subnetLen = nftAllSubnets[nftID].length;
        uint256 activeBitmap = appSubnetBitmap[nftID][appID];

        for(uint i = 0; i < subnetLen; i++)
        {
            if((activeBitmap & (1 << i)) > 0)
            {
                ++activeSubnetLen;
            }
        }

        uint256[] memory subnetList = new uint256[](activeSubnetLen);

        uint j;
        for(uint i = 0; i < subnetLen; i++)
        {
            if((activeBitmap & i) > 0)
            {
                subnetList[j] = nftAllSubnets[nftID][i];
                j++;
            }
        }


        return (
            subnetList
        );
    }

    function getCurrentReplica(uint256 nftID, uint256 appID)
    public
    view
    returns(
        uint256[] memory subnetList,
        uint8[][] memory currentReplicaList
    )
    {
        subnetList = getSubnetsOfApp(nftID, appID);
        currentReplicaList = new uint8[][](subnetList.length);

        for(uint i = 0; i < subnetList.length; i++)
        {
            uint256 subnetID = subnetList[i];
            uint8[] memory currentReplica = appCurrentReplica[nftID][appID][subnetID];

            currentReplicaList[i] = currentReplica;
        }
    }

    function getApp(uint256 nftID, uint256 appID)
        public
        view
        returns (
            FullAppData memory
        )
    {
        FullAppData memory appData;

        appData.app = entries[nftID][appID];
        appData.appID = appID;

        uint256 appBitmap = appSubnetBitmap[nftID][appID];

        uint256 nftSubnetListLen = nftAllSubnets[nftID].length;
        uint256 appSubnetListLen;

        for(uint i = 0; i < nftSubnetListLen; i++)
        {
            if((appBitmap & (1 << i)) > 0)
            {
                ++appSubnetListLen;
            }
        }

        uint256[] memory appSubnetList;
        appSubnetList = new uint256[](appSubnetListLen);
        uint8[][] memory currentReplica = new uint8[][](appSubnetListLen);

        uint k = 0;


        for(uint i = 0; i < nftSubnetListLen; i++)
        {
            if((appBitmap & (1 << i)) > 0)
            {
                uint256 subnetID = nftAllSubnets[nftID][i];
                appSubnetList[k] = subnetID;
                currentReplica[k] = appCurrentReplica[nftID][appID][subnetID];
                k++;
            }
        }

        appData.currentReplica = currentReplica;
        appData.subnetList = appSubnetList;

        return appData;
    }


    function getAppList(uint256 nftID)
        public
        view
        returns (FullAppData[] memory)
    {
        FullAppData[] memory fullAppList;
        uint appListLen;
        uint256 appCount = lastAppID[nftID];

        for(uint i = 0; i < appCount; i++)
        {
            if(entries[nftID][i].active)
            {
                appListLen++;
            }
        }

        fullAppList = new FullAppData[](appListLen);
        uint j;
        for(uint i = 0; i < appCount; i++)
        {
            if(entries[nftID][i].active)
            {
                fullAppList[j] = getApp(nftID, i);
                j++;
            }
        }
        return fullAppList;
    }

    function getNFTSubnetList(uint256 nftID)
    external
    view
    returns (uint256[] memory)
    {
        return nftAllSubnets[nftID];
    }

    modifier hasPermission(uint256 _nftId) {
        require(
            AppNFT.ownerOf(_nftId) == msg.sender
            || AppNFT.hasRole(_nftId, DEPLOYER, msg.sender)
            || Subscription.checkBridgeRole(msg.sender)
            ,
            "No permissions to call this"
        );
        _;
    }

    modifier hasSubscribePermission(uint256 _nftId) {
        require(
            AppNFT.ownerOf(_nftId) == msg.sender
            || Subscription.checkBridgeRole(msg.sender)
            ,
            "No permissions to call this"
        );
        _;
    }
}