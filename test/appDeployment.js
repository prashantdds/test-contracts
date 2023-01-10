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
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3].address;
            const globalSupportAddress = addrList[4];
            const supportAddress = addrList[5];
            const appDeployer = addrList[8];
            const subscriber2 = addrList[9];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const serviceProviderAddress = "address";
            const daoRate = 5000;

            const licenseFee = 10000;
            const minTimeFunds = 300;
            const globalSupportFee = 10000;
            const supportFee = 6000;
            const supportFee2 = 3000;
            const supportFee3 = 8000;
            let emptyApp = {
                digest: "0x0000000000000000000000000000000000000000000000000000000000000000",
                hashFunction: 0,
                size: 0,
                subnetIDList: [],
                resourceArray: []
            }
            let app1 = {
                name: "first-app",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [1, 1, 0]
                ],
                resourceArray: [1,2,4]
            }
            let updatedApp1 = {
                digest: "0x15e74093966a3f5a4b6ef4c2938a6b114bcbf82d5560e7c75294157b4721de72",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [2, 4, 0]
                ],
                resourceArray: [4,5,6]
            }
            let app2 = {
                name: "second-app",
                digest: "0xc4d9d4efff149450f1247319ac60dff35f4c23f2bf26dfd5ebdb3bbd6a506a65",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [1, 1, 0]
                ],
                resourceArray: [2,4,3]
            }
            let app3 = {
                name: "third-app",
                digest: "0xb641e0973004dedae14d81d388b2d58eddd3b2d43b2d7951c0c7ed7c74268389",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [4, 5, 0]
                ],
                resourceArray: [1,3,2]
            }
            let app4 = {
                name: "fourth-app",
                digest: "0xb641e0973004dedae14d81d388b2d58eddd3b2d43b2d7951c0c7ed7c74268389",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [4, 5, 0]
                ],
                resourceArray: [1,3,2]
            }
            let updatedApp4 = {
                digest: "0x961c000c6ef1e51cc3b942bd74cb50c3877a306ce35fe9c9b5f4c7eaac3fe790",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [2, 3, 0]
                ],
                resourceArray: [7,8,9]
            }
            let app5 = {
                name: "fifth-app",
                digest: "0xfb23c680d88beb7aef533160000c788196986c2dcc8cb0e5353e802a064d3ae7",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [2, 3, 0]
                ],
                resourceArray: [7,8,9]
            }
            let app6 = {
                name: "sixth-app",
                digest: "0x125dfe4b406849bf275851570b3d9fce38a3c04a8c84eb7af02ecdb6bdc333dc",
                hashFunction: 18,
                size: 32,
                subnetIDList: [
                    [2, 3, 0]
                ],
                resourceArray: [7,8,9]
            }
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

            const compareAppData = async (nftID,app) => {
                let getData = await ContractBasedDeployment.getFullData(nftID, app.name);
                let getDataSubnetIDList = 
                getData.subnetIDList.map(elemArray =>
                        [elemArray[0].toNumber(), elemArray[1].toNumber(), elemArray[2].toNumber()]
                    );
                let getDataResourceArray = getData.resourceArray.map(elem => elem.toNumber());
                expect(getData.digest).to.equal(app.digest);
                expect(getData.hashfunction).to.equal(app.hashFunction);
                expect(getData.size).to.equal(app.size);
                expect(getDataSubnetIDList).to.eql(app.subnetIDList);
                expect(getDataResourceArray).to.eql(app.resourceArray);
                expect(getData.lastUpdatedTime).to.equal(app.updateTimestamp);
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
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();


            // create the 1st subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: unitPrices
            });

            expect(subnetID).to.equal(0);

            // transfer the xct if the subscriber does not have enough balance
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, globalSupportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullAmount = balanceToAdd;
            
            await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            
            const snapshotBeforeSubscribe = await takeSnapshot();

            tr = await Subscription.connect(subscriber).subscribe(
                false,
                balanceToAdd,
                0,
                subnetID,
                serviceProviderAddress,
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

            let updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            // await contractDeploy


            await expect(ContractBasedDeployment.connect(subscriber).createData(
                nftID,
                app1.name,
                app1.digest,
                app1.hashFunction,
                app1.size,
                app1.subnetIDList,
                app1.resourceArray,
                updateTimestamp
            )).to.be.revertedWith("CONTRACT_BASED_DEPLOYER permission not there in RoleControlV2");
            // tr = await appNFT.mint(subscriber.address);
            // rec = await tr.wait();
            // let nftID1 = getAppNFTID(rec.transactionHash);

            let role = await RoleControl.CONTRACT_BASED_DEPLOYER()
        
            // await expect(RoleControl.connect(subscriber).grantRole(nftID, role, subscriber.address)).to.be.reverted;


            await RoleControl.connect(subscriber).grantRole(nftID, role, subscriber.address);

            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";

            await ContractBasedDeployment.connect(subscriber).createData(
                nftID,
                app1.name,
                app1.digest,
                app1.hashFunction,
                app1.size,
                app1.subnetIDList,
                app1.resourceArray,
                updateTimestamp
            );

            app1.updateTimestamp = updateTimestamp;
            await compareAppData(nftID, app1);


            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            let app2UpdateTimestamp = updateTimestamp;
            await ContractBasedDeployment.connect(subscriber).createData(
                nftID,
                app2.name,
                app2.digest,
                app2.hashFunction,
                app2.size,
                app2.subnetIDList,
                app2.resourceArray,
                updateTimestamp
            );

            app2.updateTimestamp = updateTimestamp;
            await compareAppData(nftID, app2);

            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            app1 = {...app1, ...updatedApp1};
            await ContractBasedDeployment.connect(subscriber).updateData(
                nftID,
                app1.name,
                app1.digest,
                app1.hashFunction,
                app1.size,
                app1.subnetIDList,
                app1.resourceArray,
                updateTimestamp
            );

            app1.updateTimestamp = updateTimestamp;
            await compareAppData(nftID, app1);
            await compareAppData(nftID, app2);

            // await expect(ContractBasedDeployment.connect().connect(subscriber2).getFullData(nftID, app1.name))
            // .to.be.reverted;

            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            await expect(ContractBasedDeployment.connect(subscriber2).createData(
                nftID,
                app3.name,
                app3.digest,
                app3.hashFunction,
                app3.size,
                app3.subnetIDList,
                app3.resourceArray,
                updateTimestamp
            )).to.be.reverted;


            await expect(RoleControl.connect(subscriber2).grantRole(nftID, role, subscriber.address)).to.be.reverted;

            await RoleControl.connect(subscriber).grantRole(nftID, role, subscriber2.address);


            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            await ContractBasedDeployment.connect(subscriber2).createData(
                nftID,
                app3.name,
                app3.digest,
                app3.hashFunction,
                app3.size,
                app3.subnetIDList,
                app3.resourceArray,
                updateTimestamp
            );
            app3.updateTimestamp = updateTimestamp;
            await compareAppData(nftID, app3);


            tr = await appNFT.mint(appDeployer.address);
            rec = await tr.wait();

            let nftID2 = await getAppNFTID(rec.transactionHash);
            
            await RoleControl.connect(appDeployer).grantRole(nftID2, role, appDeployer.address);

            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            await ContractBasedDeployment.connect(appDeployer).createData(
                nftID2,
                app4.name,
                app4.digest,
                app4.hashFunction,
                app4.size,
                app4.subnetIDList,
                app4.resourceArray,
                updateTimestamp
            );
            app4.updateTimestamp = updateTimestamp;
            await compareAppData(nftID2, app4);

            app4 = {...app4, updatedApp4};

            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            await ContractBasedDeployment.connect(appDeployer).updateData(
                nftID2,
                app4.name,
                app4.digest,
                app4.hashFunction,
                app4.size,
                app4.subnetIDList,
                app4.resourceArray,
                updateTimestamp
            );
            app4.updateTimestamp = updateTimestamp;
            await compareAppData(nftID2, app4);


            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            await ContractBasedDeployment.connect(appDeployer).createData(
                nftID2,
                app5.name,
                app5.digest,
                app5.hashFunction,
                app5.size,
                app5.subnetIDList,
                app5.resourceArray,
                updateTimestamp
            );
            app5.updateTimestamp = updateTimestamp;
            await compareAppData(nftID2, app5);


            await expect(ContractBasedDeployment.connect(appDeployer).deleteData(nftID, app2.name))
            .to.be.revertedWith("CONTRACT_BASED_DEPLOYER permission not there in RoleControlV2")
            ;

            await ContractBasedDeployment.connect(subscriber).deleteData(nftID, app2.name);


            await expect(ContractBasedDeployment.connect(subscriber).deleteData(nftID2, app4.name))
            .to.be.revertedWith("CONTRACT_BASED_DEPLOYER permission not there in RoleControlV2")
            ;

            await ContractBasedDeployment.connect(appDeployer).deleteData(nftID2, app4.name);

            emptyApp.name = app2.name;
            compareAppData(nftID, emptyApp);
            compareAppData(nftID, app1);
            emptyApp.name = app4.name;
            compareAppData(nftID2, emptyApp);
            compareAppData(nftID2, app5);


            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";

            let failApp6 = {...app6};
            failApp6.subnetIDList = [[
                3, 2, subnetID
            ]];

            await expect(ContractBasedDeployment.connect(appDeployer).createData(
                nftID2,
                failApp6.name,
                failApp6.digest,
                failApp6.hashFunction,
                failApp6.size,
                failApp6.subnetIDList,
                failApp6.resourceArray,
                updateTimestamp
            )).to.be.revertedWith("max replica count should be greater or equal to the min replica count");

            failApp6.subnetIDList = app6.subnetIDList;
            failApp6.resourceArray = [];
            await expect(ContractBasedDeployment.connect(appDeployer).createData(
                nftID2,
                failApp6.name,
                failApp6.digest,
                failApp6.hashFunction,
                failApp6.size,
                failApp6.subnetIDList,
                failApp6.resourceArray,
                updateTimestamp
            )).to.be.revertedWith("Resource array should have replica count and count of resource types");
 

            failApp6 = {...app6}
            failApp6.name = app5.name;
            await expect(ContractBasedDeployment.connect(appDeployer).createData(
                nftID2,
                failApp6.name,
                failApp6.digest,
                failApp6.hashFunction,
                failApp6.size,
                failApp6.subnetIDList,
                failApp6.resourceArray,
                updateTimestamp
            )).to.be.revertedWith("Already set");


            let successApp6 = {...app6};
            successApp6.name = app4.name;

            updateTimestamp = new Date();
            updateTimestamp = updateTimestamp.getTime() + "";
            await ContractBasedDeployment.connect(appDeployer).createData(
                nftID2,
                successApp6.name,
                successApp6.digest,
                successApp6.hashFunction,
                successApp6.size,
                successApp6.subnetIDList,
                successApp6.resourceArray,
                updateTimestamp
            );
            successApp6.updateTimestamp = updateTimestamp;
            await compareAppData(nftID2, successApp6);

        })
	})
})
