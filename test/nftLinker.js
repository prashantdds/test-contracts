const { time, loadFixture, takeSnapshot, restore } = require("@nomicfoundation/hardhat-network-helpers");

const { expect } = require("chai");
const helper = require("../scripts/helper.js");

let Registration,
Subscription,
SubscriptionBalance,
SubscriptionBalanceCalculator,
SubnetDAODistributor,
xct,
stack,
nftToken,
appNFT,
ContractBasedDeployment,
RoleControl,
addrList;

const createSubnet = async(creator, attributeParam) => {

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
            ethers.utils.parseEther("0.0004")
        ],
        otherAttributes: [],
        maxClusters : 3,
        whiteListedClusters: [creator.address],
        supportFeeRate: 5000,
        stackFeesReqd: ethers.utils.parseEther("0.01"),
    };

    attributes = {...attributes, ...attributeParam};
    await nftToken.connect(creator).setApprovalForAll(Registration.address, true);
    const nftTr = await nftToken.mint(creator.address);
    const nftRec = await nftTr.wait();
    const transferEvent = nftRec.events.find(event => event.event == "Transfer");
    const nftID = transferEvent.args[2].toNumber();
    
    const curBalance = await stack.balanceOf(creator.address);
    if(curBalance.lt(attributes.stackFeesReqd)) {
        await stack.transfer(creator.address,  attributes.stackFeesReqd);
    }

    await stack.connect(creator).approve(
        Registration.address,
        ethers.utils.parseEther("1000000000")
    );

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
    );

    const tr = await op.wait();
    const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
    const subnetId = subnetCreatedEvent.args[0].toNumber();
    return subnetId;
}

const signupCluster = async (subnetID, subnetFees, clusterAddress, attributeParam) =>{
    let attributes = {
        walletAddress: clusterAddress.address,
        operatorAddress: clusterAddress.address,
        dnsip: "testDNSIP",  
    };
    attributes = {...attributes, ...attributeParam};
    await nftToken.connect(clusterAddress).setApprovalForAll(Registration.address, true);
    const nftTr = await nftToken.mint(clusterAddress.address);
    const nftRec = await nftTr.wait();
    const transferEvent = nftRec.events.find(event => event.event == "Transfer");
    const nftID = transferEvent.args[2].toNumber();

    const curBalance = await stack.balanceOf(clusterAddress.address);
    if(curBalance.lt(subnetFees)) {
        await stack.transfer(clusterAddress.address,  subnetFees);
    }
    await stack.connect(clusterAddress).approve(
        Registration.address,
        ethers.utils.parseEther("1000000000")
    );

    tr = await Registration.connect(clusterAddress).clusterSignUp(
        subnetID,
        attributes.dnsip,
        attributes.walletAddress,
        attributes.operatorAddress,
        nftID
    );
    rec = await tr.wait();

    const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
    const clusterID = clusterSignedUpEvent.args[1].toNumber();
    return clusterID;
}

const getAppNFTID = async (transactionHash) => {
    const transferFilter = appNFT.filters.Transfer();
    const transferLogList = await appNFT.queryFilter(transferFilter, -10, "latest");
    const transferLog = transferLogList.find(log => log.transactionHash == transactionHash);
    const nftID = transferLog.args[2].toNumber();
    return nftID;
}

const getDarkNFTID = async (transactionHash) => {
    const transferFilter = nftToken.filters.Transfer();
    const transferLogList = await nftToken.queryFilter(transferFilter, -10, "latest");
    const transferLog = transferLogList.find(log => log.transactionHash == transactionHash);
    const nftID = transferLog.args[2].toNumber();
    return nftID;
}

const getAmountIfLess = async (account, balanceToAdd, contractToApprove) => {
    // add amount to depositor if depositor's balance is less
    let currentBalance = await xct.balanceOf(account.address);
    if(currentBalance.lt(balanceToAdd)) {
        await xct.connect(addrList[0]).transfer(account.address,  balanceToAdd);
    }
    //approve subscription balance to withdraw xct out of depositor's wallet
    await xct.connect(account).approve(
        contractToApprove.address,
        balanceToAdd
    );

}

