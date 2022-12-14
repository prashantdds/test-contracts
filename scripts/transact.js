const { ethers } = require("hardhat")

// sleep time expects milliseconds
function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

    const bal = await deployer.getBalance()
    console.log("bal: " + bal)

    // deploy XCT Token
    ERC20 = await ethers.getContractFactory("TestERC20")
    xct = await ERC20.attach("0xE5e0086611BF24FF2dd2701200798586E14FC69C")

    console.log(`const xct = "${xct.address}"`)

    // deploy NFT Token
    NFT = await ethers.getContractFactory("DarkMatter")
    nftToken = await NFT.attach("0x58bEEf5cCFeE5E3d0B9c8Fe24065a8d948C57ddB")
    console.log(`const nftToken = "${nftToken.address}"`) // 0x527e794667Cb9958E058A824d991a3cf595039C0

    RegistrationContract = await ethers.getContractFactory("Registration")
    Registration = await RegistrationContract.attach(
        "0x2c9E1152585c7662b94a477df70EA5186A9CA8A6"
    )

    console.log(`const Registration = "${Registration.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    appNFT = await NFT.attach("0x5446915Ae32bE736056255c5bc0D0830AB321d91")
    // appNFT = await NFT.deploy();
    console.log(`const appNFT = "${appNFT.address}"`) // 0x527e794667Cb9958E058A824d991a3cf595039C0

    await nftToken.setApprovalForAll(Registration.address, true)

    console.log("Registration create subnet")
    await Registration.createSubnet(
        1,
        deployer.address,
        1,
        true,
        1,
        true,
        [1, 2, 3],
        [],
        3,
        [],
        5
    )

    SubscriptionContract = await ethers.getContractFactory("Subscription")
    // uint256 _LIMIT_NFT_SUBNETS,
    // uint256 _MIN_TIME_FUNDS,
    // IRegistration _RegistrationContract,
    // IERC721 _ApplicationNFT,
    // IERC20Upgradeable _XCTToken,
    // uint256 _REQD_NOTICE_TIME_S_PROVIDER,
    // uint256 _REQD_COOLDOWN_S_PROVIDER
    Subscription = await upgrades.deployProxy(
        SubscriptionContract,
        [
            3,
            300,
            Registration.address,
            appNFT.address,
            xct.address,
            2592000,
            1296000
        ],
        { initializer: "initialize" }
    )
    await Subscription.deployed()

    console.log(`const Subscription = "${Subscription.address}"`) // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9

    console.log("approve xct to subscription contract")
    await xct.approve(Subscription.address, ethers.utils.parseEther("100"))

    const id = await Subscription.subscribeNew(
        ethers.utils.parseEther("1"),
        0,
        "ddf",
        "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7",
        122,
        [1, 1, 1]
    )
    console.log("NFT id:" + id.value)
    sleep(1000)

    nftAttributes = await Subscription.nftAttributes(0)
    console.log("nftAttributes:" + nftAttributes)

    userSubscription = await Subscription.userSubscription(0, 0)
    console.log("userSubscription:" + userSubscription)

    rate = await Subscription.dripRatePerSecOfSubnet(0, 0)
    console.log("rate:" + rate)
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
// gnosis DAO - 0x2e4E45FD302882a10C66fDdc0386Ec4504cC509e
//npx hardhat run --network bscmain scripts/deploy.js --show-stack-traces
//npx hardhat run --network bsctest scripts/deploy.js --show-stack-traces
//  npx hardhat run --network localhost scripts/deploy.js --show-stack-traces
// npx hardhat node
