/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle")
require("dotenv").config()
require("@openzeppelin/hardhat-upgrades")
require("@nomiclabs/hardhat-etherscan")
require("@nomiclabs/hardhat-solhint")
require("@b10k.io/hardhat-uniswap-v2-deploy-plugin")

module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.2",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.7.0",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.6.2",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
        //  gas:7000000,
        gasMultiplier: 2,
        //  gasPrice:7.3,
    },
    defaultNetwork: "hardhat",

    networks: {
        matictest: {
            url: "https://rpc-mumbai.maticvigil.com/v1/b254fedd6b302bc5dffcb58541c433e6df0b734a",
            accounts: [`${process.env.PKEY}`],
        },
        maticmain: {
            url: "https://polygon-rpc.com/",
            accounts: [`${process.env.PKEY}`],
        },
        hardhat: {
            allowUnlimitedContractSize: true,
            forking: {
              url: "https://polygon-mainnet.g.alchemy.com/v2/BRnyQKRn-PuNxoiwE--0P7YEHI9amUbp",
            }
          }
    },
    etherscan: {
        apiKey: "WGAQCNUDQCFRQJH9D72G94BZ83STGRJCX6",
    },
    bscscan: {
        apiKey: "S1PFEYDQ5SXJSKTB2UE6YXAKF2XDV2Y4EV",
    },
}
