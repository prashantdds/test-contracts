const { ethers } = require("hardhat")
const {
    abi: routerABI,
    bytecode: routerBytecode,
} = require("@uniswap/v2-periphery/build/UniswapV2Router02.json")

const {
    abi: wethABI,
    bytecode: wethBytecode,
} = require("@uniswap/v2-periphery/build/WETH9.json")

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time))
}

// Tested at:
// const xct = "0xb584D5Cb945b7B88a855b947151fc6903037dDbD"
// const stack = "0x66B76c2cbAc39b997f1069B62DB7Db27751bE59A"
// const XCTMinter = "0xF018BaBb3f9361b3B486E20B70756cBff98bf5Be"

// npx hardhat node --fork https://polygon-mainnet.g.alchemy.com/v2/fHz9bJrcvXjT4Gg6st2d_aBvDy8MgOfH

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log("deploy by acct: " + deployer.address)

    const bal = await deployer.getBalance()
    console.log("bal: " + bal)

    const usdcAddressPolygon = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
    const wethAddressPolygon = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
    const admin = deployer.address
    const treasuryAddress = deployer.address
    const slippage = 10000 // 10%
    const percentStackConversion = 10000 // 10%
    const percentStackAdvantage = 5000 // 5%

    // deploy XCT Token
    XCTERC20 = await ethers.getContractFactory("TestXCTERC20")
    xct = await upgrades.deployProxy(XCTERC20, [], {
        initializer: "initialize",
    })
    await xct.deployed()
    // xct = XCTERC20.attach("0x28d4F5B588E6A3077a88C5349722B203E902E372");
    // xct = await upgrades.upgradeProxy("0x28d4F5B588E6A3077a88C5349722B203E902E372", XCTERC20);
    // console.log("XCT upgraded");

    console.log(`const xct = "${xct.address}"`)

    ERC20 = await ethers.getContractFactory("TestERC20")
    stack = await upgrades.deployProxy(ERC20, [], { initializer: "initialize" })
    await stack.deployed()

    const USDC = await ERC20.attach(usdcAddressPolygon)
    // const USDC = await upgrades.deployProxy(ERC20, [], {
    //     initializer: "initialize",
    // })
    // await USDC.deployed()

    console.log(`const stack = "${stack.address}"`)

    const routerContract = new ethers.ContractFactory(
        routerABI,
        routerBytecode,
        deployer
    )
    const router = await routerContract.attach(
        "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
    )

    const weth9Contract = new ethers.ContractFactory(
        wethABI,
        wethBytecode,
        deployer
    )
    const weth9 = await weth9Contract.attach(wethAddressPolygon)

    await weth9.approve(router.address, ethers.utils.parseEther("1000"))
    await stack.approve(router.address, ethers.utils.parseEther("1000"))
    await USDC.approve(router.address, ethers.utils.parseEther("1000"))

    await router.addLiquidityETH(
        stack.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("100"),
        deployer.address,
        ethers.constants.MaxUint256,
        { value: ethers.utils.parseEther("1000") }
    )

    // await router.addLiquidityETH(
    //     USDC.address,
    //     ethers.utils.parseEther("1000"),
    //     ethers.utils.parseEther("1000"),
    //     ethers.utils.parseEther("100"),
    //     deployer.address,
    //     ethers.constants.MaxUint256,
    //     { value: ethers.utils.parseEther("1000") }
    // )

    await router.getAmountsOut(ethers.utils.parseEther("10000"), [
        weth9.address,
        USDC.address,
    ])

    XCTMinterContract = await ethers.getContractFactory("XCTMinter")
    XCTMinter = await upgrades.deployProxy(
        XCTMinterContract,
        [
            stack.address,
            xct.address,
            USDC.address,
            admin,
            weth9.address,
            treasuryAddress,
            slippage,
            percentStackConversion,
            percentStackAdvantage,
            router.address,
        ],
        { initializer: "initialize" }
    )
    await XCTMinter.deployed()
    // XCTMinter = XCTMinterContract.attach("0xA0655dd91fD74Ffb69eF82C983f3BB9c6b9f6c0A");
    // XCTMinter = await upgrades.upgradeProxy("0xA0655dd91fD74Ffb69eF82C983f3BB9c6b9f6c0A", XCTMinterContract);
    // console.log("XCTMinter upgraded");

    console.log(`const XCTMinter = "${XCTMinter.address}"`)

    console.log("grant MINTER_ROLE to XCTMinter contract")
    await xct.grantRole(
        "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
        XCTMinter.address
    )

    await xct.approve(XCTMinter.address, ethers.utils.parseEther("100"))
    await stack.approve(XCTMinter.address, ethers.utils.parseEther("100"))

    const val = await XCTMinter.easyBuyXCT({
        value: ethers.utils.parseEther("1000"),
    })

    // const res = await val.wait()
    // console.log(res.events)
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
//  npx hardhat run --network localhost scripts/deploy.js --show-stack-traces
// npx hardhat node

// npx hardhat run --network maticmain scripts/deployXCT.js --show-stack-traces

// easyBuyXCT() - https://polygonscan.com/tx/0x8c310fa9b6b5a0d453b938fabcee4a696ac32cbad3a20579ca1318545a06003d
// buyXCT() - https://polygonscan.com/tx/0x921a36149c96d429e5a7de05ac573882986dc8539ddfed9543e5862f78ac9768
// sellXCT() - https://polygonscan.com/tx/0xd576448bc0f7760b40db124d89570845e4346d89463d5507db02748e28a595ed
