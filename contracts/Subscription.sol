// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract Subscription is AccessControlUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IRegistration public RegistrationContract;
    IERC721 public ApplicationNFT;
    ISubscriptionBalance public SubscriptionBalance;
    IERC20Upgradeable public XCT;

    bytes32 public constant CHANGE_COMPUTE_ROLE =
        keccak256("CHANGE_COMPUTE_ROLE");
    bytes32 public constant WITHDRAW_CREDITS_ROLE =
        keccak256("WITHDRAW_CREDITS_ROLE");
    bytes32 public constant CHANGE_SUBSCRIPTION_ROLE =
        keccak256("CHANGE_SUBSCRIPTION_ROLE");

    address public GLOBAL_DAO_ADDRESS;

    struct NFTSubnetAttribute {
        string serviceProviderAddress;
        address referralAddress;
        uint256 r_licenseFee;
        uint256[] computeRequired;
        bool subscribed;
    }

    // NFT id => SubnetID => NFTSubnetAttribute
    mapping(uint256 => mapping(uint256 => NFTSubnetAttribute))
        public userSubscription;

    // NFT ids => subnetids for view purpose only
    mapping(uint256 => uint256[]) public subscribedSubnetsOfNFT;
    // NFT ids => subnetids for view purpose only
    mapping(uint256 => uint256[]) public unsubscribedSubnetsOfNFT;

    uint256 public LIMIT_NFT_SUBNETS;
    uint256 public MIN_TIME_FUNDS;

    uint256 public REQD_NOTICE_TIME_S_PROVIDER; // eg. can request after 1 month
    uint256 public REQD_COOLDOWN_S_PROVIDER; // eg. will get changed in 15 days

    struct PriceChangeRequest {
        uint256 timestamp;
        string serviceProviderAddress;
        uint256 lastPriceChange;
    }

    // NFT id => Subnet ID =>
    mapping(uint256 => mapping(uint256 => PriceChangeRequest))
        public requestPriceChange;

    event Changed_LIMIT_NFT_SUBNETS(uint256 prev_limit, uint256 new_limit);

    event Changed_LIMIT_MIN_TIME_FUNDS(uint256 prev_limit, uint256 new_limit);

    event Changed_REQD_NOTICE_TIME_S_PROVIDER(
        uint256 prev_limit,
        uint256 new_limit
    );

    event Changed_REQD_COOLDOWN_S_PROVIDER(
        uint256 prev_limit,
        uint256 new_limit
    );

    event Changed_CHANGE_SUBSCRIPTION(
        uint256 nftId,
        uint256 subnetId,
        bool allow
    );

    event Subscribed(
        uint256 NFTId,
        uint256 subnetId,
        string serviceProviderAddress,
        address referralAddress,
        uint256 licenseFee,
        uint256[] computeRequired
    );

    event ReferralAdded(uint256 NFTId, uint256 subnetId, address refAddress);

    event ChangedSubnetSubscription(
        uint256 NFTId,
        uint256 currentSubnetId,
        uint256 newSubnetId
    );

    event RequestedServiceProviderChange(
        uint256 NFTId,
        uint256 subnetId,
        string newServiceProvider
    );

    event AppliedServiceProviderChange(
        uint256 NFTId,
        uint256 subnetId,
        string newServiceProvider
    );

    event Computes_changed(
        uint256 NFTid,
        uint256 subnetId,
        uint256[] computeRequired
    );

    function initialize(
        address _GlobalDAO,
        uint256 _LIMIT_NFT_SUBNETS,
        uint256 _MIN_TIME_FUNDS,
        IRegistration _RegistrationContract,
        IERC721 _ApplicationNFT,
        ISubscriptionBalance _SubscriptionBalance,
        IERC20Upgradeable _XCT,
        uint256 _REQD_NOTICE_TIME_S_PROVIDER,
        uint256 _REQD_COOLDOWN_S_PROVIDER
    ) public initializer {
        __AccessControl_init_unchained();
        __Pausable_init_unchained();

        _grantRole(DEFAULT_ADMIN_ROLE, _GlobalDAO);
        _grantRole(CHANGE_COMPUTE_ROLE, _GlobalDAO);
        _grantRole(WITHDRAW_CREDITS_ROLE, _GlobalDAO);
        _grantRole(CHANGE_SUBSCRIPTION_ROLE, _GlobalDAO);

        GLOBAL_DAO_ADDRESS = _GlobalDAO;

        LIMIT_NFT_SUBNETS = _LIMIT_NFT_SUBNETS;
        MIN_TIME_FUNDS = _MIN_TIME_FUNDS;
        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        SubscriptionBalance = _SubscriptionBalance;
        XCT = _XCT;
        REQD_NOTICE_TIME_S_PROVIDER = _REQD_NOTICE_TIME_S_PROVIDER;
        REQD_COOLDOWN_S_PROVIDER = _REQD_COOLDOWN_S_PROVIDER;

        _XCT.approve(address(_SubscriptionBalance), 2**256 - 1);
    }

    function getBytes32OfRole(string memory _roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_roleName));
    }

    function getReferralAddress(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (address)
    {
        return userSubscription[_nftId][_subnetId].referralAddress;
    }

    function r_licenseFee(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (uint256)
    {
        return userSubscription[_nftId][_subnetId].r_licenseFee;
    }

    function getComputesOfSubnet(uint256 NFTid, uint256 subnetId)
        external
        view
        returns (uint256[] memory)
    {
        return userSubscription[NFTid][subnetId].computeRequired;
    }

    function change__GLOBAL_DAO_ADDRESS(address _newGlobalDAO)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GLOBAL_DAO_ADDRESS = _newGlobalDAO;
    }

    function change__LIMIT_NFT_SUBNETS(uint256 _new_LIMIT_NFT_SUBNETS)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit Changed_LIMIT_NFT_SUBNETS(
            LIMIT_NFT_SUBNETS,
            _new_LIMIT_NFT_SUBNETS
        );
        LIMIT_NFT_SUBNETS = _new_LIMIT_NFT_SUBNETS;
    }

    function change__MIN_TIME_FUNDS(uint256 _new_MIN_TIME_FUNDS)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit Changed_LIMIT_MIN_TIME_FUNDS(MIN_TIME_FUNDS, _new_MIN_TIME_FUNDS);
        MIN_TIME_FUNDS = _new_MIN_TIME_FUNDS;
    }

    function change__REQD_NOTICE_TIME_S_PROVIDER(
        uint256 _REQD_NOTICE_TIME_S_PROVIDER
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit Changed_REQD_NOTICE_TIME_S_PROVIDER(
            REQD_NOTICE_TIME_S_PROVIDER,
            _REQD_NOTICE_TIME_S_PROVIDER
        );
        REQD_NOTICE_TIME_S_PROVIDER = _REQD_NOTICE_TIME_S_PROVIDER;
    }

    function change__REQD_COOLDOWN_S_PROVIDER(uint256 _REQD_COOLDOWN_S_PROVIDER)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit Changed_REQD_COOLDOWN_S_PROVIDER(
            REQD_COOLDOWN_S_PROVIDER,
            _REQD_COOLDOWN_S_PROVIDER
        );
        REQD_COOLDOWN_S_PROVIDER = _REQD_COOLDOWN_S_PROVIDER;
    }

    function change__CHANGE_SUBSCRIPTION(
        uint256 _nftId,
        uint256 _subnetId,
        bool allow
    ) external onlyRole(CHANGE_SUBSCRIPTION_ROLE) {
        userSubscription[_nftId][_subnetId].subscribed = allow;
        emit Changed_CHANGE_SUBSCRIPTION(_nftId, _subnetId, allow);
    }

    function changeComputesOfSubnet(
        uint256 _NFTid,
        uint256 _subnetId,
        uint256[] memory _computeRequired
    ) external onlyRole(CHANGE_COMPUTE_ROLE) whenNotPaused {
        userSubscription[_NFTid][_subnetId].computeRequired = _computeRequired;
        SubscriptionBalance.refreshEndOfBalance(_NFTid);
        emit Computes_changed(_NFTid, _subnetId, _computeRequired);
    }

    function subscribeBatchNew(
        uint256 _balanceToAdd,
        uint256[] memory subnetId,
        string[] memory _serviceProviderAddress,
        address[] memory _referralAddress,
        uint256[] memory _licenseFee,
        uint256[][] memory computeRequired
    ) external returns (uint256 NFTid) {
        NFTid = subscribeNew(
            _balanceToAdd,
            subnetId[0],
            _serviceProviderAddress[0],
            _referralAddress[0],
            _licenseFee[0],
            computeRequired[0]
        );
        for (uint256 i = 1; i < subnetId.length; i++) {
            subscribeToExistingNFT(
                NFTid,
                subnetId[i],
                _serviceProviderAddress[i],
                _referralAddress[i],
                _licenseFee[i],
                computeRequired[i]
            );
        }
        require(
            SubscriptionBalance.dripRatePerSec(NFTid).mul(MIN_TIME_FUNDS) <
                _balanceToAdd,
            "Balance added should be enough with MIN_TIME_FUNDS"
        );
    }

    function subscribeNew(
        uint256 _balanceToAdd,
        uint256 subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) public whenNotPaused returns (uint256) {
        // find next mint id
        uint256 NFTid = ApplicationNFT.getCurrentTokenId().add(1);
        ApplicationNFT.mint(_msgSender());

        XCT.transferFrom(_msgSender(), address(this), _balanceToAdd);

        _subscribeSubnet(
            NFTid,
            subnetId,
            _serviceProviderAddress,
            _referralAddress,
            _licenseFee,
            _computeRequired
        );

        SubscriptionBalance.subscribeNew(
            NFTid,
            _balanceToAdd,
            subnetId,
            _msgSender()
        );

        require(
            SubscriptionBalance.dripRatePerSecOfSubnet(NFTid, subnetId).mul(
                MIN_TIME_FUNDS
            ) < _balanceToAdd,
            "Balance added should be enough with MIN_TIME_FUNDS"
        );

        return NFTid;
    }

    function subscribeBatchToExistingNFT(
        uint256 _nftId,
        uint256[] memory subnetId,
        string[] memory _serviceProviderAddress,
        address[] memory _referralAddress,
        uint256[] memory _licenseFee,
        uint256[][] memory computeRequired
    ) external {
        for (uint256 i = 0; i < subnetId.length; i++) {
            subscribeToExistingNFT(
                _nftId,
                subnetId[i],
                _serviceProviderAddress[i],
                _referralAddress[i],
                _licenseFee[i],
                computeRequired[i]
            );
        }
    }

    function subscribeToExistingNFT(
        uint256 _nftId,
        uint256 _subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) public whenNotPaused {
        SubscriptionBalance.settleAccountBalance(_nftId);
        require(
            SubscriptionBalance.isBalancePresent(_nftId),
            "Balance for NFT id = 0, so cannot subscribe more subnets"
        );

        SubscriptionBalance.addSubnetToNFT(_nftId, _subnetId);

        _subscribeSubnet(
            _nftId,
            _subnetId,
            _serviceProviderAddress,
            _referralAddress,
            _licenseFee,
            _computeRequired
        );
    }

    function _subscribeSubnet(
        uint256 _nftId,
        uint256 _subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) internal {
        subscribedSubnetsOfNFT[_nftId].push(_subnetId);
        require(
            !userSubscription[_nftId][_subnetId].subscribed,
            "Already subscribed"
        );
        require(
            RegistrationContract.totalSubnets() > _subnetId,
            "_subnetId donot exist in RegistrationContract"
        );
        (, , , bool subnetStatusListed, , , , , ) = RegistrationContract
            .getSubnetAttributes(_subnetId);
        require(
            subnetStatusListed,
            "RegistrationContract: subnet is delisted and hence cannot be subscribed"
        );
        require(
            SubscriptionBalance.totalSubnets(_nftId) <= LIMIT_NFT_SUBNETS,
            "Cannot subscribe as limit exceeds to max Subnet subscription allowed per NFT"
        );
        require(
            ApplicationNFT.ownerOf(_nftId) == _msgSender(),
            "Sender not the owner of NFT id"
        );

        userSubscription[_nftId][_subnetId]
            .serviceProviderAddress = _serviceProviderAddress;
        userSubscription[_nftId][_subnetId].referralAddress = _referralAddress;
        userSubscription[_nftId][_subnetId].r_licenseFee = _licenseFee;
        userSubscription[_nftId][_subnetId].computeRequired = _computeRequired;
        userSubscription[_nftId][_subnetId].subscribed = true;

        emit Subscribed(
            _nftId,
            _subnetId,
            _serviceProviderAddress,
            _referralAddress,
            _licenseFee,
            _computeRequired
        );
    }

    function addReferralAddress(
        uint256 _nftId,
        uint256 _subnetId,
        address _refAddress
    ) external {
        require(
            userSubscription[_nftId][_subnetId].referralAddress == address(0),
            "Already set"
        );
        require(
            ApplicationNFT.ownerOf(_nftId) == _msgSender(),
            "Sender not the owner of NFT id"
        );
        userSubscription[_nftId][_subnetId].referralAddress = _refAddress;
        emit ReferralAdded(_nftId, _subnetId, _refAddress);
    }

    function changeSubnetSubscription(
        uint256 _nftId,
        uint256 _currentSubnetId,
        uint256 _newSubnetId
    ) external whenNotPaused {
        (, , , bool isListed, , , , , ) = RegistrationContract
            .getSubnetAttributes(_currentSubnetId);

        require(
            isListed,
            "Cannot change subscription if subnet is not delisted"
        );
        require(
            ApplicationNFT.ownerOf(_nftId) == _msgSender(),
            "Not the owner of NFT id"
        );
        require(
            userSubscription[_nftId][_currentSubnetId].subscribed,
            "_currentSubnetId is not subscribed by user"
        );

        userSubscription[_nftId][_newSubnetId].subscribed = true;
        userSubscription[_nftId][_newSubnetId]
            .serviceProviderAddress = userSubscription[_nftId][_currentSubnetId]
            .serviceProviderAddress;
        userSubscription[_nftId][_newSubnetId]
            .referralAddress = userSubscription[_nftId][_currentSubnetId]
            .referralAddress;
        userSubscription[_nftId][_newSubnetId].r_licenseFee = userSubscription[
            _nftId
        ][_currentSubnetId].r_licenseFee;
        userSubscription[_nftId][_newSubnetId]
            .computeRequired = userSubscription[_nftId][_currentSubnetId]
            .computeRequired;

        userSubscription[_nftId][_currentSubnetId].subscribed = false;
        unsubscribedSubnetsOfNFT[_nftId].push(_currentSubnetId);
        subscribedSubnetsOfNFT[_nftId].push(_newSubnetId);

        SubscriptionBalance.changeSubnet(
            _nftId,
            _currentSubnetId,
            _newSubnetId
        );

        emit ChangedSubnetSubscription(_nftId, _currentSubnetId, _newSubnetId);
    }

    // anyone can change if cooldown time passed
    function applyServiceProviderChange(uint256 _nftId, uint256 _subnetId)
        external
    {
        string memory empty = "";
        require(
            keccak256(
                bytes(
                    requestPriceChange[_nftId][_subnetId].serviceProviderAddress
                )
            ) != keccak256(bytes(empty)),
            "No request for service provider change done yet"
        );

        require(
            requestPriceChange[_nftId][_subnetId].timestamp.add(
                REQD_COOLDOWN_S_PROVIDER
            ) < block.timestamp,
            "Cannot apply before cooldown"
        ); // eg. will apply after 15 days
        requestPriceChange[_nftId][_subnetId].lastPriceChange = block.timestamp;
        userSubscription[_nftId][_subnetId]
            .serviceProviderAddress = requestPriceChange[_nftId][_subnetId]
            .serviceProviderAddress;

        requestPriceChange[_nftId][_subnetId].serviceProviderAddress = "";

        emit AppliedServiceProviderChange(
            _nftId,
            _subnetId,
            userSubscription[_nftId][_subnetId].serviceProviderAddress
        );
    }

    function requestServiceProviderChange(
        uint256 _nftId,
        uint256 _subnetId,
        string memory _newServiceProvider
    ) external {
        require(
            ApplicationNFT.ownerOf(_nftId) == _msgSender(),
            "Not the owner of NFT id"
        );
        require(
            userSubscription[_nftId][_subnetId].subscribed,
            "_subnetId is not subscribed by user's NFT"
        );
        require(
            requestPriceChange[_nftId][_subnetId].lastPriceChange.add(
                REQD_NOTICE_TIME_S_PROVIDER
            ) < block.timestamp,
            "Cannot request before REQD_NOTICE_TIME_S_PROVIDER passed"
        ); // eg. can request after 1 month

        requestPriceChange[_nftId][_subnetId].timestamp = block.timestamp;
        requestPriceChange[_nftId][_subnetId]
            .serviceProviderAddress = _newServiceProvider;

        emit RequestedServiceProviderChange(
            _nftId,
            _subnetId,
            _newServiceProvider
        );
    }
}
