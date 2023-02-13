const { deploy } = require("@openzeppelin/hardhat-upgrades/dist/utils")
const { ethers } = require("hardhat")
const helper = require("./helper")


const getAmountIfLess = async (
    erc20,
    account,
    balanceToAdd,
    contractToApprove
) => {
    // add amount to depositor if depositor's balance is less
    let currentBalance = await erc20.balanceOf(account.address)
    if (currentBalance.lt(balanceToAdd)) {
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

const createSubnet = async(darkMatter, stack, Registration, creator, attributeParam) => {

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
        subnetName: 'def-subnet'
    };

    attributes = {...attributes, ...attributeParam};
    
    const nftID = await mintNFT(darkMatter, creator, Registration);
    
    await getAmountIfLess(stack, creator, helper.parameters.registration.reqdStackFeesForSubnet, Registration);

    console.log("subnetName: ", attributes.subnetName);

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

const signupCluster = async (darkMatterNFT, stack, Registration, subnetID, subnetFees, clusterAddress, attributeParam) =>{

    const bobArray = [3,90,20,244,156,57,237,234,225,127,203,179,183,142,240,2,76,127,172,131,75,113,184,97,91,117,208,166,152,28,244,173,73];


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

const setupUrsula = async () => {
    const addrList = await ethers.getSigners();
    const deployer = addrList[0];
    
    const stack = await helper.getStack();
    const darkMatter = await helper.getNFTToken();
    const Registration = await helper.getRegistration();


    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/");
    const cluster1 = new ethers.Wallet(
            "540f8aa51ab241b53bd0bac13bfb9c3816306c49e57e33c0f5a0fadc20634711",
            provider
    );
    
    const subnetList = [addrList[1], addrList[2]];
    const clusterList= [
        [cluster1],
        [cluster1]
    ];

    const platformAddress = addrList[5]
    const referralExpiry = 60 * 60 * 24 * 4

    const platformFee = 10000
    const discountFee = 3000
    const referralFee = 4000


    const subnetParamList = [
        {
            unitPrices: [
                ethers.utils.parseUnits("1", 'wei'), // CPU_Standard
                ethers.utils.parseUnits("2", 'wei'), // CPU_Intensive
                ethers.utils.parseUnits("3", 'wei'), // GPU_Standard
                ethers.utils.parseUnits("3", 'wei'), // Storage
                ethers.utils.parseUnits("2", 'wei'), // Bandwidth
            ],
            maxClusters:10,
            stackFeesReqd: ethers.utils.parseEther("0.01"),
            subnetName: 'marvel'
        },
        {
            unitPrices: [
                ethers.utils.parseUnits("1", 'wei'), // CPU_Standard
                ethers.utils.parseUnits("2", 'wei'), // CPU_Intensive
                ethers.utils.parseUnits("3", 'wei'), // GPU_Standard
                ethers.utils.parseUnits("3", 'wei'), // Storage
                ethers.utils.parseUnits("2", 'wei'), // Bandwidth
            ],
            maxClusters:10,
            stackFeesReqd: ethers.utils.parseEther("0.01"),
            subnetName: 'authority'
        }
    ]
    
    for(var i = 0; i < subnetList.length; i++)
    {
        const subnetAddrObj = subnetList[i];
        const subnetParam = subnetParamList[i];

        await deployer.sendTransaction({
            to: subnetAddrObj.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        });
        
        console.log("before creating subnet");
        const subnetID = await createSubnet(darkMatter, stack, Registration, subnetAddrObj, {
            ...subnetParam
        });
        console.log("subnetID: ", subnetID);

        for(var j = 0; j < clusterList[i].length; j++)
        {
            const clusterObj = clusterList[i][j];

            await deployer.sendTransaction({
                to: clusterObj.address,
                value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
            });

            console.log("before signup cluster");
            const clusterID = await signupCluster(darkMatter, stack, Registration, subnetID, subnetParam.stackFeesReqd, clusterObj, 
                {
                    clusterName: subnetParam.subnetName + '-c' + j
            });

            await Registration.connect(subnetAddrObj).approveListingCluster(subnetID, clusterID, 100);

            console.log("clusterID : ", clusterID);
        }

    }

    await Subscription.addPlatformAddress(
        platformAddress.address,
        platformFee,
        discountFee,
        referralFee,
        referralExpiry
    )

}

async function main() {

    // helper.setAddresses(
    //     {
    //         deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',    
    //         xct: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    //         stack: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',       
    //         nftToken: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',    
    //         Registration: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    //         appNFT: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    //         RoleControl: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    //         SubscriptionBalanceCalculator: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    //         SubscriptionBalance: '0x9A676e781A523b5d0C0e43731313A708CB607508',
    //         SubnetDAODistributor: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
    //         Subscription: '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
    //         ContractBasedDeployment: '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d'
    //       }
    // )

    const now = new Date()
    console.log(now.getTime())
    await helper.deployContracts()
    await helper.callStackApprove()
    await helper.callNftApprove()
    await helper.xctApproveSub()
    await helper.xctApproveSubBal()
    await setupUrsula();

}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

// addresses = {
//     deployer: "0x3C904a5f23f868f309a6DB2a428529F33848f517",
//     xct: "0xca89AD662eA7A2688d29e2Df6291123eBFB807E4",
//     stack: "0xF1E0336C04f03c39904015b581A5db091B6D9960",
//     nftToken: "0x36cb2DE24CC92BCae864759D9aC4ddcc43a112B0",
//     Registration: "0x027d84b57eA012BddfDcc2b297EaeB2967912c5A",
//     appNFT: "0x492F3b79E18658f1a72c75C8a17760a006efCa60",
//     SubscriptionBalanceCalculator: "0x00Df2C3F6A40B4d657ED68b4689a7ddcA9434e59",
//     SubscriptionBalance: "0xA8ef2C4E1d0091bAb84c74cC40b7306955DfD290",
//     SubnetDAODistributor: "0xF0DeD7b2b4Ac842aA245644e89298F43ac3c8b3e",
//     Subscription: "0xfF29cFD3C9954a485d7C6D128a9f87CEB2C2b366",
//     NFT: "0xbC0fe507d07914EF7039d22Ea5FAbe6947B3D711",
//     RoleControl: "0x660c66A35e4B87454a89b307251bA5074b519892",
//     ContractBasedDeployment: "0xFB86Bcaf08f84E5c5F856bF623C04aB233839298"
// }
