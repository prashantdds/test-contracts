# StackOS Smart Contracts

Sections below describes the following : 
1) The purpose of contract
2) How to deploy
3) Scope of Audit
4) Rationale

## Table of Content

- [Overview](#overview)
- [How to deploy](#deployment)
- [Audit scope](#audit-scope)
- [Rationale](#Rationale)
- [Google Docs Link](https://docs.google.com/document/d/12w1iET9kHGh7iw4f1XJXoyv8OpjlBRy6cmePGxiTa0A/edit)
- [Explanation Videos on YouTube](https://www.youtube.com/playlist?list=PLdh5k6-F8fppMv3xok1zNLBHALz-mqlhx)
- [Flowchart](https://docs.google.com/drawings/d/1trayY847r8Kf8Nmh8ZBJI9WPnK01Rz25XuVXwvxQZGw/edit)

## Overview

| Contract Name | File and Location | Description |
|--|--| --|
|Registration| [`Registration.sol`](./contracts/Registration.sol) | Upgradeable Registration contract with creating subnet, clusters and defining rules around it.  |
|Subscription| [`Subscription.sol`](./contracts/Subscription.sol) | Upgradeable Subscription contract for subscribing to subnets and minting NFTs to subscriber address.|
|SubscriptionBalance| [`SubscriptionBalance.sol`](./contracts/SubscriptionBalance.sol) | Upgradeable contract for maintaining balances of subscriptions, subnets included in NFTs. Revenue is distributed as per (1+r+s+t+u)*( compute Reqd * Unit Price + ...) formula|
|SubscriptionBalanceCalculator| [`SubscriptionBalanceCalculator.sol`](./contracts/SubscriptionBalanceCalculator.sol) | Upgradeable contract for calculating balances of subscriptions, subnets included in NFTs internally by `SubscriptionBalance` contract above. Revenue logic for distribution as per (1+r+s+t+u)*( compute Reqd * Unit Price + ...) formula is coded here. Revenue can be claimed by addresses using this smart contract.|
|SubnetDAODistributor| [`SubnetDAODistributor.sol`](./contracts/SubnetDAODistributor.sol) | Upgradeable contract where the XCT assigned to subnet local DAO (1 - part of (1+r+s+t+u)) goes to clusters based on weights set by `CLUSTER_LIST_ROLE` defined in Registration smart contract. By default, every cluster owner gets weight of 10.|
|RoleControl| [`RoleControl.sol`](./contracts/RoleControl.sol) | Upgradeable RoleControl contract for each NFT to add roles - `READ, DEPLOYER, ACCESS_MANAGER, BILLING_MANAGER and CONTRACT_BASED_DEPLOYER` by NFT owner.|
|ContractBasedDeployment| [`ContractBasedDeployment.sol`](./contracts/ContractBasedDeployment.sol) | Upgradeable ContractBasedDeployment contract is used to store IPFS hash linked to app name, update it or delete it for particular NFT by `CONTRACT_BASED_DEPLOYER` role defined in `RoleControl` contract.|
|XCTMinter| [`XCTMinter.sol`](./contracts/XCTMinter.sol) | Upgradeable XCTMinter contract has rights to mint XCT token. This contract is used by anyone to buy XCT from any token. If token is Stack token, there is benefits on fees paid for minting XCT. XCT can be sold anytime to receive USDC token back. |
|LinkNFTs| [`LinkNFTs.sol`](./contracts/LinkNFTs.sol) | Upgradeable LinkNFTs contract links custom NFT to Application NFT and locks the Application NFT in smart contract. Multiple App NFTs can be locked in same Custom NFT but not vice versa. 1 Application NFT can only be used once for linking.|
|ListenerContract| [`ListenerContract.sol`](./contracts/ListenerContract.sol) | Upgradeable ListenerContract contract to listen to events from multiple contract instances at 1 place.|


## Deployment

Use `deploy.js` to deploy the smart contracts.

## Audit-Scope
Solidity files that need auditing
|--|
[`Registration.sol`](./contracts/Registration.sol) |
[`Subscription.sol`](./contracts/Subscription.sol) |
[`SubscriptionBalance.sol`](./contracts/SubscriptionBalance.sol) |
[`SubscriptionBalanceCalculator.sol`](./contracts/SubscriptionBalanceCalculator.sol) |
[`SubnetDAODistributor.sol`](./contracts/SubnetDAODistributor.sol) |
[`RoleControl.sol`](./contracts/RoleControl.sol) |
[`ContractBasedDeployment.sol`](./contracts/ContractBasedDeployment.sol) |
[`XCTMinter.sol`](./contracts/XCTMinter.sol) |
[`LinkNFTs.sol`](./contracts/LinkNFTs.sol) |
[`ListenerContract.sol`](./contracts/ListenerContract.sol) |

## Rationale
### Registration
1. `createSubnet` is called by wallet that holds DarkMatter NFT. NFT is locked in contract withdrawable by global DAO. `REQD_STACK_FEES_FOR_SUBNET` no of STACK tokens are locked in smart contract forever, only withdrawable by GLOBAL_DAO.
```
        uint256 nftId - Dark Matter NFT id to be locked
        address _subnetLocalDAO - DAO address
        uint256 _subnetType -  1=>public  2=>private
        bool _sovereignStatus, T/F
        uint256 _cloudProviderType - mapping can be maintained as required on some web page.
        bool _subnetStatusListed - by default should be true
        uint256[] memory _unitPrices - array of XCT tokens for storage, memory etc prices. 1 means 10^decimals wei for XCT tokens, so set 10^18 if 1 XCT 
        uint256[] memory _otherAttributes
        uint256 _maxClusters - max clusters limit for subnet
        address[] memory _whiteListedClusters - if private, whitelisted addresses allowed to signup for cluster
        uint256 _supportFeeRate - shall be used for subscription contract
        uint256 _stackFeesReqd - Stack tokens required by user who signsup for cluster in the subnet.

```
2. `clusterSignUp` is called by wallet that holds DarkMatter NFT. NFT is locked in contract withdrawable by global DAO. `stackFeesReqd` STACK is locked in the contract, withdrawable by `WITHDRAW_STACK_ROLE` (or `ClusterDAO` if subnet is delisted.)
```
    subnetId is required to add cluster to that subnet.
    _DNSIP - IP address is compulsory if subnet is not sovereign else can be left empty.
    _clusterDAO has rights to change _DNSIP or listing of cluster.
    nftId - This Dark Matter NFT id is locked.
```

```
Listed statuses of cluster ==>
1 = pending
2 = approved
3 = delisted
```

By default, `listed status of cluster = 1 => pending`

To change listing status, `CLUSTER_LIST_ROLE` calls `approveListingCluster(subnetId, clusterId)`.

To delist cluster, `CLUSTER_LIST_ROLE` or `ClusterDAO` calls `delistCluster(subnetId, clusterId)`.

3. `requestClusterPriceChange` is callable by PRICE_ROLE and change subnet pricing effective after cooldown time by calling `applyChangedClusterPrice` by anyone.
4. `withdrawNFT` is callable by only `DEFAULT_ADMIN_ROLE` to withdraw NFTs locked in smart contract. Note: make sure to withdraw all NFTs before changing NFT address by `changeNFT`.
5. To get realtime cluster spots open, call `totalClusterSpotsAvailable` with subnetId. It calculates keeping delisted clusters in context.
6. For all admin functions, 5 roles apart from `DEFAULT_ADMIN_ROLE` (Global DAO) are defined - 
```
    CLUSTER_LIST_ROLE - to call `changeListingCluster`
    SUBNET_ATTR_ROLE - to call `changeSubnetAttributes`
    COOLDOWN_ROLE - to call `changeCoolDownTime`
    PRICE_ROLE - change price of Cluster to call `requestClusterPriceChange`
    WHITELIST_ROLE - work on whitelisting cluster signup addresses
    PAUSER_ROLE - to pause/unpause
``` 
Note Global DAO has access to all these roles by default who can revoke or grant access to these roles.

7. Call `changeSubnetAttributes` to change the attributes of subnet. `SUBNET_ATTR_ROLE` can call it.
```
        uint256 subnetId,
        uint256 _attributeNo - must provide attribute no from 1 to 7
        uint256 _subnetType, // 1
        bool _sovereignStatus, // 2
        uint256 _cloudProviderType, // 3
        bool _subnetStatusListed, // 4
        uint256[] memory _otherAttributes, // 5
        uint256 _maxClusters, // 6
        uint256 _supportFeeRate // 7
```
8. For a private subnet, following functions are present to work on whitelisted addresses. `WHITELIST_ROLE` can call these.
```
addClusterToWhitelisted(uint256 subnetId, address[] memory _whitelistAddresses) 
removeClusterFromWhitelisted(uint256 subnetId, address _blacklistAddress, uint256 _index)
resetWhitelistClusters(uint256 subnetId)
```
<b>Please note: whenever you whitelist cluster, also add weights in `SubnetDAODistributor` smart contract calling `addWeight()` function.</b>

9. `daoRate` can only be changed by `DEFAULT_ADMIN_ROLE` by calling `changeDAORate`.
10. Local DAO ownership can be transferred by `transferClusterDAOOwnership`.
11. To check STACK tokens locked, use view function `balanceOfStackLocked(ClusterDAO address)`. To fetch ClusterDAO address use `subnetClusters[subnetId][clusterId].ClusterDAO` address.
12. To withdraw STACK by DAO for cluster with role `WITHDRAW_STACK_ROLE` call `withdrawStackFromClusterByDAO`. Can be called if cluster performance is not upto mark.
13. Incase subnet is delisted, withdraw STACK and NFT locked by calling function `withdrawClusterForDelistedSubnet` from  `ClusterDAO`.

### Subscription
1. `subscribeNew` is called by wallet that wants to subscribe to the subnet. XCT balance should be added for MIN_TIME_FUNDS time period. computeRequired array needs to set for reqd compute. Application NFT will be minted and NFT id is returned.
```
        uint256 _balanceToAdd - XCT tokens to add, should be above set min time limit
        uint256 subnetId
        string memory _serviceProviderAddress
        address _referralAddress
        uint256 _licenseFee - 1000=1%
        uint256[] memory _computeRequired = array with same size as unitPrices array of Registration contract.
```
Call subscribeBatchNew() with array values to subcribe multiple subnet ids at once.
<b>Please note: ERC 721 NFT contract should have following functions mandatory.</b>
```
getCurrentTokenId() returns uint - to get current/last token Id minted.
mint(address _to) - to mint the NFT. Subscription contract address should have permissions to MINT.
ownerOf(_nftId) - returns address of owner of provided _nftId.
```

2. `subscribeToExistingNFT` is called by wallet that already holds Application NFT. Subnet id given is pushed to that NFT computations. To add multiple subnet ids at once on existing NFT, call subscribeBatchToExistingNFT().


3. To add referral address if not set during subscription, call `addReferralAddress`
```
        uint256 _nftId,
        uint256 _subnetId,
        address _refAddress - address to be set as referrer
``` 
4. If subnet is delisted in Registration contract, call `changeSubnetSubscription` to replace existing subnet id with new one.
```
        uint256 _nftId,
        uint256 _currentSubnetId - subnet id to be replaced
        uint256 _newSubnetId - new subnet id chosen
```

5. If NFT owner wants to change service provider, then `requestServiceProviderChange` is called. There is limit `REQD_NOTICE_TIME_S_PROVIDER` that should pass before one can request for change. Also, in order to apply the requested service provider change, `applyServiceProviderChange` needs to called (callable by anyone once `REQD_COOLDOWN_S_PROVIDER` is passed)

6. Only few attributes can be changed by contract `DEFAULT_ADMIN_ROLE`:
```
change__LIMIT_NFT_SUBNETS(uint256 _new_LIMIT_NFT_SUBNETS)
change__MIN_TIME_FUNDS(uint256 _new_MIN_TIME_FUNDS)
change__REQD_NOTICE_TIME_S_PROVIDER(uint256 _REQD_NOTICE_TIME_S_PROVIDER)
change__REQD_COOLDOWN_S_PROVIDER(uint256 _REQD_COOLDOWN_S_PROVIDER)
```

Some function roles are defined
```
CHANGE_COMPUTE_ROLE - to call changeComputesOfSubnet()
WITHDRAW_CREDITS_ROLE - to call withdrawCreditsForNFT() in SubscriptionBalance contract.
CHANGE_SUBSCRIPTION_ROLE - to call change__CHANGE_SUBSCRIPTION() in Subscription contract.
```
More roles can be added by `addRole()` function. To get bytes32 of role use view function `getBytes32OfRole()`. Admin can revoke the role by calling `revokeRole`.

7. `userSubscription(NFT id, Subnet id)` gives details of subnet subscribed to NFT in general. 
```
    struct NFTSubnetAttribute {
        string serviceProviderAddress; - can be changed after REQD_NOTICE_TIME_S_PROVIDER in REQD_COOLDOWN_S_PROVIDER
        address referralAddress; - address that referred. It can be set later if not set during subscription.  
        uint256 r_licenseFee; - 1000 = 1% and so on
        uint256[] computeRequired; - array of units required by subscriber, can be changed anytime.
        bool subscribed; - current status of use of subnet.
    }
```


### SubscriptionBalance

1. `totalPrevBalance` view function gives total XCT balance (including credit and external deposit) at last updated time of balance. Use `prevBalances` to see division into credit, external storage and owner wallet.
```
prevBalances[0] - Credits (withdrawable by WITHDRAW_CREDITS_ROLE) - add balance by function call => addBalanceAsCredit(nftID,balance)
prevBalances[1] - External deposit (non withdrawable) - add balance by function call => addBalanceAsExternalDeposit(nftID,balance)
prevBalances[2] - Owner wallet - add balance by addBalance() function.
```
Note: nftBalances[NFTid].prevBalance[0] - Credits balance is withdrawable after `expiryUnixTimestamp` by WITHDRAW_CREDITS_ROLE by calling `withdrawCreditsForNFT`.

2. XCT balance for NFT is settled/refreshed everytime new subscription happens on NFT or balance is added. 

<b>Note: `isBalancePresent` boolean view function should be checked from backend before computation.</b>

For settling & updating XCT balance on smart contract anytime call `settleAccountBalance`.  
`balanceLeft` view function can be used to get realtime total balance left.

3. `addBalance` is callable by anyone to add XCT balance to NFT id. Call view function `balanceLeft` to see balance remaining. For ANY COMPUTATION, ALWAYS check view function `isBalancePresent()` that returns bool. Use `addBalanceAsCredit()` & `addBalanceAsExternalDeposit()` for adding balance as credit for some NFTid or as external deposit. 
4. Following view functions are present to check addresses and values for 1, R, S, T, U.
```
t_supportFeeAddress(uint256 _tokenId)
s_GlobalDAOAddress()
r address is NFT minter address => nftAttributes[_nftId].NFTMinter
u_address is referrer address - `Subscription.userSubscription[NFT id][Subnet id].referralAddress` - till `ReferralRevExpirySecs` = 2 years dynamic changeable by `change__ReferralAttributes()` function

subnetDAOWalletFor1(uint _subnetId)
r_licenseFee(uint256 _nftId, uint256 _subnetId)
s_GlobalDAORate()
t_SupportFeeRate(uint256 _subnetId)
```
5. `dripRatePerSec` view function is to check drip rate of the NFT. How much XCT is charged per second based on computation demanded while adding the subnet to NFT. It calculates for all subnets present in NFT. For particular subnet id, use view function `dripRatePerSecOfSubnet`.
```
Calculation:
[1+r+s+t+u] * [ {(resourcecompute1 requested * unit price)+(resourcecompute2 requested * unit price)+(resourcecompute3 requested * unit price)......} + {(resourcecompute1 requested * unit price)+(resourcecompute2 requested * unit price)......} ]
```

6. `getRealtimeBalances()` view function is used to fetch realtime balances calculating the unsettled balances also. To get total costs unsettled for NFT id, use view function `getRealtimeCostIncurredUnsettled()`.

7. To withdraw some owner's NFT subscription balance, call `withdrawBalance` or to withdraw all balance, call `withdrawAllOwnerBalance`. If App NFT is linked to some custom NFT, call `withdrawBalanceLinked` provided account owns the custom NFT.

8.  `nftBalances[NFT id]` mapping is present to get NFT Balance details in general.
    ```
    struct NFTBalance {
        uint256 lastBalanceUpdateTime; - last refreshed balances time
        uint256[3] prevBalance; -  prevBalance[0] = Credit wallet, prevBalance[1] = External Deposit, prevBalance[3] = Owner wallet
        uint256[] subnetIds; // cannot be changed unless delisted
        address NFTMinter; subscriber address
        uint256 endOfXCTBalance; unix timestamp when balance finished
    }
    ```

### SubscriptionBalanceCalculator
1. This smart contract is used internally by SubscriptionBalance smart contract to calculate and compute the balances by calling `getUpdatedBalance`.
```
Calculation:
[1+r+s+t+u] * [ {(resourcecompute1 requested * unit price)+(resourcecompute2 requested * unit price)+(resourcecompute3 requested * unit price)......} + {(resourcecompute1 requested * unit price)+(resourcecompute2 requested * unit price)......} ]
```
2. In order to receive revenues for (1, R, S, T) addresses, any of following functions can be called. It transfers the XCT as per the formula.
```
receiveRevenue() - by owner of wallet address
receiveRevenueForAddress(address _userAddress) - anyone can call
receiveRevenueForAddressBulk(address[] memory _userAddresses) - anyone can call
```

### SubnetDAODistributor
1. The XCT assigned to subnet local DAO (1 - part of (1+r+s+t+u)) goes to clusters based on weights set by `CLUSTER_LIST_ROLE` defined in Registration smart contract. Default clusters get `weight = 10` for each CLUSTER_LIST_ROLE DAO.
2. `CLUSTER_LIST_ROLE` of Registration contract calls `addWeight()` with subnet id, revenue address and weight. Weight can be any uint number, the ratios must be kept in mind. Calling the same function, `CLUSTER_LIST_ROLE`  can also update weights.
3. Call `collectAndAssignRevenues()` anytime to assign revenues share to addresses whom weights are assigned. It is by default called every time `addWeight()` is called to add/update weights.
4. Anyone can claim for cluster user after calling `claimAllRevenueFor()` with user address, can be claimed on own by calling `claimAllRevenue()`.
5. Call `resetWeights()` to reset all weights and do the changes.
6. View weights for any address by `getWeightsFor(subnetId, revenueAddress)`. To see balance of assigned revenues, call `balanceOfAssignedRevenue(Rev Address)`


### RoleControl
1. It is deployed for particular NFT id and only the owner of that NFT can grant roles.
```
READ
DEPLOYER
ACCESS_MANAGER
BILLING_MANAGER
CONTRACT_BASED_DEPLOYER
```
2. NFT owner calls `grantRole` to give any of above roles to any address.
```
grantRole(
    bytes32 role, - bytes32 of the role name, constants are defined as public to fetch values like `READ`, `DEPLOYER` etc.
    address account - address to give the role to.
    )
```
3. NFT owner can call `revokeRole` to revoke any particular role as well same way.
4. NFT owner can also add more roles as desired apart from above roles. To get bytes32 of any role in string, call `getBytes32OfRole` with role name string.
5. To fetch if any particular account has that role or not, use `hasRole` or `hasRoleOf` view function. 
```
hasRole(bytes32 roleName, address account) - if you have roleName in bytes32 use this function.

hasRoleOf(string roleName, address account) - if you have roleName in string, use this function
```

### ContractBasedDeployment
1. Reference taken from https://github.com/saurfang/ipfs-multihash-on-solidity for efficient use of bytes32 and store IPFS hash.
2. To convert IPFS hash into following:
    ```
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size
    ```
    use JS library `bs58` and following JS code (can be referred in `deploy.js` script):
    ```
    const bs58 = require('bs58')
    const multihash = 'QmahqCsAUAw7zMv6P6Ae8PjCTck7taQA6FgGQLnWdKG7U8'
    console.log("IPFS hash = "+multihash)
    const decoded = bs58.decode(multihash)
    digest= `0x${Buffer.from(decoded.slice(2)).toString('hex')}`
    hashFunction= decoded[0]
    size= decoded[1]
    ```
3. Once you have digest, hashFunction and size `CONTRACT_BASED_DEPLOYER` role defined in `RoleControl` smart contract can call `createData` or `updateData` or `deleteData` functions in this smart contract with `appName` string to use in reference.

```
    To store new data:
    function createData(
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size
    ) 

    To update existing data:
    function updateData(
        string memory appName,
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size
    )

    To delete data:
    function deleteData(
        string memory appName
    )
```
4. To get data stored in smart contract for particular appName call view function `getData`.
```
    function getData(string memory appName)
        public
        view
        returns (
            bytes32 digest,
            uint8 hashfunction,
            uint8 size
        )
```
It returns digest, hashfunction and size. To convert these back to IPFS hash, use following JS code (also present in `deploy.js` script).
```
function getMultihashFromBytes32(multihash) {
    const { digest, hashfunction, size } = multihash;
    const bs58 = require('bs58')
    if (size === 0) return null;    
    // cut off leading "0x"
    const hashBytes = Buffer.from(digest.slice(2), 'hex');
    // prepend hashFunction and digest size
    const multihashBytes = new (hashBytes.constructor)(2 + hashBytes.length);
    multihashBytes[0] = hashfunction;
    multihashBytes[1] = size;
    multihashBytes.set(hashBytes, 2);
    return bs58.encode(multihashBytes);
  }
```


### XCTMinter

1. Use view functions `estimateBuyFromStack`, `estimateBuyFromAnyToken` or `estimateBuy` to get estimates for buying XCT from Stack token, any other token or payable token (like Matic in Polygon) respectively.

2. User can buy XCT from Matic in Polygon chain by calling `easyBuyXCT()`.

3. User can buy XCT from any ERC20 token by calling `buyXCT(address _token, uint256 _tokenAmount)`.
```
address _token, - token address used to buy.
uint256 _tokenAmount - tokens amount to be used
```
Note: make sure to `approve` atleast `_tokenAmount` to this smart contract from that ERC20 token address.

4. To sell XCT and receive USDC back, call `sellXCT(_amountXCT)`. Sender account's XCT is burned and USDC locked in smart contract is released back to sender.

5. Use following view functions to get percentage used in calculations - 
`percentStackConversion()` - 1000 <=> 1% 
If user buys from Stack token, there is some advantage to percentage fees given by:
`percentStackAdvantage()`

```
eg. 
If you buy from token X, you pay 10% fees in Stack token and receive XCT from 90% USDC locked.
On other hand, if you buy from Stack token, you pay lesser fees say 5% fees in Stack token and receive XCT from 95% USDC locked. Hence, 5% advantage.
```

Admin can change slippage used by contract and above parameters by following:
```
setSlippage(uint256 _slippage) 
setPercentStack(
        uint256 _percentStackConversion,
        uint256 _percentStackAdvantage
    ) 
for setting 1% use -> 1000
```

6. `totalXCTMintedByContract()` view function gives total XCT minted by this smart contract.

7. Refer script `deployXCT.js` for deploying this smart contract.
8. Admin can change StackToken address by calling `changeStackTokenAddress()` with new address.

### LinkNFTs

1. Main function is to link custom NFT to Application NFT and locks the Application NFT in smart contract. Multiple App NFTs can be locked in same Custom NFT but not vice versa. 1 Application NFT can only be used once for linking.

2. Call `linkTo` to link Custom NFT to Appliation NFT.
```
        uint256 AppNFTid,
        address CustomNFTAddress,
        uint256 CustomNFTid
```

3. To get all links of particular Custom NFT, call `getAllLinks` with Custom NFT address and id.

4. To check if particular App NFT is linked T/F - call `isLinked(App NFT id)`

5. Refer script `deployLinkNFT.js` for deploying this smart contract.

6. Make sure to change chain id for StackOS before deploying to mainnets in smart contract function `linkTo`.