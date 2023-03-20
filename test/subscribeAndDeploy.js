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

const getXCTAmount = async (
    account,
    balanceToAdd,
    contractToApprove
) => {
    await xct.mint(account.address, balanceToAdd);
    await xct.connect(account).approve(
        contractToApprove.address,
        balanceToAdd
    );
}

const getAmountIfLess = async (
    erc20,
    account,
    balanceToAdd,
    contractToApprove
) => {
    // add amount to depositor if depositor's balance is less
    let currentBalance = await erc20.balanceOf(account.address)
    if (currentBalance.lt(balanceToAdd)) {
        const depbal = await erc20.balanceOf(addrList[0].address);
        await erc20.transfer(account.address, balanceToAdd)
    }
    //approve subscription balance to withdraw erc20 out of depositor's wallet
    await erc20.connect(account).approve(
        contractToApprove.address,
        balanceToAdd
    );
}

const getNFTID = async (erc721, transactionHash) => {
    const transferFilter = erc721.filters.Transfer();
    const transferLogList = await erc721.queryFilter(transferFilter, -10, "latest");
    const transferLog = transferLogList.find(log => log.transactionHash == transactionHash);
    const nftID = transferLog.args[2].toNumber();
    return nftID;
}

const mintNFT = async(erc721, addrObj, contract) => {
    tr = await erc721.mint(addrObj.address);
    rec = await tr.wait();

    await erc721.connect(addrObj).setApprovalForAll(
        contract.address,
        true
    );

    return getNFTID(erc721, rec.transactionHash);
}

const createSubnet = async( creator, attributeParam) => {

    const darkMatter = nftToken;

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
        maxClusters : 5,
        whiteListedClusters: [creator.address],
        supportFeeRate: 5000,
        stackFeesReqd: ethers.utils.parseEther("0.01"),
        subnetName: 'def-subnet'
    };


    attributes = {...attributes, ...attributeParam};
    const nftID = await mintNFT(darkMatter, creator, Registration);

    
    await getAmountIfLess(stack, creator, helper.parameters.registration.reqdStackFeesForSubnet, Registration);

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
        attributes.stackFeesReqd,
        attributes.subnetName
    );

    const tr = await op.wait();
    const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
    const subnetId = subnetCreatedEvent.args[0].toNumber();
    return subnetId;
}

