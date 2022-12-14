const { link } = require("ethereum-waffle")
const { ethers } = require("hardhat")

// sleep time expects milliseconds
function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}

// Tested at:
// const xct = "0xb584D5Cb945b7B88a855b947151fc6903037dDbD"
// const stack = "0x66B76c2cbAc39b997f1069B62DB7Db27751bE59A"
// const XCTMinter = "0xF018BaBb3f9361b3B486E20B70756cBff98bf5Be"

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

    const bal = await deployer.getBalance()
    console.log("bal: " + bal)

    AppNFTContract = await ethers.getContractFactory("TestDarkMatter")
    appNFT = await AppNFTContract.deploy()
    console.log(`const appNFT = "${appNFT.address}"`)

    // await appNFT.mint(deployer.address);

    customNFT = await AppNFTContract.deploy()
    console.log(`const customNFT = "${customNFT.address}"`)

    // await customNFT.mint(deployer.address);

    // deploy LinkNFTs Token
    LinkNFTs = await ethers.getContractFactory("LinkNFTs")
    linknft = await upgrades.deployProxy(LinkNFTs, [appNFT.address], {
        initializer: "initialize"
    })
    await linknft.deployed()

    console.log(`const LinkNFT = "${linknft.address}"`)

    console.log("Approve & Link..")
    await appNFT.setApprovalForAll(linknft.address, true)

    await linknft.linkTo(1, customNFT.address, 1)
    await linknft.linkTo(2, customNFT.address, 1)
    console.log("has Link?")
    console.log("Linked: " + (await linknft.isLinked(1)))

    allLinks = await linknft.links(customNFT.address, 1, 0)
    console.log("Links: " + allLinks)
    console.log("Links: " + (await linknft.getAllLinks(customNFT.address, 1)))
    console.log("Links: " + (await linknft.isLinkedTo(customNFT.address, 1, 1)))

    console.log("chainid: " + (await linknft.getChainId()))
    console.log(
        "Please change the chainid to StackOS chainid in smart contract for deployment to mainnet"
    )
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
//  npx hardhat run --network localhost scripts/deploy.js --show-stack-traces
// npx hardhat node
// npx hardhat run --network maticmain scripts/deployXCT.js --show-stack-traces
