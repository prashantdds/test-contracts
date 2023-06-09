const { ethers } = require("hardhat")
const {
    abi: routerABI,
    bytecode: routerBytecode,
} = require("@uniswap/v2-periphery/build/UniswapV2Router02.json")

const {
    abi: wethABI,
    bytecode: wethBytecode,
} = require("@uniswap/v2-periphery/build/WETH9.json")

const accounts = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
]

let noPrint = false

let parameters = {
    registration: {
        globalDAO: accounts[0],
        coolDownTimeForPriceChange: 300,
        daoRate: 5000,
        reqdStackFeesForSubnet: ethers.utils.parseEther("0.1"),
        defaultWhitelistedClusterWeight: 20,
    },
    subscription: {
        globalDAO: accounts[0],
        limitNFTSubnets: 600,
        minTimeFunds: 300,
        supportFactor1: 10000,
        supportFactor2: 1,
        globalSupportAddress: accounts[1],
        reqdNoticeTimeSProvider: 2592000,
        reqdCooldownSProvider: 1296000,
    },
    subscriptionBalance: {
        referralPercent: 5000,
        referralRevExpirySecs: 63072000,
    },
    xctMinter: {
        slippage: 10000, // 10%
        // percentStackConversion: 10000, // 10%
        percentStackConversion: 10000, // 10%
        percentStackAdvantage: 5000, // 5%
        stepUpFactor: Math.pow(10,12),
        usdcAddressPolygon: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        wethAddressPolygon: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
    },
}

const setParameters = (params) => {
    parameters = { ...parameters, ...params }
}

let addresses = {}

const setAddresses = (newaddr) => {
    addresses = newaddr
}

const getAddresses = () => addresses

const setNoPrint = (flag) => {
    noPrint = flag
}

const checkNoPrint = () => noPrint

const printLogs = (str) => {
    if (checkNoPrint()) return
    console.log(str)
}

///////////////////////////// GET CONTRACTS//////////////////////////////////

const getXCT = async () => {
    const xctContract = await ethers.getContractFactory("TestXCTERC20")
    return await xctContract.attach(addresses.xct)
}

const getStack = async () => {
    const stackContract = await ethers.getContractFactory("TestERC20")
    return await stackContract.attach(addresses.stack)
}

const getNFTToken = async () => {
    const nftContract = await ethers.getContractFactory("TestDarkMatter")
    return await nftContract.attach(addresses.nftToken)
}

const getRegistration = async () => {
    const registrationContract = await ethers.getContractFactory("Registration")
    return await registrationContract.attach(addresses.Registration)
}

const getAppNFT = async () => {
    const appNFTContract = await ethers.getContractFactory("TestAppNFT")
    return await appNFTContract.attach(addresses.appNFT)
}

const getSubscription = async () => {
    const SubscriptionContract = await ethers.getContractFactory("Subscription")
    return await SubscriptionContract.attach(addresses.Subscription)
}

const getSubscriptionBalance = async () => {
    const registrationContract = await ethers.getContractFactory(
        "SubscriptionBalance"
    )
    return await registrationContract.attach(addresses.SubscriptionBalance)
}

const getSubscriptionBalanceCalculator = async () => {
    const SubscriptionBalanceCalculator = await ethers.getContractFactory(
        "SubscriptionBalanceCalculator"
    )
    return await SubscriptionBalanceCalculator.attach(
        addresses.SubscriptionBalanceCalculator
    )
}

const getSubnetDAODistributor = async () => {
    const SubnetDAODistributor = await ethers.getContractFactory(
        "SubnetDAODistributor"
    )
    return await SubnetDAODistributor.attach(addresses.SubnetDAODistributor)
}

const getNftTokenV2 = async () => {
    const NftTokenV2Contract = await ethers.getContractFactory("TestDarkMatter")
    return await NftTokenV2Contract.attach(addresses.NFT)
}

const getRoleControl = async () => {
    const RoleControlContract = await ethers.getContractFactory("RoleControlV2")
    return await RoleControlContract.attach(addresses.RoleControl)
}

