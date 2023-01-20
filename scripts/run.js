const { ethers } = require("hardhat")
const helper = require("./helper")

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time))
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

const mintAppNFT = async () => {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

    const bal = await deployer.getBalance()

    const nftToken = await getAppNFT()

    tr = await nftToken.mint(deployer.address)
    rec = await tr.wait()
    const transferEvent = rec.events.find((event) => event.event == "Transfer")
    const nftID = transferEvent.args[2].toNumber()
    console.log("nftID: ", nftID)
    // console.log("nftToken: ", nftToken);
    const count = await nftToken.totalSupply()
    console.log("count: ", count)
}

const createSubnet = async (index) => {
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
            ethers.utils.parseEther("0.0004"),
        ],
        [],
        3,
        [deployer.address],
        5000,
        ethers.utils.parseEther("0.01")
    )
}

const signupCluster1 = async () => {
    console.log("Cluster sign up 1 for subnet 1..")
    const Registration = await getRegistration()
    const op = await Registration.clusterSignUp(
        0,
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
        0,
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

    getRealtimeCostIncurredUnsettled =
        await SubscriptionBalance.getRealtimeCostIncurredUnsettled(mintId)
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
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
        ],
        [10000, 10000, 10000, 10000, 10000],
        [
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1],
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

    getRealtimeCostIncurredUnsettled =
        await SubscriptionBalance.getRealtimeCostIncurredUnsettled(mintId)
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
    const CONTRACT_DEPLOYER_BYTES32 =
        await RoleControl.CONTRACT_BASED_DEPLOYER()
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

    getRealtimeCostIncurredUnsettled =
        await SubscriptionBalance.getRealtimeCostIncurredUnsettled(mintId)
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
    const { bs58, multihash, decoded, digest, hashFunction, size } =
        await getIPFS()
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

const getSubnetAttributes = async () => {
    const reg = await getRegistration()
    const subAttr = await reg.getSubnetAttributes(0)
    const clustAttr = await reg.getClusterAttributes(0, 0)
    const maxSpots = await reg.totalClusterSpotsAvailable(0)
    console.log("subAttr", subAttr)
    console.log("clustAttr", clustAttr)
    console.log("Maxspots", maxSpots)
}

const setup = async () => {
    await mintDarkNFT()
    await helper.callStackApprove()
    await helper.callNftApprove()
    await createSubnet(1)
    const xct = await getXCT()
    await xct.approve(
        helper.getAddresses().Subscription,
        ethers.utils.parseEther("1000000000")
    )
    const subscription = await helper.getSubscription()
    await subscription.subscribeNew(
        ethers.utils.parseEther("10000"),
        0,
        "ddf",
        "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
        10000,
        [1, 1, 0, 0]
    )
    await helper.grantRoleForContractBasedDeployment(1, addresses.deployer)
}

const getAmountIfLess = async (erc20, account, balanceToAdd, contractToApprove) => {
    // add amount to depositor if depositor's balance is less
    let currentBalance = await erc20.balanceOf(account.address);
    if(currentBalance.lt(balanceToAdd)) {
        await erc20.transfer(account.address,  balanceToAdd);
    }
    //approve subscription balance to withdraw erc20 out of depositor's wallet
    await erc20.connect(account).approve(
        contractToApprove.address,
        balanceToAdd
    );

}

const setupUrsula = async () => {
    const addrList = await ethers.getSigners();
    const cluster = addrList[4];
    const roleAccount1 = addrList[5];
    const roleAccount2 = addrList[6];

    const subnet1 = {
        creator: helper.getAddresses().deployer,
        subnetDAO: helper.getAddresses().deployer,
        subnetType: 1,
        sovereignStatus: true,
        cloudProviderType: 1,
        subnetStatusListed: true,
        unitPrices: [ethers.utils.parseEther("0.0001"),
        ethers.utils.parseEther("0.0002"),
        ethers.utils.parseEther("0.0003"),
        ethers.utils.parseEther("0.0004")],
        otherAttributes: [],
        maxClusters: 1,
        whitelistedClusters: [],
        stackFeesReqd: ethers.utils.parseEther("0.01")
    };

    const stack = await helper.getStack();
    const darkMatter = await helper.getNFTToken();
    const Registration = await helper.getRegistration();
    const contractDeploy = await helper.getContractBasedDeployment();
    const appNFT = await helper.getAppNFT();
    const RoleControl = await helper.getRoleControl();

    let tr = await darkMatter.mint(helper.getAddresses().deployer);
    let rec = await tr.wait();
    let transferEvent = rec.events.find(event => event.event == "Transfer");
    const nftID = transferEvent.args[2].toNumber();

    await darkMatter.setApprovalForAll(
        Registration.address,
        true
    );

    tr = await Registration.createSubnet(
        nftID,
        subnet1.subnetDAO,
        subnet1.subnetType,
        subnet1.sovereignStatus,
        subnet1.cloudProviderType,
        subnet1.subnetStatusListed,
        subnet1.unitPrices,
        subnet1.otherAttributes,
        subnet1.maxClusters,
        subnet1.whitelistedClusters,
        subnet1.stackFeesReqd,
        "subnet"
        );

    rec = await tr.wait();
    const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
    const subnetID = subnetCreatedEvent.args[0].toNumber();


    tr = await darkMatter.mint(cluster.address);
    rec = await tr.wait();
    transferEvent = rec.events.find(event => event.event == "Transfer");
    const clusterNFTID = transferEvent.args[2].toNumber();

    await darkMatter.connect(cluster).setApprovalForAll(
        Registration.address,
        true
    );

    await getAmountIfLess(stack, cluster, subnet1.stackFeesReqd, Registration);

    tr = await Registration.connect(cluster).clusterSignUp(
        subnetID,
        "",
        cluster.address,
        cluster.address,
        clusterNFTID,
        "cluster-1"
    );

    rec = await tr.wait();
    const clusterSignupEvent = rec.events.find(event => event.event == "ClusterSignedUp");
    const clusterID = clusterSignupEvent.args[1].toNumber();

    await Registration.approveListingCluster(subnetID, clusterID, 100);

    tr = await appNFT.mint(helper.getAddresses().deployer);
    rec = await tr.wait();
    transferEvent = rec.events.find(event => event.event == "Transfer");
    const appNFTID = transferEvent.args[2].toNumber();

    await helper.grantRoleForContractBasedDeployment(appNFTID, helper.getAddresses().deployer);

    tr = await contractDeploy.createData(
        appNFTID,
        "app1",
        "0xa83a5be4756de47fb0f31eed7b02c10360a73f715b8338e713aa4d5de811422e",
        18,
        32,
        [[1,1,subnetID]],
        [2, 2],
        "",
        false
    );

    const data = await contractDeploy.getFullData(appNFTID, "app1");
    const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);


    await helper.grantRoleForContractBasedDeployment(appNFTID, helper.getAddresses().deployer);


    const READ = await RoleControl.READ();
    const CONTRACT_BASED_DEPLOYER = await RoleControl.CONTRACT_BASED_DEPLOYER();


    await RoleControl.grantRole(appNFTID, READ, roleAccount1.address);
    await RoleControl.grantRole(appNFTID, CONTRACT_BASED_DEPLOYER, roleAccount2.address);

    let hasRole1 = await RoleControl.hasRole(appNFTID, READ, roleAccount1.address);
    let hasRole2 = await RoleControl.hasRole(appNFTID, CONTRACT_BASED_DEPLOYER, roleAccount2.address);

    console.log("subnetID: ", subnetID);
    console.log("clusterID: ", clusterID);
    console.log("appNFT ID: ", appNFTID);
    console.log("app data created: ", data);
    console.log("cluster attributes: ", clusterAttributes);
    console.log("account #5 has READ role: ", hasRole1);
    console.log("account #6 has CONTRACT DEPLOYER role: ", hasRole2);
}

