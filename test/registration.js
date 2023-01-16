const { expect } = require("chai");
const { describe } = require("node:test");
const helper = require("../scripts/helper.js")
const { time, loadFixture, takeSnapshot, restore } = require("@nomicfoundation/hardhat-network-helpers");
// const { ethers } = require("ethers");


let Registration,
Subscription,
SubscriptionBalance,
SubscriptionBalanceCalculator,
SubnetDAODistributor,
xct,
stack,
darkMatterNFT,
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
        stackFeesReqd: ethers.utils.parseEther("0.01"),
    };

    attributes = {...attributes, ...attributeParam};
    await darkMatterNFT.connect(creator).setApprovalForAll(Registration.address, true);
    const nftTr = await darkMatterNFT.mint(creator.address);
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
    await darkMatterNFT.connect(clusterAddress).setApprovalForAll(Registration.address, true);
    const nftTr = await darkMatterNFT.mint(clusterAddress.address);
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

const getSubnetID = async (tr) => {
    rec = await tr.wait();
    const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
    const subnetId = subnetCreatedEvent.args[0].toNumber();
    return subnetId;
}

const getClusterID = async (tr) => {
    rec = await tr.wait();
    const clusterSignupEvent = rec.events.find(event => event.event == "ClusterSignedUp");
    const clusterID = clusterSignupEvent.args[1].toNumber();
    return clusterID;
}

const mintDarkMatterNFT = async (owner, contractToApprove, darkMatterNFTParam) => {
    if(!darkMatterNFTParam)
        darkMatterNFTParam = darkMatterNFT;

    let tr = await darkMatterNFTParam.mint(owner.address);
    let rec = await tr.wait();
    let transferEvent = rec.events.find(event => event.event == "Transfer");
    const nftID = transferEvent.args[2].toNumber();

    await darkMatterNFTParam.connect(owner).setApprovalForAll(
        contractToApprove.address,
        true
    );

    return nftID;
}

const getAppNFTID = async (transactionHash) => {
    const transferFilter = appNFT.filters.Transfer();
    const transferLogList = await appNFT.queryFilter(transferFilter, -10, "latest");
    const transferLog = transferLogList.find(log => log.transactionHash == transactionHash);
    const nftID = transferLog.args[2].toNumber();
    return nftID;
}

const getAmountIfLess = async (erc20, account, balanceToAdd, contractToApprove) => {
    // add amount to depositor if depositor's balance is less
    let currentBalance = await erc20.balanceOf(account.address);
    if(currentBalance.lt(balanceToAdd)) {
        await erc20.connect(addrList[0]).transfer(account.address,  balanceToAdd);
    }
    //approve subscription balance to withdraw erc20 out of depositor's wallet
    await erc20.connect(account).approve(
        contractToApprove.address,
        balanceToAdd
    );

}

const formatSubnetAttributes = (subnetAttr) => {

    return {
        subnetType: subnetAttr[0].toNumber(),
        sovereignStatus: subnetAttr[1],
        cloudProviderType: subnetAttr[2].toNumber(),
        subnetStatusListed: subnetAttr[3],
        unitPrices: subnetAttr[4],
        otherAttributes: subnetAttr[5],
        maxClusters: subnetAttr[6].toNumber(),
        stackFeesReqd: subnetAttr[7]
    }
}

const formatClusterAttributes = (clusterAttr) => {
    return {
        walletAddress: clusterAttr[0].toString(),
        ownerAddress: clusterAttr[1].toString(),
        operatorAddress: clusterAttr[2].toString(),
        DNSIP: clusterAttr[3],
        listed: clusterAttr[4],
        nftIDLocked: clusterAttr[5].toNumber(),
        clusterName: clusterAttr[6]
    }
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
    const _darkMatterToken = await helper.getNFTToken();
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
    darkMatterNFT = _darkMatterToken;
    appNFT = _appNFT;
    addrList = _addrList;

    return {
        Registration,
        Subscription,
        SubscriptionBalance,
        SubscriptionBalanceCalculator,
        xct,
        stack,
        darkMatterNFT,
        appNFT,
        ContractBasedDeployment,
        addrList
    };
}


