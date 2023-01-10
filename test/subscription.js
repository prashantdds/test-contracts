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

    describe("User can subscribe to any subnet", async() => {

        it("User with xct token can subscribe to any subnet", async () => {
            const subscribeTime = 420;
            const minTimeFunds = 300;

            const licenseFee = 10000;
            const supportFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2].address;
            const licenseAddress = addrList[3].address;
            const supportAddress = addrList[4].address;

            let xctAmount = ethers.utils.parseEther("0");
            const unitPrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];

            const serviceProviderAddress  = "test";
            const computeRequired = [1,2,3];

            // set the min time funds and global support fees to be passed to the contract constructors
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    minTimeFunds: minTimeFunds,
                    globalSupportAddress: supportAddress,
                    supportFee: supportFee,
                }
            });


            // deploying all the contracts
            await initContracts();


            // creating a subnet and pass unit prices as parameter
            const subnetID = await createSubnet(deployer, {
                unitPrices: unitPrices
            });


            // approve Subscription contract to withdraw xct from subscriber
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );
            

            // estimate the drip rate and see how much xct to add to balance
            xctAmount = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            xctAmount = xctAmount.mul(subscribeTime);
            

            // check if the subscriber has enough xct amount in the balance
            const curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }


            // Subscribe to the created subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            const beforeBalSupply = await xct.balanceOf(SubscriptionBalanceCalculator.address);
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                xctAmount,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();


            // Validating if the NFT is sent to the owner
            const nftID = await getAppNFTID(rec.transactionHash);
            console.log("NftID: ", nftID);
            const owner = await appNFT.ownerOf(nftID);
            expect(owner).to.be.equal(subscriber.address);


            // Validate if the xct is deducted from the subscriber
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(afterUserSupply.eq(xctAmount)).to.be.true;

            let afterBalSupply = await xct.balanceOf(SubscriptionBalanceCalculator.address);
            afterBalSupply = afterBalSupply.sub(beforeBalSupply);
            expect(afterBalSupply.eq(xctAmount)).to.be.true;


            // Validate if all the fields given are saved
            const subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnetID);
            const subReferralAddress = await Subscription.getReferralAddress(nftID, subnetID);
            const subLicenseAddress = await Subscription.getLicenseAddress(nftID, subnetID);
            const subSupportAddress = await Subscription.getSupportAddress(nftID, subnetID);
            const subLicenseFee = await Subscription.r_licenseFee(nftID, subnetID);
            let subComputeRequired = await Subscription.getComputesOfSubnet(nftID, subnetID);

            expect(subServiceProviderAddress).to.equal(serviceProviderAddress);
            expect(subReferralAddress).to.be.equal(referralAddress);
            expect(subLicenseAddress).to.be.equal(licenseAddress);
            expect(subSupportAddress).to.be.equal(supportAddress);
            expect(subLicenseFee).to.be.equal(licenseFee);

            subComputeRequired = subComputeRequired.map(compute => compute.toNumber());
            expect(subComputeRequired).to.eql(computeRequired);
    
        })
    })

    describe("Subscriber can pick a service provider address, and can change it only once after a time period", async() => {
        it("Subscriber can pick a service provider address, and can change it only once after a time period", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2].address;
            const licenseAddress = addrList[3].address;
            const supportAddress = addrList[4].address;
            const nullAddress = "0x0000000000000000000000000000000000000000";


            // setting the contract constructor parameters
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddress,
                    supportFee: supportFee,
                    reqdNoticeTimeSProvider: noticeTimeParam,
                    reqdCooldownSProvider: cooldownTimeParam,
                }
            })


            //deploying the contracts
            await initContracts();


            //checking if notice and cooldown time has been set
            const changeRequestDuration = await Subscription.CHANGE_REQUEST_DURATION();
            expect(changeRequestDuration.serviceAddressNoticeDuration.toNumber()).to.be.equal(noticeTimeParam);
            expect(changeRequestDuration.serviceAddressCooldownDuration.toNumber()).to.be.equal(cooldownTimeParam);

            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 420;
            const oldServiceProviderAddress  = "test";
            const newServiceProviderAddress = "newAddress";

            const computeRequired = [1,2,3];


            // create a subnet
            const subnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });

            
            // subscriber approves Subscription contract to withdraw xct
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );


            // estimate the amount of xct that needs to be withdrawn
            xctAmount = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            xctAmount = xctAmount.mul(subscribeDuration);
            

            // send xct to subscriber if not enough xct is in the balance
            const curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }


            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                xctAmount,
                0,
                subnetID,
                oldServiceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();
            const timeOfSubscription = await time.latest();

            const nftID = getAppNFTID(rec.transactionHash);
            

            // Validate if the service provider address given is saved
            let subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnetID);
            expect(subServiceProviderAddress).to.equal(oldServiceProviderAddress);

            // uint256 nftID,
            // uint256 subnetID,
            // string memory newServiceProvider,
            // address newSupportAddress,
            // address newLicenseAddress
            // Try requesting the service provider address change. It will fail
            // await expect(Subscription.connect(subscriber).requestChange(nftID, subnetID, newServiceProviderAddress, nullAddress, nullAddress))
            // .to.be.revertedWith("Cannot request before REQD_NOTICE_TIME_S_PROVIDER passed");


            //Increase the hardhat time to the end of notice time.
            const noticeEndTime = noticeTimeParam + timeOfSubscription;
            await time.increaseTo(noticeEndTime);


            //Request service provider change
            await Subscription.connect(subscriber).requestChange(nftID, subnetID, newServiceProviderAddress, nullAddress, nullAddress);
            const requestChangeTime = await time.latest();

            
            // Validate if the service provider address has not changed
            subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnetID);
            expect(subServiceProviderAddress).to.equal(oldServiceProviderAddress);

            //Try to apply the service provider change, which will fail
            await expect(Subscription.connect(subscriber).applyChange(nftID, subnetID)).to.be.revertedWith("Cannot apply before cooldown");

            //increase the hardhat time to the end of cooldown time.
            const cooldownEndTime = cooldownTimeParam + requestChangeTime;
            await time.increaseTo(cooldownEndTime);


            //Request service provider change
            await Subscription.connect(subscriber).applyChange(nftID, subnetID);


            // Validate if the service provider address is changed
            subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnetID);
            expect(subServiceProviderAddress).to.equal(newServiceProviderAddress);
        })
    })
	
	describe("User can subscribe to more than one subnet at a time", async () => {

        it("User with xct token can subscribe to any subnet", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddressList = [addrList[2].address, addrList[3].address, addrList[3].address];
            const licenseAddressList = [addrList[0].address, addrList[0].address, addrList[0].address];
            const supportAddressList = [addrList[6].address, addrList[6].address, addrList[6].address];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeTime = 420;
            const minTimeFunds = 300;
            const supportFee = 10000;
            const serviceProviderAddressList  = ["address1", "address2", "address3"];
            const licenseFeeList = [10000, 20000, 30000];
            const supportFeeList = [10000, 10000, 10000];
            const computeRequiredList = [[1,2,3], [3,1,0], [4,5,6]];
            let subnetList = [];
            const subnetCount = 3;


            // set the min time funds and global support fees to be passed to the contract constructors
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddressList[0],
                    minTimeFunds: minTimeFunds,
                    supportFee: supportFee,
                }
            });


            // deploying all the contracts
            await initContracts();


            // creating a number of subnets
            for(var i = 0; i < subnetCount; i++) {
                const subnetID = await createSubnet(deployer, {
                    unitPrices: [
                        ethers.utils.parseEther("0.0001"),
                        ethers.utils.parseEther("0.0002"),
                        ethers.utils.parseEther("0.0003"),
                    ]
                });
                subnetList.push(subnetID);
            }

            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );
            

            // calculating the xct amount
            xctAmount = ethers.utils.parseEther("0");
            for(var i = 0; i < subnetCount; i++)
            {
                const subnetID = subnetList[i];
                const estimate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFeeList[i], supportFeeList[i], computeRequiredList[i]);
                xctAmount = xctAmount.add(estimate);
            }
            xctAmount = xctAmount.mul(subscribeTime);


            // adding amount if the subscriber does not have enough balance
            const curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }


            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribeBatch(
                false,
                xctAmount,
                0,
                subnetList,
                serviceProviderAddressList,
                referralAddressList,
                licenseAddressList,
                supportAddressList,
                licenseFeeList,
                computeRequiredList
                );
            rec = await tr.wait();


            // Validating if the NFT is sent to the owner
            const nftID = await getAppNFTID(rec.transactionHash);


            // Validate if the service provider address given is saved
            for(var i = 0; i < subnetCount; i++) {
                const subnetID = subnetList[i];
                const subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnetID);
                const subReferralAddress = await Subscription.getReferralAddress(nftID, subnetID);
                const subLicenseFee = await Subscription.r_licenseFee(nftID, subnetID);
                const subLicenseAddress = await Subscription.getLicenseAddress(nftID, subnetID);
                const subSupportAddress = await Subscription.getSupportAddress(nftID, subnetID);
                let subComputeRequired = await Subscription.getComputesOfSubnet(nftID, subnetID);
                
                expect(subServiceProviderAddress).to.equal(serviceProviderAddressList[i]);
                expect(subReferralAddress).to.be.equal(referralAddressList[i]);
                expect(subLicenseFee).to.be.equal(licenseFeeList[i]);
                expect(subLicenseAddress).to.be.equal(licenseAddressList[i]);
                expect(subSupportAddress).to.be.equal(supportAddressList[i]);
                subComputeRequired = subComputeRequired.map(compute => compute.toNumber());
                expect(subComputeRequired).to.eql(computeRequiredList[i]);
        
            }

        })
    })
	
    describe("Subscriber can transfer a subscription to another subnet", async() => {

        it("Subscriber can transfer a subscription to another subnet", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2].address;
            const licenseAddress = addrList[3].address;
            const supportAddress = addrList[4].address;
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeTime = 420;
            const serviceProviderAddress = "address";

            const licenseFee = 10000;
            const minTimeFunds = 300;
            const supportFee = 10000;
            const computeRequired = [1,2,3];


            // set the min time funds and global support fees to be passed to the contract constructors
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddress,
                    minTimeFunds: minTimeFunds,
                    supportFee: supportFee,
                }
            });


            // deploying all the contracts
            await initContracts();


            // create the 1st subnet
            const subnet1ID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });


            // approve the xct to the subscriber
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );


            // transfer the xct if the subscriber does not have enough balance
            xctAmount = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnet1ID, licenseFee, supportFee, computeRequired);
            xctAmount = xctAmount.mul(subscribeTime);
            
            let curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }


            // Subscribing to the 1st subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                xctAmount,
                0,
                subnet1ID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();


            // Get the minted appNFT
            const nftID = getAppNFTID(rec.transactionHash);
            

            // create the 2nd subnet
            const subnet2ID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0004"),
                    ethers.utils.parseEther("0.0005"),
                    ethers.utils.parseEther("0.0008"),
                ]
            });


            // transfer xct if subscriber does not have enough balance for the 2nd subnet
            xctAmount = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnet2ID, licenseFee, supportFee, computeRequired);
            xctAmount = xctAmount.mul(subscribeTime);
            
            curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }

            
            // try to change from 1st subnet to 2nd subnet. It will fail as 1nd subnet is not delisted
            await expect(Subscription.connect(subscriber).changeSubnetSubscription(
                nftID,
                subnet1ID,
                subnet2ID
            )).to.be.revertedWith("Cannot change subscription if subnet is not delisted");


            //delist the 1st subnet
            await Registration.connect(deployer).changeSubnetAttributes(
                subnet1ID,
                4,
                0,
                true,
                0,
                false,
                [],
                0,
                0,
                0,
                subscriber.address
            );

            
            // switch the subscription to the 2nd subnet
            await Subscription.connect(subscriber).changeSubnetSubscription(
                nftID,
                subnet1ID,
                subnet2ID
            );


            // validate if all the values are the same as given for the 1st subnet
            const subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnet2ID);
            const subReferralAddress = await Subscription.getReferralAddress(nftID, subnet2ID);
            const subLicenseFee = await Subscription.r_licenseFee(nftID, subnet2ID);
            const subLicenseAddress = await Subscription.getLicenseAddress(nftID, subnet2ID);
            const subSupportAddress = await Subscription.getSupportAddress(nftID, subnet2ID);
            let subComputeRequired = await Subscription.getComputesOfSubnet(nftID, subnet2ID);
            subComputeRequired = subComputeRequired.map(compute => compute.toNumber());

            expect(subServiceProviderAddress).to.equal(serviceProviderAddress);
            expect(subReferralAddress).to.be.equal(referralAddress);
            expect(subLicenseFee).to.be.equal(licenseFee);
            expect(subLicenseAddress).to.be.equal(licenseAddress);
            expect(subSupportAddress).to.be.equal(supportAddress);
            expect(subComputeRequired).to.eql(computeRequired);


            // check if the subscription to the 1st subnet is stopped and the subscription to the 2nd subnet is active
            const subnet1SubscribedFlag = await Subscription.checkSubscribed(nftID, subnet1ID);
            const subnet2SubscribedFlag = await Subscription.checkSubscribed(nftID, subnet2ID);
            expect(subnet1SubscribedFlag).to.be.false;
            expect(subnet2SubscribedFlag).to.be.true;
        })
    
	})

    describe("Subscription calculation", async() => {
        it("The xct given by subscriber is transferred to other accounts [r, s, t, u]", async () => {
            const deployer = addrList[0];
            const globalDAOAddress = addrList[0];
            const subnetDAOAddress = addrList[0];
            const supportAddress = addrList[10].address;
            const subscriber = addrList[2];
            const referralAddress = addrList[3].address;
            const licenseAddress = addrList[4].address;
            const clusterAddressList = [addrList[5], addrList[6], addrList[7]];
            const subnetFees = ethers.utils.parseEther("0.01");
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const subscribeDuration = 60 * 60 * 24 * 30;
            const daoRate = 3000;
            const referralPercent = 7000;
            const supportFee = 60000;

            const clusterCount = 3;
            const clusterWeightList = [100, 300, 750];
            const totalClusterWeight = clusterWeightList.reduce((accum, weight) => accum + weight);
            const clusterIDList = [];
            const serviceProviderAddress  = "test";
            const licenseFee = 80;
            // const licenseFee = 0;
            const computeRequired = [1,2,3];
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
            const durationTest = [60*60*24*7, 60*60*24*15, 60*60*24*22, 60*60*24*30];


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

            
            // deploy the contracts
            await initContracts();


            // creation of subnet
            const subnetID = await createSubnet(subnetDAOAddress, {
                unitPrices: subnetComputePrices,
                supportFeeRate: supportFee,
                stackFeesReqd: subnetFees,
            });


            // creation of clusters, and assigning weights to them
            for(var i = 0; i < clusterCount; i++) {
                const clusterID = await signupCluster(subnetID, subnetFees, clusterAddressList[i]);
                clusterIDList[i] = clusterID;
                await Registration.connect(subnetDAOAddress).approveListingCluster(subnetID, clusterID, clusterWeightList[i]);
            }


            // calculation of compute cost
            let computeCost = ethers.utils.parseEther("0");
            for(var i = 0; i < subnetComputePrices.length; i++) {
                const multCost = subnetComputePrices[i].mul(computeRequired[i]);
                computeCost = computeCost.add(multCost);
            }


            //calulation of r,s,t,u
            let r = licenseFee;
            let s = daoRate;
            let t = supportFee;
            let u = referralPercent;
            const totalPercentage = (100000 + s + t + u);

            
            //calculated xct drip rate per sec
            let calcXCTPerSec = computeCost.mul(totalPercentage).div(100000);
            calcXCTPerSec = calcXCTPerSec.add(r);

            // approve xct to be transferred to subscription contract
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );


            //get the estimated xct amount
            let xctPerSec = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);


            // check if the calculated xct matches with the estimated xct from the contract
            expect(xctPerSec.eq(calcXCTPerSec)).to.be.true;


            //multiply the xct amount with the subscription time
            let xctBalanceToAdd = xctPerSec.mul(subscribeDuration);
            const totalXCTAmount = xctBalanceToAdd;


            //transfer to subscriber if the balance is not enough
            const curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctBalanceToAdd)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctBalanceToAdd);
            }


            //register the support address with the fees
            await Subscription.addSupportAddress(supportAddress, supportFee);


            //Subscribe to the subnet
            const beforeUserSupply = await xct.balanceOf(subscriber.address);
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                xctBalanceToAdd,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            const subscribeTime = await time.latest();
            rec = await tr.wait();
            const nftID = await getAppNFTID(rec.transactionHash);

            await SubscriptionBalance.updateBalance(nftID);

            // check if the xct deducted from the subscriber wallet is as calculated
            let afterUserSupply = await xct.balanceOf(subscriber.address);
            afterUserSupply = beforeUserSupply.sub(afterUserSupply);
            expect(xctBalanceToAdd.eq(afterUserSupply)).to.be.true;


            //calculate unsettled balances at several points of time
            let withdrawnSubnetDAOAmount = ethers.utils.parseEther("0");
            for(var i = 0; i < durationTest.length; i++)
            {
                //get the point of time
                const prevDur = ((i > 0) ? durationTest[i-1] : 0);
                const durTime = subscribeTime + durationTest[i]; // + ((i==durationTest.length-1)? (60*60*24*48) : 0); //   60*60*24*1 + 60*60*12 + 60*36
                
                //jump to that time in hardhat node
                await time.increaseTo(durTime);

                // get the current balance balance from the contract
                const beforeUpdateTime = await time.latest();
                await SubscriptionBalance.updateBalance(nftID);
                const afterUpdateTime = await time.latest();
                const afterUpdateDuration = afterUpdateTime - beforeUpdateTime;
                // const afterUpdateDuration = 0;

                console.log("updateTime:", afterUpdateDuration);
                // get the total balance from the contract after the updateBalance call
                const curBal = await SubscriptionBalance.totalPrevBalance(nftID);

                // calculate the current balance by using the calcXCTPerSec multiplied with the duration since last update call.
                //duration after updating/settling balance is added with the time taken by updateBalance call
                const durAfterSettle = Math.min(durationTest[i] + afterUpdateDuration, subscribeDuration);
                // calculate the duration since the last updateBalance call. Do not add the updateBalance call time if
                // the time point is at the end of subscription as that will be an extra amount of balance added in the calculation.
                const durSincePrev = durAfterSettle - prevDur - ((i>0)? afterUpdateDuration: 0);
                // calculate the balance that is supposed to be there after previous updateBalance calls.
                const calcCurBal = totalXCTAmount.sub(calcXCTPerSec.mul(durAfterSettle));

                //compare the calculated and the actual current balance
                console.log("curbal: ", curBal, calcCurBal);
                expect(curBal.eq(calcCurBal)).to.be.true;

                // calculate the xct amount each account is supposed to get
                const calcBal1 = computeCost.mul(100000).mul(durSincePrev).div(100000);
                const calcBalR = r * durSincePrev;
                const calcBalS = computeCost.mul(s).mul(durSincePrev).div(100000);
                const calcBalT = computeCost.mul(t).mul(durSincePrev).div(100000);
                const calcBalU = computeCost.mul(u).mul(durSincePrev).div(100000);


                // find out the amount that SubnetDAODistributor (1) gets
                let beforeBal = await xct.balanceOf(SubnetDAODistributor.address);
                await SubscriptionBalanceCalculator.receiveRevenueForAddress(SubnetDAODistributor.address);
                let afterBal = await xct.balanceOf(SubnetDAODistributor.address);
                let bal1 = afterBal.sub(beforeBal);

                // find out the amount that the license address (R) gets
                beforeBal = await xct.balanceOf(licenseAddress);
                await SubscriptionBalanceCalculator.receiveRevenueForAddress(licenseAddress);
                afterBal = await xct.balanceOf(licenseAddress);
                const balR = afterBal.sub(beforeBal);

                // find out the amount that the globalDAO (S) gets
                beforeBal = await xct.balanceOf(globalDAOAddress.address);
                await SubscriptionBalanceCalculator.receiveRevenueForAddress(globalDAOAddress.address);
                afterBal = await xct.balanceOf(globalDAOAddress.address);
                const balS = afterBal.sub(beforeBal);

                // find out the amount that the Support address (T) gets
                beforeBal = await xct.balanceOf(supportAddress);
                await SubscriptionBalanceCalculator.receiveRevenueForAddress(supportAddress);
                afterBal = await xct.balanceOf(supportAddress);
                const balT = afterBal.sub(beforeBal);

                // find out the amount that the Referral address (U) gets
                beforeBal = await xct.balanceOf(referralAddress);
                await SubscriptionBalanceCalculator.receiveRevenueForAddress(referralAddress);
                afterBal = await xct.balanceOf(referralAddress);
                const balU = afterBal.sub(beforeBal);

                console.log("calc:" ,calcBal1, calcBal1.sub(computeCost));
                console.log("actual:", bal1);
                expect(bal1.eq(calcBal1)).to.be.true;
                expect(balR.eq(calcBalR)).to.be.true;
                expect(balS.eq(calcBalS)).to.be.true;
                expect(balT.eq(calcBalT)).to.be.true;
                expect(balU.eq(calcBalU)).to.be.true;

                
                // Testing the distribution of revenue to the clusters

                // calculate the balances for each cluster
                beforeBal = await xct.balanceOf(SubnetDAODistributor.address);
                await SubnetDAODistributor.collectAndAssignRevenues(subnetID);
                for(var c = 0; c < clusterCount; c++)
                {
                    const calcClusterBal = bal1.mul(clusterWeightList[c]).div(totalClusterWeight); 
                    
                    const beforeClusterSupply = await xct.balanceOf(clusterAddressList[c].address);

                    await SubnetDAODistributor.claimAllRevenueFor(clusterAddressList[c].address);
                    
                    const afterClusterSupply = await xct.balanceOf(clusterAddressList[c].address);
                    const clusterBal = afterClusterSupply.sub(beforeClusterSupply);

                    // console.log(calcClusterBal, clusterBal);
                    withdrawnSubnetDAOAmount = withdrawnSubnetDAOAmount.add(clusterBal);

                    expect(clusterBal.eq(calcClusterBal)).to.be.true;
                }
                afterBal = await xct.balanceOf(SubnetDAODistributor.address);
                afterBal = afterBal.sub(beforeBal);
                // console.log("amount in subnetDAO, ", afterBal, bal1);
            }
        })
    })
	
	describe("appNFT cannot subscribe to subnets after a certain limit", async () => {

        it("appNFT cannot subscribe to subnets after a certain limit", async () => {
            const deployer = addrList[0];
            const globalDAOAddress = addrList[0];
            const subscriber = addrList[2];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeTime = 420;
            const serviceProviderAddressList  = ["address1", "address2", "address3"];
            const referralAddressList = [addrList[2].address, addrList[3].address, addrList[3].address];
            const licenseAddressList = [addrList[4].address, addrList[4].address, addrList[4].address];
            const supportAddressList = [addrList[5].address, addrList[5].address, addrList[5].address];
            const supportFee = 100000;
            const licenseFeeList = [10000, 20000, 30000];
            const computeRequiredList = [[1,2,3], [3,1,0], [4,5,6]];
            let subnetList = [];
            const subnetCount = 3;
            const lastSubnetSpAddr  = "address4";
            const lastSubnetLicFee = 10000;
            const lastSubnetLicAddr = addrList[4].address;
            const lastSubnetReffAddr = addrList[2].address;
            const lastSubnetSuppAddr = globalDAOAddress.address;
            const lastSubnetCompute = [1,1,2];
            const maxSubnets = 3;
            const minTimeFunds = 300;
            const referralExpiry = 60 * 60 * 24 *100;
            const daoRate = 3000;
            const referralPercent = 7000;
            const subnetComputePrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
            ];
    
            
            // setting the globalDAO address, daoRate, supportFees, referralPercent 
            // min time for dripRate parameters for contract deployment
            // the minimum subnets for NFT parameter is also passed
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAOAddress.address,
                    daoRate: daoRate,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAOAddress.address,
                    globalSupportAddress: supportAddressList[0],
                    supportFee: supportFee,
                    minTimeFunds: minTimeFunds,
                    limitNFTSubnets: maxSubnets,
                },
                subscriptionBalance: {
                    ...helper.parameters.subscriptionBalance,
                    referralPercent: referralPercent,
                    referralRevExpirySecs: referralExpiry,
                },
            });


            // deploying the contracts
            await initContracts();


            // creating a number of subnets
            for(var i = 0; i < subnetCount; i++) {
                const subnetID = await createSubnet(deployer, {
                    unitPrices: subnetComputePrices
                });
                subnetList.push(subnetID);
            }


            // creating another subnet
            const lastSubnetID = await createSubnet(deployer, {
                unitPrices: [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                ]
            });


            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );
            

            // calculating the xct amount for the 3 subnets
            xctAmount = ethers.utils.parseEther("0");
            for(var i = 0; i < subnetCount; i++) {
                const estimate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetList[i],
                    licenseFeeList[i],
                    supportFee,
                    computeRequiredList[i]);
        
                xctAmount = xctAmount.add(estimate);
            }

            // add the estimate for the last subnet to the xct amount
            const lastSubnetEstimate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(
                lastSubnetID,
                lastSubnetLicFee,
                supportFee,
                lastSubnetCompute);
            xctAmount = xctAmount.add(lastSubnetEstimate);
            
            //multiply the xct amount with the subscribe time
            xctAmount = xctAmount.mul(subscribeTime);


            // adding amount if the subscriber does not have enough balance
            const curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }


            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribeBatch(
                false,
                xctAmount,
                0,
                subnetList,
                serviceProviderAddressList,
                referralAddressList,
                licenseAddressList,
                supportAddressList,
                licenseFeeList,
                computeRequiredList
                );
            rec = await tr.wait();


            // Validating if the NFT is sent to the owner
            const nftID = await getAppNFTID(rec.transactionHash);


            // Validate if the service provider address given is saved
            for (var i = 0; i < subnetCount; i++)
            {
                const subnetID = subnetList[i];
                const subServiceProviderAddress = await Subscription.getServiceProviderAddress(nftID, subnetID);
                const subReferralAddress = await Subscription.getReferralAddress(nftID, subnetID);
                const subLicenseFee = await Subscription.r_licenseFee(nftID, subnetID);
                let subComputeRequired = await Subscription.getComputesOfSubnet(nftID, subnetID);
                
                expect(subServiceProviderAddress).to.equal(serviceProviderAddressList[i]);
                expect(subReferralAddress).to.be.equal(referralAddressList[i]);
                expect(subLicenseFee).to.be.equal(licenseFeeList[i]);
                subComputeRequired = subComputeRequired.map(compute => compute.toNumber());
                expect(subComputeRequired).to.eql(computeRequiredList[i]);
            }


            // subscribing to the last subnet, which should fail as the subnet limit has been reached
            await expect(Subscription.connect(subscriber).subscribe(
                true,
                0,
                nftID,
                lastSubnetID,
                lastSubnetSpAddr,
                lastSubnetReffAddr,
                lastSubnetLicAddr,
                lastSubnetSuppAddr,
                lastSubnetLicFee,
                lastSubnetCompute
            )).to.be.revertedWith("Cannot subscribe as limit exceeds to max Subnet subscription allowed per NFT");
        })
    })

    describe("testing of 3 balances of a NFT: Credit, External and NFT balances", async() => {

        it("expenditure gets deducted in order from the credit, external and the nft amounts", async () => {
            const noticeTimeParam = 2592000;
            const cooldownTimeParam = 1296000;
            const supportFee = 10000;
            const licenseFee = 10000;

            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2].address;
            const supportAddress = addrList[5].address;
            const licenseAddress = addrList[3].address;
            const creditExpiry = 60 * 60 * 24 * 100;
            const creditDepositor = addrList[4];
            const externalDepositor = addrList[5];
            const nftDepositor = subscriber;
            let creditAmount = ethers.utils.parseEther("0");
            let externalAmount = ethers.utils.parseEther("0");
            let nftAmount = ethers.utils.parseEther("0");
            const creditDuration = 500;
            const externalDuration = 400;
            const nftDuration = 300;
            const serviceProviderAddress  = "test";
            const computeRequired = [1,2,3];

            // setting the contract constructor parameters
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddress,
                    supportFee: supportFee,
                    reqdNoticeTimeSProvider: noticeTimeParam,
                    reqdCooldownSProvider: cooldownTimeParam,
                }
            })


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

            
            // subscriber approves Subscription contract to withdraw xct
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );


            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);


            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                0,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();


            // get the NFT ID that is minted during subscription
            const nftID = getAppNFTID(rec.transactionHash);
            

            // check if subscription balance is empty
            let balance = await SubscriptionBalance.totalPrevBalance(nftID);
            expect(balance.eq(0)).to.be.true;

            
            // calculate the amounts to deposit by multiplying the drip rate with the deposit duration
            creditAmount = dripRate.mul(creditDuration);
            externalAmount = dripRate.mul(externalDuration);
            nftAmount = dripRate.mul(nftDuration);


            // add amount to credit depositor if depositor's balance is less
            let creditDepositorBalance = await xct.balanceOf(creditDepositor.address);
            if(creditDepositorBalance.lt(creditAmount)) {
                await xct.connect(deployer).transfer(creditDepositor.address,  creditAmount);
            }
            //approve subscription balance to withdraw xct out of depositor's wallet
            await xct.connect(creditDepositor).approve(
                SubscriptionBalance.address,
                creditAmount
            );

            
            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(creditDepositor).addBalanceAsCredit(nftID, creditAmount, creditExpiry);
            const creditDepositTime = await time.latest();


            // check if the subscription balance has the right credit amount
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(creditAmount)).to.be.true;
            

            // add amount to external depositor if depositor's balance is less
            let externalDepositorBalance = await xct.balanceOf(externalDepositor.address);
            if(externalDepositorBalance.lt(externalAmount)) {
                await xct.connect(deployer).transfer(externalDepositor.address,  externalAmount);
            }
            //approve subscription balance to withdraw xct out of depositor's wallet
            await xct.connect(externalDepositor).approve(
                SubscriptionBalance.address,
                externalAmount
            );


            // add external deposit
            await SubscriptionBalance.connect(externalDepositor).addBalanceAsExternalDeposit(nftID, externalAmount);


            // check if the external amount is the same as the deposited amount.
            //The credit amount will be slightly deducted due to the time taken by contract calls
            balance = await SubscriptionBalance.prevBalances(nftID);
            // expect(balance[0].eq(creditAmount.sub(dripRate.mul(externalDepositTime - creditDepositTime)))).to.be.true;
            expect(balance[1].eq(externalAmount)).to.be.true;


            // send xct to subscriber if not enough xct is in the balance
            const nftDepositorBalance = await xct.balanceOf(nftDepositor.address);
            if(nftDepositorBalance.lt(nftAmount)) {
                await xct.connect(deployer).transfer(nftDepositor.address,  nftAmount);
            }
            //approve subscription balance to withdraw xct out of depositor's wallet
            await xct.connect(nftDepositor).approve(
                SubscriptionBalance.address,
                nftAmount
            );


            //add the nft balance
            await SubscriptionBalance.connect(nftDepositor).addBalance(nftID,  nftAmount);


            //check if the nft amount is correctly added.
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[1].eq(externalAmount)).to.be.true;
            expect(balance[2].eq(nftAmount)).to.be.true;


            // increase the time to half the credit duration
            await time.increaseTo(creditDepositTime + creditDuration/2);

            //update the balance for expenditures
            await SubscriptionBalance.updateBalance(nftID);
            
            //calculate the half credit amount, get the actual amounts, and compare if the credit amount is deducted
            // and other amounts remain the same
            const calcHalfCreditAmount = creditAmount.sub(dripRate.mul(await time.latest() - creditDepositTime));
            balance = await SubscriptionBalance.prevBalances(nftID);
            expect(balance[0].eq(calcHalfCreditAmount)).to.be.true;
            expect(balance[1].eq(externalAmount)).to.be.true;
            expect(balance[2].eq(nftAmount)).to.be.true;


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
            const referralAddress = addrList[2].address;
            const supportAddress = addrList[5].address;
            const licenseAddress = addrList[3].address;
            const depositor = addrList[4];
            const expiryDuration = 60 * 60 * 24 * 5;
            const dep1DripDur = 60 * 60 * 24 * 10;
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 420;
            const serviceProviderAddress  = "test";

            const computeRequired = [1,2,3];

            // setting the contract constructor parameters
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddress,
                    supportFee: supportFee,
                    reqdNoticeTimeSProvider: noticeTimeParam,
                    reqdCooldownSProvider: cooldownTimeParam,
                }
            })


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

            
            // subscriber approves Subscription contract to withdraw xct
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );


            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            xctAmount = dripRate.mul(subscribeDuration);
            

            // send xct to subscriber if not enough xct is in the balance
            const curBalance = await xct.balanceOf(subscriber.address);
            if(curBalance.lt(xctAmount)) {
                await xct.connect(deployer).transfer(subscriber.address,  xctAmount);
            }


            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                0,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();


            // get the NFT ID that is minted during subscription
            const nftID = getAppNFTID(rec.transactionHash);
            

            // calculate the amount to deposit by multiplying the drip rate with the deposit duration
            depositBalance = dripRate.mul(dep1DripDur);
            

            // add amount to depositor if depositor's balance is less
            let currentDepositorBalance = await xct.balanceOf(depositor.address);
            if(currentDepositorBalance.lt(depositBalance)) {
                await xct.connect(deployer).transfer(depositor.address,  depositBalance);
            }
            //approve subscription balance to withdraw xct out of depositor's wallet
            await xct.connect(depositor).approve(
                SubscriptionBalance.address,
                depositBalance
            );


            // calculate the time of expiry
            const expiryTime = await time.latest() + expiryDuration;


            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor).addBalanceAsCredit(nftID, depositBalance, expiryTime);


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
            await expect(SubscriptionBalance.connect(depositor).withdrawCreditsForNFT(nftID, deployer.address))
            .to.be.revertedWith("Credits not expired yet");


            // increase the time to the expiry time
            await time.increaseTo(addBalanceTime + expiryDuration);


            // call updateBalance to settle the expenditures
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();


            // calculate the balance, get the actual balance from contract, and see if they are equal
            // the time taken by updateBalance is added into the drip calculation
            let calcExpiryBal = depositBalance.sub(dripRate.mul(afterUpdateTime - addBalanceTime));
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(calcExpiryBal)).to.be.true;


            //call the withdraw function. It should work after the expiry time has passed.
            let beforeSupply = await xct.balanceOf(deployer.address);
            let beforeWithdrawTime = await time.latest();
            await SubscriptionBalance.connect(depositor).withdrawCreditsForNFT(nftID, deployer.address);
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
            const referralAddress = addrList[2].address;
            const supportAddress = addrList[8].address;
            const licenseAddress = addrList[3].address;
            const depositor1 = addrList[4];
            const depositor2 = addrList[5];
            const serviceProviderAddress  = "test";
            const computeRequired = [1,2,3];
            // these values should not be changed
            let expiry1Dur = 60 * 60 * 24 * 15;
            let expiry2Dur = 60 * 60 * 24 * 5;
            let dep1DripDur = 60 * 60 * 24 * 18;
            let dep2DripDur = 60 * 60 * 24 * 6;

            // setting the contract constructor parameters
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddress,
                    supportFee: supportFee,
                    reqdNoticeTimeSProvider: noticeTimeParam,
                    reqdCooldownSProvider: cooldownTimeParam,
                }
            })


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

            
            // subscriber approves Subscription contract to withdraw xct
            await xct.connect(subscriber).approve(
                Subscription.address,
                ethers.utils.parseEther("1000000000")
            );


            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);


            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                0,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();


            // get the NFT ID that is minted during subscription
            const nftID = getAppNFTID(rec.transactionHash);
            

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
            await getAmountIfLess(depositor1, dep1Bal, SubscriptionBalance);
            await getAmountIfLess(depositor2, dep2Bal, SubscriptionBalance);
            
            let beforeDepositTime = await time.latest();

            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor1).addBalanceAsCredit(nftID, dep1Bal, expiry1Dur + beforeDepositTime);

            let firstDepositTime = await time.latest();

            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            let balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(dep1Bal)).to.be.true;


            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor2).addBalanceAsCredit(nftID, dep2Bal, expiry2Dur + firstDepositTime);


            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            balances = await SubscriptionBalance.prevBalances(nftID);
            let calcBal = dep1Bal.add(dep2Bal);
            calcBal = calcBal.sub(dripRate.mul(await time.latest() - firstDepositTime));
            expect(balances[0].eq(calcBal)).to.be.true;

            
            const snapshotAtFullAmount = await takeSnapshot();
            

            await time.increaseTo(beforeDepositTime + expiry2Dur/2);


            await SubscriptionBalance.updateBalance(nftID);
            let timeAfterUpdate = await time.latest();

            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = totalDep.sub(dripRate.mul(expiry2Dur/2));
            expect(balances[0].eq(calcBal)).to.be.true;

            await expect(SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address))
            .to.be.revertedWith("Credits not expired yet");
            await expect(SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(nftID, depositor2.address))
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
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(nftID, depositor2.address);
            let afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();
            
            afterSupply = afterSupply.sub(beforeSupply);
            let withdraw2Bal = dep2Bal;
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;

            await expect(SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address))
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
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
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
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
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
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(nftID, depositor2.address);
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
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
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
            await getAmountIfLess(depositor1, dep1Bal, SubscriptionBalance);
            await getAmountIfLess(depositor2, dep2Bal, SubscriptionBalance);


            beforeDepositTime = await time.latest();

            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor2).addBalanceAsCredit(nftID, dep2Bal, expiry2Dur + beforeDepositTime);

            firstDepositTime = await time.latest();

            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(dep2Bal)).to.be.true;

            await time.increaseTo(firstDepositTime + expiry2Dur/2);

            // deposit the balance as a creditor with the calculated deposit and the expiry time
            await SubscriptionBalance.connect(depositor1).addBalanceAsCredit(nftID, dep1Bal, expiry1Dur + beforeDepositTime);


            const snapshotAfterBothDeposit = await takeSnapshot();

            // get the 3 balances from contract, and check if the credit balance is equal to the deposited balance
            balances = await SubscriptionBalance.prevBalances(nftID);
            calcBal = dep1Bal.add(dep2Bal);
            calcBal = calcBal.sub(dripRate.mul(await time.latest() - firstDepositTime));
            expect(balances[0].eq(calcBal)).to.be.true;


            await time.increaseTo(firstDepositTime + expiry2Dur);


            beforeSupply = await xct.balanceOf(depositor2.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(nftID, depositor2.address);
            afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();

            withdraw2Bal = dep2Bal;
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;


            await expect(SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address))
            .to.be.revertedWith("Credits not expired yet");


            await time.increaseTo(firstDepositTime + expiry1Dur);

            beforeSupply = await xct.balanceOf(depositor1.address);
            timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
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
            await SubscriptionBalance.connect(depositor2).withdrawCreditsForNFT(nftID, depositor2.address);
            afterSupply = await xct.balanceOf(depositor2.address);
            timeAfterUpdate = await time.latest();

            withdraw2Bal = dep2Bal;
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw2Bal)).to.be.true;

            beforeSupply = await xct.balanceOf(depositor1.address);
            // timeBeforeUpdate = await time.latest();
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
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
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
            afterSupply = await xct.balanceOf(depositor1.address);
            timeAfterUpdate = await time.latest();

            withdraw1Bal = totalDep.sub(dripRate.mul(expiry1Dur + (timeAfterUpdate - timeBeforeUpdate)));
            // withdraw1Bal = withdraw1Bal.sub(dep2Bal);
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw1Bal)).to.be.true;


            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[0].eq(0)).to.be.true;

            beforeSupply = await xct.balanceOf(depositor1.address);
            await SubscriptionBalance.connect(depositor1).withdrawCreditsForNFT(nftID, depositor1.address);
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
            const anotherAccount = addrList[8];
            const referralAddress = addrList[2].address;
            const supportAddress = addrList[5].address;
            const licenseAddress = addrList[3].address;
            const subscribeDuration = 60 * 60 * 24 * 10;
            const secondDuration = 60 * 60 * 24 * 5;
            const serviceProviderAddress  = "test";

            const computeRequired = [1,2,3];

            // setting the contract constructor parameters
            helper.setParameters({
                registration: {
                    ...helper.parameters.registration,
                    globalDAO: globalDAO.address,
                },
                subscription: {
                    ...helper.parameters.subscription,
                    globalDAO: globalDAO.address,
                    globalSupportAddress: supportAddress,
                    supportFee: supportFee,
                    reqdNoticeTimeSProvider: noticeTimeParam,
                    reqdCooldownSProvider: cooldownTimeParam,
                }
            })


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


            // estimate the amount of xct that needs to be withdrawn
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);

            const snapshotBeforeSubscribe = await takeSnapshot();

            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                0,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();


            // get the NFT ID that is minted during subscription
            const nftID = getAppNFTID(rec.transactionHash);
            
            
            let balanceToAdd = dripRate.mul(subscribeDuration);
            let fullDep = balanceToAdd;
            await getAmountIfLess(subscriber, balanceToAdd, SubscriptionBalance);
            await SubscriptionBalance.connect(subscriber).addBalance(nftID, balanceToAdd);

            const snapshotAfterAddBalance = await takeSnapshot();

            let depositTime = await time.latest();

            let withdraw = balanceToAdd.div(2);
            let beforeSupply = await xct.balanceOf(subscriber.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawBalance(nftID, withdraw);
            let afterUpdateTime = await time.latest();
            let afterSupply = await xct.balanceOf(subscriber.address);

            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(withdraw)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
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
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = fullDep.sub(dripRate.mul(subscribeDuration/2 + (afterUpdateTime - beforeUpdateTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterAddBalance.restore();

            await time.increaseTo(depositTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(afterSupply.eq(0)).to.be.true;


            await snapshotAfterAddBalance.restore();

            withdraw = balanceToAdd.div(2);
            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawBalance(nftID, withdraw))
            .to.be.revertedWith("Sender not the owner of NFT id");

            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawAllOwnerBalance(nftID))
            .to.be.revertedWith("Sender not the owner of NFT id");


            await snapshotBeforeSubscribe.restore();

            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullSubscribeDep = balanceToAdd;
            await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            // Subscribing to the created subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                balanceToAdd,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress,
                licenseAddress,
                supportAddress,
                licenseFee,
                computeRequired
                );
            rec = await tr.wait();

            let subscribeTime = await time.latest();
            snapshotAfterSubscribe = await takeSnapshot();


            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(balanceToAdd)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = balanceToAdd.sub(dripRate.mul(afterUpdateTime - beforeUpdateTime));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;

            await snapshotAfterSubscribe.restore();

            await time.increaseTo(subscribeTime + subscribeDuration/2);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);

            calcBal = balanceToAdd.sub(dripRate.mul(subscribeDuration/2 + (afterUpdateTime - beforeUpdateTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            await snapshotAfterSubscribe.restore();

            await time.increaseTo(subscribeTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(beforeSupply.eq(afterSupply)).to.be.true;
            balances = await SubscriptionBalance.prevBalances(nftID);
            expect(balances[2].eq(0)).to.be.true;

            await snapshotAfterSubscribe.restore();

            let secondBalanceToAdd = dripRate.mul(secondDuration);
            await getAmountIfLess(subscriber, secondBalanceToAdd, SubscriptionBalance);
            await SubscriptionBalance.connect(subscriber).addBalance(nftID, secondBalanceToAdd);

            await time.increaseTo(subscribeTime + subscribeDuration);

            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
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
            .withdrawBalance(nftID, withdraw))
            .to.be.revertedWith("Sender not the owner of NFT id");

            await expect(SubscriptionBalance.connect(anotherAccount)
            .withdrawAllOwnerBalance(nftID))
            .to.be.revertedWith("Sender not the owner of NFT id");


            beforeSupply = await xct.balanceOf(subscriber.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterUpdateTime = await time.latest();
            afterSupply = await xct.balanceOf(subscriber.address);


            calcBal = fullSubscribeDep.sub(dripRate.mul((afterUpdateTime - afterRestoreTime)));
            afterSupply = afterSupply.sub(beforeSupply);
            expect(afterSupply.eq(calcBal)).to.be.true;


            beforeSupply = await xct.balanceOf(subscriber.address);
            await SubscriptionBalance.connect(subscriber).withdrawAllOwnerBalance(nftID);
            afterSupply = await xct.balanceOf(subscriber.address);

            expect(afterSupply.eq(beforeSupply)).to.be.true;
        })
	
        it("support address gets a share of the subscription amount", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3].address;
            const globalSupportAddress = addrList[4];
            const invalidSupportAddress = addrList[3];
            const supportAddress = addrList[5];
            const subscriber2 = addrList[6];
            const subscriber3 = addrList[7];
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


            // transfer the xct if the subscriber does not have enough balance
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, globalSupportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullAmount = balanceToAdd;
            
            await getAmountIfLess(subscriber, balanceToAdd, Subscription);
            await getAmountIfLess(subscriber2, balanceToAdd, Subscription);
            await getAmountIfLess(subscriber3, balanceToAdd, Subscription);

            // Subscribing to the 1st subnet
            await expect(Subscription.connect(subscriber).subscribe(
                false,
                balanceToAdd,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress.address,
                licenseAddress,
                invalidSupportAddress.address,
                licenseFee,
                computeRequired
                )).to.be.revertedWith("The support address given is not valid");

            
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
        
            await time.increaseTo(subscribeTime + subscribeDuration/2);
            
            let beforeRefSupply = await xct.balanceOf(globalSupportAddress.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(globalSupportAddress.address);
            let afterRefSupply = await xct.balanceOf(globalSupportAddress.address);

            let durPassed = subscribeDuration/2 + afterUpdateTime - beforeUpdateTime;
            let calcBal = computePerSec.mul(durPassed).mul(globalSupportFee).div(100000);;
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcBal)).to.be.true;


            await snapshotBeforeSubscribe.restore();

            await Subscription.connect(globalDAO).addSupportAddress(supportAddress.address, supportFee);

            tr = await Subscription.connect(subscriber).subscribe(
                false,
                balanceToAdd,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();

            subscribeTime = await time.latest();

            nftID = await getAppNFTID(rec.transactionHash);

            await time.increaseTo(subscribeTime + subscribeDuration/2);
            
            beforeRefSupply = await xct.balanceOf(supportAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(supportAddress.address);
            afterRefSupply = await xct.balanceOf(supportAddress.address);

            durPassed = subscribeDuration/2 + afterUpdateTime - beforeUpdateTime;
            calcBal = computePerSec.mul(durPassed).mul(supportFee).div(100000);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
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

            await Subscription.connect(supportAddress).addSupportFeesForNFT(nftID2, supportFee2);
            await Subscription.connect(supportAddress).addSupportFeesForNFT(nftID3, supportFee3);


            tr = await Subscription.connect(subscriber).subscribe(
                true,
                balanceToAdd,
                nftID1,
                subnetID,
                serviceProviderAddress,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();
            subscribeTime = await time.latest();


            tr = await Subscription.connect(subscriber2).subscribe(
                true,
                balanceToAdd,
                nftID2,
                subnetID,
                serviceProviderAddress,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();
            let subscribeTime2 = await time.latest();


            tr = await Subscription.connect(subscriber3).subscribe(
                true,
                balanceToAdd,
                nftID3,
                subnetID,
                serviceProviderAddress,
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


        })
	
        it("referral address gets a share of the subscription amount until the referral expiry", async () => {
            const globalDAO = addrList[0];
            const deployer = globalDAO;
            const subscriber = addrList[1];
            const referralAddress = addrList[2];
            const licenseAddress = addrList[3].address;
            const supportAddress = addrList[4];
            let xctAmount = ethers.utils.parseEther("1000");
            const subscribeDuration = 60 * 60 * 24 * 8;
            const referralExpiry = 60 * 60 * 24 * 4;
            const referralPercent = 8000;
            const serviceProviderAddress = "address";
            const daoRate = 5000;

            const licenseFee = 10000;
            const minTimeFunds = 300;
            const supportFee = 10000;
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
                    globalSupportAddress: supportAddress.address,
                    minTimeFunds: minTimeFunds,
                    supportFee: supportFee,
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


            // transfer the xct if the subscriber does not have enough balance
            const dripRate = await SubscriptionBalance.estimateDripRatePerSecOfSubnet(subnetID, licenseFee, supportFee, computeRequired);
            balanceToAdd = dripRate.mul(subscribeDuration);
            let fullAmount = balanceToAdd;
            
            await getAmountIfLess(subscriber, balanceToAdd, Subscription);

            // Subscribing to the 1st subnet
            tr = await Subscription.connect(subscriber).subscribe(
                false,
                balanceToAdd,
                0,
                subnetID,
                serviceProviderAddress,
                referralAddress.address,
                licenseAddress,
                supportAddress.address,
                licenseFee,
                computeRequired
                );

            rec = await tr.wait();

            const subscribeTime = await time.latest();

            // Get the minted appNFT
            const nftID = await getAppNFTID(rec.transactionHash);
        
            await time.increaseTo(subscribeTime + referralExpiry/2);
            
            let beforeRefSupply = await xct.balanceOf(referralAddress.address);
            let beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            let afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(referralAddress.address);
            let afterRefSupply = await xct.balanceOf(referralAddress.address);

            let durPassed = referralExpiry/2 + afterUpdateTime - beforeUpdateTime;
            let calcRefBal = computePerSec.mul(durPassed).mul(referralPercent).div(100000);
            const halfRefBal = calcRefBal;
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            console.log("referral balance: ", afterRefSupply, calcRefBal);
            expect(afterRefSupply.eq(calcRefBal)).to.be.true;


            await time.increaseTo(subscribeTime + referralExpiry - 5 );

            beforeRefSupply = await xct.balanceOf(referralAddress.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(referralAddress.address);
            afterRefSupply = await xct.balanceOf(referralAddress.address);
            
            durPassed = referralExpiry - 5 + afterUpdateTime - beforeUpdateTime;
            calcRefBal = computePerSec.mul(durPassed).mul(referralPercent).div(100000);
            const totalRefBalWithdrawn = calcRefBal;
            calcRefBal = calcRefBal.sub(halfRefBal);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            expect(afterRefSupply.eq(calcRefBal)).to.be.true;


            await time.increaseTo(subscribeTime + subscribeDuration );

            beforeRefSupply = await xct.balanceOf(globalDAO.address);
            beforeUpdateTime = await time.latest();
            await SubscriptionBalance.updateBalance(nftID);
            afterUpdateTime = await time.latest();
            await SubscriptionBalanceCalculator.receiveRevenueForAddress(globalDAO.address);
            afterRefSupply = await xct.balanceOf(globalDAO.address);
            
            durPassed = subscribeDuration;
            calcRefBal = computePerSec.mul(durPassed).mul(referralPercent).div(100000);
            const daoRateBal = computePerSec.mul(subscribeDuration).mul(daoRate).div(100000);
            calcRefBal = calcRefBal.sub(totalRefBalWithdrawn);
            afterRefSupply = afterRefSupply.sub(beforeRefSupply);
            afterRefSupply = afterRefSupply.sub(daoRateBal);
            expect(afterRefSupply.eq(calcRefBal)).to.be.true;

        })

	})
	

})
