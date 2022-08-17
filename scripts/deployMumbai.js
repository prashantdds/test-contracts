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
    console.log("Registration create subnet");
    await Registration.createSubnet(1,deployer.address, 1,true,1,true,[ethers.utils.parseEther("1"),ethers.utils.parseEther("2"),ethers.utils.parseEther("3"),ethers.utils.parseEther("4")],[],3,[],5000,ethers.utils.parseEther("0.01"));

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