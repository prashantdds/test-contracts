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
    subnetID,
    startCronFlag,
    stopCronFlag,
    deleteAppsFlag,
    startTime

const defaulParameters = {
    licensePercent: "100",
    licenseFee: "100",
    supportPercent: 10000,
    supportFee: 1,
    referralPercent: 4000,
    platformPercent: 10000,
    discountPercent: 0,
    computes: [1, 0, 0, 1, 0],
}

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

    await stack.transfer(creator.address, attributes.stackFeesReqd)

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

    balanceEndTime = new Date(balanceEndTime * 1000)
    const latestTime = await time.latest()
    const blockTime = new Date(latestTime * 1000)
    const currentTime = new Date()

    const dif = balanceEndTime.getTime() - blockTime.getTime()

    const secondsLeft = dif / 1000
    const minTimeFund = Number(await Subscription.MIN_TIME_FUNDS())

    if (secondsLeft > minTimeFund) return { isBalance: true, secondsLeft }

    return { isBalance: false, secondsLeft }
}

const cronDecisions = async (secondsLeft) => {
    secondsLeft = Math.round(secondsLeft)
    const currentTime = Math.round(await time.latest())
    let nextCycleTime = Math.round(startTime + 3600)

    while (nextCycleTime < currentTime) {
        nextCycleTime = nextCycleTime + 3600
    }

    const diff = nextCycleTime - currentTime
    console.log(
        "--> startTIme : ",
        new Date(startTime * 1000).toLocaleTimeString(),
        " currentTime : ",
        new Date(currentTime * 1000).toLocaleTimeString(),
        " nextCycleTIme : ",
        new Date(nextCycleTime * 1000).toLocaleTimeString(),
        " BalanceEndAt : ",
        new Date((currentTime + secondsLeft) * 1000).toLocaleTimeString(),
        "\n--> secondsLeftInBalance : ",
        secondsLeft,
        " secondsleftInNextCycle : ",
        diff
    )

    deleteAppsFlag = false
    stopCronFlag = false
    startCronFlag = false

    if (secondsLeft <= 0) {
        deleteAppsFlag = true
        console.log("Deleting Apps of NFTs")
    } else if (diff >= secondsLeft) {
        startCronFlag = true
        console.log("Starting Cron")
    } else if (diff < secondsLeft) {
        stopCronFlag = true
        console.log("Stopping Cron")
    }
    return { deleteAppsFlag, startCronFlag, stopCronFlag }
}

