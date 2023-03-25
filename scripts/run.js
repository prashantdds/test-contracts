const { deploy } = require("@openzeppelin/hardhat-upgrades/dist/utils")
const { ethers } = require("hardhat")
const helper = require("./helper")

const getAmountIfLess = async (
    erc20,
    account,
    balanceToAdd,
    contractToApprove
) => {
    // add amount to depositor if depositor's balance is less
    let currentBalance = await erc20.balanceOf(account.address)
    if (currentBalance.lt(balanceToAdd)) {
        await erc20.transfer(account.address, balanceToAdd)
    }
    //approve subscription balance to withdraw erc20 out of depositor's wallet
    await erc20
        .connect(account)
        .approve(contractToApprove.address, balanceToAdd)
}

const getNFTID = async (erc721, transactionHash) => {
    const transferFilter = erc721.filters.Transfer()
    const transferLogList = await erc721.queryFilter(
        transferFilter,
        -10,
        "latest"
    )
    const transferLog = transferLogList.find(
        (log) => log.transactionHash == transactionHash
    )
    const nftID = transferLog.args[2].toNumber()
    return nftID
}

const mintNFT = async (erc721, addrObj, contract) => {
    tr = await erc721.mint(addrObj.address)
    rec = await tr.wait()

    await erc721.connect(addrObj).setApprovalForAll(contract.address, true)

    return getNFTID(erc721, rec.transactionHash)
}

const createSubnet = async (
    darkMatter,
    stack,
    Registration,
    creator,
    attributeParam
) => {
    let attributes = {
        subnetLocalDAO: creator.address,
        subnetType: 1,
        sovereignStatus: true,
        cloudProviderType: 1,
        subnetStatusListed: true,
        unitPrices: [
            ethers.utils.parseEther("0.0001"),
            ethers.utils.parseEther("0.0002"),
            ethers.utils.parseEther("0.0003"),
            ethers.utils.parseEther("0.0004"),
        ],
        otherAttributes: [],
        maxClusters: 3,
        whiteListedClusters: [creator.address],
        supportFeeRate: 5000,
        stackFeesReqd: ethers.utils.parseEther("0.01"),
        subnetName: "def-subnet",
    }

    attributes = { ...attributes, ...attributeParam }

    const nftID = await mintNFT(darkMatter, creator, Registration)

    await getAmountIfLess(
        stack,
        creator,
        helper.parameters.registration.reqdStackFeesForSubnet,
        Registration
    )

    console.log("subnetName: ", attributes.subnetName)

    const op = await Registration.connect(creator).createSubnet(
        nftID,
        attributes.subnetLocalDAO,
        attributes.subnetType,
        attributes.sovereignStatus,
        attributes.cloudProviderType,
        attributes.subnetStatusListed,
        attributes.unitPrices,
        attributes.otherAttributes,
        attributes.maxClusters,
        attributes.whiteListedClusters,
        attributes.stackFeesReqd,
        attributes.subnetName
    )

    const tr = await op.wait()
    const subnetCreatedEvent = tr.events.find(
        (event) => event.event == "SubnetCreated"
    )
    const subnetId = subnetCreatedEvent.args[0].toNumber()
    return subnetId
}

const signupCluster = async (
    darkMatterNFT,
    stack,
    Registration,
    subnetID,
    subnetFees,
    clusterAddress,
    attributeParam
) => {
    const bobArray = [
        3, 90, 20, 244, 156, 57, 237, 234, 225, 127, 203, 179, 183, 142, 240, 2,
        76, 127, 172, 131, 75, 113, 184, 97, 91, 117, 208, 166, 152, 28, 244,
        173, 73,
    ]

    let attributes = {
        walletAddress: clusterAddress.address,
        operatorAddress: clusterAddress.address,
        publicKey: bobArray,
        dnsip: "testDNSIP",
        clusterName: "def-cluster",
    }
    attributes = { ...attributes, ...attributeParam }

    const nftID = await mintNFT(darkMatterNFT, clusterAddress, Registration)

    await getAmountIfLess(stack, clusterAddress, subnetFees, Registration)

    tr = await Registration.connect(clusterAddress).clusterSignUp(
        subnetID,
        attributes.dnsip,
        attributes.walletAddress,
        attributes.operatorAddress,
        attributes.publicKey,
        nftID,
        attributes.clusterName
    )
    rec = await tr.wait()

    const clusterSignedUpEvent = rec.events.find(
        (event) => event.event == "ClusterSignedUp"
    )
    const clusterID = clusterSignedUpEvent.args[1].toNumber()
    return clusterID
}

