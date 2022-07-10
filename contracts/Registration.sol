// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./TokensRecoverable.sol";

contract Registration is
    AccessControlUpgradeable,
    PausableUpgradeable,
    TokensRecoverable
{
    using SafeMathUpgradeable for uint256;

    IERC721Upgradeable public DarkMatterNFT;
    IERC20Upgradeable public StackToken;

    bytes32 public constant CLUSTER_LIST_ROLE = keccak256("CLUSTER_LIST_ROLE");
    bytes32 public constant SUBNET_ATTR_ROLE = keccak256("SUBNET_ATTR_ROLE");
    bytes32 public constant COOLDOWN_ROLE = keccak256("COOLDOWN_ROLE");
    bytes32 public constant PRICE_ROLE = keccak256("PRICE_ROLE");
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant WITHDRAW_STACK_ROLE = keccak256("WITHDRAW_STACK_ROLE");
    
    address public GLOBAL_DAO_ADDRESS;

    uint256 public daoRate; // 1000 = 1%
    uint256 public REQD_STACK_FEES_FOR_SUBNET;

    struct SubnetAttributes {
        uint256 subnetType;
        bool sovereignStatus;
        uint256 cloudProviderType;
        bool subnetStatusListed;
        uint256[] unitPrices;
        uint256[] otherAttributes; // eg. [1,2] if reqd
        uint256 maxClusters;
        uint256 supportFeeRate; // 1000 = 1%
        uint256 stackFeesReqd; // in wei
    }

    struct Cluster {
        address ClusterDAO;
        string DNSIP;
        bool listed;
    }

    struct PriceChangeRequest {
        uint256 timestamp;
        uint256[] unitPrices;
    }

    mapping(uint256 => PriceChangeRequest) requestPriceChange;

    // SubnetID =>
    mapping(uint256 => SubnetAttributes) public subnetAttributes;
    mapping(uint256 => address) public subnetLocalDAO;
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
        address clusterDAO,
        address sender
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
    event ChangedDNSIP(uint256 subnetId, uint256 clusterId, string newDNSIP);
    event TransferredClusterDAOOwnership(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        address newOwner
    );
    event ChangedListingCluster(
        uint256 subnetId,
        uint256 clusterId,
        address sender,
        bool allow
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
        uint256 supportFeeRate,
        address sender,
        uint256 stackFeesReqd
    );
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
        address sender
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
        uint256 _REQD_STACK_FEES_FOR_SUBNET
    ) public initializer {
        __AccessControl_init_unchained();
        __Pausable_init_unchained();

        _grantRole(DEFAULT_ADMIN_ROLE, _GlobalDAO);
        _grantRole(CLUSTER_LIST_ROLE, _GlobalDAO);
        _grantRole(SUBNET_ATTR_ROLE, _GlobalDAO);
        _grantRole(COOLDOWN_ROLE, _GlobalDAO);
        _grantRole(PRICE_ROLE, _GlobalDAO);
        _grantRole(WHITELIST_ROLE, _GlobalDAO);
        _grantRole(PAUSER_ROLE, _GlobalDAO);
        _grantRole(WITHDRAW_STACK_ROLE, _GlobalDAO);
        
        GLOBAL_DAO_ADDRESS = _GlobalDAO;

        DarkMatterNFT = _DarkMatterNFT;
        StackToken = _StackToken;
        totalSubnets = 0;
        coolDownTimeForPriceChange = _coolDownTimeForPriceChange;
        daoRate = _daoRate;
        REQD_STACK_FEES_FOR_SUBNET = _REQD_STACK_FEES_FOR_SUBNET;
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
            uint256
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
            subnetAttributes[_subnetId].supportFeeRate,
            subnetAttributes[_subnetId].stackFeesReqd
        );
    }

    function getClusterAttributes(uint256 _subnetId, uint256 _clusterId)
        external
        view
        returns (
            address,
            string memory,
            bool
        )
    {
        return (
            subnetClusters[_subnetId][_clusterId].ClusterDAO,
            subnetClusters[_subnetId][_clusterId].DNSIP,
            subnetClusters[_subnetId][_clusterId].listed
        );
    }

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
        uint256 _supportFeeRate,
        uint256 _stackFeesReqd
    ) external whenNotPaused {
        DarkMatterNFT.transferFrom(_msgSender(), address(this), nftId);
        StackToken.transferFrom(
            _msgSender(),
            GLOBAL_DAO_ADDRESS,
            REQD_STACK_FEES_FOR_SUBNET
        );

        subnetLocalDAO[totalSubnets] = _subnetLocalDAO;

        SubnetAttributes memory _subnetAttributes;
        _subnetAttributes.subnetType = _subnetType;
        _subnetAttributes.sovereignStatus = _sovereignStatus;
        _subnetAttributes.cloudProviderType = _cloudProviderType;
        _subnetAttributes.subnetStatusListed = _subnetStatusListed;
        _subnetAttributes.unitPrices = _unitPrices;
        _subnetAttributes.otherAttributes = _otherAttributes;
        _subnetAttributes.maxClusters = _maxClusters;
        _subnetAttributes.supportFeeRate = _supportFeeRate;
        _subnetAttributes.stackFeesReqd = _stackFeesReqd;

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
            _supportFeeRate,
            _msgSender(),
            _stackFeesReqd
        );
        emit NFTLockedForSubnet(_msgSender(), totalSubnets, nftId);

        whiteListedClusters[totalSubnets] = _whiteListedClusters;
        totalSubnets = totalSubnets.add(1);
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
        uint256 _supportFeeRate, // 7
        uint256 _stackFeesReqd // 8
    ) external onlyRole(SUBNET_ATTR_ROLE) {
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
            subnetAttributes[subnetId].supportFeeRate = _supportFeeRate;
        else if (_attributeNo == 8)
            subnetAttributes[subnetId].stackFeesReqd = _stackFeesReqd;

        emit SubnetAttributesChanged(
            subnetId,
            subnetAttributes[subnetId],
            _msgSender()
        );
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
            hasRole(WHITELIST_ROLE, _msgSender()) ||
                subnetLocalDAO[subnetId] == _msgSender(),
            "Only WHITELIST_ROLE or Local DAO can edit whitelisted addresses"
        );
        for (uint256 i = 0; i < _whitelistAddresses.length; i++) {
            whiteListedClusters[subnetId].push(_whitelistAddresses[i]);
        }
        emit AddedToWhitelistCluster(subnetId, _whitelistAddresses);
    }

    function removeClusterFromWhitelisted(
        uint256 subnetId,
        address _blacklistAddress,
        uint256 _index
    ) external {
        require(
            whiteListedClusters[subnetId][_index] == _blacklistAddress,
            "Address donot match with index provided"
        );
        require(
            hasRole(WHITELIST_ROLE, _msgSender()) ||
                subnetLocalDAO[subnetId] == _msgSender(),
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
        onlyRole(WHITELIST_ROLE)
    {
        require(
            subnetAttributes[subnetId].subnetType == 1,
            "Already public subnet"
        );
        require(
            hasRole(WHITELIST_ROLE, _msgSender()) ||
                subnetLocalDAO[subnetId] == _msgSender(),
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
            if (!subnetClusters[subnetId][i].listed)
                totalDelisted = totalDelisted.add(1);
        }

        uint256 totalSpotsFilled = totalSignedIn.sub(totalDelisted);
        return subnetAttributes[subnetId].maxClusters.sub(totalSpotsFilled);
    }

    function clusterSignUp(
        uint256 subnetId,
        string memory _DNSIP,
        address _clusterDAO,
        uint256 nftId
    ) external whenNotPaused {
        if (subnetAttributes[subnetId].sovereignStatus) {
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

        DarkMatterNFT.transferFrom(_msgSender(), address(this), nftId);
        StackToken.transferFrom(
            _msgSender(),
            address(this),
            subnetAttributes[subnetId].stackFeesReqd
        );
        balanceOfStackLocked[_clusterDAO] = balanceOfStackLocked[_clusterDAO]
            .add(subnetAttributes[subnetId].stackFeesReqd);

        uint256 clusterId = totalClustersSigned[subnetId];
        subnetClusters[subnetId][clusterId].ClusterDAO = _clusterDAO;
        subnetClusters[subnetId][clusterId].DNSIP = _DNSIP;
        subnetClusters[subnetId][clusterId].listed = true;

        totalClustersSigned[subnetId] = totalClustersSigned[subnetId].add(1);

        emit ClusterSignedUp(
            subnetId,
            clusterId,
            _DNSIP,
            _clusterDAO,
            _msgSender()
        );
        emit NFTLockedForCluster(_msgSender(), subnetId, clusterId, nftId);
    }

    function changeDNSIP(
        uint256 subnetId,
        uint256 clusterId,
        string memory newDNSIP
    ) external whenNotPaused {
        require(
            subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            "Sender is not Cluster owner"
        );
        subnetClusters[subnetId][clusterId].DNSIP = newDNSIP;
        emit ChangedDNSIP(subnetId, clusterId, newDNSIP);
    }

    function transferClusterDAOOwnership(
        uint256 subnetId,
        uint256 clusterId,
        address _newOwner
    ) external whenNotPaused {
        require(
            subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            "Not the cluster owner"
        );
        subnetClusters[subnetId][clusterId].ClusterDAO = _newOwner;
        emit TransferredClusterDAOOwnership(
            subnetId,
            clusterId,
            _msgSender(),
            _newOwner
        );
    }

    function changeListingCluster(
        uint256 subnetId,
        uint256 clusterId,
        bool _allow
    ) external {
        require(
            hasRole(CLUSTER_LIST_ROLE, _msgSender()) ||
                subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            "Sender is not Cluster owner or has CLUSTER_LIST_ROLE"
        );
        subnetClusters[subnetId][clusterId].listed = _allow;
        emit ChangedListingCluster(subnetId, clusterId, _msgSender(), _allow);
    }

    function requestClusterPriceChange(
        uint256 subnetId,
        uint256[] memory _unitPrices
    ) external onlyRole(PRICE_ROLE) {
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
    ) external onlyRole(WITHDRAW_STACK_ROLE) {
        balanceOfStackLocked[subnetClusters[subnetId][clusterId].ClusterDAO] = balanceOfStackLocked[subnetClusters[subnetId][clusterId].ClusterDAO]
            .sub(_amount);
        StackToken.transferFrom(address(this), _msgSender(), _amount);

        emit WithdrawnStackFromClusterByDAO(
            subnetId,
            clusterId,
            _msgSender(),
            _amount
        );
    }

    function withdrawStackFromClusterForDelistedSubnet(
        uint256 subnetId,
        uint256 clusterId
    ) external {
        // if subnet delisted ClusterDAO DAO can withdraw..
        require(
            !subnetAttributes[subnetId].subnetStatusListed,
            "Cannot withdraw Stack locked if subnet is not delisted"
        );

        require(
            subnetClusters[subnetId][clusterId].ClusterDAO == _msgSender(),
            "Only ClusterDAO DAO can withdraw Stack locked"
        );
        uint256 bal = balanceOfStackLocked[_msgSender()] = 0;

        balanceOfStackLocked[_msgSender()] = 0;
        StackToken.transferFrom(address(this), _msgSender(), bal);

        emit WithdrawnStackFromCluster(subnetId, clusterId, _msgSender());
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