const signupCluster = async (subnetID, subnetFees, clusterAddress, attributeParam) =>{

    const bobArray = [3,90,20,244,156,57,237,234,225,127,203,179,183,142,240,2,76,127,172,131,75,113,184,97,91,117,208,166,152,28,244,173,73];

    const darkMatterNFT = nftToken;

    let attributes = {
        walletAddress: clusterAddress.address,
        operatorAddress: clusterAddress.address,
        publicKey: bobArray,
        dnsip: "testDNSIP",
        clusterName: "def-cluster"
    };
    attributes = {...attributes, ...attributeParam};


    const nftID = await mintNFT(darkMatterNFT, clusterAddress, Registration);

    await getAmountIfLess(stack, clusterAddress, subnetFees, Registration);


    tr = await Registration.connect(clusterAddress).clusterSignUp(
        subnetID,
        attributes.dnsip,
        attributes.walletAddress,
        attributes.operatorAddress,
        attributes.publicKey,
        nftID,
        attributes.clusterName
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
    // const _RoleControl = await helper.getRoleControl();
    const _ContractBasedDeployment = await helper.getContractBasedDeployment();
    const _addrList = await ethers.getSigners();
    
    Registration = _Registration;
    Subscription = _Subscription;
    SubscriptionBalance = _SubscriptionBalance;
    SubscriptionBalanceCalculator = _SubscriptionBalanceCalculator;
    SubnetDAODistributor = _SubnetDAODistributor;
    ContractBasedDeployment = _ContractBasedDeployment;
    // RoleControl = _RoleControl;
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

const displayAppData = async (nftID, subnetIDList, paramAppList) => {
    const accum = await SubscriptionBalance.nftAccumCost(nftID);
    let appList = await ContractBasedDeployment.getAppList(nftID);
    
    console.log("\n DISPLAY APP DATA");
    console.log("appList: ", appList);
    let nftSubnetList = await ContractBasedDeployment.getNFTSubnetList(nftID);
    nftSubnetList = nftSubnetList.map(subnet => subnet.toNumber());
    console.log("nft subnet List", nftSubnetList);

    console.log("appCount:");
    let appCount = []
    for(var i = 0; i < nftSubnetList.length; i++)
    {
        let subnetID = nftSubnetList[i];
        const appCount = await ContractBasedDeployment.nftSubnetEntry(nftID, subnetID);
        console.log(appCount);
    }

    console.log("revenue accum: ", accum);
    console.log("subnet:");

    // const activeSubnetList = await ContractBasedDeployment.getActiveSubnetsOfNFT(nftID);
    for(var i = 0; i < nftSubnetList.length; i++)
    {
        const subnetID = nftSubnetList[i];
        const subnetResource = await ContractBasedDeployment.getComputesOfSubnet(nftID, subnetID);
        console.log(subnetID, subnetResource);
    }

    let subnetMap = {};

    for(var i = 0; i < appList.length; i++)
    {
        const app = appList[i];
        const paramApp = paramAppList[i];

        const resourceList = app.app.resourceArray;
        const appSubnetList = app.subnetList.map(subnetBN => subnetBN.toNumber());
        console.log("app: ", app.appID.toString());
        console.log("currentReplica", app.currentReplica);
        console.log("resource", app.app.resourceArray);
        console.log("subnetList: ", appSubnetList);

        console.log("param app: ", paramApp.multiplier);
        const subnetList = paramApp.subnetList;

        for(var j = 0; j < subnetList.length; j++)
        {
            const subnetID = subnetList[j];
            
            let subnetResource;
            if(!subnetMap[subnetID])
            {
                subnetResource = new Array(5).fill(0);
            }
            else {
                subnetResource = subnetMap[subnetID];
            }
            
            for(var p = 0; p < paramApp.resourceArray.length; p++)
            {
                if(p < subnetResource.length)
                    subnetResource[p] += paramApp.multiplier[j][p]*paramApp.resourceArray[p];
                else
                    subnetResource.push(paramApp.multiplier[j][p]*paramApp.resourceArray[p]);
            }

            subnetMap[subnetID] = subnetResource;
        }
    }

    console.log("subnetMap: ", subnetMap);
}


describe("Contract based deployment", async function () {

    async function deployContractsFixture()
    {
        return await initContracts();
    }

    before(async () => {
        addrList = await ethers.getSigners();
    })

	

    describe("user should be able to create app data using an app nft", async function () {
        this.timeout(400000);


        it("subscribeAndCreateApp with 1 subnet, and create app with same subnet", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1],
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            // for(var j = 0; j < subnetLen; j++)
            // {
            //     app1.multiplier.push([1,1,1,1,1]);
            //     app3.multiplier.push([1,1,1,1,1]);

            //     app1.subnetList.push(subnetIDList[j]);
            //     app3.subnetList.push(subnetIDList[j]);
            // }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

           await displayAppData(nftID, subnetIDList, [app1, app3]);

        });
		
        it("subscribeAndCreateApp with 3 subnet, and create app with 1 subnet", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 3;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            for(var j = 0; j < subnetLen; j++)
            {
                app1.multiplier.push([1,1,1,1,1]);
                app1.subnetList.push(subnetIDList[j]);
            }

            app3.multiplier.push([1,1,1,1,1]);
            app3.subnetList.push(subnetIDList[0]);


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

            await displayAppData(nftID, subnetIDList, [app1, app3]);
        });

        it("subscribeAndCreateApp with 3 subnet, and create app with 3 subnet", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                expect(getData.cidLockAndNoDeploy[0]).to.equal(app.cidLock);
                expect(getData.cidLockAndNoDeploy[1]).to.equal(app.noDeploy);
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 3;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            for(var j = 0; j < subnetLen; j++)
            {
                app1.multiplier.push([1,1,1,1,1]);
                app1.subnetList.push(subnetIDList[j]);

                app3.multiplier.push([1,1,1,1,1]);
                app3.subnetList.push(subnetIDList[j]);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

            await displayAppData(nftID, subnetIDList, [app1, app3]);
        });

        it("subscribeAndCreateApp with 1 subnet, and create app with 3 subnet", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1,1,1,1,1],
                ],
                resourceArray: [1, 1, 1, 1, 1],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [1, 2, 3],
                multiplier: [
                    [1,1,1,1,1],
                    [1,1,1,1,1],
                    [1,1,1,1,1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 4;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

            await displayAppData(nftID, subnetIDList, [app1, app3]);
        });

        it("cannot call subscribeAndCreateApp twice", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [],
                multiplier: [
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            for(var j = 0; j < subnetLen; j++)
            {
                app1.multiplier.push([1,1,1,1,1]);
                app3.multiplier.push([1,1,1,1,1]);

                app1.subnetList.push(subnetIDList[j]);
                app3.subnetList.push(subnetIDList[j]);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await expect(ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app2.rlsAddresses,
                app2.licenseFee,
                app2.appName,
                app2.digest,
                app2.hashAndSize,
                app2.subnetList,
                app2.multiplier,
                app2.resourceArray,
                app2.cidLock
            )).to.be.revertedWith("NFT already subscribed");
        });

        it("create multiple apps", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                expect(getData.cidLockAndNoDeploy[0]).to.equal(app.cidLock);
                expect(getData.cidLockAndNoDeploy[1]).to.equal(app.noDeploy);
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 1],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1]
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [1, 2],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db3",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [2, 4, 5],
                multiplier: [
                    [0, 0, 1, 1, 2, 2],
                    [0, 0, 0, 2, 1, 0],
                    [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 10;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            // let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app2.appName,
                app2.digest,
                app2.hashAndSize,
                app2.subnetList,
                app2.multiplier,
                app2.resourceArray,
                app2.cidLock
            );


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

           await displayAppData(nftID, subnetIDList, [app1, app2, app3]);

        });
	
        it("updateApp of app with 3 subnets, and updating multiplier/ resource of 1 subnet", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                expect(getData.cidLockAndNoDeploy[0]).to.equal(app.cidLock);
                expect(getData.cidLockAndNoDeploy[1]).to.equal(app.noDeploy);
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 1, 2],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [1, 2],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db3",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [2, 4, 5],
                multiplier: [
                    [0, 0, 1, 1, 2, 2],
                    [0, 0, 0, 2, 1, 0],
                    [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 10;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            // let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await displayAppData(nftID, subnetIDList, [app1]);

            // app1.multiplier[0] = [3, 6, 0, 1, 1];
            // app1.resourceArray = [6, 5, 0, 6, 1]4

            let multiplier = [[3, 6, 0, 1, 1, 6]];
            let resourceArray = [6, 5, 0, 6, 1, 5];
            let subnetList = [0];
            await ContractBasedDeployment.connect(subscriber).updateApp(
                0,
                nftID,
                0,
                app1.digest,
                app1.hashAndSize,
                subnetList,
                multiplier,
                resourceArray,
            );

            app1.multiplier[0] = multiplier[0];
            app1.resourceArray = resourceArray;


           await displayAppData(nftID, subnetIDList, [app1]);

        });

        it("updateApp of app with 3 subnets, and updating multiplier/ resource of 2 subnets", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 1, 2],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [1, 2],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db3",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [2, 4, 5],
                multiplier: [
                    [0, 0, 1, 1, 2, 2],
                    [0, 0, 0, 2, 1, 0],
                    [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 10;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            // let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await displayAppData(nftID, subnetIDList, [app1, app3]);


            await ContractBasedDeployment.connect(subscriber).deleteApp(
                nftID,
                0,
            );


           await displayAppData(nftID, subnetIDList, [app3]);

           
        });

        it("delete app test", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 1, 2],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db3",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [2, 4, 5],
                multiplier: [
                    [0, 0, 1, 1, 2, 2],
                    [0, 0, 0, 2, 1, 0],
                    [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db4",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 10;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            // let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await displayAppData(nftID, subnetIDList, [app1, app3]);

            await ContractBasedDeployment.connect(subscriber).deleteApp(
                nftID,
                0,
            );

           await displayAppData(nftID, subnetIDList, [app3]);
 

           await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );

            await displayAppData(nftID, subnetIDList, [app3, app4]);

        });

        it("The xct given by subscriber is transferred to other accounts [r, s, t, u]", async () => {
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10];
            const subscriber = addrList[2];
            const referralAddress = addrList[3];
            const platformAddress = addrList[8];
            const licenseAddress = addrList[4];
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = [60000, 1];
            const platformPercent = 10000;
            const discountPercent = 5000;
            
            const clusterCount = 3;
            const clusterWeightList = [100, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30]; //30

            const estimateDripRate = async (appList) => {

                const {computeCost, subnetList, subnetResourceList} = getComputeCost(appList);
            
                console.log("computeCost: ", computeCost);

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    subnetList,
                    [
                        appList[0].licenseFee[0],
                        appList[1].licenseFee[1],
                        supportFee[0],
                        supportFee[1],
                        referralPercent,
                        platformPercent,
                        discountPercent,
                ],
                subnetResourceList
                );
            
                return dripRate;
                // return ethers.utils.parseEther("0");
            }
            

            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            //and min time for dripRate parameters for contract deployment
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    minTimeFunds: minTimeFunds,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0, 1, 2]
                subnetList: [0],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    // [1, 0, 0, 3, 1],
                    // [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    supportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [2, 4, 5],
                subnetList: [0],
                multiplier: [
                    [0, 0, 0, 0, 0, 0]
                    // [0, 0, 1, 1, 2, 2],
                    // [0, 0, 0, 2, 1, 0],
                    // [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5da1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    supportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            // deploy the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformPercent
                ,discountPercent
                ,referralPercent
                ,referralExpiry
            );


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress.address, supportFee);


            // creation of subnet
            // const subnetID = await createSubnet(subnetDAOAddress, {
            //     unitPrices: subnetComputePrices,
            //     // supportFeeRate: supportFee,
            //     stackFeesReqd: subnetFees,
            // });

            console.log("after creating subnet");

            const subnetIDList = []
            const subnetLen = 10;
            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(subnetDAOAddress, {
                    unitPrices: subnetComputePrices,
                    stackFeesReqd: subnetFees
                });

            // creation of clusters, and assigning weights to them
                for(var j = 0; j < clusterAddressList.length; j++) {
                    const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[j]);
                    clusterIDList[j] = clusterID;
                    await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[j]);
                }

                subnetIDList.push(subnetID);
            }


            console.log("after creating clusters");

            const getComputeCost = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                let subnetResourceList = [];
                let subnetList = [];
                const subnetMap = {};
                let subnetComputeCost = [];
                for(var i = 0; i < appList.length; i++)
                {
                    const app = appList[i];
                    let resourceArray = [];
                    for(var j = 0; j < app.subnetList.length; j++)
                    {
                        const subnetID = app.subnetList[j];
                        let listID;
                        if(subnetMap[subnetID] == undefined) {
                            subnetMap[subnetID] = subnetResourceList.length;
                            subnetList.push(subnetID);
                            subnetResourceList.push(new Array(5).fill(0));
                        }
                        listID = subnetMap[subnetID];
                        for(var k = 0; k < app.resourceArray.length; k++)
                        {
                            if(subnetResourceList[listID].length <= k)
                            {
                                subnetResourceList[listID].push(app.resourceArray[k]*app.multiplier[j][k]);
                            }
                            else {
                                subnetResourceList[listID][k] += app.resourceArray[k]*app.multiplier[j][k];
                            }
                        }
                    }
                }

                console.log("subnet resource: ", subnetResourceList, subnetMap, subnetList);

                for(var j = 0; j < subnetList.length; j++) {
 
                    const subnetID = subnetList[j];
                    listID = subnetMap[subnetID];
                    let subCost = ethers.utils.parseEther("0");

                    let minLen = Math.min(subnetResourceList[listID].length, subnetComputePrices.length);
                    for(var k = 0; k < minLen; k++) {

                        const multCost = subnetComputePrices[k].mul(subnetResourceList[listID][k]);
                        subCost = subCost.add(multCost);
                        // console.log('test ', j, k, multCost, subnetComputePrices[k], subnetResourceList[listID][k]);
                        computeCost = computeCost.add(multCost);
                    }

                    subnetComputeCost.push(subCost);
                }

                return {computeCost, subnetResourceList, subnetList, subnetComputeCost};
            }
            const calculateDripRate = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                computeCost = getComputeCost(appList).computeCost;

                let r1 = appList[0].licenseFee[0];
                let r2 = appList[0].licenseFee[1];
                let t1 = supportFee[0];
                let t2 = supportFee[1];
                let s = daoRate;
                // let t = supportFee;
                let u = referralPercent;
                let v = platformPercent;
                let w = -discountPercent;
                const factor = (100000 + r1 + s + t1 + u + v + w);
                console.log("fctor: ", factor);
                let drip = computeCost.mul(factor);

                drip = drip.div(100000);
                drip = drip.add(r2).add(t2);

                return drip;
            }
            // calulation of r,s,t,u

            //  350000000000011
            // 2450000000000011

            //calculated xct drip rate per sec
            // let calcXCTPerSec = calculateDripRate([app1, app4]);

            // 15400000000000022
            //  1400000000000011
            // get the estimated xct amount
            // let xctPerSec = await SubscriptionBalance
            // .estimateDripRatePerSec(
            //     [subnetID],
            //     [supportFee],
            //     [platformPercent],
            //     [referralPercent],
            //     [discountPercent],
            //     [licenseFee],
            //     [computeRequired]
            // );

            let xctPerSec = await estimateDripRate([app1, app4]);
            // xctPerSec = xctPerSec.add(await estimateDripRate(app4));

            // let xctPerSec = await SubscriptionBalance
            // .estimateDripRatePerSecOfSubnet(
            //     subnetID,
            //     [
            //     supportFee,
            //     platformPercent,
            //     referralPercent,
            //     discountPercent,
            //     licenseFee,
            //     ],
            //     computeRequired
            // );

            // 15400000000000022
            // 3500000000000011
            // console.log("check: ", xctPerSec, calcXCTPerSec);
            console.log("check: ", xctPerSec);
            // check if the calculated xct matches with the estimated xct from the contract
            // expect(xctPerSec.eq(calcXCTPerSec)).to.be.true;


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            // await getAmountIfLess(xct, subscriber, xctBalanceToAdd, Subscription);
            await getXCTAmount(subscriber, xctBalanceToAdd, SubscriptionBalance);



            const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE();
            await Subscription.grantRole(SUBSCRIBE_ROLE, subscriber.address);


            
            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await ContractBasedDeployment.connect(subscriber).createApp(
                xctBalanceToAdd,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );


            const subscribeTime = await time.latest();
            rec = await tr.wait();


            // await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;

            console.log("checking nft balance: ", await SubscriptionBalance.totalPrevBalance(nftID));

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("actual drip rate: ", actualDripRate, xctPerSec);
            expect(xctPerSec.eq(actualDripRate)).to.be.true;

            //calculate unsettled balances at several points of time
            let {computeCost, subnetComputeCost, subnetList: activeSubnetList} = getComputeCost([app1, app4]);
            
            for(var i = 0; i < durationTest.length; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i]; // + ((i==durationTest.length-1)? (60*60*24*48) : 0); //   60*60*24*1 + 60*60*12 + 60*36
                
                console.log("DURATION: ", durationTest[i]);

                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                // get the current balance balance from the contract
                const beforeUpdateTime = await time.latest();
                // await SubscriptionBalance.updateBalance(nftID);
                await ContractBasedDeployment.connect(subscriber).createApp(
                    0,
                    nftID,
                    app3.appName+(i + 5),
                    app3.digest,
                    app3.hashAndSize,
                    app3.subnetList,
                    app3.multiplier,
                    app3.resourceArray,
                    app3.cidLock
                );


                const afterUpdateTime = await time.latest();
                const afterUpdateDuration = afterUpdateTime - beforeUpdateTime;
                // const afterUpdateDuration = 0;

                //5322248800000000000000
                //1209602000000000000000
                console.log("updateTime:", afterUpdateDuration);
                // get the total balance from the contract after the updateBalance call
                let curBal = await SubscriptionBalance.totalPrevBalance(nftID);

                // calculate the current balance by using the calcXCTPerSec multiplied with the duration since last update call.
                //duration after updating/settling balance is added with the time taken by updateBalance call
                const durAfterSettle = Math.min(durationTest[i] + afterUpdateDuration, subscribeDuration);
                // calculate the duration since the last updateBalance call. Do not add the updateBalance call time if
                // the time point is at the end of subscription as that will be an extra amount of balance added in the calculation.
                const durSincePrev = durAfterSettle - prevDur - ((i>0)? afterUpdateDuration: 0);
                // calculate the balance that is supposed to be there after previous updateBalance calls.
                const calcCurBal = totalXCTAmount.sub(xctPerSec.mul(durAfterSettle));
                const computeDur = computeCost.mul(durSincePrev);

                //compare the calculated and the actual current balance
                console.log("curbal: ", curBal, calcCurBal);
                expect(curBal.eq(calcCurBal)).to.be.true;

                const nftRemCost = await SubscriptionBalance.nftAccumCost(nftID);
                console.log("accum cost: ", nftRemCost, computeDur, computeCost);
                

                await SubscriptionBalance.distributeRevenue(nftID);

                curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                expect(curBal.eq(calcCurBal)).to.be.true;


                // calculate the xct amount each account is supposed to get
                const calcBal1 = computeCost.mul(durSincePrev);
                let calcBalR   = computeCost.mul(app1.licenseFee[0]).mul(durSincePrev).div(100000);
                calcBalR = calcBalR.add(app1.licenseFee[1] * durSincePrev);
                const calcBalS = computeCost.mul(daoRate).mul(durSincePrev).div(100000);
                // const calcBalT = computeCost.mul(t).mul(durSincePrev).div(100000);
                let calcBalT = computeCost.mul(supportFee[0]).mul(durSincePrev).div(100000);
                calcBalT = calcBalT.add(supportFee[1] * durSincePrev);
                const calcBalU = computeCost.mul(referralPercent).mul(durSincePrev).div(100000);
                const calcBalV = computeCost.mul(platformPercent - discountPercent).mul(durSincePrev).div(100000);

                console.log("sub dist");
                // find out the amount that SubnetDAODistributor (1) gets
                // let beforeBal = await xct.balanceOf(SubnetDAODistributor.address);
                // await SubscriptionBalance.receiveRevenueForAddress(SubnetDAODistributor.address);
                // let afterBal = await xct.balanceOf(SubnetDAODistributor.address);
                // let bal1 = afterBal.sub(beforeBal);

                console.log("license");
                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(licenseAddress.address);
                afterBal = await xct.balanceOf(licenseAddress.address);
                const balR = afterBal.sub(beforeBal);

                console.log("dao addr");
                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                console.log("support");
                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
                afterBal = await xct.balanceOf(supportAddress.address);
                const balT = afterBal.sub(beforeBal);

                console.log("referral");
                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
                afterBal = await xct.balanceOf(referralAddress.address);
                const balU = afterBal.sub(beforeBal);

                beforeBal = await xct.balanceOf(platformAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(platformAddress.address);
                afterBal = await xct.balanceOf(platformAddress.address);
                const balV = afterBal.sub(beforeBal);
                // console.log("calc:" ,bal1, calcBal1);
                // console.log("actual:", bal1);
                // expect(bal1.eq(calcBal1)).to.be.true;
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                console.log("checking u:", balU, calcBalU, referralAddress.address);
                expect(balU.eq(calcBalU)).to.be.true;
                console.log("platform val:", balV, calcBalV);
                expect(balV.eq(calcBalV)).to.be.true;


                // Testing the distribution of revenue to the clusters
                // calculate the balances for each cluster
                let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
                for(var s = 0; s < activeSubnetList.length; s++)
                {
                    let subnetID = activeSubnetList[s];
                    console.log("subnetID: ", subnetID);
                    const subnetCost = subnetComputeCost[s].mul(durSincePrev);
                    await SubnetDAODistributor.assignRevenues(subnetID);
                    for(var c = 0; c < clusterCount; c++)
                    {
                        const calcClusterBal = subnetCost.mul(clusterWeightList[c]).div(totalClusterWeight); 
                        
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
    
                        // await SubnetDAODistributor.claimAllRevenueFor(clusterAddressList[c].address);
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
    
                        // console.log(calcClusterBal, clusterBal);
                        withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);
    
                        console.log("clusterBal: ", clusterBal, calcClusterBal);
                        expect(clusterBal.eq(calcClusterBal)).to.be.true;
                    }
                }


                // expect(withdrawnSubnetDAOAmount.eq(calcBal1)).to.be.true;
                // console.log("amount in subnetDAO, ", withdrawnSubnetDAOAmount, calcBal1);
                let subBalBalance = await xct.balanceOf(SubscriptionBalance.address);
                console.log("sub bal balance: ", subBalBalance);

                // 135234586956521739130
                // 259200000000000000018
            }

        })

        it("Cant create more than 255 apps for an NFT", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [255, 1, 1, 1, 1]
                ],
                resourceArray: [65535, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0],
                subnetList: [],
                multiplier: [
                    // [1, 1, 1, 1, 1],
                ],
                resourceArray: [65535, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );

            console.log("added platform address");

            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);
            console.log("minted NFT");

            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }
            console.log("created subnets");

            for(var j = 0; j < subnetLen; j++)
            {
                // app1.multiplier.push([1,1,1,1,1]);
                app3.multiplier.push([255,1,1,1,1]);

                // app1.subnetList.push(subnetIDList[j]);
                app3.subnetList.push(subnetIDList[j]);
            }
            console.log("app3 subnets created");

            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            console.log("estimate drip rate");

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            console.log("Get xct amount");

            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );
            console.log("subscribe and create app");

            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);

            for(var i = 0; i < 254; i++)
            {
                let suffix = '';
                if(i < 10)
                {
                    suffix = `00${i}`;
                }
                else if (i < 100)
                {
                    suffix = `0${i}`;
                }
                else {
                    suffix = `${i}`;
                }

                await ContractBasedDeployment.connect(subscriber).createApp(
                    0,
                    nftID,
                    app3.appName + suffix,
                    app3.digest,
                    app3.hashAndSize,
                    app3.subnetList,
                    app3.multiplier,
                    app3.resourceArray,
                    app3.cidLock
                );
            }
            console.log("254 craete app");

            await expect(ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName + `255`,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            )).to.be.reverted;
            console.log("create app");

        //    await displayAppData(nftID, subnetIDList, [app1, app3]);

        });
	
        it("Cant subscribe to more than 255 subnets", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0],
                subnetList: [],
                multiplier: [
                    // [1, 1, 1, 1, 1],
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );

            console.log("added platform address");

            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);
            console.log("minted NFT");

            const subnetIDList = [];
            const subnetLen = 255;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }
            console.log("created subnets");

            // for(var j = 0; j < subnetLen; j++)
            // {
            //     // app1.multiplier.push([1,1,1,1,1]);
            //     app3.multiplier.push([1,1,1,1,1]);

            //     // app1.subnetList.push(subnetIDList[j]);
            //     app3.subnetList.push(subnetIDList[j]);
            // }
            console.log("app3 subnets created");

            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            console.log("estimate drip rate");

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            console.log("Get xct amount");

            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );
            console.log("subscribe and create app");

            
            for(var i = 0; i < 2; i++)
            {
                app3.multiplier.push([1,1,1,1,1])
            }
            let subnetList = []

            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);

            let subList1 = [];
            let subList2 = [];
            let subList3 = [];
            let mult1 = [];
            let mult2 = [];
            let mult3 = [];
            for(var i = 1; i < 100; i++)
            {
                subList1.push(i);
                mult1.push([1,1,1,1,1])
            }
            for(var i = 100; i < 200; i++)
            {
                subList2.push(i);
                mult2.push([1,1,1,1,1])
            }
            for(var i = 200; i < 254; i++)
            {
                subList3.push(i);
                mult3.push([1,1,1,1,1])
            }

                await ContractBasedDeployment.connect(subscriber).createApp(
                    0,
                    nftID,
                    app3.appName + '001',
                    app3.digest,
                    app3.hashAndSize,
                    // app3.subnetList,
                    subList1,
                    mult1,
                    app3.resourceArray,
                    app3.cidLock
                );

                await ContractBasedDeployment.connect(subscriber).createApp(
                    0,
                    nftID,
                    app3.appName + '002',
                    app3.digest,
                    app3.hashAndSize,
                    // app3.subnetList,
                    subList2,
                    mult2,
                    app3.resourceArray,
                    app3.cidLock
                );

                await ContractBasedDeployment.connect(subscriber).createApp(
                    0,
                    nftID,
                    app3.appName + '003',
                    app3.digest,
                    app3.hashAndSize,
                    // app3.subnetList,
                    subList3,
                    mult3,
                    app3.resourceArray,
                    app3.cidLock
                );
            // for(var i = 1; i < 127; i++)
            // {
            //     let suffix = '';
            //     if(i < 10)
            //     {
            //         suffix = `00${i}`;
            //     }
            //     else if (i < 100)
            //     {
            //         suffix = `0${i}`;
            //     }
            //     else {
            //         suffix = `${i}`;
            //     }
            //     subnetList = [i, 128 + i]

            //     console.log("running i: ", i);

            //     await ContractBasedDeployment.connect(subscriber).createApp(
            //         0,
            //         nftID,
            //         app3.appName + suffix,
            //         app3.digest,
            //         app3.hashAndSize,
            //         // app3.subnetList,
            //         subnetList,
            //         app3.multiplier,
            //         app3.resourceArray,
            //         app3.cidLock
            //     );
            // }
            console.log("254 craete app");

            await expect(ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName + `255`,
                app3.digest,
                app3.hashAndSize,
                // app3.subnetList,
                [255],
                [[1,1,1,1,1]],
                // app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            )).to.be.revertedWith("max active subnets reached");
            console.log("create app");

        //    await displayAppData(nftID, subnetIDList, [app1, app3]);

        });

        it("Update balance test: app is created and then updated", async () => {
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10];
            const subscriber = addrList[2];
            const referralAddress = addrList[3];
            const platformAddress = addrList[8];
            const licenseAddress = addrList[4];
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = [60000, 1];
            const platformPercent = 10000;
            const discountPercent = 5000;
            
            const clusterCount = 3;
            const clusterWeightList = [100, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30]; //30

            const estimateDripRate = async (appList) => {

                const {computeCost, subnetList, subnetResourceList} = getComputeCost(appList);
            
                console.log("computeCost: ", computeCost);

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    subnetList,
                    [
                        appList[0].licenseFee[0],
                        appList[1].licenseFee[1],
                        supportFee[0],
                        supportFee[1],
                        referralPercent,
                        platformPercent,
                        discountPercent,
                ],
                subnetResourceList
                );
            
                return dripRate;
                // return ethers.utils.parseEther("0");
            }
            

            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            //and min time for dripRate parameters for contract deployment
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    minTimeFunds: minTimeFunds,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0, 1, 2]
                subnetList: [0, 1],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    // [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    supportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [2, 4, 5],
                subnetList: [0, 3],
                multiplier: [
                    // [0, 0, 0, 0, 0, 0]
                    [0, 0, 1, 1, 2, 2],
                    [0, 2, 0, 2, 1, 0],
                    // [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5da1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    supportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            // deploy the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformPercent
                ,discountPercent
                ,referralPercent
                ,referralExpiry
            );


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress.address, supportFee);


            // creation of subnet
            // const subnetID = await createSubnet(subnetDAOAddress, {
            //     unitPrices: subnetComputePrices,
            //     // supportFeeRate: supportFee,
            //     stackFeesReqd: subnetFees,
            // });

            console.log("after creating subnet");

            const subnetIDList = []
            const subnetLen = 10;
            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(subnetDAOAddress, {
                    unitPrices: subnetComputePrices,
                    stackFeesReqd: subnetFees
                });

            // creation of clusters, and assigning weights to them
                for(var j = 0; j < clusterAddressList.length; j++) {
                    const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[j]);
                    clusterIDList[j] = clusterID;
                    await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[j]);
                }

                subnetIDList.push(subnetID);
            }


            console.log("after creating clusters");

            const getComputeCost = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                let subnetResourceList = [];
                let subnetList = [];
                const subnetMap = {};
                let subnetComputeCost = [];
                for(var i = 0; i < appList.length; i++)
                {
                    const app = appList[i];
                    let resourceArray = [];
                    for(var j = 0; j < app.subnetList.length; j++)
                    {
                        const subnetID = app.subnetList[j];
                        let listID;
                        if(subnetMap[subnetID] == undefined) {
                            subnetMap[subnetID] = subnetResourceList.length;
                            subnetList.push(subnetID);
                            subnetResourceList.push(new Array(5).fill(0));
                        }
                        listID = subnetMap[subnetID];
                        for(var k = 0; k < app.resourceArray.length; k++)
                        {
                            let val = app.resourceArray[k];
                            if(k < app.multiplier[j].length)
                            {
                                val *= app.multiplier[j][k];
                            }
                            else {
                                val = 0;
                            }
                            if(subnetResourceList[listID].length <= k)
                            {
                                subnetResourceList[listID].push(val);
                            }
                            else {
                                subnetResourceList[listID][k] += val;
                            }
                        }
                    }
                }

                console.log("subnet resource: ", subnetResourceList, subnetMap, subnetList);

                for(var j = 0; j < subnetList.length; j++) {
 
                    const subnetID = subnetList[j];
                    listID = subnetMap[subnetID];
                    let subCost = ethers.utils.parseEther("0");

                    let minLen = Math.min(subnetResourceList[listID].length, subnetComputePrices.length);
                    for(var k = 0; k < minLen; k++) {

                        const multCost = subnetComputePrices[k].mul(subnetResourceList[listID][k]);
                        subCost = subCost.add(multCost);
                        // console.log('test ', j, k, multCost, subnetComputePrices[k], subnetResourceList[listID][k]);
                        computeCost = computeCost.add(multCost);
                    }

                    subnetComputeCost.push(subCost);
                }

                return {computeCost, subnetResourceList, subnetList, subnetComputeCost};
            }
            const calculateDripRate = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                computeCost = getComputeCost(appList).computeCost;

                let r1 = appList[0].licenseFee[0];
                let r2 = appList[0].licenseFee[1];
                let t1 = supportFee[0];
                let t2 = supportFee[1];
                let s = daoRate;
                // let t = supportFee;
                let u = referralPercent;
                let v = platformPercent;
                let w = -discountPercent;
                const factor = (100000 + r1 + s + t1 + u + v + w);
                console.log("fctor: ", factor);
                let drip = computeCost.mul(factor);

                drip = drip.div(100000);
                drip = drip.add(r2).add(t2);

                return drip;
            }
            // calulation of r,s,t,u

            //  350000000000011
            // 2450000000000011

            //calculated xct drip rate per sec
            // let calcXCTPerSec = calculateDripRate([app1, app4]);

            // 15400000000000022
            //  1400000000000011
            // get the estimated xct amount
            // let xctPerSec = await SubscriptionBalance
            // .estimateDripRatePerSec(
            //     [subnetID],
            //     [supportFee],
            //     [platformPercent],
            //     [referralPercent],
            //     [discountPercent],
            //     [licenseFee],
            //     [computeRequired]
            // );

            let xctPerSec = await estimateDripRate([app1, app4]);
            // xctPerSec = xctPerSec.add(await estimateDripRate(app4));

            // let xctPerSec = await SubscriptionBalance
            // .estimateDripRatePerSecOfSubnet(
            //     subnetID,
            //     [
            //     supportFee,
            //     platformPercent,
            //     referralPercent,
            //     discountPercent,
            //     licenseFee,
            //     ],
            //     computeRequired
            // );

            // 15400000000000022
            // 3500000000000011
            // console.log("check: ", xctPerSec, calcXCTPerSec);
            console.log("check: ", xctPerSec);
            // check if the calculated xct matches with the estimated xct from the contract
            // expect(xctPerSec.eq(calcXCTPerSec)).to.be.true;


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            // await getAmountIfLess(xct, subscriber, xctBalanceToAdd, Subscription);
            await getXCTAmount(subscriber, xctBalanceToAdd, SubscriptionBalance);



            const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE();
            await Subscription.grantRole(SUBSCRIBE_ROLE, subscriber.address);


            
            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await ContractBasedDeployment.connect(subscriber).createApp(
                xctBalanceToAdd,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );


            const subscribeTime = await time.latest();
            rec = await tr.wait();


            // await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;

            console.log("checking nft balance: ", await SubscriptionBalance.totalPrevBalance(nftID));

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("actual drip rate: ", actualDripRate, xctPerSec);
            expect(xctPerSec.eq(actualDripRate)).to.be.true;


            const verifyRevenue = async (nftID, duration, appList, totalXCTAmount) => {

                const app1 = appList[0];
                let {computeCost, subnetComputeCost, subnetList: activeSubnetList, subnetResourceList} = getComputeCost(appList);

                const xctPerSec = await estimateDripRate(appList);


                let curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                const durSincePrev = Math.min(duration, subscribeDuration);

                const xctSpent = xctPerSec.mul(durSincePrev);
                const calcCurBal = totalXCTAmount.sub(xctSpent);
                const computeDur = computeCost.mul(durSincePrev);

                console.log("curbal: ", curBal, calcCurBal, xctSpent);
                expect(curBal.eq(calcCurBal)).to.be.true;

    

                const nftRemCost = await SubscriptionBalance.nftAccumCost(nftID);
                console.log("accum cost: ", nftRemCost, computeDur, computeCost);


                curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                expect(curBal.eq(calcCurBal)).to.be.true;

                const calcBal1 = computeCost.mul(durSincePrev);
                let calcBalR   = computeCost.mul(app1.licenseFee[0]).mul(durSincePrev).div(100000);
                calcBalR = calcBalR.add(app1.licenseFee[1] * durSincePrev);
                const calcBalS = computeCost.mul(daoRate).mul(durSincePrev).div(100000);
                let calcBalT = computeCost.mul(supportFee[0]).mul(durSincePrev).div(100000);
                calcBalT = calcBalT.add(supportFee[1] * durSincePrev);
                const calcBalU = computeCost.mul(referralPercent).mul(durSincePrev).div(100000);
                const calcBalV = computeCost.mul(platformPercent - discountPercent).mul(durSincePrev).div(100000);


                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(licenseAddress.address);
                afterBal = await xct.balanceOf(licenseAddress.address);
                const balR = afterBal.sub(beforeBal);

                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
                afterBal = await xct.balanceOf(supportAddress.address);
                const balT = afterBal.sub(beforeBal);

                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
                afterBal = await xct.balanceOf(referralAddress.address);
                const balU = afterBal.sub(beforeBal);

                beforeBal = await xct.balanceOf(platformAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(platformAddress.address);
                afterBal = await xct.balanceOf(platformAddress.address);
                const balV = afterBal.sub(beforeBal);
            
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                expect(balU.eq(calcBalU)).to.be.true;
                expect(balV.eq(calcBalV)).to.be.true;

                let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
                for(var s = 0; s < activeSubnetList.length; s++)
                {
                    let subnetID = activeSubnetList[s];
                    const subnetCost = subnetComputeCost[s].mul(durSincePrev);
                    await SubnetDAODistributor.assignRevenues(subnetID);
                    for(var c = 0; c < clusterCount; c++)
                    {
                        const calcClusterBal = subnetCost.mul(clusterWeightList[c]).div(totalClusterWeight); 
                        
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
    
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
    
                        withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);

                        expect(clusterBal.eq(calcClusterBal)).to.be.true;
                    }
                }

                let subBalBalance = await xct.balanceOf(SubscriptionBalance.address);
                console.log("sub bal balance: ", subBalBalance);

                return curBal;
            }

            for(var i = 0; i < 1; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i]; // + ((i==durationTest.length-1)? (60*60*24*48) : 0); //   60*60*24*1 + 60*60*12 + 60*36
                
                console.log("DURATION: ", durationTest[i]);

                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                // let beforeUpdateTime = await time.latest();
                // await SubscriptionBalance.updateBalance(nftID);
                // let afterUpdateTime = await time.latest();
                // let updateDuration = afterUpdateTime - beforeUpdateTime;
                beforeUpdateTime = await time.latest();
                await ContractBasedDeployment.connect(subscriber).updateApp(
                    0,
                    nftID,
                    0,
                    app1.digest,
                    app1.hashAndSize,
                    // app1.subnetList,
                    [3],
                    // app1.multiplier,
                    [[0, 2, 5, 2, 1, 1]],
                    // app1.resourceArray
                    [0, 3, 0, 4, 1, 4]
                );
                afterUpdateTime = await time.latest();

                updateDuration = afterUpdateTime - beforeUpdateTime;
                await SubscriptionBalance.distributeRevenue(nftID);
                
                let currentBalance = await verifyRevenue(nftID, durationTest[i] + updateDuration, [app1, app4], totalXCTAmount);

                app1.subnetList.push(3);
                app1.multiplier.push([0, 2, 5, 2, 1, 1]);
                app1.resourceArray = [0, 3, 0, 4, 1, 4];

                // await displayAppData(nftID, subnetIDList, [app1, app4]);
                // get the current balance balance from the contract
                // await SubscriptionBalance.updateBalance(nftID);
                // await ContractBasedDeployment.connect(subscriber).createApp(
                //     0,
                //     nftID,
                //     app3.appName+(i + 5),
                //     app3.digest,
                //     app3.hashAndSize,
                //     app3.subnetList,
                //     app3.multiplier,
                //     app3.resourceArray,
                //     app3.cidLock
                // );
                // let multiplier = [[0, 0, 1, 1, 2, 2], [0, 2, 5, 2, 1, 1]]
                // [0, 0, 0, 2, 1, 0],
                // [0, 0, 4, 2, 1, 1]
                // let resourceArray = [0, 3, 0, 4, 1, 4];
                // let subnetList = [0, 3];

                // app1.subnetList.push(3);
                // app1.multiplier.push([0, 2, 5, 2, 1, 1]);
                // app3.multiplier = multiplier;
                // app3.resourceArray = resourceArray;
                // app3.subnetList = subnetList;

                // 3674156325000014255989
                // 6985440000000020908800

                await time.increaseTo(subscribeTime + durationTest[1]);

                beforeUpdateTime = await time.latest();
                await SubscriptionBalance.updateBalance(nftID);
                afterUpdateTime = await time.latest();
                updateDuration = afterUpdateTime - beforeUpdateTime;

                // await SubscriptionBalance.distributeRevenue(nftID);

                await verifyRevenue(nftID, durationTest[1] - durationTest[0], [app1, app4], currentBalance);

            }

        })

        it("Update balance test: app is created and then deleted", async () => {
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10];
            const subscriber = addrList[2];
            const referralAddress = addrList[3];
            const platformAddress = addrList[8];
            const licenseAddress = addrList[4];
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = [60000, 1];
            const platformPercent = 10000;
            const discountPercent = 5000;
            
            const clusterCount = 3;
            const clusterWeightList = [100, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30]; //30

            const estimateDripRate = async (appList) => {

                const {computeCost, subnetList, subnetResourceList} = getComputeCost(appList);
            
                console.log("computeCost: ", computeCost);

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    subnetList,
                    [
                        appList[0].licenseFee[0],
                        appList[0].licenseFee[1],
                        supportFee[0],
                        supportFee[1],
                        referralPercent,
                        platformPercent,
                        discountPercent,
                ],
                subnetResourceList
                );
            
                return dripRate;
                // return ethers.utils.parseEther("0");
            }
            

            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            //and min time for dripRate parameters for contract deployment
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    minTimeFunds: minTimeFunds,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0, 1, 2]
                subnetList: [0, 1],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    // [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [2, 4, 5],
                subnetList: [0, 3],
                multiplier: [
                    // [0, 0, 0, 0, 0, 0]
                    [0, 0, 1, 1, 2, 2],
                    [0, 2, 0, 2, 1, 0],
                    // [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5da1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            // deploy the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformPercent
                ,discountPercent
                ,referralPercent
                ,referralExpiry
            );


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress.address, supportFee);


            // creation of subnet
            // const subnetID = await createSubnet(subnetDAOAddress, {
            //     unitPrices: subnetComputePrices,
            //     // supportFeeRate: supportFee,
            //     stackFeesReqd: subnetFees,
            // });

            console.log("after creating subnet");

            const subnetIDList = []
            const subnetLen = 10;
            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(subnetDAOAddress, {
                    unitPrices: subnetComputePrices,
                    stackFeesReqd: subnetFees
                });

            // creation of clusters, and assigning weights to them
                for(var j = 0; j < clusterAddressList.length; j++) {
                    const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[j]);
                    clusterIDList[j] = clusterID;
                    await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[j]);
                }

                subnetIDList.push(subnetID);
            }


            console.log("after creating clusters");

            const getComputeCost = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                let subnetResourceList = [];
                let subnetList = [];
                const subnetMap = {};
                let subnetComputeCost = [];
                for(var i = 0; i < appList.length; i++)
                {
                    const app = appList[i];
                    let resourceArray = [];
                    for(var j = 0; j < app.subnetList.length; j++)
                    {
                        const subnetID = app.subnetList[j];
                        let listID;
                        if(subnetMap[subnetID] == undefined) {
                            subnetMap[subnetID] = subnetResourceList.length;
                            subnetList.push(subnetID);
                            subnetResourceList.push(new Array(5).fill(0));
                        }
                        listID = subnetMap[subnetID];
                        for(var k = 0; k < app.resourceArray.length; k++)
                        {
                            let val = app.resourceArray[k];
                            if(k < app.multiplier[j].length)
                            {
                                val *= app.multiplier[j][k];
                            }
                            else {
                                val = 0;
                            }
                            if(subnetResourceList[listID].length <= k)
                            {
                                subnetResourceList[listID].push(val);
                            }
                            else {
                                subnetResourceList[listID][k] += val;
                            }
                        }
                    }
                }

                console.log("subnet resource: ", subnetResourceList, subnetMap, subnetList);

                for(var j = 0; j < subnetList.length; j++) {
 
                    const subnetID = subnetList[j];
                    listID = subnetMap[subnetID];
                    let subCost = ethers.utils.parseEther("0");

                    let minLen = Math.min(subnetResourceList[listID].length, subnetComputePrices.length);
                    for(var k = 0; k < minLen; k++) {

                        const multCost = subnetComputePrices[k].mul(subnetResourceList[listID][k]);
                        subCost = subCost.add(multCost);
                        // console.log('test ', j, k, multCost, subnetComputePrices[k], subnetResourceList[listID][k]);
                        computeCost = computeCost.add(multCost);
                    }

                    subnetComputeCost.push(subCost);
                }

                return {computeCost, subnetResourceList, subnetList, subnetComputeCost};
            }
            const calculateDripRate = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                computeCost = getComputeCost(appList).computeCost;

                let r1 = appList[0].licenseFee[0];
                let r2 = appList[0].licenseFee[1];
                let t1 = supportFee[0];
                let t2 = supportFee[1];
                let s = daoRate;
                // let t = supportFee;
                let u = referralPercent;
                let v = platformPercent;
                let w = -discountPercent;
                const factor = (100000 + r1 + s + t1 + u + v + w);
                console.log("fctor: ", factor);
                let drip = computeCost.mul(factor);

                drip = drip.div(100000);
                drip = drip.add(r2).add(t2);

                return drip;
            }
            // calulation of r,s,t,u

            //  350000000000011
            // 2450000000000011

            //calculated xct drip rate per sec
            // let calcXCTPerSec = calculateDripRate([app1, app4]);

            // 15400000000000022
            //  1400000000000011
            // get the estimated xct amount
            // let xctPerSec = await SubscriptionBalance
            // .estimateDripRatePerSec(
            //     [subnetID],
            //     [supportFee],
            //     [platformPercent],
            //     [referralPercent],
            //     [discountPercent],
            //     [licenseFee],
            //     [computeRequired]
            // );

            let xctPerSec = await estimateDripRate([app1, app4]);
            // xctPerSec = xctPerSec.add(await estimateDripRate(app4));

            // let xctPerSec = await SubscriptionBalance
            // .estimateDripRatePerSecOfSubnet(
            //     subnetID,
            //     [
            //     supportFee,
            //     platformPercent,
            //     referralPercent,
            //     discountPercent,
            //     licenseFee,
            //     ],
            //     computeRequired
            // );

            // 15400000000000022
            // 3500000000000011
            // console.log("check: ", xctPerSec, calcXCTPerSec);
            console.log("check: ", xctPerSec);
            // check if the calculated xct matches with the estimated xct from the contract
            // expect(xctPerSec.eq(calcXCTPerSec)).to.be.true;


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            // await getAmountIfLess(xct, subscriber, xctBalanceToAdd, Subscription);
            await getXCTAmount(subscriber, xctBalanceToAdd, SubscriptionBalance);



            const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE();
            await Subscription.grantRole(SUBSCRIBE_ROLE, subscriber.address);


            
            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await ContractBasedDeployment.connect(subscriber).createApp(
                xctBalanceToAdd,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );


            const subscribeTime = await time.latest();
            rec = await tr.wait();


            // await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;

            console.log("checking nft balance: ", await SubscriptionBalance.totalPrevBalance(nftID));

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("actual drip rate: ", actualDripRate, xctPerSec);
            expect(xctPerSec.eq(actualDripRate)).to.be.true;


            const verifyRevenue = async (nftID, duration, appList, totalXCTAmount) => {

                const app1 = appList[0];
                let {computeCost, subnetComputeCost, subnetList: activeSubnetList, subnetResourceList} = getComputeCost(appList);

                const xctPerSec = await estimateDripRate(appList);


                let curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                const durSincePrev = Math.min(duration, subscribeDuration);

                const xctSpent = xctPerSec.mul(durSincePrev);
                const calcCurBal = totalXCTAmount.sub(xctSpent);
                const computeDur = computeCost.mul(durSincePrev);

                console.log("curbal: ", curBal, calcCurBal, xctSpent);
                expect(curBal.eq(calcCurBal)).to.be.true;

    

                const nftRemCost = await SubscriptionBalance.nftAccumCost(nftID);
                console.log("accum cost: ", nftRemCost, computeDur, computeCost);


                curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                expect(curBal.eq(calcCurBal)).to.be.true;

                const calcBal1 = computeCost.mul(durSincePrev);
                let calcBalR   = computeCost.mul(app1.licenseFee[0]).mul(durSincePrev).div(100000);
                calcBalR = calcBalR.add(app1.licenseFee[1] * durSincePrev);
                const calcBalS = computeCost.mul(daoRate).mul(durSincePrev).div(100000);
                let calcBalT = computeCost.mul(supportFee[0]).mul(durSincePrev).div(100000);
                calcBalT = calcBalT.add(supportFee[1] * durSincePrev);
                const calcBalU = computeCost.mul(referralPercent).mul(durSincePrev).div(100000);
                const calcBalV = computeCost.mul(platformPercent - discountPercent).mul(durSincePrev).div(100000);


                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(licenseAddress.address);
                afterBal = await xct.balanceOf(licenseAddress.address);
                const balR = afterBal.sub(beforeBal);

                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
                afterBal = await xct.balanceOf(supportAddress.address);
                const balT = afterBal.sub(beforeBal);

                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
                afterBal = await xct.balanceOf(referralAddress.address);
                const balU = afterBal.sub(beforeBal);

                beforeBal = await xct.balanceOf(platformAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(platformAddress.address);
                afterBal = await xct.balanceOf(platformAddress.address);
                const balV = afterBal.sub(beforeBal);
            
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                expect(balU.eq(calcBalU)).to.be.true;
                expect(balV.eq(calcBalV)).to.be.true;

                let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
                for(var s = 0; s < activeSubnetList.length; s++)
                {
                    let subnetID = activeSubnetList[s];
                    const subnetCost = subnetComputeCost[s].mul(durSincePrev);
                    await SubnetDAODistributor.assignRevenues(subnetID);
                    for(var c = 0; c < clusterCount; c++)
                    {
                        const calcClusterBal = subnetCost.mul(clusterWeightList[c]).div(totalClusterWeight); 
                        
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
    
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
    
                        withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);

                        expect(clusterBal.eq(calcClusterBal)).to.be.true;
                    }
                }

                let subBalBalance = await xct.balanceOf(SubscriptionBalance.address);
                console.log("sub bal balance: ", subBalBalance);

                return curBal;
            }

            for(var i = 0; i < 1; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i]; // + ((i==durationTest.length-1)? (60*60*24*48) : 0); //   60*60*24*1 + 60*60*12 + 60*36
                
                console.log("DURATION: ", durationTest[i]);

                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                // let beforeUpdateTime = await time.latest();
                // await SubscriptionBalance.updateBalance(nftID);
                // let afterUpdateTime = await time.latest();
                // let updateDuration = afterUpdateTime - beforeUpdateTime;
                beforeUpdateTime = await time.latest();
                // await ContractBasedDeployment.connect(subscriber).updateApp(
                //     0,
                //     nftID,
                //     0,
                //     app1.digest,
                //     app1.hashAndSize,
                //     // app1.subnetList,
                //     [3],
                //     // app1.multiplier,
                //     [[0, 2, 5, 2, 1, 1]],
                //     // app1.resourceArray
                //     [0, 3, 0, 4, 1, 4]
                // );

                await ContractBasedDeployment.connect(subscriber).deleteApp(nftID, 0);

                afterUpdateTime = await time.latest();

                updateDuration = afterUpdateTime - beforeUpdateTime;
                await SubscriptionBalance.distributeRevenue(nftID);
                
                let currentBalance = await verifyRevenue(nftID, durationTest[i] + updateDuration, [app1, app4], totalXCTAmount);

                // app1.subnetList.push(3);
                // app1.multiplier.push([0, 2, 5, 2, 1, 1]);
                // app1.resourceArray = [0, 3, 0, 4, 1, 4];

                // await displayAppData(nftID, subnetIDList, [app1, app4]);
                // get the current balance balance from the contract
                // await SubscriptionBalance.updateBalance(nftID);
                // await ContractBasedDeployment.connect(subscriber).createApp(
                //     0,
                //     nftID,
                //     app3.appName+(i + 5),
                //     app3.digest,
                //     app3.hashAndSize,
                //     app3.subnetList,
                //     app3.multiplier,
                //     app3.resourceArray,
                //     app3.cidLock
                // );
                // let multiplier = [[0, 0, 1, 1, 2, 2], [0, 2, 5, 2, 1, 1]]
                // [0, 0, 0, 2, 1, 0],
                // [0, 0, 4, 2, 1, 1]
                // let resourceArray = [0, 3, 0, 4, 1, 4];
                // let subnetList = [0, 3];

                // app1.subnetList.push(3);
                // app1.multiplier.push([0, 2, 5, 2, 1, 1]);
                // app3.multiplier = multiplier;
                // app3.resourceArray = resourceArray;
                // app3.subnetList = subnetList;

                // 3674156325000014255989
                // 6985440000000020908800

                await time.increaseTo(subscribeTime + durationTest[1]);

                beforeUpdateTime = await time.latest();
                await SubscriptionBalance.updateBalance(nftID);
                afterUpdateTime = await time.latest();
                updateDuration = afterUpdateTime - beforeUpdateTime;

                // await SubscriptionBalance.distributeRevenue(nftID);

                await verifyRevenue(nftID, durationTest[1] - durationTest[0], [app4], currentBalance);

            }

        })

        it("delist cluster revenue check", async () => {
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10];
            const subscriber = addrList[2];
            const referralAddress = addrList[3];
            const platformAddress = addrList[8];
            const licenseAddress = addrList[4];
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = [60000, 1];
            const platformPercent = 10000;
            const discountPercent = 5000;
            
            const clusterCount = 3;
            const clusterWeightList = [100, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30]; //30

            const estimateDripRate = async (appList) => {

                const {computeCost, subnetList, subnetResourceList} = getComputeCost(appList);
            
                console.log("computeCost: ", computeCost);

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    subnetList,
                    [
                        appList[0].licenseFee[0],
                        appList[0].licenseFee[1],
                        supportFee[0],
                        supportFee[1],
                        referralPercent,
                        platformPercent,
                        discountPercent,
                ],
                subnetResourceList
                );
            
                return dripRate;
                // return ethers.utils.parseEther("0");
            }
            

            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            //and min time for dripRate parameters for contract deployment
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    minTimeFunds: minTimeFunds,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0, 1, 2]
                subnetList: [0, 1],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    // [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [2, 4, 5],
                subnetList: [0, 3],
                multiplier: [
                    // [0, 0, 0, 0, 0, 0]
                    [0, 0, 1, 1, 2, 2],
                    [0, 2, 0, 2, 1, 0],
                    // [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5da1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            // deploy the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformPercent
                ,discountPercent
                ,referralPercent
                ,referralExpiry
            );


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress.address, supportFee);

            const subnetIDList = []
            const subnetLen = 10;
            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(subnetDAOAddress, {
                    unitPrices: subnetComputePrices,
                    stackFeesReqd: subnetFees
                });

            // creation of clusters, and assigning weights to them
                for(var j = 0; j < clusterAddressList.length; j++) {
                    const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[j]);
                    clusterIDList[j] = clusterID;
                    await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[j]);
                }

                subnetIDList.push(subnetID);
            }


            console.log("after creating clusters");

            const getComputeCost = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                let subnetResourceList = [];
                let subnetList = [];
                const subnetMap = {};
                let subnetComputeCost = [];
                for(var i = 0; i < appList.length; i++)
                {
                    const app = appList[i];
                    let resourceArray = [];
                    for(var j = 0; j < app.subnetList.length; j++)
                    {
                        const subnetID = app.subnetList[j];
                        let listID;
                        if(subnetMap[subnetID] == undefined) {
                            subnetMap[subnetID] = subnetResourceList.length;
                            subnetList.push(subnetID);
                            subnetResourceList.push(new Array(5).fill(0));
                        }
                        listID = subnetMap[subnetID];
                        for(var k = 0; k < app.resourceArray.length; k++)
                        {
                            let val = app.resourceArray[k];
                            if(k < app.multiplier[j].length)
                            {
                                val *= app.multiplier[j][k];
                            }
                            else {
                                val = 0;
                            }
                            if(subnetResourceList[listID].length <= k)
                            {
                                subnetResourceList[listID].push(val);
                            }
                            else {
                                subnetResourceList[listID][k] += val;
                            }
                        }
                    }
                }

                console.log("subnet resource: ", subnetResourceList, subnetMap, subnetList);

                for(var j = 0; j < subnetList.length; j++) {
 
                    const subnetID = subnetList[j];
                    listID = subnetMap[subnetID];
                    let subCost = ethers.utils.parseEther("0");

                    let minLen = Math.min(subnetResourceList[listID].length, subnetComputePrices.length);
                    for(var k = 0; k < minLen; k++) {

                        const multCost = subnetComputePrices[k].mul(subnetResourceList[listID][k]);
                        subCost = subCost.add(multCost);
                        // console.log('test ', j, k, multCost, subnetComputePrices[k], subnetResourceList[listID][k]);
                        computeCost = computeCost.add(multCost);
                    }

                    subnetComputeCost.push(subCost);
                }

                return {computeCost, subnetResourceList, subnetList, subnetComputeCost};
            }
            const calculateDripRate = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                computeCost = getComputeCost(appList).computeCost;

                let r1 = appList[0].licenseFee[0];
                let r2 = appList[0].licenseFee[1];
                let t1 = supportFee[0];
                let t2 = supportFee[1];
                let s = daoRate;
                // let t = supportFee;
                let u = referralPercent;
                let v = platformPercent;
                let w = -discountPercent;
                const factor = (100000 + r1 + s + t1 + u + v + w);
                console.log("fctor: ", factor);
                let drip = computeCost.mul(factor);

                drip = drip.div(100000);
                drip = drip.add(r2).add(t2);

                return drip;
            }
            // calulation of r,s,t,u

            let xctPerSec = await estimateDripRate([app1, app4]);

            console.log("check: ", xctPerSec);
            // check if the calculated xct matches with the estimated xct from the contract


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            await getXCTAmount(subscriber, xctBalanceToAdd, SubscriptionBalance);



            const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE();
            await Subscription.grantRole(SUBSCRIBE_ROLE, subscriber.address);


            
            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await ContractBasedDeployment.connect(subscriber).createApp(
                xctBalanceToAdd,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );


            const subscribeTime = await time.latest();
            rec = await tr.wait();


            // await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;

            console.log("checking nft balance: ", await SubscriptionBalance.totalPrevBalance(nftID));

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("actual drip rate: ", actualDripRate, xctPerSec);
            expect(xctPerSec.eq(actualDripRate)).to.be.true;


            const verifyRevenue = async (nftID, duration, appList, totalXCTAmount, clusterWeightList, isDelist) => {

                const app1 = appList[0];
                let {computeCost, subnetComputeCost, subnetList: activeSubnetList, subnetResourceList} = getComputeCost(appList);

                const xctPerSec = await estimateDripRate(appList);


                let curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                const durSincePrev = Math.min(duration, subscribeDuration);

                const xctSpent = xctPerSec.mul(durSincePrev);
                const calcCurBal = totalXCTAmount.sub(xctSpent);
                const computeDur = computeCost.mul(durSincePrev);

                console.log("curbal: ", curBal, calcCurBal, xctSpent);
                expect(curBal.eq(calcCurBal)).to.be.true;

    

                const nftRemCost = await SubscriptionBalance.nftAccumCost(nftID);
                console.log("accum cost: ", nftRemCost, computeDur, computeCost);


                curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                expect(curBal.eq(calcCurBal)).to.be.true;

                const calcBal1 = computeCost.mul(durSincePrev);
                let calcBalR   = computeCost.mul(app1.licenseFee[0]).mul(durSincePrev).div(100000);
                calcBalR = calcBalR.add(app1.licenseFee[1] * durSincePrev);
                const calcBalS = computeCost.mul(daoRate).mul(durSincePrev).div(100000);
                let calcBalT = computeCost.mul(supportFee[0]).mul(durSincePrev).div(100000);
                calcBalT = calcBalT.add(supportFee[1] * durSincePrev);
                const calcBalU = computeCost.mul(referralPercent).mul(durSincePrev).div(100000);
                const calcBalV = computeCost.mul(platformPercent - discountPercent).mul(durSincePrev).div(100000);


                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(licenseAddress.address);
                afterBal = await xct.balanceOf(licenseAddress.address);
                const balR = afterBal.sub(beforeBal);

                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
                afterBal = await xct.balanceOf(supportAddress.address);
                const balT = afterBal.sub(beforeBal);

                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
                afterBal = await xct.balanceOf(referralAddress.address);
                const balU = afterBal.sub(beforeBal);

                beforeBal = await xct.balanceOf(platformAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(platformAddress.address);
                afterBal = await xct.balanceOf(platformAddress.address);
                const balV = afterBal.sub(beforeBal);
            
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                expect(balU.eq(calcBalU)).to.be.true;
                expect(balV.eq(calcBalV)).to.be.true;

                let totalClusterWeight = 0;
                for(var i = 0; i < clusterWeightList.length; i++)
                {
                    totalClusterWeight += clusterWeightList[i];
                }

                let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
                for(var s = 0; s < activeSubnetList.length; s++)
                {
                    let subnetID = activeSubnetList[s];
                    const subnetCost = subnetComputeCost[s].mul(durSincePrev);
                    
                    if(isDelist) {
                        await Registration.delistCluster(subnetID, 0);
                        console.log("delisting cluster");
                    }

                    else {
                        let c = 0;
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);   
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
                        console.log("rev of cluster before assign: ", clusterBal);
                        await SubnetDAODistributor.assignRevenues(subnetID);
                        console.log("assign Revenues");
                    }
                       

                    for(var c = 0; c < clusterCount; c++)
                    {
                        const calcClusterBal = subnetCost.mul(clusterWeightList[c]).div(totalClusterWeight); 
                    
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);   
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
    
                        withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);
                    
                        console.log("cluster rev: ", subnetID, c, clusterBal, calcClusterBal);
                        expect(clusterBal.eq(calcClusterBal)).to.be.true;
                    }
                }

                let subBalBalance = await xct.balanceOf(SubscriptionBalance.address);
                console.log("sub bal balance: ", subBalBalance);

                return curBal;
            }

            for(var i = 0; i < 1; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i];
                
                console.log("DURATION: ", durationTest[i]);

                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                beforeUpdateTime = await time.latest();


                await ContractBasedDeployment.connect(subscriber).deleteApp(nftID, 0);

                afterUpdateTime = await time.latest();

                updateDuration = afterUpdateTime - beforeUpdateTime;
                await SubscriptionBalance.distributeRevenue(nftID);
                
                let currentBalance = await verifyRevenue(nftID, durationTest[i] + updateDuration, [app1, app4], totalXCTAmount, clusterWeightList, true);
                await time.increaseTo(subscribeTime + durationTest[1]);

                await SubscriptionBalance.updateBalance(nftID);

                clusterWeightList[0] = 0;

                await verifyRevenue(nftID, durationTest[1] - durationTest[0], [app4], currentBalance, clusterWeightList);

            }

        })

        it("enlist cluster revenue check", async () => {
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10];
            const subscriber = addrList[2];
            const referralAddress = addrList[3];
            const platformAddress = addrList[8];
            const licenseAddress = addrList[4];
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = [60000, 1];
            const platformPercent = 10000;
            const discountPercent = 5000;
            
            const clusterCount = 3;
            const clusterWeightList = [0, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30]; //30

            const estimateDripRate = async (appList) => {

                const {computeCost, subnetList, subnetResourceList} = getComputeCost(appList);
            
                console.log("computeCost: ", computeCost);

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    subnetList,
                    [
                        appList[0].licenseFee[0],
                        appList[0].licenseFee[1],
                        supportFee[0],
                        supportFee[1],
                        referralPercent,
                        platformPercent,
                        discountPercent,
                ],
                subnetResourceList
                );
            
                return dripRate;
                // return ethers.utils.parseEther("0");
            }
            

            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            //and min time for dripRate parameters for contract deployment
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    minTimeFunds: minTimeFunds,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0, 1, 2]
                subnetList: [0, 1],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    // [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [2, 4, 5],
                subnetList: [0, 3],
                multiplier: [
                    // [0, 0, 0, 0, 0, 0]
                    [0, 0, 1, 1, 2, 2],
                    [0, 2, 0, 2, 1, 0],
                    // [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5da1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            // deploy the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformPercent
                ,discountPercent
                ,referralPercent
                ,referralExpiry
            );


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress.address, supportFee);

            const subnetIDList = []
            const subnetLen = 10;
            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(subnetDAOAddress, {
                    unitPrices: subnetComputePrices,
                    stackFeesReqd: subnetFees
                });

            // creation of clusters, and assigning weights to them
                for(var j = 0; j < clusterAddressList.length; j++) {
                    const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[j]);
                    clusterIDList[j] = clusterID;
                    if(j != 0)
                        await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[j]);
                }

                subnetIDList.push(subnetID);
            }


            console.log("after creating clusters");

            const getComputeCost = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                let subnetResourceList = [];
                let subnetList = [];
                const subnetMap = {};
                let subnetComputeCost = [];
                for(var i = 0; i < appList.length; i++)
                {
                    const app = appList[i];
                    let resourceArray = [];
                    for(var j = 0; j < app.subnetList.length; j++)
                    {
                        const subnetID = app.subnetList[j];
                        let listID;
                        if(subnetMap[subnetID] == undefined) {
                            subnetMap[subnetID] = subnetResourceList.length;
                            subnetList.push(subnetID);
                            subnetResourceList.push(new Array(5).fill(0));
                        }
                        listID = subnetMap[subnetID];
                        for(var k = 0; k < app.resourceArray.length; k++)
                        {
                            let val = app.resourceArray[k];
                            if(k < app.multiplier[j].length)
                            {
                                val *= app.multiplier[j][k];
                            }
                            else {
                                val = 0;
                            }
                            if(subnetResourceList[listID].length <= k)
                            {
                                subnetResourceList[listID].push(val);
                            }
                            else {
                                subnetResourceList[listID][k] += val;
                            }
                        }
                    }
                }

                console.log("subnet resource: ", subnetResourceList, subnetMap, subnetList);

                for(var j = 0; j < subnetList.length; j++) {
 
                    const subnetID = subnetList[j];
                    listID = subnetMap[subnetID];
                    let subCost = ethers.utils.parseEther("0");

                    let minLen = Math.min(subnetResourceList[listID].length, subnetComputePrices.length);
                    for(var k = 0; k < minLen; k++) {

                        const multCost = subnetComputePrices[k].mul(subnetResourceList[listID][k]);
                        subCost = subCost.add(multCost);
                        // console.log('test ', j, k, multCost, subnetComputePrices[k], subnetResourceList[listID][k]);
                        computeCost = computeCost.add(multCost);
                    }

                    subnetComputeCost.push(subCost);
                }

                return {computeCost, subnetResourceList, subnetList, subnetComputeCost};
            }
            const calculateDripRate = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                computeCost = getComputeCost(appList).computeCost;

                let r1 = appList[0].licenseFee[0];
                let r2 = appList[0].licenseFee[1];
                let t1 = supportFee[0];
                let t2 = supportFee[1];
                let s = daoRate;
                // let t = supportFee;
                let u = referralPercent;
                let v = platformPercent;
                let w = -discountPercent;
                const factor = (100000 + r1 + s + t1 + u + v + w);
                console.log("fctor: ", factor);
                let drip = computeCost.mul(factor);

                drip = drip.div(100000);
                drip = drip.add(r2).add(t2);

                return drip;
            }
            // calulation of r,s,t,u

            let xctPerSec = await estimateDripRate([app1, app4]);

            console.log("check: ", xctPerSec);
            // check if the calculated xct matches with the estimated xct from the contract


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            await getXCTAmount(subscriber, xctBalanceToAdd, SubscriptionBalance);



            const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE();
            await Subscription.grantRole(SUBSCRIBE_ROLE, subscriber.address);


            
            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await ContractBasedDeployment.connect(subscriber).createApp(
                xctBalanceToAdd,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );


            const subscribeTime = await time.latest();
            rec = await tr.wait();


            // await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;

            console.log("checking nft balance: ", await SubscriptionBalance.totalPrevBalance(nftID));

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("actual drip rate: ", actualDripRate, xctPerSec);
            expect(xctPerSec.eq(actualDripRate)).to.be.true;


            const verifyRevenue = async (nftID, duration, appList, totalXCTAmount, clusterWeightList, isDelist ,isList) => {

                const app1 = appList[0];
                let {computeCost, subnetComputeCost, subnetList: activeSubnetList, subnetResourceList} = getComputeCost(appList);

                const xctPerSec = await estimateDripRate(appList);


                let curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                const durSincePrev = Math.min(duration, subscribeDuration);

                const xctSpent = xctPerSec.mul(durSincePrev);
                const calcCurBal = totalXCTAmount.sub(xctSpent);
                const computeDur = computeCost.mul(durSincePrev);

                console.log("curbal: ", curBal, calcCurBal, xctSpent);
                expect(curBal.eq(calcCurBal)).to.be.true;

    

                const nftRemCost = await SubscriptionBalance.nftAccumCost(nftID);
                console.log("accum cost: ", nftRemCost, computeDur, computeCost);


                curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                expect(curBal.eq(calcCurBal)).to.be.true;

                const calcBal1 = computeCost.mul(durSincePrev);
                let calcBalR   = computeCost.mul(app1.licenseFee[0]).mul(durSincePrev).div(100000);
                calcBalR = calcBalR.add(app1.licenseFee[1] * durSincePrev);
                const calcBalS = computeCost.mul(daoRate).mul(durSincePrev).div(100000);
                let calcBalT = computeCost.mul(supportFee[0]).mul(durSincePrev).div(100000);
                calcBalT = calcBalT.add(supportFee[1] * durSincePrev);
                const calcBalU = computeCost.mul(referralPercent).mul(durSincePrev).div(100000);
                const calcBalV = computeCost.mul(platformPercent - discountPercent).mul(durSincePrev).div(100000);


                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(licenseAddress.address);
                afterBal = await xct.balanceOf(licenseAddress.address);
                const balR = afterBal.sub(beforeBal);

                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
                afterBal = await xct.balanceOf(supportAddress.address);
                const balT = afterBal.sub(beforeBal);

                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
                afterBal = await xct.balanceOf(referralAddress.address);
                const balU = afterBal.sub(beforeBal);

                beforeBal = await xct.balanceOf(platformAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(platformAddress.address);
                afterBal = await xct.balanceOf(platformAddress.address);
                const balV = afterBal.sub(beforeBal);
            
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                expect(balU.eq(calcBalU)).to.be.true;
                expect(balV.eq(calcBalV)).to.be.true;

                let totalClusterWeight = 0;
                for(var i = 0; i < clusterWeightList.length; i++)
                {
                    totalClusterWeight += clusterWeightList[i];
                }

                let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
                for(var s = 0; s < activeSubnetList.length; s++)
                {
                    let subnetID = activeSubnetList[s];
                    const subnetCost = subnetComputeCost[s].mul(durSincePrev);
                    
                    if(isDelist) {
                        await Registration.delistCluster(subnetID, 0);
                        console.log("delisting cluster");
                    }
                    else if (isList)
                    {
                        await Registration.approveListingCluster(subnetID, 0, 100);
                        console.log("listing cluster");
                    }

                    else {
                        let c = 0;
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);   
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
                        console.log("rev of cluster before assign: ", clusterBal);
                        await SubnetDAODistributor.assignRevenues(subnetID);
                        console.log("assign Revenues");
                    }
                       

                    for(var c = 0; c < clusterCount; c++)
                    {
                        const calcClusterBal = subnetCost.mul(clusterWeightList[c]).div(totalClusterWeight); 
                    
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);   
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
    
                        withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);
                    
                        console.log("cluster rev: ", subnetID, c, clusterBal, calcClusterBal);
                        expect(clusterBal.eq(calcClusterBal)).to.be.true;
                    }
                }

                let subBalBalance = await xct.balanceOf(SubscriptionBalance.address);
                console.log("sub bal balance: ", subBalBalance);

                return curBal;
            }

            for(var i = 0; i < 1; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i];
                
                console.log("DURATION: ", durationTest[i]);

                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                beforeUpdateTime = await time.latest();


                await ContractBasedDeployment.connect(subscriber).deleteApp(nftID, 0);

                afterUpdateTime = await time.latest();

                updateDuration = afterUpdateTime - beforeUpdateTime;
                await SubscriptionBalance.distributeRevenue(nftID);
                
                
                let currentBalance = await verifyRevenue(nftID, durationTest[i] + updateDuration, [app1, app4], totalXCTAmount, clusterWeightList, false, true);
                await time.increaseTo(subscribeTime + durationTest[1]);

                await SubscriptionBalance.updateBalance(nftID);

                clusterWeightList[0] = 100;

                await verifyRevenue(nftID, durationTest[1] - durationTest[0], [app4], currentBalance, clusterWeightList);

            }

        })

        it("create app with max resource and replica values", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [255, 1, 1, 1, 1]
                ],
                resourceArray: [65535, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [255, 255, 255, 255, 255],
                ],
                resourceArray: [65535, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            // for(var j = 0; j < subnetLen; j++)
            // {
            //     app1.multiplier.push([1,1,1,1,1]);
            //     app3.multiplier.push([1,1,1,1,1]);

            //     app1.subnetList.push(subnetIDList[j]);
            //     app3.subnetList.push(subnetIDList[j]);
            // }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            await ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

        //    await displayAppData(nftID, subnetIDList, [app1, app3]);
        await displayAppData(nftID, subnetIDList, [app1, app3]);
        });

        it("cluster signup cluster revenue check", async () => {
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10];
            const subscriber = addrList[2];
            const referralAddress = addrList[3];
            const platformAddress = addrList[8];
            const licenseAddress = addrList[4];
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const lastCluster = addrList[10];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = [60000, 1];
            const platformPercent = 10000;
            const discountPercent = 5000;
            
            let clusterCount = 3;
            const clusterWeightList = [100, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30]; //30

            const estimateDripRate = async (appList) => {

                const {computeCost, subnetList, subnetResourceList} = getComputeCost(appList);
            
                console.log("computeCost: ", computeCost);

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    subnetList,
                    [
                        appList[0].licenseFee[0],
                        appList[0].licenseFee[1],
                        supportFee[0],
                        supportFee[1],
                        referralPercent,
                        platformPercent,
                        discountPercent,
                ],
                subnetResourceList
                );
            
                return dripRate;
                // return ethers.utils.parseEther("0");
            }
            

            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            //and min time for dripRate parameters for contract deployment
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    minTimeFunds: minTimeFunds,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [0, 1, 2]
                subnetList: [0, 1],
                multiplier: [
                    [2, 0, 0, 1, 1],
                    [1, 0, 0, 3, 1],
                    // [3, 0, 0, 0, 1],
                ],
                resourceArray: [1, 0, 0, 1, 3],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                // subnetList: [2, 4, 5],
                subnetList: [0, 3],
                multiplier: [
                    // [0, 0, 0, 0, 0, 0]
                    [0, 0, 1, 1, 2, 2],
                    [0, 2, 0, 2, 1, 0],
                    // [0, 0, 4, 2, 1, 1]
                ],
                resourceArray: [0, 3, 0, 4, 1, 4],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5da1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0, 6, 7],
                multiplier: [
                    [2, 0, 0, 0, 1],
                    [3, 0, 0, 2, 1],
                    [1, 2, 3, 2, 1]
                ],
                resourceArray: [3, 0, 0, 4, 1],
                cidLock: false,
            };

            // deploy the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformPercent
                ,discountPercent
                ,referralPercent
                ,referralExpiry
            );


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress.address, supportFee);

            const subnetIDList = []
            const subnetLen = 10;
            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(subnetDAOAddress, {
                    unitPrices: subnetComputePrices,
                    stackFeesReqd: subnetFees,
                    whiteListedClusters: [lastCluster.address],
                });

            // creation of clusters, and assigning weights to them
                for(var j = 0; j < clusterAddressList.length; j++) {
                    const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[j]);
                    clusterIDList[j] = clusterID;
                    await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[j]);
                }

                subnetIDList.push(subnetID);
            }


            console.log("after creating clusters");

            const getComputeCost = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                let subnetResourceList = [];
                let subnetList = [];
                const subnetMap = {};
                let subnetComputeCost = [];
                for(var i = 0; i < appList.length; i++)
                {
                    const app = appList[i];
                    let resourceArray = [];
                    for(var j = 0; j < app.subnetList.length; j++)
                    {
                        const subnetID = app.subnetList[j];
                        let listID;
                        if(subnetMap[subnetID] == undefined) {
                            subnetMap[subnetID] = subnetResourceList.length;
                            subnetList.push(subnetID);
                            subnetResourceList.push(new Array(5).fill(0));
                        }
                        listID = subnetMap[subnetID];
                        for(var k = 0; k < app.resourceArray.length; k++)
                        {
                            let val = app.resourceArray[k];
                            if(k < app.multiplier[j].length)
                            {
                                val *= app.multiplier[j][k];
                            }
                            else {
                                val = 0;
                            }
                            if(subnetResourceList[listID].length <= k)
                            {
                                subnetResourceList[listID].push(val);
                            }
                            else {
                                subnetResourceList[listID][k] += val;
                            }
                        }
                    }
                }

                console.log("subnet resource: ", subnetResourceList, subnetMap, subnetList);

                for(var j = 0; j < subnetList.length; j++) {
 
                    const subnetID = subnetList[j];
                    listID = subnetMap[subnetID];
                    let subCost = ethers.utils.parseEther("0");

                    let minLen = Math.min(subnetResourceList[listID].length, subnetComputePrices.length);
                    for(var k = 0; k < minLen; k++) {

                        const multCost = subnetComputePrices[k].mul(subnetResourceList[listID][k]);
                        subCost = subCost.add(multCost);
                        // console.log('test ', j, k, multCost, subnetComputePrices[k], subnetResourceList[listID][k]);
                        computeCost = computeCost.add(multCost);
                    }

                    subnetComputeCost.push(subCost);
                }

                return {computeCost, subnetResourceList, subnetList, subnetComputeCost};
            }
            const calculateDripRate = (appList) => {
                let computeCost = ethers.utils.parseEther("0");
                computeCost = getComputeCost(appList).computeCost;

                let r1 = appList[0].licenseFee[0];
                let r2 = appList[0].licenseFee[1];
                let t1 = supportFee[0];
                let t2 = supportFee[1];
                let s = daoRate;
                // let t = supportFee;
                let u = referralPercent;
                let v = platformPercent;
                let w = -discountPercent;
                const factor = (100000 + r1 + s + t1 + u + v + w);
                console.log("fctor: ", factor);
                let drip = computeCost.mul(factor);

                drip = drip.div(100000);
                drip = drip.add(r2).add(t2);

                return drip;
            }
            // calulation of r,s,t,u

            let xctPerSec = await estimateDripRate([app1, app4]);

            console.log("check: ", xctPerSec);
            // check if the calculated xct matches with the estimated xct from the contract


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            await getXCTAmount(subscriber, xctBalanceToAdd, SubscriptionBalance);



            const SUBSCRIBE_ROLE = await Subscription.SUBSCRIBE_ROLE();
            await Subscription.grantRole(SUBSCRIBE_ROLE, subscriber.address);


            
            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await ContractBasedDeployment.connect(subscriber).createApp(
                xctBalanceToAdd,
                nftID,
                app4.appName,
                app4.digest,
                app4.hashAndSize,
                app4.subnetList,
                app4.multiplier,
                app4.resourceArray,
                app4.cidLock
            );


            const subscribeTime = await time.latest();
            rec = await tr.wait();


            // await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;

            console.log("checking nft balance: ", await SubscriptionBalance.totalPrevBalance(nftID));

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("actual drip rate: ", actualDripRate, xctPerSec);
            expect(xctPerSec.eq(actualDripRate)).to.be.true;


            const verifyRevenue = async (nftID, duration, appList, totalXCTAmount, clusterWeightList, createCluster) => {

                const app1 = appList[0];
                let {computeCost, subnetComputeCost, subnetList: activeSubnetList, subnetResourceList} = getComputeCost(appList);

                const xctPerSec = await estimateDripRate(appList);


                let curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                const durSincePrev = Math.min(duration, subscribeDuration);

                const xctSpent = xctPerSec.mul(durSincePrev);
                const calcCurBal = totalXCTAmount.sub(xctSpent);
                const computeDur = computeCost.mul(durSincePrev);

                console.log("curbal: ", curBal, calcCurBal, xctSpent);
                expect(curBal.eq(calcCurBal)).to.be.true;


                const nftRemCost = await SubscriptionBalance.nftAccumCost(nftID);
                console.log("accum cost: ", nftRemCost, computeDur, computeCost);


                curBal = await SubscriptionBalance.totalPrevBalance(nftID);
                expect(curBal.eq(calcCurBal)).to.be.true;

                const calcBal1 = computeCost.mul(durSincePrev);
                let calcBalR   = computeCost.mul(app1.licenseFee[0]).mul(durSincePrev).div(100000);
                calcBalR = calcBalR.add(app1.licenseFee[1] * durSincePrev);
                const calcBalS = computeCost.mul(daoRate).mul(durSincePrev).div(100000);
                let calcBalT = computeCost.mul(supportFee[0]).mul(durSincePrev).div(100000);
                calcBalT = calcBalT.add(supportFee[1] * durSincePrev);
                const calcBalU = computeCost.mul(referralPercent).mul(durSincePrev).div(100000);
                const calcBalV = computeCost.mul(platformPercent - discountPercent).mul(durSincePrev).div(100000);


                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(licenseAddress.address);
                afterBal = await xct.balanceOf(licenseAddress.address);
                const balR = afterBal.sub(beforeBal);

                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
                afterBal = await xct.balanceOf(supportAddress.address);
                const balT = afterBal.sub(beforeBal);

                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
                afterBal = await xct.balanceOf(referralAddress.address);
                const balU = afterBal.sub(beforeBal);

                beforeBal = await xct.balanceOf(platformAddress.address);
                await SubscriptionBalance.receiveRevenueForAddress(platformAddress.address);
                afterBal = await xct.balanceOf(platformAddress.address);
                const balV = afterBal.sub(beforeBal);
            
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                expect(balU.eq(calcBalU)).to.be.true;
                expect(balV.eq(calcBalV)).to.be.true;

                let totalClusterWeight = 0;
                for(var i = 0; i < clusterWeightList.length; i++)
                {
                    totalClusterWeight += clusterWeightList[i];
                }

                let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
                for(var s = 0; s < activeSubnetList.length; s++)
                {
                    let subnetID = activeSubnetList[s];
                    const subnetCost = subnetComputeCost[s].mul(durSincePrev);
                    
                    if(createCluster) {
                        // await Registration.delistCluster(subnetID, 0);
                        const clusterID = await signupCluster(subnetID, subnetFees, lastCluster);
                        console.log("delisting cluster: ", clusterID);
                    }
                    else {
                        await SubnetDAODistributor.assignRevenues(subnetID);
                        console.log("assign Revenues");
                    }
                       

                    for(var c = 0; c < clusterCount; c++)
                    {
                        const calcClusterBal = subnetCost.mul(clusterWeightList[c]).div(totalClusterWeight); 
                    
                        const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);   
                        await SubscriptionBalance.receiveRevenueForAddress(clusterAddressList[c].address);
                        const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                        const clusterBal = afterClusterSupply.sub(beforeClusterSupply);
    
                        withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);
                    
                        console.log("cluster rev: ", subnetID, c, clusterBal, calcClusterBal);
                        expect(clusterBal.eq(calcClusterBal)).to.be.true;
                    }
                }

                let subBalBalance = await xct.balanceOf(SubscriptionBalance.address);
                console.log("sub bal balance: ", subBalBalance);

                return curBal;
            }

            for(var i = 0; i < 1; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i];
                
                console.log("DURATION: ", durationTest[i]);

                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                beforeUpdateTime = await time.latest();


                await ContractBasedDeployment.connect(subscriber).deleteApp(nftID, 0);

                afterUpdateTime = await time.latest();

                updateDuration = afterUpdateTime - beforeUpdateTime;
                await SubscriptionBalance.distributeRevenue(nftID);
                
                
                let currentBalance = await verifyRevenue(nftID, durationTest[i] + updateDuration, [app1, app4], totalXCTAmount, clusterWeightList, true);
                await time.increaseTo(subscribeTime + durationTest[1]);

                await SubscriptionBalance.updateBalance(nftID);

                // clusterWeightList[0] = 100;
                clusterWeightList.push(20);
                clusterAddressList.push(lastCluster);
                clusterCount = 4;

                await verifyRevenue(nftID, durationTest[1] - durationTest[0], [app4], currentBalance, clusterWeightList);

            }

        })

        it("createAppBatch call", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5001",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };
            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5002",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };
            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5003",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };
            let app5 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5004",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };
            let app6 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5005",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            // for(var j = 0; j < subnetLen; j++)
            // {
            //     app1.multiplier.push([1,1,1,1,1]);
            //     app3.multiplier.push([1,1,1,1,1]);

            //     app1.subnetList.push(subnetIDList[j]);
            //     app3.subnetList.push(subnetIDList[j]);
            // }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);

            await expect(
            ContractBasedDeployment.connect(subscriber).createApp(
                0,
                nftID,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )    
            ).to.be.reverted;

            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let afterBal = await await ethers.provider.getBalance(subscriber.address);
            afterBal = beforeBal.sub(afterBal);


            // uint256 balanceToAdd,
            // uint256 nftID,
            // bytes32[] memory appName,
            // bytes32[] memory digest,
            // uint8[2][] memory hashAndSize,
            // uint256[][] memory subnetList,
            // uint8[][][] memory multiplier,
            // uint16[][] memory resourceArray,
            // bool[] memory cidLock

            await ContractBasedDeployment.connect(subscriber).createAppBatch(
                0,
                nftID,
                [app2.appName, app3.appName, app4.appName, app5.appName, app6.appName],
                [app2.digest, app3.digest, app4.digest, app5.digest, app6.digest],
                [app2.hashAndSize, app3.hashAndSize, app4.hashAndSize, app5.hashAndSize, app6.hashAndSize],
                [app2.subnetList, app3.subnetList, app4.subnetList, app5.subnetList, app6.subnetList],
                [app2.multiplier, app3.multiplier, app4.multiplier, app5.multiplier, app6.multiplier],
                [app2.resourceArray, app3.resourceArray, app4.resourceArray, app5.resourceArray, app6.resourceArray],
                [app2.cidLock, app3.cidLock, app4.cidLock, app5.cidLock, app6.cidLock],
            );


           await displayAppData(nftID, subnetIDList, [app1, app2, app3, app4, app5, app6]);

        });

        it("expenditure gets deducted in order from the credit, external and the nft amounts", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            const creditExpiry = 60 * 60 * 24 * 100;
            const creditDepositor = addrList[6];
            const externalDepositor = addrList[7];
            const nftDepositor = subscriber;
            let creditAmount = ethers.utils.parseEther("0");
            let externalAmount = ethers.utils.parseEther("0");
            let nftAmount = ethers.utils.parseEther("0");
            const creditDuration = 500;
            const externalDuration = 400;
            const nftDuration = 300;
            const computeRequired = [1,2,3];

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];
            const daoRate = 5000;
            const referralExpiry = 60 * 60 * 24 * 4;

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
            }

            // setting the contract constructor parameters
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralFee,
                    referralRevExpirySecs: referralExpiry,
                }
            });

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            //deploying the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );

            // create a subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });

            
            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            // estimate the amount of xct that needs to be withdrawn
            // const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            const dripRate = await estimateDripRate(app1);

            // Subscribing to the created subnet
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );
            rec = await tr.wait();

            const actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("drip rate compare: ", actualDripRate, dripRate);
            expect(actualDripRate.eq(dripRate)).to.be.true;

            // check if subscription balance is empty
            let balance = await SubscriptionBalance.totalPrevBalance(nftID);
            expect(balance.eq(0)).to.be.true;

            
            // calculate the amounts to deposit by multiplying the drip rate with the deposit duration
            creditAmount = dripRate.mul(creditDuration);
            externalAmount = dripRate.mul(externalDuration);
            nftAmount = dripRate.mul(nftDuration);


            // add amount to credit depositor if depositor's balance is less
            // await getAmountIfLess(creditDepositor, creditAmount, SubscriptionBalance);
            await getXCTAmount(creditDepositor, creditAmount, SubscriptionBalance);

            
            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(creditDepositor).addBalanceAsCredit(creditDepositor.address, nftID, creditAmount, creditExpiry);
            const creditDepositTime = await time.latest();


            // check if the subscription balance has the right credit amount
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(creditAmount)).to.be.true;

            // add amount to external depositor if depositor's balance is less
            // await getAmountIfLess(externalDepositor, externalAmount, SubscriptionBalance);
            await getXCTAmount(externalDepositor, externalAmount, SubscriptionBalance);


            // add external deposit
            await SubscriptionBalance.connect(externalDepositor).addBalanceAsExternalDeposit(externalDepositor.address, nftID, externalAmount);


            // check if the external amount is the same as the deposited amount.
            //The credit amount will be slightly deducted due to the time taken by contract calls
            balance = await SubscriptionBalance.prevBalances(nftID);
            // expect(balance[0].eq(creditAmount.sub(dripRate.mul(externalDepositTime - creditDepositTime)))).to.be.true;
            expect(balance[1].eq(externalAmount)).to.be.true;


            // send xct to subscriber if not enough xct is in the balance
            // await getAmountIfLess(nftDepositor, nftAmount, SubscriptionBalance);
            await getXCTAmount(nftDepositor, nftAmount, SubscriptionBalance);



            //add the nft balance
            await SubscriptionBalance.connect(nftDepositor).addBalance(nftDepositor.address, nftID,  nftAmount);


            //check if the nft amount is correctly added.
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[1].eq(externalAmount)).to.be.true;
            expect(balance[2].eq(nftAmount)).to.be.true;

            console.log("balance: ", balance);

            // increase the time to half the credit duration
            await time.increaseTo(creditDepositTime + creditDuration/2);

            //update the balance for expenditures
            await SubscriptionBalance.updateBalance(nftID);
            
            //calculate the half credit amount, get the actual amounts, and compare if the credit amount is deducted
            // and other amounts remain the same
            const calcHalfCreditAmount = creditAmount.sub(dripRate.mul(await time.latest() - creditDepositTime));
            balance = await SubscriptionBalance.prevBalances(nftID);
            console.log("balance compare: ", balance, calcHalfCreditAmount);
            expect(balance[0].eq(calcHalfCreditAmount)).to.be.true;
            expect(balance[1].eq(externalAmount)).to.be.true;
            expect(balance[2].eq(nftAmount)).to.be.true;

            // 182220000000002739
            // 189000000000002750

            // increase the time to the end of credit duration
            await time.increaseTo(creditDepositTime + creditDuration);


            // update the balance for expenditure deduction
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            
            //get the expected expenditure
            let expenditure = dripRate.mul(afterUpdateTime - creditDepositTime);

            // get the actual balances. the credit amount should be exhausted.
            // the external amount is now being used, and is slightly deducted due to the time taken
            // after the credit duration by the updateBalance contract call
            let calcExternalAmount = externalAmount.sub(expenditure.sub(creditAmount));
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(0)).to.be.true;
            expect(balance[1].eq(calcExternalAmount)).to.be.true;
            expect(balance[2].eq(nftAmount)).to.be.true;


            // increase the time to the half the duration of external amount
            await time.increaseTo(creditDepositTime + creditDuration + externalDuration/2);

            //update the balance for expenditure deduction
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();

            // calculate how much amount is deducted from the external amount.
            // get the actual balance, and see that credit amount remains zero,
            // the calculated external amount is same as the actual external amount and
            // the nft amount is not deducted
            const calcHalfExternalAmount = externalAmount.sub(dripRate.mul(afterUpdateTime - (creditDepositTime + creditDuration)));
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(0)).to.be.true;
            expect(balance[1].eq(calcHalfExternalAmount)).to.be.true;
            expect(balance[2].eq(nftAmount)).to.be.true;



            // increase the time to the end of external duration
            await time.increaseTo(creditDepositTime + creditDuration + externalDuration);

            // update the balance for expenditure deduction
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            
            // calculate the expected expenditure of the external amount since
            // the credit amount has been exhausted.
            expenditure = dripRate.mul(afterUpdateTime - (creditDepositTime + creditDuration));

            // get the actual balances. Now the credit amount and the external
            // amounts are zero. The nft amount is slightly deducted from the initial
            // value as the is time taken by the updateBalance call after
            //the end of external duration
            let calcNFTAmount = nftAmount.sub(expenditure.sub(externalAmount));
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(0)).to.be.true;
            expect(balance[1].eq(0)).to.be.true;
            expect(balance[2].eq(calcNFTAmount)).to.be.true;


            // increase the time till the half nft duration time
            await time.increaseTo(creditDepositTime + creditDuration + externalDuration + nftDuration/2);

            // update the balances for expenditure deduction
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();

            // calculate the expected nft amount after half nft duration. Get the
            // balances. the credit and external amounts remain zero, and the 
            // actual nft amount should match the expected nft amount
            const calcHalfNFTAmount = nftAmount.sub(dripRate.mul(afterUpdateTime - (creditDepositTime + creditDuration + externalDuration)));
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(0)).to.be.true;
            expect(balance[1].eq(0)).to.be.true;
            expect(balance[2].eq(calcHalfNFTAmount)).to.be.true;


            // increase the time to the end of nft duration
            await time.increaseTo(creditDepositTime + creditDuration + externalDuration + nftDuration);

            // update the balance for expenditure deduction
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            
            // get the actual balances. Now all the amounts are zero.
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(0)).to.be.true;
            expect(balance[1].eq(0)).to.be.true;
            expect(balance[2].eq(0)).to.be.true;
        })
		
        it("Credit balance can be deposited by anyone, but can be withdrawn after the expiry date set by the depositor", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            const creditExpiry = 60 * 60 * 24 * 100;
            const creditDepositor = addrList[6];
            const depositor = addrList[7];
            const nftDepositor = subscriber;
            let creditAmount = ethers.utils.parseEther("0");
            let externalAmount = ethers.utils.parseEther("0");
            let nftAmount = ethers.utils.parseEther("0");
            const creditDuration = 500;
            const externalDuration = 400;
            const nftDuration = 300;
            const computeRequired = [1,2,3];
            const subscribeDuration = 420;
            const expiryDuration = 60 * 60 * 24 * 10;

            const dep1DripDur = 60 * 60 * 24 * 10;
            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];
            const daoRate = 5000;
            const referralExpiry = 60 * 60 * 24 * 4;

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
            }


            // setting the contract constructor parameters
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralFee,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };


            //deploying the contracts
            await initContracts();


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );


            // create a subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            // estimate the amount of xct that needs to be withdrawn

            const dripRate = await estimateDripRate(app1);
            xctAmount = dripRate.mul(subscribeDuration);


            // send xct to subscriber if not enough xct is in the balance
            await getXCTAmount(creditDepositor, creditAmount, SubscriptionBalance);


            // Subscribing to the created subnet
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );
            rec = await tr.wait();
            
            let actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("drip rate compare: ", actualDripRate, dripRate);
            expect(actualDripRate.eq(dripRate)).to.be.true;
            
            // calculate the amount to deposit by multiplying the drip rate with the deposit duration
            depositBalance = dripRate.mul(dep1DripDur);
            

            // add amount to depositor if depositor's balance is less
            // await getAmountIfLess(depositor, depositBalance, SubscriptionBalance);
            await getXCTAmount(depositor, depositBalance, SubscriptionBalance);

            // calculate the time of expiry
            const expiryTime = await time.latest() + expiryDuration;


            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor).addBalanceAsCredit(depositor.address, nftID, depositBalance, expiryTime);


            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            let balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(depositBalance)).to.be.true;


            // increase the time to the half expiry duration after depositing the balance
            const addBalanceTime = await time.latest();
            let timeToSet = addBalanceTime + expiryDuration/2;
            await time.increaseTo(timeToSet);


            // update balance to settle the expenditure 
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            
            // calculate the balance after half expiry time, get the balance from the contract, and check if they are equal
            // we also add the duration taken by calling updateBalance into the drip calculation
            let calcHalfExpiryBal = depositBalance.sub(dripRate.mul(afterUpdateTime - addBalanceTime));
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(calcHalfExpiryBal)).to.be.true;


            // calling withdraw will get reverted because its not expiry time yet
            await expect(SubscriptionBalance.connect(depositor).withdrawCreditsForNFT(depositor.address, nftID, deployer.address))
            .to.be.revertedWith("Credits not expired yet");


            // increase the time to the expiry time
            await time.increaseTo(addBalanceTime + expiryDuration);


            // call updateBalance to settle the expenditures
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();

            actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("drip rate compare: ", actualDripRate, dripRate);
            expect(actualDripRate.eq(dripRate)).to.be.true;


            // 167184000000002376000
            // 1269528030792018471968702

            // calculate the balance, get the actual balance from contract, and see if they are equal
            // the time taken by updateBalance is added into the drip calculation
            console.log("spent expected: ", dripRate.mul( expiryDuration/2));
            let calcExpiryBal = depositBalance.sub(dripRate.mul(expiryDuration + 1));
            balances = await SubscriptionBalance.prevBalances(nftID);
            console.log("balance: ", balances, calcExpiryBal);
            expect(balances[0].eq(calcExpiryBal)).to.be.true;


            //call the withdraw function. It should work after the expiry time has passed.
            let beforeSupply = await xct.balanceOf(deployer.address);
            let beforeWithdrawTime = await time.latest();
            await SubscriptionBalance.connect(depositor).withdrawCreditsForNFT(depositor.address, nftID, deployer.address);
            let afterWithdrawTime = await time.latest();
            let afterSupply = await xct.balanceOf(deployer.address);


            //check if the withdrawn amount is added into the callers wallet. check if the withdrawn amount is equal to the calculated amount
            // the time taken for withdraw function is also added into the drip calculation
            afterSupply = afterSupply.sub(beforeSupply);
            calcExpiryBal = calcExpiryBal.sub(dripRate.mul(afterWithdrawTime - beforeWithdrawTime));
            expect(afterSupply.eq(calcExpiryBal)).to.be.true;
            // check if the credit balance in the contract is empty.
            // the balance is zero because the initial credited amount is greater than the amount after expenditures
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(0)).to.be.true;
        })
	
        it("Credit balance can be deposited by multiple wallets, and the wallets can withdraw their credited amount after expiry time", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            const depositor1 = addrList[4];
            const depositor2 = addrList[5];
            const computeRequired = [1,2,3];
            // these values should not be changed
            let expiry1Dur = 60 * 60 * 24 * 15;
            let expiry2Dur = 60 * 60 * 24 * 5;
            let dep1DripDur = 60 * 60 * 24 * 18;
            let dep2DripDur = 60 * 60 * 24 * 6;

            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 100;
            const referralPercent = 8000;
            const daoRate = 5000;
            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;

            // setting the contract constructor parameters
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
            }

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            //deploying the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );

            // create a subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });

            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);

            


            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await estimateDripRate(app1);

            
            // Subscribing to the created subnet
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();

            let actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            console.log("drip rate compare: ", actualDripRate, dripRate);
            expect(actualDripRate.eq(dripRate)).to.be.true;

            const snapshotAtSubscription = await takeSnapshot();


            // calculate the amount to deposit by multiplying the drip rate with the deposit duration
            expiry1Dur = 60 * 60 * 24 * 15;
            expiry2Dur = 60 * 60 * 24 * 5;
            dep1DripDur = 60 * 60 * 24 * 18;
            dep2DripDur = 60 * 60 * 24 * 6;
            let dep1Bal = dripRate.mul(dep1DripDur);
            let dep2Bal = dripRate.mul(dep2DripDur);
            let totalDep = dep1Bal.add(dep2Bal);


            // add amount to depositor if depositor's balance is less
            // await getAmountIfLess(depositor1, dep1Bal, SubscriptionBalance);
            // await getAmountIfLess(depositor2, dep2Bal, SubscriptionBalance);
            await getXCTAmount(depositor1, dep1Bal, SubscriptionBalance);
            await getXCTAmount(depositor2, dep2Bal, SubscriptionBalance);
            
            let beforeDepositTime = await time.latest();

            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor1).addBalanceAsCredit(depositor1.address, nftID, dep1Bal, expiry1Dur + beforeDepositTime);

            let firstDepositTime = await time.latest();

            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            let balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(dep1Bal)).to.be.true;


            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor2).addBalanceAsCredit(depositor2.address, nftID, dep2Bal, expiry2Dur + firstDepositTime);


            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            balances = await SubscriptionBalance.prevBalances(nftID);
            let calcBal = dep1Bal.add(dep2Bal);
            calcBal = calcBal.sub(dripRate.mul(await time.latest() - firstDepositTime));
            console.log("checking balance: ", balances, calcBal);
            expect(balances[0].eq(calcBal)).to.be.true;

            
            const snapshotAtFullAmount = await takeSnapshot();
            

            await time.increaseTo(beforeDepositTime + expiry2Dur/2);


            await SubscriptionBalance.updateBalance(nftID);
            let timeAfterUpdate = await time.latest();

            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry2Dur/2));
            expect(balances[0].eq(calcBal)).to.be.true;

            await expect(SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address))
            .to.be.revertedWith("Credits not expired yet");
            await expect(SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(depositor2.address, nftID, depositor2.address))
            .to.be.revertedWith("Credits not expired yet");


            await time.increaseTo(beforeDepositTime + expiry2Dur);
            timeAfterIncrease = await time.latest();

            await SubscriptionBalance.updateBalance(nftID);
            timeAfterUpdate = await time.latest();

            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry2Dur));
            expect(balances[0].eq(calcBal)).to.be.true;

            let beforeSupply = await xct.balanceOf(depositor2.address);
            let timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(depositor2.address, nftID, depositor2.address);
            let afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();
            
            afterSupply = afterSupply.sub(beforeSupply);
            let withdraw2Bal = dep2Bal;
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;

            await expect(SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address))
            .to.be.revertedWith("Credits not expired yet");

            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry2Dur + (timeAfterUpdate - timeBeforeUpdate)));
            calcBal = calcBal.sub(dep2Bal);
            expect(balances[0].eq(calcBal)).to.be.true;

        
            await time.increaseTo(beforeDepositTime + expiry1Dur);
            timeAfterIncrease = await time.latest();

            await SubscriptionBalance.updateBalance(nftID);
            timeAfterUpdate = await time.latest();

            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry1Dur));
            calcBal = calcBal.sub(dep2Bal);
            expect(balances[0].eq(calcBal)).to.be.true;


            beforeSupply = await xct.balanceOf(depositor1.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            afterSupply = afterSupply.sub(beforeSupply);
            calcBal = totalDep.sub(dripRate.mul(expiry1Dur +  (timeAfterUpdate - timeBeforeUpdate)));
            calcBal = calcBal.sub(dep2Bal);
            expect(afterSupply.eq(calcBal)).to.be.true;

            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(0)).to.be.true;


            await snapshotAtFullAmount.restore();


            await time.increaseTo(beforeDepositTime + expiry1Dur);

            await SubscriptionBalance.updateBalance(nftID);
            
            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry1Dur));
            expect(balances[0].eq(calcBal)).to.be.true;

            const snapshotAfterExpiry1 = await takeSnapshot();

            beforeSupply = await xct.balanceOf(depositor1.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            afterSupply = afterSupply.sub(beforeSupply);
            withdraw1Bal = totalDep.sub(dripRate.mul(expiry1Dur + (timeAfterUpdate - timeBeforeUpdate)));
            if(withdraw1Bal.gt(dep1Bal))
            {
                withdraw1Bal = dep1Bal;
            }
            expect(afterSupply.eq(withdraw1Bal)).to.be.true;

            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(0)).to.be.true;
            
            await snapshotAfterExpiry1.restore();

            beforeSupply = await xct.balanceOf(depositor2.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(depositor2.address, nftID, depositor2.address);
            afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();

            afterSupply = afterSupply.sub(beforeSupply);
            withdraw2Bal = totalDep.sub(dripRate.mul(expiry1Dur + (timeAfterUpdate - timeBeforeUpdate)));
            if(withdraw2Bal.gt(dep2Bal))
            {
                withdraw2Bal = dep2Bal;
            }
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;

            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry1Dur +  (timeAfterUpdate - timeBeforeUpdate)));
            calcBal = calcBal.sub(withdraw2Bal);
            expect(balances[0].eq(calcBal)).to.be.true;

            beforeSupply = await xct.balanceOf(depositor1.address);
            //this is commented out as we are going to add the time taken by both the withdraw
            //functions into our balance calculation
            // timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            afterSupply = afterSupply.sub(beforeSupply);
            calcBal = totalDep.sub(dripRate.mul(expiry1Dur +  (timeAfterUpdate - timeBeforeUpdate)));
            calcBal = calcBal.sub(withdraw2Bal);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAtSubscription.restore();

            expiry1Dur = 60 * 60 * 24 * 12;
            expiry2Dur = 60 * 60 * 24 * 6;
            dep1DripDur = 60 * 60 * 24 * 19;
            dep2DripDur = 60 * 60 * 24 * 6;


            // calculate the amount to deposit by multiplying the drip rate with the deposit duration
            dep1Bal = dripRate.mul(dep1DripDur);
            dep2Bal = dripRate.mul(dep2DripDur);
            totalDep = dep1Bal.add(dep2Bal);


            // add amount to depositor if depositor's balance is less
            // await getAmountIfLess(depositor1, dep1Bal, SubscriptionBalance);
            // await getAmountIfLess(depositor2, dep2Bal, SubscriptionBalance);
            await getXCTAmount(depositor1, dep1Bal, SubscriptionBalance);
            await getXCTAmount(depositor2, dep2Bal, SubscriptionBalance);

            beforeDepositTime = await time.latest();

            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor2).addBalanceAsCredit(depositor2.address, nftID, dep2Bal, expiry2Dur + beforeDepositTime);

            firstDepositTime = await time.latest();

            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(dep2Bal)).to.be.true;

            await time.increaseTo(firstDepositTime + expiry2Dur/2);

            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor1).addBalanceAsCredit(depositor1.address, nftID, dep1Bal, expiry1Dur + beforeDepositTime);


            const snapshotAfterBothDeposit = await takeSnapshot();

            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = dep1Bal.add(dep2Bal);
            calcBal = calcBal.sub(dripRate.mul(await time.latest() - firstDepositTime));
            expect(balances[0].eq(calcBal)).to.be.true;


            await time.increaseTo(firstDepositTime + expiry2Dur);


            beforeSupply = await xct.balanceOf(depositor2.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(depositor2.address, nftID, depositor2.address);
            afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();

            withdraw2Bal = dep2Bal;
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;


            await expect(SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address))
            .to.be.revertedWith("Credits not expired yet");


            await time.increaseTo(firstDepositTime + expiry1Dur);

            beforeSupply = await xct.balanceOf(depositor1.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            withdraw1Bal = totalDep.sub(dripRate.mul(expiry1Dur + (timeAfterUpdate - timeBeforeUpdate)));
            withdraw1Bal = withdraw1Bal.sub(dep2Bal);
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw1Bal)).to.be.true;

            
            await snapshotAfterBothDeposit.restore();


            await time.increaseTo(firstDepositTime + expiry1Dur);


            beforeSupply = await xct.balanceOf(depositor2.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(depositor2.address, nftID, depositor2.address);
            afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();

            withdraw2Bal = dep2Bal;
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;

            beforeSupply = await xct.balanceOf(depositor1.address);
            // timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            withdraw1Bal = totalDep.sub(dripRate.mul(expiry1Dur + (timeAfterUpdate - timeBeforeUpdate)));
            withdraw1Bal = withdraw1Bal.sub(dep2Bal);
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw1Bal)).to.be.true;


            await snapshotAfterBothDeposit.restore();


            await time.increaseTo(firstDepositTime + expiry1Dur);


            beforeSupply = await xct.balanceOf(depositor1.address);
            // timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            withdraw1Bal = totalDep.sub(dripRate.mul(expiry1Dur + (timeAfterUpdate - timeBeforeUpdate)));
            // withdraw1Bal = withdraw1Bal.sub(dep2Bal);
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw1Bal)).to.be.true;


            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(0)).to.be.true;

            beforeSupply = await xct.balanceOf(depositor1.address);
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(depositor1.address, nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);

            expect(afterSupply.eq(beforeSupply)).to.be.true;

        })
		
        it("NFT Balance can only be withdrawn from nft holder, and can be added at subscription or later", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const anotherAccount = addrList[2];
            const referralAddress = addrList[3];
            const licenseAddress = addrList[4];
            const globalSupportAddress = addrList[5];
            const platformAddress = addrList[6];
            const subscribeDuration = 60 * 60 * 24 * 10;
            const secondDuration = 60 * 60 * 24 * 5;

            const computeRequired = [1,2,3];

            
            const referralExpiry = 60 * 60 * 24 * 100;
            const referralPercent = 8000;
            const daoRate = 5000;
            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;

            // setting the contract constructor parameters
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
            }

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            //deploying the contracts
            await initContracts();

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );

            // create a subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });


            // estimate the amount of xct that needs to be withdrawn
            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);

            


            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await estimateDripRate(app1);

            const snapshotBeforeSubscribe = await takeSnapshot();

            
            // Subscribing to the created subnet
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            let balanceToAdd = dripRate.mul(subscribeDuration);
            let fullDep = balanceToAdd;
            // await getAmountIfLess(subscriber, balanceToAdd, SubscriptionBalance);
            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            await SubscriptionBalance.connect(subscriber).addBalance(subscriber.address, nftID, balanceToAdd);

            const snapshotAfterAddBalance = await takeSnapshot();

            let depositTime = await time.latest();

            let withdraw = balanceToAdd.div(2);
            let beforeSupply = await xct.balanceOf(subscriber.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawBalance(subscriber.address, nftID, withdraw);
            let afterUpdateTime = await time.latest();
            let afterSupply = await xct.balanceOf(subscriber.address);

            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            afterSupply = afterSupply.sub(beforeSupply);
            let calcBal = fullDep.sub(dripRate.mul(afterUpdateTime - beforeUpdateTime));
            calcBal = calcBal.sub(withdraw);
            expect(afterSupply.eq(calcBal)).to.be.true;

            let balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(0)).to.be.true;
            let totalBalance = await SubscriptionBalance.totalPrevBalance(nftID);
            expect(totalBalance.eq(0)).to.be.true;

            
            await snapshotAfterAddBalance.restore();

            await time.increaseTo(depositTime + subscribeDuration/2);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = fullDep.sub(dripRate.mul(subscribeDuration/2 + (afterUpdateTime - beforeUpdateTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterAddBalance.restore();

            await time.increaseTo(depositTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(afterSupply.eq(0)).to.be.true;


            await snapshotAfterAddBalance.restore();

            withdraw = balanceToAdd.div(2);
            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawBalance(anotherAccount.address, nftID, withdraw))
            .to.be.revertedWith(
                // "Sender not the owner of NFT id"
                "The nftOwner address should be the function caller"
                );

            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawAllOwnerBalance(anotherAccount.address, nftID))
            .to.be.revertedWith(
                // "Sender not the owner of NFT id"
                "The nftOwner address should be the function caller"
                );


            await snapshotBeforeSubscribe.restore();

            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullSubscribeDep = balanceToAdd;
            // await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            // Subscribing to the created subnet
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                // 0,
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();

            let subscribeTime = await time.latest();
            snapshotAfterSubscribe = await takeSnapshot();


            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(balanceToAdd)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = balanceToAdd.sub(dripRate.mul(afterUpdateTime - beforeUpdateTime));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;

            await snapshotAfterSubscribe.restore();

            await time.increaseTo(subscribeTime + subscribeDuration/2);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = balanceToAdd.sub(dripRate.mul(subscribeDuration/2 + (afterUpdateTime - beforeUpdateTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterSubscribe.restore();

            await time.increaseTo(subscribeTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(beforeSupply.eq(afterSupply)).to.be.true;
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(0)).to.be.true;

            await snapshotAfterSubscribe.restore();

            let secondBalanceToAdd = dripRate.mul(secondDuration);
            // await getAmountIfLess(subscriber, secondBalanceToAdd, SubscriptionBalance);
            await getXCTAmount(subscriber, secondBalanceToAdd, SubscriptionBalance);
            await SubscriptionBalance.connect(subscriber).addBalance(subscriber.address, nftID, secondBalanceToAdd);

            await time.increaseTo(subscribeTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = fullSubscribeDep.sub(dripRate.mul(subscribeDuration + (afterUpdateTime - beforeUpdateTime)));
            calcBal = calcBal.add(secondBalanceToAdd);
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterSubscribe.restore();
            let afterRestoreTime = await time.latest();

            withdraw = fullSubscribeDep.div(2);
            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawBalance(anotherAccount.address, nftID, withdraw))
            .to.be.revertedWith("The nftOwner address should be the function caller");

            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawAllOwnerBalance(anotherAccount.address, nftID))
            .to.be.revertedWith("The nftOwner address should be the function caller");


            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);


            calcBal = fullSubscribeDep.sub(dripRate.mul((afterUpdateTime - afterRestoreTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(afterSupply.eq(beforeSupply)).to.be.true;
        })
		
        it("referral address gets a share of the subscription amount until the referral expiry", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const supportAddress = addrList[4];
            const globalSupportAddress = addrList[5];
            const platformAddress = addrList[6];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
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
            console.log("computePerSec: ", computePerSec);


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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
            }


            // deploying all the contracts
            await initContracts();

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1]
                ],
                // resourceArray: [1, 1, 1, 1, 1],
                resourceArray: computeRequired,
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };


            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );
            
            // create the 1st subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: unitPrices
            });


            // estimate the amount of xct that needs to be withdrawn
            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            // transfer the xct if the subscriber does not have enough balance
            const dripRate = await estimateDripRate(app1);
            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullAmount = balanceToAdd;
            
            // await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            // Subscribing to the 1st subnet
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();

            const subscribeTime = await time.latest();


            await time.increaseTo(subscribeTime + referralExpiry/2);
            
            let beforeRefSupply = await xct.balanceOf(referralAddress.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
            let afterRefSupply = await xct.balanceOf(referralAddress.address);

            let durPassed = referralExpiry/2 + afterUpdateTime - beforeUpdateTime;
            let calcRefBal = computePerSec.mul(durPassed).mul(referralFee).div(100000);
            const halfRefBal = calcRefBal;
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            console.log("referral balance: ", afterRefSupply, calcRefBal);
            expect(afterRefSupply.eq(calcRefBal)).to.be.true;


            await time.increaseTo(subscribeTime + referralExpiry - 5 );

            beforeRefSupply = await xct.balanceOf(referralAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(referralAddress.address);
            afterRefSupply = await xct.balanceOf(referralAddress.address);
            
            durPassed = referralExpiry - 5 + afterUpdateTime - beforeUpdateTime;
            calcRefBal = computePerSec.mul(durPassed).mul(referralFee).div(100000);
            const totalRefBalWithdrawn = calcRefBal;
            calcRefBal = calcRefBal.sub(halfRefBal);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcRefBal)).to.be.true;


            await time.increaseTo(subscribeTime + subscribeDuration );

            beforeRefSupply = await xct.balanceOf(globalDAO.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(globalDAO.address);
            afterRefSupply = await xct.balanceOf(globalDAO.address);
            
            // durPassed = subscribeDuration + 1;
            // calcRefBal = computePerSec.mul(durPassed).mul(referralFee).div(100000);
            // const daoRateBal = computePerSec.mul(subscribeDuration).mul(daoRate).div(100000);
            // calcRefBal = calcRefBal.sub(totalRefBalWithdrawn);
            // afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            // afterRefSupply = afterRefSupply.sub(daoRateBal);
            // console.log("sup: ", afterRefSupply, calcRefBal);
            // expect(afterRefSupply.eq(calcRefBal)).to.be.true;

        })

        it("support address gets a share of the subscription amount", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const invalidSupportAddress = addrList[3];
            const platformAddress = addrList[6];
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
            const newSupportDuration = 60 * 60 * 24 * 2;
            const referralPercent = 8000;
            const daoRate = 5000;

            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;

            const licenseFee = 10000;
            const minTimeFunds = 300;
            let newSupportFee = [14000, 5];
            const supportFee = [6000, 1];
            const supportFee2 = [5000, 3];
            const supportFee3 = [8000, 4];
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                    reqdNoticeTimeSProvider: noticeTime,
                    reqdCooldownSProvider: cooldownTime,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });

            
            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
            }

            // deploying all the contracts
            await initContracts();

            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1]
                ],
                // resourceArray: [1, 1, 1, 1, 1],
                resourceArray: computeRequired,
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );


            // create the 1st subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: unitPrices
            });


            app1.rlsAddresses = [
                app1.rlsAddresses[0],
                app1.rlsAddresses[1],
                // app1.rlsAddresses[2],
                globalSupportAddress.address,
                app1.rlsAddresses[3]
            ];

            // transfer the xct if the subscriber does not have enough balance
            let dripRate = await estimateDripRate(app1);
            // let dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, globalSupportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullAmount = balanceToAdd;


  
            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            await getXCTAmount(subscriber2, balanceToAdd, SubscriptionBalance);
            await getXCTAmount(subscriber3, balanceToAdd, SubscriptionBalance);


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);

            // Subscribing to the 1st subnet
            console.log("subnetID; ", subnetID);
            await expect( ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                // app1.rlsAddresses,
                [
                    app1.rlsAddresses[0],
                    app1.rlsAddresses[1],
                    // app1.rlsAddresses[2],
                    invalidSupportAddress.address,
                    app1.rlsAddresses[3]
                ],
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )
            ).to.be.revertedWith("invalid support address");
            
            
            const snapshotBeforeSubscribe = await takeSnapshot();

            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();

            let subscribeTime = await time.latest();

            // Get the minted appNFT
            
            await time.increaseTo(subscribeTime + thirdTimePoint);
            
            let beforeRefSupply = await xct.balanceOf(globalSupportAddress.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(globalSupportAddress.address);
            let afterRefSupply = await xct.balanceOf(globalSupportAddress.address);

            let durPassed = thirdTimePoint + afterUpdateTime - beforeUpdateTime;
            let calcBal = computePerSec.mul(durPassed).mul(globalSupportFactor1).div(100000);
            calcBal = calcBal.add(globalSupportFactor2 * durPassed);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await snapshotBeforeSubscribe.restore();

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);

            
            app1.rlsAddresses = [
                app1.rlsAddresses[0],
                app1.rlsAddresses[1],
                supportAddress.address,
                app1.rlsAddresses[3]
            ];

            // transfer the xct if the subscriber does not have enough balance
            dripRate = await estimateDripRate(app1);

            // dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            fullAmount = balanceToAdd;

            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();
                
            subscribeTime = await time.latest();

            await time.increaseTo(subscribeTime + firstTimePoint);
            
            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = firstTimePoint + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee[0]).div(100000);
            calcBal = calcBal.add(durPassed*supportFee[1]);
            const balanceFromFirstTP = calcBal;
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await Subscription.setSupportFactorForNFT(supportAddress.address, nftID, newSupportFee);

            await time.increaseTo(subscribeTime + secondTimePoint);

            
            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            const timeAfterUpdateBalance = afterUpdateTime;
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = secondTimePoint + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee[0]).div(100000);
            calcBal = calcBal.add(durPassed*supportFee[1]);
            calcBal = calcBal.sub(balanceFromFirstTP);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;
            

            beforeUpdateTime = await time.latest();
            await Subscription.connect(subscriber).approveNewSupportFactor(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            const timeTakenForApprove = afterUpdateTime - timeAfterUpdateBalance;
            
            let balanceUpdatedAfterApprove = computePerSec.mul(timeTakenForApprove).mul(supportFee[0]).div(100000);
            balanceUpdatedAfterApprove =  balanceUpdatedAfterApprove.add(timeTakenForApprove * supportFee[1]);
            const timeAfterApprove = await time.latest();

            await time.increaseTo(subscribeTime + thirdTimePoint);
            const timeAfterIncrease = await time.latest();

            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);


            durPassed = timeAfterIncrease - timeAfterApprove
            + (afterUpdateTime - beforeUpdateTime);
            calcBal = computePerSec.mul(durPassed).mul(newSupportFee[0]).div(100000);
            calcBal = calcBal.add((durPassed) * newSupportFee[1]);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            afterRefSupply = afterRefSupply.sub(balanceUpdatedAfterApprove);
            console.log("checking bal: ", afterRefSupply, calcBal, computePerSec.mul(durPassed).mul(newSupportFee[0]).div(100000),  (durPassed) * newSupportFee[1]);
            expect(afterRefSupply.eq(calcBal)).to.be.true;

            await snapshotBeforeSubscribe.restore();

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);

            // 91928536000000863992
            // 91928536000000863990

            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();
            let nftID1 = getAppNFTID(rec.transactionHash);

            tr = await appNFT.mint(subscriber2.address);
            rec = await tr.wait();
            let nftID2 = getAppNFTID(rec.transactionHash);

            tr = await appNFT.mint(subscriber3.address);
            rec = await tr.wait();
            let nftID3 = getAppNFTID(rec.transactionHash);

            await Subscription.connect(supportAddress).setSupportFactorForNFT(supportAddress.address, nftID2, supportFee2);
            await Subscription.connect(supportAddress).setSupportFactorForNFT(supportAddress.address, nftID3, supportFee3);


            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID1,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();
            subscribeTime = await time.latest();

            tr = await ContractBasedDeployment.connect(subscriber2).subscribeAndCreateApp(
                balanceToAdd,
                nftID2,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            rec = await tr.wait();
            let subscribeTime2 = await time.latest();


            tr = await ContractBasedDeployment.connect(subscriber3).subscribeAndCreateApp(
                balanceToAdd,
                nftID3,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            console.log("created apps");

            rec = await tr.wait();
            let subscribeTime3 = await time.latest();

            await time.increaseTo(subscribeTime + subscribeDuration/2);
            
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID1);
            console.log("called updateBalance for 1");
            afterUpdateTime = await time.latest();

            let calc1Bal = computePerSec.mul(subscribeDuration/2 + afterUpdateTime - beforeUpdateTime).mul(supportFee[0]).div(100000);
            calc1Bal = calc1Bal.add((subscribeDuration/2 + afterUpdateTime - beforeUpdateTime) * supportFee[1]);

            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID2);
            console.log("called updateBalance for 2");
            afterUpdateTime = await time.latest();

            let calc2Bal = computePerSec.mul((afterUpdateTime - subscribeTime2)).mul(supportFee2[0]).div(100000);
            calc2Bal = calc2Bal.add((afterUpdateTime - subscribeTime2) * supportFee2[1]);


            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID3);
            console.log("called updateBalance for 3");
            afterUpdateTime = await time.latest();

            let calc3Bal = computePerSec.mul((afterUpdateTime - subscribeTime3)).mul(supportFee3[0]).div(100000);
            calc3Bal = calc3Bal.add((afterUpdateTime - subscribeTime3) * supportFee3[1]);

            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            calcBal = calc1Bal.add(calc2Bal).add(calc3Bal);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await snapshotBeforeSubscribe.restore();

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);
            await Subscription.connect(globalDAO).addSupportAddress(supportAddress2.address, supportFee2);

            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );
            rec = await tr.wait();
            subscribeTime = await time.latest();

            await time.increaseTo(subscribeTime + firstTimePoint);

            
            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = firstTimePoint + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee[0]).div(100000);
            calcBal = calcBal.add(durPassed*supportFee[1]);
            const oldSupportBalance = calcBal;
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            let timeBeforeRequest = await time.latest();
            await Subscription.connect(subscriber).requestSupportChange(
                subscriber.address,
                nftID,
                supportAddress2.address
            );
            let timeAfterRequest = await time.latest();
            const timeTakenForRequest = timeAfterRequest - timeBeforeRequest;
            const timeAfterRequestSupportChange = await time.latest();

            await expect(Subscription.connect(subscriber).requestSupportChange(
                subscriber.address,
                nftID,
                supportAddress2.address
            )).to.be.revertedWith("Notice period not over yet");

            await expect(Subscription.connect(subscriber).applySupportChange(
                subscriber.address,
                nftID
            ))
            .to.be.revertedWith("Cannot apply before cooldown");

            await time.increaseTo(timeAfterRequestSupportChange + cooldownTime - 60);

            await expect(Subscription.connect(subscriber).applySupportChange(
                subscriber.address,
                nftID
            ))
            .to.be.revertedWith("Cannot apply before cooldown");

            await time.increaseTo(timeAfterRequestSupportChange + cooldownTime);
            let timeAfterCooldown = await time.latest();

            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            // await SubscriptionBalance.updateBalance(nftID);

            console.log("before apply SupportChange");
            await Subscription.connect(subscriber).applySupportChange(
                subscriber.address,
                nftID
            );
            console.log("after apply support change");

            afterUpdateTime = await time.latest();
            const timeAfterApply = afterUpdateTime;
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = timeAfterCooldown - subscribeTime + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee[0]).div(100000);
            calcBal = calcBal.add(durPassed * supportFee[1]);
            calcBal = calcBal.sub(oldSupportBalance);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await time.increaseTo(timeAfterApply + newSupportDuration);


            beforeRefSupply = await xct.balanceOf(supportAddress2.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalance.receiveRevenueForAddress(supportAddress2.address);
            afterRefSupply = await xct.balanceOf(supportAddress2.address);

            durPassed = newSupportDuration + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee2[0]).div(100000);
            calcBal = calcBal.add(durPassed * supportFee2[1]);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;
        })
		
        it("NFT Balance can only be withdrawn from nft holder, and can be added at subscription or later", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;
            const daoRate = 5000;
            const minTimeFunds = 300;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const anotherAccount = addrList[8];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];

            const subscribeDuration = 60 * 60 * 24 * 10;
            const secondDuration = 60 * 60 * 24 * 5;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const computeRequired = [1,2,3];
            const referralExpiry = 60 * 60 * 24 * 100;
            const referralPercent = 8000;

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            //deploying the contracts
            await initContracts();


            // create a subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });


            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralFee
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);

            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await estimateDripRate(app1);

            const snapshotBeforeSubscribe = await takeSnapshot();


            // Subscribing to the created subnet
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );
            rec = await tr.wait();

            let actualDripRate = await SubscriptionBalanceCalculator.dripRatePerSec(nftID);
            expect(actualDripRate.eq(dripRate)).to.be.true;

            let balanceToAdd = dripRate.mul(subscribeDuration);
            let fullDep = balanceToAdd;
            // await getAmountIfLess(subscriber, balanceToAdd, SubscriptionBalance);
            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            await SubscriptionBalance.connect(subscriber).addBalance(subscriber.address, nftID, balanceToAdd);

            const snapshotAfterAddBalance = await takeSnapshot();

            let depositTime = await time.latest();

            let withdraw = balanceToAdd.div(2);
            let beforeSupply = await xct.balanceOf(subscriber.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawBalance(subscriber.address, nftID, withdraw);
            let afterUpdateTime = await time.latest();
            let afterSupply = await xct.balanceOf(subscriber.address);

            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            afterSupply = afterSupply.sub(beforeSupply);
            let calcBal = fullDep.sub(dripRate.mul(afterUpdateTime - beforeUpdateTime));
            calcBal = calcBal.sub(withdraw);
            console.log("calcBal ", afterSupply, calcBal);
            expect(afterSupply.eq(calcBal)).to.be.true;

            let balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(0)).to.be.true;
            let totalBalance = await SubscriptionBalance.totalPrevBalance(nftID);
            expect(totalBalance.eq(0)).to.be.true;
            // 326590440000004751978
            // 326590488000004751978
            
            await snapshotAfterAddBalance.restore();

            await time.increaseTo(depositTime + subscribeDuration/2);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = fullDep.sub(dripRate.mul(subscribeDuration/2 + (afterUpdateTime - beforeUpdateTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterAddBalance.restore();

            await time.increaseTo(depositTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(afterSupply.eq(0)).to.be.true;


            await snapshotAfterAddBalance.restore();

            withdraw = balanceToAdd.div(2);
            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawBalance(anotherAccount.address, nftID, withdraw))
            .to.be.revertedWith(
                // "Sender not the owner of NFT id"
                "Caller not the NFT owner"
                );

            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawAllOwnerBalance(anotherAccount.address, nftID))
            .to.be.revertedWith(
                // "Sender not the owner of NFT id"
                "Caller not the NFT owner"
                );


            await snapshotBeforeSubscribe.restore();

            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullSubscribeDep = balanceToAdd;
            // await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);
            // Subscribing to the created subnet
            tr = await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            rec = await tr.wait();

            let subscribeTime = await time.latest();
            snapshotAfterSubscribe = await takeSnapshot();


            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(balanceToAdd)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = balanceToAdd.sub(dripRate.mul(afterUpdateTime - beforeUpdateTime));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;

            await snapshotAfterSubscribe.restore();

            await time.increaseTo(subscribeTime + subscribeDuration/2);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = balanceToAdd.sub(dripRate.mul(subscribeDuration/2 + (afterUpdateTime - beforeUpdateTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterSubscribe.restore();

            await time.increaseTo(subscribeTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(beforeSupply.eq(afterSupply)).to.be.true;
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(0)).to.be.true;

            await snapshotAfterSubscribe.restore();

            let secondBalanceToAdd = dripRate.mul(secondDuration);
            // await getAmountIfLess(subscriber, secondBalanceToAdd, SubscriptionBalance);
            await getXCTAmount(subscriber, secondBalanceToAdd, SubscriptionBalance);
            await SubscriptionBalance.connect(subscriber).addBalance(subscriber.address, nftID, secondBalanceToAdd);

            await time.increaseTo(subscribeTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = fullSubscribeDep.sub(dripRate.mul(subscribeDuration + (afterUpdateTime - beforeUpdateTime)));
            calcBal = calcBal.add(secondBalanceToAdd);
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterSubscribe.restore();
            let afterRestoreTime = await time.latest();

            withdraw = fullSubscribeDep.div(2);
            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawBalance(anotherAccount.address, nftID, withdraw))
            .to.be.revertedWith("Caller not the NFT owner");

            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawAllOwnerBalance(anotherAccount.address, nftID))
            .to.be.revertedWith("Caller not the NFT owner");


            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);


            calcBal = fullSubscribeDep.sub(dripRate.mul((afterUpdateTime - afterRestoreTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(subscriber.address, nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(afterSupply.eq(beforeSupply)).to.be.true;
        })

        it("function access test for AppDeployment", async () => {
            let gas;
            let gas1, gas2;
            let computes;
            let subnetBitmap, appCount;
            const ROLE = {
                READ: "0x917ec7ea41e5f357223d15148fe9b320af36ca576055af433ea3445b39221799",
                DEPLOYER: "0x503cf060389b91af8851125bd70ce66d16d12330718b103fc7674ef6d27e70c9",
                ACCESS_MANAGER: "0x73d57861095ed1ff7b0e5c00e25f9fc922cf9164e617149ee7073f371364c954",
                BILLING_MANAGER: "0xfc4d5b8dc48f53079d1753f1e53aabb674d1bdef461b3803bef96591e9ef3969",
            }
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            const anotherAccount = addrList[6];
            const bridge = addrList[7];
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1],
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app4 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5003",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };
            let app5 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5004",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };
            let app6 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5005",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }


            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            

            const snapshotAfterMint = await takeSnapshot();

            await expect(ContractBasedDeployment.connect(anotherAccount).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )).to.be.revertedWith("No permissions to call this");


            await expect(ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )).to.not.be.reverted;

            await snapshotAfterMint.restore();

            await expect(appNFT.grantRole(nftID, ROLE.READ, anotherAccount.address)).to.be.revertedWith("Grant and Revoke role only allowed for NFT owner");
            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )).to.be.revertedWith("No permissions to call this");

            
            await expect(appNFT.grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address))
                .to.be.revertedWith("Grant and Revoke role only allowed for NFT owner");
            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )).to.be.revertedWith("No permissions to call this");


            await expect(appNFT.grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address))
                .to.be.revertedWith("Grant and Revoke role only allowed for NFT owner");
            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )).to.be.revertedWith("No permissions to call this");


            await expect(appNFT.grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address))
                .to.be.revertedWith("Grant and Revoke role only allowed for NFT owner");
            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await snapshotAfterMint.restore();

            await expect(ContractBasedDeployment.connect(subscriber).setBridge(bridge.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(ContractBasedDeployment.connect(bridge).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            )).to.be.revertedWith("No permissions to call this");

            await ContractBasedDeployment.connect(deployer).setBridge(bridge.address);

            await ContractBasedDeployment.connect(bridge).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

    
            await snapshotAfterMint.restore();


            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            await expect(ContractBasedDeployment.connect(anotherAccount).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).createApp(
                0,
                nftID,
                app3.appName,
                app3.digest,
                app3.hashAndSize,
                app3.subnetList,
                app3.multiplier,
                app3.resourceArray,
                app3.cidLock
            );

    
            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.resourceArray = [5,3,6,7,3];


            await expect(ContractBasedDeployment.connect(anotherAccount).updateApp(
                0,
                nftID,
                0,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateApp(
                0,
                nftID,
                0,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateApp(
                0,
                nftID,
                0,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateApp(
                0,
                nftID,
                0,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).updateApp(
                0,
                nftID,
                0,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            );





            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.digest = "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b3400";


            await expect(ContractBasedDeployment.connect(anotherAccount).updateCID(
                nftID,
                0,
                app1.digest,
                app1.hashAndSize
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateCID(
                nftID,
                0,
                app1.digest,
                app1.hashAndSize
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateCID(
                nftID,
                0,
                app1.digest,
                app1.hashAndSize
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateCID(
                nftID,
                0,
                app1.digest,
                app1.hashAndSize
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).updateCID(
                nftID,
                0,
                app1.digest,
                app1.hashAndSize
            );




            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.resourceArray = [10,22, 6, 3, 9];
            app1.multiplier = [[2, 2, 5, 1, 6]];


            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            );



            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.multiplier = [[7, 5, 2, 1, 3]];

            
            await expect(ContractBasedDeployment.connect(anotherAccount).updateMultiplier(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateMultiplier(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateMultiplier(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateMultiplier(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier
            )).to.be.revertedWith("No permissions to call this");

            console.log("before update multiplier");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).updateMultiplier(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier
            );

            console.log("before subscribe");

            await snapshotAfterMint.restore();



            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            await expect(ContractBasedDeployment.connect(anotherAccount).createAppBatch(
                0,
                nftID,
                [app2.appName, app3.appName, app4.appName, app5.appName, app6.appName],
                [app2.digest, app3.digest, app4.digest, app5.digest, app6.digest],
                [app2.hashAndSize, app3.hashAndSize, app4.hashAndSize, app5.hashAndSize, app6.hashAndSize],
                [app2.subnetList, app3.subnetList, app4.subnetList, app5.subnetList, app6.subnetList],
                [app2.multiplier, app3.multiplier, app4.multiplier, app5.multiplier, app6.multiplier],
                [app2.resourceArray, app3.resourceArray, app4.resourceArray, app5.resourceArray, app6.resourceArray],
                [app2.cidLock, app3.cidLock, app4.cidLock, app5.cidLock, app6.cidLock],
            )
            ).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).createAppBatch(
                0,
                nftID,
                [app2.appName, app3.appName, app4.appName, app5.appName, app6.appName],
                [app2.digest, app3.digest, app4.digest, app5.digest, app6.digest],
                [app2.hashAndSize, app3.hashAndSize, app4.hashAndSize, app5.hashAndSize, app6.hashAndSize],
                [app2.subnetList, app3.subnetList, app4.subnetList, app5.subnetList, app6.subnetList],
                [app2.multiplier, app3.multiplier, app4.multiplier, app5.multiplier, app6.multiplier],
                [app2.resourceArray, app3.resourceArray, app4.resourceArray, app5.resourceArray, app6.resourceArray],
                [app2.cidLock, app3.cidLock, app4.cidLock, app5.cidLock, app6.cidLock],
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).createAppBatch(
                0,
                nftID,
                [app2.appName, app3.appName, app4.appName, app5.appName, app6.appName],
                [app2.digest, app3.digest, app4.digest, app5.digest, app6.digest],
                [app2.hashAndSize, app3.hashAndSize, app4.hashAndSize, app5.hashAndSize, app6.hashAndSize],
                [app2.subnetList, app3.subnetList, app4.subnetList, app5.subnetList, app6.subnetList],
                [app2.multiplier, app3.multiplier, app4.multiplier, app5.multiplier, app6.multiplier],
                [app2.resourceArray, app3.resourceArray, app4.resourceArray, app5.resourceArray, app6.resourceArray],
                [app2.cidLock, app3.cidLock, app4.cidLock, app5.cidLock, app6.cidLock],
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(
                ContractBasedDeployment.connect(anotherAccount).createAppBatch(
                    0,
                    nftID,
                    [app2.appName, app3.appName, app4.appName, app5.appName, app6.appName],
                    [app2.digest, app3.digest, app4.digest, app5.digest, app6.digest],
                    [app2.hashAndSize, app3.hashAndSize, app4.hashAndSize, app5.hashAndSize, app6.hashAndSize],
                    [app2.subnetList, app3.subnetList, app4.subnetList, app5.subnetList, app6.subnetList],
                    [app2.multiplier, app3.multiplier, app4.multiplier, app5.multiplier, app6.multiplier],
                    [app2.resourceArray, app3.resourceArray, app4.resourceArray, app5.resourceArray, app6.resourceArray],
                    [app2.cidLock, app3.cidLock, app4.cidLock, app5.cidLock, app6.cidLock],
                )
            ).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).createAppBatch(
                0,
                nftID,
                [app2.appName, app3.appName, app4.appName, app5.appName, app6.appName],
                [app2.digest, app3.digest, app4.digest, app5.digest, app6.digest],
                [app2.hashAndSize, app3.hashAndSize, app4.hashAndSize, app5.hashAndSize, app6.hashAndSize],
                [app2.subnetList, app3.subnetList, app4.subnetList, app5.subnetList, app6.subnetList],
                [app2.multiplier, app3.multiplier, app4.multiplier, app5.multiplier, app6.multiplier],
                [app2.resourceArray, app3.resourceArray, app4.resourceArray, app5.resourceArray, app6.resourceArray],
                [app2.cidLock, app3.cidLock, app4.cidLock, app5.cidLock, app6.cidLock],
            );

    

            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.resourceArray = [10,22, 6, 3, 9];
            app1.multiplier = [[2, 2, 5, 1, 6]];


            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).updateResource(
                nftID,
                0,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray
            );



            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.multiplier = [[7, 5, 2, 1, 3]];

            
            await expect(ContractBasedDeployment.connect(anotherAccount).deleteApp(
                nftID,
                0
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).deleteApp(
                nftID,
                0,
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).deleteApp(
                nftID,
                0,
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).deleteApp(
                nftID,
                0,
            )).to.be.revertedWith("No permissions to call this");

            console.log("before update multiplier");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).deleteApp(
                nftID,
                0,
            );


            await snapshotAfterMint.restore();
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                0,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            app1.multiplier = [[7, 5, 2, 1, 3]];

            
            await expect(ContractBasedDeployment.connect(anotherAccount).setSubnetLock(
                nftID
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.READ, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).setSubnetLock(
                nftID
            )).to.be.revertedWith("No permissions to call this");


            await appNFT.connect(subscriber).grantRole(nftID, ROLE.ACCESS_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).setSubnetLock(
                nftID
            )).to.be.revertedWith("No permissions to call this");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.BILLING_MANAGER, anotherAccount.address);
            await expect(ContractBasedDeployment.connect(anotherAccount).setSubnetLock(
                nftID
            )).to.be.revertedWith("No permissions to call this");

            console.log("before update multiplier");

            await appNFT.connect(subscriber).grantRole(nftID, ROLE.DEPLOYER, anotherAccount.address);
            await ContractBasedDeployment.connect(anotherAccount).setSubnetLock(
                nftID
            );

        });

        it("Function access test for Subscription", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const admin = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            const anotherAccount = addrList[6];
            const bridge = addrList[7];
            const supportAddress = addrList[8];
            const newSupportAddress = addrList[9];
            const newLicenseAddress = addrList[10];

            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const supportFee = [8000, 1];
            const newSupportFee = [6000, 1];
            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const cooldown = 60 * 60 * 24;
            const notice = 60 * 60 * 24;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                    reqdNoticeTimeSProvider: notice,
                    reqdCooldownSProvider: cooldown,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    // referralAddress.address,
                    "0x0000000000000000000000000000000000000000",
                    supportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1],
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            const BRIDGE_ROLE = await Subscription.BRIDGE_ROLE();

            const initSnapshot = await takeSnapshot();

            await expect(
                 Subscription.connect(anotherAccount).grantRole(
                    BRIDGE_ROLE,
                    bridge.address
                )
            ).to.be.reverted;


            {
                const newGlobalDAO = addrList[6];
                await expect(Subscription
                        .connect(subscriber)
                        .admin_changeGlobalDAO(newGlobalDAO.address)
                ).to.be.reverted;

                await Subscription.connect(admin).admin_changeGlobalDAO(newGlobalDAO.address);

                await initSnapshot.restore();

                await expect(Subscription
                    .connect(anotherAccount)
                    .admin_changeSupportAddressCooldown(60*60*24)
                ).to.be.reverted;

                await Subscription.connect(admin).admin_changeSupportAddressCooldown(60*60*24);

                await initSnapshot.restore();


                await expect(Subscription
                    .connect(anotherAccount)
                    .admin_changeSupportAddressNotice(60*60*100)
                ).to.be.reverted;

                await Subscription.connect(admin).admin_changeSupportAddressNotice(60*60*100);

                await initSnapshot.restore();

            }

            await expect(Subscription.connect(anotherAccount).addSupportAddress(
                supportAddress.address,
                supportFee
            )).to.be.revertedWith("No permissions to call this");


            await Subscription.connect(globalDAO).addSupportAddress(
                supportAddress.address,
                supportFee
            );

            await initSnapshot.restore();

            await expect (Subscription.connect(bridge).addSupportAddress(
                supportAddress.address,
                supportFee
            )).to.be.reverted;

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).addSupportAddress(
                supportAddress.address,
                supportFee
            );

    
    
            await initSnapshot.restore();
            


            await expect(Subscription.connect(anotherAccount).addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            )).to.be.revertedWith("No permissions to call this");


            await Subscription.connect(globalDAO).addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );

            await initSnapshot.restore();


            await expect (Subscription.connect(bridge).addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );




            await initSnapshot.restore();


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            await Subscription.connect(globalDAO).addSupportAddress(
                supportAddress.address,
                supportFee
            );

            const snapshotAfterSupport = await takeSnapshot();

            await Subscription.connect(supportAddress).setSupportFactorForNFT(
                supportAddress.address,
                nftID,
                [5000, 2]
            );

            await snapshotAfterSupport.restore();

            await expect(Subscription.connect(bridge).setSupportFactorForNFT(
                supportAddress.address,
                nftID,
                [5000, 2]
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).setSupportFactorForNFT(
                supportAddress.address,
                nftID,
                [5000, 2]
            );




            await snapshotAfterSupport.restore();

            await Subscription.connect(globalDAO).addSupportAddress(
                supportAddress.address,
                supportFee
            );

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );


            const subscribeSnapshot = await takeSnapshot();





            await Subscription.connect(supportAddress).setSupportFactorForNFT(
                supportAddress.address,
                nftID,
                [8000, 2]
            );

            await expect(Subscription.connect(anotherAccount).approveNewSupportFactor(
                anotherAccount.address,
                nftID
            )).to.be.revertedWith("No permissions to call this");
        
            
            await Subscription.connect(subscriber).approveNewSupportFactor(
                subscriber.address,
                nftID
            );

            await subscribeSnapshot.restore();


            await Subscription.connect(supportAddress).setSupportFactorForNFT(
                supportAddress.address,
                nftID,
                [8000, 2]
            );

            await expect(Subscription.connect(bridge).approveNewSupportFactor(
                subscriber.address,
                nftID
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );


            await Subscription.connect(bridge).approveNewSupportFactor(
                subscriber.address,
                nftID
            );





            await subscribeSnapshot.restore();


            await expect(Subscription.connect(anotherAccount).addReferralAddress(
                anotherAccount.address,
                nftID,
                referralAddress.address
            )).to.be.revertedWith("No permissions to call this");


            await Subscription.connect(subscriber).addReferralAddress(
                subscriber.address,
                nftID,
                referralAddress.address
            );

            await subscribeSnapshot.restore();

            await expect(Subscription.connect(bridge).addReferralAddress(
                subscriber.address,
                nftID,
                referralAddress.address  
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).addReferralAddress(
                subscriber.address,
                nftID,
                referralAddress.address  
            );




            await subscribeSnapshot.restore();


            // address nftOwner,
            // uint256 nftID,
            // address newSupportAddress

            await expect(Subscription.connect(anotherAccount).requestSupportChange(
                anotherAccount.address,
                nftID,
                newSupportAddress.address
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(subscriber).requestSupportChange(
                subscriber.address,
                nftID,
                newSupportAddress.address
            );

            await subscribeSnapshot.restore();

            await expect(Subscription.connect(bridge).requestSupportChange(
                subscriber.address,
                nftID,
                newSupportAddress.address
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).requestSupportChange(
                subscriber.address,
                nftID,
                newSupportAddress.address
            );

            await subscribeSnapshot.restore();

            await Subscription.connect(subscriber).requestSupportChange(
                subscriber.address,
                nftID,
                newSupportAddress.address
            );
            // const reqSupportSnapshot = await takeSnapshot();
            
            await time.increaseTo(await time.latest() + cooldown);

            await expect(Subscription.connect(anotherAccount).applySupportChange(
                anotherAccount.address,
                nftID
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(subscriber).applySupportChange(
                subscriber.address,
                nftID
            );

            await subscribeSnapshot.restore();

            await Subscription.connect(subscriber).requestSupportChange(
                subscriber.address,
                nftID,
                newSupportAddress.address
            );

            await time.increaseTo(await time.latest() + cooldown);


            await expect(Subscription.connect(bridge).applySupportChange(
                subscriber.address,
                nftID
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).applySupportChange(
                subscriber.address,
                nftID
            );

            


            await subscribeSnapshot.restore();

            
            await expect(Subscription.connect(anotherAccount).changeLicenseAddress(
                anotherAccount.address,
                newLicenseAddress.address,
                nftID,
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(licenseAddress).changeLicenseAddress(
                licenseAddress.address,
                newLicenseAddress.address,
                nftID,
            );


            await subscribeSnapshot.restore();

            await expect(Subscription.connect(bridge).changeLicenseAddress(
                anotherAccount.address,
                newLicenseAddress.address,
                nftID,
            )).to.be.revertedWith("No permissions to call this");

            await Subscription.connect(admin).grantRole(
                BRIDGE_ROLE,
                bridge.address
            );

            await Subscription.connect(bridge).changeLicenseAddress(
                licenseAddress.address,
                newLicenseAddress.address,
                nftID,
            );

        });

        it("function access test for SubscriptionBalance and BalanceCalculator", async () => {
            const globalDAO = addrList[0];
            const admin = addrList[0];
            const owner = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3];
            const globalSupportAddress = addrList[4];
            const platformAddress = addrList[5];
            const anotherAccount = addrList[6];
            const bridge = addrList[7];
            const billingManager = addrList[8];
            const creditor = addrList[9];
            const external = addrList[10];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const daoRate = 5000;

            const minTimeFunds = 300;
            const globalSupportFactor1 = 10000;
            const globalSupportFactor2 = 1;
            const platformFee = 10000;
            const discountFee = 3000;
            const referralFee = 4000;
            const unitPrices = [
                ethers.utils.parseUnits("10000", 'gwei'), // CPU_Standard
                ethers.utils.parseUnits("20000", 'gwei'), // CPU_Intensive
                ethers.utils.parseUnits("30000", 'gwei'), // GPU_Standard
                ethers.utils.parseUnits("30000", 'gwei'), // Storage
                ethers.utils.parseUnits("20000", 'gwei'), // Bandwidth
            ];

            const estimateDripRate = async (app) => {

                let resourceArray = [];
                for(var i = 0; i < app.subnetList.length; i++)
                {
                    resourceArray.push([]);
                    for(var j = 0; j < app.resourceArray.length; j++)
                    {
                        resourceArray[i].push(app.resourceArray[j]*app.multiplier[i][j]);
                    }
                }

                const dripRate = await SubscriptionBalanceCalculator.estimateDripRatePerSec(
                    app.subnetList,
                    [
                        app.licenseFee[0],
                        app.licenseFee[1],
                        globalSupportFactor1,
                        globalSupportFactor2,
                        referralFee,
                        platformFee,
                        discountFee,
                ],
                resourceArray
                );

                return dripRate;
                // return ethers.utils.parseEther("0");
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
                    // supportFee: globalSupportFee,
                    supportFactor1: globalSupportFactor1,
                    supportFactor2: globalSupportFactor2,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                }
            });


            // deploying all the contracts
            await initContracts();

            
            let app1 = {
                appName: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db2",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    licenseAddress.address,
                    referralAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address  
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                resourceType: [0, 1, 2, 3, 4],
                lastUpdatedTime: '',
                cidLock: false,
            };

            let app2 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db1",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1]
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };

            let app3 = {
                appName:"0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db6",
                digest: "0xb7b94ecbd1f9f8cb209909e5785fb2858c9a8c4b220c017995a75346ad1b5db5",
                rlsAddresses: [
                    referralAddress.address,
                    licenseAddress.address,
                    globalSupportAddress.address,
                    platformAddress.address
                ],
                licenseFee: [0, 10],
                hashAndSize: [
                    18, 32
                ],
                subnetList: [0],
                multiplier: [
                    [1, 1, 1, 1, 1],
                ],
                resourceArray: [1, 1, 1, 1, 1],
                cidLock: false,
            };


            const initSnapshot = await takeSnapshot();

            {
             
                const newBalanceCalculator = await helper.deploySubscriptionBalanceCalculator();

                await expect(SubscriptionBalance.connect(anotherAccount).setBalanceCalculator(
                    newBalanceCalculator
                )).to.be.reverted;


                await SubscriptionBalance.connect(owner).setBalanceCalculator(
                    newBalanceCalculator
                );

                await initSnapshot.restore();

                



                const newSubscription = await helper.deploySubscription();

                await expect(SubscriptionBalance.connect(anotherAccount).setSubscriptionContract(
                    newSubscription
                )).to.be.reverted;

                await SubscriptionBalance.connect(owner).setSubscriptionContract(
                    newSubscription
                );

                await initSnapshot.restore();





                const newAppDeployment = await helper.deployContractBasedDeployment();

                await expect(SubscriptionBalance.connect(anotherAccount).setContractBasedDeployment(
                    newAppDeployment
                )).to.be.reverted;


                await SubscriptionBalance.connect(owner).setContractBasedDeployment(
                    newAppDeployment
                );

                await initSnapshot.restore();




                const newDAODistributor = await helper.deploySubnetDAODistributor();
                await expect(SubscriptionBalance.connect(anotherAccount).setSubnetDAODistributor(
                    newDAODistributor
                )).to.be.reverted;

                await SubscriptionBalance.connect(owner).setSubnetDAODistributor(
                    newDAODistributor
                );

                await initSnapshot.restore();

            }

            await Subscription.addPlatformAddress(
                platformAddress.address
                ,platformFee
                ,discountFee
                ,referralPercent
                ,referralExpiry
            );


            let tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID = await getAppNFTID(rec.transactionHash);


            const subnetIDList = [];
            const subnetLen = 1;

            for(var i = 0; i < subnetLen; i++)
            {
                const subnetID = await createSubnet(deployer, {
                    unitPrices
                });

                subnetIDList.push(subnetID);
            }

            // get the estimated drip rate for app1
            const dripRateForApp1 = await estimateDripRate(app1);
            

            // getting balanceToAdd
            let balanceToAdd = dripRateForApp1.mul(subscribeDuration);
            // balanceToAdd = ethers.utils.parseEther("1");

            await getXCTAmount(subscriber, balanceToAdd, SubscriptionBalance);


            let beforeBal = await ethers.provider.getBalance(subscriber.address);
            await ContractBasedDeployment.connect(subscriber).subscribeAndCreateApp(
                balanceToAdd,
                nftID,
                app1.rlsAddresses,
                app1.licenseFee,
                app1.appName,
                app1.digest,
                app1.hashAndSize,
                app1.subnetList,
                app1.multiplier,
                app1.resourceArray,
                app1.cidLock
            );

            const subscribeSnapshot = await takeSnapshot();
            
            const BILLING_MANAGER_ROLE = await appNFT.BILLING_MANAGER();
            const BRIDGE_ROLE = await Subscription.BRIDGE_ROLE();

            {

                await expect(SubscriptionBalance.connect(anotherAccount).withdrawAllOwnerBalance(
                    subscriber.address,
                    nftID
                )).to.be.revertedWith("Caller not the NFT owner");

                console.log("before subscriber owner bal");
                await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(
                    subscriber.address,
                    nftID
                );
                console.log("after subscriber");

                await subscribeSnapshot.restore();

                await expect(SubscriptionBalance.connect(bridge).withdrawAllOwnerBalance(
                    bridge.address,
                    nftID
                )).to.be.revertedWith("Caller not the NFT owner");


                console.log("before grant bridge role");
                await Subscription.connect(admin).grantRole(BRIDGE_ROLE, bridge.address);

                console.log("before bridge");
                await SubscriptionBalance.connect(bridge).withdrawAllOwnerBalance(
                    bridge.address,
                    nftID
                );
                console.log("after bridge");

                await subscribeSnapshot.restore();

                await expect(SubscriptionBalance.connect(billingManager).withdrawAllOwnerBalance(
                    billingManager.address,
                    nftID
                )).to.be.revertedWith("Caller not the NFT owner");
    
                await appNFT.connect(subscriber).grantRole(nftID, BILLING_MANAGER_ROLE, billingManager.address);
                
                console.log("bfore billing");
                await SubscriptionBalance.connect(billingManager).withdrawAllOwnerBalance(
                    billingManager.address,
                    nftID
                );
                console.log("after billing");
                

                await subscribeSnapshot.restore();
            }


            {
                const withdrawAmount = balanceToAdd.div(2);
                await expect(SubscriptionBalance.connect(anotherAccount).withdrawBalance(
                    subscriber.address,
                    nftID,
                    withdrawAmount
                )).to.be.revertedWith("Caller not the NFT owner");

                await SubscriptionBalance.connect(subscriber).withdrawBalance(
                    subscriber.address,
                    nftID,
                    withdrawAmount
                );

                await subscribeSnapshot.restore();

                await expect(SubscriptionBalance.connect(bridge).withdrawBalance(
                    subscriber.address,
                    nftID,
                    withdrawAmount
                )).to.be.revertedWith("Caller not the NFT owner");


                await Subscription.connect(admin).grantRole(BRIDGE_ROLE, bridge.address);

                await SubscriptionBalance.connect(bridge).withdrawBalance(
                    subscriber.address,
                    nftID,
                    withdrawAmount
                );

                await subscribeSnapshot.restore();

                await expect(SubscriptionBalance.connect(billingManager).withdrawBalance(
                    billingManager.address,
                    nftID,
                    withdrawAmount
                )).to.be.revertedWith("Caller not the NFT owner");
    
                await appNFT.connect(subscriber).grantRole(nftID, BILLING_MANAGER_ROLE, billingManager.address);
                
                await SubscriptionBalance.connect(billingManager).withdrawBalance(
                    billingManager.address,
                    nftID,
                    withdrawAmount
                );
                

                await subscribeSnapshot.restore();
            }





            {
                const addBalance = ethers.utils.parseEther("0.0001");
                const expiry = 60 * 60 * 24 * 10;
                await getXCTAmount(creditor, addBalance, SubscriptionBalance);

                await expect(SubscriptionBalance.connect(anotherAccount).addBalanceAsCredit(
                    creditor.address,
                    nftID,
                    addBalance,
                    expiry
                )).to.be.revertedWith("Sender should be caller");


                console.log("before creditor");
                await SubscriptionBalance.connect(creditor).addBalanceAsCredit(
                    creditor.address,
                    nftID,
                    addBalance,
                    expiry
                );
                console.log("after creditor");

                await subscribeSnapshot.restore();

                await getXCTAmount(creditor, addBalance, SubscriptionBalance);

                await expect(SubscriptionBalance.connect(bridge).addBalanceAsCredit(
                    creditor.address,
                    nftID,
                    addBalance,
                    expiry
                )).to.be.revertedWith("Sender should be caller");

                
                await Subscription.connect(admin).grantRole(BRIDGE_ROLE, bridge.address);


                await SubscriptionBalance.connect(bridge).addBalanceAsCredit(
                    creditor.address,
                    nftID,
                    addBalance,
                    expiry
                );

                await subscribeSnapshot.restore();





                await getXCTAmount(external, addBalance, SubscriptionBalance);

                await expect(SubscriptionBalance.connect(anotherAccount).addBalanceAsExternalDeposit(
                    external.address,
                    nftID,
                    addBalance
                )).to.be.revertedWith("Sender should be caller");


                SubscriptionBalance.connect(external).addBalanceAsExternalDeposit(
                    external.address,
                    nftID,
                    addBalance
                );
                
                await subscribeSnapshot.restore();


                await getXCTAmount(external, addBalance, SubscriptionBalance);

                await expect(
                    SubscriptionBalance.connect(bridge).addBalanceAsExternalDeposit(
                        external.address,
                        nftID,
                        addBalance
                    )
                ).to.be.revertedWith("Sender should be caller");


                await Subscription.connect(admin).grantRole(BRIDGE_ROLE, bridge.address);

                await SubscriptionBalance.connect(bridge).addBalanceAsExternalDeposit(
                    external.address,
                    nftID,
                    addBalance
                );


                await subscribeSnapshot.restore();




                await getXCTAmount(creditor, addBalance, SubscriptionBalance);

                await SubscriptionBalance.connect(creditor).addBalanceAsCredit(
                    creditor.address,
                    nftID,
                    addBalance,
                    expiry
                );


                await time.increaseTo(await time.latest() + expiry);

                const expirySnapshot = await takeSnapshot();

                await expect(SubscriptionBalance.connect(anotherAccount).withdrawCreditsForNFT(
                    creditor.address,
                    nftID,
                    creditor.address
                )).to.be.revertedWith("Sender should be caller");


                await SubscriptionBalance.connect(creditor).withdrawCreditsForNFT(
                    creditor.address,
                    nftID,
                    creditor.address
                );
                
                await expirySnapshot.restore();

                await expect(SubscriptionBalance.connect(bridge).withdrawCreditsForNFT(
                    creditor.address,
                    nftID,
                    creditor.address
                )).to.be.revertedWith("Sender should be caller");
                
                await Subscription.connect(admin).grantRole(BRIDGE_ROLE, bridge.address);

                await SubscriptionBalance.connect(bridge).withdrawCreditsForNFT(
                    creditor.address,
                    nftID,
                    creditor.address
                );


                await subscribeSnapshot.restore();
            }



            tr = await appNFT.mint(subscriber.address);
            rec = await tr.wait();

            let nftID1 = await getAppNFTID(rec.transactionHash);


            await expect(SubscriptionBalance.connect(subscriber).subscribeNew(
                nftID1
            )).to.be.revertedWith("Only callable by Subscription");

            
            await expect(SubscriptionBalance.connect(subscriber).updateBalanceImmediate(
                nftID
            )).to.be.revertedWith("Only callable by AppDeployment");


            
            await expect(SubscriptionBalance.connect(subscriber).addRevBalance(
                anotherAccount.address,
                ethers.utils.parseEther("0.001")
            )).to.be.revertedWith("Do not have access to call this");


            await expect(SubscriptionBalance.connect(subscriber).addRevBalanceBulk(
                [anotherAccount.address],
                [ethers.utils.parseEther("0.001")]
            )).to.be.revertedWith("Do not have access to call this");


            await initSnapshot.restore();

            
            {
                const newSubscription = await helper.deploySubscription();

                
                await expect(SubscriptionBalanceCalculator.connect(anotherAccount).setSubscriptionContract(
                    newSubscription
                )).to.be.reverted;

                await SubscriptionBalanceCalculator.connect(owner).setSubscriptionContract(
                    newSubscription
                );

                await initSnapshot.restore();





                const newSubBal = await helper.deploySubscriptionBalance();

                await expect(SubscriptionBalanceCalculator.connect(anotherAccount).setSubscriptionBalanceContract(
                    newSubBal
                )).to.be.reverted;

                await SubscriptionBalanceCalculator.connect(owner).setSubscriptionBalanceContract(
                    newSubBal
                );

                await initSnapshot.restore();




                const newDAODist = await helper.deploySubnetDAODistributor();

                await expect(SubscriptionBalanceCalculator.connect(anotherAccount).setSubnetDAODistributor(
                    newDAODist
                )).to.be.reverted;

                await SubscriptionBalanceCalculator.connect(owner).setSubnetDAODistributor(
                    newDAODist
                );

                await initSnapshot.restore();




                const newAppDeployment = await helper.deployContractBasedDeployment();

                await expect(SubscriptionBalanceCalculator.connect(anotherAccount).setAppDeployment(
                    newAppDeployment
                )).to.be.reverted;

                await SubscriptionBalanceCalculator.connect(owner).setAppDeployment(
                    newAppDeployment
                );


                await initSnapshot.restore();

            }

        



            await expect(SubscriptionBalanceCalculator.connect(admin).distributeRevenue(
                nftID,
                10,
                10
            )).to.be.revertedWith("Only callable by SubBalance");

  
            await expect(SubscriptionBalanceCalculator.connect(admin).getUpdatedSubnetBalance(
                nftID,
                4,
                ethers.utils.parseEther("1"),
                [0]
            )).to.be.revertedWith("Only callable by SubBalance");


            await expect(SubscriptionBalanceCalculator.connect(admin).getUpdatedBalanceImmediate(
                nftID,
                4,
                ethers.utils.parseEther("1"),
            )).to.be.revertedWith("Only callable by SubBalance");


            await expect(SubscriptionBalanceCalculator.connect(admin).getUpdatedBalance(
                nftID,
                4,
                ethers.utils.parseEther("1"),
                0,
                0
            )).to.be.revertedWith("Only callable by SubBalance");
        });

		
		

	})
})