const setupUrsula = async () => {
    const provider = new ethers.providers.JsonRpcProvider(
        "test-contracts-production.up.railway.app"
    )

    const cluster1 = new ethers.Wallet(
        "540f8aa51ab241b53bd0bac13bfb9c3816306c49e57e33c0f5a0fadc20634711",
        provider
    )

    const account0 = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    )
    const account1 = new ethers.Wallet(
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        provider
    )
    const account2 = new ethers.Wallet(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        provider
    )
    const account5 = new ethers.Wallet(
        "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
        provider
    )

    const addrList = [account0, account1, account2, 0, 0, account5, 0, 0]
    const deployer = addrList[0]

    const stack = await helper.getStack()
    const darkMatter = await helper.getNFTToken()
    const Registration = await helper.getRegistration()

    const subnetList = [addrList[1], addrList[2]]
    const clusterList = [[cluster1], [cluster1]]

    const platformAddress = addrList[5]
    const referralExpiry = 60 * 60 * 24 * 4

    const platformFee = 10000
    const discountFee = 3000
    const referralFee = 4000

    const subnetParamList = [
        {
            unitPrices: [
                ethers.utils.parseUnits("100000", "gwei"), // CPU_Standard
                ethers.utils.parseUnits("200000", "gwei"), // CPU_Intensive
                ethers.utils.parseUnits("300000", "gwei"), // GPU_Standard
                ethers.utils.parseUnits("300000", "gwei"), // Storage
                ethers.utils.parseUnits("200000", "gwei"), // Bandwidth
            ],
            maxClusters: 10,
            stackFeesReqd: ethers.utils.parseEther("0.01"),
            subnetName: "marvel",
        },
        {
            unitPrices: [
                ethers.utils.parseUnits("100000", "gwei"), // CPU_Standard
                ethers.utils.parseUnits("200000", "gwei"), // CPU_Intensive
                ethers.utils.parseUnits("300000", "gwei"), // GPU_Standard
                ethers.utils.parseUnits("300000", "gwei"), // Storage
                ethers.utils.parseUnits("200000", "gwei"), // Bandwidth
            ],
            maxClusters: 10,
            stackFeesReqd: ethers.utils.parseEther("0.01"),
            subnetName: "authority",
        },
    ]

    for (var i = 0; i < subnetList.length; i++) {
        const subnetAddrObj = subnetList[i]
        const subnetParam = subnetParamList[i]

        await deployer.sendTransaction({
            to: subnetAddrObj.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        })

        console.log("before creating subnet")
        const subnetID = await createSubnet(
            darkMatter,
            stack,
            Registration,
            subnetAddrObj,
            {
                ...subnetParam,
            }
        )
        console.log("subnetID: ", subnetID)

        for (var j = 0; j < clusterList[i].length; j++) {
            const clusterObj = clusterList[i][j]

            await deployer.sendTransaction({
                to: clusterObj.address,
                value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
            })

            console.log("before signup cluster")
            const clusterID = await signupCluster(
                darkMatter,
                stack,
                Registration,
                subnetID,
                subnetParam.stackFeesReqd,
                clusterObj,
                {
                    clusterName: subnetParam.subnetName + "-c" + j,
                }
            )

            await Registration.connect(subnetAddrObj).approveListingCluster(
                subnetID,
                clusterID,
                100
            )

            console.log("clusterID : ", clusterID)
        }
    }

    await Subscription.addPlatformAddress(
        platformAddress.address,
        platformFee,
        discountFee,
        referralFee,
        referralExpiry
    )
}

async function main() {
    // helper.setAddresses(
    //     {
    //         stack: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    //         xct: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    //         nftToken: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    //         Registration: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    //         appNFT: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    //         SubscriptionBalanceCalculator: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    //         SubscriptionBalance: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    //         SubnetDAODistributor: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
    //         Subscription: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
    //         ContractBasedDeployment: '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f'
    //     }
    // )

    const now = new Date()
    console.log(now.getTime())
    await helper.deployContracts()
    await helper.callStackApprove()
    await helper.callNftApprove()
    await helper.xctApproveSub()
    await helper.xctApproveSubBal()
    await setupUrsula()
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
