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
        attributes.stackFeesReqd,
        "subnet"
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
        await xct.mint(account.address, balanceToAdd);
        // let stash = await xct.balanceOf(addrList[0].address);
        // await xct.connect(addrList[0]).transfer(account.address,  balanceToAdd);
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

		
        it("role control v2 test", async () => {
            const reqdStackFeesForSubnet = ethers.utils.parseEther("0.1");
            const adminAddress = (await ethers.getSigners())[0];

            const nftHolder1 = addrList[1];
            const account1 = addrList[2];
            const account2 = addrList[3];
            const account3 = addrList[4];
            const account4 = addrList[5];
            const nftHolder2 = addrList[6];
            let account1Roles = [];
            let account2Roles = [];
            let account3Roles = [];
            let account4Roles = [];
            let emptyAddress = "0x0000000000000000000000000000000000000000";


            const compareUserRole = (actualUserRoles, expectedUserRoles) => {
                expect(actualUserRoles.length).to.equal(expectedUserRoles.length);
                for(var i = 0; i < expectedUserRoles.length; i++)
                {
                    let userRole = {
                        nftID: actualUserRoles[i].nftID,
                        role: actualUserRoles[i].role
                    };

                    expect(userRole.nftID).to.equal(expectedUserRoles[i].nftID);
                    expect(userRole.role).to.equal(expectedUserRoles[i].role);
                }
            }

            const deleteUserRole = (userRoles, i) => {
                userRoles[i].nftID = 0;
                userRoles[i].role = "0x0000000000000000000000000000000000000000000000000000000000000000";
            }

            const deleteAccount = (accounts, i) => {
                accounts[i] = "0x0000000000000000000000000000000000000000";
            }

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


            let tr = await appNFT.mint(nftHolder1.address);
            rec = await tr.wait();

            let nftID1 = await getAppNFTID(rec.transactionHash);

            const READ = await RoleControl.READ();
            const DEPLOYER = await RoleControl.DEPLOYER();
            const ACCESS_MANAGER = await RoleControl.ACCESS_MANAGER();
            const BILLING_MANAGER = await RoleControl.BILLING_MANAGER();
            const CONTRACT_BASED_DEPLOYER = await RoleControl.CONTRACT_BASED_DEPLOYER();

            // console.log("roles: ", READ, CONTRACT_BASED_DEPLOYER );

            let hasRole = await RoleControl.hasRole(nftID1, READ, account1.address);
            expect(hasRole).to.be.false;

            await RoleControl.connect(nftHolder1).grantRole(nftID1, READ, account1.address);
            account1Roles.push({
                nftID: nftID1,
                role: READ
            });


            hasRole = await RoleControl.hasRole(nftID1, READ, account1.address);
            expect(hasRole).to.be.true;

            let allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, READ);
            expect(allAccountsWithRole).to.eql([account1.address]);

            let allRolesFromAccount = await RoleControl.getAllRolesFromAccount(account1.address);
            compareUserRole(allRolesFromAccount, account1Roles);


            await RoleControl.connect(nftHolder1).grantRole(nftID1, READ, account2.address);
            account2Roles.push({
                nftID: nftID1,
                role: READ
            });

            hasRole = await RoleControl.hasRole(nftID1, READ, account2.address);
            expect(hasRole).to.be.true;

            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, READ);
            expect(allAccountsWithRole).to.eql([account1.address, account2.address]);


            allRolesFromAccount = await RoleControl.getAllRolesFromAccount(account2.address);
            compareUserRole(allRolesFromAccount, account2Roles);


            await RoleControl.connect(nftHolder1).revokeRole(nftID1, READ, account1.address);
            deleteUserRole(account1Roles, 0);


            hasRole = await RoleControl.hasRole(nftID1, READ, account1.address);
            expect(hasRole).to.be.false;


            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, READ);
            expect(allAccountsWithRole).to.eql([emptyAddress, account2.address]);


            allRolesFromAccount = await RoleControl.getAllRolesFromAccount(account1.address);
            compareUserRole(allRolesFromAccount, account1Roles);


            await RoleControl.connect(nftHolder1).grantRole(nftID1, READ, account3.address);
            account3Roles.push({
                nftID: nftID1,
                role: READ
            });


            hasRole = await RoleControl.hasRole(nftID1, READ, account3.address);
            expect(hasRole).to.be.true;

            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, READ);
            expect(allAccountsWithRole).to.eql([emptyAddress, account2.address, account3.address]);

            allRolesFromAccount = await RoleControl.getAllRolesFromAccount(account3.address);
            compareUserRole(allRolesFromAccount, account3Roles);


            await RoleControl.connect(nftHolder1).grantRole(nftID1, CONTRACT_BASED_DEPLOYER, account3.address);
            account3Roles.push({
                nftID: nftID1,
                role: CONTRACT_BASED_DEPLOYER
            });

            hasRole = await RoleControl.hasRole(nftID1, CONTRACT_BASED_DEPLOYER, account3.address);
            expect(hasRole).to.be.true;

            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, CONTRACT_BASED_DEPLOYER);
            expect(allAccountsWithRole).to.eql([account3.address]);

            allRolesFromAccount = await RoleControl.getAllRolesFromAccount(account3.address);
            compareUserRole(allRolesFromAccount, account3Roles);


            tr = await appNFT.mint(nftHolder2.address);
            rec = await tr.wait();

            nftID2 = await getAppNFTID(rec.transactionHash);


            await RoleControl.connect(nftHolder2).grantRole(nftID2, CONTRACT_BASED_DEPLOYER, account4.address);
            account4Roles.push({
                nftID: nftID2,
                role: CONTRACT_BASED_DEPLOYER
            });

            
            hasRole = await RoleControl.hasRole(nftID2, CONTRACT_BASED_DEPLOYER, account4.address);
            expect(hasRole).to.be.true;

            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID2, CONTRACT_BASED_DEPLOYER);
            expect(allAccountsWithRole).to.eql([account4.address]);

            allRolesFromAccount = await RoleControl.getAllRolesFromAccount(account4.address);
            compareUserRole(allRolesFromAccount, account4Roles);

            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, READ);
            expect(allAccountsWithRole).to.eql([emptyAddress, account2.address, account3.address]);

            allAccountsWithRole = await RoleControl.getAccountsWithRole(nftID1, CONTRACT_BASED_DEPLOYER);
            expect(allAccountsWithRole).to.eql([account3.address]);

        })
	})
})
