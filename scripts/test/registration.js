const helper = require('../helper');
const {expect} = require('chai');



const createSubnet  = async () => {
    const nftToken = await helper.getNFTToken();

    const nftTr = await nftToken.mint(helper.getAddresses().deployer);
    const nftRec = await nftTr.wait();
    expect(nftRec.events).to.not.be.empty;
    expect(nftRec.events.length).to.be.greaterThan(0);
    const transferEvent = nftRec.events.find(event => event.event == "Transfer");
    expect(transferEvent).to.not.be.undefined;

    const nftID = transferEvent.args[2].toNumber();

    const Registration = await helper.getRegistration();

    // // uint256 nftId,
    // // address _subnetLocalDAO,
    // // uint256 _subnetType,
    // // bool _sovereignStatus,
    // // uint256 _cloudProviderType,
    // // bool _subnetStatusListed,
    // // uint256[] memory _unitPrices,
    // // uint256[] memory _otherAttributes,
    // // uint256 _maxClusters,
    // // address[] memory _whiteListedClusters,
    // // uint256 _supportFeeRate,
    // // uint256 _stackFeesReqd

    const op = await Registration.createSubnet(
        nftID,
        helper.getAddresses().deployer,
         1,
         true,
         1,
         true,
         [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
         [],
         3,
         [ helper.getAddresses().deployer],
         5000,
         ethers.utils.parseEther("0.01"));
    const tr = await op.wait();

    console.log(tr);

    expect(tr.events.length).to.be.greaterThan(0);

    const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
    const NFTLocked = tr.events.find(event => event.event == "NFTLockedForSubnet");

    expect(subnetCreatedEvent).to.not.be.undefined;
    expect(NFTLocked).to.not.be.undefined;

    const subnetId = subnetCreatedEvent.args[0].toNumber();
    
    const subnetAttributes = await Registration.getSubnetAttributes(subnetId);

    expect(subnetAttributes).to.not.be.undefined;
    expect(subnetAttributes).to.be.an('array').that.is.not.empty;

    console.log(subnetAttributes);
}

const testRegistration = async () => {
    await createSubnet();
}

async function main() {
    helper.setAddresses({
        deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        xct: '0x59b670e9fA9D0A427751Af201D676719a970857b',
        stack: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
        nftToken: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
        Registration: '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f',
        appNFT: '0x4A679253410272dd5232B3Ff7cF5dbB88f295319',
        SubscriptionBalanceCalculator: '0x7a2088a1bFc9d81c55368AE168C2C02570cB814F',
        SubscriptionBalance: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
        SubnetDAODistributor: '0xc5a5C42992dECbae36851359345FE25997F5C42d',
        Subscription: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933'
      });

    // await testRegistration();
    const nftToken = await helper.getNFTToken();
    console.log(nftToken.functions);
    console.log(await nftToken.ownerOf(1));
}

main().then(()=> {
    console.log("Registration test was successful")
    process.exit(0)
}
)
.catch(err=>{  
    console.error(err);
    process.exit(1);
})