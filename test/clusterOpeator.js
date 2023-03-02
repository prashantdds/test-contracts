const { ethers } = require("hardhat")
const { expect } = require("chai")
const helper = require("../scripts/helper.js")
const { time } = require("@nomicfoundation/hardhat-network-helpers")

let Registration,
    Subscription,
    SubscriptionBalance,
    SubscriptionBalanceCalculator,
    SubnetDAODistributor,
    xct,
    stack,
    darkMatterNFT,
    appNFT,
    ContractBasedDeployment,
    addrList,
    appNFTID,
    subnetID

const createSubnet = async (creator, attributeParam) => {
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
    }

    attributes = { ...attributes, ...attributeParam }
    await darkMatterNFT
        .connect(creator)
        .setApprovalForAll(Registration.address, true)
    const nftTr = await darkMatterNFT.mint(creator.address)
    const nftRec = await nftTr.wait()
    const transferEvent = nftRec.events.find(
        (event) => event.event == "Transfer"
    )
    const nftID = transferEvent?.args[2].toNumber()

    // const curBalance = await stack.balanceOf(creator.address)
    // if (curBalance.lt(attributes.stackFeesReqd)) {
    await stack.transfer(creator.address, attributes.stackFeesReqd)
    // }

    await stack
        .connect(creator)
        .approve(Registration.address, ethers.utils.parseEther("1000000000"))

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
        attributes.supportFeeRate,
        attributes.stackFeesReqd
    )

    const tr = await op.wait()
    const subnetCreatedEvent = tr.events.find(
        (event) => event.event == "SubnetCreated"
    )
    const subnetId = subnetCreatedEvent.args[0].toNumber()
    return subnetId
}

const checkForEnoughBalance = async (nftId) => {
    const balanceDuration =
        Number(await SubscriptionBalance.totalPrevBalance(nftId)) /
        Number(await SubscriptionBalanceCalculator.dripRatePerSec(nftId))
    let balanceEndTime =
        Number(
            (await SubscriptionBalance.nftBalances(nftId)).lastBalanceUpdateTime
        ) + balanceDuration
    // console.log("balanceDuration : ", balanceDuration)
    // console.log(
    //     "balanceEnd : ",
    //     (await SubscriptionBalance.nftBalances(nftId)).lastBalanceUpdateTime,
    //     Number(
    //         (await SubscriptionBalance.nftBalances(nftId)).lastBalanceUpdateTime
    //     )
    // )
    balanceEndTime = new Date(balanceEndTime * 1000)
    const latestTime = await time.latest()
    const blockTime = new Date(latestTime * 1000)
    const currentTime = new Date()

    // console.log(
    //     "currentTime : ",
    //     currentTime.toLocaleTimeString(),
    //     " BlockTime : ",
    //     blockTime.toLocaleTimeString(),
    //     " EndTime : ",
    //     balanceEndTime.toLocaleTimeString()
    // )
    const dif = balanceEndTime.getTime() - blockTime.getTime()
    // await time.increase()
    const secondsLeft = dif / 1000
    const minTimeFund = Number(await Subscription.MIN_TIME_FUNDS())

    // console.log("secondsLeft : ", secondsLeft)
    let deleteApp = false
    if (secondsLeft <= 0) {
        deleteApp = true
    }

    if (secondsLeft > minTimeFund)
        return { isBalance: true, secondsLeft, deleteApp }

    return { isBalance: false, secondsLeft, deleteApp }
}

