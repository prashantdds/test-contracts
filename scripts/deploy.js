// sleep time expects milliseconds
function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function main(){

    const [deployer]=await ethers.getSigners();
    console.log('deploy by acct: '+deployer.address);
    
    const bal=await deployer.getBalance();
    console.log('bal: '+bal);

    // deploy NFT Token
    NFT=await ethers.getContractFactory('DarkMatter');
    nftToken = await NFT.deploy();
    console.log(`const nftToken = "${nftToken.address}"`); // 0x527e794667Cb9958E058A824d991a3cf595039C0

    RegistrationContract=await ethers.getContractFactory('Registration');
    Registration = await upgrades.deployProxy(RegistrationContract, [nftToken.address, "0x2e4E45FD302882a10C66fDdc0386Ec4504cC509e", 300 ], { initializer: 'initialize' });
    await Registration.deployed();

    console.log(`const Registration = "${Registration.address}"`); // 0xAF69888E27433CCfDc48DD3acEc8BA937DFF74A9


    await nftToken.setApprovalForAll(Registration.address, true);

}

main().then(()=>process.exit(0))
.catch(err=>{  
    console.error(err);
    process.exit(1);
})
// gnosis DAO - 0x2e4E45FD302882a10C66fDdc0386Ec4504cC509e
 //npx hardhat run --network bscmain scripts/deploy.js --show-stack-traces
 //npx hardhat run --network bsctest scripts/deploy.js --show-stack-traces
//  npx hardhat run --network localhost scripts/deploy.js --show-stack-traces