const getContractBasedDeployment = async () => {
    const ContractBasedDeployment = await ethers.getContractFactory(
        "ContractBasedDeploymentV2"
    )
    return await ContractBasedDeployment.attach(
        addresses.ContractBasedDeployment
    )
}

const getXCTMinter = async () => {
    const XCTMinterContract = await ethers.getContractFactory("XCTMinter");
    return await XCTMinterContract.attach(
        addresses.xctMinter
    );
}
///////////////////////////// DEPLOY CONTRACTS//////////////////////////////////

const deployXCT = async () => {
    const ERC20 = await ethers.getContractFactory("TestXCTERC20")
    // const XCT = await ERC20.deploy();
    const XCT = await upgrades.deployProxy(ERC20, [], {
        initializer: "initialize",
    })
    await XCT.deployed()
    // await XCT.initialize();
    printLogs(`const xct = "${XCT.address}"`)
    return XCT.address
}

const deployStack = async () => {
    console.log("before deploy stack");
    const ERC20 = await ethers.getContractFactory("TestERC20")
    console.log("after factory");
    // const stack = await ERC20.deploy();
    console.log("after call deploy");
    const stack = await upgrades.deployProxy(ERC20, [], {
        initializer: "initialize",
    })
    await stack.deployed()
    console.log("after deployed");
    // await stack.initialize();
    printLogs(`const stack = "${stack.address}"`)
    return stack.address
}

const deployDarkNFT = async () => {
    const NFT = await ethers.getContractFactory("TestDarkMatter")
    const nftToken = await NFT.deploy()
    printLogs(`const nftToken = "${nftToken.address}"`) // 0x527e794667Cb9958E058A824d991a3cf595039C0
    return nftToken.address
}

const callStackApprove = async () => {
    const stack = await getStack()

    const op = await stack.approve(
        addresses.Registration,
        ethers.utils.parseEther("1000000000")
    )
    printLogs("op: ", op.hash)
}

const callNftApprove = async () => {
    const nftContract = await ethers.getContractFactory("TestERC20")
    const nftToken = await getNFTToken()

    const op = await nftToken.setApprovalForAll(addresses.Registration, true)
    printLogs("op: ", op.hash)
}

