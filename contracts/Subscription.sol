// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "hardhat/console.sol";

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
        address licenseAddress;
        address supportAddress;
        uint256 r_licenseFee;
        uint256 supportPercentage;
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

    struct SupportPercentage {
        uint256 supportPercentage;
        bool active;
    }

    struct SupportAddress {
        uint256 defaultPercentage;
        bool active;
    }

    mapping(address => SupportAddress) supportAddressDefault;
    mapping(address => mapping(uint256 => SupportPercentage)) public supportAddressToNFT;
    mapping(uint256 => mapping(address => bool)) supportPercentChangeMap;

    uint256 public LIMIT_NFT_SUBNETS;
    uint256 public MIN_TIME_FUNDS;

    struct changeRequestTimeDuration
    {
        uint256 serviceAddressNoticeDuration;
        uint256 serviceAddressCooldownDuration;

        uint256 supportAddressNoticeDuration;
        uint256 supportAddressCooldownDuration;
    }

    changeRequestTimeDuration public CHANGE_REQUEST_DURATION;

    address public GLOBAL_SUPPORT_ADDRESS;

    struct ChangeRequest {
        uint256 ServiceAddressRequestTime;
        uint256 ServiceAddressApplyTime;
        string serviceProviderAddress;

        uint256 SupportAddressRequestTime;
        uint256 SupportAddressApplyTime;
        address supportAddress;
    }

    // NFT id => Subnet ID =>
    mapping(uint256 => mapping(uint256 => ChangeRequest))
    public requestChangeMap;

    event ChangedNFTSubnetLimit(uint256 prev_limit, uint256 new_limit);

    event ChangedMinTimeFunds(uint256 prev_limit, uint256 new_limit);

    event ChangedSupportAddressNotice(
        uint256 prev_limit,
        uint256 new_limit
    );

    event ChangedSupportAddressCooldown(
        uint256 prev_limit,
        uint256 new_limit
    );

    event ChangedServiceAddressNotice(
        uint256 prev_limit,
        uint256 new_limit
    );

    event ChangedServiceAddressCooldown(
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
        address licenseAddress,
        address supportAddress,
        uint256 licenseFee,
        uint256[] computeRequired
    );

    event ReferralAdded(uint256 NFTId, uint256 subnetId, address referralAddress);

    event LicenseAdded(uint256 NFTId, uint256 subnetId, address licenseAddress);

    event ChangedSubnetSubscription(
        uint256 NFTId,
        uint256 currentSubnetId,
        uint256 newSubnetId
    );

    event RequestedChange(
        uint256 nftID,
        uint256 subnetID,
        string newServiceProvider,
        address newSupportAddress,
        address newLicenseAddress
    );

    event AppliedChange(
        uint256 NFTId,
        uint256 subnetId,
        string newServiceProvider,
        address supportAddress
    );

    event Computes_changed(
        uint256 NFTid,
        uint256 subnetId,
        uint256[] computeRequired
    );

    function getBytes32OfRole(string memory _roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_roleName));
    }

    function getServiceProviderAddress(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (string memory)
    {
        return userSubscription[_nftId][_subnetId].serviceProviderAddress;
    }

    function getReferralAddress(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (address)
    {
        return userSubscription[_nftId][_subnetId].referralAddress;
    }

    function getLicenseAddress(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (address)
    {
        return userSubscription[_nftId][_subnetId].licenseAddress;
    }

    function getSupportAddress(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (address)
    {
        return userSubscription[_nftId][_subnetId].supportAddress;
    }

    function r_licenseFee(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (uint256)
    {
        return userSubscription[_nftId][_subnetId].r_licenseFee;
    }

    function getSupportFeesForNFT(address supportAddress, uint256 nftID)
    view
    public
    returns (uint256 supportPercentage)
    {
        if(supportAddressToNFT[supportAddress][nftID].active) {
           supportPercentage = supportAddressToNFT[supportAddress][nftID].supportPercentage;
        }
        else if(supportAddressDefault[supportAddress].active == true) {
            supportPercentage = supportAddressDefault[supportAddress].defaultPercentage;
        }
        else {
            supportPercentage = supportAddressDefault[GLOBAL_SUPPORT_ADDRESS].defaultPercentage;
        }
    }

    function t_supportFee(uint256 nftID, uint256 subnetID)
        public
        view
        returns (uint256)
    {
        // return 10000;
        return userSubscription[nftID][subnetID].supportPercentage;
    }

    function getComputesOfSubnet(uint256 NFTid, uint256 subnetId)
        external
        view
        returns (uint256[] memory)
    {
        return userSubscription[NFTid][subnetId].computeRequired;
    }

    function checkSubscribed(uint256 nftID, uint256 subnetID)
    external
    view
    returns (bool)
    {
        return userSubscription[nftID][subnetID].subscribed;
    }

    function admin_changeGlobalDAO(address _newGlobalDAO)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GLOBAL_DAO_ADDRESS = _newGlobalDAO;
    }

    function admin_changeNFTSubnetLimit(uint256 _new_LIMIT_NFT_SUBNETS)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedNFTSubnetLimit(
            LIMIT_NFT_SUBNETS,
            _new_LIMIT_NFT_SUBNETS
        );
        LIMIT_NFT_SUBNETS = _new_LIMIT_NFT_SUBNETS;
    }

    function admin_changeMinTimeFunds(uint256 _new_MIN_TIME_FUNDS)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedMinTimeFunds(MIN_TIME_FUNDS, _new_MIN_TIME_FUNDS);
        MIN_TIME_FUNDS = _new_MIN_TIME_FUNDS;
    }

    function admin_changeServiceAddressNotice(uint256 serviceAddressNoticeDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedServiceAddressNotice(
            CHANGE_REQUEST_DURATION.serviceAddressNoticeDuration,
            serviceAddressNoticeDuration
        );
        CHANGE_REQUEST_DURATION.serviceAddressNoticeDuration = serviceAddressNoticeDuration;
    }

    function admin_changeServiceAddressCooldown(uint256 serviceAddressCooldownDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedServiceAddressCooldown(
            CHANGE_REQUEST_DURATION.serviceAddressCooldownDuration,
            serviceAddressCooldownDuration
        );

        CHANGE_REQUEST_DURATION.serviceAddressCooldownDuration = serviceAddressCooldownDuration;
    }

    function admin_changeSupportAddressCooldown(uint256 supportAddressCooldownDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedSupportAddressCooldown(
            CHANGE_REQUEST_DURATION.supportAddressCooldownDuration,
            supportAddressCooldownDuration
        );
        CHANGE_REQUEST_DURATION.supportAddressCooldownDuration = supportAddressCooldownDuration;
    }

    function admin_changeSupportAddressNotice(uint256 supportAddressNoticeDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedSupportAddressNotice(
            CHANGE_REQUEST_DURATION.supportAddressNoticeDuration,
            supportAddressNoticeDuration
        );
        CHANGE_REQUEST_DURATION.supportAddressNoticeDuration = supportAddressNoticeDuration;
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
        SubscriptionBalance.updateBalance(_NFTid);
        emit Computes_changed(_NFTid, _subnetId, _computeRequired);
    }

    function addSupportAddress(address supportAddress, uint256 defaultPercentage)
    public
    {
        require(_msgSender() == GLOBAL_DAO_ADDRESS, "Only the global dao address can add the support address");
        require(defaultPercentage >= 5000, "The default support fee should be greater than or equal to 5%");
        // require(!supportAddressDefault[supportAddress].active, "The support address already exists");
        supportAddressDefault[supportAddress].defaultPercentage = defaultPercentage;
        supportAddressDefault[supportAddress].active = true;
    }

    function addSupportFeesForNFT(uint256 nftID, uint256 supportPercentage)
    external
    {
        address supportAddress = _msgSender();
        require(supportAddressDefault[supportAddress].active, "You are not added as a support partner");
        supportAddressToNFT[supportAddress][nftID].supportPercentage = supportPercentage;
        supportAddressToNFT[supportAddress][nftID].active = true;
    }

    function estimateDripRate (
        uint256 _nftId,
        uint256[] memory _subnetId,
        address[] memory _referralAddress,
        address[] memory _supportAddress,
        uint256[] memory _licenseFee,
        uint256[][] memory _computeRequired
    )
    internal
    returns (uint256)
    {
        uint256 estimate = 0;
        for(uint256 i = 0; i < _subnetId.length; i++)
        {
            estimate += SubscriptionBalance.estimateDripRatePerSecOfSubnet(
                _subnetId[i], 
                _licenseFee[i],
                getSupportFeesForNFT(_supportAddress[i], _nftId),
                _computeRequired[i]
            );
        }
        return estimate;
    }

    function subscribeBatch(
        bool isExistingNFT,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256[] memory _subnetId,
        string[] memory _serviceProviderAddress,
        address[] memory _referralAddress,
        address[] memory _licenseAddress,
        address[] memory _supportAddress,
        uint256[] memory _licenseFee,
        uint256[][] memory _computeRequired
    ) external {

        uint256 totalBalance = _balanceToAdd;

        if(!isExistingNFT)
        {
            _nftId = ApplicationNFT.getCurrentTokenId().add(1);
            ApplicationNFT.mint(_msgSender());
        }
        else {
            totalBalance += SubscriptionBalance.totalPrevBalance(_nftId);
        }

        if(totalBalance > 0)
        {
            uint256 dripRate = 
                    estimateDripRate(
                        _nftId,
                        _subnetId,
                        _referralAddress,
                        _supportAddress,
                        _licenseFee,
                        _computeRequired
                    );

            if(isExistingNFT)
            {
                dripRate += SubscriptionBalance.dripRatePerSec(_nftId);
            }

            require(((
                dripRate
            ) * MIN_TIME_FUNDS) < totalBalance, "The total balance amount is not enough");

        }

        subscribeInternal(
            SubscriptionBalance.isSubscribed(_nftId),
            _balanceToAdd,
            _nftId,
            _subnetId[0],
            _serviceProviderAddress[0],
            _referralAddress[0],
            _licenseAddress[0],
            _supportAddress[0],
            _licenseFee[0],
            _computeRequired[0]
        );
    
        for (uint256 i = 1; i < _subnetId.length; i++)
        {
            subscribeInternal(
                true,
                0,
                _nftId,
                _subnetId[i],
                _serviceProviderAddress[i],
                _referralAddress[i],
                _licenseAddress[i],
                _supportAddress[i],
                _licenseFee[i],
                _computeRequired[i]
            );
        }
    }


    function subscribe(
        bool isExistingNFT,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256 _subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) public whenNotPaused {


        uint256 totalBalance = _balanceToAdd;

        if(!isExistingNFT)
        {
            _nftId = ApplicationNFT.getCurrentTokenId().add(1);
            ApplicationNFT.mint(_msgSender());
        }
        else {
            totalBalance += SubscriptionBalance.totalPrevBalance(_nftId);
        }

        if(totalBalance > 0)
        {
            uint256 estimate = SubscriptionBalance.estimateDripRatePerSecOfSubnet(
                _subnetId,
                _licenseFee,
                getSupportFeesForNFT(_supportAddress, _nftId),
                _computeRequired
            );
            if(isExistingNFT)
            {
                estimate += SubscriptionBalance.dripRatePerSec(_nftId);
            }
            
            require((estimate * MIN_TIME_FUNDS) < totalBalance, "The total balance amount is not enough");
        }

        subscribeInternal(
        SubscriptionBalance.isSubscribed(_nftId),
        _balanceToAdd,
        _nftId,
        _subnetId,
        _serviceProviderAddress,
        _referralAddress,
        _licenseAddress,
        _supportAddress,
        _licenseFee,
        _computeRequired
        );
    }

    function subscribeInternal(
        bool isSubscribed,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256 _subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) internal {

        if(isSubscribed)
        {
            SubscriptionBalance.addSubnetToNFT(_nftId, _subnetId);
            _subscribeSubnet(
                _nftId,
                _subnetId,
                _serviceProviderAddress,
                _referralAddress,
                _licenseAddress,
                _supportAddress,
                _licenseFee,
                _computeRequired
            );
        }
        else {
            _subscribeSubnet(
                _nftId,
                _subnetId,
                _serviceProviderAddress,
                _referralAddress,
                _licenseAddress,
                _supportAddress,
                _licenseFee,
                _computeRequired
            );
            SubscriptionBalance.subscribeNew(
                _nftId,
                _subnetId,
                _msgSender()
            );
        }

        if(_balanceToAdd > 0)
        {
            XCT.transferFrom(_msgSender(), address(this), _balanceToAdd);
            SubscriptionBalance.addBalance(_nftId, _balanceToAdd);
        }
        else {
            SubscriptionBalance.updateBalance(_nftId);
        }
    }

    function _subscribeSubnet(
        uint256 _nftId,
        uint256 _subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) internal {
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
        require(
            // supportAddressToNFT[_supportAddress][0].active,
            supportAddressDefault[_supportAddress].active == true,
            "The support address given is not valid"
        );

        subscribedSubnetsOfNFT[_nftId].push(_subnetId);
        userSubscription[_nftId][_subnetId].serviceProviderAddress = _serviceProviderAddress;
        userSubscription[_nftId][_subnetId].referralAddress = _referralAddress;
        userSubscription[_nftId][_subnetId].licenseAddress = _licenseAddress;
        userSubscription[_nftId][_subnetId].supportAddress = _supportAddress;
        userSubscription[_nftId][_subnetId].supportPercentage = getSupportFeesForNFT(_supportAddress, _nftId);
        userSubscription[_nftId][_subnetId].r_licenseFee = _licenseFee;
        userSubscription[_nftId][_subnetId].computeRequired = _computeRequired;
        userSubscription[_nftId][_subnetId].subscribed = true;

        emit Subscribed(
            _nftId,
            _subnetId,
            _serviceProviderAddress,
            _referralAddress,
            _licenseAddress,
            _supportAddress,
            _licenseFee,
            _computeRequired
        );
    }

    function addReferralAddress(
        uint256 _nftId,
        uint256 _subnetId,
        address _referralAddress
    ) external {
        require(
            userSubscription[_nftId][_subnetId].referralAddress == address(0),
            "Already set"
        );
        require(
            ApplicationNFT.ownerOf(_nftId) == _msgSender(),
            "Sender not the owner of NFT id"
        );
        userSubscription[_nftId][_subnetId].referralAddress = _referralAddress;
        emit ReferralAdded(_nftId, _subnetId, _referralAddress);
    }

    function changeSubnetSubscription(
        uint256 _nftId,
        uint256 _currentSubnetId,
        uint256 _newSubnetId
    ) external whenNotPaused {
        (, , , bool isListed, , , , , ) = RegistrationContract
            .getSubnetAttributes(_currentSubnetId);

        require(
            !isListed,
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
        userSubscription[_nftId][_newSubnetId].serviceProviderAddress
            = userSubscription[_nftId][_currentSubnetId].serviceProviderAddress;
        userSubscription[_nftId][_newSubnetId].referralAddress 
            = userSubscription[_nftId][_currentSubnetId].referralAddress;
        userSubscription[_nftId][_newSubnetId].licenseAddress
            = userSubscription[_nftId][_currentSubnetId].licenseAddress;
        userSubscription[_nftId][_newSubnetId].supportAddress 
            = userSubscription[_nftId][_currentSubnetId].supportAddress;
        userSubscription[_nftId][_newSubnetId].r_licenseFee
            = userSubscription[_nftId][_currentSubnetId].r_licenseFee;
        userSubscription[_nftId][_newSubnetId].supportPercentage
            = userSubscription[_nftId][_currentSubnetId].supportPercentage;
        userSubscription[_nftId][_newSubnetId].computeRequired 
            = userSubscription[_nftId][_currentSubnetId].computeRequired;

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

    function applySupportPercentage(uint256 nftID, uint256 subnetID)
    public
    {
        require(ApplicationNFT.ownerOf(nftID) == _msgSender(), "only the owner of the NFT can approve support percentage change");
        address supportAddress = userSubscription[nftID][subnetID].supportAddress;
        userSubscription[nftID][subnetID].supportPercentage = supportAddressToNFT[supportAddress][nftID].supportPercentage;
        supportAddressToNFT[supportAddress][nftID].active = false;
    }


    // anyone can change if cooldown time passed
    function applyChange(uint256 nftID, uint256 subnetID)
        external
    {
        string memory empty = "";
        bool changedServiceFlag = false;
        bool changedSupportFlag = false;
        if(keccak256(
                bytes(
                    requestChangeMap[nftID][subnetID].serviceProviderAddress
                )
            ) != keccak256(bytes(empty)))
        {
            require(
                requestChangeMap[nftID][subnetID].ServiceAddressApplyTime.add(
                    CHANGE_REQUEST_DURATION.serviceAddressCooldownDuration
                ) < block.timestamp,
                "Cannot apply before cooldown"
            ); // eg. will apply after 15 days
            requestChangeMap[nftID][subnetID].ServiceAddressApplyTime = block.timestamp;
            userSubscription[nftID][subnetID]
                .serviceProviderAddress = requestChangeMap[nftID][subnetID]
                .serviceProviderAddress;
            requestChangeMap[nftID][subnetID].serviceProviderAddress = "";
            changedServiceFlag = true;
        }
        if(requestChangeMap[nftID][subnetID].supportAddress != address(0))
        {
            require(
                requestChangeMap[nftID][subnetID].SupportAddressApplyTime.add(
                    CHANGE_REQUEST_DURATION.supportAddressCooldownDuration
                ) < block.timestamp,
                "Cannot apply before cooldown"
            ); // eg. will apply after 15 days

            requestChangeMap[nftID][subnetID].SupportAddressApplyTime = block.timestamp;
            userSubscription[nftID][subnetID]
                .serviceProviderAddress = requestChangeMap[nftID][subnetID]
                .serviceProviderAddress;
            requestChangeMap[nftID][subnetID].supportAddress = address(0);
            changedSupportFlag = true;
        }

        if(changedServiceFlag || changedSupportFlag)
        {
            address supportAddress = address(0);
            string memory serviceProvider = "";

            if(changedServiceFlag) {
                serviceProvider = userSubscription[nftID][subnetID].serviceProviderAddress;
            }

            if(changedSupportFlag) {
                supportAddress = userSubscription[nftID][subnetID].supportAddress;
            }

            emit AppliedChange (
                nftID,
                subnetID,
                serviceProvider,
                supportAddress
            );
        }

        require(
            changedServiceFlag || changedSupportFlag,
            "No request for any change done yet"
        );
    }

    function requestChange(
        uint256 nftID,
        uint256 subnetID,
        string memory newServiceProvider,
        address newSupportAddress,
        address newLicenseAddress
    ) external {
        string memory empty = "";
        require(
            ApplicationNFT.ownerOf(nftID) == _msgSender(),
            "Not the owner of NFT id"
        );
        require(
            userSubscription[nftID][subnetID].subscribed,
            "_subnetId is not subscribed by user's NFT"
        );

        bool changeFlag = false;

        if(keccak256(
                bytes(
                    newServiceProvider
                )
            ) != keccak256(bytes(empty)))
        {
            require(
                requestChangeMap[nftID][subnetID].ServiceAddressRequestTime.add(
                    CHANGE_REQUEST_DURATION.serviceAddressNoticeDuration
                ) < block.timestamp,
                "Cannot request before service provider change notice time passed"
            );

            requestChangeMap[nftID][subnetID].ServiceAddressRequestTime = block.timestamp;
            requestChangeMap[nftID][subnetID].ServiceAddressApplyTime = block.timestamp;
            requestChangeMap[nftID][subnetID].serviceProviderAddress = newServiceProvider;
            changeFlag = true;
        }
        if(newSupportAddress != address(0))
        {
            require(
                requestChangeMap[nftID][subnetID].SupportAddressRequestTime.add(
                    CHANGE_REQUEST_DURATION.supportAddressNoticeDuration
                ) < block.timestamp,
                "Cannot request before support address change notice time passed"
            );
            requestChangeMap[nftID][subnetID].SupportAddressRequestTime = block.timestamp;
            requestChangeMap[nftID][subnetID].ServiceAddressApplyTime = block.timestamp;
            requestChangeMap[nftID][subnetID].supportAddress = newSupportAddress;
            changeFlag = true;
        }
        if(newLicenseAddress != address(0))
        {
            require(
                userSubscription[nftID][subnetID].licenseAddress == _msgSender(),
                "Only license address owner can change the license address"
            );

            userSubscription[nftID][subnetID].licenseAddress = newLicenseAddress;
            changeFlag = true;
        }


        if(changeFlag)
        {
            emit RequestedChange(
                nftID,
                subnetID,
                newServiceProvider,
                newSupportAddress,
                newLicenseAddress
            );
        }
    }

    function initialize(
        address _GlobalDAO,
        uint256 _LIMIT_NFT_SUBNETS,
        uint256 _MIN_TIME_FUNDS,
        address _globalSupportAddress,
        uint256 _GLOBAL_SUPPORT_FEE,
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

        CHANGE_REQUEST_DURATION.serviceAddressNoticeDuration = _REQD_NOTICE_TIME_S_PROVIDER;
        CHANGE_REQUEST_DURATION.serviceAddressCooldownDuration = _REQD_COOLDOWN_S_PROVIDER;

        CHANGE_REQUEST_DURATION.supportAddressNoticeDuration = _REQD_NOTICE_TIME_S_PROVIDER;
        CHANGE_REQUEST_DURATION.supportAddressCooldownDuration = _REQD_COOLDOWN_S_PROVIDER;


        GLOBAL_SUPPORT_ADDRESS = _globalSupportAddress;
        supportAddressDefault[GLOBAL_SUPPORT_ADDRESS] = SupportAddress(
            _GLOBAL_SUPPORT_FEE,
            true
        );

        _XCT.approve(address(_SubscriptionBalance), 2**256 - 1);
    }
}
