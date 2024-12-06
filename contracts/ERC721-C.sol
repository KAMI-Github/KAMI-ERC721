// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Importing necessary OpenZeppelin contracts for upgradeable ERC721 token
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ERC721CUpgradeable contract definition
contract ERC721CUpgradeable is ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721BurnableUpgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    // Define roles for access control
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // State variables for royalty management
    address[] private _royaltyReceivers;
    uint256[] private _royaltyShares;
    uint256 private _secondaryRoyaltyPercentage;

    // Mappings for token data
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => address) private _tokenAuthors;
    mapping(uint256 => uint256) private _tokenPrices;
    mapping(uint256 => address) private _tokenOwners;

    // ERC20 token used for payments
    IERC20 private _paymentToken;

    // Initialize the contract with necessary parameters
    /**
     * @dev Initializes the contract with the given parameters.
     * @param name The name of the token.
     * @param symbol The symbol of the token.
     * @param royaltyReceivers The addresses that will receive royalties.
     * @param royaltyShares The shares of royalties for each receiver.
     * @param secondaryRoyaltyPercentage The percentage of royalties for secondary sales.
     * @param paymentTokenAddress The address of the ERC20 token used for payments.
     */
    function initialize(
        string memory name,
        string memory symbol,
        address[] memory royaltyReceivers,
        uint256[] memory royaltyShares,
        uint256 secondaryRoyaltyPercentage,
        address paymentTokenAddress
    ) public initializer {
        // Initialize inherited contracts
        __ERC721_init(name, symbol);
        __ERC721URIStorage_init();
        __ERC721Burnable_init();
        __ERC721Enumerable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        // Validate royalty shares
        require(royaltyReceivers.length == royaltyShares.length, "Receivers and shares length mismatch");
        uint256 totalShares = 0;
        for (uint256 i = 0; i < royaltyShares.length; i++) {
            totalShares += royaltyShares[i];
        }
        require(totalShares == 10000, "Total shares must be 10000");

        // Set royalty data
        _royaltyReceivers = royaltyReceivers;
        _royaltyShares = royaltyShares;
        _secondaryRoyaltyPercentage = secondaryRoyaltyPercentage;

        // Set payment token
        _paymentToken = IERC20(paymentTokenAddress);

        // Setup roles for access control
        setupRoles();
    }

    // Set the secondary royalty percentage
    /**
     * @dev Sets the secondary royalty percentage.
     * @param share The new secondary royalty percentage (max 1000).
     */
    function setSecondaryRoyaltyPercentage(uint256 share) public onlyRole(MINTER_ROLE) {
        require(share <= 1000, "Percentage must be less than 1000");
        _secondaryRoyaltyPercentage = share;
    }

    // Get the secondary royalty percentage
    /**
     * @dev Returns the secondary royalty percentage.
     * @return The current secondary royalty percentage.
     */
    function getSecondaryRoyaltyPercentage() public view returns (uint256) {
        return _secondaryRoyaltyPercentage;
    }

    // Setup roles for access control
    /**
     * @dev Internal function to setup roles for access control.
     */
    function setupRoles() internal {
        AccessControlUpgradeable._grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(MINTER_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(UPGRADER_ROLE, msg.sender);
    }

    // Mint a new token
    /**
     * @dev Mints a new token with the given parameters.
     * @param to The address to mint the token to.
     * @param tokenId The ID of the token to mint.
     * @param uri The URI of the token.
     * @param price The price of the token.
     */
    function mint(address to, uint256 tokenId, string memory uri, uint256 price) public onlyRole(MINTER_ROLE) {
        _mint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        _tokenAuthors[tokenId] = msg.sender;
        _tokenPrices[tokenId] = price;
        _tokenOwners[tokenId] = msg.sender;
    }

    // Set the price of a token
    /**
     * @dev Sets the price of a token.
     * @param tokenId The ID of the token.
     * @param price The new price of the token.
     */
    function setPrice(uint256 tokenId, uint256 price) public onlyRole(MINTER_ROLE) {
        _tokenPrices[tokenId] = price;
    }

    // Get the price of a token
    /**
     * @dev Returns the price of a token.
     * @param tokenId The ID of the token.
     * @return The current price of the token.
     */
    function getPrice(uint256 tokenId) public view returns (uint256) {
        return _tokenPrices[tokenId];
    }

    // Buy a token
    /**
     * @dev Allows a user to buy a token.
     * @param tokenId The ID of the token to buy.
     */
    function buy(uint256 tokenId) public {
        require(_tokenPrices[tokenId] > 0, "Token not for sale");
        uint256 price = _tokenPrices[tokenId];
        require(_paymentToken.transferFrom(msg.sender, address(this), price), "Token transfer failed");

        uint256 royalties = distributeRoyalties(price, tokenId);
        if(price > royalties) {
            require(_paymentToken.transfer(_tokenOwners[tokenId], price - royalties), "Token transfer to owner failed");
        }
        _transfer(_tokenOwners[tokenId], msg.sender, tokenId);
        _tokenOwners[tokenId] = msg.sender;
    }

    // Authorize contract upgrade
    /**
     * @dev Authorizes an upgrade to a new implementation.
     * @param newImplementation The address of the new implementation.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // Override tokenURI function to use ERC721URIStorage
    /**
     * @dev Returns the URI of a token.
     * @param tokenId The ID of the token.
     * @return The URI of the token.
     */
    function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    // Set the URI of a token
    /**
     * @dev Sets the URI of a token.
     * @param tokenId The ID of the token.
     * @param uri The new URI of the token.
     */
    function setTokenUri(uint256 tokenId, string memory uri) public onlyRole(MINTER_ROLE) {
        _setTokenURI(tokenId, uri);
    }

    // Override supportsInterface to include all inherited interfaces
    /**
     * @dev Checks if the contract supports a given interface.
     * @param interfaceId The ID of the interface.
     * @return True if the interface is supported, false otherwise.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Distribute royalties to receivers
    /**
     * @dev Distributes royalties to the royalty receivers.
     * @param totalReceived The total amount received from the sale.
     * @param tokenId The ID of the token sold.
     * @return The total amount distributed as royalties.
     */
    function distributeRoyalties(uint256 totalReceived, uint256 tokenId) public returns (uint256) {
        require(totalReceived > 0, "No funds to distribute");
        
        uint256 sp = 10000;
        if(msg.sender != _tokenAuthors[tokenId] && _secondaryRoyaltyPercentage > 0) {
            sp = _secondaryRoyaltyPercentage;
        }

        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < _royaltyReceivers.length; i++) {
            uint256 share = (_royaltyShares[i] * sp) / 10000;
            uint256 payment = (totalReceived * share) / 10000;
            require(_paymentToken.transfer(_royaltyReceivers[i], payment), "Token transfer to royalty receiver failed");
            totalDistributed += payment;
        }

        return totalDistributed;
    }

    // Override _update function for ERC721Enumerable
    /**
     * @dev Updates the token ownership and balance.
     * @param to The address to transfer the token to.
     * @param tokenId The ID of the token.
     * @param auth The address of the author.
     * @return The address of the previous owner.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    // Override _increaseBalance function for ERC721Enumerable
    /**
     * @dev Increases the balance of an account.
     * @param account The address of the account.
     * @param value The amount to increase the balance by.
     */
    function _increaseBalance(
        address account,
        uint128 value
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }
}
