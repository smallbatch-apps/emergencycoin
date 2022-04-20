const EmergencyCoin = artifacts.require("EmergencyCoin");

module.exports = function (deployer) {
  deployer.deploy(EmergencyCoin, 1000);
};
