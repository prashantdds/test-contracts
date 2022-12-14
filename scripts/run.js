const { ethers } = require("hardhat")

// sleep time expects milliseconds
function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}

function getMultihashFromBytes32(multihash) {
    // console.log(multihash);
    const { digest, hashfunction, size } = multihash
    const bs58 = require("bs58")

    if (size === 0) return null
    // console.log(digest);
    // console.log(hashfunction);
    // console.log(size);

    // cut off leading "0x"
    const hashBytes = Buffer.from(digest.slice(2), "hex")
    // prepend hashFunction and digest size
    const multihashBytes = new hashBytes.constructor(2 + hashBytes.length)
    multihashBytes[0] = hashfunction
    multihashBytes[1] = size
    multihashBytes.set(hashBytes, 2)
    // console.log(multihashBytes);

    return bs58.encode(multihashBytes)
}

var addresses = {}

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

const deployXCT = async () => {
    const ERC20 = await ethers.getContractFactory("TestERC20")
    const xct = await upgrades.deployProxy(ERC20, [], {
        initializer: "initialize"
    })
    await xct.deployed()
    console.log(`const xct = "${xct.address}"`)
    return xct.address
}

const deployStack = async () => {
    const ERC20 = await ethers.getContractFactory("TestERC20")
    const stack = await upgrades.deployProxy(ERC20, [], {
        initializer: "initialize"
    })
    await stack.deployed()
    console.log(`const stack = "${stack.address}"`)
    return stack.address
}

const deployDarkNFT = async () => {
    const NFT = await ethers.getContractFactory("TestDarkMatter")
    const nftToken = await NFT.deploy()
    console.log(`const nftToken = "${nftToken.address}"`) // 0x527e794667Cb9958E058A824d991a3cf595039C0
    return nftToken.address
}

const mintDarkNFT = async () => {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

    const bal = await deployer.getBalance()

    const nftToken = await getNFTToken()

    await nftToken.mint(deployer.address)
    // console.log("nftToken: ", nftToken);
    const count = await nftToken.totalSupply()
    console.log("count: ", count)
}

const deployReg = async () => {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

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
            20
        ],
        { initializer: "initialize" }
    )
    await Registration.deployed()

    console.log(`const Registration = "${Registration.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9
    return Registration.address
}

const callStackApprove = async () => {
    const stack = await getStack()

    const op = await stack.approve(
        addresses.Registration,
        ethers.utils.parseEther("1000000000")
    )
    console.log("op: ", op.hash)
}

const callNftApprove = async () => {
    const nftContract = await ethers.getContractFactory("TestERC20")
    const nftToken = await getNFTToken()

    const op = await nftToken.setApprovalForAll(addresses.Registration, true)
    console.log("op: ", op.hash)
}

const createSubnet = async index => {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

    const Registration = await getRegistration()

    await Registration.createSubnet(
        index,
        deployer.address,
        1,
        true,
        1,
        true,
        [
            ethers.utils.parseEther("0.0001"),
            ethers.utils.parseEther("0.0002"),
            ethers.utils.parseEther("0.0003"),
            ethers.utils.parseEther("0.0004")
        ],
        [],
        3,
        [deployer.address],
        5000,
        ethers.utils.parseEther("0.01")
    )
}

const deployAppNFT = async () => {
    AppNFTContract = await ethers.getContractFactory("TestAppNFT")
    appNFT = await AppNFTContract.deploy()
    console.log(`const appNFT = "${appNFT.address}"`)
    return appNFT.address
}

const deploySubscriptionBalanceCalculator = async () => {
    console.log(addresses.Registration, addresses.appNFT, addresses.xct)
    SubscriptionBalanceCalculatorContract = await ethers.getContractFactory(
        "SubscriptionBalanceCalculator"
    )
    SubscriptionBalanceCalculator = await upgrades.deployProxy(
        SubscriptionBalanceCalculatorContract,
        [addresses.Registration, addresses.appNFT, addresses.xct],
        { initializer: "initialize" }
    )
    await SubscriptionBalanceCalculator.deployed()
    console.log(
        `const SubscriptionBalanceCalculator = "${SubscriptionBalanceCalculator.address}"`
    ) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return SubscriptionBalanceCalculator.address
}

const deploySubscriptionBalance = async () => {
    console.log(
        addresses.Registration,
        addresses.appNFT,
        addresses.xct,
        addresses.SubscriptionBalanceCalculator
    )
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
            63072000
        ],
        { initializer: "initialize" }
    )
    await SubscriptionBalance.deployed()
    console.log(`const SubscriptionBalance = "${SubscriptionBalance.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return SubscriptionBalance.address
}

