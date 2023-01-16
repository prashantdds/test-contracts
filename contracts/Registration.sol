// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./TokensRecoverable.sol";
import "./interfaces/ISubnetDAODistributor.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Registration is
    AccessControlUpgradeable,
    PausableUpgradeable,
    TokensRecoverable
{
    using SafeMathUpgradeable for uint256;

    IERC721Upgradeable public DarkMatterNFT;
    IERC20Upgradeable public StackToken;
    ISubnetDAODistributor public SubnetDAODistributor;

    bytes32 public constant CLUSTER_LIST_ROLE = keccak256("CLUSTER_LIST_ROLE");
    bytes32 public constant SUBNET_ATTR_ROLE = keccak256("SUBNET_ATTR_ROLE");
    bytes32 public constant COOLDOWN_ROLE = keccak256("COOLDOWN_ROLE");
    bytes32 public constant PRICE_ROLE = keccak256("PRICE_ROLE");
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant WITHDRAW_STACK_ROLE =
        keccak256("WITHDRAW_STACK_ROLE");

    address public GLOBAL_DAO_ADDRESS;
    mapping(address => bool) public approvedDarkMatterNFTTypes;

    uint256 public daoRate; // 1000 = 1%
    uint256 public REQD_STACK_FEES_FOR_SUBNET;
    uint256 public DefaultWhitelistedClusterWeight;

    struct SubnetAttributes {
        uint256 subnetType;
        bool sovereignStatus;
        uint256 cloudProviderType;
        bool subnetStatusListed;
        uint256[] unitPrices;
        uint256[] otherAttributes; // eg. [1,2] if reqd
        uint256 maxClusters;
        uint256 stackFeesReqd; // in wei
        IERC721Upgradeable DarkMatterNFTType;
        bytes32 SUBNET_ATTR_ROLE;
        bytes32 PRICE_ROLE;
        bytes32 WHITELIST_ROLE;
        bytes32 CLUSTER_LIST_ROLE;
        address subnetLocalDAO;
        string subnetName;
    }

    struct Cluster {
        address walletAddress;
        address ownerAddress;
        address operatorAddress;
        string DNSIP;
        uint8 listed; //uint8 [1,2,3] if in 1st state, should be able to withdraw
        uint256 NFTidLocked;
        string clusterName;
    }

    struct PriceChangeRequest {
        uint256 timestamp;
        uint256[] unitPrices;
    }

    mapping(uint256 => PriceChangeRequest) requestPriceChange;

    // SubnetID =>
    mapping(uint256 => SubnetAttributes) public subnetAttributes;
    // mapping(uint256 => address) public subnetLocalDAO;
    mapping(uint256 => address[]) public whiteListedClusters;
    uint256 public totalSubnets;
    mapping(uint256 => uint256) public totalClustersSigned;

    // SubnetID => ClusterID =>
    mapping(uint256 => mapping(uint256 => Cluster)) public subnetClusters;

    //keeps track of stack locked during cluster creation
    mapping(address => uint256) public balanceOfStackLocked;

    uint256 public coolDownTimeForPriceChange;

    event ClusterSignedUp(
        uint256 subnetId,
        uint256 clusterId,
        string DNS_IP,
        address walletAddress,
        address ownerAddress,
        address operatorAddress,
        address sender,
        string clusterName
    );
    event NFTLockedForCluster(
        address userAddress,
        uint256 subnetId,
        uint256 clusterId,
        uint256 nftID
    );
    event NFTLockedForSubnet(
        address userAddress,
        uint256 subnetId,
        uint256 nftID
    );

    event ChangedClusterName(uint256 subnetID, uint256 clusterID, string clusterName);

    event ChangedDNSIP(uint256 subnetId, uint256 clusterId, string newDNSIP);
    event TransferredClusterOwnership(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        address newOwner
    );
    event ChangedListingCluster(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        uint8 allowStatus
    );
    event SubnetCreated(
        uint256 subnetId,
        address subnetLocalDAO,
        uint256 subnetType,
        bool sovereignStatus,
        uint256 cloudProviderType,
        bool subnetStatusListed,
        uint256[] unitPrices,
        uint256[] otherAttributes,
        uint256 maxClusters,
        address[] whiteListedClusters,
        address sender,
        uint256 stackFeesReqd
    );
    
    event ChangedSubnetName(uint256 subnetID, string subnetName);

    event SubnetAttributesChanged(
        uint256 subnetId,
        SubnetAttributes subnetAttributes,
        address sender
    );
    event AddedToWhitelistCluster(
        uint256 subnetId,
        address[] whitelistAddresses
    );
    event RemovedWhitelistCluster(uint256 subnetId, address blacklistAddress);
    event ResetWhitelistCluster(uint256 subnetId);
    event RequestedClusterPriceChange(uint256 subnetId, uint256[] unitPrices);
    event ChangedCoolDownForPriceChange(uint256 coolDownTimeSecs);
    event AppliedChangedClusterPrice(uint256 subnetId, uint256[] unitPrices);
    event WithdrawnNFTs(uint256[] nftIds);
    event ChangedNFTAddress(address DarkMatterNFT);
    event DAORateChanged(uint256 daoRate, uint256 _daoRate);

    event WithdrawnStackFromCluster(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        uint256 stackTokens
    );

    event WithdrawnNFTFromCluster(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        uint256 NFTid
    );

    event WithdrawnStackFromClusterByDAO(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        uint256 amount
    );

    function initialize(
        IERC721Upgradeable _DarkMatterNFT,
        IERC20Upgradeable _StackToken,
        address _GlobalDAO,
        uint256 _coolDownTimeForPriceChange,
        uint256 _daoRate,
        uint256 _REQD_STACK_FEES_FOR_SUBNET,
        uint256 _DefaultWhitelistedClusterWeight
    ) public initializer {
        __AccessControl_init_unchained();
        __Pausable_init_unchained();

        _grantRole(DEFAULT_ADMIN_ROLE, _GlobalDAO);
        _grantRole(CLUSTER_LIST_ROLE, _GlobalDAO);
        _grantRole(SUBNET_ATTR_ROLE, _GlobalDAO); //subnetDAO (for its own subnet only)
        _grantRole(COOLDOWN_ROLE, _GlobalDAO);
        _grantRole(PRICE_ROLE, _GlobalDAO); //subnetdao
        _grantRole(WHITELIST_ROLE, _GlobalDAO);//subnetdao
        _grantRole(PAUSER_ROLE, _GlobalDAO);
        _grantRole(WITHDRAW_STACK_ROLE, _GlobalDAO);

        GLOBAL_DAO_ADDRESS = _GlobalDAO;

        DarkMatterNFT = _DarkMatterNFT;
        StackToken = _StackToken;
        totalSubnets = 0;
        coolDownTimeForPriceChange = _coolDownTimeForPriceChange;
        daoRate = _daoRate;
        REQD_STACK_FEES_FOR_SUBNET = _REQD_STACK_FEES_FOR_SUBNET;
        DefaultWhitelistedClusterWeight = _DefaultWhitelistedClusterWeight;
        StackToken.approve(_GlobalDAO, _REQD_STACK_FEES_FOR_SUBNET);
    }

    function getAllSubnetAttributes()
        external
        view
        returns (SubnetAttributes[] memory _subnetAttributesArr)
    {
        for (uint256 i = 0; i < totalSubnets; i++) {
            _subnetAttributesArr[i] = (subnetAttributes[i]);
        }
    }

    function getSubnetAttributes(uint256 subnetId)
        external
        view
        returns (
            uint256,
            bool,
            uint256,
            bool,
            uint256[] memory,
            uint256[] memory,
            uint256,
            uint256,
            IERC721Upgradeable _DarkMatterNFT,
            string memory
        )
    {
        uint256 _subnetId = subnetId;
        return (
            subnetAttributes[_subnetId].subnetType,
            subnetAttributes[_subnetId].sovereignStatus,
            subnetAttributes[_subnetId].cloudProviderType,
            subnetAttributes[_subnetId].subnetStatusListed,
            subnetAttributes[_subnetId].unitPrices,
            subnetAttributes[_subnetId].otherAttributes,
            subnetAttributes[_subnetId].maxClusters,
            subnetAttributes[_subnetId].stackFeesReqd,
            subnetAttributes[_subnetId].DarkMatterNFTType,
            subnetAttributes[_subnetId].subnetName
        );
    }

    function getClusterAttributes(uint256 _subnetId, uint256 _clusterId)
        external
        view
        returns (
            address,
            address,
            address,
            string memory,
            uint8,
            uint256,
            string memory
        )
    {
        Cluster memory subnetCluster = subnetClusters[_subnetId][_clusterId];
        return (
            subnetCluster.walletAddress,
            subnetCluster.ownerAddress,
            subnetCluster.operatorAddress,
            subnetCluster.DNSIP,
            subnetCluster.listed,
            subnetCluster.NFTidLocked,
            subnetCluster.clusterName
        );
    }

    function set_SubnetDAODistributorContract(
        ISubnetDAODistributor _SubnetDAODistributor
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(SubnetDAODistributor) == address(0), "Already set");
        SubnetDAODistributor = _SubnetDAODistributor;
    }


    // to change _DarkMatterNFTType call changeSubnetAttributes() with index 9
    function createSubnet(
        uint256 nftId,
        address _subnetLocalDAO,
        uint256 _subnetType,
        bool _sovereignStatus,
        uint256 _cloudProviderType,
        bool _subnetStatusListed,
        uint256[] memory _unitPrices,
        uint256[] memory _otherAttributes,
        uint256 _maxClusters,
        address[] memory _whiteListedClusters,
        uint256 _stackFeesReqd
    ) external whenNotPaused {
        DarkMatterNFT.transferFrom(_msgSender(), address(this), nftId);
        StackToken.transferFrom(
            _msgSender(),
            GLOBAL_DAO_ADDRESS,
            REQD_STACK_FEES_FOR_SUBNET
        );

        emit NFTLockedForSubnet(_msgSender(), totalSubnets, nftId);

        // subnetLocalDAO[totalSubnets] = _subnetLocalDAO;
        string memory subnetIDStr = Strings.toString(totalSubnets);

        SubnetAttributes memory _subnetAttributes;
        _subnetAttributes.subnetType = _subnetType;
        _subnetAttributes.sovereignStatus = _sovereignStatus;
        _subnetAttributes.cloudProviderType = _cloudProviderType;
        _subnetAttributes.subnetStatusListed = _subnetStatusListed;
        _subnetAttributes.unitPrices = _unitPrices;
        _subnetAttributes.otherAttributes = _otherAttributes;
        _subnetAttributes.maxClusters = _maxClusters;
        _subnetAttributes.stackFeesReqd = _stackFeesReqd;
        _subnetAttributes.DarkMatterNFTType = DarkMatterNFT;
        _subnetAttributes.subnetLocalDAO = _subnetLocalDAO;
        _subnetAttributes.subnetName = subnetIDStr;

        _subnetAttributes.SUBNET_ATTR_ROLE = keccak256(abi.encodePacked("SUBNET_ATTR_ROLE", subnetIDStr));
        _subnetAttributes.PRICE_ROLE = keccak256(abi.encodePacked("PRICE_ROLE", subnetIDStr));
        _subnetAttributes.WHITELIST_ROLE = keccak256(abi.encodePacked("WHITELIST_ROLE", subnetIDStr));
        _subnetAttributes.CLUSTER_LIST_ROLE = keccak256(abi.encodePacked("CLUSTER_LIST_ROLE", subnetIDStr));

        _grantRole(_subnetAttributes.SUBNET_ATTR_ROLE, _subnetLocalDAO);
        _grantRole(_subnetAttributes.PRICE_ROLE, _subnetLocalDAO);
        _grantRole(_subnetAttributes.WHITELIST_ROLE, _subnetLocalDAO);
        _grantRole(_subnetAttributes.CLUSTER_LIST_ROLE, _subnetLocalDAO);

        _grantRole(_subnetAttributes.SUBNET_ATTR_ROLE, GLOBAL_DAO_ADDRESS);
        _grantRole(_subnetAttributes.PRICE_ROLE, GLOBAL_DAO_ADDRESS);
        _grantRole(_subnetAttributes.WHITELIST_ROLE, GLOBAL_DAO_ADDRESS);
        _grantRole(_subnetAttributes.CLUSTER_LIST_ROLE, GLOBAL_DAO_ADDRESS);

        subnetAttributes[totalSubnets] = _subnetAttributes;
        emit SubnetCreated(
            totalSubnets,
            _subnetLocalDAO,
            _subnetType,
            _sovereignStatus,
            _cloudProviderType,
            _subnetStatusListed,
            _unitPrices,
            _otherAttributes,
            _maxClusters,
            _whiteListedClusters,
            _msgSender(),
            _stackFeesReqd
        );

        whiteListedClusters[totalSubnets] = _whiteListedClusters;

        totalSubnets = totalSubnets.add(1);
    }

    function setSubnetName(uint256 subnetID, string memory subnetName)
    external
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(SUBNET_ATTR_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetID].SUBNET_ATTR_ROLE, _msgSender()), "address does not have the role to modify subnet attributes");
        
        subnetAttributes[subnetID].subnetName = subnetName;

        emit ChangedSubnetName(subnetID, subnetName);
    }

    function changeSubnetAttributes(
        uint256 subnetId,
        uint256 _attributeNo,
        uint256 _subnetType, // 1
        bool _sovereignStatus, // 2
        uint256 _cloudProviderType, // 3
        bool _subnetStatusListed, // 4
        uint256[] memory _otherAttributes, // 5
        uint256 _maxClusters, // 6
        uint256 _stackFeesReqd, // 8
        IERC721Upgradeable _DarkMatterNFTType //9
    ) external  {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(SUBNET_ATTR_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].SUBNET_ATTR_ROLE, _msgSender()), "address does not have the role to modify subnet attributes");
        if (_attributeNo == 1)
            subnetAttributes[subnetId].subnetType = _subnetType;
        else if (_attributeNo == 2)
            subnetAttributes[subnetId].sovereignStatus = _sovereignStatus;
        else if (_attributeNo == 3)
            subnetAttributes[subnetId].cloudProviderType = _cloudProviderType;
        else if (_attributeNo == 4)
            subnetAttributes[subnetId].subnetStatusListed = _subnetStatusListed;
        else if (_attributeNo == 5)
            subnetAttributes[subnetId].otherAttributes = _otherAttributes;
        else if (_attributeNo == 6)
            subnetAttributes[subnetId].maxClusters = _maxClusters;
        else if (_attributeNo == 7)
            subnetAttributes[subnetId].stackFeesReqd = _stackFeesReqd;
        else if (_attributeNo == 8) {
            require(
                approvedDarkMatterNFTTypes[address(_DarkMatterNFTType)],
                "Not approved Dark Matter NFT"
            );
            subnetAttributes[subnetId].DarkMatterNFTType = _DarkMatterNFTType;
        }

        emit SubnetAttributesChanged(
            subnetId,
            subnetAttributes[subnetId],
            _msgSender()
        );
    }

    function hasPermissionToClusterList(uint256 subnetId, address user)
        external
        view
        returns (bool)
    {
        if (
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(CLUSTER_LIST_ROLE, user) ||
            hasRole(subnetAttributes[subnetId].CLUSTER_LIST_ROLE, _msgSender())
        ) return true;
        return false;
    }

    function addClusterToWhitelisted(
        uint256 subnetId,
        address[] memory _whitelistAddresses
    ) external {
        require(
            subnetAttributes[subnetId].subnetType == 1,
            "Already public subnet"
        );
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(WHITELIST_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].WHITELIST_ROLE, _msgSender()),
            "Only WHITELIST_ROLE or Local DAO can edit whitelisted addresses"
        );
        for (uint256 i = 0; i < _whitelistAddresses.length; i++) {
            whiteListedClusters[subnetId].push(_whitelistAddresses[i]);
        }
        emit AddedToWhitelistCluster(subnetId, _whitelistAddresses);
    }

    function addApprovedDarkMatterNFTTypes(address _NFTTypes, bool allow)
        external
    {
        require(
            hasRole(WHITELIST_ROLE, _msgSender()),
            "Only WHITELIST_ROLE can edit whitelisted addresses"
        );
        approvedDarkMatterNFTTypes[_NFTTypes] = allow;
    }

    function removeClusterFromWhitelisted(
        uint256 subnetId,
        address _blacklistAddress,
        uint256 _index
    ) external {
        require(
            whiteListedClusters[subnetId][_index] == _blacklistAddress,
            "Address do not match with index provided"
        );
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(WHITELIST_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].WHITELIST_ROLE, _msgSender()),
            "Only WHITELIST_ROLE or Local DAO can edit whitelisted addresses"
        );

        for (
            uint256 i = _index;
            i < whiteListedClusters[subnetId].length - 1;
            i++
        ) {
            whiteListedClusters[subnetId][i] = whiteListedClusters[subnetId][
                i + 1
            ];
        }
        whiteListedClusters[subnetId].pop();
        emit RemovedWhitelistCluster(subnetId, _blacklistAddress);
    }

    function resetWhitelistClusters(uint256 subnetId)
        external
    {
        require(
            subnetAttributes[subnetId].subnetType == 1,
            "Already public subnet"
        );
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(WHITELIST_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].WHITELIST_ROLE, _msgSender()),
            "Only WHITELIST_ROLE or Local DAO can edit whitelisted addresses"
        );
        address[] memory AllAddresses;
        whiteListedClusters[subnetId] = AllAddresses;
        emit ResetWhitelistCluster(subnetId);
    }

    function totalClusterSpotsAvailable(uint256 subnetId)
        public
        view
        returns (uint256)
    {
        uint256 totalSignedIn = totalClustersSigned[subnetId];
        uint256 totalDelisted = 0;

        for (uint256 i = 0; i < totalSignedIn; i++) {
            if (subnetClusters[subnetId][i].listed == 3)
                totalDelisted = totalDelisted.add(1);
        }

        uint256 totalSpotsFilled = totalSignedIn.sub(totalDelisted);
        return subnetAttributes[subnetId].maxClusters.sub(totalSpotsFilled);
    }

    function clusterSignUp(
        uint256 subnetId,
        string memory _DNSIP,
        address walletAddress,
        address operatorAddress,
        uint256 nftId,
        string memory clusterName
    ) external whenNotPaused {
        if (!subnetAttributes[subnetId].sovereignStatus) {
            string memory empty = "";
            require(
                keccak256(bytes(_DNSIP)) != keccak256(bytes(empty)),
                "DNS/IP cannot be empty for non sovereign subnets"
            );
        }

        require(
            totalClusterSpotsAvailable(subnetId) > 0,
            "No spots available, maxSlots reached for subnet"
        );

        subnetAttributes[subnetId].DarkMatterNFTType.transferFrom(
            _msgSender(),
            address(this),
            nftId
        );
        StackToken.transferFrom(
            _msgSender(),
            address(this),
            subnetAttributes[subnetId].stackFeesReqd
        );
        balanceOfStackLocked[walletAddress] = balanceOfStackLocked[walletAddress]
            .add(subnetAttributes[subnetId].stackFeesReqd);

        uint256 clusterId = totalClustersSigned[subnetId];
        address ownerAddress = _msgSender();
        subnetClusters[subnetId][clusterId].walletAddress = walletAddress;
        subnetClusters[subnetId][clusterId].ownerAddress = ownerAddress;
        subnetClusters[subnetId][clusterId].operatorAddress = operatorAddress;
        subnetClusters[subnetId][clusterId].DNSIP = _DNSIP;
        subnetClusters[subnetId][clusterId].listed = 1;
        subnetClusters[subnetId][clusterId].NFTidLocked = nftId;
        subnetClusters[subnetId][clusterId].clusterName = clusterName;

        totalClustersSigned[subnetId] = totalClustersSigned[subnetId].add(1);

        for (uint256 i = 0; i < whiteListedClusters[subnetId].length; i++)
            if (whiteListedClusters[subnetId][i] == ownerAddress) {
                subnetClusters[subnetId][clusterId].listed = 2; // whitelisted clusters are approved as they signup
                SubnetDAODistributor.addWeight(
                    subnetId,
                    walletAddress,
                    DefaultWhitelistedClusterWeight
                );
                break;
            }

        emit ClusterSignedUp(
            subnetId,
            clusterId,
            _DNSIP,
            walletAddress,
            ownerAddress,
            operatorAddress,
            _msgSender(),
            clusterName
        );
        emit NFTLockedForCluster(_msgSender(), subnetId, clusterId, nftId);
    }

    function changeClusterName(uint256 subnetID, uint256 clusterID, string memory clusterName)
    external
    whenNotPaused
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            // subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            subnetClusters[subnetID][clusterID].ownerAddress == _msgSender(),
            "Sender is not Cluster owner"
        );
        subnetClusters[subnetID][clusterID].clusterName = clusterName;

        emit ChangedClusterName(subnetID, clusterID, clusterName);
    }

    function changeDNSIP(
        uint256 subnetId,
        uint256 clusterId,
        string memory newDNSIP
    ) external whenNotPaused {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            // subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            subnetClusters[subnetId][clusterId].ownerAddress == _msgSender(),
            "Sender is not Cluster owner"
        );
        subnetClusters[subnetId][clusterId].DNSIP = newDNSIP;
        emit ChangedDNSIP(subnetId, clusterId, newDNSIP);
    }

    function transferClusterOwnership(
        uint256 subnetId,
        uint256 clusterId,
        address newOwnerAddress,
        address newWalletAddress,
        address newOperatorAddress
    ) external whenNotPaused {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            subnetClusters[subnetId][clusterId].ownerAddress == _msgSender(),
            "Not the cluster owner"
        );
        subnetClusters[subnetId][clusterId].ownerAddress = newOwnerAddress;
        subnetClusters[subnetId][clusterId].walletAddress = newWalletAddress;
        subnetClusters[subnetId][clusterId].operatorAddress = newOperatorAddress;
        emit TransferredClusterOwnership(
            subnetId,
            clusterId,
            _msgSender(),
            newOperatorAddress
        );
    }

    function approveListingCluster(
        uint256 subnetId,
        uint256 clusterId,
        uint256 _weight
    ) external 
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(CLUSTER_LIST_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].CLUSTER_LIST_ROLE, _msgSender()), "Do not have required role to call this function");
        require(
            subnetClusters[subnetId][clusterId].listed != 2,
            "Already approved either by whitelisting or by calling this function"
        );
        require(
            subnetClusters[subnetId][clusterId].listed !=3 || totalClusterSpotsAvailable(subnetId) > 0,
            "No spots available, maxSlots reached for subnet"
        );
        subnetClusters[subnetId][clusterId].listed = 2;
        SubnetDAODistributor.addWeight(
            subnetId,
            subnetClusters[subnetId][clusterId].walletAddress,
            _weight
        );
        emit ChangedListingCluster(subnetId, clusterId, _msgSender(), 2);
    }

    function delistCluster(uint256 subnetId, uint256 clusterId) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(CLUSTER_LIST_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].CLUSTER_LIST_ROLE, _msgSender()) ||
                subnetClusters[subnetId][clusterId].ownerAddress == _msgSender(),
            "Sender is not Cluster owner or has CLUSTER_LIST_ROLE"
        );
        subnetClusters[subnetId][clusterId].listed = 3;
        emit ChangedListingCluster(subnetId, clusterId, _msgSender(), 3);
    }

    function requestClusterPriceChange(
        uint256 subnetId,
        uint256[] memory _unitPrices
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(PRICE_ROLE, _msgSender()) ||
            hasRole(subnetAttributes[subnetId].PRICE_ROLE, _msgSender()), "Do not have the roles to call this function");
        requestPriceChange[subnetId].timestamp = block.timestamp;
        requestPriceChange[subnetId].unitPrices = _unitPrices;

        emit RequestedClusterPriceChange(subnetId, _unitPrices);
    }

    function changeCoolDownTime(uint256 _coolDownTimeSecs)
        external
        onlyRole(COOLDOWN_ROLE)
    {
        coolDownTimeForPriceChange = _coolDownTimeSecs;
        emit ChangedCoolDownForPriceChange(_coolDownTimeSecs);
    }

    // callable by anyone if cooldown time over
    function applyChangedClusterPrice(uint256 subnetId) external {
        require(
            block.timestamp >
                requestPriceChange[subnetId].timestamp.add(
                    coolDownTimeForPriceChange
                ),
            "Cooldown time not over yet"
        );
        subnetAttributes[subnetId].unitPrices = requestPriceChange[subnetId]
            .unitPrices;

        emit AppliedChangedClusterPrice(
            subnetId,
            requestPriceChange[subnetId].unitPrices
        );
    }

    function withdrawStackFromClusterByDAO(
        uint256 subnetId,
        uint256 clusterId,
        uint256 _amount
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            hasRole(WITHDRAW_STACK_ROLE, _msgSender()),
            "Do not have the roles to call this function"
        );
        balanceOfStackLocked[
            subnetClusters[subnetId][clusterId].walletAddress
        ] = balanceOfStackLocked[subnetClusters[subnetId][clusterId].walletAddress]
            .sub(_amount);
    
        StackToken.transfer(_msgSender(), _amount);

        emit WithdrawnStackFromClusterByDAO(
            subnetId,
            clusterId,
            _msgSender(),
            _amount
        );
    }

    function withdrawClusterForDelistedSubnet(
        uint256 subnetId,
        uint256 clusterId
    ) external {
        // if subnet delisted cluster operator can withdraw..
        require(
            !subnetAttributes[subnetId].subnetStatusListed,
            "Cannot withdraw Stack locked if subnet is not delisted"
        );

        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            // subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            subnetClusters[subnetId][clusterId].ownerAddress == _msgSender(),
            "Only cluster operator can withdraw Stack locked"
        );
        address walletAddress = subnetClusters[subnetId][clusterId].walletAddress;
        uint256 bal = balanceOfStackLocked[walletAddress] = 0;
        balanceOfStackLocked[walletAddress] = 0;
        subnetClusters[subnetId][clusterId].listed = 3; // delisted cluster as withdrawn

        StackToken.transferFrom(address(this), _msgSender(), bal);
        DarkMatterNFT.transferFrom(
            address(this),
            _msgSender(),
            subnetClusters[subnetId][clusterId].NFTidLocked
        );

        emit WithdrawnNFTFromCluster(
            subnetId,
            clusterId,
            _msgSender(),
            subnetClusters[subnetId][clusterId].NFTidLocked
        );
        emit WithdrawnStackFromCluster(subnetId, clusterId, _msgSender(), bal);
    }

    function change_REQD_STACK_FEES_FOR_SUBNET(
        uint256 _REQD_STACK_FEES_FOR_SUBNET
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        REQD_STACK_FEES_FOR_SUBNET = _REQD_STACK_FEES_FOR_SUBNET;
    }

    function change_DAORate(uint256 _daoRate)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit DAORateChanged(daoRate, _daoRate);
        daoRate = _daoRate;
    }

    function withdrawNFT(uint256[] memory _nftIds)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        for (uint256 i = 0; i < _nftIds.length; i++)
            DarkMatterNFT.transferFrom(address(this), _msgSender(), _nftIds[i]);

        emit WithdrawnNFTs(_nftIds);
    }

    // Note: withdraw all NFTs before calling this function
    function changeNFT(IERC721Upgradeable _DarkMatterNFT)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        DarkMatterNFT = _DarkMatterNFT;
        emit ChangedNFTAddress(address(_DarkMatterNFT));
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function onERC721Received(
        address _operator,
        address _from,
        uint256 _id,
        bytes calldata _data
    ) external returns (bytes4) {
        return 0x150b7a02;
    }
}
