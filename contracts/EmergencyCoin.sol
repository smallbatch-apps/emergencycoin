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

    bytes32 public constant RECOVER_TOKENS_TYPEHASH =
        0x1a3fd7b5e9ef248d60331a53f296e22c583ae60a8541bb07a640fe6de03372fc;

    bytes32 public DOMAIN_SEPARATOR;

    constructor(uint256 intialSupply)
        ERC20("EmergencyCoin", "ECN")
        ReentrancyGuard()
    {
        DOMAIN_SEPARATOR = makeDomainSeparator();
        _mint(msg.sender, intialSupply);
    }

    function setBackupAddress(address backupAddress) external {
        backupAddresses[msg.sender] = backupAddress;
    }

    /**
     * @notice Make EIP712 domain separator
     * @return Domain separator
     */
    function makeDomainSeparator() internal view returns (bytes32) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        return
            keccak256(
                abi.encode(
                    RECOVER_TOKENS_TYPEHASH,
                    keccak256(bytes("EmergencyCoin")),
                    keccak256(bytes("2")),
                    address(this),
                    bytes32(chainId)
                )
            );
    }

    /**
     * @notice Recover signer's address from a EIP712 signature
     * @param domainSeparator   Domain separator
     * @param v                 v of the signature
     * @param r                 r of the signature
     * @param s                 s of the signature
     * @param typeHashAndData   Type hash concatenated with data
     * @return Signer's address
     */
    function recover(
        bytes32 domainSeparator,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes memory typeHashAndData
    ) internal pure returns (address) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(typeHashAndData)
            )
        );
        return getSigner(digest, v, r, s);
    }

    /**
     * @notice Recover signer's address from a signed message
     * @dev Adapted from: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/65e4ffde586ec89af3b7e9140bdc9235d1254853/contracts/cryptography/ECDSA.sol
     * Modifications: Accept v, r, and s as separate arguments
     * @param digest    Keccak-256 hash digest of the signed message
     * @param v         v of the signature
     * @param r         r of the signature
     * @param s         s of the signature
     * @return Signer address
     */
    function getSigner(
        bytes32 digest,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address) {
        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            revert("ECRecover: invalid signature 's' value");
        }

        if (v != 27 && v != 28) {
            revert("ECRecover: invalid signature 'v' value");
        }

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "ECRecover: invalid signature");

        return signer;
    }

    /**
     * @notice Recover tokens by direct transaction
     * @param recoverAddress    The address whose tokens are to be recovered
     */
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

    /**
     * @notice Recover signer's address from a signed message
     * @dev Adapted from: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/65e4ffde586ec89af3b7e9140bdc9235d1254853/contracts/cryptography/ECDSA.sol
     * Modifications: Accept v, r, and s as separate arguments
     * @param typeHash          Keccak-256 hash of the action being taken
     * @param recoverAddress    Address whose tokens need to be transfered
     * @param v                 v of the signature
     * @param r                 r of the signature
     * @param s                 s of the signature
     */
    function signedRecoverTokens712(
        bytes32 typeHash,
        address recoverAddress,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes memory data = abi.encode(typeHash, recoverAddress);

        address backupAddress = backupAddresses[recoverAddress];

        require(recoverAddress != address(0), "Address required");
        require(backupAddress != address(0), "Incorrect signer for tokens");
        require(balanceOf(recoverAddress) > 0, "No tokens available");
        address signer = recover(DOMAIN_SEPARATOR, v, r, s, data);
        require(signer == backupAddress, "Incorrect signer for message");

        blacklist[recoverAddress] = true;
        _transfer(recoverAddress, signer, balanceOf(recoverAddress));
    }

    /**
     * @notice OpenZeppelin beforeTransfer hook
     * @param from      The address tokens are being transferred from
     * @param to        The address tokens are being transferred to
     * @param amount    The amount of tokens to be transferred
     */
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