const deploySubnetDAODistributor = async () => {
    // IERC20Upgradeable _XCTToken, IBalanceCalculator _SubscriptionBalanceCalculator, IRegistration _Registration
    console.log(
        addresses.xct,
        addresses.SubscriptionBalanceCalculator,
        addresses.Registration
    )
    SubnetDAODistributorContract = await ethers.getContractFactory(
        "SubnetDAODistributor"
    )
    SubnetDAODistributor = await upgrades.deployProxy(
        SubnetDAODistributorContract,
        [
            addresses.xct,
            addresses.SubscriptionBalanceCalculator,
            addresses.Registration
        ],
        { initializer: "initialize" }
    )
    await SubnetDAODistributor.deployed()
    console.log(
        `const SubnetDAODistributor = "${SubnetDAODistributor.address}"`
    ) //
    return SubnetDAODistributor.address
}

const deploySubscription = async () => {
    console.log(
        addresses.deployer,
        600,
        300,
        addresses.Registration,
        addresses.appNFT,
        addresses.SubscriptionBalance,
        addresses.xct
    )
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
            1296000
        ],
        { initializer: "initialize" }
    )
    await Subscription.deployed()
    console.log(`const Subscription = "${Subscription.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    return Subscription.address
}

const connectSubBalToSub = async () => {
    console.log("connect SubscriptionBalance to Subscription")
    const SubscriptionBalance = await getSubscriptionBalance()

    const op = await SubscriptionBalance.setSubscriptionContract(
        addresses.Subscription
    )
    console.log(op.hash)
    // await SubscriptionBalanceCalculator.setSubscriptionContract(addresses.Subscription);
    // await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(addresses.SubscriptionBalance);
    // await SubscriptionBalanceCalculator.setSubnetDAODistributor(addresses.SubnetDAODistributor);
    // await Registration.set_SubnetDAODistributorContract(addresses.SubnetDAODistributor);
}

const connectSubCalcToSub = async () => {
    console.log("connect SubscriptionBalanceCalculator to Subscription")
    const SubscriptionBalanceCalculator = await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubscriptionContract(
        addresses.Subscription
    )
    console.log(op.hash)
}

const connectSubCalcToSubBal = async () => {
    console.log("connect SubscriptionBalanceCalculator to SubscriptionBalance")
    const SubscriptionBalanceCalculator = await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubscriptionBalanceContract(
        addresses.SubscriptionBalance
    )
    console.log(op.hash)
}

const connectSubCalcToSubDAO = async () => {
    console.log("connect SubscriptionBalanceCalculator to SubnetDAODistributor")
    const SubscriptionBalanceCalculator = await getSubscriptionBalanceCalculator()
    const op = await SubscriptionBalanceCalculator.setSubnetDAODistributor(
        addresses.SubnetDAODistributor
    )
    console.log(op.hash)
}

const connectRegToSubDAO = async () => {
    console.log("connect Registration to SubnetDAODistributor")
    const Registration = await getRegistration()
    const op = await Registration.set_SubnetDAODistributorContract(
        addresses.SubnetDAODistributor
    )
    console.log(op.hash)
}

const xctApproveSub = async () => {
    console.log("approve xct to subscription contract")
    const xct = await getXCT()
    const op = await xct.approve(
        addresses.Subscription,
        ethers.utils.parseEther("100000000")
    )
    console.log(op.hash)
}

const xctApproveSubBal = async () => {
    console.log("approve xct to subscription bal")
    const xct = await getXCT()
    const op = await xct.approve(
        addresses.SubscriptionBalance,
        ethers.utils.parseEther("100000000")
    )
    console.log(op.hash)
}

const signupCluster1 = async () => {
    console.log("Cluster sign up 1 for subnet 1..")
    const Registration = await getRegistration()
    const op = await Registration.clusterSignUp(
        1,
        "sovereignsubnetcannothaveempty",
        addresses.deployer,
        7
    )
    console.log(op.hash)
}

const signupCluster2 = async () => {
    console.log("Cluster sign up 2 for subnet 1..")
    const Registration = await getRegistration()
    const op = await Registration.clusterSignUp(
        1,
        "sovereignsubnetcannothaveempty",
        addresses.deployer,
        8
    )
    console.log(op.hash)
}

const subscribeNew = async () => {
    console.log("subscribeNew")
    const Subscription = await getSubscription()
    const op = await Subscription.subscribeNew(
        ethers.utils.parseEther("10000"),
        0,
        "ddf",
        "0x9735C1b49Ce22752fC67F83DF79FC6bbe290Da17",
        10000,
        [1, 1, 1, 1]
    )
    // const op = await Subscription.subscribeNew(ethers.utils.parseEther("10000"),0,"ddf","0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",10000,[1,1,1,1]);
    console.log(op.hash)
}

const getMintID = async () => {
    // const appNFT = await getAppNFT();
    // const id1 = await appNFT.getCurrentTokenId();
    // const mintId = Number(Number(id1)+1);
    const mintId = 1
    console.log("Mint NFT id: " + mintId)
    return mintId
}

const addBalanceAsCredit = async () => {
    console.log("addBalanceAsCredit: ", ethers.utils.parseEther("100"))

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    const SubscriptionBalance = await getSubscriptionBalance()
    const op = await SubscriptionBalance.addBalanceAsCredit(
        mintId,
        ethers.utils.parseEther("100"),
        99999999999
    )
    console.log(op.hash)
}

const addBalanceAsExternalDeposit = async () => {
    console.log("addBalanceAsExternalDeposit: ")

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    const SubscriptionBalance = await getSubscriptionBalance()
    const op = await SubscriptionBalance.addBalanceAsExternalDeposit(
        mintId,
        ethers.utils.parseEther("100")
    )
    console.log(op.hash)
}

const checkBalances = async () => {
    const SubscriptionBalance = await getSubscriptionBalance()

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    balArr = await SubscriptionBalance.prevBalances(mintId)
    console.log("prevBalances: " + balArr)

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId)
    console.log("totalPrevBalance: " + totalPrevBalance)

    getRealtimeCostIncurredUnsettled = await SubscriptionBalance.getRealtimeCostIncurredUnsettled(
        mintId
    )
    console.log(
        "getRealtimeCostIncurredUnsettled: " + getRealtimeCostIncurredUnsettled
    )

    balArr = await SubscriptionBalance.getRealtimeBalances(mintId)
    console.log("RealtimeBalances: " + balArr)
}

const settleAccountBalance = async () => {
    console.log("settleAccountBalance ")

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    const SubscriptionBalance = await getSubscriptionBalance()
    const op = await SubscriptionBalance.settleAccountBalance(mintId)
    console.log(op.hash)
}

const refreshBalance = async () => {
    console.log("refresh end of balance")

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    const SubscriptionBalance = await getSubscriptionBalance()
    const op = await SubscriptionBalance.refreshEndOfBalance(mintId)
    console.log(op.hash)
}

const subToExistingNFT = async () => {
    console.log("subToExistingNFT")
    const Subscription = await getSubscription()

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    const op = await Subscription.subscribeBatchToExistingNFT(
        mintId,
        [1, 2, 3, 4, 5],
        ["ddf", "ddf", "ddf", "ddf", "ddf"],
        [
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7"
        ],
        [10000, 10000, 10000, 10000, 10000],
        [
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1]
        ]
    )
    // await Subscription.subscribeBatchToExistingNFT(mintId,[7,8,9,10,11],["ddf","ddf","ddf","ddf","ddf"],["0x4B0dFd6fC48690f82479D2586bcaCb696Ab8F152","0x4B0dFd6fC48690f82479D2586bcaCb696Ab8F152","0x4B0dFd6fC48690f82479D2586bcaCb696Ab8F152","0x4B0dFd6fC48690f82479D2586bcaCb696Ab8F152","0x4B0dFd6fC48690f82479D2586bcaCb696Ab8F152"],[10000,10000,10000,10000,10000],[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]]);
    console.log(op.hash)
}

const getTotalSubnets = async () => {
    const SubscriptionBalance = await getSubscriptionBalance()
    const Subscription = await getSubscription()

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    totalSubnets = await SubscriptionBalance.totalSubnets(mintId)
    console.log(
        "totalSubnets created for NFT id: " +
            mintId +
            " = " +
            Number(totalSubnets)
    )

    nftAttributes = await SubscriptionBalance.nftBalances(mintId)
    console.log("nftBalances:" + nftAttributes)

    userSubscription = await Subscription.userSubscription(mintId, 0)
    console.log("userSubscription:" + userSubscription)

    rate = await SubscriptionBalance.dripRatePerSecOfSubnet(mintId, 0)
    console.log("subnet driprate: " + rate)

    rate = await SubscriptionBalance.dripRatePerSec(mintId)
    console.log("rate: " + rate)

    balArr = await SubscriptionBalance.prevBalances(mintId)
    console.log("prevBalances: " + balArr)

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId)
    console.log(
        "totalPrevBalance: " +
            ethers.utils.formatEther(totalPrevBalance) +
            " tokens"
    )

    isBalancePresent = await SubscriptionBalance.isBalancePresent(mintId)
    console.log("isBalancePresent: " + isBalancePresent)

    getRealtimeCostIncurredUnsettled = await SubscriptionBalance.getRealtimeCostIncurredUnsettled(
        mintId
    )
    console.log(
        "getRealtimeCostIncurredUnsettled: " + getRealtimeCostIncurredUnsettled
    )

    balArr = await SubscriptionBalance.getRealtimeBalances(mintId)
    console.log("RealtimeBalances: " + balArr)
}

const changeSubnetAttributes = async () => {
    console.log("Delisting and changing subnet")
    const Registration = await getRegistration()
    const op = await Registration.changeSubnetAttributes(
        1,
        4,
        0,
        true,
        0,
        false,
        [],
        0,
        0,
        0,
        addresses.deployer
    )
    console.log(op.hash)
}

const changeSubnetSubscription = async () => {
    const Subscription = await getSubscription()

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    const op = await Subscription.changeSubnetSubscription(mintId, 0, 1)
    console.log(op.hash)
}

const displayUserSubscription = async () => {
    const Subscription = await getSubscription()

    const mintId = await getMintID()
    console.log("Mint NFT id: " + mintId)

    userSubscription2 = await Subscription.userSubscription(mintId, 1)
    console.log("userSubscription for subnet 1:" + userSubscription2)
}

const deployNFTToken2 = async () => {
    console.log("Deploy NFTToken2...")
    const NFT = await ethers.getContractFactory("TestDarkMatter")
    const nftToken2 = await NFT.deploy()
    console.log(`const NFT = "${nftToken2.address}"`)
}

const deployRoleControlV2 = async () => {
    console.log("deploy role control v2")
    const RoleControlContract = await ethers.getContractFactory("RoleControlV2")
    console.log("nftToken2 ", addresses.NFT)
    const RoleControl = await upgrades.deployProxy(
        RoleControlContract,
        [addresses.NFT],
        { initializer: "initialize" }
    )
    await RoleControl.deployed()
    console.log(`const RoleControl = "${RoleControl.address}"`)
}

const grantRole = async () => {
    console.log("granting Role to deployer")
    const RoleControl = await getRoleControl()
    const CONTRACT_DEPLOYER_BYTES32 = await RoleControl.CONTRACT_BASED_DEPLOYER()
    console.log("CONTRACT_DEPLOYER_BYTES32", CONTRACT_DEPLOYER_BYTES32)
    console.log("deployer addresses", addresses.deployer)
    const op = await RoleControl.grantRole(
        1,
        CONTRACT_DEPLOYER_BYTES32,
        addresses.deployer
    )
    console.log(op.hash)
}

const deployContractBasedDeploymentV2 = async () => {
    console.log("Deploy ContractBasedDeployment V2...")
    ContractBasedDeploymentContract = await ethers.getContractFactory(
        "ContractBasedDeploymentV2"
    )
    ContractBasedDeployment = await upgrades.deployProxy(
        ContractBasedDeploymentContract,
        [addresses.RoleControl],
        { initializer: "initialize" }
    )
    await ContractBasedDeployment.deployed()
    console.log(
        `const ContractBasedDeployment = "${ContractBasedDeployment.address}"`
    )
}

const getIPFS = async () => {
    const bs58 = require("bs58")
    const multihash = "QmahqCsAUAw7zMv6P6Ae8PjCTck7taQA6FgGQLnWdKG7U8"
    console.log("IPFS hash = " + multihash)
    const decoded = bs58.decode(multihash)
    const digest = `0x${Buffer.from(decoded.slice(2)).toString("hex")}`
    const hashFunction = decoded[0]
    const size = decoded[1]
    console.log("digest = " + digest)
    console.log("hashFunction = " + hashFunction)
    console.log("size = " + size)
    return { bs58, multihash, decoded, digest, hashFunction, size }

    await ContractBasedDeployment.createData(
        1,
        "app1",
        digest,
        hashFunction,
        size,
        [1, 2, 3]
    )
    console.log(`data created`)
    console.log(await ContractBasedDeployment.getFullData(1, "app1"))

    console.log("getDataByIds:")
    console.log(await ContractBasedDeployment.getDataByIds(1, [0]))

    console.log("getDataArray:")
    console.log(await ContractBasedDeployment.getDataArray(1))

    data = await ContractBasedDeployment.getData(1, "app1")
    console.log(`data fetched`)
    console.log("Hash retrieved: " + getMultihashFromBytes32(data))

    getRealtimeCostIncurredUnsettled = await SubscriptionBalance.getRealtimeCostIncurredUnsettled(
        mintId
    )
    console.log(
        "getRealtimeCostIncurredUnsettled: " +
            ethers.utils.formatEther(getRealtimeCostIncurredUnsettled) +
            " tokens"
    )

    balArr = await SubscriptionBalance.prevBalances(mintId)
    console.log("prevBalances: " + balArr)

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId)
    console.log(
        "totalPrevBalance: " +
            ethers.utils.formatEther(totalPrevBalance) +
            " tokens"
    )

    console.log("settleAccountBalance ")
    await SubscriptionBalance.settleAccountBalance(mintId)

    balArr = await SubscriptionBalance.prevBalances(mintId)
    console.log("prevBalances: " + balArr)

    totalPrevBalance = await SubscriptionBalance.totalPrevBalance(mintId)
    console.log(
        "totalPrevBalance: " +
            ethers.utils.formatEther(totalPrevBalance) +
            " tokens"
    )

    console.log("receiveRevenueForAddress")
    await SubscriptionBalanceCalculator.receiveRevenueForAddress(
        deployer.address
    )

    console.log("SubnetDAODistributor:::")

    revCollected = await SubscriptionBalanceCalculator.balanceOfRev(
        SubnetDAODistributor.address
    )
    console.log(
        "revenue assigned to SubnetDAODistributor contract by calculator: " +
            ethers.utils.formatEther(revCollected) +
            " tokens"
    )

    committedRev = await SubnetDAODistributor.commitAssigned(1)
    console.log(
        "committedRevenue : " +
            ethers.utils.formatEther(committedRev) +
            " tokens"
    )

    console.log("collectAndAssignRevenues for subnet id 1:")
    await SubnetDAODistributor.collectAndAssignRevenues(1)

    weight = await SubnetDAODistributor.getWeightsFor(1, deployer.address)
    console.log("weight 1: " + weight)
    weight2 = await SubnetDAODistributor.getWeightsFor(1, otherAddress)
    console.log("weight 2: " + weight2)
    totalwt = await SubnetDAODistributor.totalWeights(1)
    console.log("total weights: " + totalwt)

    // for testing ONLY change  weight
    console.log("change weight from 20 to 1")
    await SubnetDAODistributor.addWeight(1, deployer.address, 1)

    rev = await SubnetDAODistributor.balanceOfAssignedRevenue(deployer.address)
    console.log(
        "assigned revenue: " + ethers.utils.formatEther(rev) + " tokens"
    )

    rev2 = await SubnetDAODistributor.balanceOfAssignedRevenue(otherAddress)
    console.log(
        "assigned revenue for otherAddress as per weights: " +
            ethers.utils.formatEther(rev2) +
            " tokens"
    )

    console.log("claim revenue:")
    await SubnetDAODistributor.claimAllRevenue()

    rev3 = await SubnetDAODistributor.balanceOfAssignedRevenue(deployer.address)
    console.log(
        "assigned revenue after claim: " +
            ethers.utils.formatEther(rev3) +
            " tokens"
    )

    weight = await SubnetDAODistributor.getWeightsFor(1, deployer.address)
    console.log("weight 1: " + weight)
    weight2 = await SubnetDAODistributor.getWeightsFor(1, otherAddress)
    console.log("weight 2: " + weight2)
    totalwt = await SubnetDAODistributor.totalWeights(1)
    console.log("total weights: " + totalwt)

    console.log("reset weights")
    await SubnetDAODistributor.resetWeights(1)

    weightnew = await SubnetDAODistributor.getWeightsFor(1, deployer.address)
    console.log("after reset weights: " + weightnew)
}

const ConDepCreateData = async () => {
    const {
        bs58,
        multihash,
        decoded,
        digest,
        hashFunction,
        size
    } = await getIPFS()
    const ContractBasedDeployment = await getContractBasedDeployment()
    await ContractBasedDeployment.createData(
        1,
        "app1",
        digest,
        hashFunction,
        size,
        [1, 2, 3]
    )
    console.log(`data created`)
    console.log(await ContractBasedDeployment.getFullData(1, "app1"))
}

// Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
// Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

const deployContracts = async () => {
    addresses = {
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }

    addresses.xct = await deployXCT()
    addresses.stack = await deployStack()
    addresses.nftToken = await deployDarkNFT()
    addresses.Registration = await deployReg()
    addresses.appNFT = await deployAppNFT()
    addresses.SubscriptionBalanceCalculator = await deploySubscriptionBalanceCalculator()
    addresses.SubscriptionBalance = await deploySubscriptionBalance()
    addresses.SubnetDAODistributor = await deploySubnetDAODistributor()
    addresses.Subscription = await deploySubscription()
    await connectSubBalToSub()
    await connectSubCalcToSub()
    await connectSubCalcToSubBal()
    await connectSubCalcToSubDAO()
    await connectRegToSubDAO()
    console.log(addresses)
}

// Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
// Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

const getSubnetAttributes = async () => {
    const reg = await getRegistration()
    const subAttr = await reg.getSubnetAttributes(0)
    console.log(subAttr)
}

async function main() {
    addresses = {
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        xct: "0x59b670e9fA9D0A427751Af201D676719a970857b",
        stack: "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
        nftToken: "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
        Registration: "0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f",
        appNFT: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
        SubscriptionBalanceCalculator:
            "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F",
        SubscriptionBalance: "0x09635F643e140090A9A8Dcd712eD6285858ceBef",
        SubnetDAODistributor: "0xc5a5C42992dECbae36851359345FE25997F5C42d",
        Subscription: "0x67d269191c92Caf3cD7723F116c85e6E9bf55933"
    }

    // await getSubnetAttributes();
    // await deployContracts();
    // await deployXCT();
    // await deployStack();
    // await deployDarkNFT();
    // await mintDarkNFT(); // call 8 times
    // await deployReg();
    // await callStackApprove();
    // await callNftApprove();
    await createSubnet(1) // call 6 times, change the param to index
    // await deployAppNFT();
    // await deploySubscriptionBalanceCalculator();
    // await deploySubscriptionBalance();
    // await deploySubnetDAODistributor();
    // await deploySubscription();
    // await connectSubBalToSub();
    // await connectSubCalcToSub();
    // await connectSubCalcToSubBal();
    // await connectSubCalcToSubDAO();
    // await connectRegToSubDAO();
    // await xctApproveSub();
    // await xctApproveSubBal();
    // await signupCluster1();
    // await signupCluster2();
    // await subscribeNew();
    // await addBalanceAsCredit(); //fail
    // await addBalanceAsExternalDeposit(); //fail
    // await checkBalances();
    // await settleAccountBalance();
    // await refreshBalance(); //fail
    // await subToExistingNFT();
    // await getTotalSubnets();
    // await changeSubnetAttributes();
    // await changeSubnetSubscription();
    // await displayUserSubscription();
    // await deployNFTToken2();
    // await deployRoleControlV2();
    // await grantRole();
    // await deployContractBasedDeploymentV2();
    // await getIPFS();
}

// main().then(()=>process.exit(0))
// .catch(err=>{
//     console.error(err);
//     process.exit(1);
// })

// addresses = {
//     deployer: "0x3C904a5f23f868f309a6DB2a428529F33848f517",
//     xct: "0xca89AD662eA7A2688d29e2Df6291123eBFB807E4",
//     stack: "0xF1E0336C04f03c39904015b581A5db091B6D9960",
//     nftToken: "0x36cb2DE24CC92BCae864759D9aC4ddcc43a112B0",
//     Registration: "0x027d84b57eA012BddfDcc2b297EaeB2967912c5A",
//     appNFT: "0x492F3b79E18658f1a72c75C8a17760a006efCa60",
//     SubscriptionBalanceCalculator: "0x00Df2C3F6A40B4d657ED68b4689a7ddcA9434e59",
//     SubscriptionBalance: "0xA8ef2C4E1d0091bAb84c74cC40b7306955DfD290",
//     SubnetDAODistributor: "0xF0DeD7b2b4Ac842aA245644e89298F43ac3c8b3e",
//     Subscription: "0xfF29cFD3C9954a485d7C6D128a9f87CEB2C2b366",
//     NFT: "0xbC0fe507d07914EF7039d22Ea5FAbe6947B3D711",
//     RoleControl: "0x660c66A35e4B87454a89b307251bA5074b519892",
//     ContractBasedDeployment: "0xFB86Bcaf08f84E5c5F856bF623C04aB233839298"
// }

module.exports = {
    addresses,
    getXCT,
    getStack,
    getNFTToken,
    getRegistration,
    getAppNFT,
    getSubscription,
    getSubscriptionBalance,
    getSubscriptionBalanceCalculator,
    getSubnetDAODistributor,
    deployContracts
}
