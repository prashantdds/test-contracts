// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ILinkContract.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IBalanceCalculator.sol";
import "./interfaces/IApplicationNFT.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract SubscriptionBalance is OwnableUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IRegistration public RegistrationContract;
    IApplicationNFT public ApplicationNFT;
    IERC20Upgradeable public XCTToken;
    ISubscription public SubscriptionContract;
    IBalanceCalculator public BalanceCalculator;
    bytes32 public BILLING_MANAGER_ROLE;
    ILinkContract public LinkContract;

    struct NFTBalance {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance; // prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
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


    function initialize(
        IRegistration _RegistrationContract,
        IApplicationNFT _ApplicationNFT,
        IERC20Upgradeable _XCTToken,
        IBalanceCalculator _BalanceCalculator,
        uint256 _ReferralPercent,
        uint256 _ReferralRevExpirySecs
    ) public initializer {
        __Ownable_init_unchained();
        __Pausable_init_unchained();

        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
        BalanceCalculator = _BalanceCalculator;

        BILLING_MANAGER_ROLE = ApplicationNFT.getBytes32OfRole("BILLING_MANAGER");
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


    function setLinkContract(ILinkContract _newLinkContract)
        external
        onlyOwner
    {
        LinkContract = _newLinkContract;
    }

    function s_GlobalDAOAddress() public view returns (address) {
        return RegistrationContract.GLOBAL_DAO_ADDRESS();
    }


    function s_GlobalDAORate() public view returns (uint256) {
        return RegistrationContract.daoRate();
    }
    

    function prevBalances(uint256 nftID)
        public
        view
        returns (uint256[3] memory)
    {
        return nftBalances[nftID].prevBalance;
    }

    function totalPrevBalance(uint256 nftID)
    public
    view
    returns (uint256)
    {
        uint256 bal = 0;
        for (uint256 i = 0; i < 3; i++)
        {
            bal = bal.add(nftBalances[nftID].prevBalance[i]);
        }
        return bal;
    }

    function checkBalanceLeft(uint256 nftID)
    public
    view
    returns (uint256)
    {
        uint256 cost = (
            block.timestamp.sub(nftBalances[nftID].lastBalanceUpdateTime)
        ).mul(BalanceCalculator.dripRatePerSec(nftID));
        uint256 prevBalance = totalPrevBalance(nftID);
        if (prevBalance < cost) return 0;
        return prevBalance.sub(cost);
    }

    function getBalanceEndTime(uint256 nftID)
    public
    view
    returns(uint256)
    {
        return nftBalances[nftID].lastBalanceUpdateTime + nftBalances[nftID].balanceEndTime;
    }

    function subscribeNew(
        uint256 nftID
    )
    external
    onlySubscription
    returns (bool)
    {

        nftBalances[nftID] = NFTBalance(
            block.timestamp,
            [uint256(0), uint256(0), uint256(0)],
            block.timestamp,
            0
        );

        return true;
    }


    function addBalance(address nftOwner, uint256 nftID, uint256 balanceToAdd)
        public
        returns (
            bool
        )
    {
        _addBalance(nftOwner, nftID, balanceToAdd);
        return true;
    }

    function _addBalance(address sender, uint256 nftID, uint256 _balanceToAdd)
        internal
        returns (bool)
    {

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
            || ApplicationNFT.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
            ,
            "The nftOwner address should be the function caller"
        );

        updateBalance(nftID);

        uint256 bal = nftBalances[nftID].prevBalance[2];
        _withdrawBalance(nftID, bal);
    }

    // function withdrawBalanceLinked(
    //     address nftOwner,
    //     uint256 nftID,
    //     uint256 _bal,
    //     address customNFTcontract,
    //     uint256 customNFTid
    // ) public whenNotPaused {
    //     require(
    //         nftOwner == _msgSender()
    //         || isBridgeRole()
    //         || ApplicationNFT.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
    //         ,
    //         "The nftOwner address should be the function caller"
    //     );
    //     require(
    //         LinkContract.isLinkedTo(customNFTcontract, customNFTid, nftID),
    //         "Not linked custom NFT in LinkNFT smart contract"
    //     );
    //     require(
    //         IERC721(customNFTcontract).ownerOf(customNFTid) == nftOwner,
    //         "Sender not the owner of Custom NFT id"
    //     );
    //     _withdrawBalance(nftID, _bal);
    // }

    function withdrawBalance(address nftOwner, uint256 nftID, uint256 _bal)
        public
        whenNotPaused
    {
        require(
            (nftOwner == _msgSender() && (ApplicationNFT.ownerOf(nftID) == nftOwner))
            || isBridgeRole()
            || ApplicationNFT.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
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


        uint256 balanceDuration = totalPrevBalance(nftID).div(BalanceCalculator.dripRatePerSec(nftID));
        uint256 balanceEndTime = nftBalances[nftID].lastBalanceUpdateTime + balanceDuration;
        if(balanceEndTime > block.timestamp) {
            balanceDuration = block.timestamp - nftBalances[nftID].lastBalanceUpdateTime;
        }

        return
            BalanceCalculator.getRealtimeBalance(
                nftID,
                subnetIds,
                activeSubnets,
                nftBalances[nftID].prevBalance,
                balanceDuration,
                nftBalances[nftID].mintTime
            );
    }

    function estimateTotalUpdatedBalance(uint256 nftID)
        public
        view
        returns (uint256)
    {
        uint256[] memory subnetIds = SubscriptionContract.getSubnetsOfNFT(nftID);
        bool[] memory activeSubnets = SubscriptionContract.getActiveSubnetsOfNFT(nftID);

        uint256 balanceDuration = totalPrevBalance(nftID).div(BalanceCalculator.dripRatePerSec(nftID));
        uint256 balanceEndTime = nftBalances[nftID].lastBalanceUpdateTime + balanceDuration;
        if(balanceEndTime > block.timestamp) {
            balanceDuration = block.timestamp - nftBalances[nftID].lastBalanceUpdateTime;
        }

        return
            totalPrevBalance(nftID) -
            BalanceCalculator.getRealtimeCostIncurred(
                nftID,
                subnetIds,
                activeSubnets,
                balanceDuration,
                nftBalances[nftID].mintTime
            );
    }

 function updateBalance(uint256 nftID)
    public
    {
        uint256 balanceDuration = totalPrevBalance(nftID).div(BalanceCalculator.dripRatePerSec(nftID));
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
            totalPrevBalance(nftID).div(BalanceCalculator.dripRatePerSec(nftID))
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
