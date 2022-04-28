const EmergencyCoin = artifacts.require("EmergencyCoin");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { ACCOUNTS_AND_KEYS } = require("./helpers/accounts");
const { ecSign, strip0x } = require("./helpers");

const RECOVER_TOKENS_TYPEHASH = web3.utils.keccak256("RecoverTokens(address recoveryAddress)");

contract("EmergencyCoin", accounts => {
  let contractInstance;
  let domainSeparator;

  const intialSupply = 1000;

  const [alice, bob, user, backup, signer] = ACCOUNTS_AND_KEYS;
  const amount = 123;

  beforeEach(async () => (contractInstance = await EmergencyCoin.new(intialSupply)));

  describe("Basic setup contract features", () => {
    it("can set up a token", async () => {
      const name = await contractInstance.name();
      const symbol = await contractInstance.symbol();
      const address = await contractInstance.address;

      assert.ok(web3.utils.isAddress(address), "Valid address not created from deployment");
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
      const balanceBefore = await contractInstance.balanceOf(alice.address);
      const tx = await contractInstance.transfer(alice.address, amount);
      const balanceAfter = await contractInstance.balanceOf(alice.address);

      assert.equal(balanceBefore, 0, "The initial balance should be zero");
      assert.equal(balanceAfter, amount, `The final balance should be ${amount}`);

      expectEvent(tx, "Transfer");
    });
  });

  describe("ERC-712 requirement features", () => {
    beforeEach(async () => (domainSeparator = await contractInstance.DOMAIN_SEPARATOR()));

    it("has the required typehash", async () => {
      const contractTypehash = await contractInstance.RECOVER_TOKENS_TYPEHASH();
      assert.equal(RECOVER_TOKENS_TYPEHASH, contractTypehash, "Typehash not found or not correct");
    });

    it("signs a typed message", async () => {
      domainSeparator = await contractInstance.DOMAIN_SEPARATOR();
      const signed = signRecovery(user.address, domainSeparator, signer.key);

      assert.ok(signed.r, "R value for signed message not valid");
      assert.ok(signed.s, "S value for signed message not valid");
      assert.equal(signed.v, 27, "V value for signed message not valid");
    });

    describe("signed transfers", () => {
      beforeEach(async () => {
        await contractInstance.transfer(accounts[3], amount);
        await contractInstance.setBackupAddress(backup.address, { from: accounts[3] });
      });

      it("can use a properly typed message", async () => {
        domainSeparator = await contractInstance.DOMAIN_SEPARATOR();
        const { v, r, s } = signRecovery(accounts[3], domainSeparator, backup.key);

        const tx = await contractInstance.signedRecoverTokens712(RECOVER_TOKENS_TYPEHASH, accounts[3], v, r, s, {
          from: accounts[5],
        });

        const userBalanceAfter = await contractInstance.balanceOf(accounts[3]);
        const backupBalanceAfter = await contractInstance.balanceOf(backup.address);

        assert.equal(userBalanceAfter, 0, "User should finish with zero balance");
        assert.equal(backupBalanceAfter, amount, "Backup should finish with default amount");

        expectEvent(tx, "Transfer");
      });

      it("rejects an incorrectly signed request", async () => {
        domainSeparator = await contractInstance.DOMAIN_SEPARATOR();
        const { v, r, s } = signRecovery(accounts[3], domainSeparator, ACCOUNTS_AND_KEYS[6].key);

        expectRevert(
          contractInstance.signedRecoverTokens712(RECOVER_TOKENS_TYPEHASH, accounts[3], v, r, s, {
            from: accounts[5],
          }),
          "Incorrect signer for message."
        );
      });
    });

    it("can confirm the message signer", async () => {
      const domainSeparator = await contractInstance.DOMAIN_SEPARATOR();
      const { v, r, s } = signRecovery(user.address, domainSeparator, signer.key);

      const digest = createDigest(domainSeparator, RECOVER_TOKENS_TYPEHASH, ["address"], [user.address]);

      const signedBy = await contractInstance.getSigner(digest, v, r, s);
      assert.equal(signedBy, signer.address, "Incorrect signer returned");
    });
  });

  describe("additional requirements", () => {
    it("allows setting of a backup address", async () => {
      await contractInstance.setBackupAddress(bob.address);
      const getBackup = await contractInstance.getBackupAddress();
      assert.equal(getBackup, bob.address, "Backup Address not set correctly");
    });

    it("allows transfer tokens with correct backup address", async () => {
      await contractInstance.transfer(accounts[3], amount);
      await contractInstance.setBackupAddress(accounts[4], {
        from: accounts[3],
      });
      const userBalanceBefore = await contractInstance.balanceOf(accounts[3]);
      const backupBalanceBefore = await contractInstance.balanceOf(accounts[4]);

      await contractInstance.recoverTokens(accounts[3], {
        from: accounts[4],
      });

      const userBalanceAfter = await contractInstance.balanceOf(accounts[3]);
      const backupBalanceAfter = await contractInstance.balanceOf(accounts[4]);

      assert.equal(userBalanceBefore, amount, "User should start with default amount");
      assert.equal(userBalanceAfter, 0, "User should finish with zero balance");
      assert.equal(backupBalanceBefore, 0, "Backup should start with zero balance");
      assert.equal(backupBalanceAfter, amount, "Backup should finish with default amount");
    });

    it("blacklists users who rescue their balance", async () => {
      await contractInstance.transfer(accounts[3], amount);
      await contractInstance.setBackupAddress(accounts[4], {
        from: accounts[3],
      });
      await contractInstance.recoverTokens(accounts[3], {
        from: accounts[4],
      });
      const blacklisted = await contractInstance.isBlacklisted(accounts[3]);
      assert.ok(blacklisted, "Address not correctly blacklisted");
    });

    it("blacklists emergency transfers after usage", async () => {
      await contractInstance.transfer(accounts[3], amount);
      await contractInstance.setBackupAddress(accounts[4], {
        from: accounts[3],
      });
      await contractInstance.recoverTokens(accounts[3], {
        from: accounts[4],
      });
      expectRevert(contractInstance.transfer(accounts[3], amount), "Address is blacklisted");
    });

    it("does not attempt to transfer tokens with no backup address", async () => {
      await contractInstance.transfer(accounts[3], amount);
      expectRevert(contractInstance.recoverTokens(accounts[3], { from: accounts[3] }), "Backup Address not found");
    });
  });
});

const signRecovery = (recoveryAddress, domainSeparator, privateKey) =>
  signEIP712(domainSeparator, RECOVER_TOKENS_TYPEHASH, ["address"], [recoveryAddress], privateKey);

const signEIP712 = (domainSeparator, typeHash, types, parameters, privateKey) => {
  const digest = createDigest(domainSeparator, typeHash, types, parameters);

  return ecSign(digest, privateKey);
};

const createDigest = (domainSeparator, typeHash, types, parameters) => {
  return web3.utils.keccak256(
    "0x1901" +
      strip0x(domainSeparator) +
      strip0x(web3.utils.keccak256(web3.eth.abi.encodeParameters(["bytes32", ...types], [typeHash, ...parameters])))
  );
};
