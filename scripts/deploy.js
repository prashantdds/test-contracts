const { ethers } = require("hardhat");

// sleep time expects milliseconds
function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
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
    
    
    // deploy NFT Token
    NFT=await ethers.getContractFactory('DarkMatter');
    nftToken = await NFT.deploy();
    console.log(`const nftToken = "${nftToken.address}"`); // 0x527e794667Cb9958E058A824d991a3cf595039C0

    RegistrationContract=await ethers.getContractFactory('Registration');
    Registration = await upgrades.deployProxy(RegistrationContract, [nftToken.address, deployer.address, 300, 1000 ], { initializer: 'initialize' });
    await Registration.deployed();

    console.log(`const Registration = "${Registration.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9


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
    // uint256 _supportFeeRate
    console.log("Registration create subnet");
    await Registration.createSubnet(1,deployer.address, 1,true,1,true,[ethers.utils.parseEther("0.00001"),ethers.utils.parseEther("0.00002"),ethers.utils.parseEther("0.00003")],[],3,[],500);
    await Registration.createSubnet(2,deployer.address, 1,true,1,true,[ethers.utils.parseEther("0.00001"),ethers.utils.parseEther("0.00002"),ethers.utils.parseEther("0.00003")],[],3,[],1000);

    AppNFTContract=await ethers.getContractFactory('TestAppNFT');
    appNFT = await AppNFTContract.deploy();
    console.log(`const appNFT = "${appNFT.address}"`); // 0x527e794667Cb9958E058A824d991a3cf595039C0


    SubscriptionBalanceContract=await ethers.getContractFactory('SubscriptionBalance');
    // DAO
    // uint256 _LIMIT_NFT_SUBNETS,
    // uint256 _MIN_TIME_FUNDS,
    // IRegistration _RegistrationContract,
    // IERC721 _ApplicationNFT,
    // IERC20Upgradeable _XCTToken,
    // uint256 _REQD_NOTICE_TIME_S_PROVIDER,
    // uint256 _REQD_COOLDOWN_S_PROVIDER
    SubscriptionBalance = await upgrades.deployProxy(SubscriptionBalanceContract, [ Registration.address, appNFT.address, xct.address ], { initializer: 'initialize' });
    await SubscriptionBalance.deployed();
    console.log(`const SubscriptionBalance = "${SubscriptionBalance.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    SubscriptionContract=await ethers.getContractFactory('Subscription');
    Subscription = await upgrades.deployProxy(SubscriptionContract, [deployer.address, 3, 300, Registration.address, appNFT.address, SubscriptionBalance.address, xct.address, 2592000, 1296000 ], { initializer: 'initialize' });
    await Subscription.deployed();
    console.log(`const Subscription = "${Subscription.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    await SubscriptionBalance.setSubscriptionContract(Subscription.address);

    console.log("approve xct to subscription contract");
    await xct.approve(Subscription.address, ethers.utils.parseEther("100"));
    await xct.approve(SubscriptionBalance.address, ethers.utils.parseEther("100"));

    const id1 = await appNFT.getCurrentTokenId();
    const mintId = Number(Number(id1)+1);
    console.log("Mint NFT id: "+ mintId);
    await Subscription.subscribeNew(ethers.utils.parseEther("1"),0,"ddf","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",122,[1,1,1]);
    sleep(1000);

    nftAttributes = await SubscriptionBalance.nftBalances(mintId);
    console.log("nftBalances:" +nftAttributes);

    userSubscription = await Subscription.userSubscription(mintId,0);
    console.log("userSubscription:" +userSubscription);

    rate = await SubscriptionBalance.dripRatePerSecOfSubnet(mintId,0);
    console.log("rate: " +rate);

    // delisting subnet
    await Registration.changeSubnetAttributes(1,4,0,true,0,false,[],0,0);

    await Subscription.changeSubnetSubscription(mintId,0,1);

    userSubscription2 = await Subscription.userSubscription(mintId,1);
    console.log("userSubscription for subnet 1:" +userSubscription2);

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