async function initContracts() {
    helper.setNoPrint(true);
    await helper.deployContracts();
    await helper.callStackApprove();
    await helper.callNftApprove();
    await helper.xctApproveSub();
    await helper.xctApproveSubBal();
    const _Registration = await helper.getRegistration();
    const _Subscription = await helper.getSubscription();
    const _SubscriptionBalance = await helper.getSubscriptionBalance();
    const _SubscriptionBalanceCalculator = await helper.getSubscriptionBalanceCalculator();
    const _SubnetDAODistributor = await helper.getSubnetDAODistributor();
    const _xct = await helper.getXCT();
    const _stack = await helper.getStack();
    const _nftToken = await helper.getNFTToken();
    const _appNFT = await helper.getAppNFT();
    const _RoleControl = await helper.getRoleControl();
    const _ContractBasedDeployment = await helper.getContractBasedDeployment();
    const _addrList = await ethers.getSigners();
    
    Registration = _Registration;
    Subscription = _Subscription;
    SubscriptionBalance = _SubscriptionBalance;
    SubscriptionBalanceCalculator = _SubscriptionBalanceCalculator;
    SubnetDAODistributor = _SubnetDAODistributor;
    ContractBasedDeployment = _ContractBasedDeployment;
    RoleControl = _RoleControl;
    xct = _xct;
    stack = _stack;
    nftToken = _nftToken;
    appNFT = _appNFT;
    addrList = _addrList;

    return {
        Registration,
        Subscription,
        SubscriptionBalance,
        SubscriptionBalanceCalculator,
        xct,
        stack,
        nftToken,
        appNFT,
        ContractBasedDeployment,
        addrList
    };
}

describe("Contract based deployment", async function () {

    async function deployContractsFixture()
    {
        return await initContracts();
    }

    before(async () => {
        addrList = await ethers.getSigners();
    })

	

    describe("user should be able to create app data using an app nft", async() => {

        it("user can create an app with the appropriate role", async () => {
            const globalDAO = addrList[0];
            const appOwner1 = addrList[1];
            const appOwner2 = addrList[2];
            const darkNFTOwner1 = addrList[3];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFee = 10000;
            const computeRequired = [1,2,3];
            const unitPrices = [
                ethers.utils.parseEther("0.0004"),
                ethers.utils.parseEther("0.0005"),
                ethers.utils.parseEther("0.0008"),
            ];
            let computePerSec = ethers.utils.parseEther("0");
            for(var i = 0; i < unitPrices.length; i++)
            {
                const price = unitPrices[i].mul(computeRequired[i]);
                computePerSec = computePerSec.add(price);
            }




            // deploying all the contracts
            await initContracts();

            let tr, rec;

            let LinkNFTs = await ethers.getContractFactory("LinkNFTs");
            let linknft = await upgrades.deployProxy(LinkNFTs, [appNFT.address], {
                initializer: "initialize"
            });
            await linknft.deployed();
            await appNFT.connect(appOwner1).setApprovalForAll(linknft.address, true);

            tr = await appNFT.mint(appOwner1.address);
            rec = await tr.wait();
            const appNFTID1 = await getAppNFTID(rec.transactionHash);

            tr = await appNFT.mint(appOwner1.address);
            rec = await tr.wait();
            const appNFTID2 = await getAppNFTID(rec.transactionHash);


            tr = await nftToken.mint(appOwner1.address);
            rec = await tr.wait();
            const darkNFTID1 = await getDarkNFTID(rec.transactionHash);
        
            await linknft.connect(appOwner1).linkTo(appNFTID1, nftToken.address, darkNFTID1);
            await linknft.connect(appOwner1).linkTo(appNFTID2, nftToken.address, darkNFTID1);


            const isLinked = await linknft.isLinked(darkNFTID1);
            expect(isLinked).to.be.true;

            const linkList = await linknft.getAllLinks(nftToken.address, darkNFTID1);
            expect(linkList.length).to.equal(2);
            expect(linkList[0]).to.equal(appNFTID1);
            expect(linkList[1]).to.equal(appNFTID2);

            const isLinked1 = await linknft.isLinkedTo(nftToken.address, darkNFTID1 , appNFTID1);
            expect(isLinked1).to.be.true;

            const isLinked2 = await linknft.isLinkedTo(nftToken.address, darkNFTID1 , appNFTID2);
            expect(isLinked2).to.be.true;

        })
	})
})
