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
import "./interfaces/IContractBasedDeployment.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/ISubnetDAODistributor.sol";


contract SubscriptionBalance is OwnableUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IContractBasedDeployment public ContractBasedDeployment;
    IRegistration public RegistrationContract;
    IApplicationNFT public ApplicationNFT;
    IERC20Upgradeable public XCTToken;
    ISubscription public SubscriptionContract;
    IBalanceCalculator public BalanceCalculator;
    bytes32 public BILLING_MANAGER_ROLE;
    ILinkContract public LinkContract;
    ISubnetDAODistributor SubnetDAODistributor;

    struct NFTBalance {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance;
    }

    struct NFTCredits
    {
        uint256 expiryTimestamp;
        uint256 amountAdded;
    }

    struct NFTAccumCost
    {
        uint256 accumCost;
        uint256 accumDuration;
    }

    mapping(address => uint256) public balanceOfRev;

    event ReceivedRevenue(address benficiary, uint256 bal);

    mapping(uint256 => NFTBalance) public nftBalances;
    mapping(address => mapping(uint256 => NFTCredits)) public creditsExpiry;


    mapping(uint256 => NFTAccumCost) public nftAccumCost;

    event BalanceAdded(uint256 NFTId, uint256 balanceType, uint256 bal);
    event BalanceWithdrawn(uint256 NFTId, uint256 balanceType, uint256 bal);
    event BalanceUpdate(uint256 nftID);



    function initialize(
        IRegistration _RegistrationContract,
        IApplicationNFT _ApplicationNFT,
        IERC20Upgradeable _XCTToken
    ) public initializer {
        __Ownable_init_unchained();
        __Pausable_init_unchained();

        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
        BILLING_MANAGER_ROLE = keccak256("BILLING_MANAGER");
    }

    function setBalanceCalculator(address _BalanceCalculator) external onlyOwner {
        BalanceCalculator = IBalanceCalculator(_BalanceCalculator);
    }

    function setSubscriptionContract(address _Subscription) external onlyOwner {
        SubscriptionContract = ISubscription(_Subscription);
    }

    function setContractBasedDeployment(address _AppDeployment) external onlyOwner {
        ContractBasedDeployment = IContractBasedDeployment(_AppDeployment);
    }

    function setSubnetDAODistributor(address _SubnetDAODistributor) external onlyOwner {
        SubnetDAODistributor = ISubnetDAODistributor(_SubnetDAODistributor);
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
    external
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
    external
    view
    returns(uint256)
    {
        uint256 dripRate = BalanceCalculator.dripRatePerSec(nftID);
        if(dripRate == 0)
            return nftBalances[nftID].lastBalanceUpdateTime;

        uint256 balDur = totalPrevBalance(nftID).div(dripRate);
        return nftBalances[nftID].lastBalanceUpdateTime + balDur;
    }

    function subscribeNew(
        uint256 nftID
    )
    external
    onlySubscription
    {
        // nftBalances[nftID].lastBalanceUpdateTime = block.timestamp;
        nftBalances[nftID] = NFTBalance(
            block.timestamp,
            [uint(0), uint(0), uint(0)]
            // block.timestamp
        );
    }

    function addBalanceWithoutUpdate(address nftOwner, uint256 nftID, uint256 balanceToAdd)
    public
    onlyAppDeployment
    {
        _addBalance(nftOwner, nftID, balanceToAdd);
        emit BalanceAdded(nftID, 2, balanceToAdd);
    }


    function addBalance(address nftOwner, uint256 nftID, uint256 balanceToAdd)
        public
    {
        updateBalance(nftID);
        _addBalance(nftOwner, nftID, balanceToAdd);
    }

    function _addBalance(address sender, uint256 nftID, uint256 _balanceToAdd)
        internal
    {
        XCTToken.transferFrom(
            sender,
            address(this),
            _balanceToAdd
        );


        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0],
            nftBalances[nftID].prevBalance[1],
            nftBalances[nftID].prevBalance[2].add(_balanceToAdd)
        ];

        emit BalanceAdded(nftID, 2, _balanceToAdd);
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
            "Caller not the NFT owner"
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
            || ApplicationNFT.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
            ,
            "Caller not the NFT owner"
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
            || ApplicationNFT.hasRole(nftID, BILLING_MANAGER_ROLE, nftOwner)
            ,
            "Caller not the NFT owner"
        );
        _withdrawBalance(nftID, _bal);
    }

    function _withdrawBalance(uint256 nftID, uint256 _bal)
        internal
        whenNotPaused
    {
        updateBalance(nftID);

        require(nftBalances[nftID].prevBalance[2] >= _bal, "Withdraw amount is greater than the balance.");

        XCTToken.transfer(_msgSender(), _bal);

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0],
            nftBalances[nftID].prevBalance[1],
            nftBalances[nftID].prevBalance[2].sub(_bal)
        ];

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
            address(this),
            _balanceToAdd
        );

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0].add(_balanceToAdd),
            nftBalances[nftID].prevBalance[1],
            nftBalances[nftID].prevBalance[2]
        ];

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
            address(this),
            _balanceToAdd
        );

        nftBalances[nftID].prevBalance = [
            nftBalances[nftID].prevBalance[0],
            nftBalances[nftID].prevBalance[1].add(_balanceToAdd),
            nftBalances[nftID].prevBalance[2]
        ];

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

        XCTToken.transfer(_to, withdrawBal);


        emit BalanceWithdrawn(nftID, 0, withdrawBal);
    }

    function distributeRevenue(uint256 nftID)
    external
    {
        NFTAccumCost memory accumStore = nftAccumCost[nftID];
        
        if(accumStore.accumCost == 0)
            return;

        BalanceCalculator.distributeRevenue(
            nftID,
            accumStore.accumCost,
            accumStore.accumDuration
        );

        nftAccumCost[nftID] = NFTAccumCost(0, 0);
    }

    function updateBalance(uint256 nftID)
    public
    {
        NFTAccumCost memory accumStore = nftAccumCost[nftID];
        uint256[3] memory prevBalance = nftBalances[nftID].prevBalance;
        uint256 spent;

        for(uint i = 0; i < prevBalance.length; i++)
        {
            spent = spent.add(prevBalance[i]);
        }

        spent = BalanceCalculator
                .getUpdatedBalance(
                    nftID,
                    nftBalances[nftID].lastBalanceUpdateTime,
                    spent,
                    accumStore.accumCost,
                    accumStore.accumDuration
                );

        if(spent == 0) {
            nftBalances[nftID].lastBalanceUpdateTime = block.timestamp;
            return;
        }


        uint256[3] memory prevBalanceUpdated = 
        calculateUpdatedPrevBal(
            spent,
            prevBalance
        );

        for(uint i = 0; i < prevBalance.length; i++)
        {
            if(prevBalance[i] != prevBalanceUpdated[i])
            {
                nftBalances[nftID].prevBalance[i] = prevBalanceUpdated[i];
            }
        }

        nftBalances[nftID].lastBalanceUpdateTime = block.timestamp;

        nftAccumCost[nftID] = NFTAccumCost(0, 0);
    }


    function updateBalanceImmediate(uint256 nftID)
    onlyAppDeployment
    public
    {
        uint256[3] memory prevBalance = nftBalances[nftID].prevBalance;
        uint256 spent;
        uint256 accumCost;
        uint256 accumDuration;

        for(uint i = 0; i < prevBalance.length; i++)
        {
            spent = spent.add(prevBalance[i]);
        }
        
        (spent, accumCost, accumDuration) = BalanceCalculator
                .getUpdatedBalanceImmediate(
                    nftID,
                    nftBalances[nftID].lastBalanceUpdateTime,
                    spent
                );

        if(spent == 0) {
            nftBalances[nftID].lastBalanceUpdateTime = block.timestamp;
            return;
        }
            

        NFTAccumCost memory nftAccumStore = nftAccumCost[nftID];
        nftAccumCost[nftID] = NFTAccumCost(
            nftAccumStore.accumCost.add(accumCost),
            nftAccumStore.accumDuration.add(accumDuration)
        );

        uint256[3] memory prevBalanceUpdated = 
        calculateUpdatedPrevBal(
            spent,
            prevBalance
        );

        for(uint i = 0; i < prevBalance.length; i++)
        {
            if(prevBalance[i] != prevBalanceUpdated[i])
            {
                nftBalances[nftID].prevBalance[i] = prevBalanceUpdated[i];
            }
        }

        nftBalances[nftID].lastBalanceUpdateTime = block.timestamp;

        emit BalanceUpdate(
            nftID
        );
    }

    /* ========== BALANCE OF REV ========== */

    function min(uint a, uint b)
    internal
    pure
    returns(uint)
    {
        if(a > b) return b;
        else return a;
    }

    function max(uint a, uint b)
    internal
    pure
    returns(uint)
    {
        if(a > b) return a;
        else return b;
    }

    function calculateUpdatedPrevBal(
        uint256 totalCostIncurred,
        uint256[3] memory prevBalance
    )
    internal
    pure
    returns (uint256[3] memory prevBalanceUpdated)
    {
        uint temp;
        uint temp2;
        for(uint i = 0; i < prevBalance.length; i++)
        {
            temp = prevBalance[i];
            temp2 = min(temp, totalCostIncurred);
            prevBalanceUpdated[i] = temp.sub(temp2);
            totalCostIncurred = totalCostIncurred.sub(temp2);
        }

    }

    function addRevBalance(address account, uint256 balance)
    external
    onlyCalculatorOrDistributor
    {
        balanceOfRev[account] = balanceOfRev[account].add(balance);
    }

    function addRevBalanceBulk(address[] memory accountList, uint256[] memory balanceList)
    external
    onlyCalculatorOrDistributor
    {
        for(uint i = 0; i < accountList.length; i++)
        {
            balanceOfRev[accountList[i]] = balanceOfRev[accountList[i]].add(balanceList[i]);
        }
    }

    function receiveRevenue()
    external
    {
        receiveRevenueForAddress(_msgSender());
    }

    function receiveRevenueForAddressBulk(address[] memory _userAddresses)
    external
    {
        for (uint256 i = 0; i < _userAddresses.length; i++)
            receiveRevenueForAddress(_userAddresses[i]);
    }

    function receiveRevenueForAddress(address _userAddress)
    public
    {
        uint256 bal = balanceOfRev[_userAddress];
        XCTToken.transfer(_userAddress, bal);
        balanceOfRev[_userAddress] = 0;
        emit ReceivedRevenue(_userAddress, bal);
    }


    /* ========== MODIFIERS ========== */

    // modifier gasCheck() {
    //     gas = gasleft();
    //     _;
    //     gas -= gasleft();
    // }

    modifier onlySubscription() {
        require(
            address(SubscriptionContract) == _msgSender(),
            "Only SubscriptionContract can call this function"
        );
        _;
    }

    modifier onlyCalculatorOrDistributor() {
        require(
            address(BalanceCalculator) == _msgSender()
            || address(SubnetDAODistributor) == _msgSender()
            ,
            "Do not have access to call this"
        );
        _;
    }

    modifier onlyAppDeployment() {
        require(
            address(ContractBasedDeployment) == _msgSender(),
            "Only callable by app deployment"
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
