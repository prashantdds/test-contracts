// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IRegistration.sol";
import "./interfaces/ISubscription.sol";
import "./interfaces/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract SubscriptionBalance is OwnableUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // contract addresses cannot be changed once initialised
    IRegistration public RegistrationContract;
    IERC721 public ApplicationNFT;
    IERC20Upgradeable public XCTToken;
    ISubscription public SubscriptionContract;

    struct NFTBalance {
        uint256 lastBalanceUpdateTime;
        uint256[3] prevBalance; // prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
        uint256[] subnetIds; // cannot be changed unless delisted
        address NFTMinter;
        uint256 endOfXCTBalance;
    }

    // NFT id => NFTBalance
    mapping(uint256 => NFTBalance) public nftBalances;
    mapping(address => uint256) public balanceOfRev;
    // Credit provider => NFT id => expiry
    mapping(address => mapping(uint256 => uint256)) public creditsExpiry;

    event BalanceAdded(uint256 NFTId, uint256 balanceType, uint256 bal);
    event BalanceWithdrawn(uint256 NFTId, uint256 balanceType, uint256 bal);
    event RefreshedBalance(uint256 NFTId);
    event ReceivedRevenue(address benficiary, uint256 bal);

    function initialize(
        IRegistration _RegistrationContract,
        IERC721 _ApplicationNFT,
        IERC20Upgradeable _XCTToken
    ) public initializer {
        __Ownable_init_unchained();
        __Pausable_init_unchained();

        RegistrationContract = _RegistrationContract;
        ApplicationNFT = _ApplicationNFT;
        XCTToken = _XCTToken;
    }

    function setSubscriptionContract(address _Subscription) external onlyOwner {
        require(address(SubscriptionContract) == address(0), "Already set");
        SubscriptionContract = ISubscription(_Subscription);
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

    // r address is NFT minter address => nftBalances[_nftId].NFTMinter

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
        return SubscriptionContract.r_licenseFee(_nftId, _subnetId);
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

    function dripRatePerSec(uint256 NFTid)
        public
        view
        returns (uint256 totalDripRate)
    {
        uint256[] memory subnetIds = nftBalances[NFTid].subnetIds;
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
        uint256[] memory computeRequired = SubscriptionContract
            .getComputesOfSubnet(NFTid, subnetId);

        for (uint256 i = 0; i < prices.length; i++) {
            cost = cost.add(prices[i].mul(computeRequired[i]));
        }
        return factor.mul(cost).div(100000);
    }

    function prevBalances(uint256 NFTid) public view returns(uint256[3] memory){
        return nftBalances[NFTid].prevBalance;
    }

    function totalPrevBalance(uint256 NFTid) public view returns (uint256) {
        uint256 bal = 0;
        for (uint256 i = 0; i < 3; i++) {
            bal = bal.add(nftBalances[NFTid].prevBalance[i]);
        }
        return bal;
    }

    function balanceLeft(uint256 NFTid) public view returns (uint256) {
        uint256 cost = (
            block.timestamp.sub(nftBalances[NFTid].lastBalanceUpdateTime)
        ).mul(dripRatePerSec(NFTid));
        uint256 prevBalance = totalPrevBalance(NFTid);
        if (prevBalance < cost) return 0;
        return prevBalance.sub(cost);
    }

    function totalSubnets(uint256 nftId) external view returns (uint256) {
        return nftBalances[nftId].subnetIds.length;
    }

    function changeSubnet(
        uint256 _nftId,
        uint256 _currentSubnetId,
        uint256 _newSubnetId
    ) external onlySubscription returns (bool) {
        uint256[] memory subnetIdsInNFT = nftBalances[_nftId].subnetIds;
        // replace subnetId
        for (uint256 i = 0; i < subnetIdsInNFT.length; i++) {
            if (subnetIdsInNFT[i] == _currentSubnetId) {
                subnetIdsInNFT[i] = _newSubnetId;
                break;
            }
        }
        nftBalances[_nftId].subnetIds = subnetIdsInNFT;
        return true;
    }

    function subscribeNew(
        uint256 _nftId,
        uint256 _balanceToAdd,
        uint256 _subnetId,
        address _minter
    ) external onlySubscription returns (bool) {
        uint256[] memory arr;

        nftBalances[_nftId] = NFTBalance(
            block.timestamp,
            [uint256(0), uint256(0), uint256(0)],
            arr,
            _minter,
            0
        );
        nftBalances[_nftId].subnetIds.push(_subnetId);

        _addBalance(_nftId, _balanceToAdd);
        return true;
    }

    function addSubnetToNFT(
        uint256 _nftId,
        uint256 _subnetId
    ) external onlySubscription returns(bool){
        nftBalances[_nftId].subnetIds.push(_subnetId);
        return true;
    }

    function addBalance(uint256 _nftId, uint256 _balanceToAdd)
        public
        updateBalance(_nftId)
        returns (bool)
    {
        _addBalance(_nftId, _balanceToAdd);
        return true;
    }

    function _addBalance(uint256 _nftId, uint256 _balanceToAdd)
        internal
        returns (bool)
    {
        uint256 id = _nftId;
        XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);

        nftBalances[id].prevBalance = [nftBalances[id].prevBalance[0], nftBalances[id].prevBalance[1], nftBalances[id].prevBalance[2].add(_balanceToAdd)];

        nftBalances[id].lastBalanceUpdateTime = block.timestamp;
        refreshEndOfBalance(_nftId);
        emit BalanceAdded(_nftId, 2, _balanceToAdd);
        return true;
    }

    function withdrawAllOwnerBalance(uint256 _NFTid)
        external
        whenNotPaused
        updateBalance(_NFTid)
    {
        uint256 bal = nftBalances[_NFTid].prevBalance[2];
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
        uint id = _NFTid;
        XCTToken.transfer(_msgSender(), _bal);
        nftBalances[id].prevBalance = [nftBalances[id].prevBalance[0], nftBalances[id].prevBalance[1], nftBalances[id].prevBalance[2].sub(_bal)];

        refreshBalance(id);

        nftBalances[id].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(id).div(dripRatePerSec(id))
        );

        emit BalanceWithdrawn(id, 2, _bal);
    }

    function addBalanceAsCredit(
        uint256 _toNFTid,
        uint256 _balanceToAdd,
        uint256 _expiryUnixTimestamp
    ) external whenNotPaused updateBalance(_toNFTid) {
        uint256 id = _toNFTid;
        require(
            creditsExpiry[_msgSender()][id] < _expiryUnixTimestamp,
            "Credits expiry cannot be set lesser than previous expiry"
        );

        XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);
        nftBalances[id].prevBalance = [nftBalances[id].prevBalance[0].add(_balanceToAdd), nftBalances[id].prevBalance[1], nftBalances[id].prevBalance[2]];

        nftBalances[id].lastBalanceUpdateTime = block.timestamp;
        nftBalances[id].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(id).div(dripRatePerSec(id))
        );
        creditsExpiry[_msgSender()][id] = _expiryUnixTimestamp;
        emit BalanceAdded(id, 0, _balanceToAdd);
    }

    function addBalanceAsExternalDeposit(uint256 _NFTid, uint256 _balanceToAdd)
        external
        whenNotPaused
        updateBalance(_NFTid)
    {
        uint256 id = _NFTid;
        XCTToken.transferFrom(_msgSender(), address(this), _balanceToAdd);
        
        nftBalances[id].prevBalance = [nftBalances[id].prevBalance[0], nftBalances[id].prevBalance[1].add(_balanceToAdd), nftBalances[id].prevBalance[2]];
        
        nftBalances[id].lastBalanceUpdateTime = block.timestamp;
        nftBalances[id].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(id).div(dripRatePerSec(id))
        );
        emit BalanceAdded(id, 1, _balanceToAdd);
    }

    function withdrawCreditsForNFT(uint256 _NFTid, address _to)
        external
        hasWithdrawRole
        whenNotPaused
        updateBalance(_NFTid)
    {
        uint256 id = _NFTid;
        uint256 bal = nftBalances[id].prevBalance[0];
        require(
            creditsExpiry[_msgSender()][id] < block.timestamp,
            "Credits not expired yet"
        );

        nftBalances[id].prevBalance = [0, nftBalances[id].prevBalance[1], nftBalances[id].prevBalance[2]];
        nftBalances[id].lastBalanceUpdateTime = block.timestamp;
        nftBalances[id].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(id).div(dripRatePerSec(id))
        );
        XCTToken.transfer(_to, bal);
        refreshBalance(id);

        emit BalanceWithdrawn(_NFTid, 0, bal);
    }

    function refreshBalance(uint256 _nftId)
        public
        updateBalance(_nftId)
        returns (bool)
    {
        // modifier is only required to call
        emit RefreshedBalance(_nftId);
        return true;
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
        if (block.timestamp < nftBalances[_nftId].endOfXCTBalance) return true;
        return false;
    }

    function refreshEndOfBalance(uint256 _nftId)
        public
        updateBalance(_nftId)
        returns (bool)
    {
        nftBalances[_nftId].endOfXCTBalance = block.timestamp.add(
            totalPrevBalance(_nftId).div(dripRatePerSec(_nftId))
        );
        return true;
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

    modifier updateBalance(uint256 NFTid) {
        uint256 computeCostPerSec = 0;
        uint256[] memory subnetIds = nftBalances[NFTid].subnetIds;

        for (uint256 i = 0; i < subnetIds.length; i++) {
            (, , , , uint256[] memory prices, , , ) = RegistrationContract
                .getSubnetAttributes(subnetIds[i]);
            uint256[] memory computeRequired = SubscriptionContract
                .getComputesOfSubnet(NFTid, subnetIds[i]);
            for (uint256 j = 0; j < prices.length; j++) {
                computeCostPerSec = computeCostPerSec.add(
                    prices[j].mul(computeRequired[j])
                );
            }
        }
        uint256 computeCost = computeCostPerSec.mul(
            block.timestamp.sub(nftBalances[NFTid].lastBalanceUpdateTime)
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
            balanceOfRev[nftBalances[NFTid].NFTMinter] = balanceOfRev[
                nftBalances[NFTid].NFTMinter
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
            if (totalCostIncurred < nftBalances[NFTid].prevBalance[0])
                nftBalances[NFTid].prevBalance[0] = nftBalances[NFTid]
                    .prevBalance[0]
                    .sub(totalCostIncurred);
            else {
                balCostLeft = totalCostIncurred.sub(
                    nftBalances[NFTid].prevBalance[0]
                );
                nftBalances[NFTid].prevBalance[0] = 0;
                if (balCostLeft < nftBalances[NFTid].prevBalance[1]) {
                    nftBalances[NFTid].prevBalance[1] = nftBalances[NFTid]
                        .prevBalance[1]
                        .sub(balCostLeft);
                    balCostLeft = 0;
                } else {
                    balCostLeft = balCostLeft.sub(
                        nftBalances[NFTid].prevBalance[1]
                    );
                    nftBalances[NFTid].prevBalance[1] = 0;
                    if (balCostLeft < nftBalances[NFTid].prevBalance[2]) {
                        nftBalances[NFTid].prevBalance[2] = nftBalances[NFTid]
                            .prevBalance[2]
                            .sub(balCostLeft);
                        balCostLeft = 0;
                    } else {
                        nftBalances[NFTid].prevBalance[2] = 0;
                        balCostLeft = 0;
                    }
                }
            }

            nftBalances[NFTid].lastBalanceUpdateTime = block.timestamp;
        }

        _;
    }
}