const deployReg = async () => {
    const registration = parameters.registration

    RegistrationContract = await ethers.getContractFactory("Registration")
    Registration = await upgrades.deployProxy(
        RegistrationContract,
        [
            addresses.nftToken,
            addresses.stack,
            registration.globalDAO,
            registration.coolDownTimeForPriceChange,
            registration.daoRate,
            registration.reqdStackFeesForSubnet,
            registration.defaultWhitelistedClusterWeight,
        ],
        { initializer: "initialize" }
    )
    // Registration = await RegistrationContract.deploy();
    await Registration.deployed()

    // await Registration.initialize(
    //     addresses.nftToken,
    //     addresses.stack,
    //     registration.globalDAO,
    //     registration.coolDownTimeForPriceChange,
    //     registration.daoRate,
    //     registration.reqdStackFeesForSubnet,
    //     registration.defaultWhitelistedClusterWeight,
    // );

    printLogs(`const Registration = "${Registration.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9
    return Registration.address
}

const deployAppNFT = async () => {
    AppNFTContract = await ethers.getContractFactory("TestAppNFT");

    appNFT = await upgrades.deployProxy(
        AppNFTContract,
        [],
        { initializer: "initialize" }
    )

    // appNFT = await AppNFTContract.deploy()
    await appNFT.deployed();

    // await appNFT.initialize();

    printLogs(`const appNFT = "${appNFT.address}"`)
    return appNFT.address
}

const deploySubscriptionBalanceCalculator = async () => {
    // printLogs(addresses.Registration, addresses.appNFT, addresses.xct)
    SubscriptionBalanceCalculatorContract = await ethers.getContractFactory(
        "SubscriptionBalanceCalculator"
    )
    // SubscriptionBalanceCalculator = await SubscriptionBalanceCalculatorContract.deploy();
    SubscriptionBalanceCalculator = await upgrades.deployProxy(
        SubscriptionBalanceCalculatorContract,
        [addresses.Registration],
        { initializer: "initialize" }
    )
    await SubscriptionBalanceCalculator.deployed();

    // await SubscriptionBalanceCalculator.initialize(
    //     addresses.Registration
    // );

    printLogs(
    `const SubscriptionBalanceCalculator = "${SubscriptionBalanceCalculator.address}"`
    ) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return SubscriptionBalanceCalculator.address
}

const deploySubscriptionBalance = async () => {
    // printLogs(
    //     addresses.Registration,
    //     addresses.appNFT,
    //     addresses.xct,
    //     addresses.SubscriptionBalanceCalculator
    // )
    SubscriptionBalanceContract = await ethers.getContractFactory(
        "SubscriptionBalance"
    )

    const subscriptionBalance = parameters.subscriptionBalance

    SubscriptionBalance = await upgrades.deployProxy(
        SubscriptionBalanceContract,
        [
            addresses.Registration,
            addresses.appNFT,
            addresses.xct,
            // addresses.SubscriptionBalanceCalculator,
        ],
        { initializer: "initialize" }
    )

    // SubscriptionBalance = await SubscriptionBalanceContract.deploy();
    await SubscriptionBalance.deployed();

    // await SubscriptionBalance.initialize(
    //     addresses.Registration,
    //     addresses.appNFT,
    //     addresses.xct,
    //     addresses.SubscriptionBalanceCalculator,
    // )

    printLogs(`const SubscriptionBalance = "${SubscriptionBalance.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return SubscriptionBalance.address
}

const deploySubnetDAODistributor = async () => {
    // IERC20Upgradeable _XCTToken, IBalanceCalculator _SubscriptionBalanceCalculator, IRegistration _Registration
    // printLogs(
    //     addresses.xct,
    //     addresses.SubscriptionBalanceCalculator,
    //     addresses.Registration
    // )
    SubnetDAODistributorContract = await ethers.getContractFactory(
        "SubnetDAODistributor"
    )
    // SubnetDAODistributor = await SubnetDAODistributorContract.deploy();
    SubnetDAODistributor = await upgrades.deployProxy(
        SubnetDAODistributorContract,
        [
            addresses.xct,
            addresses.SubscriptionBalance,
            addresses.SubscriptionBalanceCalculator,
            addresses.Registration,
        ],
        { initializer: "initialize" }
    )
    await SubnetDAODistributor.deployed()

    // await SubnetDAODistributor.initialize(
    //         addresses.xct,
    //         addresses.SubscriptionBalance,
    //         addresses.SubscriptionBalanceCalculator,
    //         addresses.Registration
    // );

    printLogs(
        `const SubnetDAODistributor = "${SubnetDAODistributor.address}"`
    ) //
    return SubnetDAODistributor.address
}

const deploySubscription = async () => {

    const subscription = parameters.subscription

    SubscriptionContract = await ethers.getContractFactory("Subscription")
    // Subscription = await SubscriptionContract.deploy();

    Subscription = await upgrades.deployProxy(
        SubscriptionContract,
            [
                subscription.globalDAO,
                subscription.globalSupportAddress,
                [
                    subscription.supportFactor1,
                    subscription.supportFactor2
                ],
                addresses.Registration,
                addresses.appNFT,
                addresses.SubscriptionBalance,
                addresses.SubscriptionBalanceCalculator,
                addresses.xct,
                subscription.reqdNoticeTimeSProvider,
                subscription.reqdCooldownSProvider,
            ],
            { initializer: "initialize" }
        );

    await Subscription.deployed()

    printLogs(`const Subscription = "${Subscription.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    // SubscriptionContractV2 = await ethers.getContractFactory("SubscriptionV2");

    // console.log("before upgrade: ", Subscription.address);
    // await upgrades.upgradeProxy(
    //     Subscription.address,
    //     SubscriptionContractV2
    //   );

    // console.log("after upgrade");
    // SubscriptionV2 = await SubscriptionContractV2.attach(
    //     Subscription.address
    // );

    return Subscription.address
}

const getUniswapRouter = async () => {
    const [deployer] = await ethers.getSigners()
    const routerContract = new ethers.ContractFactory(
        routerABI,
        routerBytecode,
        deployer
    );
    const router = await routerContract.attach(
        "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
    )

    return router;
}

const deployXCTMinter = async () => {
    const [deployer] = await ethers.getSigners()
    // const usdcAddressPolygon = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
    // const wethAddressPolygon = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
    const xct = await getXCT()
    const stack = await getStack()
    const ERC20 = await ethers.getContractFactory("TestERC20")
    const USDC = await ERC20.attach(parameters.xctMinter.usdcAddressPolygon)

    const router = await getUniswapRouter();

    const weth9Contract = new ethers.ContractFactory(
        wethABI,
        wethBytecode,
        deployer
    )
    const weth9 = await weth9Contract.attach(parameters.xctMinter.wethAddressPolygon)
    await weth9.approve(router.address, ethers.utils.parseEther("100000"))
    await stack.approve(router.address, ethers.utils.parseEther("100000"))
    await USDC.approve(router.address, ethers.utils.parseEther("100000"))

    await router.addLiquidityETH(
        stack.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("100"),
        deployer.address,
        ethers.constants.MaxUint256,
        { value: ethers.utils.parseEther("100") }
    );

    const now = new Date()
    console.log(now.getTime())
    var time = now.getTime() * 1000 + 60 * 60 * 24;



    // const path = [0, 0, 0]
    // path[0] = stack.addres;
    // path[1] = parameters.xctMinter.wethAddressPolygon;
    // path[2] = USDC.address;

    const path = [0, 0]
    path[0] = parameters.xctMinter.wethAddressPolygon;
    // path[1] = parameters.xctMinter.wethAddressPolygon;
    path[1] = USDC.address;

    // uint256 amountForStack = _tokenAmount.mul(percentConv).div(100000);
    

    console.log("before get amounts out");
    var amounts = await router.getAmountsOut(
        ethers.utils.parseEther("100"),
        path
    );
    
    console.log("amounts: ", amounts);

    const slippageFactor = 90;


    console.log("swap amount");
    let beforeUSDC = await USDC.balanceOf(deployer.address);
    await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        amounts[1].mul(slippageFactor).div(100),
        path,
        deployer.address,
        time,
        {
            value: ethers.utils.parseEther("100")
        }
    );
    let afterUSDC = await USDC.balanceOf(deployer.address);
    afterUSDC = afterUSDC.sub(beforeUSDC);
    console.log("after USDC: ", afterUSDC);


    let stackBalance = await stack.balanceOf(deployer.address);
    console.log("before add liquidity: ", time, stackBalance);



    await router.addLiquidity(
        stack.address,
        USDC.address,

        ethers.utils.parseEther("10"),
        // ethers.utils.parseEther("10"),
        afterUSDC.div(2),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("0.1"),
        deployer.address,
        time
      );
    console.log("after add liquidity");

    
    // await router.addLiquidityETH(
    //     USDC.address,
    //     ethers.utils.parseEther("1000"),
    //     ethers.utils.parseEther("1000"),
    //     ethers.utils.parseEther("100"),
    //     deployer.address,
    //     ethers.constants.MaxUint256,
    //     { value: ethers.utils.parseEther("1000") }
    // )

    const XCTMinterContract = await ethers.getContractFactory("XCTMinter")
    const XCTMinter = await upgrades.deployProxy(
        XCTMinterContract,
        [
            stack.address,
            xct.address,
            USDC.address,
            deployer.address, // admin
            weth9.address,
            deployer.address, // treasuryAddress
            parameters.xctMinter.slippage,
            parameters.xctMinter.percentStackConversion,
            parameters.xctMinter.percentStackAdvantage,
            parameters.xctMinter.stepUpFactor,
            router.address,
        ],
        { initializer: "initialize" }
    )
    // await XCTMinter.deployed()

    // grant MINTER_ROLE to XCTMinter contract
    await xct.grantRole(
        "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
        XCTMinter.address
    )

    await xct.approve(XCTMinter.address, ethers.utils.parseEther("100"))
    await stack.approve(XCTMinter.address, ethers.utils.parseEther("100"))



    // let usdcPath = [0, 0, 0]
    let usdcPath = [0, 0]
    // usdcPath[0] = parameters.xctMinter.wethAddressPolygon;
    usdcPath[0] = stack.address
    // usdcPath[1] = parameters.xctMinter.wethAddressPolygon;
    // path[1] = parameters.xctMinter.wethAddressPolygon;
    usdcPath[1] = USDC.address;

    // uint256 amountForStack = _tokenAmount.mul(percentConv).div(100000);
    

    amounts = await router.getAmountsOut(
        // ethers.utils.parseEther("1").mul(95000).div(100000),
        ethers.utils.parseEther("1"),
        usdcPath
    );


    console.log("before buy xct: ", amounts, usdcPath);
    let xctBeforeBal = await xct.balanceOf(deployer.address);
    await XCTMinter.buyXCT(stack.address, ethers.utils.parseEther("1"));
    let xctAfterBal = await xct.balanceOf(deployer.address);
    xctAfterBal = xctAfterBal.sub(xctBeforeBal);
    console.log("after buy xct", xctAfterBal);

    return XCTMinter.address
}

const deployRoleControl = async () => {
    // printLogs("deploy role control v2")
    const RoleControlContract = await ethers.getContractFactory("RoleControlV2")
    // printLogs("nftToken2 ", addresses.NFT)
    const RoleControl = await upgrades.deployProxy(
        RoleControlContract,
        [addresses.appNFT],
        { initializer: "initialize" }
    )
    // await RoleControl.deployed()

    if (checkNoPrint()) printLogs("RoleControl: ", RoleControl.address)
    return RoleControl.address
}

const grantRoleForContractBasedDeployment = async (nftId, address, role32) => {
    // printLogs("granting Role to deployer")
    const RoleControl = await getRoleControl()
    let RoleInBytes32
    if (role32) RoleInBytes32 = role32
    else RoleInBytes32 = await RoleControl.CONTRACT_BASED_DEPLOYER()

    const op = await RoleControl.grantRole(nftId, RoleInBytes32, address)
    printLogs(op.hash)
}

const deployContractBasedDeployment = async () => {
    // printLogs("Deploy ContractBasedDeployment V2...")
    const ContractBasedDeploymentContract = await ethers.getContractFactory(
        "ContractBasedDeploymentV2"
    )
    const ContractBasedDeployment = await upgrades.deployProxy(
        ContractBasedDeploymentContract,
        [addresses.Subscription, addresses.appNFT, addresses.SubscriptionBalance, addresses.Registration],
        { initializer: "initialize" }
    )
    // await ContractBasedDeployment.deployed()
    printLogs(`ContractBasedDeployment: "${ContractBasedDeployment.address}"`)
    return ContractBasedDeployment.address
}

const connectSubBalToAppDep = async () => {
    const SubscriptionBalance = await getSubscriptionBalance();

    const op = await SubscriptionBalance.setContractBasedDeployment(addresses.ContractBasedDeployment);

    // printLogs(op.hash)
}

const connectSubBalToSubDist = async () => {
    const SubscriptionBalance = await getSubscriptionBalance();
    const op = await SubscriptionBalance.setSubnetDAODistributor(addresses.SubnetDAODistributor);

    // printLogs(op.hash)
}

const connectSubBalToBalCalc = async () => {
    const SubscriptionBalance = await getSubscriptionBalance();
    const op = await SubscriptionBalance.setBalanceCalculator(addresses.SubscriptionBalanceCalculator);

    // printLogs(op.hash)
}

const connectSubBalCalcToAppDep = async () => {
    printLogs("connect SubscriptionBalance to Subscription")
    const SubscriptionBalanceCalculator = await getSubscriptionBalanceCalculator()

    const op = await SubscriptionBalanceCalculator.setAppDeployment(
        addresses.ContractBasedDeployment
    )
    // printLogs(op.hash)
    // await SubscriptionBalanceCalculator.setSubscriptionContract(addresses.Subscription);
    // await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(addresses.SubscriptionBalance);
    // await SubscriptionBalanceCalculator.setSubnetDAODistributor(addresses.SubnetDAODistributor);
    // await Registration.set_SubnetDAODistributorContract(addresses.SubnetDAODistributor);
}


const connectSubBalToSub = async () => {
    printLogs("connect SubscriptionBalance to Subscription")
    const SubscriptionBalance = await getSubscriptionBalance()

    const op = await SubscriptionBalance.setSubscriptionContract(
        addresses.Subscription
    )
    // printLogs(op.hash)
    // await SubscriptionBalanceCalculator.setSubscriptionContract(addresses.Subscription);
    // await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(addresses.SubscriptionBalance);
    // await SubscriptionBalanceCalculator.setSubnetDAODistributor(addresses.SubnetDAODistributor);
    // await Registration.set_SubnetDAODistributorContract(addresses.SubnetDAODistributor);
}

const connectSubCalcToSub = async () => {
    printLogs("connect SubscriptionBalanceCalculator to Subscription")
    const SubscriptionBalanceCalculator =
        await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubscriptionContract(
        addresses.Subscription
    )
    // printLogs(op.hash)
}

const connectSubCalcToSubBal = async () => {
    printLogs("connect SubscriptionBalanceCalculator to SubscriptionBalance")
    const SubscriptionBalanceCalculator =
        await getSubscriptionBalanceCalculator()
    const op =
        await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(
            addresses.SubscriptionBalance
        )
    // printLogs(op.hash)
}

const connectSubCalcToSubDAO = async () => {
    printLogs("connect SubscriptionBalanceCalculator to SubnetDAODistributor")
    const SubscriptionBalanceCalculator =
        await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubnetDAODistributor(
        addresses.SubnetDAODistributor
    )
    // printLogs(op.hash)
}

const connectRegToSubDAO = async () => {
    printLogs("connect Registration to SubnetDAODistributor")
    const Registration = await getRegistration()
    const op = await Registration.set_SubnetDAODistributorContract(
        addresses.SubnetDAODistributor
    )
    // printLogs(op.hash)
}

const xctApproveSub = async () => {
    // printLogs("approve xct to subscription contract")
    const xct = await getXCT()
    const op = await xct.approve(
        addresses.Subscription,
        ethers.utils.parseEther("100000000")
    )
    await op.wait()
    // printLogs(op.hash)
}

const xctApproveSubBal = async () => {
    // printLogs("approve xct to subscription bal")
    const xct = await getXCT()
    const op = await xct.approve(
        addresses.SubscriptionBalance,
        ethers.utils.parseEther("100000000")
    )
    await op.wait()
    // printLogs(op.hash)
}

const grantSubRoleForDeployment = async (address) => {
    console.log("granting sub role for deployment");
    const Subscription = await getSubscription()
    console.log("subscription: ", Subscription.address);
    const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE()
    console.log("SUBSCRIBE ROLE: ", SUBSCRIBE_ROLE);
    await Subscription.grantRole(
        SUBSCRIBE_ROLE,
        addresses.ContractBasedDeployment
    )
}

const setupXCTMinter = async () => {
    addresses = {
        deployer: accounts[0],
    }

    addresses.xct = await deployXCT();
    addresses.stack = await deployStack();
    addresses.xctMinter = await deployXCTMinter();

    console.log("addresses: ", addresses);

    xct = await getXCT();
    stack = await getStack();
    XCTMinter = await getXCTMinter();
    return {xct, stack, XCTMinter};
}


const testXCT = async () => {
    addrList = await ethers.getSigners();
    const deployer = addrList[0];
    const valueToSend = ethers.utils.parseEther("1");

    // const {stack, xct, XCTMinter} = await helper.setupXCTMinter();
    xct = await getXCT();
    stack = await getStack();
    XCTMinter = await getXCTMinter();
    const router = await getUniswapRouter();

    provider = ethers.provider;

    balance = await provider.getBalance(deployer.address);
    console.log(balance.toString()); // 0

    let path = [
        parameters.xctMinter.wethAddressPolygon,
        stack.address
    ]

    const slippageFactor = (100000 - parameters.xctMinter.slippage)/1000;
    
    console.log("slippage: ", slippageFactor);

    const amountForStack = valueToSend.mul(parameters.xctMinter.percentStackConversion).div(
        100000
    );

    const amountForUSDC = valueToSend.mul(100000 - parameters.xctMinter.percentStackConversion).div(
        100000
    );

    console.log("amount for stack: ", amountForStack);
    console.log("amouunt for usdc:", amountForUSDC);
    
    let stackAmountsOut = await router.getAmountsOut(
        amountForStack,
        [
            parameters.xctMinter.wethAddressPolygon,
            stack.address   
        ]
    );

    let usdcAmountsOut = await router.getAmountsOut(
        amountForUSDC,
        [
            parameters.xctMinter.wethAddressPolygon,
            parameters.xctMinter.usdcAddressPolygon   
        ]
    );

    const expectedStack = stackAmountsOut[1];
    const expectedUSDC = usdcAmountsOut[1].mul(slippageFactor).div(100);
    
    console.log("expectedStack: ", expectedStack);
    console.log("expected usdc: ", expectedUSDC);

    let ethBalanceBefore = await provider.getBalance(deployer.address);
    let beforeBalance= await xct.balanceOf(deployer.address);
    let beforeStackBalance = await stack.balanceOf(deployer.address);
    await XCTMinter.easyBuyXCT(
        {
            value: valueToSend
        }
    );
    let afterBalance = await xct.balanceOf(deployer.address);
    let ethBalanceAfter = await provider.getBalance(deployer.address);
    let afterStackBalance = await stack.balanceOf(deployer.address);

    console.log("eth: ", ethBalanceBefore);
    console.log("eth deducted: ", ethBalanceBefore.sub(ethBalanceAfter));
    console.log("xct added: ",afterBalance.sub(beforeBalance));
    console.log("stack balance added: ", afterStackBalance.sub(beforeStackBalance));

    
    // address[] memory path = new address[](2);
    // path[0] = WETH;
    // path[1] = address(StackToken);

}

const deployContracts = async () => {
    addresses = {
        deployer: accounts[0],
    }

    addresses.xct = await deployXCT()
    addresses.stack = await deployStack()
    addresses.nftToken = await deployDarkNFT()
    addresses.Registration = await deployReg()
    addresses.appNFT = await deployAppNFT()
    addresses.SubscriptionBalanceCalculator =
        await deploySubscriptionBalanceCalculator()
    addresses.SubscriptionBalance = await deploySubscriptionBalance()
    addresses.SubnetDAODistributor = await deploySubnetDAODistributor()
    addresses.Subscription = await deploySubscription()
    addresses.xctMinter = await deployXCTMinter()
    addresses.ContractBasedDeployment = await deployContractBasedDeployment()
    console.log("check 3");
    await grantSubRoleForDeployment()
    await connectSubBalToSub()
    await connectSubCalcToSub()
    await connectSubCalcToSubBal()
    await connectSubCalcToSubDAO()
    await connectRegToSubDAO()
    await connectSubBalToAppDep();
    await connectSubBalCalcToAppDep();
    await connectSubBalToBalCalc();
    await connectSubBalToSubDist();

    printLogs(addresses)
}

module.exports = {
    accounts,
    parameters,
    addresses,
    setAddresses,
    getAddresses,
    getXCT,
    getStack,
    getNFTToken,
    getRegistration,
    getAppNFT,
    getSubscription,
    getSubscriptionBalance,
    getSubscriptionBalanceCalculator,
    getSubnetDAODistributor,
    getRoleControl,
    grantRoleForContractBasedDeployment,
    getContractBasedDeployment,
    xctApproveSub,
    xctApproveSubBal,
    deployXCT,
    deployStack,
    deployDarkNFT,
    callStackApprove,
    callNftApprove,
    deployReg,
    deployAppNFT,
    deploySubscriptionBalanceCalculator,
    deploySubscriptionBalance,
    deploySubnetDAODistributor,
    deploySubscription,
    deployContracts,
    deployRoleControl,
    grantRoleForContractBasedDeployment,
    deployContractBasedDeployment,
    setNoPrint,
    setParameters,
    grantSubRoleForDeployment,
    connectSubBalToSub,
    connectSubCalcToSub,
    connectSubCalcToSubBal,
    connectSubCalcToSubDAO,
    connectRegToSubDAO,
    getXCTMinter,
    deployXCTMinter,
    setupXCTMinter,
    testXCT
}
