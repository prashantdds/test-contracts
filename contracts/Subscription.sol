// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
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

    bytes32 public constant BRIDGE_ROLE =
        keccak256("BRIDGE_ROLE");

    bytes32 public constant SUBSCRIBE_ROLE =
        keccak256("SUBSCRIBE_ROLE");

    address public GLOBAL_DAO_ADDRESS;

    struct NFTSubnetAttribute {
        address referralAddress;
        address licenseAddress;
        address supportAddress;
        address platformAddress;
        uint256 licenseFee;
        uint256 supportPercentage;
        uint256[] computeRequired;
        bool subscribed;
        uint256 subnetArrayID;
        uint256 createTime;
    }

    // NFT id => SubnetID => NFTSubnetAttribute
    mapping(uint256 => mapping(uint256 => NFTSubnetAttribute))
    public userSubscription;

    // NFT ids => subnetids for view purpose only
    mapping(uint256 => uint256[]) public subscribedSubnetsOfNFT;
    mapping(uint256 => bool[]) public activeSubnetsOfNFT;

    struct SupportPercentage {
        uint256 supportPercentage;
        bool active;
    }

    struct SupportAddress {
        uint256 defaultPercentage;
        bool active;
    }

    address[] public supportAddressList;
    mapping(address => SupportAddress) supportAddressDefault;
    mapping(address => mapping(uint256 => SupportPercentage)) public supportAddressToNFT;
    mapping(uint256 => mapping(address => bool)) supportPercentChangeMap;

    struct PlatformAddress {
        uint256 platformPercentage;
        uint256 discountPercentage;
        uint256 referralPercentage;
        uint256 referralExpiryDuration;
        bool active;
    }

    address[] public platformAddressList;
    mapping(address => PlatformAddress) public platformAddressMap;

    uint256 public LIMIT_NFT_SUBNETS;
    uint256 public MIN_TIME_FUNDS;

    struct changeRequestTimeDuration
    {
        uint256 supportAddressNoticeDuration;
        uint256 supportAddressCooldownDuration;
    }

    changeRequestTimeDuration public CHANGE_REQUEST_DURATION;

    address public GLOBAL_SUPPORT_ADDRESS;

    struct ChangeRequest {
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
        address referralAddress,
        address licenseAddress,
        address supportAddress,
        address platformAddress,
        uint256 licenseFee,
        int256[] deltaCompute
    );

    event ReferralAdded(uint256 NFTId, uint256 subnetId, address referralAddress);

    event LicenseAdded(uint256 NFTId, uint256 subnetId, address licenseAddress);

    event ChangedSubnetSubscription(
        uint256 NFTId,
        uint256 currentSubnetId,
        uint256 newSubnetId
    );

    event RequestedSupportChange(
        uint256 nftID,
        uint256 subnetID,
        address newSupportAddress
    );

    event AppliedSupportChange(
        uint256 NFTId,
        uint256 subnetId,
        address supportAddress
    );

    event Computes_changed(
        uint256 NFTid,
        uint256 subnetId,
        uint256[] computeRequired
    );

    function getSubnetsOfNFT(
        uint256 nftID
    )
    public
    view
    returns(uint256[] memory)
    {
        return subscribedSubnetsOfNFT[nftID];
    }

    function getActiveSubnetsOfNFT(
        uint256 nftID
    )
    public
    view
    returns (bool[] memory)
    {
        return activeSubnetsOfNFT[nftID];
    }

    function isBridgeRole()
    public
    view
    returns (bool)
    {
        return hasRole(BRIDGE_ROLE, _msgSender());
    }

    function getBytes32OfRole(string memory _roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_roleName));
    }

    function getSubscribedSubnetsOfNFT(uint256 nftID)
    external
    returns(
        uint256[] memory,
        bool[] memory
    )
    {
        return(
            subscribedSubnetsOfNFT[nftID],
            activeSubnetsOfNFT[nftID]
        );
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

    function getPlatformAddress(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (address)
    {
        return userSubscription[_nftId][_subnetId].platformAddress;
    }

    function getReferralDuration(uint256 nftID, uint256 subnetID)
    public
    view
    returns(uint256)
    {
        return platformAddressMap[userSubscription[nftID][subnetID].platformAddress].referralExpiryDuration;
    }

    function r_licenseFee(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (uint256)
    {
        return userSubscription[_nftId][_subnetId].licenseFee;
    }

    function t_supportPercent(uint256 nftID, uint256 subnetID)
        public
        view
        returns (uint256)
    {
        return userSubscription[nftID][subnetID].supportPercentage;
    }

    function u_referralPercent(uint256 nftID, uint256 subnetID)
    public
    view
    returns (uint256)
    {
        return platformAddressMap[userSubscription[nftID][subnetID].platformAddress].referralPercentage;
    }

    function v_platformPercent(uint256 nftID, uint256 subnetID)
    public
    view
    returns (uint256)
    {
        return platformAddressMap[userSubscription[nftID][subnetID].platformAddress].platformPercentage;
    }

    function w_discountPercent(uint256 nftID, uint256 subnetID)
    public
    view
    returns (uint256)
    {
        address platformAddress = userSubscription[nftID][subnetID].platformAddress;
        uint256 createTime = userSubscription[nftID][subnetID].createTime;
        uint256 referralExpiryDuration = platformAddressMap[platformAddress].referralExpiryDuration;
        address referralAddress = userSubscription[nftID][subnetID].referralAddress;
        if(referralAddress != address(0) && ((createTime + referralExpiryDuration) > block.timestamp))
        {
            return platformAddressMap[userSubscription[nftID][subnetID].platformAddress].discountPercentage;
        }
        return 0;
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

    function changeSubscriptionStatus(
        uint256 _nftId,
        uint256 _subnetId,
        bool allow
    ) external onlyRole(CHANGE_SUBSCRIPTION_ROLE) {
        userSubscription[_nftId][_subnetId].subscribed = allow;
        emit Changed_CHANGE_SUBSCRIPTION(_nftId, _subnetId, allow);
    }

    function changeComputesOfSubnet(
        address subscriber,
        uint256 nftID,
        uint256 subnetID,
        uint256[] memory computeRequired
    ) external whenNotPaused {
        require(
            (_msgSender() == subscriber &&( ApplicationNFT.ownerOf(nftID) == subscriber))
            || hasRole(CHANGE_COMPUTE_ROLE, _msgSender())
            || isBridgeRole()
        , "Only the subscriber can call this function");
        require (
            userSubscription[nftID][subnetID].subscribed,
            "The NFT is not subscribed to this subnet"
        );

        SubscriptionBalance.updateBalance(nftID);

        userSubscription[nftID][subnetID].computeRequired = computeRequired;

        emit Computes_changed(nftID, subnetID, computeRequired);
    }

    function addDeltaComputes(
        uint256 nftID,
        uint256 subnetID,
        int256[] memory deltaCompute
    )
    public
    view
    returns (uint256[] memory)
    {

        uint256[] memory compute = new uint256[](deltaCompute.length);

        if(!userSubscription[nftID][subnetID].subscribed)
        {
            for(uint256 i = 0; i < deltaCompute.length; i++)
            {
                require(deltaCompute[i] >= 0, "Cannot subscribe with negative resource values");
                compute[i] = uint256(deltaCompute[i]);
            }
            return compute;
        }

        uint256[] memory subscribedCompute = userSubscription[nftID][subnetID].computeRequired;
        
        for(uint256 i = 0; i < subscribedCompute.length; i++)
        {
            int256 val = int256(subscribedCompute[i]) + deltaCompute[i];
            require(val >= 0, "Withdrawing more resources than purchased");
            
            compute[i] = uint256(val);
        }

        for(uint256 i = subscribedCompute.length; i < deltaCompute.length; i++)
        {
            require(deltaCompute[i] >= 0, "Cannot subscribe with negative resource values");
            compute[i] = uint256(deltaCompute[i]);
        }
    
        return compute;
    }


    function addSupportAddress(address supportAddress, uint256 defaultPercentage)
    public
    {
        require(_msgSender() == GLOBAL_DAO_ADDRESS
        || isBridgeRole()
        ,
         "Only the global dao address can add the support address");
        require(defaultPercentage >= 5000, "The default support fee should be greater than or equal to 5%");
        supportAddressDefault[supportAddress].defaultPercentage = defaultPercentage;
        supportAddressDefault[supportAddress].active = true;
        supportAddressList.push(supportAddress);
    }

    function addPlatformAddress(
    address platformAddress
    ,uint256 platformPercentage
    ,uint256 discountPercentage
    ,uint256 referralPercentage
    ,uint256 referralDuration
    )
    external
    {
        require(_msgSender() == GLOBAL_DAO_ADDRESS
        || isBridgeRole()
        ,
        "Only the global dao address can add the platform address");
        
        platformAddressList.push(platformAddress);
        platformAddressMap[platformAddress] = PlatformAddress(
            platformPercentage,
            discountPercentage,
            referralPercentage,
            referralDuration,
            true
        );
    }

    function setSupportFeesForNFT(address supportAddress, uint256 nftID, uint256 supportPercentage)
    external
    {
        require(supportAddressDefault[supportAddress].active, "You are not added as a support partner");
        require(
            supportAddress == _msgSender()
            || isBridgeRole(),
            "Only the support address can call this function"
        );
        require(supportPercentage >= 5000, "The support fee should be greater than or equal to 5%");

        supportAddressToNFT[supportAddress][nftID].supportPercentage = supportPercentage;
        supportAddressToNFT[supportAddress][nftID].active = true;
    }

    
    function approveNewSupportFees(address nftOwner, uint256 nftID, uint256 subnetID)
    external
    {
        require(
            ((nftOwner == _msgSender()) && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The address given should be the address of the nft owner"
        );

        address supportAddress = userSubscription[nftID][subnetID].supportAddress;
        require(supportAddressToNFT[supportAddress][nftID].active, "Support address has not added fees for the NFT");

        SubscriptionBalance.updateBalance(nftID);
        userSubscription[nftID][subnetID].supportPercentage = supportAddressToNFT[supportAddress][nftID].supportPercentage;
    }

    // function estimateDripRatePerSec (
    //     uint256 _nftId,
    //     uint256[] memory _subnetId,
    //     address[] memory _supportAddress,
    //     uint256[] memory _licenseFee,
    //     uint256[][] memory _computeRequired
    // )
    // internal
    // view
    // returns (uint256)
    // {
    //     // uint256 estimate = 0;
    //     uint256[] memory supportFee = new uint256[](_supportAddress.length);
        
    //     for(uint256 i = 0; i < _subnetId.length; i++)
    //     {
    //         supportFee[i] = getSupportFeesForNFT(_supportAddress[i], _nftId);
    //     }

    //     return SubscriptionBalance.estimateDripRatePerSec(
    //         _subnetId,
    //         supportFee,
    //         _licenseFee,
    //         _computeRequired
    //     );
    // }

    function subscribeBatch(
        address subscriber,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256[] memory _subnetId,
        address[] memory _referralAddress,
        address[] memory _licenseAddress,
        address[] memory _supportAddress,
        address[] memory _platformAddress,
        uint256[] memory _licenseFee,
        int256[][] memory _deltaCompute
    ) external {
        require(
            // (subscriber == _msgSender() && ApplicationNFT.ownerOf(_nftId) == subscriber)
             (
                isBridgeRole()
                || hasRole(SUBSCRIBE_ROLE, _msgSender())
            )
            ,
            "You do not have the role to call this function"
        );

        subscribeInternal(
            subscriber,
            SubscriptionBalance.isSubscribed(_nftId),
            _balanceToAdd,
            _nftId,
            _subnetId[0],
            _referralAddress[0],
            _licenseAddress[0],
            _supportAddress[0],
            _platformAddress[0],
            _licenseFee[0],
            _deltaCompute[0]
        );
    
        for (uint256 i = 1; i < _subnetId.length; i++)
        {
            subscribeInternal(
                subscriber,
                true,
                0,
                _nftId,
                _subnetId[i],
                _referralAddress[i],
                _licenseAddress[i],
                _supportAddress[i],
                _platformAddress[i],
                _licenseFee[i],
                _deltaCompute[i]
            );
        }

        uint256 totalBalance = SubscriptionBalance.totalPrevBalance(_nftId);

        if(totalBalance > 0)
        {
            require(
                SubscriptionBalance.dripRatePerSec(_nftId) * MIN_TIME_FUNDS
                    <= totalBalance,
                    "The total balance amount is not enough"
            );
        }
    }


    function subscribe(
        address subscriber,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256 _subnetId,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        address _platformAddress,
        uint256 _licenseFee,
        int256[] memory _deltaCompute
    ) public whenNotPaused {
        require(
            // (subscriber == _msgSender() && ApplicationNFT.ownerOf(_nftId) == subscriber)
            (subscriber == _msgSender())
            && (
                isBridgeRole()
                || hasRole(SUBSCRIBE_ROLE, _msgSender())
            )
            ,
            "You do not have the role to call this function"
        );

        subscribeInternal(
        subscriber,
        SubscriptionBalance.isSubscribed(_nftId),
        _balanceToAdd,
        _nftId,
        _subnetId,
        _referralAddress,
        _licenseAddress,
        _supportAddress,
        _platformAddress,
        _licenseFee,
        _deltaCompute
        );

        uint256 totalBalance = SubscriptionBalance.totalPrevBalance(_nftId);

        if(totalBalance > 0)
        {
            require(
                SubscriptionBalance.dripRatePerSec(_nftId) * MIN_TIME_FUNDS
                    <= totalBalance,
                    "The total balance amount is not enough"
            );
        }
    }


    function subscribeInternal(
        address nftOwner,
        bool isSubscribed,
        uint256 _balanceToAdd,
        uint256 _nftId,
        uint256 _subnetId,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        address _platformAddress,
        uint256 _licenseFee,
        int256[] memory _deltaCompute
    ) internal {

        if(isSubscribed)
        {
            // SubscriptionBalance.addSubnetToNFT(_nftId, _subnetId);
            _subscribeSubnet(
                // nftOwner,
                _nftId,
                _subnetId,
                _referralAddress,
                _licenseAddress,
                _supportAddress,
                _platformAddress,
                _licenseFee,
                _deltaCompute
            );
        }
        else {
            _subscribeSubnet(
                // nftOwner,
                _nftId,
                _subnetId,
                _referralAddress,
                _licenseAddress,
                _supportAddress,
                _platformAddress,
                _licenseFee,
                _deltaCompute
            );
            SubscriptionBalance.subscribeNew(
                _nftId,
                // _subnetId,
                nftOwner
            );
        }

        if(_balanceToAdd > 0)
        {
            XCT.transferFrom(nftOwner, address(this), _balanceToAdd);
            SubscriptionBalance.addBalance(address(this), _nftId, _balanceToAdd);
        }
        else {
            SubscriptionBalance.updateBalance(_nftId);
        }
    }

    function _subscribeSubnet(
        // address nftOwner,
        uint256 _nftId,
        uint256 _subnetId,
        address _referralAddress,
        address _licenseAddress,
        address _supportAddress,
        address _platformAddress,
        uint256 _licenseFee,
        int256[] memory deltaCompute
    ) internal {
        // require(
        //     !userSubscription[_nftId][_subnetId].subscribed,
        //     "Already subscribed"
        // );
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
            subscribedSubnetsOfNFT[_nftId].length <= LIMIT_NFT_SUBNETS,
            "Cannot subscribe as limit exceeds to max Subnet subscription allowed per NFT"
        );
        // require(
        //     ApplicationNFT.ownerOf(_nftId) == nftOwner,
        //     "Sender not the owner of NFT id"
        // );

        require(
            !userSubscription[_nftId][_subnetId].subscribed || (
            deltaCompute.length >=  userSubscription[_nftId][_subnetId].computeRequired.length),
            "The number of types of delta computes provided is less than the existing number of types of resources"
        );

        uint256[] memory computes = addDeltaComputes(
            _nftId,
            _subnetId,
            deltaCompute
        );
        
        userSubscription[_nftId][_subnetId].computeRequired = computes;
        if(userSubscription[_nftId][_subnetId].subscribed)
        {
            return;
        }

        require(
            // supportAddressToNFT[_supportAddress][0].active,
            supportAddressDefault[_supportAddress].active == true,
            "The support address given is not valid"
        );
        require(
            platformAddressMap[_platformAddress].active == true,
            "The platform address given is not valid"
        );
        
        userSubscription[_nftId][_subnetId].createTime = block.timestamp;
        userSubscription[_nftId][_subnetId].referralAddress = _referralAddress;
        userSubscription[_nftId][_subnetId].licenseAddress = _licenseAddress;
        userSubscription[_nftId][_subnetId].supportAddress = _supportAddress;
        userSubscription[_nftId][_subnetId].platformAddress = _platformAddress;
        userSubscription[_nftId][_subnetId].supportPercentage = getSupportFeesForNFT(_supportAddress, _nftId);
        userSubscription[_nftId][_subnetId].licenseFee = _licenseFee;
        userSubscription[_nftId][_subnetId].subscribed = true;
        userSubscription[_nftId][_subnetId].subnetArrayID = subscribedSubnetsOfNFT[_nftId].length;
        subscribedSubnetsOfNFT[_nftId].push(_subnetId);
        activeSubnetsOfNFT[_nftId].push(true);

        emit Subscribed(
            _nftId,
            _subnetId,
            _referralAddress,
            _licenseAddress,
            _supportAddress,
            _platformAddress,
            _licenseFee,
            deltaCompute
        );
    }

    function addReferralAddress(
        address nftOwner,
        uint256 _nftId,
        uint256 _subnetId,
        address _referralAddress
    ) external {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(_nftId) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        require(
            userSubscription[_nftId][_subnetId].referralAddress == address(0),
            "Already set"
        );

        SubscriptionBalance.updateBalance(_nftId);

        userSubscription[_nftId][_subnetId].referralAddress = _referralAddress;
        emit ReferralAdded(_nftId, _subnetId, _referralAddress);
    }

    function changeSubnetSubscription(
        address nftOwner,
        uint256 _nftId,
        uint256 _currentSubnetId,
        uint256 _newSubnetId
    ) external whenNotPaused {
        (, , , bool isListed, , , , , ) = RegistrationContract
            .getSubnetAttributes(_currentSubnetId);
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(_nftId) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        require(
            !isListed,
            "Cannot change subscription if subnet is not delisted"
        );
        require(
            ApplicationNFT.ownerOf(_nftId) == nftOwner,
            "Not the owner of NFT id"
        );
        require(
            userSubscription[_nftId][_currentSubnetId].subscribed,
            "_currentSubnetId is not subscribed by user"
        );

        SubscriptionBalance.updateBalance(_nftId);

        userSubscription[_nftId][_newSubnetId].subscribed = true;
        userSubscription[_nftId][_newSubnetId].referralAddress 
            = userSubscription[_nftId][_currentSubnetId].referralAddress;
        userSubscription[_nftId][_newSubnetId].licenseAddress
            = userSubscription[_nftId][_currentSubnetId].licenseAddress;
        userSubscription[_nftId][_newSubnetId].platformAddress
            = userSubscription[_nftId][_currentSubnetId].platformAddress;
        userSubscription[_nftId][_newSubnetId].supportAddress 
            = userSubscription[_nftId][_currentSubnetId].supportAddress;
        userSubscription[_nftId][_newSubnetId].licenseFee
            = userSubscription[_nftId][_currentSubnetId].licenseFee;
        userSubscription[_nftId][_newSubnetId].supportPercentage
            = userSubscription[_nftId][_currentSubnetId].supportPercentage;
        userSubscription[_nftId][_newSubnetId].computeRequired 
            = userSubscription[_nftId][_currentSubnetId].computeRequired;
        userSubscription[_nftId][_currentSubnetId].subscribed = false;

        uint256 curSubnetID = userSubscription[_nftId][_currentSubnetId].subnetArrayID;
        delete subscribedSubnetsOfNFT[_nftId][curSubnetID];
        activeSubnetsOfNFT[_nftId][curSubnetID] = false;

        userSubscription[_nftId][_currentSubnetId].subnetArrayID = subscribedSubnetsOfNFT[_nftId].length;
        subscribedSubnetsOfNFT[_nftId].push(_newSubnetId);
        activeSubnetsOfNFT[_nftId].push(true);

        // SubscriptionBalance.changeSubnet(
        //     _nftId,
        //     _currentSubnetId,
        //     _newSubnetId
        // );

        emit ChangedSubnetSubscription(_nftId, _currentSubnetId, _newSubnetId);
    }

    function applySupportPercentage(address nftOwner, uint256 nftID, uint256 subnetID)
    public
    {
        require(
            // nftOwner == _msgSender()
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        // require(ApplicationNFT.ownerOf(nftID) == nftOwner, "only the owner of the NFT can approve support percentage change");
        address supportAddress = userSubscription[nftID][subnetID].supportAddress;
        require(supportAddressToNFT[supportAddress][nftID].active, "Support address has not changed fees");
        SubscriptionBalance.updateBalance(nftID);


        userSubscription[nftID][subnetID].supportPercentage = supportAddressToNFT[supportAddress][nftID].supportPercentage;
        supportAddressToNFT[supportAddress][nftID].active = false;
    }


    // anyone can change if cooldown time passed
    function applySupportChange(address nftOwner, uint256 nftID, uint256 subnetID)
        external
    {
        // string memory empty = "";
        require(
            // nftOwner == _msgSender()
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        // require(ApplicationNFT.ownerOf(nftID) == nftOwner, "only the owner of the NFT can approve changes");
        require(
            requestChangeMap[nftID][subnetID].supportAddress != address(0),
            "No change request to support address made"
        );
        require(
            requestChangeMap[nftID][subnetID].SupportAddressApplyTime.add(
                CHANGE_REQUEST_DURATION.supportAddressCooldownDuration
            ) <= block.timestamp,
            "Cannot apply before cooldown"
        ); // eg. will apply after 15 days
        SubscriptionBalance.updateBalance(nftID);

        address newSupportAddress = requestChangeMap[nftID][subnetID].supportAddress;

        requestChangeMap[nftID][subnetID].SupportAddressApplyTime = block.timestamp;
        userSubscription[nftID][subnetID]
            .supportAddress = newSupportAddress;
        userSubscription[nftID][subnetID]
            .supportPercentage = getSupportFeesForNFT(userSubscription[nftID][subnetID].supportAddress, nftID);
        requestChangeMap[nftID][subnetID].supportAddress = address(0);

        emit AppliedSupportChange (
            nftID,
            subnetID,
            newSupportAddress
        );
    }

    function requestSupportChange(
        address nftOwner,
        uint256 nftID,
        uint256 subnetID,
        address newSupportAddress
    ) external {
        // string memory empty = "";
        require(
            // nftOwner == _msgSender()
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        // require(
        //     ApplicationNFT.ownerOf(nftID) == nftOwner,
        //     "Not the owner of NFT id"
        // );
        require(
            userSubscription[nftID][subnetID].subscribed,
            "_subnetId is not subscribed by user's NFT"
        );
        require(
            newSupportAddress != address(0),
            "support address should be provided with a non zero address value"
        );
        require(
            requestChangeMap[nftID][subnetID].SupportAddressRequestTime.add(
                CHANGE_REQUEST_DURATION.supportAddressNoticeDuration
            ) < block.timestamp,
            "Cannot request before support address change notice time passed"
        );
        
        requestChangeMap[nftID][subnetID].SupportAddressRequestTime = block.timestamp;
        requestChangeMap[nftID][subnetID].SupportAddressApplyTime = block.timestamp;
        requestChangeMap[nftID][subnetID].supportAddress = newSupportAddress;

        emit RequestedSupportChange(
            nftID,
            subnetID,
            newSupportAddress
        );

    }

    function changeLicenseAddress(
        address caller,
        address newLicenseAddress,
        uint256 nftID,
        uint256 subnetID
    )
    public
    {
        require(
            (caller == _msgSender() && (userSubscription[nftID][subnetID].licenseAddress == caller))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        require(
            userSubscription[nftID][subnetID].subscribed,
            "_subnetId is not subscribed by user's NFT"
        );
        require(
            newLicenseAddress != address(0),
            "license address should be provided with a non zero address value"
        );

        userSubscription[nftID][subnetID].licenseAddress = newLicenseAddress;
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
        _grantRole(BRIDGE_ROLE, _GlobalDAO);
        _grantRole(SUBSCRIBE_ROLE, _GlobalDAO);

        GLOBAL_DAO_ADDRESS = _GlobalDAO;

        LIMIT_NFT_SUBNETS = _LIMIT_NFT_SUBNETS;
        MIN_TIME_FUNDS = _MIN_TIME_FUNDS;
        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        SubscriptionBalance = _SubscriptionBalance;
        XCT = _XCT;

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