async function main() {
    // addresses = {
    //     deployer: "0x3C904a5f23f868f309a6DB2a428529F33848f517",
    //     xct: "0xca89AD662eA7A2688d29e2Df6291123eBFB807E4",
    //     stack: "0xF1E0336C04f03c39904015b581A5db091B6D9960",
    //     nftToken: "0x36cb2DE24CC92BCae864759D9aC4ddcc43a112B0",
    //     Registration: "0x027d84b57eA012BddfDcc2b297EaeB2967912c5A",
    //     appNFT: "0x492F3b79E18658f1a72c75C8a17760a006efCa60",
    //     SubscriptionBalanceCalculator:
    //         "0x00Df2C3F6A40B4d657ED68b4689a7ddcA9434e59",
    //     SubscriptionBalance: "0xA8ef2C4E1d0091bAb84c74cC40b7306955DfD290",
    //     SubnetDAODistributor: "0xF0DeD7b2b4Ac842aA245644e89298F43ac3c8b3e",
    //     Subscription: "0xfF29cFD3C9954a485d7C6D128a9f87CEB2C2b366",
    //     NFT: "0xbC0fe507d07914EF7039d22Ea5FAbe6947B3D711",
    //     RoleControl: "0x660c66A35e4B87454a89b307251bA5074b519892",
    //     ContractBasedDeployment: "0xB73c47b77C422682219E8D9bC9217C009395cde7",
    // }
    // helper.setAddresses({
    //     deployer: "0x3C904a5f23f868f309a6DB2a428529F33848f517",
    //     xct: "0xca89AD662eA7A2688d29e2Df6291123eBFB807E4",
    //     stack: "0xF1E0336C04f03c39904015b581A5db091B6D9960",
    //     nftToken: "0x36cb2DE24CC92BCae864759D9aC4ddcc43a112B0",
    //     Registration: "0x027d84b57eA012BddfDcc2b297EaeB2967912c5A",
    //     appNFT: "0x492F3b79E18658f1a72c75C8a17760a006efCa60",
    //     SubscriptionBalanceCalculator:
    //         "0x00Df2C3F6A40B4d657ED68b4689a7ddcA9434e59",
    //     SubscriptionBalance: "0xA8ef2C4E1d0091bAb84c74cC40b7306955DfD290",
    //     SubnetDAODistributor: "0xF0DeD7b2b4Ac842aA245644e89298F43ac3c8b3e",
    //     Subscription: "0xfF29cFD3C9954a485d7C6D128a9f87CEB2C2b366",
    //     NFT: "0xbC0fe507d07914EF7039d22Ea5FAbe6947B3D711",
    //     RoleControl: "0x660c66A35e4B87454a89b307251bA5074b519892",
    //     ContractBasedDeployment: "0xB73c47b77C422682219E8D9bC9217C009395cde7",
    // })

    helper.setAddresses(
        {
            deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',    
            xct: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
            stack: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',       
            nftToken: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',    
            Registration: '0x9A676e781A523b5d0C0e43731313A708CB607508',
            appNFT: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
            RoleControl: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
            SubscriptionBalanceCalculator: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
            SubscriptionBalance: '0x59b670e9fA9D0A427751Af201D676719a970857b',
            SubnetDAODistributor: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
            Subscription: '0x4A679253410272dd5232B3Ff7cF5dbB88f295319',
            ContractBasedDeployment: '0x09635F643e140090A9A8Dcd712eD6285858ceBef'
          }
        // {
        //     deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        //     xct: '0xC20654dB7F9483f10c91dc94924dC8F04F79bfd5',
        //     stack: '0xB10982193B39Eda3428d6AaeBbd7986f2A2Baa1a',
        //     xctMinter: '0x0eb44B96bC23A6362d383eF04bE67501251cF227'
        //   }
    )

    // helper.setAddresses({
    //         deployer: "0x3C904a5f23f868f309a6DB2a428529F33848f517",
    //         xct: "0xca89AD662eA7A2688d29e2Df6291123eBFB807E4",
    //         stack: "0xF1E0336C04f03c39904015b581A5db091B6D9960",
    //         nftToken: "0x36cb2DE24CC92BCae864759D9aC4ddcc43a112B0",
    //         Registration: "0x027d84b57eA012BddfDcc2b297EaeB2967912c5A",
    //         appNFT: "0x492F3b79E18658f1a72c75C8a17760a006efCa60",
    //         SubscriptionBalanceCalculator: "0x00Df2C3F6A40B4d657ED68b4689a7ddcA9434e59",
    //         SubscriptionBalance: "0xA8ef2C4E1d0091bAb84c74cC40b7306955DfD290",
    //         SubnetDAODistributor: "0xF0DeD7b2b4Ac842aA245644e89298F43ac3c8b3e",
    //         Subscription: "0xfF29cFD3C9954a485d7C6D128a9f87CEB2C2b366",
    //         NFT: "0xbC0fe507d07914EF7039d22Ea5FAbe6947B3D711",
    //         RoleControl: "0x660c66A35e4B87454a89b307251bA5074b519892",
    //         ContractBasedDeployment: "0xFB86Bcaf08f84E5c5F856bF623C04aB233839298"
    //     })
    // const now = new Date()
    // console.log(now.getTime())
    await helper.deployContracts()
    await helper.callStackApprove()
    await helper.callNftApprove()
    await helper.xctApproveSub()
    await helper.xctApproveSubBal()
    await setupUrsula();

    // await helper.setupXCTMinter();
    // await helper.testXCT();

    // 200000000000000000 1990031876438381866
    // await deployXCT();
    // await deployStack();
    // await deployDarkNFT();
    // await mintDarkNFT(); // call 8 times
    // await mintAppNFT(); // call 8 times
    // await deployReg();
    // await helper.callStackApprove();
    // await helper.callNftApprove();
    // await createSubnet(1) // call 6 times, change the param to index
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
    // await helper.xctApproveSub();
    // await helper.xctApproveSubBal();
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
    // await helper.deployRoleControl();
    // await helper.deployContractBasedDeployment();
    // await getIPFS();
    // await setup();
    // uint256 _nftId,
    // uint256 _subnetId,
    // string memory _serviceProviderAddress,
    // address _referralAddress,
    // uint256 _licenseFee,
    // uint256[] memory _computeRequired
    // const xct = await getXCT();
    // await xct.approve(
    //     helper.getAddresses().Subscription,
    //     ethers.utils.parseEther("1000000000")
    // );
    // const subscription = await helper.getSubscription();
    // await subscription.subscribeNew(
    //     ethers.utils.parseEther("10000"),
    //     0,
    //     "ddf",
    //     "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
    //     10000,
    //     [1, 1, 0, 0]
    // );
    // await helper.grantRoleForContractBasedDeployment(1, addresses.deployer)

    // const subscription = await helper.getSubscription();
    // await subscription.subscribeNew(
    //     ethers.utils.parseEther("10000"),
    //     0,
    //     "ddf",
    //     "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
    //     10000,
    //     [1, 2, 0, 0]
    // );
    // await helper.grantRoleForContractBasedDeployment(2, addresses.deployer);

    // uint256 _nftId,
    // string memory appName,
    // bytes32 _digest,
    // uint8 _hashFunction,
    // uint8 _size,
    // uint256[][] memory _subnetIDList,
    // uint256[] memory _resourceArray,
// string memory lastUpdatedTime

    // const contractDeploy = await getContractBasedDeployment()
    // tr = await contractDeploy.updateData(
    //     1,
    //     "azEwMjM=",
    //     "0xa83a5be4756de47fb0f31eed7b02c10360a73f715b8338e713aa4d5de811422e",
    //     18,
    //     32,
    //     [[1,1,0]],
    //     [2, 2],
    //     now.getTime()+""
    // )
    // rec = await tr.wait()
    // const events = rec.events.map(event=>({name: event.event , args: event.args}));
    // console.log(events);
    // const start = performance.now();
    // const data = await contractDeploy.getDataArray(1)
    // const data = await contractDeploy.getFullData(1, "azEwMjM=")
    // console.log(data)
    // const end = performance.now();
    // console.log("time taken: ", end-start);

    // nftID:    1,
    // appName:    "app2",
    // digest:    "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
    // hashFunc:    18,
    // size:    32,
    // subnetIDList:    [[1,1,0]],
    // resourceArray:    [1, 2, 0],
    // lastUpdatedTime:    now.getTime()+""
    // // )
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

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
}