async function initContracts() {
    // const addresses = {
    //     deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    //     xct: "0xe0b5452DDB57d5bDd9F49470BAc24BAD879C68E0",
    //     stack: "0xa55e9d5F4321D7f2EA862DF776a02aF6FAfcf4F9",
    //     nftToken: "0xaF15B6Db0b6220391007701228883BA2f04D04F9",
    //     Registration: "0x8DcC7438Ccc3006165783e0fD1C6261CaFC0AA69",
    //     appNFT: "0x0018b7506e118c97E54d4FFebcef808ca785bA01",
    //     SubscriptionBalanceCalculator:
    //         "0xc47EF4D1d3C2e18c02B2163A8dAB2F5B5099C3Ff",
    //     SubscriptionBalance: "0x6852Adb5Fce1D73c08A9b3Aa7edE9A03437ac2fE",
    //     SubnetDAODistributor: "0x63766F0efAa46a86E9055bB46e41ff7bc64CBEA2",
    //     Subscription: "0x24ef01de6baE76eE73Da210940A296F739d87952",
    //     xctMinter: "0x7F6f314D460C7751bF1F9784D34Bba2C2AE82CeB",
    //     ContractBasedDeployment: "0x80bfecFce361Ed9E00b0E9Bc023E0EACa6917De5",
    // }
    // helper.setAddresses(addresses)

    helper.setNoPrint(true)
    await helper.deployContracts()
    const _Registration = await helper.getRegistration()
    const _Subscription = await helper.getSubscription()
    const _SubscriptionBalance = await helper.getSubscriptionBalance()
    const _SubscriptionBalanceCalculator =
        await helper.getSubscriptionBalanceCalculator()
    const _SubnetDAODistributor = await helper.getSubnetDAODistributor()
    const _xct = await helper.getXCT()
    const _stack = await helper.getStack()
    const _darkMatterNFT = await helper.getNFTToken()
    const _appNFT = await helper.getAppNFT()
    const _ContractBasedDeployment = await helper.getContractBasedDeployment()
    const _addrList = await ethers.getSigners()

    Registration = _Registration
    Subscription = _Subscription
    SubscriptionBalance = _SubscriptionBalance
    SubscriptionBalanceCalculator = _SubscriptionBalanceCalculator
    SubnetDAODistributor = _SubnetDAODistributor
    xct = _xct
    stack = _stack
    darkMatterNFT = _darkMatterNFT
    appNFT = _appNFT
    ContractBasedDeployment = _ContractBasedDeployment
    addrList = _addrList

    const platformAddress = addrList[5]
    const referralExpiry = 60 * 60 * 24 * 4

    const platformFee = 10000
    const discountFee = 3000
    const referralFee = 4000

    await helper.callStackApprove()
    await helper.callNftApprove()
    await helper.xctApproveSub()
    await helper.xctApproveSubBal()

    await Subscription.addPlatformAddress(
        platformAddress.address,
        platformFee,
        discountFee,
        referralFee,
        referralExpiry
    )

    // console.log(
    //     "addreses : ",
    //     Registration.address,
    //     Subscription.address,
    //     SubscriptionBalance.address,
    //     SubscriptionBalanceCalculator.address,
    //     xct.address,
    //     stack.address,
    //     darkMatterNFT.address,
    //     appNFT.address,
    //     ContractBasedDeployment.address
    // )

    return {
        Registration,
        Subscription,
        SubscriptionBalance,
        SubscriptionBalanceCalculator,
        xct,
        stack,
        darkMatterNFT,
        appNFT,
        ContractBasedDeployment,
        addrList,
    }
}

async function mintXCT(address, amount) {
    await xct.mint(address, amount)
}

