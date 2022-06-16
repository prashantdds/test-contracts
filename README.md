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
    _subnetType - 1=>public  2=>private
    _cloudProviderType mapping can be maintained as required on some web page.
```
2. `clusterSignUp` is called by wallet that holds DarkMatter NFT. NFT is locked in contract withdrawable by global DAO. 
```
    subnetId is required to add cluster to that subnet.
    _clusterDAO has rights to change _DNSIP or listing of cluster.
```
3. `requestClusterPriceChange` is callable by PRICE_ROLE and change subnet pricing effective after cooldown time by calling `applyChangedClusterPrice` by anyone.
4. `withdrawNFT` is callable by only DEFAULT_ADMIN_ROLE to withdraw NFTs locked in smart contract. Note: make sure to withdraw all NFTs before changing NFT address by `changeNFT`.
5. To get realtime cluster spots open, call `totalClusterSpotsAvailable` with subnetId. It calculates keeping delisted clusters in context.
6. For all admin functions, 5 roles apart from DEFAULT_ADMIN_ROLE (Global DAO) are defined - 
```
    CLUSTER_LIST_ROLE
    SUBNET_ATTR_ROLE 
    COOLDOWN_ROLE 
    PRICE_ROLE 
    WHITELIST_ROLE 
    PAUSER_ROLE
``` 
Note Global DAO has access to all these roles by default who can revoke or grant access to these roles.


