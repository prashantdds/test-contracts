const { expect } = require("chai");
const helper = require("../scripts/helper.js")

before(async () => {
    await helper.deployContracts();
    await helper.callStackApprove();
    await helper.callNftApprove();

})

it('Individuals without NFT cannot create a subnet', async () => {

    const nftToken = await helper.getNFTToken();

    const nftTr = await nftToken.mint(helper.accounts[1]);
    const nftRec = await nftTr.wait();
    expect(nftRec.events).to.not.be.empty;
    expect(nftRec.events.length).to.be.greaterThan(0);
    const transferEvent = nftRec.events.find(event => event.event == "Transfer");
    expect(transferEvent).to.not.be.undefined;

    const nftID = transferEvent.args[2].toNumber();

    const Registration = await helper.getRegistration();


    let failedFlag = false;
    try {
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
    }
    catch(err) {
        failedFlag = true;
    }

    expect(failedFlag).to.be.true;
})

it("Individuals with dark matter NFT should be able to create a subnet", async () => {
    const nftToken = await helper.getNFTToken();

    const nftTr = await nftToken.mint(helper.getAddresses().deployer);
    const nftRec = await nftTr.wait();
    expect(nftRec.events).to.not.be.empty;
    expect(nftRec.events.length).to.be.greaterThan(0);
    const transferEvent = nftRec.events.find(event => event.event == "Transfer");
    expect(transferEvent).to.not.be.undefined;

    const nftID = transferEvent.args[2].toNumber();

    
    const ownerOfNFT = await nftToken.ownerOf(nftID);

    expect(ownerOfNFT).to.equal(helper.getAddresses().deployer);

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

    expect(tr.events.length).to.be.greaterThan(0);

    const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
    const NFTLocked = tr.events.find(event => event.event == "NFTLockedForSubnet");

    expect(subnetCreatedEvent).to.not.be.undefined;
    expect(NFTLocked).to.not.be.undefined;

    const subnetId = subnetCreatedEvent.args[0].toNumber();
    
    const subnetAttributes = await Registration.getSubnetAttributes(subnetId);

    expect(subnetAttributes).to.not.be.undefined;
    expect(subnetAttributes).to.be.an('array').that.is.not.empty;

    const newNFTOwner = await nftToken.ownerOf(nftID);

    expect(newNFTOwner).to.not.equal(helper.getAddresses().deployer);
    expect(newNFTOwner).to.equal(helper.getAddresses().Registration);

})


it("Individuals with Dark Matter NFT and stack fees can create a cluster on any subnet", async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();


    const nftToken = await helper.getNFTToken();
    let tr = await nftToken.mint(helper.accounts[0]);
    let rec = await tr.wait();
    let transferEvent = rec.events.find(event => event.event == "Transfer");
    const nftID = transferEvent.args[2].toNumber();

    tr = await Registration.createSubnet(
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

    rec = await tr.wait();

    
    const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
    const NFTLocked = rec.events.find(event => event.event == "NFTLockedForSubnet");

    const subnetID = subnetCreatedEvent.args[0].toNumber();


    tr = await nftToken.mint(helper.accounts[1]);
    rec = await tr.wait();
    transferEvent = rec.events.find(event => event.event == "Transfer");
    console.log("transferEvent", transferEvent);
    const clusterNFTID = transferEvent.args[2].toNumber();

    const ownerCheck = await nftToken.ownerOf(clusterNFTID);
    console.log("ownerCHeck: ", ownerCheck);
    expect(ownerCheck).to.equal(addr1.address);

    console.log(addr1.address);

    // await nftToken.transferFrom(addr1.address, addr2.address, clusterNFTID);

    tr = await Registration.connect(addr1).clusterSignUp(subnetID, "127.0.0.1", helper.accounts[1], clusterNFTID);
    // rec = tr.wait();


    // const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
    // const NFTLockedForClusterEvent = rec.events.find(event => event.event == "NFTLockedForCluster");

    // expect(clusterSignedUpEvent).to.exist;
    // expect(NFTLockedForClusterEvent).to.exist;

    // const newNFTOwner = await nftToken.ownerOf(clusterNFTID);
    // expect(newNFTOwner).to.not.equal(helper.account[1]);
    // expect(newNFTOwner).to.equal(helper.getAddresses().Registration);

    // const clusterID = clusterSignedUpEvent[1].toNumber();

    // const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

    // console.log(clusterAttributes);

    // expect(clusterAttributes[0].toString()).to.equal(account[1]);
    // expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
    // expect(clusterAttributes[2].toNumber()).to.equal(1);
    // expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
})