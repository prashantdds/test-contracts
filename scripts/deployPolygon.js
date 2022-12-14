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

    AppNFTContract = await ethers.getContractFactory("TestAppNFT")
    appNFT = await AppNFTContract.deploy()
    console.log(`const appNFT = "${appNFT.address}"`)
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