describe("testing Registration contract", async () => {

    before(async () => {
        await helper.deployContracts();
        await helper.callStackApprove();
        await helper.callNftApprove();

    })


    describe("Testing creation of subnet", async () => {

        it("An Individual with Dark Matter NFT and enough stack can create a subnet", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const adminAddress = (await ethers.getSigners())[0];

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
					registration: {
						...helper.parameters.registration,
						reqdStackFeesForSubnet: reqdStackFeesForSubnet
					}
                }
            )


            //deploy the contracts
            await initContracts();


            // define the parameters for the subnet attributes and the subnet creators
            const subnetCreator1 = addrList[1];
            const subnetDAO1 = addrList[2];
            const subnetCreator2 = addrList[3];
            const subnetDAO2 = addrList[4];
            const subnetDAO3 = addrList[6];
            const subnet1 = {
                creator: subnetCreator1,
                subnetDAO: subnetDAO1.address,
                subnetType: 1,
                sovereignStatus: true,
                cloudProviderType: 1,
                subnetStatusListed: true,
                unitPrices: [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                otherAttributes: [],
                maxClusters: 1,
                whitelistedClusters: [],
                stackFeesReqd: ethers.utils.parseEther("0.01")
            }

            const subnet2 = {
                creator: subnetCreator2,
                subnetDAO: subnetDAO2.address,
                subnetType: 1,
                sovereignStatus: false,
                cloudProviderType: 1,
                subnetStatusListed: true,
                unitPrices: [ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0004"),
                ethers.utils.parseEther("0.0005")],
                otherAttributes: [],
                maxClusters: 2,
                whitelistedClusters: [],
                stackFeesReqd: ethers.utils.parseEther("0.02")
            }

            const subnet3 = {
                creator: subnetCreator1,
                subnetDAO: subnetDAO3.address,
                subnetType: 1,
                sovereignStatus: false,
                cloudProviderType: 1,
                subnetStatusListed: true,
                unitPrices: [ethers.utils.parseEther("0.0005"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002")],
                otherAttributes: [],
                maxClusters: 10,
                whitelistedClusters: [],
                stackFeesReqd: ethers.utils.parseEther("0.09")
            }


            // function to compare the contract subnet attributes and the parameter subnet attributes
            const compareSubnetAttributes = (expected, actual) => {
                expect(actual.subnetType).to.equal(expected.subnetType);
                expect(actual.sovereignStatus).to.equal(expected.sovereignStatus);
                expect(actual.cloudProviderType).to.equal(expected.cloudProviderType);
                expect(actual.subnetStatusListed).to.equal(expected.subnetStatusListed);
                expect(actual.unitPrices).to.eql(expected.unitPrices);
                expect(actual.otherAttributes).to.eql(expected.otherAttributes);
                expect(actual.maxClusters).to.equal(expected.maxClusters);
                expect(actual.stackFeesReqd).to.equal(expected.stackFeesReqd);
            }


            // subnet creator tries to create a subnet without having the dark matter NFT, which will fail
            await expect(Registration.connect(subnet1.creator).createSubnet(
                1,
                subnet1.subnetDAO,
                subnet1.subnetType,
                subnet1.sovereignStatus,
                subnet1.cloudProviderType,
                subnet1.subnetStatusListed,
                subnet1.unitPrices,
                subnet1.otherAttributes,
                subnet1.maxClusters,
                subnet1.whitelistedClusters,
                subnet1.stackFeesReqd
            )).to.be.reverted;

            
            // subnet creator mints the dark matter NFT
            let nftID = await mintDarkMatterNFT(subnet1.creator, Registration);


            // withdrawing all the balance of the subnet creator to check that
            // without required stack fees, the subnet creation will fail
            let balance = await stack.balanceOf(subnet1.creator.address);
            await stack.connect(subnet1.creator).transfer(adminAddress.address, balance);


            // the subnet creator tries to create the subnet without having the
            // required fees, which will fail
            await expect(Registration.connect(subnet1.creator).createSubnet(
                nftID,
                subnet1.subnetDAO,
                subnet1.subnetType,
                subnet1.sovereignStatus,
                subnet1.cloudProviderType,
                subnet1.subnetStatusListed,
                subnet1.unitPrices,
                subnet1.otherAttributes,
                subnet1.maxClusters,
                subnet1.whitelistedClusters,
                subnet1.stackFeesReqd
            )).to.be.reverted;


            // the subnet creator will get the required fees for creating the subnet
            await getAmountIfLess(stack, subnet1.creator, reqdStackFeesForSubnet, Registration);


            // the subnet creator is able to create the subnet having the stack fees and 
            // the minte NFT
            tr = await Registration.connect(subnet1.creator).createSubnet(
                nftID,
                subnet1.subnetDAO,
                subnet1.subnetType,
                subnet1.sovereignStatus,
                subnet1.cloudProviderType,
                subnet1.subnetStatusListed,
                subnet1.unitPrices,
                subnet1.otherAttributes,
                subnet1.maxClusters,
                subnet1.whitelistedClusters,
                subnet1.stackFeesReqd
                );
            const subnet1ID = await getSubnetID(tr);


            // get the subnet attributes for the created subnet and compare them with the parameter values
            let subnetAttributes = formatSubnetAttributes(await Registration.getSubnetAttributes(subnet1ID));
            compareSubnetAttributes(subnet1, subnetAttributes);


            // another subnet creator tries to create a subnet
            //mint the dark matter NFT and get the required stack fees for the second subnet creator
            nftID = await mintDarkMatterNFT(subnet2.creator, Registration);
            await getAmountIfLess(stack, subnet2.creator, reqdStackFeesForSubnet, Registration);


            // the second subnet creator creates a subnet
            tr = await Registration.connect(subnet2.creator).createSubnet(
                nftID,
                subnet2.subnetDAO,
                subnet2.subnetType,
                subnet2.sovereignStatus,
                subnet2.cloudProviderType,
                subnet2.subnetStatusListed,
                subnet2.unitPrices,
                subnet2.otherAttributes,
                subnet2.maxClusters,
                subnet2.whitelistedClusters,
                subnet2.stackFeesReqd
                );
            const subnet2ID = await getSubnetID(tr);


            // get the values of the second subnet and check that they match the parameters
            subnetAttributes = formatSubnetAttributes(await Registration.getSubnetAttributes(subnet2ID));
            compareSubnetAttributes(subnet2, subnetAttributes);


            // now the creator of the first subnet tries to create another subnet
            // mint dark matter NFT and get required stack fees for creating subnet
            nftID = await mintDarkMatterNFT(subnet3.creator, Registration);
            await getAmountIfLess(stack, subnet3.creator, reqdStackFeesForSubnet, Registration);


            // the first subnet creator creates another subnet
            tr = await Registration.connect(subnet3.creator).createSubnet(
                nftID,
                subnet3.subnetDAO,
                subnet3.subnetType,
                subnet3.sovereignStatus,
                subnet3.cloudProviderType,
                subnet3.subnetStatusListed,
                subnet3.unitPrices,
                subnet3.otherAttributes,
                subnet3.maxClusters,
                subnet3.whitelistedClusters,
                subnet3.stackFeesReqd
                );
            const subnet3ID = await getSubnetID(tr);


            // check that the expected and actual values of the subnet attributes match
            subnetAttributes = formatSubnetAttributes(await Registration.getSubnetAttributes(subnet3ID));
            compareSubnetAttributes(subnet3, subnetAttributes);
        })

    })

    describe("Testing creation of clusters", async () => {

        it("An Individual with Dark Matter NFT and subnet set signup fees can create a cluster on a subnet", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
					registration: {
						...helper.parameters.registration,
						reqdStackFeesForSubnet: reqdStackFeesForSubnet
					}
                }
            )


            //deploy the contracts
            await initContracts();


            // parameters
            const subnetCreator = addrList[1];
            const clusterCreator = addrList[2];
            const dnsip = "test-dnsip";
            const walletAddress = addrList[3];
            const operatorAddress = addrList[4];
            const clusterName = "test-cluster";
            const signupFees = ethers.utils.parseEther("0.01");
    

            //mint dark matter NFT and the required stack fees for the subnet creator
            let nftID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);
    

            // create the subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetCreator.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                signupFees);
            let subnetID = await getSubnetID(tr);
    

            // set a dummy nftID that does not belong to the cluster creator
            let clusterNFTID = nftID;


            //cluster creator tries to sign up without the dark matter NFT and enough fees
            await expect(Registration.connect(clusterCreator).clusterSignUp(
                subnetID,
                dnsip,
                walletAddress,
                operatorAddress,
                clusterNFTID,
                clusterName
            )
            ).to.be.reverted;


            //cluster creator receives a dark matter NFT and approves Registration to withdraw it
            clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);


            // cluster creator tries to create a cluster without enough stack fees, which fails
            await expect(Registration.connect(clusterCreator).clusterSignUp(
                subnetID,
                dnsip,
                walletAddress,
                operatorAddress,
                clusterNFTID,
                clusterName
            )
            ).to.be.reverted;

        
            // cluster creator gets the stack fees required for signing up. The fees is set by the subnet creator
            await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
            

            // see that the cluster creator has the NFT
            let ownerAddress = await darkMatterNFT.ownerOf(clusterNFTID);
            expect(ownerAddress).to.equal(clusterCreator.address);


            // cluster creator will signup to the subnet
            let beforeSupply = await stack.balanceOf(clusterCreator.address);
            tr = await Registration.connect(clusterCreator).clusterSignUp(
                subnetID,
                dnsip,
                walletAddress.address,
                operatorAddress.address,
                clusterNFTID,
                clusterName
            );
            let clusterID = await getClusterID(tr);
            let afterSupply = await stack.balanceOf(clusterCreator.address);


            // the NFT is now transferred from the cluster creator to the Registration contract
            ownerAddress = await darkMatterNFT.ownerOf(clusterNFTID);
            expect(ownerAddress).to.equal(Registration.address);


            // the amount of stack deducted from cluster creator is equal to the signup fees
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(signupFees)).to.be.true;


            // get the cluster attributes
            const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
    

            // verify if the cluster attributes are the same as the parameters provided
            expect(clusterAttributes[0].toString()).to.equal(walletAddress.address);
            expect(clusterAttributes[1].toString()).to.equal(clusterCreator.address);
            expect(clusterAttributes[2].toString()).to.equal(operatorAddress.address);
            expect(clusterAttributes[3].toString()).to.equal(dnsip);
            expect(clusterAttributes[4]).to.equal(1);
            expect(clusterAttributes[5].toNumber()).to.equal(clusterNFTID);
            expect(clusterAttributes[6]).to.equal(clusterName);
        })
    
    })

    describe("testing state of the clusters", () => {
        it("A cluster can be whitelisted initially by the subnet creator", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
					registration: {
						...helper.parameters.registration,
						reqdStackFeesForSubnet: reqdStackFeesForSubnet
					}
                }
            )


            //deploy the contracts
            await initContracts();

    
            const testSize = 5;
            subnetCreatorList = [addrList[1], addrList[2], addrList[3], addrList[4], addrList[5]];
            clusterCreatorList = [addrList[4], addrList[5], addrList[6], addrList[7], addrList[8]];
            const signupFees = ethers.utils.parseEther("0.01");


            for(var i = 0; i < testSize; i++) {
                const subnetCreator = subnetCreatorList[i];
                const whitelistedClusterOwner = clusterCreatorList[i];

                const nftID = await mintDarkMatterNFT(subnetCreator, Registration);

                await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);

                tr = await Registration.connect(subnetCreator).createSubnet(
                    nftID,
                    subnetCreator.address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                    ethers.utils.parseEther("0.0004")],
                    [],
                    testSize,
                    [whitelistedClusterOwner.address],
                    signupFees
                    );
                const subnetID = await getSubnetID(tr);


                var w = 0;
                const whitelist = [];
                while(true) {
                    try {
                        const addr = await Registration.whiteListedClusters(subnetID, w);
                        whitelist.push(addr);
                        w++;
                    } catch(err) {
                        break;
                    }
                }
        
                expect(whitelist).to.not.be.empty;
                expect(whitelist.length).to.be.equal(1);
                expect(whitelist[0]).to.be.equal(whitelistedClusterOwner.address);


                for(var c = 0; c < testSize; c++) {
                    const clusterCreator = clusterCreatorList[i];

                    const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                    
                    await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
					
                    tr = await Registration.connect(clusterCreator).clusterSignUp(
                        subnetID,
                        "127.0.0.1",
                        clusterCreator.address,
                        clusterCreator.address,
                        clusterNFTID,
                        "cluster-"+c
                    );
                    const clusterID = await getClusterID(tr);

                    const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));


                    expect(clusterAttributes.ownerAddress).to.equal(clusterCreator.address);
                    if(clusterCreator.address === whitelistedClusterOwner.address)
                        expect(clusterAttributes.listed).to.equal(2);
                    else
                        expect(clusterAttributes.listed).to.equal(1);
                }
            }
        })
		
        it("Multiple clusters can be whitelisted initially by the subnet creator", async () => {

            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

            // addresses for subnet creator, cluster creators, whitelisted addresses
            const subnetCreator = addrList[1];
            const clusterCreatorList = [addrList[2], addrList[3], addrList[4], addrList[5], addrList[6],
                    addrList[7], addrList[8], addrList[9], addrList[10], addrList[11],
            ]
            const whitelistedAddresses = [
                addrList[0].address, addrList[2].address, addrList[5].address, addrList[7].address, addrList[9].address
            ];
            const testClusterLimit = 10;
            const signupFees = ethers.utils.parseEther("0.01");


            //mint dark matter NFT for subnet creator
            const nftID = await mintDarkMatterNFT(subnetCreator, Registration);

            // transfer required fees for subnet to subnet creator and approve registration to withdraw
            await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates a subnet, with the whitelisted addresses
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetCreator.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                testClusterLimit,
                whitelistedAddresses,
                signupFees
                );
            
            const subnetID = await getSubnetID(tr);


            //retreive the saved whitelisted addresses 
            var w = 0;
            const contractWhitelistedAddresses = [];
            while(true) {
                try {
                    const addr = await Registration.whiteListedClusters(subnetID, w);
                    contractWhitelistedAddresses.push(addr);
                    w++;
                } catch(err) {
                    break;
                }
            }

            // check if retrieved whitelisted addresses is equal to the parameter whitelisted addresses
            expect(contractWhitelistedAddresses).to.eql(whitelistedAddresses);


            // create the clusters
            for(var c = 0; c < testClusterLimit; c++) {
                const clusterCreator = clusterCreatorList[c];

                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);

                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);

                tr = await Registration.connect(clusterCreator).
                clusterSignUp(subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "clust_"+c
                );
                rec = await tr.wait();
            }


            // see if the total clusters signed is equal to the parameter
            const totalSigned = await Registration.totalClustersSigned(subnetID);
            expect(totalSigned).to.be.equal(testClusterLimit);

            

            // see that of all the clusters signed, the whitelisted clusters are listed, and others are 
            // not listed/waiting state
            for(var i = 0; i < testClusterLimit; i++) {
                const clusterCreator = clusterCreatorList[i];
                const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, i));
                expect(clusterAttributes.ownerAddress).to.equal(clusterCreator.address);

                if(whitelistedAddresses.find(a => a == clusterAttributes.ownerAddress)) {
                    expect(clusterAttributes.listed).to.equal(2);
                }
                else {
                    expect(clusterAttributes.listed).to.equal(1);
                }
            }

        })

    it("A cluster cannot be whitelisted by anyone other than Global DAO or subnet DAO", async () => {
        const subnetCreationFees = ethers.utils.parseEther("0.1");

        
        //set the paramters for the required stack fees for creating subnet
        helper.setParameters(
            {
                ...helper.parameters.registration,
                reqdStackFeesForSubnet: subnetCreationFees
            }
        )


        //deploy the contracts
        await initContracts();


        // parameters
        const signupFees = ethers.utils.parseEther("0.01");
        const maxClusters = 5;
        const subnetCreator = addrList[1];
        const clusterCreatorList = [addrList[1], addrList[2], addrList[3], addrList[4], addrList[5]];
        const invalidWhitelister = addrList[10];


        //mint darkmatter nft and provide stack fees for the subnet creator
        const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
        await getAmountIfLess(stack, subnetCreator, subnetCreationFees, Registration);


        //create subnet
        tr = await Registration.connect(subnetCreator).createSubnet(
            nftID,
            subnetCreator.address,
            1,
            true,
            1,
            true,
            [ethers.utils.parseEther("0.0001"),
            ethers.utils.parseEther("0.0002"),
            ethers.utils.parseEther("0.0003"),
            ethers.utils.parseEther("0.0004")],
            [],
            maxClusters,
            [],
            signupFees);
        const subnetID = await getSubnetID(tr);


        // check if whitelisted clusters are equal to zero
        var w = 0;
        while(true) {
            try {
                await Registration.whiteListedClusters(subnetID, w);
                w++;
            } catch(err) {
                break;
            }
        }
        expect(w).to.be.equal(0);


        // create clusters
        for(var c = 0; c < maxClusters; c++) {
            const clusterCreator = clusterCreatorList[c];


            //mint darkmatter nft and provide signup fees for the cluster creator
            const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
            await getAmountIfLess(stack, clusterCreator, signupFees, Registration);

            

            // add cluster to the subnet
            tr = await Registration.connect(clusterCreator).
            clusterSignUp(subnetID,
                "127.0.0.1",
                clusterCreator.address,
                clusterCreator.address,
                clusterNFTID,
                "cluster"
                );
            const clusterID = await getClusterID(tr);


            //check if the cluster listed status is in waiting state
            const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.ownerAddress.toString()).to.equal(clusterCreator.address);
            expect(clusterAttributes.listed).to.equal(1);
        }


        // check if the invalid cluster whitelister cannot whitelist any clusters
        for(var c = 0; c < maxClusters; c++)
        {
            await expect(Registration.connect(invalidWhitelister).addClusterToWhitelisted(subnetID, [clusterCreatorList[c].address])
            ).to.be.revertedWith("Only WHITELIST_ROLE or Local DAO can edit whitelisted addresses")
            ;

            var w = 0;
            while(true) {
                try {
                    await Registration.whiteListedClusters(subnetID, w);
                    w++;
                } catch(err) {
                    break;
                }
            }
    
            expect(w).to.be.equal(0);
        }

    })
	
        it("Clusters can be whitelisted by the subnet DAO", async () => {

            const subnetCreationFees = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: subnetCreationFees
                }
            )


            //deploy the contracts
            await initContracts();


            // parameters
            const signupFees = ethers.utils.parseEther("0.01");
            const maxClusters = 5;
            const subnetCreator = addrList[1];
            const clusterCreatorList = [addrList[6], addrList[7], addrList[8], addrList[9], addrList[10], addrList[11], addrList[12]];
            const whitelistedCluster = addrList[9];
            const multipleClusterWhiteList = [addrList[2].address, addrList[4].address, addrList[5].address, addrList[7].address];
            const removedFromWhitelist = 1;
            const invalidWhitelister = addrList[11];


            //mint darkmatter nft and provide stack fees for the subnet creator
            const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, subnetCreationFees, Registration);


            // subnet creator creates a subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetCreator.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                maxClusters,
                [],
                signupFees
            );
            const subnetID = await getSubnetID(tr);


            // save a snapshot before whitelisting and adding clusters
            const snapshotAfterSubnetCreation = await takeSnapshot();


            //only the subnet DAO and an admin can add cluster to white list
            await expect(
                Registration.connect(invalidWhitelister).addClusterToWhitelisted(subnetID, [whitelistedCluster.address])
            ).to.be.revertedWith("Only WHITELIST_ROLE or Local DAO can edit whitelisted addresses");


            // add a cluster to whitelist
            await Registration.connect(subnetCreator).addClusterToWhitelisted(subnetID, [whitelistedCluster.address]);


            // check if the added to the whitelist
            w = 0;
            let whitelist = [];
            while(true) {
                try {
                    const addr = await Registration.whiteListedClusters(subnetID, w);
                    whitelist.push(addr);
                    w++;
                } catch(err) {
                    break;
                }
            }
            expect(whitelist).to.not.be.empty;
            expect(whitelist.length).to.be.equal(1);
            expect(whitelist[0]).to.be.equal(whitelistedCluster.address);

            
            // adding clusters to the subnet
            for(var c = 0; c < maxClusters; c++)
            {
                const clusterCreator = clusterCreatorList[c];


                //mint darkmatter nft and provide signup fees for the cluster creator
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
                

                // add cluster to the subnet
                tr = await Registration.connect(clusterCreator).
                clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster-"+c
                );
                const clusterID = await getClusterID(tr);


                  //check the cluster listed status. Only the whitelisted clusters should be having listed state
                  const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
                  expect(clusterAttributes.ownerAddress.toString()).to.equal(clusterCreator.address);

                  // check if only the whitelisted cluster is activated
                  if(clusterCreator.address == whitelistedCluster.address)
                      expect(clusterAttributes.listed).to.equal(2);
                  else
                      expect(clusterAttributes.listed).to.equal(1);
            }

            
            // Test for adding multiple clusters to the whitelist at the same time

            
            // restore the state which was saved before adding to the whitelist
            await snapshotAfterSubnetCreation.restore();


            // this time add multiple clusters to the whitelist
            Registration.connect(subnetCreator).addClusterToWhitelisted(subnetID, multipleClusterWhiteList);


            // check if the multiple whitelisted clusters are correctly saved
            w = 0;
            let contractWhiteList = [];
            while(true) {
                try {
                    const addr = await Registration.whiteListedClusters(subnetID, w);
                    contractWhiteList.push(addr);
                    w++;
                } catch(err) {
                    break;
                }
            }
            expect(contractWhiteList).to.not.be.empty;
            expect(contractWhiteList).to.eql(multipleClusterWhiteList);


            // adding the clusters
            for(var c = 0; c < maxClusters; c++)
            {
                const clusterCreator = clusterCreatorList[c];


                //mint darkmatter nft and provide signup fees for the cluster creator
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
                

                // add cluster to the subnet
                tr = await Registration.connect(clusterCreator).
                clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster-"+c
                );
                const clusterID = await getClusterID(tr);

                //check the cluster listed status. Only the whitelisted clusters should be having listed state
                const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
                expect(clusterAttributes.ownerAddress.toString()).to.equal(clusterCreator.address);

                // check that only the whitelisted clusters are in active state
                if(multipleClusterWhiteList.find(addr => addr == clusterCreator.address))
                    expect(clusterAttributes.listed).to.equal(2);
                else
                    expect(clusterAttributes.listed).to.equal(1);
            }

            
            // Test for adding multiple clusters to the whitelist, then removing a cluster from the whitelist.
            // The cluster removed from the whitelist should not be whitelisted


            // restore the state which was saved before adding to the whitelist
            await snapshotAfterSubnetCreation.restore();


            // this time add multiple clusters to the whitelist
            await Registration.connect(subnetCreator).addClusterToWhitelisted(subnetID, multipleClusterWhiteList);


            // check if the multiple whitelisted clusters are correctly saved
            w = 0;
            contractWhiteList = [];
            while(true) {
                try {
                    const addr = await Registration.whiteListedClusters(subnetID, w);
                    contractWhiteList.push(addr);
                    w++;
                } catch(err) {
                    break;
                }
            }
            expect(contractWhiteList).to.not.be.empty;
            expect(contractWhiteList).to.eql(multipleClusterWhiteList);


            // remove a cluster from the whitelist
            await Registration.connect(subnetCreator)
            .removeClusterFromWhitelisted(subnetID, multipleClusterWhiteList[removedFromWhitelist], removedFromWhitelist);


            //save all the whitelisted addresses except for the removed one
            let newWhitelist = [];
            for(var i = 0; i < multipleClusterWhiteList.length; i++)
            {
                if(i != removedFromWhitelist)
                    newWhitelist.push(multipleClusterWhiteList[i]);
            }


            // check if the cluster addresses are saved correctly and that the removed address
            // does not appear in the list
            w = 0;
            contractWhiteList = [];
            while(true) {
                try {
                    const addr = await Registration.whiteListedClusters(subnetID, w);
                    contractWhiteList.push(addr);
                    w++;
                } catch(err) {
                    break;
                }
            }
            expect(contractWhiteList).to.not.be.empty;
            expect(contractWhiteList).to.eql(newWhitelist);


            // adding the clusters
            for(var c = 0; c < maxClusters; c++)
            {
                const clusterCreator = clusterCreatorList[c];


                //mint darkmatter nft and provide signup fees for the cluster creator
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
                

                // add cluster to the subnet
                tr = await Registration.connect(clusterCreator).
                clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster-"+c
                );
                const clusterID = await getClusterID(tr);

                //check the cluster listed status. Only the whitelisted clusters should be having listed state
                const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
                expect(clusterAttributes.ownerAddress.toString()).to.equal(clusterCreator.address);

                // check that only the whitelisted clusters are in active state
                if(newWhitelist.find(addr => addr == clusterCreator.address))
                    expect(clusterAttributes.listed).to.equal(2);
                else
                    expect(clusterAttributes.listed).to.equal(1);
            }

        })
		
        it("Subnet should have maximum limit for clusters and all the clusters are not approved", async () => {
            const subnetCreationFees = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: subnetCreationFees
                }
            )


            //deploy the contracts
            await initContracts();


            // parameters
            const signupFees = ethers.utils.parseEther("0.01");
            const maxClusters = 5;
            const subnetCreator = addrList[1];
            const clusterCreatorList = [addrList[1], addrList[2], addrList[3], addrList[4], addrList[5], addrList[6]];
            const clusterAddressList = clusterCreatorList.map(creator => creator.address);

            //mint darkmatter nft and provide stack fees for the subnet creator
            const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, subnetCreationFees, Registration);


            //create subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetCreator.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                maxClusters,
                [],
                signupFees);
            const subnetID = await getSubnetID(tr);


            // cluster creation function
            const signupCluster =  async (c ) => {
                const clusterCreator = clusterCreatorList[c];


                //mint darkmatter nft and provide signup fees for the cluster creator
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
                

                // add cluster to the subnet
                tr = await Registration.connect(clusterCreator).
                clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster-"+c
                );
                const clusterID = await getClusterID(tr);


                //check the cluster listed status. Only the whitelisted clusters should be having listed state
                const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));

                expect(clusterAttributes.ownerAddress).to.equal(clusterCreator.address);
                // expect(clusterAttributes.listed).to.equal(1);
                return clusterAttributes;
            }


            //save the snapshot before adding the clusters
            const snapshotBeforeClusterSignup = await takeSnapshot();


            // add clusters which are in waiting state
            for(var i = 0; i < maxClusters; i++)
            {
                const clusterAttributes = await signupCluster(i);
                expect(clusterAttributes.listed).to.equal(1);
            }

            // try to add cluster to the subnet. It will revert due to the max subnet limit reached
            await expect(
            signupCluster(maxClusters)
            ).to.be.revertedWith("No spots available, maxSlots reached for subnet");


            // now try to add an extra cluster when all the clusters are in listed state
            // revert to the snapshot before adding clusters
            await snapshotBeforeClusterSignup.restore();


            // this time add multiple clusters to the whitelist
            await Registration.connect(subnetCreator).addClusterToWhitelisted(subnetID, clusterAddressList);


            // add clusters which are whitelisted. They should have listed status
            for(var i = 0; i < maxClusters; i++)
            {
                const clusterAttributes = await signupCluster(i);
                expect(clusterAttributes.listed).to.equal(2);
            }


            // try to add cluster to the subnet. It will revert due to the max subnet limit reached
            await expect(
                signupCluster(maxClusters)
                ).to.be.revertedWith("No spots available, maxSlots reached for subnet");

    
            // now try to add an extra cluster when all the clusters are delisted. The cluster should be added.
            //revert to the snapshot before adding clusters
            await snapshotBeforeClusterSignup.restore();


            //add the clusters and delist them
            for(var i = 0; i < maxClusters; i++)
            {
                await signupCluster(i);
                await Registration.delistCluster(subnetID, i);
                const clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, i));
                expect(clusterAttributes.listed).to.equal(3);
            }


            // try to add cluster to the subnet.
            // It will not reverted as the clusters are delisted so there is slot to fill
            await expect(
                signupCluster(maxClusters)
                ).to.not.be.revertedWith("No spots available, maxSlots reached for subnet");

        })

    })
	
    describe("testing SubnetDAO approve/delisting cluster", async () => {

        it("SubnetDAO can approve a cluster", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnetCreator = addrList[1];
            const subnetDAO = addrList[2];
            const clusterCreatorList = [addrList[3], addrList[4], addrList[5], addrList[6]];
            const signupFees = ethers.utils.parseEther("0.01");

            
            // minting NFT and getting amount for subnet creator
            const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                clusterCreatorList.length,
                [],
                signupFees
                );
            const subnetID = await getSubnetID(tr);
            

            // creating clusters
            for(var i = 0; i < clusterCreatorList.length; i++)
            {
                const clusterCreator = clusterCreatorList[i];


                // cluster creator mints NFT and gets amount
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);


                // cluster creator creates a cluster
                tr = await Registration.connect(clusterCreator).clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster"
                );
            }
            


            //Subnet DAO approves a cluster
            //choose the first cluster
            let clusterID = 0;


            // get the cluster attributes for the first cluster and see that the listing state is pending
            let clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(1);


            // subnet DAO approves the cluster
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);
    

            // get the cluster attributes and see that the state is now approved
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(2);
    


            // Subnet DAO delists a cluster
            // choose the second cluster
            clusterID = 1;


            // get the cluster attributes for the second cluster and see that the cluster state  is in waiting state
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(1);


            // subnet DAO delists the cluster
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);


            // get the cluster attributes and see that the cluster is delisted
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(3);


            // Subnet DAO approves then delists the cluster
            // choose the third cluster
            clusterID = 2;


            // get the cluster attributes and see that the cluster is in waiting state
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(1);


            // subnetDAO approves the cluster
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);


            //get the cluster attributes and see that the cluster status is now approved
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(2);


            // subnet DAO delists the cluster
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);


            // check if the status is delisted
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(3);


            // subnet DAO delists then approves the cluster
            // choose the third cluster
            clusterID = 3;


            // get the cluster attributes and see that the cluster is in waiting state
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(1);


            // subnet DAO delists the cluster
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);


            //get the cluster attributes and see that the cluster status is now approved
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(3);


            // subnetDAO approves the cluster
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);


            // check if the status is delisted
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(2);


            
            // check if all the cluster states are correct
            clusterID = 0;
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(2);

            clusterID = 1;
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(3);

            clusterID = 2;
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(3);

            clusterID = 3;
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.listed).to.equal(2);
        })

        it("Only allow signup of cluster if the subnet has not reached maximum capacity", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");


            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            subnetCreatorList = [addrList[1], addrList[2], addrList[3], addrList[4], addrList[5]];
            clusterCreatorList = [addrList[4], addrList[5], addrList[6], addrList[7], addrList[8]];
            newCreatorList = [addrList[10], addrList[11], addrList[12], addrList[13], addrList[14], addrList[15]];
            const clusterLimit = 5;
            const signupFees = ethers.utils.parseEther("0.01");


            // function to signup cluster
            const signupCluster = async (subnetID, clusterCreator) => {

                // mint dark matter NFT and get amount for the cluster creator
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);
                

                // create the cluster
                tr = await Registration.connect(clusterCreator).clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster"
                );


                return await getClusterID(tr);
            }
    

            // create a subnet and fill them with max number of clusters. Then keep delisting the clusters
            // create new clusters till the max limit. Then add another cluster which will exceed the max limit.
            // Multiple subnets are created and in each iteration, we delist i number of clusters and recreate
            // i number clusters. Adding another cluster should be reverted
            for(var i = 0; i < subnetCreatorList.length; i++)
            {
                const subnetCreator = subnetCreatorList[i];
                const clusterIDList = [];


                // mint dark matter NFT and get amount for the subnet creator
                const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
                await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


                // create the subnet
                tr = await Registration.connect(subnetCreator).createSubnet(
                    nftID,
                    subnetCreator.address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                    ethers.utils.parseEther("0.0004")],
                    [],
                    clusterLimit,
                    [],
                    signupFees
                    );
                const subnetID = await getSubnetID(tr);


                // create the clusters
                for(var c = 0; c < clusterLimit; c++) {
                    const clusterCreator = clusterCreatorList[c];
                    clusterIDList.push(await signupCluster(subnetID, clusterCreator));
                }


                // delist the clusters till i(th) cluster
                for(var j = 0; j < i + 1; j++) {
                    await Registration.connect(subnetCreator).delistCluster(subnetID, clusterIDList[j]);
                }


                //see that the total cluster spots available is equal to i
                var totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
                expect(totalSpots).to.be.equal(i+1);


                // add new clusters till i count
                for(var j = 0; j < i + 1; j++) {
                    const newClusterCreator = newCreatorList[j];
                    await signupCluster(subnetID, newClusterCreator);
                }


                // see that the total available spots is zero
                totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
                expect(totalSpots).to.be.equal(0);


                // try adding another cluster to the subnet. It should get reverted
                // because the subnet has now reached its maximum cluster limit
                await expect(
                    signupCluster(subnetID, newCreatorList[i + 1])
                ).to.be.revertedWith(
                    "No spots available, maxSlots reached for subnet"
                )

                
                // see that the total cluster spots available is still zero
                totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
                expect(totalSpots).to.be.equal(0);
            }
        })
    
        it("There can be multiple delisted clusters exceeding max capacity, but only allow approval of cluster if the subnet has not reached maximum capacity", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnetCreator = addrList[1];
            const subnetDAO = addrList[2];
            const clusterCreatorList = [addrList[3], addrList[4], addrList[5]];
            const newClusterCreator = addrList[6];
            const clusterLimit = 3;
            const signupFees = ethers.utils.parseEther("0.01");
            const clusterList = [];

    

            // minting NFT and getting amount for subnet creator
            const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                clusterLimit,
                [],
                signupFees
                );
            const subnetID = await getSubnetID(tr);


            // function to signup cluster
            const signupCluster = async (clusterCreator) => {

                // cluster creator mints NFT and gets amount
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);


                // cluster creator creates a cluster
                tr = await Registration.connect(clusterCreator).clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster"
                );

                return await getClusterID(tr);
            }
 

            // create the clusters till the cluster limit and delist all of them
            for(var c = 0; c < clusterLimit; c++) {
                const clusterCreator = clusterCreatorList[c];
                clusterList.push(await signupCluster(clusterCreator));
                await Registration.connect(subnetDAO).delistCluster(subnetID, clusterList[c]);
            }


            // check that the total spots is the max cluster limit
            var totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(clusterLimit);


            // create a new cluster
            await signupCluster(newClusterCreator);


            // approve the clusters back till the the subnet has reached max limit
            for(var c = 0; c < clusterLimit - 1; c++) {
                await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterList[c], 100);   
            }


            // check that the total available spots is zero
            totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(0);


            // try to approve the another cluster that will exceed the max cluster limit. It will get reverted.
            await expect(
                Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterList[clusterLimit - 1], 100)
            ).to.be.reverted;

        })
})

    describe("testing unit price change", async () => {
        it("An Individual with Dark Matter NFT and stack fees can create a cluster on a subnet", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const priceCooldownTime = 60 * 60 * 24 * 2;
        
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    registration: {
                        ...helper.parameters.registration,
                        coolDownTimeForPriceChange: priceCooldownTime,
                        reqdStackFeesForSubnet: reqdStackFeesForSubnet
                    }
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnetCreator = addrList[1];
            const subnetDAO = addrList[2];
            const clusterCreator = addrList[3];
            const invalidRequester = addrList[4];
            const clusterLimit = 3;
            const signupFees = ethers.utils.parseEther("0.01");
            const unitPrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")
            ];
            const newUnitPrices = [
                ethers.utils.parseEther("0.4"),
                ethers.utils.parseEther("0.3"),
                ethers.utils.parseEther("0.10"),
                ethers.utils.parseEther("0.8")
            ];
           


            // minting NFT and getting amount for subnet creator
            const nftID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                unitPrices,
                [],
                clusterLimit,
                [],
                signupFees
                );
            const subnetID = await getSubnetID(tr);
    

            // checking the prices saved in the contract are matching the parameter values
            let subnetAttributes = await Registration.getSubnetAttributes(subnetID);
            const subnetUnitPrices = subnetAttributes[4];
            for(var i = 0; i < unitPrices.length; i++) {
                expect(unitPrices[i].eq(subnetUnitPrices[i])).to.be.true;
            }


            // requesting cluster price change will fail if the addres does not have the subnet DAO price change roles
            await expect(
                Registration.connect(invalidRequester).requestClusterPriceChange(subnetID, newUnitPrices)
            ).to.be.reverted;


            // subnet DAO requests the new price changes
            await Registration.connect(subnetDAO).requestClusterPriceChange(subnetID, newUnitPrices);
            const requestTime = await time.latest();


            // check that the prices have not changed yet
            subnetAttributes = await Registration.getSubnetAttributes(subnetID);
            for(var i = 0; i < unitPrices.length; i++) {
                expect(unitPrices[i].eq(subnetUnitPrices[i])).to.be.true;
            }


            // try to apply the changed unit prices. It will get reverted it is not
            // the price cooldown time yet
            await expect(
                Registration.applyChangedClusterPrice(subnetID)
            ).to.be.revertedWith("Cooldown time not over yet");


            // increase the time to 1 minute before the price cooldown time
            await time.increaseTo(requestTime + priceCooldownTime - 60);


            // try to apply the changed prices. It will revert as the time is still not
            // past the cooldown period
            await expect(
                Registration.applyChangedClusterPrice(subnetID)
            ).to.be.revertedWith("Cooldown time not over yet");


            // increase the time to the end of price cooldown time
            await time.increaseTo(requestTime + priceCooldownTime);


            // applying the changed prices will work now as the price cooldown period has been passed
            await Registration.connect(subnetDAO).applyChangedClusterPrice(subnetID);


            // retrieve the subnet attributes and see that the unit prices have been changed
            subnetAttributes = await Registration.getSubnetAttributes(subnetID);
            const changedSubnetPrices = subnetAttributes[4];
            for(var i = 0; i < unitPrices.length; i++) {
                expect(newUnitPrices[i].eq(changedSubnetPrices[i])).to.be.true;
            }
        })
    })
	
    describe("Testing if a subnet is sovereign", async () => {
        it("If a subnet is not sovereign, then during a cluster signup a DNSIP needs to be provided, otherwise it is not required. A cluster owner can also change the DNSIP after signup.", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");

            
            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnet1Creator = addrList[1];
            const subnet2Creator = addrList[2];
            const clusterCreator1 = addrList[3];
            const clusterCreator2 = addrList[4];
            const clusterCreator3 = addrList[5];
            const signupFees = ethers.utils.parseEther("0.01");
            const subnet1Sovereign = false;
            const subnet2Sovereign = true;
            const DNSIP1 = "127.0.0.1";
            const DNSIP2 = "233.121.102.1";
    

            // minting NFT and getting amount for subnet creator
            let nftID = await mintDarkMatterNFT(subnet1Creator, Registration);
            await getAmountIfLess(stack, subnet1Creator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates a non sovereign subnet
            tr = await Registration.connect(subnet1Creator).createSubnet(
                nftID,
                subnet1Creator.address,
                1,
                subnet1Sovereign,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                1,
                [],
                signupFees
                );
            const subnetID = await getSubnetID(tr);
    
    
            // minting NFT and getting stack amount for the cluster creator
            let clusterNFTID = await mintDarkMatterNFT(clusterCreator1, Registration);
            await getAmountIfLess(stack, clusterCreator1, signupFees, Registration);

            
            // cluster creator tries to signup, but fails due to not providing DNSIP for
            // a non sovereign subnet
            await expect(Registration.connect(clusterCreator1).clusterSignUp(
                subnetID,
                "",
                clusterCreator1.address,
                clusterCreator1.address,
                clusterNFTID,
                "cluster"
            )).to.be.revertedWith("DNS/IP cannot be empty for non sovereign subnets");


            // cluster creator provides DNSIP and signs up to the subnet
            tr =  await Registration.connect(clusterCreator1).clusterSignUp(
                subnetID,
                DNSIP1,
                clusterCreator1.address,
                clusterCreator1.address,
                clusterNFTID,
                "cluster"
            );
            let clusterID = await getClusterID(tr);


            // get the cluster attributes and check that the DNSIP value is the same as the parameter value
            let clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(subnetID, clusterID));
            expect(clusterAttributes.DNSIP).to.be.equal(DNSIP1);


            // minting NFT and getting amount for subnet creator
            nftID = await mintDarkMatterNFT(subnet2Creator, Registration);
            await getAmountIfLess(stack, subnet2Creator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates a sovereign subnet
            tr = await Registration.connect(subnet2Creator).createSubnet(
                nftID,
                subnet2Creator.address,
                1,
                subnet2Sovereign,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                2,
                [],
                signupFees
                );
            const sovereignSubnetID = await getSubnetID(tr);


            // mint NFT and get stack amount for the cluster creator
            clusterNFTID = await mintDarkMatterNFT(clusterCreator2, Registration);
            await getAmountIfLess(stack, clusterCreator2, signupFees, Registration);


            // a cluster creator is able to sign up to a sovereign subnet without providing
            // the DNSIP
            tr = await Registration.connect(clusterCreator2).clusterSignUp(
                sovereignSubnetID,
                "",
                clusterCreator2.address,
                clusterCreator2.address,
                clusterNFTID,
                "cluster"
            );
            clusterID = await getClusterID(tr);


            // get the cluster attributes and see that the DNSIP value is empty
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(sovereignSubnetID, clusterID));
            expect(clusterAttributes.DNSIP).to.be.equal("");


            // mint NFT and get stack amount for the cluster creator
            clusterNFTID = await mintDarkMatterNFT(clusterCreator3, Registration);
            await getAmountIfLess(stack, clusterCreator3, signupFees, Registration);


            //cluster creator signs up with the sovereign subnet with a DNSIP
            tr = await Registration.connect(clusterCreator3).clusterSignUp(
                sovereignSubnetID,
                DNSIP2,
                clusterCreator3.address,
                clusterCreator3.address,
                clusterNFTID,
                "cluster"
            );
            clusterID = await getClusterID(tr);


            // get the cluster attributes and see that the DNSIP is the same as the parameter value
            clusterAttributes = formatClusterAttributes(await Registration.getClusterAttributes(sovereignSubnetID, clusterID));
            expect(clusterAttributes.DNSIP).to.be.equal(DNSIP2);

        })
    })

    describe("Admin can change NFT contract and withdraw NFT", async () => {

        it("An admin can withdraw NFTs that was used for creating subnet or cluster", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const adminAddress = (await ethers.getSigners())[0];

            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    globalDAO: adminAddress.address,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnetCreator = addrList[1];
            const clusterCreatorList = [addrList[3], addrList[4], addrList[5]];
            const nftWithdrawIndexList = [0, 2];
            const signupFees = ethers.utils.parseEther("0.01");
            const clusterNFTIDList = [];


            // minting NFT and getting amount for subnet creator
            const subnetNFTID = await mintDarkMatterNFT(subnetCreator, Registration);
            await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


            // subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator).createSubnet(
                subnetNFTID,
                subnetCreator.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                clusterCreatorList.length,
                [],
                signupFees
                );
            const subnetID = await getSubnetID(tr);


            // check that the owner of the NFT is the Registration contract
            let nftOwner = await darkMatterNFT.ownerOf(subnetNFTID);
            expect(nftOwner).to.equal(Registration.address);


            // creating clusters
            for(var i = 0; i < clusterCreatorList.length; i++)
            {
                const clusterCreator = clusterCreatorList[i];


                // cluster creator mints NFT and gets amount
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);


                // check that the owner of the NFT is the cluster creator before
                // the cluster creator signs up.
                nftOwner = await darkMatterNFT.ownerOf(clusterNFTID);
                expect(nftOwner).to.equal(clusterCreator.address);


                // cluster creator creates a cluster
                tr = await Registration.connect(clusterCreator).clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster"
                );


                // see that the owner of the NFT is the Registration contract
                nftOwner = await darkMatterNFT.ownerOf(clusterNFTID);
                expect(nftOwner).to.equal(Registration.address);


                // save the NFT into the list
                clusterNFTIDList.push(clusterNFTID);
            }


            // no one other than the admin can withdraw the NFT
            await expect(Registration.connect(subnetCreator).withdrawNFT([subnetID]))
            .to.be.reverted;

            
            //admin withdraws the subnetNFT
            await Registration.connect(adminAddress).withdrawNFT([subnetNFTID]);


            //The owner of the nft is now the admin
            nftOwner = await darkMatterNFT.ownerOf(subnetNFTID);
            expect(nftOwner).to.be.equal(adminAddress.address);

            
            const snapshotBeforeWithdraw = await takeSnapshot();

            // go through the NFT list
            for(var i = 0; i < clusterNFTIDList.length; i++)
            {
                const clusterNFTID = clusterNFTIDList[i];


                // no one other than the admin can withdraw the NFT
                await expect(Registration.connect(clusterCreatorList[i]).withdrawNFT([clusterNFTID]))
                .to.be.reverted;


                // the admin withdraws the NFT
                await Registration.connect(adminAddress).withdrawNFT([clusterNFTID]);

                
                // the owner of the NFT is the admin
                nftOwner = await darkMatterNFT.ownerOf(clusterNFTID);
                expect(nftOwner).to.be.equal(adminAddress.address);
            }


            // restore the saved snapshot before the cluster NFT withdrawals
            await snapshotBeforeWithdraw.restore();


            // get the selected NFTs to withdraw
            const nftWithdrawList = clusterNFTIDList.filter((t, index) => nftWithdrawIndexList.find((arrayVal) => arrayVal == index));


            // withdraw multiple NFTs
            await Registration.connect(adminAddress).withdrawNFT(nftWithdrawList);


            // go through the NFT list
            for(var i = 0; i < clusterNFTIDList.length; i++)
            {
                const clusterNFTID = clusterNFTIDList[i];


                //see that the withdrawed NFTs belong to the admin, and others
                // belong to the Registration contract
                if(nftWithdrawList.find(val => val == clusterNFTID)) {

                    nftOwner = await darkMatterNFT.ownerOf(clusterNFTID);
                    expect(nftOwner).to.be.equal(adminAddress.address);
                }
                else {
                    nftOwner = await darkMatterNFT.ownerOf(clusterNFTID);
                    expect(nftOwner).to.be.equal(Registration.address);
                }
            }

        })

        it("An admin can switch NFT contracts and withdraw NFTs", async () => {

            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const adminAddress = (await ethers.getSigners())[0];

            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    globalDAO: adminAddress.address,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnetCreator1 = addrList[1];
            const subnetCreator2 = addrList[2];
            const clusterCreator1 = addrList[3];
            const clusterCreator2 = addrList[4];
            const unauthorizedUser = addrList[10];
            const c1NFTList = [];
            const c2NFTList = [];
            const signupFees = ethers.utils.parseEther("0.01");


            // creating another Dark Matter NFT contract
            let nftContract1 = darkMatterNFT;
            let nftContract2Address = await helper.deployDarkNFT();
            let nftContract2File = await ethers.getContractFactory("TestDarkMatter"); 
            let nftContract2 = await nftContract2File.attach(nftContract2Address);
    

            //function to add subnet and cluster
            const addSubnetAndCluster = async (nftContract, nftList, subnetCreator, clusterCreator) => {

                // subnet creator mints NFT and gets amount
                const subnetNFTID = await mintDarkMatterNFT(subnetCreator, Registration, nftContract);
                await getAmountIfLess(stack, subnetCreator, reqdStackFeesForSubnet, Registration);


                // creating the subnet
                tr = await Registration.connect(subnetCreator).createSubnet(
                    subnetNFTID,
                    subnetCreator.address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                    ethers.utils.parseEther("0.0004")],
                    [],
                    1,
                    [],
                    signupFees
                );
                const subnetID = await getSubnetID(tr);


                // check that the minted NFT belongs to Registration contract
                nftOwner = await nftContract.ownerOf(subnetNFTID);
                expect(nftOwner).to.be.equal(Registration.address);


                // mint NFT and get stack amount for cluster creator
                const clusterNFTID = await mintDarkMatterNFT(clusterCreator, Registration, nftContract);
                await getAmountIfLess(stack, clusterCreator, signupFees, Registration);


                // create a cluster
                tr = await Registration.connect(clusterCreator)
                .clusterSignUp(
                    subnetID,
                    "127.0.0.1",
                    clusterCreator.address,
                    clusterCreator.address,
                    clusterNFTID,
                    "cluster-name"
                );


                // chck that the minted NFT for cluster belongs to Registration
                nftOwner = await nftContract.ownerOf(clusterNFTID);
                expect(nftOwner).to.be.equal(Registration.address);
                nftList.push(clusterNFTID);
            }


            // deploy the first subnet and cluster using the first NFT contract
            await addSubnetAndCluster(nftContract1, c1NFTList, subnetCreator1, clusterCreator1);


            // switch to the second NFT contract
            await expect(Registration.connect(unauthorizedUser)
            .changeNFT(nftContract2.address)
            ).to.be.reverted;
            

            // switch to the second NFT contract
            await Registration.connect(adminAddress).changeNFT(nftContract2.address);


            // deploy the second subnet and cluster using the second NFT contract
            await addSubnetAndCluster(nftContract2, c2NFTList, subnetCreator2, clusterCreator2);


            // switch to the first nft contract
            await Registration.connect(adminAddress).changeNFT(nftContract1.address);


            //admin withdraws the first subnet and first cluster NFT
            await Registration.connect(adminAddress).withdrawNFT(c1NFTList);

            
            // check that the owner of the NFTs belong to the admin
            for(var i = 0; i < c1NFTList.length; i++)
            {
                let nftOwner = await nftContract1.ownerOf(c1NFTList[i]);
                expect(nftOwner).to.be.equal(adminAddress.address);
            }


            // check that the second subnet and cluster NFTs still belong to the Registration contract
            for(var i = 0; i < c2NFTList.length; i++)
            {
                let nftOwner = await nftContract2.ownerOf(c2NFTList[i]);
                expect(nftOwner).to.be.equal(Registration.address);
            }


            //switch to the second NFT contract
            await Registration.connect(adminAddress).changeNFT(nftContract2.address);


            // admin withdraws the second subnet and cluster NFTs
            await Registration.connect(adminAddress).withdrawNFT(c2NFTList);


            // check that the admin has the second subnet and cluster NFTs
            for(var i = 0; i < c2NFTList.length; i++)
            {
                let nftOwner = await nftContract2.ownerOf(c2NFTList[i]);
                expect(nftOwner).to.be.equal(adminAddress.address);
            }
        })
	})

    describe("each subnet has different stack fees for cluster signup", async () => {

        it("Every subnet can have different stack fees required for signup of a cluster", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const adminAddress = (await ethers.getSigners())[0];

            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    globalDAO: adminAddress.address,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();

    
            // setting the parameters
            const subnetCreator1 = addrList[1];
            const subnetCreator2 = addrList[2];
            const clusterCreator1 = addrList[3];
            const clusterCreator2 = addrList[4];
            const signupFees1 = ethers.utils.parseEther("0.03");
            const signupFees2 = ethers.utils.parseEther("0.08")


            // minting NFT and getting amount for the first subnet creator
            const subnet1NFTID = await mintDarkMatterNFT(subnetCreator1, Registration);
            await getAmountIfLess(stack, subnetCreator1, reqdStackFeesForSubnet, Registration);


            // first subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator1).createSubnet(
                subnet1NFTID,
                subnetCreator1.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                1,
                [],
                signupFees1
                );
            const subnet1ID = await getSubnetID(tr);


            // minting NFT and getting amount for second subnet creator
            const subnet2NFTID = await mintDarkMatterNFT(subnetCreator2, Registration);
            await getAmountIfLess(stack, subnetCreator2, reqdStackFeesForSubnet, Registration);
    

            // second subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator2).createSubnet(
                subnet2NFTID,
                subnetCreator2.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                1,
                [],
                signupFees2
                );
            const subnet2ID = await getSubnetID(tr);


            // the first cluster creator mints NFT and gets the amount that is
            // equal to the signup fees for the first subnet
            const cluster1NFTID = await mintDarkMatterNFT(clusterCreator1, Registration);


            // empty the balance of the first cluster creator by transferring the entire
            // balance to the admin account
            let balance = await stack.balanceOf(clusterCreator1.address);
            stack.connect(clusterCreator1).transfer(adminAddress.address, balance);


            // cluster creator tries to signup to the first subnet without any balance, which will fail
            await expect(Registration.connect(clusterCreator1).clusterSignUp(
                subnet1ID,
                "127.0.0.1",
                clusterCreator1.address,
                clusterCreator1.address,
                cluster1NFTID,
                "cluster"
            )).to.be.reverted;


            // the first cluster creator will the the stack fees necessary for signing up to the first subnet
            await getAmountIfLess(stack, clusterCreator1, signupFees1, Registration);


            // the first cluster creator is able to create a cluster having enough fees
            let beforeSupply = await stack.balanceOf(clusterCreator1.address);
            tr = await Registration.connect(clusterCreator1).clusterSignUp(
                subnet1ID,
                "127.0.0.1",
                clusterCreator1.address,
                clusterCreator1.address,
                cluster1NFTID,
                "cluster"
            );
            let afterSupply = await stack.balanceOf(clusterCreator1.address);

            // check that the deducted amount is equal to the
            // signup fees of the first subnet
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(signupFees1)).to.be.true;

  
            // the second cluster creator mints NFT and gets amount equal to the signup fees
            // of the second subnet
            const cluster2NFTID = await mintDarkMatterNFT(clusterCreator2, Registration);


            // empty the balance of the second cluster creator by transferring it to the admin
            balance = await stack.balanceOf(clusterCreator2.address);
            stack.connect(clusterCreator2).transfer(adminAddress.address, balance);


            // second cluster creator tries to signup without having balance, which will fail
            await expect(Registration.connect(clusterCreator2).clusterSignUp(
                subnet2ID,
                "127.0.0.1",
                clusterCreator2.address,
                clusterCreator2.address,
                cluster2NFTID,
                "cluster"
            )).to.be.reverted;


            // the second cluster creator will get the amount but not enough for the second subnet
            await getAmountIfLess(stack, clusterCreator2, signupFees1, Registration);


            // the second cluster creator tries to signup to the second subnet without having
            // the require stack fees, which will fail
            await expect(Registration.connect(clusterCreator2).clusterSignUp(
                subnet2ID,
                "127.0.0.1",
                clusterCreator2.address,
                clusterCreator2.address,
                cluster2NFTID,
                "cluster"
            )).to.be.reverted;


            // the second cluster creator will get the stack fees required for the second subnet
            await getAmountIfLess(stack, clusterCreator2, signupFees2, Registration);


            // the second cluster creator is now able to create a cluster having enough
            // signup fees
            beforeSupply = await stack.balanceOf(clusterCreator2.address);
            tr = await Registration.connect(clusterCreator2).clusterSignUp(
                subnet2ID,
                "127.0.0.1",
                clusterCreator2.address,
                clusterCreator2.address,
                cluster2NFTID,
                "cluster"
            );
            afterSupply = await stack.balanceOf(clusterCreator2.address);

            // check that the deducted amount is equal to the 
            // signup fees of the second subnet
            deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(signupFees2)).to.be.true;
        })
    })

    describe("Balance of stack is tracked when an individual signs up", async () => {
        it("During cluster signup, an x amount of stack is tracked", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const adminAddress = (await ethers.getSigners())[0];

            //set the paramters for the required stack fees for creating subnet
            helper.setParameters(
                {
                    ...helper.parameters.registration,
                    globalDAO: adminAddress.address,
                    reqdStackFeesForSubnet: reqdStackFeesForSubnet
                }
            )


            //deploy the contracts
            await initContracts();


            // setting the parameters
            const subnetCreator1 = addrList[1];
            const subnetCreator2 = addrList[2];
            const clusterCreator1 = addrList[3];
            const clusterCreator2 = addrList[4];
            const withdrawRole = addrList[5];
            const unauthorizedUser = addrList[10];
            const signupFees1 = ethers.utils.parseEther("0.03");
            const signupFees2 = ethers.utils.parseEther("0.08");
            const slashAmount = ethers.utils.parseEther("0.04");


            // minting NFT and getting amount for the first subnet creator
            const subnet1NFTID = await mintDarkMatterNFT(subnetCreator1, Registration);
            await getAmountIfLess(stack, subnetCreator1, reqdStackFeesForSubnet, Registration);


            // first subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator1).createSubnet(
                subnet1NFTID,
                subnetCreator1.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                1,
                [],
                signupFees1
                );
            const subnet1ID = await getSubnetID(tr);


            // minting NFT and getting amount for second subnet creator
            const subnet2NFTID = await mintDarkMatterNFT(subnetCreator2, Registration);
            await getAmountIfLess(stack, subnetCreator2, reqdStackFeesForSubnet, Registration);
    

            // second subnet creator creates the subnet
            tr = await Registration.connect(subnetCreator2).createSubnet(
                subnet2NFTID,
                subnetCreator2.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")],
                [],
                2,
                [],
                signupFees2
                );
            const subnet2ID = await getSubnetID(tr);


            // the first cluster creator will the the stack fees necessary for signing up to the first subnet
            // minting NFT and getting amount for second subnet creator
            const cluster1NFTID = await mintDarkMatterNFT(clusterCreator1, Registration);
            await getAmountIfLess(stack, clusterCreator1, signupFees1, Registration);


            // checking the balance for the first cluster creator, which should be zero
            let balanceLocked = await Registration.balanceOfStackLocked(clusterCreator1.address);
            expect(balanceLocked.eq(0)).to.be.true;


            // the first cluster creator is able to create a cluster having enough fees
            let beforeSupply = await stack.balanceOf(clusterCreator1.address);
            tr = await Registration.connect(clusterCreator1).clusterSignUp(
                subnet1ID,
                "127.0.0.1",
                clusterCreator1.address,
                clusterCreator1.address,
                cluster1NFTID,
                "cluster"
            );
            let afterSupply = await stack.balanceOf(clusterCreator1.address);

            // check that the deducted amount is equal to the
            // signup fees of the first subnet
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(signupFees1)).to.be.true;


            // the balance locked should be equal to the signup fees for the first subnet
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator1.address);
            expect(balanceLocked.eq(signupFees1)).to.be.true;


            // the first cluster creator will the the stack fees necessary for signing up to the first subnet
            // minting NFT and getting amount for second subnet creator
            const cluster2NFTID = await mintDarkMatterNFT(clusterCreator2, Registration);
            await getAmountIfLess(stack, clusterCreator2, signupFees2, Registration);


            // checking the balance for the second cluster creator, which should be zero
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator2.address);
            expect(balanceLocked.eq(0)).to.be.true;

            
            // the second cluster creator creates a cluster in the second subnet
            beforeSupply = await stack.balanceOf(clusterCreator2.address);
            tr = await Registration.connect(clusterCreator2).clusterSignUp(
                subnet2ID,
                "127.0.0.1",
                clusterCreator2.address,
                clusterCreator2.address,
                cluster2NFTID,
                "cluster"
            );
            afterSupply = await stack.balanceOf(clusterCreator2.address);

            // check that the deducted amount is equal to the 
            // signup fees of the second subnet
            deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(signupFees2)).to.be.true;


            // check that the locked balance of the second cluster creator is equal
            // to the signup fees
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator2.address);
            expect(balanceLocked.eq(signupFees2)).to.be.true;


            // mint NFT and get stack amount for the first cluster creator
            const cluster3NFTID = await mintDarkMatterNFT(clusterCreator1, Registration);
            await getAmountIfLess(stack, clusterCreator1, signupFees2, Registration);


            // the first cluster creator creates a cluster in the first subnet
            beforeSupply = await stack.balanceOf(clusterCreator1.address);
            tr = await Registration.connect(clusterCreator1).clusterSignUp(
                subnet2ID,
                "127.0.0.1",
                clusterCreator1.address,
                clusterCreator1.address,
                cluster3NFTID,
                "cluster"
            );
            const cluster3ID = await getClusterID(tr);
            afterSupply = await stack.balanceOf(clusterCreator1.address);

            // check that the deducted balance is equal to the signup fees
            // of the second subnet
            deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(signupFees2)).to.be.true;

        
            //check that the balance locked for the first cluster creator is
            // equal to the total of the signed fees of both the subnets
            let totalExpectedLocked = signupFees1.add(signupFees2);
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator1.address);
            expect(balanceLocked.eq(totalExpectedLocked)).to.be.true;


            // check that the locked balance of the second cluster creator is
            // still equal to the signup fees of the second subnet
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator2.address);
            expect(balanceLocked.eq(signupFees2)).to.be.true;
    

            // unauthorized user cannot call slash balance function
            await expect(Registration.connect(unauthorizedUser).
            withdrawStackFromClusterByDAO(subnet2ID, cluster3ID, slashAmount)).to.be.reverted;


            // the withdraw address cannot call the slash balance function until the role is provided
            // to the address
            await expect(Registration.connect(withdrawRole).
            withdrawStackFromClusterByDAO(subnet2ID, cluster3ID, slashAmount)).to.be.reverted;

            //providing the withdraw stack role to the withdraw address
            const WITHDRAW_STACK_ROLE = await Registration.WITHDRAW_STACK_ROLE();
            await Registration.grantRole(WITHDRAW_STACK_ROLE, withdrawRole.address);


            //withdraw address slashes the balance of the cluster creator who created the third cluster
            await Registration.connect(withdrawRole).
            withdrawStackFromClusterByDAO(subnet2ID, cluster3ID, slashAmount);


            // check if the locked balance is slashed
            slashedBalance = totalExpectedLocked.sub(slashAmount);
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator1.address);
            expect(balanceLocked.eq(slashedBalance)).to.be.true;


            // check that the locked balance of the second cluster creator is
            // still equal to the signup fees of the second subnet
            balanceLocked = await Registration.balanceOfStackLocked(clusterCreator2.address);
            expect(balanceLocked.eq(signupFees2)).to.be.true;
        })
    })



})
