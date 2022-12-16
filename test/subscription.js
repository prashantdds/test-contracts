const { expect } = require("chai")
const helper = require("../scripts/helper.js")

// For testing specifically this file uncomment below code and use "npx hardhat test test/subscription.js" command
before(async () => {
    await helper.deployContracts()
    await helper.callStackApprove()
    await helper.callNftApprove()
    await helper.xctApproveSub()
    await helper.xctApproveSubBal()
})

describe("Subscription contract", async function () {
    let owner, addr1
    it("Creating a Subnet and cluster inside subnet", async function () {
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

    // it("Subscribing to existing subnet with second account", async function () {
    //     // can use only after XCTminter cause user have to buy some XCTs
    //     const nftToken = await helper.getNFTToken()
    //     await nftToken.mint(addr1.address)

    //     const Subscription = await helper.getSubscription()

    //     const op = await Subscription.connect(addr1).subscribeNew(
    //         ethers.utils.parseEther("10000"),
    //         0,
    //         "ddf",
    //         "0x9735C1b49Ce22752fC67F83DF79FC6bbe290Da17",
    //         10000,
    //         [1, 1, 1, 1]
    //     )
    //     console.log(op)
    // })
})
