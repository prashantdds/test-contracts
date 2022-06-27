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
- [Doc Link](https://docs.google.com/document/d/12w1iET9kHGh7iw4f1XJXoyv8OpjlBRy6cmePGxiTa0A/edit)

## Overview

| Contract Name | File and Location | Description |
|--|--| --|
|Registration| [`Registration.sol`](./contracts/Registration.sol) | Upgradeable Registration contract with creating subnet, clusters and defining rules around it.  |
|Subscription| [`Subscription.sol`](./contracts/Subscription.sol) | Upgradeable Subscription contract for subscribing to subnets and minting NFTs to subscriber address. Revenue is distributed as per (1+r+s+t)*( compute Reqd * Unit Price + ...) formula|

## Deployment

Use `deploy.js` to deploy the Registration smart contract.


## Audit-Scope
Solidity files that need auditing
|--|
[`Registration.sol`](./contracts/Registration.sol) |

## Rationale
#### Registration
1. `createSubnet` is called by wallet that holds DarkMatter NFT. NFT is locked in contract withdrawable by global DAO. 
```
        uint256 nftId - Dark Matter NFT id to be locked
        address _subnetLocalDAO - DAO address
        uint256 _subnetType -  1=>public  2=>private
        bool _sovereignStatus, T/F
        uint256 _cloudProviderType - mapping can be maintained as required on some web page.
        bool _subnetStatusListed - by default should be true
        uint256[] memory _unitPrices 
        uint256[] memory _otherAttributes
        uint256 _maxClusters - max clusters limit for subnet
        address[] memory _whiteListedClusters - if private, whitelisted addresses allowed to signup for cluster
        uint256 _supportFeeRate - shall be used for subscription contract
```
2. `clusterSignUp` is called by wallet that holds DarkMatter NFT. NFT is locked in contract withdrawable by global DAO. 
```
    subnetId is required to add cluster to that subnet.
    _DNSIP - IP address is compulsory if subnet is not sovereign else can be left empty.
    _clusterDAO has rights to change _DNSIP or listing of cluster.
    nftId - This Dark Matter NFT id is locked.
```
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
9. `daoRate` can only be changed by `DEFAULT_ADMIN_ROLE` by calling `changeDAORate`.
10. Local DAO ownership can be transferred by `transferClusterDAOOwnership`.


#### Subscription
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
Please note: ERC 721 NFT contract should have following functions mandatory.
```
getCurrentTokenId() returns uint - to get current/last token Id minted.
mint(address _to) - to mint the NFT. Subscription contract address should have permissions to MINT.
ownerOf(_nftId) - returns address of owner of provided _nftId.
```
2. `subscribeToExistingNFT` is called by wallet that already holds Application NFT. Subnet id given is pushed to that NFT computations. To add multiple subnet ids at once on existing NFT, call subscribeBatchToExistingNFT().
3. `addBalance` is callable by anyone to add XCT balance to NFT id. Call view function `balanceLeft` to see balance remaining. For ANY COMPUTATION, ALWAYS check view function `isBalancePresent()` that returns bool.
4. `dripRatePerSec` view function is to check drip rate of the NFT. How much XCT is charged per second based on computation demanded while adding the subnet to NFT. It calculates for all subnets present in NFT. For particular subnet id, use view function `dripRatePerSecOfSubnet`.
```
Calculation:
[1+r+s+t] * [ {(resourcecompute1 requested * unit price)+(resourcecompute2 requested * unit price)+(resourcecompute3 requested * unit price)......} + {(resourcecompute1 requested * unit price)+(resourcecompute2 requested * unit price)......} ]
```
5. Following view functions are present to check addresses and values for 1, R, S, T.
```
t_supportFeeAddress(uint256 _tokenId)
s_GlobalDAOAddress()
r address is NFT minter address => nftAttributes[_nftId].NFTMinter

subnetDAOWalletFor1(uint _subnetId)
r_licenseFee(uint256 _nftId, uint256 _subnetId)
s_GlobalDAORate()
t_SupportFeeRate(uint256 _subnetId)
```
6. XCT balance for NFT is refreshed everytime new subscription happens on NFT or balance is added. Note: `isBalancePresent` boolean view function should be checked from backend before computation. For updating XCT balance on smart contract anytime call `refreshBalance`.  
7. To add referral address if not set during subscription, call `addReferralAddress`
```
        uint256 _nftId,
        uint256 _subnetId,
        address _refAddress - address to be set as referrer
``` 
8. If subnet is delisted in Registration contract, call `changeSubnetSubscription` to replace existing subnet id with new one.
```
        uint256 _nftId,
        uint256 _currentSubnetId - subnet id to be replaced
        uint256 _newSubnetId - new subnet id chosen
```
9. If NFT owner wants to change service provider, then `requestServiceProviderChange` is called. There is limit `REQD_NOTICE_TIME_S_PROVIDER` that should pass before one can request for change. Also, in order to apply the requested service provider change, `applyServiceProviderChange` needs to called (callable by anyone once `REQD_COOLDOWN_S_PROVIDER` is passed)
10. In order to receive revenues for (1, R, S, T) addresses, any of following functions can be called. It transfers the XCT as per the formula.
```
receiveRevenue() - by owner of wallet address
receiveRevenueForAddress(address _userAddress) - anyone can call
receiveRevenueForAddressBulk(address[] memory _userAddresses) - anyone can call
```
11. Only few attributes can be changed by contract `owner`:
```
change__LIMIT_NFT_SUBNETS(uint256 _new_LIMIT_NFT_SUBNETS)
change__MIN_TIME_FUNDS(uint256 _new_MIN_TIME_FUNDS)
change__REQD_NOTICE_TIME_S_PROVIDER(uint256 _REQD_NOTICE_TIME_S_PROVIDER)
change__REQD_COOLDOWN_S_PROVIDER(uint256 _REQD_COOLDOWN_S_PROVIDER)
```



