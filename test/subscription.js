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
        nftID,
        "cluster"
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
    const _ContractBasedDeployment = await helper.getContractBasedDeployment();
    const _addrList = await ethers.getSigners();
    
    Registration = _Registration;
    Subscription = _Subscription;
    SubscriptionBalance = _SubscriptionBalance;
    SubscriptionBalanceCalculator = _SubscriptionBalanceCalculator;
    SubnetDAODistributor = _SubnetDAODistributor;
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

describe("Subscription contract", async function () {
    // For testing specifically this file uncomment below code and use "npx hardhat test test/subscription.js" command

    async function deployContractsFixture()
    {
        return await initContracts();
    }

    before(async () => {
        addrList = await ethers.getSigners();
    })

    describe("testing of 3 balances of a NFT: Credit, External and NFT balances", async() => {
	
        it("support address gets a share of the subscription amount", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3].address;
            const globalSupportAddress = addrList[4];
            const invalidSupportAddress = addrList[3];
            const supportAddress = addrList[5];
            const supportAddress2 = addrList[8];
            const subscriber2 = addrList[6];
            const subscriber3 = addrList[7];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 10;
            const firstTimePoint = 60 * 60 * 24 * 2;
            const secondTimePoint = 60 * 60 * 24 * 4;
            const thirdTimePoint = 60 * 60 * 24 * 6;
            const referralExpiry = 60 * 60 * 24 * 4;
            const noticeTime = 60 * 60 * 24 * 2;
            const cooldownTime = 60 * 60 * 24 * 1;
            const referralPercent = 8000;
            const daoRate = 5000;

            const licenseFee = 10000;
            const minTimeFunds = 300;
            const globalSupportFee = 10000;
            let newSupportFee = 14000;
            const supportFee = 6000;
            const supportFee2 = 3000;
            const supportFee3 = 8000;
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

            const calcDripRate = (supportFee) => {
                let factor = daoRate + supportFee + referralPercent + 100000;
                return computePerSec.mul(factor).div(100000).add(licenseFee);
            }

            // set the min time funds and global support fees to be passed to the contract constructors
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: globalSupportAddress.address,
                    minTimeFunds: minTimeFunds,
                    supportFee: globalSupportFee,
                    reqdNoticeTimeSProvider: noticeTime,
                    reqdCooldownSProvider: cooldownTime,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();
            console.log("computePerSec: ", computePerSec, await appNFT.ownerOf(3));

            // create the 1st subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: unitPrices
            });


            // transfer the xct if the subscriber does not have enough balance
            let dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, globalSupportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullAmount = balanceToAdd;


            let newDripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(
                subnetID,
                licenseFee,
                newSupportFee,
                computeRequired
            );
            
            await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            await getAmountIfLess(subscriber2, balanceToAdd, Subscription);
            await getAmountIfLess(subscriber3, balanceToAdd, Subscription);

            // Subscribing to the 1st subnet
            await expect(Subscription.connect(subscriber).subscribe(
                subscriber.address,
                false,
                balanceToAdd,
                0,
                subnetID,
                referralAddress.address,
                licenseAddress,
                invalidSupportAddress.address,
                licenseFee,
                computeRequired
                )).to.be.revertedWith("The support address given is not valid");

            
            const snapshotBeforeSubscribe = await takeSnapshot();

            tr = await Subscription.connect(subscriber).subscribe(
                subscriber.address,
                false,
                balanceToAdd,
                0,
                subnetID,
                referralAddress.address,
                licenseAddress,
                globalSupportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();

            let subscribeTime = await time.latest();

            // Get the minted appNFT
            let nftID = await getAppNFTID(rec.transactionHash);
            
            const snapshotAfterSubscribe = await takeSnapshot();
        
            await time.increaseTo(subscribeTime + thirdTimePoint);
            
            let beforeRefSupply = await xct.balanceOf(globalSupportAddress.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(globalSupportAddress.address);
            let afterRefSupply = await xct.balanceOf(globalSupportAddress.address);

            let durPassed = thirdTimePoint + afterUpdateTime - beforeUpdateTime;
            let calcBal = computePerSec.mul(durPassed).mul(globalSupportFee).div(100000);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await snapshotBeforeSubscribe.restore();
            console.log("after restore");

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);

            dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            fullAmount = balanceToAdd;

            tr = await Subscription.connect(subscriber).subscribe(
                subscriber.address,
                false,
                balanceToAdd,
                0,
                subnetID,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();
                
            subscribeTime = await time.latest();

            nftID = await getAppNFTID(rec.transactionHash);

            let totalWithdrawn = ethers.utils.parseEther("0");

            await time.increaseTo(subscribeTime + firstTimePoint);
            
            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = firstTimePoint + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee).div(100000);
            const balanceFromFirstTP = calcBal;
            totalWithdrawn = totalWithdrawn.add(calcBal);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await Subscription.setSupportFeesForNFT(supportAddress.address, nftID, newSupportFee);

            await time.increaseTo(subscribeTime + secondTimePoint);
            const startSecondTPTime = await time.latest();
            
            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            const timeAfterUpdateBalance = afterUpdateTime;
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = secondTimePoint + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee).div(100000);
            calcBal = calcBal.sub(balanceFromFirstTP);
            totalWithdrawn = totalWithdrawn.add(calcBal);
            const balanceFromSecondTP = calcBal;
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;
            

            beforeUpdateTime = await time.latest();
            await Subscription.connect(subscriber).approveNewSupportFees(subscriber.address, nftID, subnetID);
            afterUpdateTime = await time.latest();
            const timeTakenForApprove = afterUpdateTime - timeAfterUpdateBalance;
            
            const balanceUpdatedAfterApprove = computePerSec.mul(timeTakenForApprove).mul(supportFee).div(100000);
            const timeAfterApprove = await time.latest();

            await time.increaseTo(subscribeTime + thirdTimePoint);
            const timeAfterIncrease = await time.latest();

            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);


            calcBal = computePerSec.mul(
                timeAfterIncrease - timeAfterApprove
                + (afterUpdateTime - beforeUpdateTime)

            ).mul(newSupportFee).div(100000);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            afterRefSupply = afterRefSupply.sub(balanceUpdatedAfterApprove);
            expect(afterRefSupply.eq(calcBal)).to.be.true;

            await snapshotBeforeSubscribe.restore();

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);


            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            let nftID1 = getAppNFTID(rec.transactionHash);

            tr = await appNFT.mint(subscriber2.address);
            rec = await tr.wait();
            let nftID2 = getAppNFTID(rec.transactionHash);

            tr = await appNFT.mint(subscriber3.address);
            rec = await tr.wait();
            let nftID3 = getAppNFTID(rec.transactionHash);

            await Subscription.connect(supportAddress).setSupportFeesForNFT(supportAddress.address, nftID2, supportFee2);
            await Subscription.connect(supportAddress).setSupportFeesForNFT(supportAddress.address, nftID3, supportFee3);


            tr = await Subscription.connect(subscriber).subscribe(
                subscriber.address,
                true,
                balanceToAdd,
                nftID1,
                subnetID,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();
            subscribeTime = await time.latest();


            tr = await Subscription.connect(subscriber2).subscribe(
                subscriber2.address,
                true,
                balanceToAdd,
                nftID2,
                subnetID,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();
            let subscribeTime2 = await time.latest();


            tr = await Subscription.connect(subscriber3).subscribe(
                subscriber3.address,
                true,
                balanceToAdd,
                nftID3,
                subnetID,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();
            let subscribeTime3 = await time.latest();

            await time.increaseTo(subscribeTime + subscribeDuration/2);
            
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();

            let calc1Bal = computePerSec.mul(subscribeDuration/2 + afterUpdateTime - beforeUpdateTime).mul(supportFee).div(100000);

            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID2);
            afterUpdateTime = await time.latest();

            let calc2Bal = computePerSec.mul((afterUpdateTime - subscribeTime2)).mul(supportFee2).div(100000);


            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID3);
            afterUpdateTime = await time.latest();

            let calc3Bal = computePerSec.mul((afterUpdateTime - subscribeTime3)).mul(supportFee3).div(100000);

            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            calcBal = calc1Bal.add(calc2Bal).add(calc3Bal);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await snapshotBeforeSubscribe.restore();

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);

            tr = await Subscription.connect(subscriber).subscribe(
                subscriber.address,
                false,
                balanceToAdd,
                0,
                subnetID,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );
            subscribeTime = await time.latest();
            

        })
	

	})
	

})
