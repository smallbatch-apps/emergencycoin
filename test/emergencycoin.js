const EmergencyCoin = artifacts.require("EmergencyCoin");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

contract("EmergencyCoin", (accounts) => {
  let contractInstance;

  const intialSupply = 1000;

  const ALICE = accounts[1];
  const BOB = accounts[2];

  const USER = accounts[3];
  const BACKUP = accounts[4];

  const USER_SIGNER = web3.eth.accounts.create();
  const BACKUP_SIGNER = web3.eth.accounts.create();
  const RELAY_SIGNER = web3.eth.accounts.create();

  const amount = 123;

  const params = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      RecoverTokens: [{ name: "recoveryAddress", type: "address" }],
    },
    primaryType: "RecoverTokens",
    message: {
      recoveryAddress: USER,
    },
  });

  const buildDomain = (contractInstance) => ({
    name: "CoinRescue",
    version: "2",
    chainId: parseInt(web3.version.network, 10),
    verifyingContract: contractInstance.address,
  });

  beforeEach(
    async () => (contractInstance = await EmergencyCoin.new(intialSupply))
  );

  describe("Basic setup contract features", () => {
    it("can set up a token", async () => {
      const name = await contractInstance.name();
      const symbol = await contractInstance.symbol();
      const address = await contractInstance.address;

      assert.ok(
        web3.utils.isAddress(address),
        "Valid address not created from deployment"
      );
      assert.equal(name, "EmergencyCoin", "Incorrect name for token");
      assert.equal(symbol, "ECN", "Incorrect symbol for token");
    });
  });

  describe("ERC-20 requirement features", () => {
    it("starts with a balance", async () => {
      const supply = await contractInstance.totalSupply();
      assert.equal(supply, intialSupply, "The initial supply should be set");
    });

    it("can transfer tokens", async () => {
      const balanceBefore = await contractInstance.balanceOf(ALICE);
      const tx = await contractInstance.transfer(ALICE, amount);
      const balanceAfter = await contractInstance.balanceOf(ALICE);

      assert.equal(balanceBefore, 0, "The initial balance should be zero");
      assert.equal(
        balanceAfter,
        amount,
        `The final balance should be ${amount}`
      );

      expectEvent(tx, "Transfer");
    });
  });

  describe("ERC-712 requirement features", () => {
    it("signs a message", async () => {
      const backup = web3.eth.accounts.create();
      await contractInstance.transfer(USER, amount);

      await contractInstance.setBackupAddress(backup.address, { from: USER });

      const signedMessage = await backup.sign(
        "RecoverTokens",
        backup.privateKey
      );

      await contractInstance.signedRecoverTokens(
        USER,
        signedMessage.messageHash,
        signedMessage.signature,
        { from: accounts[7] }
      );

      const userBalanceAfter = await contractInstance.balanceOf(USER);
      const backupBalanceAfter = await contractInstance.balanceOf(
        backup.address
      );

      assert.equal(userBalanceAfter, 0, "User should finish with zero balance");
      assert.equal(
        backupBalanceAfter,
        amount,
        "Backup should finish with default amount"
      );
    });
  });

  describe("additional requirements", () => {
    it("allows setting of a backup address", async () => {
      await contractInstance.setBackupAddress(BOB);
      const backup = await contractInstance.getBackupAddress();
      assert.equal(backup, BOB, "Backup Address not set correctly");
    });

    it("allows transfer tokens with correct backup address", async () => {
      await contractInstance.transfer(USER, amount);
      await contractInstance.setBackupAddress(BACKUP, { from: USER });
      const userBalanceBefore = await contractInstance.balanceOf(USER);
      const backupBalanceBefore = await contractInstance.balanceOf(BACKUP);

      await contractInstance.recoverTokens(USER, { from: BACKUP });

      const userBalanceAfter = await contractInstance.balanceOf(USER);
      const backupBalanceAfter = await contractInstance.balanceOf(BACKUP);

      assert.equal(
        userBalanceBefore,
        amount,
        "User should start with default amount"
      );
      assert.equal(userBalanceAfter, 0, "User should finish with zero balance");
      assert.equal(
        backupBalanceBefore,
        0,
        "Backup should start with zero balance"
      );
      assert.equal(
        backupBalanceAfter,
        amount,
        "Backup should finish with default amount"
      );
    });

    it("blacklists users who rescue their balance", async () => {
      await contractInstance.transfer(USER, amount);
      await contractInstance.setBackupAddress(BACKUP, { from: USER });
      await contractInstance.recoverTokens(USER, { from: BACKUP });
      const blacklisted = await contractInstance.isBlacklisted(USER);
      assert.ok(blacklisted, "Address not correctly blacklisted");
    });

    it("blacklists emergency transfers after usage", async () => {
      await contractInstance.transfer(USER, amount);
      await contractInstance.setBackupAddress(BACKUP, { from: USER });
      await contractInstance.recoverTokens(USER, { from: BACKUP });

      expectRevert(
        contractInstance.transfer(USER, amount),
        "Address is blacklisted"
      );
    });

    it("does not attempt to transfer tokens with no backup address", async () => {
      await contractInstance.transfer(ALICE, amount);
      expectRevert(
        contractInstance.recoverTokens(BOB, { from: ALICE }),
        "Backup Address not found"
      );
    });
  });
});
