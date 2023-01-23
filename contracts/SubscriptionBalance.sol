// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ILinkContract.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IRoleControlV2.sol";
import "./interfaces/IBalanceCalculator.sol";
import "./interfaces/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract SubscriptionBalance is OwnableUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IRegistration public RegistrationContract;
    IRoleControlV2 public RoleControl;
    IERC721 public ApplicationNFT;
    IERC20Upgradeable public XCTToken;
    ISubscription public SubscriptionContract;
    IBalanceCalculator public BalanceCalculator;
    uint256 public ReferralPercent; // 1000 = 1%
    uint256 public ReferralRevExpirySecs; // eg. after 2 years, Global DAO will receive referral percent reward
    bytes32 public BILLING_MANAGER_ROLE;
    ILinkContract public LinkContract;

    struct NFTBalance {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance; // prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
        uint256[] subnetIds; // cannot be changed unless delisted
        address NFTMinter;
        uint256 mintTime;
        uint256 balanceEndTime;
    }

    struct NFTCredits
    {
        uint256 expiryTimestamp;
        uint256 amountAdded;
    }
    // NFT id => NFTBalance
    mapping(uint256 => NFTBalance) public nftBalances;
    // Credit provider => NFT id => expiry
    mapping(address => mapping(uint256 => NFTCredits)) public creditsExpiry;

    event BalanceAdded(uint256 NFTId, uint256 balanceType, uint256 bal);
    event BalanceWithdrawn(uint256 NFTId, uint256 balanceType, uint256 bal);
    event SettledBalanceFor(uint256 NFTId);
    event ChangedReferralAttributes(
        uint256 ReferralPercent,
        uint256 ReferralRevExpirySecs
    );


    function initialize(
        IRegistration _RegistrationContract,
        IERC721 _ApplicationNFT,
        IERC20Upgradeable _XCTToken,
        IBalanceCalculator _BalanceCalculator,
        IRoleControlV2 _RoleControl,
        uint256 _ReferralPercent,
        uint256 _ReferralRevExpirySecs
    ) public initializer {
        __Ownable_init_unchained();
        __Pausable_init_unchained();

        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
        BalanceCalculator = _BalanceCalculator;
        RoleControl = _RoleControl;
        ReferralPercent = _ReferralPercent;
        ReferralRevExpirySecs = _ReferralRevExpirySecs;

        BILLING_MANAGER_ROLE = RoleControl.getBytes32OfRole("BILLING_MANAGER");
    }

    function setSubscriptionContract(address _Subscription) external onlyOwner {
        require(address(SubscriptionContract) == address(0), "Already set");
        SubscriptionContract = ISubscription(_Subscription);
    }


    function isBridgeRole()
    public
    view
    returns (bool)
    {
        return SubscriptionContract.isBridgeRole();
    }

    function change__ReferralAttributes(
        uint256 _ReferralPercent,
        uint256 _ReferralRevExpirySecs
    ) external onlyOwner {
        ReferralPercent = _ReferralPercent;
        ReferralRevExpirySecs = _ReferralRevExpirySecs;
        emit ChangedReferralAttributes(
            _ReferralPercent,
            _ReferralRevExpirySecs
        );
    }

    function setLinkContract(ILinkContract _newLinkContract)
        external
        onlyOwner
    {
        LinkContract = _newLinkContract;
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

    // r address is NFT minter address => nftBalances[nftID].NFTMinter

    function subnetDAOWalletFor1(uint256 _subnetId)
        public
        view
        returns (address)
    {
        return RegistrationContract.subnetLocalDAO(_subnetId);
    }

    function r_licenseFee(uint256 nftID, uint256 _subnetId)
        public
        view
        returns (uint256)
    {
        return SubscriptionContract.r_licenseFee(nftID, _subnetId);
    }

    function s_GlobalDAORate() public view returns (uint256) {
        return RegistrationContract.daoRate();
    }

    function t_SupportFeeRate(uint256 nftID, uint256 _subnetId)
        public
        view
        returns (uint256 fee)
    {
        fee = SubscriptionContract.t_supportFee(nftID, _subnetId);
    }

    function dripRatePerSec(uint256 nftID)
        public
        view
        returns (uint256 totalDripRate)
    {
        // uint256[] memory subnetIds = nftBalances[nftID].subnetIds;\
        uint256[] memory subnetIds = SubscriptionContract.getSubnetsOfNFT(nftID);
        bool[] memory activeSubnets = SubscriptionContract.getActiveSubnetsOfNFT(nftID);

        totalDripRate = 0;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            if(!activeSubnets[i])
                continue;

            totalDripRate = totalDripRate.add(
                dripRatePerSecOfSubnet(nftID, subnetIds[i])
            );
        }
    }

    function estimateDripRatePerSec (
        uint256[] memory _subnetId,
        uint256[] memory _supportFee,
        uint256[] memory _licenseFee,
        uint256[][] memory _computeRequired
    )
    public
    view
    returns (uint256)
    {
        uint256 estimate = 0;
        for(uint256 i = 0; i < _subnetId.length; i++)
        {
            estimate += estimateDripRatePerSecOfSubnet(
                _subnetId[i], 
                _licenseFee[i],
                _supportFee[i],
                _computeRequired[i]
            );
        }
        return estimate;
    }

    function estimateDripRatePerSecOfSubnet(uint subnetId, uint256 licenseFee, uint256 supportFee, uint256[] memory computeRequired)
        public
        view
        returns (uint256)
     {
        uint256 factor = s_GlobalDAORate()
            // .add(licenseFee)
            .add(supportFee)
            .add(ReferralPercent)
            .add(100000);
        (, , , , uint256[] memory prices, , , , ) = RegistrationContract
            .getSubnetAttributes(subnetId);
        uint256 cost = 0;
        uint256 len = Math.min(prices.length, computeRequired.length);

        for (uint256 i = 0; i < len; i++) {
            cost = cost.add(prices[i].mul(computeRequired[i]));
        }
        return factor.mul(cost).div(100000) + licenseFee; // 10^5 for percent
    }

    function dripRatePerSecOfSubnet(uint256 nftID, uint256 subnetId)
        public
        view
        returns (uint256)
    {
        uint256 factor = s_GlobalDAORate()
            .add(t_SupportFeeRate(nftID, subnetId))
            .add(ReferralPercent)
            .add(100000);
        (, , , , uint256[] memory prices, , , , ) = RegistrationContract
            .getSubnetAttributes(subnetId);
        uint256 cost = 0;
        uint256[] memory computeRequired = SubscriptionContract
            .getComputesOfSubnet(nftID, subnetId);


        uint256 minLen = Math.min(prices.length, computeRequired.length);
        for (uint256 i = 0; i < minLen; i++) {
            cost = cost.add(prices[i].mul(computeRequired[i]));
        }
        
        return factor.mul(cost).div(100000) + r_licenseFee(nftID, subnetId); // 10^5 for percent
    }

    function prevBalances(uint256 nftID)
        public
        view
        returns (uint256[3] memory)
    {
        return nftBalances[nftID].prevBalance;
    }

    function totalPrevBalance(uint256 nftID) public view returns (uint256) {
        uint256 bal = 0;
        for (uint256 i = 0; i < 3; i++) {
            bal = bal.add(nftBalances[nftID].prevBalance[i]);
        }
        return bal;
    }

    function balanceLeft(uint256 nftID) public view returns (uint256) {
        uint256 cost = (
            block.timestamp.sub(nftBalances[nftID].lastBalanceUpdateTime)
        ).mul(dripRatePerSec(nftID));
        uint256 prevBalance = totalPrevBalance(nftID);
        if (prevBalance < cost) return 0;
        return prevBalance.sub(cost);
    }

    // function totalSubnets(uint256 nftId) external view returns (uint256) {
    //     return nftBalances[nftId].subnetIds.length;
    // }

    // function changeSubnet(
    //     uint256 nftID,
    //     uint256 _currentSubnetId,
    //     uint256 _newSubnetId
    // ) external onlySubscription returns (bool) {
    //     uint256[] memory subnetIdsInNFT = nftBalances[nftID].subnetIds;
    //     // replace subnetId
    //     for (uint256 i = 0; i < subnetIdsInNFT.length; i++) {
    //         if (subnetIdsInNFT[i] == _currentSubnetId) {
    //             subnetIdsInNFT[i] = _newSubnetId;
    //             break;
    //         }
    //     }
    //     nftBalances[nftID].subnetIds = subnetIdsInNFT;
    //     return true;
    // }

    function subscribeNew(
        uint256 nftID,
        address _minter
    ) external onlySubscription returns (bool) {
        uint256[] memory arr;

        nftBalances[nftID] = NFTBalance(
            block.timestamp,
            [uint256(0), uint256(0), uint256(0)],
            arr,
            _minter,
            block.timestamp,
            0
        );

        // _addBalance(nftID, _balanceToAdd);
        return true;
    }


    function addBalance(address nftOwner, uint256 nftID, uint256 _balanceToAdd)
        public
        returns (
            bool
        )
    {
        _addBalance(nftOwner, nftID, _balanceToAdd);
        return true;
    }

    function _addBalance(address sender, uint256 nftID, uint256 _balanceToAdd)
        internal
        returns (bool)
    {

    //    require(
    //         sender == _msgSender()
    //         || _msgSender() == address(SubscriptionContract)
    //         || isBridgeRole(),
    //         "The nftOwner address should be the function caller"
    //     );
    
        updateBalance(nftID);

        XCTToken.transferFrom(
            sender,
            address(BalanceCalculator),
            _balanceToAdd
        );

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0],
            nftBalances[nftID].prevBalance[1],
            nftBalances[nftID].prevBalance[2].add(_balanceToAdd)
        ];

        // saveTimestamp(nftID);
        updateBalance(nftID);

        emit BalanceAdded(nftID, 2, _balanceToAdd);

        return true;
    }

    function withdrawAllOwnerBalance(address nftOwner, uint256 nftID)
        external
        whenNotPaused
    {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole()
            || RoleControl.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
            ,
            "The nftOwner address should be the function caller"
        );

        updateBalance(nftID);

        uint256 bal = nftBalances[nftID].prevBalance[2];
        _withdrawBalance(nftID, bal);
    }

    function withdrawBalanceLinked(
        address nftOwner,
        uint256 nftID,
        uint256 _bal,
        address customNFTcontract,
        uint256 customNFTid
    ) public whenNotPaused {
        require(
            nftOwner == _msgSender()
            || isBridgeRole()
            || RoleControl.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
            ,
            "The nftOwner address should be the function caller"
        );
        require(
            LinkContract.isLinkedTo(customNFTcontract, customNFTid, nftID),
            "Not linked custom NFT in LinkNFT smart contract"
        );
        require(
            IERC721(customNFTcontract).ownerOf(customNFTid) == nftOwner,
            "Sender not the owner of Custom NFT id"
        );
        _withdrawBalance(nftID, _bal);
    }

    function withdrawBalance(address nftOwner, uint256 nftID, uint256 _bal)
        public
        whenNotPaused
    {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole()
            || RoleControl.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
            ,
            "The nftOwner address should be the function caller"
        );
        _withdrawBalance(nftID, _bal);
    }

    function _withdrawBalance(uint256 nftID, uint256 _bal)
        internal
        whenNotPaused
    {
        updateBalance(nftID);

        require(nftBalances[nftID].prevBalance[2] >= _bal, "Withdraw amount is greater than the balance.");

        BalanceCalculator.withdrawBalance(_msgSender(), _bal);

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0],
            nftBalances[nftID].prevBalance[1],
            nftBalances[nftID].prevBalance[2].sub(_bal)
        ];

        saveTimestamp(nftID);

        emit BalanceWithdrawn(nftID, 2, _bal);
    }

    function addBalanceAsCredit(
        address sender,
        uint256 nftID,
        uint256 _balanceToAdd,
        uint256 _expiryUnixTimestamp
    )
        external
        whenNotPaused
    {
        require(
            sender == _msgSender()
            || isBridgeRole(),
            "The sender address should be the function caller"
        );
        require(
            creditsExpiry[sender][nftID].expiryTimestamp < _expiryUnixTimestamp,
            "Credits expiry cannot be set lesser than previous expiry"
        );

        updateBalance(nftID);

        XCTToken.transferFrom(
            sender,
            address(BalanceCalculator),
            _balanceToAdd
        );

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0].add(_balanceToAdd),
            nftBalances[nftID].prevBalance[1],
            nftBalances[nftID].prevBalance[2]
        ];

        saveTimestamp(nftID);

        creditsExpiry[sender][nftID].expiryTimestamp = _expiryUnixTimestamp;
        creditsExpiry[sender][nftID].amountAdded += _balanceToAdd;

        emit BalanceAdded(nftID, 0, _balanceToAdd);
    }

    function addBalanceAsExternalDeposit(address sender, uint256 nftID, uint256 _balanceToAdd)
        external
        whenNotPaused
    {
        require(
            sender == _msgSender()
            || isBridgeRole(),
            "The sender address should be the function caller"
        );
        
        updateBalance(nftID);

        XCTToken.transferFrom(
            sender,
            address(BalanceCalculator),
            _balanceToAdd
        );

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0],
            nftBalances[nftID].prevBalance[1].add(_balanceToAdd),
            nftBalances[nftID].prevBalance[2]
        ];

        saveTimestamp(nftID);

        emit BalanceAdded(nftID, 1, _balanceToAdd);
    }

    function withdrawCreditsForNFT(address sender, uint256 nftID, address _to)
        external
        whenNotPaused
    {
        require(
            sender == _msgSender()
            || isBridgeRole(),
            "The sender address should be the function caller"
        );
        require(
            creditsExpiry[sender][nftID].expiryTimestamp < block.timestamp,
            "Credits not expired yet"
        );

        updateBalance(nftID);

        uint256 id = nftID;
        uint256 withdrawBal = creditsExpiry[sender][nftID].amountAdded;

        if(withdrawBal == 0)
        {
            return;
        }

        creditsExpiry[sender][nftID].amountAdded = 0;
        if(nftBalances[id].prevBalance[0] < withdrawBal)
        {
            withdrawBal = nftBalances[id].prevBalance[0];
        }

        nftBalances[id].prevBalance = [
            nftBalances[id].prevBalance[0] - withdrawBal,
            nftBalances[id].prevBalance[1],
            nftBalances[id].prevBalance[2]
        ];

        // XCTToken.transfer(_to, withdrawBal);
        BalanceCalculator.withdrawBalance(_to, withdrawBal);

        saveTimestamp(nftID);

        emit BalanceWithdrawn(nftID, 0, withdrawBal);
    }

    // ALWAYS check before computing
    function isBalancePresent(uint256 nftID) public view returns (bool) {
        if (block.timestamp < nftBalances[nftID].balanceEndTime) return true;
        return false;
    }

    function estimateUpdatedBalance(uint256 nftID)
        public
        view
        returns (uint256[3] memory)
    {
        uint256[] memory subnetIds = SubscriptionContract.getSubnetsOfNFT(nftID);
        bool[] memory activeSubnets = SubscriptionContract.getActiveSubnetsOfNFT(nftID);
        return
            BalanceCalculator.getRealtimeBalance(
                nftID,
                subnetIds,
                activeSubnets,
                nftBalances[nftID].prevBalance,
                nftBalances[nftID].lastBalanceUpdateTime
            );
    }

    function estimateTotalUpdatedBalance(uint256 nftID)
        public
        view
        returns (uint256)
    {
        uint256[] memory subnetIds = SubscriptionContract.getSubnetsOfNFT(nftID);
        bool[] memory activeSubnets = SubscriptionContract.getActiveSubnetsOfNFT(nftID);
        return
            totalPrevBalance(nftID) -
            BalanceCalculator.getRealtimeCostIncurred(
                nftID,
                subnetIds,
                activeSubnets,
                nftBalances[nftID].lastBalanceUpdateTime
            );
    }

 function updateBalance(uint256 nftID)
    public
    {
        // if(nftBalances[nftID].lastBalanceUpdateTime >= nftBalances[nftID].balanceEndTime)
        // {
        //     return;
        // }

        uint256 balanceDuration = totalPrevBalance(nftID).div(dripRatePerSec(nftID));
        uint256 balanceEndTime = nftBalances[nftID].lastBalanceUpdateTime + balanceDuration;
        if(balanceEndTime > block.timestamp) {
            balanceDuration = block.timestamp - nftBalances[nftID].lastBalanceUpdateTime;
        }
        uint256[] memory subnetIds = SubscriptionContract.getSubnetsOfNFT(nftID);
        bool[] memory activeSubnets = SubscriptionContract.getActiveSubnetsOfNFT(nftID);

        uint256[3] memory prevBalanceUpdated = BalanceCalculator
            .getUpdatedBalance(
                nftID,
                subnetIds,
                activeSubnets,
                nftBalances[nftID].mintTime,
                nftBalances[nftID].prevBalance,
                balanceDuration
                // ,
                // nftBalances[nftID].lastBalanceUpdateTime
            );

        nftBalances[nftID].prevBalance = [
            prevBalanceUpdated[0],
            prevBalanceUpdated[1],
            prevBalanceUpdated[2]
        ];

        saveTimestamp(nftID);
    }

    function saveTimestamp(uint256 nftID)
    public
    {
        nftBalances[nftID].lastBalanceUpdateTime = block.timestamp;
        nftBalances[nftID].balanceEndTime = block.timestamp.add(
            totalPrevBalance(nftID).div(dripRatePerSec(nftID))
        );
    }

    function isSubscribed(uint256 nftID)
    public
    view
    returns (bool)
    {
        return nftBalances[nftID].mintTime > 0;
    }

    /* ========== MODIFIERS ========== */

    modifier onlySubscription() {
        require(
            address(SubscriptionContract) == _msgSender(),
            "SubscriptionContract can only call this function"
        );
        _;
    }

    modifier hasWithdrawRole() {
        require(
            SubscriptionContract.hasRole(
                keccak256("WITHDRAW_CREDITS_ROLE"),
                _msgSender()
            ),
            "Sender is not assigned to WITHDRAW_CREDITS_ROLE"
        );
        _;
    }

}
