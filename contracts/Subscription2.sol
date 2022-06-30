// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract Subscription2 is
    AccessControlUpgradeable,
    PausableUpgradeable
{
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IRegistration public RegistrationContract;
    IERC721 public ApplicationNFT;
    IERC20Upgradeable public XCTToken;

    bytes32 public constant CHANGE_COMPUTE_ROLE =
        keccak256("CHANGE_COMPUTE_ROLE");
    bytes32 public constant WITHDRAW_CREDITS_ROLE =
        keccak256("WITHDRAW_CREDITS_ROLE");
    address public GLOBAL_DAO_ADDRESS;

    struct NFTAttribute {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance; // prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
        uint256[] subnetIds; // cannot be changed unless delisted
        address NFTMinter;
        uint256 endOfXCTBalance;
    }

    struct NFTSubnetAttribute {
        string serviceProviderAddress;
        address referralAddress;
        uint256 r_licenseFee;
        uint256[] computeRequired;
        bool subscribed;
    }

    // NFT id => NFTAttribute
    mapping(uint256 => NFTAttribute) public nftAttributes;

    // NFT id => SubnetID => NFTSubnetAttribute
    mapping(uint256 => mapping(uint256 => NFTSubnetAttribute))
        public userSubscription;

    mapping(address => uint256) public balanceOfRev;

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
    mapping(uint256 => mapping(uint256 => PriceChangeRequest)) requestPriceChange;

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

    event BalanceAdded(uint256 NFTId, uint256 balanceType, uint256 bal);

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

    event RefreshedBalance(uint256 NFTId);

    event ReceivedRevenue(address benficiary, uint256 bal);

    function initialize(
        address _GlobalDAO,
        uint256 _LIMIT_NFT_SUBNETS,
        uint256 _MIN_TIME_FUNDS,
        IRegistration _RegistrationContract,
        IERC721 _ApplicationNFT,
        IERC20Upgradeable _XCTToken,
        uint256 _REQD_NOTICE_TIME_S_PROVIDER,
        uint256 _REQD_COOLDOWN_S_PROVIDER
    ) public initializer {
        __AccessControl_init_unchained();
        __Pausable_init_unchained();

        _grantRole(DEFAULT_ADMIN_ROLE, _GlobalDAO);
        _grantRole(CHANGE_COMPUTE_ROLE, _GlobalDAO);
        _grantRole(WITHDRAW_CREDITS_ROLE, _GlobalDAO);
        GLOBAL_DAO_ADDRESS = _GlobalDAO;

        LIMIT_NFT_SUBNETS = _LIMIT_NFT_SUBNETS;
        MIN_TIME_FUNDS = _MIN_TIME_FUNDS;
        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
        REQD_NOTICE_TIME_S_PROVIDER = _REQD_NOTICE_TIME_S_PROVIDER;
        REQD_COOLDOWN_S_PROVIDER = _REQD_COOLDOWN_S_PROVIDER;
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

    function dripRatePerSec(uint256 NFTid)
        public
        view
        returns (uint256 totalDripRate)
    {
        uint256[] memory subnetIds = nftAttributes[NFTid].subnetIds;
        totalDripRate = 0;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            totalDripRate = totalDripRate.add(
                dripRatePerSecOfSubnet(NFTid, subnetIds[i])
            );
        }
    }

    function dripRatePerSecOfSubnet(uint256 NFTid, uint256 subnetId)
        public
        view
        returns (uint256)
    {
        uint256 factor = s_GlobalDAORate()
            .add(r_licenseFee(NFTid, subnetId))
            .add(t_SupportFeeRate(subnetId))
            .add(100000);
        (, , , , uint256[] memory prices, , , ) = RegistrationContract
            .getSubnetAttributes(subnetId);
        uint256 cost = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            cost = cost.add(
                prices[i].mul(
                    userSubscription[NFTid][subnetId].computeRequired[i]
                )
            );
        }
        return factor.mul(cost).div(100000);
    }

    function t_supportFeeAddress(uint256 _tokenId)
        public
        view
        returns (address)
    {
        return ApplicationNFT.ownerOf(_tokenId);
    }

    function s_GlobalDAOAddress() public view returns (address) {
        return RegistrationContract.GLOBAL_DAO_ADDRESS();
    }

    // r address is NFT minter address => nftAttributes[_nftId].NFTMinter

    function subnetDAOWalletFor1(uint256 _subnetId)
        public
        view
        returns (address)
    {
        return RegistrationContract.subnetLocalDAO(_subnetId);
    }

    function r_licenseFee(uint256 _nftId, uint256 _subnetId)
        public
        view
        returns (uint256)
    {
        return userSubscription[_nftId][_subnetId].r_licenseFee;
    }

    function s_GlobalDAORate() public view returns (uint256) {
        return RegistrationContract.daoRate();
    }

    function t_SupportFeeRate(uint256 _subnetId)
        public
        view
        returns (uint256 fee)
    {
        (, , , , , , , fee) = RegistrationContract.getSubnetAttributes(
            _subnetId
        );
    }

    function totalPrevBalance(uint256 NFTid) public view returns (uint256) {
        uint256 bal = 0;
        for (uint256 i = 0; i < 3; i++) {
            bal = bal.add(nftAttributes[NFTid].prevBalance[i]);
        }
        return bal;
    }

    function balanceLeft(uint256 NFTid) public view returns (uint256) {
        uint256 cost = (
            block.timestamp.sub(nftAttributes[NFTid].lastBalanceUpdateTime)
        ).mul(dripRatePerSec(NFTid));
        uint256 prevBalance = totalPrevBalance(NFTid);
        if (prevBalance < cost) return 0;
        return prevBalance.sub(cost);
    }

    function addBalance(uint256 _nftId, uint256 _balanceToAdd)
        external
        updateBalance(_nftId)
        returns (bool)
    {
        uint256 id = _nftId;
        XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);
        uint256 newBal = nftAttributes[id].prevBalance[2].add(_balanceToAdd);
        nftAttributes[id].prevBalance[2] = newBal;
        nftAttributes[id].lastBalanceUpdateTime = block.timestamp;
        nftAttributes[id].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(_nftId).div(dripRatePerSec(id))
        );
        emit BalanceAdded(_nftId, 2, _balanceToAdd);
    }

    function withdrawAllOwnerBalance(uint256 _NFTid)
        external
        whenNotPaused
        updateBalance(_NFTid)
    {
        uint256 bal = nftAttributes[_NFTid].prevBalance[2];
        withdrawBalance(_NFTid, bal);
    }

    function withdrawBalance(uint256 _NFTid, uint256 _bal)
        public
        whenNotPaused
        updateBalance(_NFTid)
    {
        require(
            ApplicationNFT.ownerOf(_NFTid) == _msgSender(),
            "Sender not the owner of NFT id"
        );
        XCTToken.transfer(_msgSender(), _bal);
        nftAttributes[_NFTid].prevBalance[2] = 0;
        refreshBalance(_NFTid);

        nftAttributes[_NFTid].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(_NFTid).div(dripRatePerSec(_NFTid))
        );
    }

    function changeComputesOfSubnet(
        uint256 _NFTid,
        uint256 _subnetId,
        uint256[] memory _computeRequired
    )
        external
        onlyRole(CHANGE_COMPUTE_ROLE)
        whenNotPaused
        updateBalance(_NFTid)
    {
        userSubscription[_NFTid][_subnetId].computeRequired = _computeRequired;

        nftAttributes[_NFTid].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(_NFTid).div(dripRatePerSec(_NFTid))
        );
    }

    // function addBalanceAsCredit(uint256 _toNFTid, uint256 _balanceToAdd)
    //     external
    //     whenNotPaused
    //     updateBalance(_toNFTid)
    // {
    //     uint256 id = _toNFTid;
    //     XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);
    //     uint256 newBal = nftAttributes[id].prevBalance[0].add(_balanceToAdd);
    //     nftAttributes[id].prevBalance[0] = newBal;
    //     nftAttributes[id].lastBalanceUpdateTime = block.timestamp;
    //     nftAttributes[id].endOfXCTBalance = block.timestamp.add(
    //         totalPrevBalance(id).div(dripRatePerSec(id))
    //     );
    //     emit BalanceAdded(id, 0, _balanceToAdd);
    // }

    // function addBalanceAsExternalDeposit(uint256 _NFTid, uint256 _balanceToAdd)
    //     external
    //     whenNotPaused
    //     updateBalance(_NFTid)
    // {
    //     uint256 id = _NFTid;
    //     XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);
    //     uint256 newBal = nftAttributes[id].prevBalance[1].add(_balanceToAdd);
    //     nftAttributes[id].prevBalance[1] = newBal;
    //     nftAttributes[id].lastBalanceUpdateTime = block.timestamp;
    //     nftAttributes[id].endOfXCTBalance = block.timestamp.add(
    //         totalPrevBalance(id).div(dripRatePerSec(id))
    //     );
    //     emit BalanceAdded(id, 1, _balanceToAdd);
    // }

    // function withdrawCreditsForNFT(uint256 _NFTid)
    //     external
    //     onlyRole(WITHDRAW_CREDITS_ROLE)
    //     whenNotPaused
    //     updateBalance(_NFTid)
    // {
    //     uint256 id = _NFTid;
    //     uint256 bal = nftAttributes[id].prevBalance[0];

    //     nftAttributes[id].prevBalance[0] = 0;
    //     nftAttributes[id].lastBalanceUpdateTime = block.timestamp;
    //     nftAttributes[id].endOfXCTBalance = block.timestamp.add(
    //         totalPrevBalance(id).div(dripRatePerSec(id))
    //     );
    //     XCTToken.transfer(_msgSender(), bal);
    //     refreshBalance(id);
    // }

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
            dripRatePerSec(NFTid).mul(MIN_TIME_FUNDS) < _balanceToAdd,
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
        ApplicationNFT.mint(_msgSender()); // NFT contract should return NFT id on minting

        // struct NFTAttribute {
        //     uint256 lastBalanceUpdateTime;
        //     uint256[3] prevBalance;
        //     uint256[] subnetIds;
        //     address NFTMinter;
        //     uint256 endOfXCTBalance;
        // }
        uint256[] memory arr;
        uint256[3] memory balanceArr = [0, 0, _balanceToAdd];

        nftAttributes[NFTid] = NFTAttribute(
            block.timestamp,
            balanceArr,
            arr,
            _msgSender(),
            0
        );

        _subscribeToExistingNFT(
            NFTid,
            subnetId,
            _serviceProviderAddress,
            _referralAddress,
            _licenseFee,
            _computeRequired
        );
        require(
            dripRatePerSecOfSubnet(NFTid, subnetId).mul(MIN_TIME_FUNDS) <
                _balanceToAdd,
            "Balance added should be enough with MIN_TIME_FUNDS"
        );
        XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);
        emit BalanceAdded(NFTid, 2, _balanceToAdd);

        nftAttributes[NFTid].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(NFTid).div(dripRatePerSec(NFTid))
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
    ) public whenNotPaused updateBalance(_nftId) {
        _subscribeToExistingNFT(
            _nftId,
            _subnetId,
            _serviceProviderAddress,
            _referralAddress,
            _licenseFee,
            _computeRequired
        );
    }

    function _subscribeToExistingNFT(
        uint256 _nftId,
        uint256 _subnetId,
        string memory _serviceProviderAddress,
        address _referralAddress,
        uint256 _licenseFee,
        uint256[] memory _computeRequired
    ) internal {
        require(
            nftAttributes[_nftId].subnetIds.length < LIMIT_NFT_SUBNETS,
            "Cannot subscribe as limit exceeds to max Subnet subscription allowed per NFT"
        );
        require(
            ApplicationNFT.ownerOf(_nftId) == _msgSender(),
            "Sender not the owner of NFT id"
        );

        nftAttributes[_nftId].subnetIds.push(_subnetId);

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
        (, , , bool isListed, , , , ) = RegistrationContract
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
        uint256[] memory subnetIdsInNFT = nftAttributes[_nftId].subnetIds;
        // replace subnetId
        for (uint256 i = 0; i < subnetIdsInNFT.length; i++) {
            if (subnetIdsInNFT[i] == _currentSubnetId) {
                subnetIdsInNFT[i] = _newSubnetId;
                break;
            }
        }
        nftAttributes[_nftId].subnetIds = subnetIdsInNFT;
        emit ChangedSubnetSubscription(_nftId, _currentSubnetId, _newSubnetId);
    }

    // anyone can change if cooldown time passed
    function applyServiceProviderChange(uint256 _nftId, uint256 _subnetId)
        external
    {
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

    function refreshBalance(uint256 _nftId) public updateBalance(_nftId) {
        // modifier is only required to call
        emit RefreshedBalance(_nftId);
    }

    function receiveRevenue() external {
        receiveRevenueForAddress(_msgSender());
    }

    function receiveRevenueForAddressBulk(address[] memory _userAddresses)
        external
    {
        for (uint256 i = 0; i < _userAddresses.length; i++)
            receiveRevenueForAddress(_userAddresses[i]);
    }

    function receiveRevenueForAddress(address _userAddress) public {
        uint256 bal = balanceOfRev[_userAddress];
        XCTToken.transfer(_userAddress, bal);
        balanceOfRev[_userAddress] = 0;
        emit ReceivedRevenue(_userAddress, bal);
    }

    // ALWAYS check before computing
    function isBalancePresent(uint256 _nftId) public view returns (bool) {
        if (block.timestamp < nftAttributes[_nftId].endOfXCTBalance)
            return true;
        return false;
    }

    function onERC721Received(
        address _operator,
        address _from,
        uint256 _id,
        bytes calldata _data
    ) external returns (bytes4) {
        return 0x150b7a02;
    }

    /* ========== MODIFIERS ========== */

    modifier updateBalance(uint256 NFTid) {
        uint256 computeCostPerSec = 0;
        uint256[] memory subnetIds = nftAttributes[NFTid].subnetIds;

        for (uint256 i = 0; i < subnetIds.length; i++) {
            (, , , , uint256[] memory prices, , , ) = RegistrationContract
                .getSubnetAttributes(subnetIds[i]);
            for (uint256 j = 0; j < prices.length; j++) {
                computeCostPerSec = computeCostPerSec.add(
                    prices[j].mul(
                        userSubscription[NFTid][subnetIds[i]].computeRequired[j]
                    )
                );
            }
        }
        uint256 computeCost = computeCostPerSec.mul(
            block.timestamp.sub(nftAttributes[NFTid].lastBalanceUpdateTime)
        );

        if (computeCost > 100000) {
            uint256 costIncurred_r;
            uint256 costIncurred_s;
            uint256 costIncurred_t;
            uint256 costIncurred_1 = computeCost; // 1 of (1+R+S+T) revenue

            costIncurred_s = s_GlobalDAORate().mul(computeCost).div(100000);
            // update S revenue of (1+R+S+T) revenue
            balanceOfRev[s_GlobalDAOAddress()] = balanceOfRev[
                s_GlobalDAOAddress()
            ].add(costIncurred_s);

            for (uint256 i = 0; i < subnetIds.length; i++) {
                costIncurred_r = costIncurred_r.add(
                    r_licenseFee(NFTid, subnetIds[i]).mul(computeCost).div(
                        100000
                    )
                );
                costIncurred_t = costIncurred_t.add(
                    t_SupportFeeRate(subnetIds[i]).mul(computeCost).div(100000)
                );
                // update (1)(for subnetDAOWallet) of (1+R+S+T) revenue
                balanceOfRev[subnetDAOWalletFor1(subnetIds[i])] = balanceOfRev[
                    subnetDAOWalletFor1(subnetIds[i])
                ].add(costIncurred_1);
            }
            // update R revenue of (1+R+S+T) revenue
            balanceOfRev[nftAttributes[NFTid].NFTMinter] = balanceOfRev[
                nftAttributes[NFTid].NFTMinter
            ].add(costIncurred_r);

            // update T revenue of (1+R+S+T) revenue
            balanceOfRev[t_supportFeeAddress(NFTid)] = balanceOfRev[
                t_supportFeeAddress(NFTid)
            ].add(costIncurred_t);

            uint256 totalCostIncurred = costIncurred_r
                .add(costIncurred_s)
                .add(costIncurred_t)
                .add(costIncurred_1);
            uint256 balCostLeft = 0;
            if (totalCostIncurred < nftAttributes[NFTid].prevBalance[0])
                nftAttributes[NFTid].prevBalance[0] = nftAttributes[NFTid]
                    .prevBalance[0]
                    .sub(totalCostIncurred);
            else {
                balCostLeft = totalCostIncurred.sub(
                    nftAttributes[NFTid].prevBalance[0]
                );
                nftAttributes[NFTid].prevBalance[0] = 0;
                if (balCostLeft < nftAttributes[NFTid].prevBalance[1]) {
                    nftAttributes[NFTid].prevBalance[1] = nftAttributes[NFTid]
                        .prevBalance[1]
                        .sub(balCostLeft);
                    balCostLeft = 0;
                } else {
                    balCostLeft = balCostLeft.sub(
                        nftAttributes[NFTid].prevBalance[1]
                    );
                    nftAttributes[NFTid].prevBalance[1] = 0;
                    if (balCostLeft < nftAttributes[NFTid].prevBalance[2]) {
                        nftAttributes[NFTid].prevBalance[2] = nftAttributes[
                            NFTid
                        ].prevBalance[2].sub(balCostLeft);
                        balCostLeft = 0;
                    } else {
                        nftAttributes[NFTid].prevBalance[2] = 0;
                        balCostLeft = 0;
                    }
                }
            }

            nftAttributes[NFTid].lastBalanceUpdateTime = block.timestamp;
        }

        _;
    }
}
