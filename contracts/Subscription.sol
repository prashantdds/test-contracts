// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/IApplicationNFT.sol";
import "./interfaces/ISubscriptionBalance.sol";
import "./interfaces/IBalanceCalculator.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract Subscription is AccessControlUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IRegistration public RegistrationContract;
    IApplicationNFT public ApplicationNFT;
    ISubscriptionBalance public SubscriptionBalance;
    IBalanceCalculator public BalanceCalculator;
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

    struct NFTAttribute {
        address referralAddress;
        address licenseAddress;
        address supportAddress;
        address platformAddress;
        uint256[] licenseFactor;
        uint256[] supportFactor;
        uint256 createTime;
    }

    struct NFTSubnetAttribute {
        uint256[] computeRequired;
        bool subscribed;
        uint256 subnetArrayID;
    }

    mapping(uint256 => NFTAttribute) public nftSubscription;

    // NFT id => SubnetID => NFTSubnetAttribute
    mapping(uint256 => mapping(uint256 => NFTSubnetAttribute))
    public userSubscription;

    // NFT ids => subnetids for view purpose only
    mapping(uint256 => uint256[]) public subscribedSubnetsOfNFT;
    mapping(uint256 => bool[]) public activeSubnetsOfNFT;

    struct SupportFactor {
        uint256[] supportFactor;
        bool active;
    }

    struct SupportAddress {
        uint256[] supportFactor;
        bool active;
    }

    address[] public supportAddressList;
    mapping(address => SupportAddress) supportAddressDefault;
    mapping(address => mapping(uint256 => SupportFactor)) public supportAddressToNFT;
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
    mapping(uint256 => ChangeRequest)
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

    event Changed_CHANGE_SUBSCRIPTION(
        uint256 nftID,
        uint256 subnetID,
        bool allow
    );

    event Subscribed(
        uint256 nftID,
        address referralAddress,
        address licenseAddress,
        address supportAddress,
        address platformAddress,
        uint256[] licenseFactor,
        uint256[] supportFactor
    );

    event SubscribedSubnet(
        uint256 nftID,
        uint256 subnetID,
        int256[] deltaComputes
    );

    event ReferralAdded(uint256 nftID, address referralAddress);

    event LicenseAdded(uint256 nftID, address licenseAddress);

    event ChangedSubnetSubscription(
        uint256 nftID,
        uint256 currentSubnetID,
        uint256 newSubnetID
    );

    event RequestedSupportChange(
        uint256 nftID,
        address newSupportAddress
    );

    event AppliedSupportChange(
        uint256 nftID,
        address supportAddress
    );

    event Computes_changed(
        uint256 NFTid,
        uint256 subnetId,
        uint256[] computeRequired
    );

    event NFTSupportFactorChanged(
        uint256 nftID,
        uint256[] supportFactor
    );

    event NFTSupportAddressChanged(
        uint256 nftID,
        address supportAddress
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

    function getNFTSubscription(uint256 nftID)
    public
    view
    returns(NFTAttribute memory nftAttribute)
    {
        nftAttribute = nftSubscription[nftID];
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

    function getBytes32OfRole(string memory roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(roleName));
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

    function getReferralAddress(uint256 nftID)
        public
        view
        returns (address)
    {
        return nftSubscription[nftID].referralAddress;
    }

    function getLicenseAddress(uint256 nftID)
        public
        view
        returns (address)
    {
        return nftSubscription[nftID].licenseAddress;
    }

    function getSupportAddress(uint256 nftID)
        public
        view
        returns (address)
    {
        return nftSubscription[nftID].supportAddress;
    }

    function getPlatformAddress(uint256 nftID)
        public
        view
        returns (address)
    {
        return nftSubscription[nftID].platformAddress;
    }

    function getReferralDuration(uint256 nftID)
    public
    view
    returns(uint256)
    {
        return platformAddressMap[nftSubscription[nftID].platformAddress].referralExpiryDuration;
    }

    function r_licenseFactor(uint256 nftID)
        public
        view
        returns (uint256[] memory)
    {
        return nftSubscription[nftID].licenseFactor;
    }

    function t_supportFactor(uint256 nftID)
        public
        view
        returns (uint256[] memory)
    {
        return nftSubscription[nftID].supportFactor;
    }

    function u_referralFactor(uint256 nftID)
    public
    view
    returns (uint256)
    {
        return platformAddressMap[nftSubscription[nftID].platformAddress].referralPercentage;
    }

    function v_platformFactor(uint256 nftID)
    public
    view
    returns (uint256)
    {
        return platformAddressMap[nftSubscription[nftID].platformAddress].platformPercentage;
    }

    function w_discountFactor(uint256 nftID)
    public
    view
    returns (uint256)
    {
        address platformAddress = nftSubscription[nftID].platformAddress;
        address referralAddress = nftSubscription[nftID].referralAddress;
        uint256 createTime      = nftSubscription[nftID].createTime;
        uint256 referralExpiryDuration = platformAddressMap[platformAddress].referralExpiryDuration;

        if(referralAddress != address(0) && ((createTime + referralExpiryDuration) > block.timestamp))
        {
            return platformAddressMap[platformAddress].discountPercentage;
        }
        return 0;
    }

    function getSupportFeesForNFT(address supportAddress, uint256 nftID)
    view
    public
    returns (uint256[] memory supportFactor)
    {
        if(supportAddressToNFT[supportAddress][nftID].active) {
           supportFactor = supportAddressToNFT[supportAddress][nftID].supportFactor;
        }
        else if(supportAddressDefault[supportAddress].active == true) {
            supportFactor = supportAddressDefault[supportAddress].supportFactor;
        }
        else {
            supportFactor = supportAddressDefault[GLOBAL_SUPPORT_ADDRESS].supportFactor;
        }
    }

    function getComputesOfSubnet(uint256 nftID, uint256 subnetID)
        external
        view
        returns (uint256[] memory)
    {
        return userSubscription[nftID][subnetID].computeRequired;
    }

    function checkSubscribed(uint256 nftID, uint256 subnetID)
    external
    view
    returns (bool)
    {
        return userSubscription[nftID][subnetID].subscribed;
    }

    function admin_changeGlobalDAO(address newGlobalDAO)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GLOBAL_DAO_ADDRESS = newGlobalDAO;
    }

    function admin_changeNFTSubnetLimit(uint256 newSubnetLimit)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedNFTSubnetLimit(
            LIMIT_NFT_SUBNETS,
            newSubnetLimit
        );
        LIMIT_NFT_SUBNETS = newSubnetLimit;
    }

    function admin_changeMinTimeFunds(uint256 newMinTimeFunds)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit ChangedMinTimeFunds(MIN_TIME_FUNDS, newMinTimeFunds);
        MIN_TIME_FUNDS = newMinTimeFunds;
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
        uint256 nftID,
        uint256 subnetID,
        bool allow
    ) external onlyRole(CHANGE_SUBSCRIPTION_ROLE) {
        userSubscription[nftID][subnetID].subscribed = allow;
        emit Changed_CHANGE_SUBSCRIPTION(nftID, subnetID, allow);
    }

    function addDeltaComputes(
        uint256 nftID,
        uint256 subnetID,
        int256[] memory deltaCompute
    )
    internal
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


    function addSupportAddress(address supportAddress, uint256[] memory supportFactor)
    public
    {
        require(_msgSender() == GLOBAL_DAO_ADDRESS
        || isBridgeRole()
        ,
         "Only the global dao address can add the support address");
        require(supportFactor[0] >= 5000, "The default support fee should be greater than or equal to 5%");
        supportAddressDefault[supportAddress].supportFactor = supportFactor;
        supportAddressDefault[supportAddress].active = true;
        supportAddressList.push(supportAddress);
    }

    function addPlatformAddress(
        address platformAddress,
        uint256 platformPercentage,
        uint256 discountPercentage,
        uint256 referralPercentage,
        uint256 referralDuration
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

    function setSupportFeesForNFT(address supportAddress, uint256 nftID, uint256[] memory supportFactor)
    external
    {
        require(supportAddressDefault[supportAddress].active, "You are not added as a support partner");
        require(
            supportAddress == _msgSender()
            || isBridgeRole(),
            "Only the support address can call this function"
        );
        require(supportFactor[0] >= 5000, "The support fee should be greater than or equal to 5%");

        supportAddressToNFT[supportAddress][nftID].supportFactor = supportFactor;
        supportAddressToNFT[supportAddress][nftID].active = true;
    }

    
    function approveNewSupportFactor(address nftOwner, uint256 nftID, uint256 subnetID)
    external
    {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );

        address supportAddress = nftSubscription[nftID].supportAddress;
        require(supportAddressToNFT[supportAddress][nftID].active, "Support address has not changed fees");
        SubscriptionBalance.updateBalance(nftID);


        nftSubscription[nftID].supportFactor = supportAddressToNFT[supportAddress][nftID].supportFactor;
        supportAddressToNFT[supportAddress][nftID].active = false;

        emit NFTSupportFactorChanged(
            nftID,
            nftSubscription[nftID].supportFactor
        );

    }


    function subscribeBatch(
        address subscriber,
        uint256 balanceToAdd,
        uint256 nftID,
        uint256[] memory subnetList,
        address referralAddress,
        address licenseAddress,
        address supportAddress,
        address platformAddress,
        uint256[] memory licenseFactor,
        int256[][] memory deltaCompute
    ) external
    {
        require(
             (
                isBridgeRole()
                || hasRole(SUBSCRIBE_ROLE, _msgSender())
            )
            ,
            "You do not have the role to call this function"
        );

        if(!SubscriptionBalance.isSubscribed(nftID))
        {
            subscribeNewNFT(
                nftID,
                referralAddress,
                licenseAddress,
                supportAddress,
                platformAddress,
                licenseFactor
            );
        }

        subscribeToSubnetList(
            subscriber,
            balanceToAdd,
            nftID,
            subnetList,
            deltaCompute
        );
    }

    function subscribeNewNFT(
        uint256 nftID,
        address referralAddress,
        address licenseAddress,
        address supportAddress,
        address platformAddress,
        uint256[] memory licenseFactor
    )
    internal
    {
        require(
            supportAddressDefault[supportAddress].active == true,
            "The support address given is not valid"
        );

        require(
            platformAddressMap[platformAddress].active == true,
            "The platform address given is not valid"
        );

        nftSubscription[nftID] = NFTAttribute(
            referralAddress,
            licenseAddress,
            supportAddress,
            platformAddress,
            licenseFactor,
            getSupportFeesForNFT(supportAddress, nftID),
            block.timestamp
        );


        SubscriptionBalance.subscribeNew(
            nftID
        );

        emit Subscribed(
            nftID,
            referralAddress,
            licenseAddress,
            supportAddress,
            platformAddress,
             getSupportFeesForNFT(supportAddress, nftID),
            licenseFactor
        );
    }

    function subscribeToSubnetList(
        address subscriber,
        uint256 balanceToAdd,
        uint256 nftID,
        uint256[] memory subnetList,
        int256[][] memory deltaCompute
    )
    public
    {

        if(balanceToAdd > 0)
        {
            XCT.transferFrom(subscriber, address(this), balanceToAdd);
            SubscriptionBalance.addBalance(address(this), nftID, balanceToAdd);
        }
        else {
            SubscriptionBalance.updateBalance(nftID);
        }

        for (uint256 i = 0; i < subnetList.length; i++)
        {
            subscribeSubnetInternal(
                nftID,
                subnetList[i],
                deltaCompute[i]
            );
        }

        uint256 totalBalance = SubscriptionBalance.totalPrevBalance(nftID);
        if(totalBalance > 0)
        {
            require(
                BalanceCalculator.dripRatePerSec(nftID) * MIN_TIME_FUNDS
                    <= totalBalance,
                    "The total balance amount is not enough"
            );
        }
    }

    function subscribeSubnetInternal(
        uint256 nftID,
        uint256 subnetID,
        int256[] memory deltaCompute
    ) internal {
        require(
            RegistrationContract.totalSubnets() > subnetID,
            "subnet ID donot exist in RegistrationContract"
        );
        (, , , bool subnetStatusListed, , , , , ) = RegistrationContract
            .getSubnetAttributes(subnetID);
        require(
            subnetStatusListed,
            "RegistrationContract: subnet is delisted and hence cannot be subscribed"
        );
        require(
            subscribedSubnetsOfNFT[nftID].length <= LIMIT_NFT_SUBNETS,
            "Cannot subscribe as limit exceeds to max Subnet subscription allowed per NFT"
        );
        require(
            !userSubscription[nftID][subnetID].subscribed || (
            deltaCompute.length >=  userSubscription[nftID][subnetID].computeRequired.length),
            "The number of types of delta computes provided is less than the existing number of types of resources"
        );

        uint256[] memory computes = addDeltaComputes(
            nftID,
            subnetID,
            deltaCompute
        );
        
        userSubscription[nftID][subnetID].computeRequired = computes;

        emit SubscribedSubnet(
            nftID,
            subnetID,
            deltaCompute
        );

        if(userSubscription[nftID][subnetID].subscribed) {
            return;
        }

        userSubscription[nftID][subnetID].subscribed = true;
        userSubscription[nftID][subnetID].subnetArrayID = subscribedSubnetsOfNFT[nftID].length;
        subscribedSubnetsOfNFT[nftID].push(subnetID);
        activeSubnetsOfNFT[nftID].push(true);
    }


    function addReferralAddress(
        address nftOwner,
        uint256 nftID,
        address referralAddress
    ) external {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        require(
            nftSubscription[nftID].referralAddress == address(0),
            "Already set"
        );

        SubscriptionBalance.updateBalance(nftID);

        nftSubscription[nftID].referralAddress = referralAddress;
        emit ReferralAdded(nftID, referralAddress);
    }


    function applySupportChange(address nftOwner, uint256 nftID)
        external
    {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );

        require(
            requestChangeMap[nftID].supportAddress != address(0),
            "No change request to support address made"
        );
        require(
            requestChangeMap[nftID].SupportAddressApplyTime.add(
                CHANGE_REQUEST_DURATION.supportAddressCooldownDuration
            ) <= block.timestamp,
            "Cannot apply before cooldown"
        );


        SubscriptionBalance.updateBalance(nftID);

        address newSupportAddress = requestChangeMap[nftID].supportAddress;
        requestChangeMap[nftID].SupportAddressApplyTime = block.timestamp;
        nftSubscription[nftID]
            .supportAddress = newSupportAddress;
        nftSubscription[nftID]
            .supportFactor = getSupportFeesForNFT(nftSubscription[nftID].supportAddress, nftID);
        requestChangeMap[nftID].supportAddress = address(0);

        emit NFTSupportAddressChanged (
            nftID,
            newSupportAddress
        );
    }

    function requestSupportChange(
        address nftOwner,
        uint256 nftID,
        address newSupportAddress
    ) external {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        require(
            nftSubscription[nftID].createTime > 0,
            "NFT is not subscribed"
        );
        require(
            newSupportAddress != address(0),
            "support address should be provided with a non zero address value"
        );
        require(
            requestChangeMap[nftID].SupportAddressRequestTime.add(
                CHANGE_REQUEST_DURATION.supportAddressNoticeDuration
            ) < block.timestamp,
            "Cannot request before support address change notice time passed"
        );
        
        requestChangeMap[nftID].SupportAddressRequestTime = block.timestamp;
        requestChangeMap[nftID].SupportAddressApplyTime = block.timestamp;
        requestChangeMap[nftID].supportAddress = newSupportAddress;

        emit RequestedSupportChange(
            nftID,
            newSupportAddress
        );

    }

    function changeLicenseAddress(
        address caller,
        address newLicenseAddress,
        uint256 nftID
    )
    public
    {
        require(
            (caller == _msgSender() && (nftSubscription[nftID].licenseAddress == caller))
            || isBridgeRole(),
            "The nftOwner address should be the function caller"
        );
        require(
            nftSubscription[nftID].createTime > 0,
            "NFT is not subscribed"
        );
        require(
            newLicenseAddress != address(0),
            "license address should be provided with a non zero address value"
        );

        nftSubscription[nftID].licenseAddress = newLicenseAddress;

        emit LicenseAdded(nftID, newLicenseAddress);
    }

    function initialize(
        address _GlobalDAO,
        uint256 _LIMIT_NFT_SUBNETS,
        uint256 _MIN_TIME_FUNDS,
        address _globalSupportAddress,
        uint256[] memory _globalSupportFactor,
        IRegistration _RegistrationContract,
        IApplicationNFT _ApplicationNFT,
        ISubscriptionBalance _SubscriptionBalance,
        IBalanceCalculator  _BalanceCalculator,
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
        BalanceCalculator = _BalanceCalculator;


        CHANGE_REQUEST_DURATION.supportAddressNoticeDuration = _REQD_NOTICE_TIME_S_PROVIDER;
        CHANGE_REQUEST_DURATION.supportAddressCooldownDuration = _REQD_COOLDOWN_S_PROVIDER;


        GLOBAL_SUPPORT_ADDRESS = _globalSupportAddress;
        supportAddressDefault[GLOBAL_SUPPORT_ADDRESS] = SupportAddress(
            _globalSupportFactor,
            true
        );

        _XCT.approve(address(_SubscriptionBalance), 2**256 - 1);
    }
}
