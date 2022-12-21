const { expect } = require("chai");
const { describe } = require("node:test");
const helper = require("../scripts/helper.js")

describe("testing Registration contract", async () => {

    before(async () => {
        await helper.deployContracts();
        await helper.callStackApprove();
        await helper.callNftApprove();
    })

    describe("Testing creation of subnet", async () => {
        it('An Individual without Dark Matter NFT cannot create a subnet', async () => {
            const addrList = await ethers.getSigners();
            const nftToken = await helper.getNFTToken();
    
            const nftTr = await nftToken.mint(addrList[1].address);
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
                    addrList[0].address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                    [],
                    3,
                    [],
                    5000,
                    ethers.utils.parseEther("0.01"));
            }
            catch(err) {
                failedFlag = true;
            }
    
            expect(failedFlag).to.be.true;
        })
    
        it("An Individual with Dark Matter NFT but without enough stack cannot create a subnet", async () => {
            const addrList = await ethers.getSigners();
            const nftToken = await helper.getNFTToken();
            const Registration = await helper.getRegistration();
            const stack = await helper.getStack();
    
            await nftToken.setApprovalForAll(helper.getAddresses().Registration, true);
            const nftTr = await nftToken.mint(addrList[1].address);
            const nftRec = await nftTr.wait();
            expect(nftRec.events).to.not.be.empty;
            expect(nftRec.events.length).to.be.greaterThan(0);
            const transferEvent = nftRec.events.find(event => event.event == "Transfer");
            expect(transferEvent).to.not.be.undefined;
            
    
            const nftID = transferEvent.args[2].toNumber();
            const ownerOfNFT = await nftToken.ownerOf(nftID);
            expect(ownerOfNFT).to.equal(addrList[1].address);
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            if(curBalance.gte(ethers.utils.parseEther("0.1"))) {
                await stack.connect(addrList[1]).transfer(addrList[0].address,  curBalance);
            }
    
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            const subnetLocalDAO = addrList[1].address;
            const subnetType = 1;
            const sovereignStatus = true;
            const cloudProviderType = 1;
            const subnetStatusListed = true;
            const unitPrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")
            ];
            const otherAttributes = [];
            const maxClusters = 3;
            const whiteListedClusters = [ addrList[1].address];
            const supportFeeRate = 5000;
            const stackFeesReqd = ethers.utils.parseEther("0.01");
    
            let failFlag = false;
            try {
                await Registration.connect(addrList[1]).createSubnet(
                    nftID,
                    subnetLocalDAO,
                    subnetType,
                    sovereignStatus,
                    cloudProviderType,
                    subnetStatusListed,
                    unitPrices,
                    otherAttributes,
                    maxClusters,
                    whiteListedClusters,
                    supportFeeRate,
                    stackFeesReqd
                );
            }
            catch(err) {
                failFlag = true;
            }
    
            expect(failFlag).to.be.true;
        })
    
        it("An Individual with Dark Matter NFT and enough stack can create a subnet", async () => {
            const addrList = await ethers.getSigners();
            const nftToken = await helper.getNFTToken();
            const Registration = await helper.getRegistration();
            const stack = await helper.getStack();
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
            const nftTr = await nftToken.mint(addrList[1].address);
            const nftRec = await nftTr.wait();
            expect(nftRec.events).to.not.be.empty;
            expect(nftRec.events.length).to.be.greaterThan(0);
            const transferEvent = nftRec.events.find(event => event.event == "Transfer");
            expect(transferEvent).to.not.be.undefined;
            
    
            const nftID = transferEvent.args[2].toNumber();
            const ownerOfNFT = await nftToken.ownerOf(nftID);
            expect(ownerOfNFT).to.equal(addrList[1].address);
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            if(curBalance.lt(ethers.utils.parseEther("0.1"))) {
                await stack.connect(addrList[0]).transfer(addrList[1].address,  ethers.utils.parseEther("0.1"));
            }
    
            const beforeSupply = await stack.balanceOf(addrList[1].address);
    
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            const subnetLocalDAO = addrList[1].address;
            const subnetType = 1;
            const sovereignStatus = true;
            const cloudProviderType = 1;
            const subnetStatusListed = true;
            const unitPrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")
            ];
            const otherAttributes = [];
            const maxClusters = 3;
            const whiteListedClusters = [ addrList[1].address];
            const supportFeeRate = 5000;
            const stackFeesReqd = ethers.utils.parseEther("0.01");
    
            const op = await Registration.connect(addrList[1]).createSubnet(
                nftID,
                subnetLocalDAO,
                subnetType,
                sovereignStatus,
                cloudProviderType,
                subnetStatusListed,
                unitPrices,
                otherAttributes,
                maxClusters,
                whiteListedClusters,
                supportFeeRate,
                stackFeesReqd
            );
    
            const tr = await op.wait();
    
            const afterSupply = await stack.balanceOf(addrList[1].address);
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(ethers.utils.parseEther("0.1"))).to.be.true;
    
            expect(tr.events.length).to.be.greaterThan(0);
    
            const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
            const NFTLocked = tr.events.find(event => event.event == "NFTLockedForSubnet");
    
            expect(subnetCreatedEvent).to.not.be.undefined;
            expect(NFTLocked).to.not.be.undefined;
    
            const subnetId = subnetCreatedEvent.args[0].toNumber();
    
            const newNFTOwner = await nftToken.ownerOf(nftID);
    
            expect(newNFTOwner).to.not.equal(addrList[1].address);
            expect(newNFTOwner).to.equal(helper.getAddresses().Registration);
            
            const subnetAttributes = await Registration.getSubnetAttributes(subnetId);
    
            expect(subnetAttributes).to.not.be.undefined;
            expect(subnetAttributes).to.be.an('array').that.is.not.empty;
            expect(subnetAttributes.length).to.equal(9);
    
            expect(subnetAttributes[0].toNumber()).to.equal(subnetType);
            expect(subnetAttributes[1]).to.equal(sovereignStatus);
            expect(subnetAttributes[2].toNumber()).to.equal(cloudProviderType);
            expect(subnetAttributes[3]).to.equal(subnetStatusListed);
            expect(subnetAttributes[4].length).to.equal(unitPrices.length);
            for(var i = 0; i < unitPrices.length; i++) {
                expect(subnetAttributes[4][i].eq(unitPrices[i])).to.be.true;
            }
            expect(subnetAttributes[5].length).to.equal(otherAttributes.length);
            for(var i = 0; i < otherAttributes.length; i++) {
                expect(subnetAttributes[5][i].eq(otherAttributes[i])).to.be.true;
            }
            expect(subnetAttributes[6].toNumber()).to.equal(maxClusters);
            expect(subnetAttributes[7].toNumber()).to.equal(supportFeeRate);
            expect(subnetAttributes[8].eq(stackFeesReqd)).to.be.true;
    
        })

        it("A number of Individuals who have Dark Matter NFT and enough stack can create subnets", async () => {
            const addrList = await ethers.getSigners();
            const nftToken = await helper.getNFTToken();
            const Registration = await helper.getRegistration();
            const stack = await helper.getStack();
            const testSize = 3;
            const nftList = [];
            const subnetList = [];
            const creatorList=[addrList[2], addrList[3], addrList[4]];
            const subnetParamList = [];

            for(var i = 0; i < testSize; i++) {
                await nftToken.connect(creatorList[i]).setApprovalForAll(helper.getAddresses().Registration, true);

                await stack.connect(creatorList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            for(var i = 0; i < testSize; i++) {
                const nftTr = await nftToken.mint(creatorList[i].address);
                const nftRec = await nftTr.wait();
                expect(nftRec.events).to.not.be.empty;
                expect(nftRec.events.length).to.be.greaterThan(0);
                const transferEvent = nftRec.events.find(event => event.event == "Transfer");
                expect(transferEvent).to.not.be.undefined;
        
                const nftID = transferEvent.args[2].toNumber();
                const ownerOfNFT = await nftToken.ownerOf(nftID);
                expect(ownerOfNFT).to.equal(creatorList[i].address);
                nftList.push(nftID);
            }

            for(var i = 0; i < testSize; i++) {
                const curBalance = await stack.balanceOf(creatorList[i].address);

                let minAmount = ethers.utils.parseEther("0.1");

                if(curBalance.lt(minAmount)) {
                    await stack.connect(addrList[0]).transfer(creatorList[i].address,  minAmount);
                }

                const beforeSupply = await stack.balanceOf(creatorList[i].address);
                const subnetLocalDAO = creatorList[i].address;
                const subnetType = 1;
                const sovereignStatus = true;
                const cloudProviderType = 1;
                const subnetStatusListed = true;
                const unitPrices = [
                    ethers.utils.parseEther("0.0001"),
                    ethers.utils.parseEther("0.0002"),
                    ethers.utils.parseEther("0.0003"),
                    ethers.utils.parseEther("0.0004")
                ];
                const otherAttributes = [];
                const maxClusters = 3;
                const whiteListedClusters = [];
                const supportFeeRate = 5000;
                const stackFeesReqd = ethers.utils.parseEther("0.01");

                const nftID = nftList[i];

                subnetParamList.push({
                    nftID,
                    subnetLocalDAO,
                    subnetType,
                    sovereignStatus,
                    cloudProviderType,
                    subnetStatusListed,
                    unitPrices,
                    otherAttributes,
                    maxClusters,
                    whiteListedClusters,
                    supportFeeRate,
                    stackFeesReqd
                });

                const op = await Registration.connect(creatorList[i]).createSubnet(
                    nftID,
                    subnetLocalDAO,
                    subnetType,
                    sovereignStatus,
                    cloudProviderType,
                    subnetStatusListed,
                    unitPrices,
                    otherAttributes,
                    maxClusters,
                    whiteListedClusters,
                    supportFeeRate,
                    stackFeesReqd
                );

                const tr = await op.wait();

                expect(tr.events.length).to.be.greaterThan(0);
    
                const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
                const NFTLocked = tr.events.find(event => event.event == "NFTLockedForSubnet");
        
                expect(subnetCreatedEvent).to.not.be.undefined;
                expect(NFTLocked).to.not.be.undefined;
        
                const subnetID = subnetCreatedEvent.args[0].toNumber();
                subnetList.push(subnetID);

                const afterSupply = await stack.balanceOf(creatorList[i].address);
                const deducted = beforeSupply.sub(afterSupply);
                expect(deducted.eq(minAmount)).to.be.true;
            }
    
            for(var s = 0; s < testSize; s++) {
                const nftID = nftList[s];
                const subnetID = subnetList[s];
                const subnetDAO = creatorList[s].address;
                const newNFTOwner = await nftToken.ownerOf(nftID);
                const subnetParam = subnetParamList[s];

                expect(newNFTOwner).to.not.equal(subnetDAO);
                expect(newNFTOwner).to.equal(helper.getAddresses().Registration);

                const subnetAttributes = await Registration.getSubnetAttributes(subnetID);

                expect(subnetAttributes).to.not.be.undefined;
                expect(subnetAttributes).to.be.an('array').that.is.not.empty;
                expect(subnetAttributes.length).to.equal(9);

                expect(subnetAttributes[0].toNumber()).to.equal(subnetParam.subnetType);
                expect(subnetAttributes[1]).to.equal(subnetParam.sovereignStatus);
                expect(subnetAttributes[2].toNumber()).to.equal(subnetParam.cloudProviderType);
                expect(subnetAttributes[3]).to.equal(subnetParam.subnetStatusListed);
                expect(subnetAttributes[4].length).to.equal(subnetParam.unitPrices.length);

                for(var i = 0; i < subnetParam.unitPrices.length; i++) {
                    expect(subnetAttributes[4][i].eq(subnetParam.unitPrices[i])).to.be.true;
                }
                expect(subnetAttributes[5].length).to.equal(subnetParam.otherAttributes.length);
                for(var i = 0; i < subnetParam.otherAttributes.length; i++) {
                    expect(subnetAttributes[5][i].eq(subnetParam.otherAttributes[i])).to.be.true;
                }

                expect(subnetAttributes[6].toNumber()).to.equal(subnetParam.maxClusters);
                expect(subnetAttributes[7].toNumber()).to.equal(subnetParam.supportFeeRate);
                expect(subnetAttributes[8].eq(subnetParam.stackFeesReqd)).to.be.true;
            }
        })

        it("An Individual with x number of Dark Matter NFT and enough stack can create x subnets", async () => {
            const addrList = await ethers.getSigners();
            const nftToken = await helper.getNFTToken();
            const Registration = await helper.getRegistration();
            const stack = await helper.getStack();
            const testSize = 3;
            const nftList = [];
            const subnetList = [];
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);

            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );

            for(var i = 0; i < testSize; i++) {
                const nftTr = await nftToken.mint(addrList[1].address);
                const nftRec = await nftTr.wait();
                expect(nftRec.events).to.not.be.empty;
                expect(nftRec.events.length).to.be.greaterThan(0);
                const transferEvent = nftRec.events.find(event => event.event == "Transfer");
                expect(transferEvent).to.not.be.undefined;
        
                const nftID = transferEvent.args[2].toNumber();
                const ownerOfNFT = await nftToken.ownerOf(nftID);
                expect(ownerOfNFT).to.equal(addrList[1].address);
                nftList.push(nftID);
            }

            const curBalance = await stack.balanceOf(addrList[1].address);

            let minAmount = ethers.utils.parseEther("0.1");
            minAmount = minAmount.mul(3);
    
            if(curBalance.lt(minAmount)) {
                await stack.connect(addrList[0]).transfer(addrList[1].address,  minAmount);
            }
    
            const beforeSupply = await stack.balanceOf(addrList[1].address);

            const subnetLocalDAO = addrList[1].address;
            const subnetType = 1;
            const sovereignStatus = true;
            const cloudProviderType = 1;
            const subnetStatusListed = true;
            const unitPrices = [
                ethers.utils.parseEther("0.0001"),
                ethers.utils.parseEther("0.0002"),
                ethers.utils.parseEther("0.0003"),
                ethers.utils.parseEther("0.0004")
            ];
            const otherAttributes = [];
            const maxClusters = 3;
            const whiteListedClusters = [ addrList[1].address];
            const supportFeeRate = 5000;
            const stackFeesReqd = ethers.utils.parseEther("0.01");
    
            for(var i = 0; i < testSize; i++) {
                const nftID = nftList[i];
                const op = await Registration.connect(addrList[1]).createSubnet(
                    nftID,
                    subnetLocalDAO,
                    subnetType,
                    sovereignStatus,
                    cloudProviderType,
                    subnetStatusListed,
                    unitPrices,
                    otherAttributes,
                    maxClusters,
                    whiteListedClusters,
                    supportFeeRate,
                    stackFeesReqd
                );
                
                const tr = await op.wait();

                expect(tr.events.length).to.be.greaterThan(0);
    
                const subnetCreatedEvent = tr.events.find(event => event.event == "SubnetCreated");
                const NFTLocked = tr.events.find(event => event.event == "NFTLockedForSubnet");
        
                expect(subnetCreatedEvent).to.not.be.undefined;
                expect(NFTLocked).to.not.be.undefined;
        
                const subnetID = subnetCreatedEvent.args[0].toNumber();
                subnetList.push(subnetID);
            }
    
            const afterSupply = await stack.balanceOf(addrList[1].address);
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq(minAmount)).to.be.true;
    
    
            for(var s = 0; s < testSize; s++) {
                const nftID = nftList[s];
                const subnetID = subnetList[s];
                const newNFTOwner = await nftToken.ownerOf(nftID);

                expect(newNFTOwner).to.not.equal(addrList[1].address);
                expect(newNFTOwner).to.equal(helper.getAddresses().Registration);

                const subnetAttributes = await Registration.getSubnetAttributes(subnetID);

                expect(subnetAttributes).to.not.be.undefined;
                expect(subnetAttributes).to.be.an('array').that.is.not.empty;
                expect(subnetAttributes.length).to.equal(9);

                expect(subnetAttributes[0].toNumber()).to.equal(subnetType);
                expect(subnetAttributes[1]).to.equal(sovereignStatus);
                expect(subnetAttributes[2].toNumber()).to.equal(cloudProviderType);
                expect(subnetAttributes[3]).to.equal(subnetStatusListed);
                expect(subnetAttributes[4].length).to.equal(unitPrices.length);

                for(var i = 0; i < unitPrices.length; i++) {
                    expect(subnetAttributes[4][i].eq(unitPrices[i])).to.be.true;
                }
                expect(subnetAttributes[5].length).to.equal(otherAttributes.length);
                for(var i = 0; i < otherAttributes.length; i++) {
                    expect(subnetAttributes[5][i].eq(otherAttributes[i])).to.be.true;
                }

                expect(subnetAttributes[6].toNumber()).to.equal(maxClusters);
                expect(subnetAttributes[7].toNumber()).to.equal(supportFeeRate);
                expect(subnetAttributes[8].eq(stackFeesReqd)).to.be.true;
            }
        })
    })

    describe("Testing creation of clusters", async () => {

        it("An Individual without Dark Matter NFT cannot create a cluster on a subnet", async () => {
            const addrList = await ethers.getSigners();
    
            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    

            const maxTokenCount = await nftToken.balanceOf(addrList[1].address);
            for(var t = 0; t < maxTokenCount; t++) {
                const token = await nftToken.tokenOfOwnerByIndex(addrList[1].address, t);
                await nftToken.connect(addrList[1]).transferFrom(addrList[1].address, addrList[0].address, token);
            }

            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
    
            let falseFlag = false;
            try {
                tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "127.0.0.1", addrList[1].address, 0);
                rec = await tr.wait();
            }
            catch(err) {
                falseFlag = true;
            }

            expect(falseFlag).to.be.true;

        })

        it("An Individual with Dark Matter NFT and stack fees can create a cluster on a subnet", async () => {
            const addrList = await ethers.getSigners();
    
            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
    
            rec = await tr.wait();

            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            tr = await nftToken.mint(addrList[1].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();
    
            const ownerCheck = await nftToken.ownerOf(clusterNFTID);
            expect(ownerCheck).to.equal(addrList[1].address);
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
    
            const stack = await helper.getStack();
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            if(curBalance.lt(ethers.utils.parseEther("0.01"))) {
                await stack.transfer(addrList[1].address,  ethers.utils.parseEther("0.01"));
            }
            
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let beforeSupply = await stack.balanceOf(addrList[1].address);
    
            tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "127.0.0.1", addrList[1].address, clusterNFTID);
            rec = await tr.wait();
    
            let afterSupply = await stack.balanceOf(addrList[1].address);
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq( ethers.utils.parseEther("0.01"))).to.be.true;
    
            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const NFTLockedForClusterEvent = rec.events.find(event => event.event == "NFTLockedForCluster");
    
            expect(clusterSignedUpEvent).to.exist;
            expect(NFTLockedForClusterEvent).to.exist;
    
            const newNFTOwner = await nftToken.ownerOf(clusterNFTID);
            expect(newNFTOwner).to.not.equal(addrList[1].address);
            expect(newNFTOwner).to.equal(helper.getAddresses().Registration);
    
    
            const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
            const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
    
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
            expect(clusterAttributes[2]).to.equal(1);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
        })
    
    })

    describe("testing state of the clusters", () => {
        
        it("A cluster can be whitelisted initially by the subnet creator", async () => {
            const testSize = 5;
            const addrList = await ethers.getSigners();

            const stack = await helper.getStack();

            for(var i = 0; i < testSize; i++) {
                const op = await stack.connect(addrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            for(var i = 0; i < testSize; i++) {
                const nftToken = await helper.getNFTToken();
                let tr = await nftToken.mint(addrList[i].address);
                let rec = await tr.wait();
                let transferEvent = rec.events.find(event => event.event == "Transfer");
                const nftID = transferEvent.args[2].toNumber();

                await stack.transfer(addrList[i].address,  ethers.utils.parseEther("0.1"));

                tr = await Registration.connect(addrList[i]).createSubnet(
                    nftID,
                    addrList[0].address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                    [],
                    testSize,
                    [addrList[i].address],
                    5000,
                    ethers.utils.parseEther("0.01"));

                rec = await tr.wait();

                const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");

                const subnetID = subnetCreatedEvent.args[0].toNumber();

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
                expect(whitelist[0]).to.be.equal(addrList[i].address);


                for(var c = 0; c < testSize; c++) {
                    tr = await nftToken.mint(addrList[c].address);
                    rec = await tr.wait();
                    transferEvent = rec.events.find(event => event.event == "Transfer");
                    const clusterNFTID = transferEvent.args[2].toNumber();

                    await nftToken.connect(addrList[c]).setApprovalForAll(helper.getAddresses().Registration, true);

                    await stack.transfer(addrList[c].address,  ethers.utils.parseEther("0.01"));

                    tr = await Registration.connect(addrList[c]).clusterSignUp(subnetID, "127.0.0.1", addrList[c].address, clusterNFTID);
                    rec = await tr.wait();

                    const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                    const clusterID = clusterSignedUpEvent.args[1].toNumber();

                    const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

                    expect(clusterAttributes[0].toString()).to.equal(addrList[c].address);
                    if(i == c)
                        expect(clusterAttributes[2]).to.equal(2);
                    else
                        expect(clusterAttributes[2]).to.equal(1);
                    expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
                }

            }

        })
        
        it("Multiple clusters can be whitelisted initially by the subnet creator", async () => {
            const testClusterLimit = 10;
            const addrList = await ethers.getSigners();

            const stack = await helper.getStack();
        

            for(var i = 0; i < testClusterLimit; i++) {
                await stack.connect(addrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
            

            const whitelistedAddresses = [];
            const whitelistedIndexes = [0, 2, 5, 7 ,9];

            for(var i = 0; i < testClusterLimit; i++) {
                if(i in whitelistedIndexes) {
                    whitelistedAddresses.push(addrList[i].address);
                }
            }

            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                testClusterLimit,
                whitelistedAddresses,
                5000,
                ethers.utils.parseEther("0.01"));

            rec = await tr.wait();
            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();

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
            expect(whitelist.length).to.be.equal(whitelistedAddresses.length);
            for(var x = 0; x < whitelist.length; x++) {
                expect(whitelistedAddresses.find(addr => addr ==  whitelist[x])).to.not.be.undefined;
            }

            for(var c = 0; c < testClusterLimit; c++) {
                tr = await nftToken.mint(addrList[c].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();

                await nftToken.connect(addrList[c]).setApprovalForAll(helper.getAddresses().Registration, true);

                await stack.transfer(addrList[c].address,  ethers.utils.parseEther("0.01"));

                tr = await Registration.connect(addrList[c]).clusterSignUp(subnetID, "127.0.0.1", addrList[c].address, clusterNFTID);
                rec = await tr.wait();
            }

            const totalSigned = await Registration.totalClustersSigned(subnetID);
            expect(totalSigned).to.be.equal(testClusterLimit);

            for(var i = 0; i < testClusterLimit; i++) {
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, i);
                expect(clusterAttributes[0].toString()).to.equal(addrList[i].address);

                if(i in whitelistedAddresses) {
                    expect(clusterAttributes[2]).to.equal(2);
                }
                else {
                    expect(clusterAttributes[2]).to.equal(1);
                }
            }

        })

        it("A cluster cannot be whitelisted by anyone other than Global DAO or subnet DAO", async () => {
            const addrList = await ethers.getSigners();
            const maxClusters = 5;
            const invalidID = 9;

            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();

            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                maxClusters,
                [],
                5000,
                ethers.utils.parseEther("0.01"));

            rec = await tr.wait();

            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");

            const subnetID = subnetCreatedEvent.args[0].toNumber();

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

            for(var c = 0; c < maxClusters; c++) {
                tr = await nftToken.mint(addrList[c].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();

                await nftToken.connect(addrList[c]).setApprovalForAll(helper.getAddresses().Registration, true);

                const stack = await helper.getStack();
                await stack.transfer(addrList[c].address,  ethers.utils.parseEther("0.01"));

                await stack.connect(addrList[c]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );

                tr = await Registration.connect(addrList[c]).clusterSignUp(subnetID, "127.0.0.1", addrList[c].address, clusterNFTID);
                rec = await tr.wait();

                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
        
                expect(clusterSignedUpEvent).to.exist;

                const newNFTOwner = await nftToken.ownerOf(clusterNFTID);
                expect(newNFTOwner).to.not.equal(addrList[c].address);
                expect(newNFTOwner).to.equal(helper.getAddresses().Registration);
                const clusterID = clusterSignedUpEvent.args[1].toNumber();

                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

                expect(clusterAttributes[0].toString()).to.equal(addrList[c].address);
                expect(clusterAttributes[2]).to.equal(1);
            }

            for(var c = 0; c < maxClusters; c++) {
                let failCheck = false;
                try {
                    await Registration.connect(addrList[invalidID]).addClusterToWhitelisted(subnetID, c);
                } catch(err) {
                    failCheck = true;
                }
                expect(failCheck).to.be.true;

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

        it("A cluster can be whitelisted by the subnet DAO", async () => {
            const testSize = 5;
            const addrList = await ethers.getSigners();

            const stack = await helper.getStack();

            for(var i = 0; i < testSize; i++) {
                const op = await stack.connect(addrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            for(var i = 0; i < testSize; i++) {
                const nftToken = await helper.getNFTToken();
                let tr = await nftToken.mint(addrList[i].address);
                let rec = await tr.wait();
                let transferEvent = rec.events.find(event => event.event == "Transfer");
                const nftID = transferEvent.args[2].toNumber();

                await stack.transfer(addrList[i].address,  ethers.utils.parseEther("0.1"));

                tr = await Registration.connect(addrList[i]).createSubnet(
                    nftID,
                    addrList[0].address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                    [],
                    testSize,
                    [],
                    5000,
                    ethers.utils.parseEther("0.01"));

                rec = await tr.wait();

                const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");

                const subnetID = subnetCreatedEvent.args[0].toNumber();

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

                await Registration.addClusterToWhitelisted(subnetID, [addrList[i].address]);

                w = 0;
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
                expect(whitelist[0]).to.be.equal(addrList[i].address);


                for(var c = 0; c < testSize; c++) {
                    tr = await nftToken.mint(addrList[c].address);
                    rec = await tr.wait();
                    transferEvent = rec.events.find(event => event.event == "Transfer");
                    const clusterNFTID = transferEvent.args[2].toNumber();

                    await nftToken.connect(addrList[c]).setApprovalForAll(helper.getAddresses().Registration, true);

                    await stack.transfer(addrList[c].address,  ethers.utils.parseEther("0.01"));

                    tr = await Registration.connect(addrList[c]).clusterSignUp(subnetID, "127.0.0.1", addrList[c].address, clusterNFTID);
                    rec = await tr.wait();

                    const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                    const clusterID = clusterSignedUpEvent.args[1].toNumber();

                    const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

                    expect(clusterAttributes[0].toString()).to.equal(addrList[c].address);
                    if(i == c)
                        expect(clusterAttributes[2]).to.equal(2);
                    else
                        expect(clusterAttributes[2]).to.equal(1);
                    expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
                }

            }

        })

        it("Multiple clusters can be whitelisted by the subnet DAO", async () => {
            const testClusterLimit = 10;
            const addrList = await ethers.getSigners();

            const stack = await helper.getStack();


            for(var i = 0; i < testClusterLimit; i++) {
                await stack.connect(addrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
            

            const whitelistedAddresses = [];
            const whitelistedIndexes = [0, 2, 5, 7 ,9];

            for(var i = 0; i < testClusterLimit; i++) {
                if(i in whitelistedIndexes) {
                    whitelistedAddresses.push(addrList[i].address);
                }
            }

            tr = await Registration.createSubnet(
                nftID,
                addrList[1].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                testClusterLimit,
                [],
                5000,
                ethers.utils.parseEther("0.01"));

            rec = await tr.wait();
            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();

            
            var w = 0;
            while(true) {
                try {
                    await Registration.whiteListedClusters(subnetID, w);
                    w++;
                } catch(err) {
                    break;
                }
            }

            await Registration.connect(addrList[1]).addClusterToWhitelisted(subnetID, whitelistedAddresses);
            expect(w).to.be.equal(0);

            w = 0;
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
            expect(whitelist.length).to.be.equal(whitelistedAddresses.length);
            for(var x = 0; x < whitelist.length; x++) {
                expect(whitelistedAddresses.find(addr => addr ==  whitelist[x])).to.not.be.undefined;
            }

            for(var c = 0; c < testClusterLimit; c++) {
                tr = await nftToken.mint(addrList[c].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();

                await nftToken.connect(addrList[c]).setApprovalForAll(helper.getAddresses().Registration, true);

                await stack.transfer(addrList[c].address,  ethers.utils.parseEther("0.01"));

                tr = await Registration.connect(addrList[c]).clusterSignUp(subnetID, "127.0.0.1", addrList[c].address, clusterNFTID);
                rec = await tr.wait();
            }

            const totalSigned = await Registration.totalClustersSigned(subnetID);
            expect(totalSigned).to.be.equal(testClusterLimit);

            for(var i = 0; i < testClusterLimit; i++) {
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, i);
                expect(clusterAttributes[0].toString()).to.equal(addrList[i].address);

                if(i in whitelistedAddresses) {
                    expect(clusterAttributes[2]).to.equal(2);
                }
                else {
                    expect(clusterAttributes[2]).to.equal(1);
                }
            }

        })

        it("Subnet should have maximum limit for clusters and all the clusters are not approved", async () => {
            const addrList = await ethers.getSigners();
            const maximumClusterLimit = 3;

            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();

            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                maximumClusterLimit,
                [],
                5000,
                ethers.utils.parseEther("0.01"));

            rec = await tr.wait();

            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();

            const signupCluster = async () => {
                tr = await nftToken.mint(addrList[0].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();

                tr = await Registration.clusterSignUp(subnetID, "127.0.0.1", addrList[0].address, clusterNFTID);
                rec = await tr.wait();

                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();

                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

                expect(clusterAttributes[0].toString()).to.equal(addrList[0].address);
                expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
                expect(clusterAttributes[2]).to.equal(1);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);

            }

            for(var i = 0; i < maximumClusterLimit; i++) {
                await signupCluster();
            }

            const totalClusters = await Registration.totalClustersSigned(subnetID);
            // expect(totalClusters).to.equal(3);

            let signupFail = false;
            try {
                await signupCluster();
            }
            catch(err) {
                signupFail = true;
            }

            expect(signupFail).to.be.true;

        })

        it("Subnet should have maximum limit for clusters and all the clusters are approved", async () => {
            const addrList = await ethers.getSigners();
            const maximumClusterLimit = 3;

            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();

            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                maximumClusterLimit,
                [addrList[0].address],
                // [],
                5000,
                ethers.utils.parseEther("0.01"));

            rec = await tr.wait();

            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();

            const signupCluster = async () => {
                tr = await nftToken.mint(addrList[0].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();

                tr = await Registration.clusterSignUp(subnetID, "127.0.0.1", addrList[0].address, clusterNFTID);
                rec = await tr.wait();

                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();

                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

                expect(clusterAttributes[0].toString()).to.equal(addrList[0].address);
                expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
                // expect(clusterAttributes[2]).to.equal(2);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);

            }

            for(var i = 0; i < maximumClusterLimit; i++) {
                await signupCluster();
            }

            const totalClusters = await Registration.totalClustersSigned(subnetID);
            // expect(totalClusters).to.equal(3);

            let signupFail = false;
            try {
                await signupCluster();
            }
            catch(err) {
                signupFail = true;
            }

            expect(signupFail).to.be.true;

        })

        it("Subnet should have maximum limit for clusters and all the clusters are delisted", async () => {
            const addrList = await ethers.getSigners();
            const maximumClusterLimit = 3;

            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();

            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                maximumClusterLimit,
                [addrList[0].address],
                // [],
                5000,
                ethers.utils.parseEther("0.01"));

            rec = await tr.wait();

            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();

            const signupCluster = async () => {
                tr = await nftToken.mint(addrList[0].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();

                tr = await Registration.clusterSignUp(subnetID, "127.0.0.1", addrList[0].address, clusterNFTID);
                rec = await tr.wait();

                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();

                let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

                expect(clusterAttributes[0].toString()).to.equal(addrList[0].address);
                expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
                expect(clusterAttributes[2]).to.equal(2);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);


                return clusterID;

            }

            for(var i = 0; i < maximumClusterLimit; i++) {
                const clusterID = await signupCluster();
                await Registration.delistCluster(subnetID, clusterID);
                clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
                expect(clusterAttributes[2]).to.equal(3);
            }

            const totalClusters = await Registration.totalClustersSigned(subnetID);
            // expect(totalClusters).to.equal(3);

            let signupFail = false;
            try {
                await signupCluster();
            }
            catch(err) {
                signupFail = true;
            }

            expect(signupFail).to.be.false;

        })
    })

    describe("testing SubnetDAO approve/delisting cluster", async () => {

        it("SubnetDAO can approve a cluster", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
            const subnetDAO = addrList[1];
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);
    
            tr = await nftToken.mint(addrList[1].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            const minAmount = ethers.utils.parseEther("0.01");
            if(curBalance.lt(minAmount)) {
                await stack.transfer(addrList[1].address,  minAmount);
            }
    
            tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "cluster1", addrList[1].address, clusterNFTID);
            rec = await tr.wait();
    
            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();
            
    
            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(1);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);
    
            clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(2);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
        })
    
        it("SubnetDAO can delist a cluster", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
            const subnetDAO = addrList[1];
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);
    
            tr = await nftToken.mint(addrList[1].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            const minAmount = ethers.utils.parseEther("0.01");
            if(curBalance.lt(minAmount)) {
                await stack.transfer(addrList[1].address,  minAmount);
            }
    
            tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "cluster1", addrList[1].address, clusterNFTID);
            rec = await tr.wait();
    
            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(1);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);
    
            clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(3);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
        })
    
        it("SubnetDAO first approves then delists a cluster", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
            const subnetDAO = addrList[1];
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
            
            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);
    
            tr = await nftToken.mint(addrList[1].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            const minAmount = ethers.utils.parseEther("0.01");
            if(curBalance.lt(minAmount)) {
                await stack.transfer(addrList[1].address,  minAmount);
            }
    
            tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "cluster1", addrList[1].address, clusterNFTID);
            rec = await tr.wait();
    
            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(1);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);
    
            clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(2);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);
    
            clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(3);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
        })
        
        it("SubnetDAO first delists then approves a cluster", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
            const subnetDAO = addrList[1];
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);
    
            tr = await nftToken.mint(addrList[1].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            const minAmount = ethers.utils.parseEther("0.01");
            if(curBalance.lt(minAmount)) {
                await stack.transfer(addrList[1].address,  minAmount);
            }
    
            tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "cluster1", addrList[1].address, clusterNFTID);
            rec = await tr.wait();
    
            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(1);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);
    
            clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(3);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);
    
            clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[2]).to.equal(2);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
        })

        it("SubnetDAO can change the list state of multiple clusters", async () => {
            const addrList = await ethers.getSigners();
            const clusterLimit = 3;
            const subnetDAO = addrList[1];
            const clusterList = [];
            const nftToken = await helper.getNFTToken();
            const stack = await helper.getStack();
            const clAddrList = [];
            for(var i = 0; i < clusterLimit; i++) {
                clAddrList.push(addrList[i + 5]);
            }
    
            for(var i = 0; i < clusterLimit; i++) {
                await nftToken.connect(clAddrList[i]).setApprovalForAll(helper.getAddresses().Registration, true);
                await stack.connect(clAddrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                clusterLimit,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);
    
            const signupCluster = async (i) => {
                tr = await nftToken.mint(clAddrList[i].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();
    
                const balance = await stack.balanceOf(clAddrList[i].address);
                const minAmount = ethers.utils.parseEther("0.01");
                if(balance.lt(minAmount)) {
                    await stack.transfer(clAddrList[i].address, minAmount);
                }
    
                tr = await Registration.connect(clAddrList[i]).clusterSignUp(subnetID, "127.0.0.1", clAddrList[i].address, clusterNFTID);
                rec = await tr.wait();
    
                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
                expect(clusterAttributes[0].toString()).to.equal(clAddrList[i].address);
                expect(clusterAttributes[2]).to.equal(1);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
                clusterList.push(clusterID);
            }
    
            for(var i = 0; i < clusterLimit; i++) {
                await signupCluster(i);
            }
    
            const delistID = clusterLimit >> 1;
            const approveID = clusterLimit-1;
    
            await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterList[approveID], 100);
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterList[delistID]);
    
            for(var i = 0; i < clusterLimit; i++) {
                const clusterID = clusterList[i];
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
                expect(clusterAttributes[0].toString()).to.equal(clAddrList[i].address);
    
                if(i == approveID)
                    expect(clusterAttributes[2]).to.equal(2);
                else if(i == delistID)
                    expect(clusterAttributes[2]).to.equal(3);
                else
                    expect(clusterAttributes[2]).to.equal(1);
            }
    
        })
    
        it("Only allow signup of cluster if the subnet has not reached maximum capacity", async () => {
            const addrList = await ethers.getSigners();
            const clusterLimit = 3;
            const subnetDAO = addrList[1];
            let clusterList = [];
            const nftToken = await helper.getNFTToken();
            const stack = await helper.getStack();
            const clAddrList = [];
            let subnetID = 0;
    
            for(var i = 0; i < clusterLimit + 1; i++) {
                clAddrList.push(addrList[i + 5]);
            }
    
            for(var i = 0; i < clusterLimit + 1; i++) {
                await nftToken.connect(clAddrList[i]).setApprovalForAll(helper.getAddresses().Registration, true);
                await stack.connect(clAddrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            const signupCluster = async (i) => {
                let tr = await nftToken.mint(clAddrList[i].address);
                let rec = await tr.wait();
                let transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();
    
                const balance = await stack.balanceOf(clAddrList[i].address);
                const minAmount = ethers.utils.parseEther("0.01");
                if(balance.lt(minAmount)) {
                    await stack.transfer(clAddrList[i].address, minAmount);
                }
    
                tr = await Registration.connect(clAddrList[i]).clusterSignUp(subnetID, "127.0.0.1", clAddrList[i].address, clusterNFTID);
                rec = await tr.wait();
    
                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
                await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);
    
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
                expect(clusterAttributes[0].toString()).to.equal(clAddrList[i].address);
                expect(clusterAttributes[2]).to.equal(2);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
                clusterList.push(clusterID);
            }
    
            for(var i = 0; i < clusterLimit; i++) {
                clusterList = [];
                let tr = await nftToken.mint(addrList[0].address);
                let rec = await tr.wait();
                let transferEvent = rec.events.find(event => event.event == "Transfer");
                const nftID = transferEvent.args[2].toNumber();

                tr = await Registration.createSubnet(
                    nftID,
                    subnetDAO.address,
                    1,
                    true,
                    1,
                    true,
                    [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                    [],
                    clusterLimit,
                    [],
                    5000,
                    ethers.utils.parseEther("0.01"));
                rec = await tr.wait();
                const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
                subnetID = subnetCreatedEvent.args[0].toNumber();

                const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
                await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);

                for(var c = 0; c < clusterLimit; c++) {
                    await signupCluster(c);
                }

                for(var j = 0; j < i + 1; j++) {
                    await Registration.connect(subnetDAO).delistCluster(subnetID, clusterList[j]);
                }

                var totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
                expect(totalSpots).to.be.equal(i+1);

                for(var j = 0; j < i + 1; j++) {
                    await signupCluster(j);
                }

                totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
                expect(totalSpots).to.be.equal(0);

                await expect(
                    signupCluster(i+1)
                ).to.be.revertedWith(
                    "No spots available, maxSlots reached for subnet"
                )

                totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
                expect(totalSpots).to.be.equal(0);
            }
        })
    
        it("There can be multiple delisted clusters exceeding max capacity, but only allow approval of cluster if the subnet has not reached maximum capacity", async () => {
            const addrList = await ethers.getSigners();
            const clusterLimit = 3;
            const subnetDAO = addrList[1];
            let clusterList = [];
            const nftToken = await helper.getNFTToken();
            const stack = await helper.getStack();
            const clAddrList = [];
            let subnetID = 0;
    
            for(var i = 0; i < clusterLimit + 1; i++) {
                clAddrList.push(addrList[i + 5]);
            }
    
            for(var i = 0; i < clusterLimit + 1; i++) {
                await nftToken.connect(clAddrList[i]).setApprovalForAll(helper.getAddresses().Registration, true);
                await stack.connect(clAddrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }

            const signupCluster = async (i) => {
                let tr = await nftToken.mint(clAddrList[i].address);
                let rec = await tr.wait();
                let transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();
    
                const balance = await stack.balanceOf(clAddrList[i].address);
                const minAmount = ethers.utils.parseEther("0.01");
                if(balance.lt(minAmount)) {
                    await stack.transfer(clAddrList[i].address, minAmount);
                }
    
                tr = await Registration.connect(clAddrList[i]).clusterSignUp(subnetID, "127.0.0.1", clAddrList[i].address, clusterNFTID);
                rec = await tr.wait();
    
                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
                await Registration.connect(subnetDAO).delistCluster(subnetID, clusterID);
    
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
                expect(clusterAttributes[0].toString()).to.equal(clAddrList[i].address);
                expect(clusterAttributes[2]).to.equal(3);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
                clusterList.push(clusterID);
            }
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();

            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                clusterLimit,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            subnetID = subnetCreatedEvent.args[0].toNumber();

            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);

            for(var c = 0; c < clusterLimit + 1; c++) {
                await signupCluster(c);
            }

            var totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(clusterLimit);

            for(var c = 0; c < clusterLimit; c++) {
                await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterList[c], 100);   
            }

            totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(0);

            await expect(
                Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterList[clusterLimit], 100)
            ).to.be.reverted;

            totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(0);
        })

        it("In a subnet with maximum capacity of clusters reached, it should not be possible to approve an older cluster exceeding the maximum capacity", async () => {
            const addrList = await ethers.getSigners();
            const clusterLimit = 3;
            const subnetDAO = addrList[1];
            const clusterList = [];
            const nftToken = await helper.getNFTToken();
            const stack = await helper.getStack();
            const clAddrList = [];
    
            for(var i = 0; i < clusterLimit + 1; i++) {
                clAddrList.push(addrList[i + 5]);
            }
    
            for(var i = 0; i < clusterLimit + 1; i++) {
                await nftToken.connect(clAddrList[i]).setApprovalForAll(helper.getAddresses().Registration, true);
                await stack.connect(clAddrList[i]).approve(
                    helper.getAddresses().Registration,
                    ethers.utils.parseEther("1000000000")
                );
            }
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                clusterLimit,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const CLUSTER_ROLE = await Registration.CLUSTER_LIST_ROLE();
            await Registration.grantRole(CLUSTER_ROLE, subnetDAO.address);
    
            const signupCluster = async (i) => {
                tr = await nftToken.mint(clAddrList[i].address);
                rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();
    
                const balance = await stack.balanceOf(clAddrList[i].address);
                const minAmount = ethers.utils.parseEther("0.01");
                if(balance.lt(minAmount)) {
                    await stack.transfer(clAddrList[i].address, minAmount);
                }
    
                tr = await Registration.connect(clAddrList[i]).clusterSignUp(subnetID, "127.0.0.1", clAddrList[i].address, clusterNFTID);
                rec = await tr.wait();
    
                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
                await Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterID, 100);
    
                const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
                expect(clusterAttributes[0].toString()).to.equal(clAddrList[i].address);
                expect(clusterAttributes[2]).to.equal(2);
                expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
                clusterList.push(clusterID);
            }
    
            for(var i = 0; i < clusterLimit; i++) {
                await signupCluster(i);
            }
    
            await Registration.connect(subnetDAO).delistCluster(subnetID, clusterList[0]);
    
            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterList[0]);
            expect(clusterAttributes[2]).to.equal(3);
    
            await signupCluster(clusterLimit);
    
            var totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(0);
    
            await expect(
                Registration.connect(subnetDAO).approveListingCluster(subnetID, clusterList[0], 100)
            ).to.be.reverted;
            var totalSpots = await Registration.totalClusterSpotsAvailable(subnetID);
            expect(totalSpots).to.be.equal(0);
    
        })
    })

    describe("testing unit price change", async () => {
        it("An Individual with Dark Matter NFT and stack fees can create a cluster on a subnet", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            const unitPrices = [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")];
    
            tr = await Registration.createSubnet(
                nftID,
                addrList[1].address,
                1,
                true,
                1,
                true,
                unitPrices,
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
    
            rec = await tr.wait();
    
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const PRICE_CHANGE = await Registration.PRICE_CHANGE();
            console.log(PRICE_CHANGE);
    
    
        })
    })

    describe("testing unit price change", async () => {
        it("An Individual with Dark Matter NFT and stack fees can create a cluster on a subnet", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
            const subnetDAO = addrList[1];
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            const unitPrices = [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")];
    
            tr = await Registration.createSubnet(
                nftID,
                subnetDAO.address,
                1,
                true,
                1,
                true,
                unitPrices,
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
    
            rec = await tr.wait();
    
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();

            let subnetAttributes = await Registration.getSubnetAttributes(subnetID);
            const subnetUnitPrices = subnetAttributes[4];
            for(var i = 0; i < unitPrices.length; i++) {
                expect(unitPrices[i].eq(subnetUnitPrices[i])).to.be.true;
            }

            const newUnitPrices = [ethers.utils.parseEther("0.4"),ethers.utils.parseEther("0.3"),ethers.utils.parseEther("0.10"),ethers.utils.parseEther("0.8")];
           
            await expect(
                Registration.connect(subnetDAO).requestClusterPriceChange(subnetID, newUnitPrices)
            ).to.be.reverted;

            const PRICE_ROLE = await Registration.PRICE_ROLE();
            await Registration.grantRole(PRICE_ROLE, subnetDAO.address);

            await Registration.connect(subnetDAO).requestClusterPriceChange(subnetID, newUnitPrices);

            subnetAttributes = await Registration.getSubnetAttributes(subnetID);
            for(var i = 0; i < unitPrices.length; i++) {
                expect(unitPrices[i].eq(subnetUnitPrices[i])).to.be.true;
            }

            await expect(
                Registration.applyChangedClusterPrice(subnetID)
            ).to.be.reverted;

            const COOLDOWN_ROLE = await Registration.COOLDOWN_ROLE();
            await Registration.grantRole(COOLDOWN_ROLE, subnetDAO.address);
            await Registration.connect(subnetDAO).changeCoolDownTime(0);

            await Registration.connect(subnetDAO).applyChangedClusterPrice(subnetID);

            subnetAttributes = await Registration.getSubnetAttributes(subnetID);
            const changedSubnetPrices = subnetAttributes[4];
            for(var i = 0; i < unitPrices.length; i++) {
                expect(newUnitPrices[i].eq(changedSubnetPrices[i])).to.be.true;
            }
        })
    })

    describe("Testing if a subnet is sovereign", async () => {
        it("If a subnet is not sovereign, then during a cluster signup a DNSIP needs to be provided, otherwise it is not required. A cluster owner can also change the DNSIP after signup.", async () => {
            const addrList = await ethers.getSigners();
            const stack = await helper.getStack();
            const nftToken = await helper.getNFTToken();
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            let nftID = transferEvent.args[2].toNumber();
    
            let sovereignFlag = false;
            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                sovereignFlag,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            var subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            const clusterSignup = async (subnetID, DNSIP) => {
                let tr = await nftToken.mint(addrList[1].address);
                let rec = await tr.wait();
                transferEvent = rec.events.find(event => event.event == "Transfer");
                const clusterNFTID = transferEvent.args[2].toNumber();
    
                const curBalance = await stack.balanceOf(addrList[1].address);
                if(curBalance.lt(ethers.utils.parseEther("0.01"))) {
                    await stack.transfer(addrList[1].address,  ethers.utils.parseEther("0.01"));
                }
    
                tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, DNSIP, addrList[1].address, clusterNFTID);
                rec = await tr.wait();
                const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
                const clusterID = clusterSignedUpEvent.args[1].toNumber();
                return clusterID;
            }
    
            let dnsip = "127.0.0.1";
            let clusterID = await clusterSignup(subnetID, dnsip);
            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
            expect(clusterAttributes[1]).to.be.equal(dnsip);
    
            await expect(
                clusterSignup(subnetID, "")
            ).to.be.reverted;
    
            tr = await nftToken.mint(addrList[0].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            nftID = transferEvent.args[2].toNumber();
    
            sovereignFlag = true;
            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                sovereignFlag,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
                rec = await tr.wait();
                subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
                const sovereignSubnetID = subnetCreatedEvent.args[0].toNumber();
    
                dnsip = "192.168.0.1";
                clusterID = await clusterSignup(sovereignSubnetID, dnsip);
                clusterAttributes = await Registration.getClusterAttributes(sovereignSubnetID, clusterID);
                expect(clusterAttributes[1]).to.be.equal(dnsip);
    
                clusterID = await clusterSignup(sovereignSubnetID, "");
                clusterAttributes = await Registration.getClusterAttributes(sovereignSubnetID, clusterID);
                expect(clusterAttributes[1]).to.be.equal("");
        })
    })

    describe("Global DAO can change NFT contract and withdraw NFT", async () => {
        it("An Individual with Dark Matter NFT and stack fees can create a cluster on a subnet", async () => {
            const addrList = await ethers.getSigners();
    
            const nftToken = await helper.getNFTToken();
            let tr = await nftToken.mint(addrList[0].address);
            let rec = await tr.wait();
            let transferEvent = rec.events.find(event => event.event == "Transfer");
            const nftID = transferEvent.args[2].toNumber();
    
            tr = await Registration.createSubnet(
                nftID,
                addrList[0].address,
                1,
                true,
                1,
                true,
                [ethers.utils.parseEther("0.0001"),ethers.utils.parseEther("0.0002"),ethers.utils.parseEther("0.0003"),ethers.utils.parseEther("0.0004")],
                [],
                3,
                [],
                5000,
                ethers.utils.parseEther("0.01"));
            rec = await tr.wait();
            const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");    
            const subnetID = subnetCreatedEvent.args[0].toNumber();
    
            tr = await nftToken.mint(addrList[1].address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();
    
            const ownerCheck = await nftToken.ownerOf(clusterNFTID);
            expect(ownerCheck).to.equal(addrList[1].address);
    
            await nftToken.connect(addrList[1]).setApprovalForAll(helper.getAddresses().Registration, true);
    
            const stack = await helper.getStack();
    
            const curBalance = await stack.balanceOf(addrList[1].address);
    
            if(curBalance.lt(ethers.utils.parseEther("0.01"))) {
                await stack.transfer(addrList[1].address,  ethers.utils.parseEther("0.01"));
            }
            
            await stack.connect(addrList[1]).approve(
                helper.getAddresses().Registration,
                ethers.utils.parseEther("1000000000")
            );
    
            let beforeSupply = await stack.balanceOf(addrList[1].address);
    
            tr = await Registration.connect(addrList[1]).clusterSignUp(subnetID, "127.0.0.1", addrList[1].address, clusterNFTID);
            rec = await tr.wait();
    
            let afterSupply = await stack.balanceOf(addrList[1].address);
            let deducted = beforeSupply.sub(afterSupply);
            expect(deducted.eq( ethers.utils.parseEther("0.01"))).to.be.true;
    
            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const NFTLockedForClusterEvent = rec.events.find(event => event.event == "NFTLockedForCluster");
    
            expect(clusterSignedUpEvent).to.exist;
            expect(NFTLockedForClusterEvent).to.exist;
    
            const newNFTOwner = await nftToken.ownerOf(clusterNFTID);
            expect(newNFTOwner).to.not.equal(addrList[1].address);
            expect(newNFTOwner).to.equal(helper.getAddresses().Registration);
    
    
            const clusterID = clusterSignedUpEvent.args[1].toNumber();
    
            const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);
    
            expect(clusterAttributes[0].toString()).to.equal(addrList[1].address);
            expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
            expect(clusterAttributes[2]).to.equal(1);
            expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
        })
    
    })


})