/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 require('@nomiclabs/hardhat-waffle');
 require('dotenv').config();
 require('@openzeppelin/hardhat-upgrades');
 require("@nomiclabs/hardhat-etherscan");
 require("@nomiclabs/hardhat-solhint");

 module.exports = {
   solidity: {
    compilers: [
     {
      version:"0.8.2",
      settings:{
      optimizer: {
        enabled: true,
        runs: 200
      }
    }},
    {
      version:"0.7.0",
      settings:{
      optimizer: {
        enabled: true,
        runs: 200
      }
    }},
    {
      version:"0.6.2",
      settings:{
      optimizer: {
        enabled: true,
        runs: 200
      }
    }}
    ],
    //  gas:7000000,
    //  gasMultiplier:1,
    //  gasPrice:7.3,
    

   },
   defaultNetwork: "hardhat",
 
   networks:{
    matictest: {
      url: "https://rpc-mumbai.matic.today",
      accounts: [`${process.env.PKEY}`]
    },
    maticmain: {
      url: "https://polygon-rpc.com/",
      accounts: [`${process.env.PKEY}`]
    },
   },
   etherscan: {
    apiKey: 'WGAQCNUDQCFRQJH9D72G94BZ83STGRJCX6'
  },
  bscscan: {
    apiKey: 'S1PFEYDQ5SXJSKTB2UE6YXAKF2XDV2Y4EV'
  }
 };
  