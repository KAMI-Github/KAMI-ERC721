// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";

contract OldERC721CUpgradeable is ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721BurnableUpgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address[] private _royaltyReceivers;
    uint256[] private _royaltyShares;

    function initialize(string memory name, string memory symbol, address[] memory royaltyReceivers, uint256[] memory royaltyShares) public initializer {
        __ERC721_init(name, symbol);
        __ERC721URIStorage_init();
        __ERC721Burnable_init();
        __ERC721Enumerable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        require(royaltyReceivers.length == royaltyShares.length, "Receivers and shares length mismatch");
        uint256 totalShares = 0;
        for (uint256 i = 0; i < royaltyShares.length; i++) {
            totalShares += royaltyShares[i];
        }
        require(totalShares == 10000, "Total shares must be 10000");

        _royaltyReceivers = royaltyReceivers;
        _royaltyShares = royaltyShares;

        setupRoles();
    }

    function setupRoles() internal {
        AccessControlUpgradeable._grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(MINTER_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(UPGRADER_ROLE, msg.sender);
    }

    function mint(address to, uint256 tokenId, string memory uri) public onlyRole(MINTER_ROLE) {
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}


    function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function setTokenUri(uint256 tokenId, string memory uri) public onlyRole(MINTER_ROLE) {
        _setTokenURI(tokenId, uri);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function distributeRoyalties() public payable {
        uint256 totalReceived = msg.value;
        for (uint256 i = 0; i < _royaltyReceivers.length; i++) {
            uint256 payment = (totalReceived * _royaltyShares[i]) / 10000;
            payable(_royaltyReceivers[i]).transfer(payment);
        }
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }
}