const getDripRateForSeconds = async (seconds) => {
    const dripRate =
        await SubscriptionBalanceCalculator.estimateDripRatePerSecOfSubnet(
            subnetID,
            [
                defaulParameters.licensePercent,
                defaulParameters.licenseFee,
                defaulParameters.supportPercent,
                defaulParameters.supportFee,
                defaulParameters.referralPercent,
                defaulParameters.platformPercent,
                defaulParameters.discountPercent,
            ],
            defaulParameters.computes
        )

    const balance = Number(dripRate * seconds)

    return balance.toString()
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

    await helper.callStackApprove()
    await helper.callNftApprove()
    await helper.xctApproveSub()
    await helper.xctApproveSubBal()

    await Subscription.addPlatformAddress(
        platformAddress.address,
        defaulParameters.platformPercent,
        defaulParameters.discountPercent,
        defaulParameters.referralPercent,
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
        startTime = Math.round(await time.latest())
        await initContracts()

        // mint NFT
        const nftTr = await appNFT.mint(addrList[0].address)
        const nftRec = await nftTr.wait()

        const transferEvent = nftRec.events.find(
            (event) => event.event == "Transfer"
        )
        appNFTID = transferEvent?.args[2].toNumber()

        // creating subnet
        subnetID = await createSubnet(addrList[0])

        // minting xct for passing balanceToAdd
        await mintXCT(
            addrList[0].address,
            ethers.utils.parseEther("1000000000")
        )
    })

    it("with 0 balance, seconds left should be 0. apps should be deleted as balance is 0", async function () {
        const appName = "explorer1"
        const tx = await ContractBasedDeployment.createApp(
            0,
            appNFTID,
            [
                "0x0000000000000000000000000000000000000000",
                "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
            ],
            [defaulParameters.licensePercent, defaulParameters.licenseFee],
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

        const { secondsLeft, isBalance } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

        expect(secondsLeft).to.equal(0)
        expect(isBalance).to.equal(false)
        expect(deleteAppsFlag).to.equal(true)
    })

    it("Creating app with some balance,apps should not deleted", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const appName = "explorer2"

        const balanceToAdd = await getDripRateForSeconds(1200)

        const tx = await ContractBasedDeployment.createApp(
            balanceToAdd,
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
        let { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

        console.log(
            "creating app with some balance -> ",
            prevSecondsLeft,
            secondsLeft
        )

        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
        expect(deleteAppsFlag).to.equal(false)
    })

    it("updating app with some balance,apps should not deleted", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const appName = "explorer2"
        // fetching balance to add for one hour
        const balanceToAdd = await getDripRateForSeconds(600)

        const tx = await SubscriptionBalance.addBalance(
            addrList[0].address,
            appNFTID,
            balanceToAdd
        )

        await tx.wait()

        // const tx = await ContractBasedDeployment.updateApp(
        //     balanceToAdd,
        //     appNFTID,
        //     appName,
        //     "0x10e7305fcdeb6efaaecc837b39d483e93e97d1af7102ad27fb0f0b965bff0a6f",
        //     [18, 32],
        //     [subnetID],
        //     [[[1, 1, 1, 1, 1]]],
        //     [1, 0, 0, 1, 0],
        //     1676095289671,
        //     false
        // )
        // await tx.wait()

        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

        console.log(
            "updating app with some balance -> ",
            prevSecondsLeft,
            secondsLeft
        )
        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
        expect(deleteAppsFlag).to.equal(false)
    })

    it("Deleting App", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const appName = "explorer2"

        const tx = await ContractBasedDeployment.deleteApp(appNFTID, appName)
        await tx.wait()

        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

        console.log("deleting app ->", prevSecondsLeft, secondsLeft)
        expect(secondsLeft).to.be.greaterThan(prevSecondsLeft)
        expect(deleteAppsFlag).to.equal(false)
    })

    it("Withdrawing Balance From NFT,Balance End time should be reduce", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )

        const balance = await getDripRateForSeconds(prevSecondsLeft - 300)
        const tx = await SubscriptionBalance.withdrawBalance(
            addrList[0].address,
            appNFTID,
            balance
        )
        await tx.wait()

        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

        console.log(
            "after Withdrawing Balance From NFT -> ",
            prevSecondsLeft,
            secondsLeft
        )
        expect(secondsLeft).to.be.lessThan(prevSecondsLeft)
    })

    it("Adding Balance to NFT,Balance End time should increase", async function () {
        let { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )

        const balanceToAdd = await getDripRateForSeconds(600)

        const tx = await SubscriptionBalance.addBalance(
            addrList[0].address,
            appNFTID,
            balanceToAdd
        )
        await tx.wait()

        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

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

        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)

        console.log(
            "after changing Global Dao rate -> ",
            prevSecondsLeft,
            secondsLeft
        )

        expect(secondsLeft).to.be.lessThan(prevSecondsLeft)
    })

    it("Should start a cron after we deduct amount", async function () {
        const { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )

        if (prevSecondsLeft > 1800) {
            const myBalance = Number(
                await SubscriptionBalance.totalPrevBalance(appNFTID)
            )
            const balanceToAdd = Number(await getDripRateForSeconds(1800))

            const bal = BigInt(Math.abs(myBalance - balanceToAdd))

            const tx = await SubscriptionBalance.withdrawBalance(
                addrList[0].address,
                appNFTID,
                bal
            )
            await tx.wait()
        }
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)
        expect(startCronFlag).to.equal(true)
    })
    it("Should stop a cron again after we adding amount", async function () {
        const { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const myBalance = Number(
            await SubscriptionBalance.totalPrevBalance(appNFTID)
        )

        const balanceToAdd = Number(await getDripRateForSeconds(4000))

        if (prevSecondsLeft < 3600) {
            const bal = BigInt(Math.abs(myBalance - balanceToAdd))
            const tx = await SubscriptionBalance.addBalance(
                addrList[0].address,
                appNFTID,
                bal
            )
            await tx.wait()
        }
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)
        expect(stopCronFlag).to.equal(true)
    })
    it("after we jump into next cycle it should start a cron ", async function () {
        const { secondsLeft: prevSecondsLeft } = await checkForEnoughBalance(
            appNFTID
        )
        const currentTime = await time.latest()

        await time.increaseTo(currentTime + Math.round(prevSecondsLeft) - 120)
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)
        expect(startCronFlag).to.equal(true)
    })
    it("again cron should be stopped as we're adding balance ", async function () {
        const balanceToAdd = await getDripRateForSeconds(4000)

        const tx = await SubscriptionBalance.addBalance(
            addrList[0].address,
            appNFTID,
            balanceToAdd
        )
        await tx.wait()
        const { secondsLeft } = await checkForEnoughBalance(appNFTID)
        const { deleteAppsFlag, startCronFlag, stopCronFlag } =
            await cronDecisions(secondsLeft)
        expect(stopCronFlag).to.equal(true)
    })
})
