const { expect } = require("chai")
const helper = require("../scripts/helper.js")

describe("Subscription contract", async function () {
    // For testing specifically this file uncomment below code and use "npx hardhat test test/subscription.js" command
    before(async () => {
        await helper.deployContracts()
        await helper.callStackApprove()
        await helper.callNftApprove()
        await helper.xctApproveSub()
        await helper.xctApproveSubBal()
    })

    let owner, addr1
    it("Creating a Subnet", async function () {
        ;[owner, addr1] = await ethers.getSigners()
        const Registration = await helper.getRegistration()
        await Registration.createSubnet(
            1,
            owner.address,
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
            [owner.address],
            5000,
            ethers.utils.parseEther("0.01")
        )
        const subAttr = await Registration.getSubnetAttributes(0)
        expect(subAttr[3]).to.be.true
    })

    it("Creating Cluster inside first Subnet", async function () {
        const nftToken = await helper.getNFTToken()
        await nftToken.mint(owner.address)

        const Registration = await helper.getRegistration()
        const op = await Registration.clusterSignUp(
            0,
            "sovereignsubnetcannothaveempty",
            owner.address,
            2 // NFT that we just minted , that'll be locked at cluster signup
        )
        await op.wait()

        const NumbersOfclustersInsideSubnet = Number(
            await Registration.totalClustersSigned(0)
        )
        expect(NumbersOfclustersInsideSubnet).to.equal(1)
    })

    // it("Fetching all subnets Inside of NFT", async function () {
    // //  can use only after Subscribing
    //     let OwnerOf = []
    //     const AppNFT = await helper.getAppNFT()
    //     const Registration = await helper.getRegistration()

    //     const totalSubnets = Number(await Registration.totalSubnets())
    //     const totalAppNFTsMintedAtSubnetCreation = Number(
    //         await AppNFT.totalSupply()
    //     )
    //     expect(totalAppNFTsMintedAtSubnetCreation).to.equal(totalSubnets)
    //     for (let i = 1; i <= totalSubnets; i++) {
    //         try {
    //             const data = await AppNFT.ownerOf(i)
    //             if (data) {
    //                 OwnerOf.push({ nftId: i, wallet: data })
    //             }
    //         } catch (err) {
    //             console.log("err : ", err.message)
    //         }
    //     }
    //     expect(OwnerOf.length).to.equal(totalSubnets)
    // })

    it("a) AppNFT should be minted at the time of joining subnet", async function () {
        const nftToken = await helper.getNFTToken()
        await nftToken.mint(owner.address) // await nftToken.mint(addr1.address)
        const Subscription = await helper.getSubscription()

        // can call from addr1
        const op = await Subscription.subscribeNew(
            ethers.utils.parseEther("10000"),
            0,
            "ddf",
            "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
            10000,
            [1, 1, 1, 1]
        )
        await op.wait()
        const appNFT = await helper.getAppNFT()
        const lastNFTId = Number(await appNFT.totalSupply())
        const OwnerOfLastNFT = await appNFT.ownerOf(lastNFTId)
        expect(OwnerOfLastNFT).to.equal(owner.address)
    })

    it("a) Only defined Role can deploy Apps", async function () {
        const appNFT = await helper.getAppNFT()
        let lastNFTId = Number(await appNFT.totalSupply())
        const ContractBasedDeployment =
            await helper.getContractBasedDeployment()

        await expect(
            ContractBasedDeployment.connect(addr1).createData(
                lastNFTId,
                "a2",
                "0xf61957f163f248caa72485b5edf6c0114872a64a074bfc2019c3b45581020dcc",
                18,
                32,
                [1, 2, 3]
            )
        ).to.be.revertedWith(
            "CONTRACT_BASED_DEPLOYER permission not there in RoleControlV2"
        )
    })
    it("a) Only Subnet Subscriber can deploy Apps", async function () {
        const appNFT = await helper.getAppNFT()
        let lastNFTId = Number(await appNFT.totalSupply())
        const ContractBasedDeployment =
            await helper.getContractBasedDeployment()

        await helper.grantRoleForContractBasedDeployment(
            lastNFTId,
            addr1.address
        )
        await expect(
            ContractBasedDeployment.connect(addr1).createData(
                lastNFTId,
                "a2",
                "0xf61957f163f248caa72485b5edf6c0114872a64a074bfc2019c3b45581020dcc",
                18,
                32,
                [1, 2, 3]
            )
        ).to.be.reverted
    })

    // it("a) XCT should be locked based on subnet price", async function () {

    // })

    it("Deployer can change cooldown and Notice time for service provider", async function () {
        const Subscription = await helper.getSubscription()
        await Subscription.change__REQD_COOLDOWN_S_PROVIDER(3)
        await Subscription.change__REQD_NOTICE_TIME_S_PROVIDER(4)
        expect(await Subscription.REQD_COOLDOWN_S_PROVIDER()).to.equal(3)
        expect(await Subscription.REQD_NOTICE_TIME_S_PROVIDER()).to.equal(4)
    })

    it("c) Deployer only can change service provider after cooldown time", async function () {
        const Subscription = await helper.getSubscription()
        const tx = await Subscription.requestServiceProviderChange(1, 0, "ffd")
        await tx.wait()

        await expect(
            Subscription.applyServiceProviderChange(1, 0)
        ).to.be.revertedWith("Cannot apply before cooldown")

        await new Promise((resolve) => setTimeout(resolve, 3000))
        const tx1 = await Subscription.applyServiceProviderChange(1, 0)
        const ev1 = await tx1.wait()
        expect(ev1).to.not.be.empty
    })
    it("Deployer can request to change service provider after of notice", async function () {
        const Subscription = await helper.getSubscription()
        await expect(
            Subscription.requestServiceProviderChange(1, 0, "f1fd")
        ).to.be.revertedWith(
            "Cannot request before REQD_NOTICE_TIME_S_PROVIDER passed"
        )

        await new Promise((resolve) => setTimeout(resolve, 4000))
        const tx = await Subscription.requestServiceProviderChange(1, 0, "f1fd")
        const ev = await tx.wait()
        expect(ev).to.not.be.empty
    })

    // it("d) Subnet must check for max limit", async function () {})
    // it("f) Subscribe more than one cluster at same time", async function () {})
})
