const { ethers } = require("hardhat");

// sleep time expects milliseconds
function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function getMultihashFromBytes32(multihash) {
    // console.log(multihash);
    const { digest, hashfunction, size } = multihash;
    const bs58 = require('bs58')

    if (size === 0) return null;
    // console.log(digest);
    // console.log(hashfunction);
    // console.log(size);
    
    // cut off leading "0x"
    const hashBytes = Buffer.from(digest.slice(2), 'hex');
    // prepend hashFunction and digest size
    const multihashBytes = new (hashBytes.constructor)(2 + hashBytes.length);
    multihashBytes[0] = hashfunction;
    multihashBytes[1] = size;
    multihashBytes.set(hashBytes, 2);
    // console.log(multihashBytes);
  
    return bs58.encode(multihashBytes);
  }
  
async function main(){

    const [deployer]=await ethers.getSigners();
    console.log('deploy by acct: '+deployer.address);
    
    const bal=await deployer.getBalance();
    console.log('bal: '+bal);

    
    // deploy XCT Token
    ERC20=await ethers.getContractFactory('TestERC20');
    xct = await upgrades.deployProxy(ERC20, [], { initializer: 'initialize' });
    await xct.deployed();

    console.log(`const xct = "${xct.address}"`); 
    
    stack = await upgrades.deployProxy(ERC20, [], { initializer: 'initialize' });
    await stack.deployed();
    console.log(`const stack = "${stack.address}"`); 
    
    // deploy NFT Token
    NFT=await ethers.getContractFactory('TestDarkMatter');
    nftToken = await NFT.deploy();
    console.log(`const nftToken = "${nftToken.address}"`); // 0x527e794667Cb9958E058A824d991a3cf595039C0

    // IERC721Upgradeable _DarkMatterNFT,
    // IERC20Upgradeable _StackToken,
    // address _GlobalDAO,
    // uint256 _coolDownTimeForPriceChange,
    // uint256 _daoRate, - 5%
    // uint256 _REQD_STACK_FEES_FOR_SUBNET
    RegistrationContract=await ethers.getContractFactory('Registration');
    Registration = await upgrades.deployProxy(RegistrationContract, [nftToken.address, stack.address, deployer.address, 300, 5000, ethers.utils.parseEther("0.1") ], { initializer: 'initialize' });
    await Registration.deployed();

    console.log(`const Registration = "${Registration.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    await stack.approve(Registration.address, ethers.utils.parseEther("1000000000"));

    await nftToken.setApprovalForAll(Registration.address, true);

    // uint256 nftId,
    // address _subnetLocalDAO,
    // uint256 _subnetType,
    // bool _sovereignStatus,
    // uint256 _cloudProviderType,
    // bool _subnetStatusListed,
    // uint256[] memory _price,
    // uint256[] memory _otherAttributes,
    // uint256 _maxClusters,
    // address[] memory _whiteListedClusters,
    // uint256 _supportFeeRate - 5%
    // uint256 _stackFeesReqd
    console.log("Registration create subnets");
    for (let index = 1; index <= 6; index++) {
        await Registration.createSubnet(index,deployer.address, 1,true,1,true,[ethers.utils.parseEther("1"),ethers.utils.parseEther("2"),ethers.utils.parseEther("3"),ethers.utils.parseEther("4")],[],3,[],5000,ethers.utils.parseEther("0.01"));
    }
    // await Registration.createSubnet(2,deployer.address, 1,true,1,true,[1,2,3],[],3,[],1000,ethers.utils.parseEther("0.01"));
    // await Registration.createSubnet(3,deployer.address, 1,true,1,true,[1,2,3],[],3,[],1000,ethers.utils.parseEther("0.01"));
    // await Registration.createSubnet(4,deployer.address, 1,true,1,true,[1,2,3],[],3,[],1000,ethers.utils.parseEther("0.01"));
    // await Registration.createSubnet(5,deployer.address, 1,true,1,true,[1,2,3],[],3,[],1000,ethers.utils.parseEther("0.01"));

    AppNFTContract=await ethers.getContractFactory('TestAppNFT');
    appNFT = await AppNFTContract.deploy();
    console.log(`const appNFT = "${appNFT.address}"`); // 0x527e794667Cb9958E058A824d991a3cf595039C0

    
    SubscriptionBalanceCalculatorContract=await ethers.getContractFactory('SubscriptionBalanceCalculator');
    // DAO
    // uint256 _LIMIT_NFT_SUBNETS,
    // uint256 _MIN_TIME_FUNDS,
    // IRegistration _RegistrationContract,
    // IERC721 _ApplicationNFT,
    // IERC20Upgradeable _XCTToken,
    // uint256 _REQD_NOTICE_TIME_S_PROVIDER,
    // uint256 _REQD_COOLDOWN_S_PROVIDER
    SubscriptionBalanceCalculator = await upgrades.deployProxy(SubscriptionBalanceCalculatorContract, [ Registration.address, appNFT.address, xct.address ], { initializer: 'initialize' });
    await SubscriptionBalanceCalculator.deployed();
    console.log(`const SubscriptionBalanceCalculator = "${SubscriptionBalanceCalculator.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    SubscriptionBalanceContract=await ethers.getContractFactory('SubscriptionBalance');
    
    // IRegistration _RegistrationContract,
    // IERC721 _ApplicationNFT,
    // IERC20Upgradeable _XCTToken,
    // IBalanceCalculator _BalanceCalculator,
    // uint256 _ReferralPercent, - 5%
    // uint256 _ReferralRevExpirySecs - 63072000 - 2 yrs
    
    SubscriptionBalance = await upgrades.deployProxy(SubscriptionBalanceContract, [ Registration.address, appNFT.address, xct.address, SubscriptionBalanceCalculator.address, 5000, 63072000 ], { initializer: 'initialize' });
    await SubscriptionBalance.deployed();
    console.log(`const SubscriptionBalance = "${SubscriptionBalance.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    // DAO
    // uint256 _LIMIT_NFT_SUBNETS,
    // uint256 _MIN_TIME_FUNDS,
    // IRegistration _RegistrationContract,
    // IERC721 _ApplicationNFT,
    // IERC20Upgradeable _XCTToken,
    // uint256 _REQD_NOTICE_TIME_S_PROVIDER,
    // uint256 _REQD_COOLDOWN_S_PROVIDER
    SubscriptionContract=await ethers.getContractFactory('Subscription');
    Subscription = await upgrades.deployProxy(SubscriptionContract, [deployer.address, 600, 300, Registration.address, appNFT.address, SubscriptionBalance.address, xct.address, 2592000, 1296000 ], { initializer: 'initialize' });
    await Subscription.deployed();
    console.log(`const Subscription = "${Subscription.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    await SubscriptionBalance.setSubscriptionContract(Subscription.address);

    await SubscriptionBalanceCalculator.setSubscriptionContract(Subscription.address);
    await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(SubscriptionBalance.address);


    console.log("approve xct to subscription contract");
    await xct.approve(Subscription.address, ethers.utils.parseEther("100000000"));
    await xct.approve(SubscriptionBalance.address, ethers.utils.parseEther("100000000"));

    const id1 = await appNFT.getCurrentTokenId();
    const mintId = Number(Number(id1)+1);
    console.log("Mint NFT id: "+ mintId);


    // uint256 _balanceToAdd,
    // uint256 subnetId,
    // string memory _serviceProviderAddress,
    // address _referralAddress,
    // uint256 _licenseFee, - 10%
    // uint256[] memory _computeRequired
    await Subscription.subscribeNew(ethers.utils.parseEther("10000"),0,"ddf","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",10000,[1,1,1,1]);

    console.log("addBalanceAsCredit: ");
    await SubscriptionBalance.addBalanceAsCredit(mintId, ethers.utils.parseEther("100"),99999999999);

    console.log("addBalanceAsExternalDeposit: ");
    await SubscriptionBalance.addBalanceAsExternalDeposit(mintId, ethers.utils.parseEther("100"));

    balArr = await SubscriptionBalance.prevBalances(mintId);
    console.log("prevBalances: " +balArr);

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId);
    console.log("totalPrevBalance: " +totalPrevBalance);


    getRealtimeCostIncurredUnsettled = await SubscriptionBalance.getRealtimeCostIncurredUnsettled(mintId);
    console.log("getRealtimeCostIncurredUnsettled: " +getRealtimeCostIncurredUnsettled);

    balArr = await SubscriptionBalance.getRealtimeBalances(mintId);
    console.log("RealtimeBalances: " +balArr);


    console.log("settleAccountBalance ");
    await SubscriptionBalance.settleAccountBalance(mintId);
    console.log("refresh end of balance");
    await SubscriptionBalance.refreshEndOfBalance(mintId);
    console.log("subscribe existing");

    // //subscribeToExistingNFT(
    // //     uint256 _nftId,
    // //     uint256 _subnetId,
    // //     string memory _serviceProviderAddress,
    // //     address _referralAddress,
    // //     uint256 _licenseFee,
    // //     uint256[] memory _computeRequired
    // // )

    // for (let index = 1; index < 6; index++) {
    //     await Subscription.subscribeToExistingNFT(mintId,index,"ddf","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",10000,[1,1,1,1]);
    // }

    await Subscription.subscribeBatchToExistingNFT(mintId,[1,2,3,4,5],["ddf","ddf","ddf","ddf","ddf"],["0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7"],[10000,10000,10000,10000,10000],[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]]);

    totalSubnets = await SubscriptionBalance.totalSubnets(mintId);
    console.log("totalSubnets created for NFT id: "+mintId+" = "+Number(totalSubnets));

    nftAttributes = await SubscriptionBalance.nftBalances(mintId);
    console.log("nftBalances:" +nftAttributes);

    userSubscription = await Subscription.userSubscription(mintId,0);
    console.log("userSubscription:" +userSubscription);

    rate = await SubscriptionBalance.dripRatePerSecOfSubnet(mintId,0);
    console.log("subnet driprate: " +rate);
   
    rate = await SubscriptionBalance.dripRatePerSec(mintId);
    console.log("rate: " +rate);


    balArr = await SubscriptionBalance.prevBalances(mintId);
    console.log("prevBalances: " +balArr);

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId);
    console.log("totalPrevBalance: " +ethers.utils.formatEther(totalPrevBalance) +" tokens");

    isBalancePresent = await SubscriptionBalance.isBalancePresent(mintId);
    console.log("isBalancePresent: " +isBalancePresent);
    
    getRealtimeCostIncurredUnsettled = await SubscriptionBalance.getRealtimeCostIncurredUnsettled(mintId);
    console.log("getRealtimeCostIncurredUnsettled: " +getRealtimeCostIncurredUnsettled);

    balArr = await SubscriptionBalance.getRealtimeBalances(mintId);
    console.log("RealtimeBalances: " +balArr);

    

        
    // delisting subnet
    console.log("Delisting and changing subnet");
    await Registration.changeSubnetAttributes(1,4,0,true,0,false,[],0,0,0);
    await Subscription.changeSubnetSubscription(mintId,0,1);

    userSubscription2 = await Subscription.userSubscription(mintId,1);
    console.log("userSubscription for subnet 1:" +userSubscription2);

    console.log("Deploy RoleControl...");
    nftToken2 = await NFT.deploy();
    console.log(`const NFT = "${nftToken2.address}"`); // 0x527e794667Cb9958E058A824d991a3cf595039C0
    RoleControlContract=await ethers.getContractFactory('RoleControl');
    RoleControl = await upgrades.deployProxy(RoleControlContract, [nftToken2.address, 1, deployer.address], { initializer: 'initialize' });
    await RoleControl.deployed();
    console.log(`const RoleControl = "${RoleControl.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    console.log("Deploy ContractBasedDeployment...");
    ContractBasedDeploymentContract=await ethers.getContractFactory('ContractBasedDeployment');
    ContractBasedDeployment = await upgrades.deployProxy(ContractBasedDeploymentContract, [RoleControl.address], { initializer: 'initialize' });
    await ContractBasedDeployment.deployed();
    console.log(`const ContractBasedDeployment = "${ContractBasedDeployment.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    const bs58 = require('bs58')
    const multihash = 'QmahqCsAUAw7zMv6P6Ae8PjCTck7taQA6FgGQLnWdKG7U8'
    console.log("IPFS hash = "+multihash)
    const decoded = bs58.decode(multihash)
    digest= `0x${Buffer.from(decoded.slice(2)).toString('hex')}`
    hashFunction= decoded[0]
    size= decoded[1]
    console.log("digest = "+ digest);
    console.log("hashFunction = "+ hashFunction);
    console.log("size = "+size);
    
    await ContractBasedDeployment.createData("app1", digest, hashFunction, size);
    console.log(`data created`);
    data = await ContractBasedDeployment.getData("app1");
    console.log(`data fetched`);
    console.log("Hash retrieved: "+getMultihashFromBytes32(data));

    getRealtimeCostIncurredUnsettled = await SubscriptionBalance.getRealtimeCostIncurredUnsettled(mintId);
    console.log("getRealtimeCostIncurredUnsettled: " +ethers.utils.formatEther(getRealtimeCostIncurredUnsettled) + " tokens");

    balArr = await SubscriptionBalance.prevBalances(mintId);
    console.log("prevBalances: " +balArr);

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId);
    console.log("totalPrevBalance: " +ethers.utils.formatEther(totalPrevBalance) +" tokens");

    console.log("settleAccountBalance ");
    await SubscriptionBalance.settleAccountBalance(mintId);

    balArr = await SubscriptionBalance.prevBalances(mintId);
    console.log("prevBalances: " +balArr);

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId);
    console.log("totalPrevBalance: " +ethers.utils.formatEther(totalPrevBalance) +" tokens");

    console.log("receiveRevenueForAddress");
    await SubscriptionBalanceCalculator.receiveRevenueForAddress(deployer.address);

}

main().then(()=>process.exit(0))
.catch(err=>{  
    console.error(err);
    process.exit(1);
})
// gnosis DAO - 0x2e4E45FD302882a10C66fDdc0386Ec4504cC509e
 //npx hardhat run --network bscmain scripts/deploy.js --show-stack-traces
 //npx hardhat run --network bsctest scripts/deploy.js --show-stack-traces
//  npx hardhat run --network localhost scripts/deploy.js --show-stack-traces
// npx hardhat node