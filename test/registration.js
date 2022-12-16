const { expect } = require("chai");
const helper = require("../scripts/helper.js")

describe("testing Registration contract", () => {

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

        const subnetLocalDAO = helper.getAddresses().deployer;
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
        const whiteListedClusters = [ helper.getAddresses().deployer];
        const supportFeeRate = 5000;
        const stackFeesReqd = ethers.utils.parseEther("0.01");

        const op = await Registration.createSubnet(
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

        const subnetId = subnetCreatedEvent.args[0].toNumber();

        const newNFTOwner = await nftToken.ownerOf(nftID);

        expect(newNFTOwner).to.not.equal(helper.getAddresses().deployer);
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
        const clusterNFTID = transferEvent.args[2].toNumber();

        const ownerCheck = await nftToken.ownerOf(clusterNFTID);
        expect(ownerCheck).to.equal(addr1.address);

        await nftToken.connect(addr1).setApprovalForAll(helper.getAddresses().Registration, true);

        const stack = await helper.getStack();
        await stack.transfer(addr1.address,  ethers.utils.parseEther("0.01"));

        const op = await stack.connect(addr1).approve(
            helper.getAddresses().Registration,
            ethers.utils.parseEther("1000000000")
        );

        let beforeSupply = await stack.balanceOf(addr1.address);

        tr = await Registration.connect(addr1).clusterSignUp(subnetID, "127.0.0.1", helper.accounts[1], clusterNFTID);
        rec = await tr.wait();

        let afterSupply = await stack.balanceOf(addr1.address);
        let deducted = beforeSupply.sub(afterSupply);
        expect(deducted.eq( ethers.utils.parseEther("0.01"))).to.be.true;

        const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
        const NFTLockedForClusterEvent = rec.events.find(event => event.event == "NFTLockedForCluster");

        expect(clusterSignedUpEvent).to.exist;
        expect(NFTLockedForClusterEvent).to.exist;

        const newNFTOwner = await nftToken.ownerOf(clusterNFTID);
        expect(newNFTOwner).to.not.equal(helper.accounts[1]);
        expect(newNFTOwner).to.equal(helper.getAddresses().Registration);


        const clusterID = clusterSignedUpEvent.args[1].toNumber();

        const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

        expect(clusterAttributes[0].toString()).to.equal(helper.accounts[1]);
        expect(clusterAttributes[1].toString()).to.equal("127.0.0.1");
        expect(clusterAttributes[2]).to.equal(1);
        expect(clusterAttributes[3].toNumber()).to.equal(clusterNFTID);
    })

    
    it("Whitelisted clusters can be defined initially by the subnet creator", async () => {
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
            [ addr1.address],
            5000,
            ethers.utils.parseEther("0.01"));

        rec = await tr.wait();
        
        const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
        const subnetID = subnetCreatedEvent.args[0].toNumber();


        tr = await nftToken.mint(addr1.address);
        rec = await tr.wait();
        transferEvent = rec.events.find(event => event.event == "Transfer");
        const cluster1NFTID = transferEvent.args[2].toNumber();

        tr = await nftToken.mint(addr2.address);
        rec = await tr.wait();
        transferEvent = rec.events.find(event => event.event == "Transfer");
        const cluster2NFTID = transferEvent.args[2].toNumber();

        const stack = await helper.getStack();
        await stack.transfer(addr1.address,  ethers.utils.parseEther("0.01"));
        await stack.transfer(addr2.address,  ethers.utils.parseEther("0.01"));

        await nftToken.connect(addr1).setApprovalForAll(helper.getAddresses().Registration, true);
        await nftToken.connect(addr2).setApprovalForAll(helper.getAddresses().Registration, true);

        await stack.connect(addr1).approve(
            helper.getAddresses().Registration,
            ethers.utils.parseEther("1000000000")
        );
        await stack.connect(addr2).approve(
            helper.getAddresses().Registration,
            ethers.utils.parseEther("1000000000")
        );

        tr = await Registration.connect(addr1).clusterSignUp(subnetID, "127.0.0.1", addr1.address, cluster1NFTID);
        rec = await tr.wait();
        let clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
        const cluster1ID = clusterSignedUpEvent.args[1].toNumber();

        tr = await Registration.connect(addr2).clusterSignUp(subnetID, "127.0.0.1", addr2.address, cluster2NFTID);
        rec = await tr.wait();
        clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
        const cluster2ID = clusterSignedUpEvent.args[1].toNumber();

        const cluster1Attributes = await Registration.getClusterAttributes(subnetID, cluster1ID);
        expect(cluster1Attributes[0].toString()).to.equal(addr1.address);
        expect(cluster1Attributes[2]).to.equal(2);
        expect(cluster1Attributes[3].toNumber()).to.equal(cluster1NFTID);

        const cluster2Attributes = await Registration.getClusterAttributes(subnetID, cluster2ID);
        expect(cluster2Attributes[0].toString()).to.equal(addr2.address);
        expect(cluster2Attributes[2]).to.equal(1);
        expect(cluster2Attributes[3].toNumber()).to.equal(cluster2NFTID);

    })

    it("Subnet should have maximum limit for clusters and all the clusters are in waiting", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const maximumClusterLimit = 3;

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
            maximumClusterLimit,
            //  [owner.address],
            [],
            5000,
            ethers.utils.parseEther("0.01"));

        rec = await tr.wait();

        
        const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
        const subnetID = subnetCreatedEvent.args[0].toNumber();

        const signupCluster = async () => {
            tr = await nftToken.mint(owner.address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();

            tr = await Registration.clusterSignUp(subnetID, "127.0.0.1", owner.address, clusterNFTID);
            rec = await tr.wait();

            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();

            const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

            expect(clusterAttributes[0].toString()).to.equal(owner.address);
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


    it("Subnet should have maximum limit for clusters which are whitelisted", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const maximumClusterLimit = 3;

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
            maximumClusterLimit,
            [owner.address],
            // [],
            5000,
            ethers.utils.parseEther("0.01"));

        rec = await tr.wait();

        
        const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
        const subnetID = subnetCreatedEvent.args[0].toNumber();

        const signupCluster = async () => {
            tr = await nftToken.mint(owner.address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();

            tr = await Registration.clusterSignUp(subnetID, "127.0.0.1", owner.address, clusterNFTID);
            rec = await tr.wait();

            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();

            const clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

            expect(clusterAttributes[0].toString()).to.equal(owner.address);
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


    it("Subnet should have maximum limit for clusters which are in delisted", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const maximumClusterLimit = 3;

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
            maximumClusterLimit,
            [owner.address],
            // [],
            5000,
            ethers.utils.parseEther("0.01"));

        rec = await tr.wait();

        
        const subnetCreatedEvent = rec.events.find(event => event.event == "SubnetCreated");
        const subnetID = subnetCreatedEvent.args[0].toNumber();

        const signupCluster = async () => {
            tr = await nftToken.mint(owner.address);
            rec = await tr.wait();
            transferEvent = rec.events.find(event => event.event == "Transfer");
            const clusterNFTID = transferEvent.args[2].toNumber();

            tr = await Registration.clusterSignUp(subnetID, "127.0.0.1", owner.address, clusterNFTID);
            rec = await tr.wait();

            const clusterSignedUpEvent = rec.events.find(event => event.event == "ClusterSignedUp");
            const clusterID = clusterSignedUpEvent.args[1].toNumber();

            let clusterAttributes = await Registration.getClusterAttributes(subnetID, clusterID);

            expect(clusterAttributes[0].toString()).to.equal(owner.address);
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