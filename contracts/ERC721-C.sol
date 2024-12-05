// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";

contract ERC721CUpgradeable is ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721BurnableUpgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address[] private _royaltyReceivers;
    uint256[] private _royaltyShares;
    uint256 private _secondaryRoyaltyPercentage;

    
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => address) private _tokenAuthors;
    mapping(uint256 => uint256) private _tokenPrices;
    mapping(uint256 => address) private _tokenOwners;

    function initialize(string memory name, string memory symbol, address[] memory royaltyReceivers, uint256[] memory royaltyShares, uint256 secondaryRoyaltyPercentage) public initializer {
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
        _secondaryRoyaltyPercentage = secondaryRoyaltyPercentage;

        setupRoles();
    }

    function setSecondaryRoyaltyPercentage(uint256 share) public onlyRole(MINTER_ROLE) {
        require(share < 10000, "Share must be less than 10000");
        _secondaryRoyaltyPercentage = share;
    }

    function getSecondaryRoyaltyPercentage() public view returns (uint256) {
        return _secondaryRoyaltyPercentage;
    }

    function setupRoles() internal {
        AccessControlUpgradeable._grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(MINTER_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(UPGRADER_ROLE, msg.sender);
    }

    function mint(address to, uint256 tokenId, string memory uri, uint256 price) public onlyRole(MINTER_ROLE) {
        _mint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        _tokenAuthors[tokenId] = msg.sender;
        _tokenPrices[tokenId] = price;
        _tokenOwners[tokenId] = msg.sender;
    }

    function setPrice(uint256 tokenId, uint256 price) public onlyRole(MINTER_ROLE) {
        _tokenPrices[tokenId] = price;
    }

    function getPrice(uint256 tokenId) public view returns (uint256) {
        return _tokenPrices[tokenId];
    }

    function buy(uint256 tokenId) public payable {
        require(_tokenPrices[tokenId] > 0, "Token not for sale");
        require(msg.value >= _tokenPrices[tokenId], "Insufficient funds sent");
        uint256 royalties = distributeRoyalties(msg.value, tokenId);
        if(msg.value > royalties) {
            payable(_tokenOwners[tokenId]).transfer(msg.value - royalties);
        }
        _transfer(address(this), msg.sender, tokenId);
        _tokenOwners[tokenId] = msg.sender;
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

    function distributeRoyalties(uint256 totalReceived, uint256 tokenId) public payable returns (uint256) {
        require(totalReceived > 0, "No funds to distribute");
        
        uint sp = 10000;
        if(msg.sender != _tokenAuthors[tokenId] && _secondaryRoyaltyPercentage > 0) {
            sp = _secondaryRoyaltyPercentage;
        }

        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < _royaltyReceivers.length; i++) {
            uint256 share = _royaltyShares[i] * sp / 10000;
            uint256 payment = (totalReceived * share) / 10000;
            payable(_royaltyReceivers[i]).transfer(payment);
            totalDistributed += payment;
        }

        return totalDistributed;
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
