// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract EmergencyCoin is ERC20, ReentrancyGuard {
    using ECDSA for bytes32;

    mapping(address => address) private backupAddresses;
    mapping(address => bool) private blacklist;

    struct RecoverTokens {
        address recoveryAddress;
    }

    string private constant RECOVER_TOKENS_TYPE =
        "RecoverTokens(address recoveryAddress)";

    constructor(uint256 intialSupply)
        ERC20("EmergencyCoin", "ECN")
        ReentrancyGuard()
    {
        _mint(msg.sender, intialSupply);
    }

    function setBackupAddress(address backupAddress) external {
        backupAddresses[msg.sender] = backupAddress;
    }

    function recoverTokens(address recoverAddress) external nonReentrant {
        require(recoverAddress != address(0), "Address required");
        require(balanceOf(recoverAddress) > 0, "No tokens available");
        require(
            backupAddresses[recoverAddress] == msg.sender,
            "Backup Address not found"
        );
        require(
            backupAddresses[recoverAddress] != address(0),
            "Backup Address not valid"
        );

        blacklist[recoverAddress] = true;

        _transfer(recoverAddress, msg.sender, balanceOf(recoverAddress));
    }

    function signedRecoverTokens(
        address recoverAddress,
        bytes32 messageHash,
        bytes calldata signature
    ) public {
        address signer = messageHash.recover(signature);

        address backupAddress = backupAddresses[recoverAddress];

        require(recoverAddress != address(0), "Address required");
        require(signer != address(0), "Signer address not valid");
        require(backupAddress != address(0), "Incorrect signer for tokens");
        require(balanceOf(recoverAddress) > 0, "No tokens available");

        blacklist[recoverAddress] = true;

        _transfer(recoverAddress, signer, balanceOf(recoverAddress));
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        require(!blacklist[to], "Address is blacklisted");
        super._beforeTokenTransfer(from, to, amount);
    }

    function isBlacklisted(address to) public view returns (bool) {
        return blacklist[to];
    }

    function getBackupAddress() public view returns (address) {
        return backupAddresses[msg.sender];
    }
}