describe("ClusterOperator test cases", async function () {
    before(async function () {
        // initializing contracts
        await initContracts()

        // mint NFT
        const nftTr = await appNFT.mint(addrList[0].address)
        const nftRec = await nftTr.wait()
        // console.log("nftRec : ", nftRec)
        const transferEvent = nftRec.events.find(
            (event) => event.event == "Transfer"
        )
        appNFTID = transferEvent?.args[2].toNumber()

        // creating subnet
        subnetID = await createSubnet(addrList[0])
    })

    it("with 0 balance, seconds left should be 0. apps should be deleted as balance is 0", async function () {
        const appName = "explorer1"
        // console.log(
        //     "subnet  : ",
        //     subnetID,
        //     "appNFT : ",
        //     appNFTID,
        //     "appName : ",
        //     appName
        // )
        const tx = await ContractBasedDeployment.createApp(
            0,
            appNFTID,
            [
                "0x0000000000000000000000000000000000000000",
                "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
            ],
            ["100", "100"],
            appName,
            "0x10e7305fcdeb6efaaecc837b39d483e93e97d1af7102ad27fb0f0b965bff0a6f",
            [18, 32],
            [subnetID],
            [[[1, 1, 1, 1, 1]]],
            [1, 0, 0, 1, 0],
            1676095289671,
            [false, false]
        )
        await tx.wait()

        let deleteFlag = false
        const { secondsLeft, isBalance } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true
        expect(secondsLeft).to.equal(0)
        expect(isBalance).to.equal(false)
        expect(deleteFlag).to.equal(true)
    })

    it("Creating app with some balance,apps should not deleted", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )

        // minting xct for passing balanceToAdd
        await mintXCT(
            addrList[0].address,
            ethers.utils.parseEther("1000000000")
        )
        console.log(
            " balance : ",
            Number(await xct.balanceOf(addrList[0].address))
        )
        const appName = "explorer2"
        // console.log(
        //     "subnet  : ",
        //     subnetID,
        //     "appNFT : ",
        //     appNFTID,
        //     "appName : ",
        //     appName
        // )
        const tx = await ContractBasedDeployment.createApp(
            ethers.utils.parseEther("4"),
            appNFTID,
            [
                "0x0000000000000000000000000000000000000000",
                "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
            ],
            ["100", "100"],
            appName,
            "0x10e7305fcdeb6efaaecc837b39d483e93e97d1af7102ad27fb0f0b965bff0a6f",
            [18, 32],
            [subnetID],
            [[[1, 1, 1, 1, 1]]],
            [1, 0, 0, 1, 0],
            1676095289671,
            [false, false]
        )
        await tx.wait()
        const deleteFlag = false
        let { secondsLeft } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true
        // const cronString = await secondsLeftToCronString(secondsLeft)
        // await startCronJob(appNFTID, cronString, true, deleteNFTApps)
        // console.log("creasing to : ", secondsLeft - 1)
        // const timeRN = await time.latest()
        // console.log(
        //     "-> ",
        //     new Date((await time.latest()) * 1000).toLocaleTimeString()
        // )

        // await time.increaseTo(timeRN + Math.round(secondsLeft - 1))
        // console.log(
        //     "-> ",
        //     new Date((await time.latest()) * 1000).toLocaleTimeString()
        // )
        // const justWait = new Promise((resolve, reject) => {
        //     setTimeout(() => {
        //         console.log("5000 ms wait over")
        //         resolve()
        //     }, 5000)
        // })
        // await justWait
        // const { secondsLeft: k } = await checkForEnoughBalance(appNFTID)
        // console.log("now : ", k)

        console.log(
            "creating app with some balance -> ",
            prevSecondsLeft,
            secondsLeft
        )

        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
        expect(deleteFlag).to.equal(false)
    })

    it("updating app with some balance,apps should not deleted", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const appName = "explorer2"
        // console.log(
        //     "subnet  : ",
        //     subnetID,
        //     "appNFT : ",
        //     appNFTID,
        //     "appName : ",
        //     appName
        // )
        const tx = await ContractBasedDeployment.updateApp(
            ethers.utils.parseEther("4"),
            appNFTID,
            appName,
            "0x10e7305fcdeb6efaaecc837b39d483e93e97d1af7102ad27fb0f0b965bff0a6f",
            [18, 32],
            [subnetID],
            [[[1, 1, 1, 1, 1]]],
            [1, 0, 0, 1, 0],
            1676095289671,
            false
        )
        await tx.wait()

        const deleteFlag = false
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true

        console.log(
            "updating app with some balance -> ",
            prevSecondsLeft,
            secondsLeft
        )
        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
        expect(deleteFlag).to.equal(false)
    })

    it("Deleting App", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const appName = "explorer2"

        const tx = await ContractBasedDeployment.deleteApp(appNFTID, appName)
        await tx.wait()

        const deleteFlag = false
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true

        console.log("deleting app ->", prevSecondsLeft, secondsLeft)
        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
        expect(deleteFlag).to.equal(false)
    })

    it("Withdrawing Balance From NFT,Balance End time should be reduce", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const tx = await SubscriptionBalance.withdrawBalance(
            addrList[0].address,
            appNFTID,
            ethers.utils.parseEther("1")
        )
        await tx.wait()

        const deleteFlag = false
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true

        console.log(
            "after Withdrawing Balance From NFT -> ",
            prevSecondsLeft,
            secondsLeft
        )
        expect(secondsLeft).to.be.lessThan(prevSecondsLeft)
    })

    it("Adding Balance From NFT,Balance End time should increase", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const tx = await SubscriptionBalance.addBalance(
            addrList[0].address,
            appNFTID,
            ethers.utils.parseEther("1")
        )
        await tx.wait()

        const deleteFlag = false
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true

        console.log(
            "after Adding Balance From NFT : ->",
            prevSecondsLeft,
            secondsLeft
        )

        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
    })

    it("increasing Global Dao rate, balance End Time should be reduced ", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const newDaoRate = 7000
        const tx = await Registration.change_DAORate(newDaoRate)
        await tx.wait()

        const deleteFlag = false
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        if (secondsLeft <= 0) deleteFlag = true

        console.log(
            "after changing Global Dao rate -> ",
            prevSecondsLeft,
            secondsLeft
        )

        expect(secondsLeft).to.be.lessThan(prevSecondsLeft)
    })
})
