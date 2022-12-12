const run = require ('../scripts/run.js')

before(async () => {
    await run.deployContracts();
    // run.addresses = {
    //     deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    //     xct: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    //     stack: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    //     nftToken: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    //     Registration: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    //     appNFT: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    //     SubscriptionBalanceCalculator: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    //     SubscriptionBalance: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    //     SubnetDAODistributor: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
    //     Subscription: '0x0B306BF915C4d645ff596e518fAf3F9669b97016'
    //   };
  });


it("should create subnet", async () => {
    const registration = await run.getRegistration();
    const nftToken = await run.getNFTToken();

    console.log("before mint")
    const nftTr = await nftToken.mint(run.addresses.deployer);
    console.log("after mint")
    const nftRec = await nftTr.wait();
    console.log("after wait")
    console.log(nftRec);

    // const tr = await registration.createSubnet(1);


})