const { ethers } = require("hardhat")

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

let addresses = {}

const setAddresses = (newaddr) => {
    addresses = newaddr
}

const getAddresses = () => addresses

///////////////////////////// GET CONTRACTS//////////////////////////////////

const getXCT = async () => {
    const xctContract = await ethers.getContractFactory("TestERC20")
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

///////////////////////////// DEPLOY CONTRACTS//////////////////////////////////

const deployXCT = async () => {
    const ERC20 = await ethers.getContractFactory("TestERC20")
    const xct = await upgrades.deployProxy(ERC20, [], {
        initializer: "initialize",
    })
    await xct.deployed()
    // console.log(`const xct = "${xct.address}"`)
    return xct.address
}

const deployStack = async () => {
    const ERC20 = await ethers.getContractFactory("TestERC20")
    const stack = await upgrades.deployProxy(ERC20, [], {
        initializer: "initialize",
    })
    await stack.deployed()
    // console.log(`const stack = "$ {stack.address}"`)
    return stack.address
}

const deployDarkNFT = async () => {
    const NFT = await ethers.getContractFactory("TestDarkMatter")
    const nftToken = await NFT.deploy()
    // console.log(`const nftToken = "${nftToken.address}"`) // 0x527e794667Cb9958E058A824d991a3cf595039C0
    return nftToken.address
}

const callStackApprove = async () => {
    const stack = await getStack()

    const op = await stack.approve(
        addresses.Registration,
        ethers.utils.parseEther("1000000000")
    )
    // console.log("op: ", op.hash)
}

const callNftApprove = async () => {
    const nftContract = await ethers.getContractFactory("TestERC20")
    const nftToken = await getNFTToken()

    const op = await nftToken.setApprovalForAll(addresses.Registration, true)
    // console.log("op: ", op.hash)
}

const deployReg = async () => {
    const [deployer] = await ethers.getSigners()
    // console.log("deploy by acct: " + deployer.address)

    RegistrationContract = await ethers.getContractFactory("Registration")
    Registration = await upgrades.deployProxy(
        RegistrationContract,
        [
            addresses.nftToken,
            addresses.stack,
            deployer.address,
            300,
            5000,
            ethers.utils.parseEther("0.1"),
            20,
        ],
        { initializer: "initialize" }
    )
    await Registration.deployed()

    // console.log(`const Registration = "${Registration.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9
    return Registration.address
}

const deployAppNFT = async () => {
    AppNFTContract = await ethers.getContractFactory("TestAppNFT")
    appNFT = await AppNFTContract.deploy()
    // console.log(`const appNFT = "${appNFT.address}"`)
    return appNFT.address
}

const deploySubscriptionBalanceCalculator = async () => {
    // console.log(addresses.Registration, addresses.appNFT, addresses.xct)
    SubscriptionBalanceCalculatorContract = await ethers.getContractFactory(
        "SubscriptionBalanceCalculator"
    )
    SubscriptionBalanceCalculator = await upgrades.deployProxy(
        SubscriptionBalanceCalculatorContract,
        [addresses.Registration, addresses.appNFT, addresses.xct],
        { initializer: "initialize" }
    )
    await SubscriptionBalanceCalculator.deployed()
    // console.log(
    // `const SubscriptionBalanceCalculator = "${SubscriptionBalanceCalculator.address}"`
    // ) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return SubscriptionBalanceCalculator.address
}

const deploySubscriptionBalance = async () => {
    // console.log(
    //     addresses.Registration,
    //     addresses.appNFT,
    //     addresses.xct,
    //     addresses.SubscriptionBalanceCalculator
    // )
    SubscriptionBalanceContract = await ethers.getContractFactory(
        "SubscriptionBalance"
    )

    // IRegistration _RegistrationContract,
    // IERC721 _ApplicationNFT,
    // IERC20Upgradeable _XCTToken,
    // IBalanceCalculator _BalanceCalculator,
    // uint256 _ReferralPercent, - 5%
    // uint256 _ReferralRevExpirySecs - 63072000 - 2 yrs

    SubscriptionBalance = await upgrades.deployProxy(
        SubscriptionBalanceContract,
        [
            addresses.Registration,
            addresses.appNFT,
            addresses.xct,
            addresses.SubscriptionBalanceCalculator,
            5000,
            63072000,
        ],
        { initializer: "initialize" }
    )
    await SubscriptionBalance.deployed()
    // console.log(`const SubscriptionBalance = "${SubscriptionBalance.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return SubscriptionBalance.address
}

const deploySubnetDAODistributor = async () => {
    // IERC20Upgradeable _XCTToken, IBalanceCalculator _SubscriptionBalanceCalculator, IRegistration _Registration
    // console.log(
    //     addresses.xct,
    //     addresses.SubscriptionBalanceCalculator,
    //     addresses.Registration
    // )
    SubnetDAODistributorContract = await ethers.getContractFactory(
        "SubnetDAODistributor"
    )
    SubnetDAODistributor = await upgrades.deployProxy(
        SubnetDAODistributorContract,
        [
            addresses.xct,
            addresses.SubscriptionBalanceCalculator,
            addresses.Registration,
        ],
        { initializer: "initialize" }
    )
    await SubnetDAODistributor.deployed()
    // console.log(
    //     `const SubnetDAODistributor = "${SubnetDAODistributor.address}"`
    // ) //
    return SubnetDAODistributor.address
}

const deploySubscription = async () => {
    // console.log(
    //     addresses.deployer,
    //     600,
    //     300,
    //     addresses.Registration,
    //     addresses.appNFT,
    //     addresses.SubscriptionBalance,
    //     addresses.xct
    // )
    SubscriptionContract = await ethers.getContractFactory("Subscription")
    Subscription = await upgrades.deployProxy(
        SubscriptionContract,
        [
            addresses.deployer,
            600,
            300,
            addresses.Registration,
            addresses.appNFT,
            addresses.SubscriptionBalance,
            addresses.xct,
            2592000,
            1296000,
        ],
        { initializer: "initialize" }
    )
    await Subscription.deployed()
    // console.log(`const Subscription = "${Subscription.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return Subscription.address
}

const deployXctMinter = async () => {
    AppNFTContract = await ethers.getContractFactory("TestAppNFT")
    appNFT = await AppNFTContract.deploy()
    // console.log(`const appNFT = "${appNFT.address}"`)
    return appNFT.address
}

const connectSubBalToSub = async () => {
    console.log("connect SubscriptionBalance to Subscription")
    const SubscriptionBalance = await getSubscriptionBalance()

    const op = await SubscriptionBalance.setSubscriptionContract(
        addresses.Subscription
    )
    // console.log(op.hash)
    // await SubscriptionBalanceCalculator.setSubscriptionContract(addresses.Subscription);
    // await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(addresses.SubscriptionBalance);
    // await SubscriptionBalanceCalculator.setSubnetDAODistributor(addresses.SubnetDAODistributor);
    // await Registration.set_SubnetDAODistributorContract(addresses.SubnetDAODistributor);
}

const connectSubCalcToSub = async () => {
    console.log("connect SubscriptionBalanceCalculator to Subscription")
    const SubscriptionBalanceCalculator =
        await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubscriptionContract(
        addresses.Subscription
    )
    // console.log(op.hash)
}

const connectSubCalcToSubBal = async () => {
    console.log("connect SubscriptionBalanceCalculator to SubscriptionBalance")
    const SubscriptionBalanceCalculator =
        await getSubscriptionBalanceCalculator()
    const op =
        await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(
            addresses.SubscriptionBalance
        )
    // console.log(op.hash)
}

const connectSubCalcToSubDAO = async () => {
    console.log("connect SubscriptionBalanceCalculator to SubnetDAODistributor")
    const SubscriptionBalanceCalculator =
        await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubnetDAODistributor(
        addresses.SubnetDAODistributor
    )
    // console.log(op.hash)
}

const connectRegToSubDAO = async () => {
    console.log("connect Registration to SubnetDAODistributor")
    const Registration = await getRegistration()
    const op = await Registration.set_SubnetDAODistributorContract(
        addresses.SubnetDAODistributor
    )
    // console.log(op.hash)
}

const xctApproveSub = async () => {
    // console.log("approve xct to subscription contract")
    const xct = await getXCT()
    const op = await xct.approve(
        addresses.Subscription,
        ethers.utils.parseEther("100000000")
    )
    await op.wait()
    // console.log(op.hash)
}

const xctApproveSubBal = async () => {
    // console.log("approve xct to subscription bal")
    const xct = await getXCT()
    const op = await xct.approve(
        addresses.SubscriptionBalance,
        ethers.utils.parseEther("100000000")
    )
    await op.wait()
    // console.log(op.hash)
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
    addresses.xctMinter = await deployXctMinter()
    await connectSubBalToSub()
    await connectSubCalcToSub()
    await connectSubCalcToSubBal()
    await connectSubCalcToSubDAO()
    await connectRegToSubDAO()
    console.log(addresses)
}

module.exports = {
    accounts,
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
    xctApproveSub,
    xctApproveSubBal,
    // deployXCT,
    // deployStack,
    // deployDarkNFT,
    callStackApprove,
    callNftApprove,
    // deployReg,
    // deployAppNFT,
    deployContracts,
}