# Emergency Coin

ERC-20 token which allows the use of a _backup address_ in the case of a compromised account. Setting a backup address allows that address to seize control of all established assets in the
the event of a compromise.

## Features

- Standard features of ERC-20 tokens
- Extensive usage of OpenZeppelin for well
- Directly recover coins
- Transfers to recovered accounts reverted
- Recover tokens via simple signed

### Incomplete Features

- Transfers to recovered accounts redirect to backup address
-

## Installation

1. Clone this repository
2. Run `npm install` command to set up dependencies

## Testing

To run the suite you must have installed the truffle library globally: `npm install -g truffle`

The test suite can be executed by running `npm run test`, `npm test` or directly running `truffle test`.

## Deployment

### Local

The npm install process will install ganache as a local development environment. It is not necessary to run a global Ganache instance, or the Ganache UI. The truffle default config will connect to this instance.

Run `truffle deploy` to deploy to the default development blockchain.

### Test or Mainnet

Run `truffle deploy -- network rinkeby`
