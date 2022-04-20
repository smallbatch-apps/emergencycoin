const HDWalletProvider = require("@truffle/hdwallet-provider");

require("dotenv").config();

module.exports = {
  networks: {
    rinkeby: {
      host: "127.0.0.1",
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`
        ),
      network_id: 4,
    },
    goerli: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`
        ),
      network_id: 5,
    },
  },
  compilers: {
    solc: {
      version: "0.8.8",
    },
  },
};
