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

import "./lib/KamiUtilities.sol";


// ERC721CUpgradeable contract definition
contract ERC721C is ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721BurnableUpgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {

    // Define roles for access control
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PRICE_SETTER_ROLE = keccak256("PRICE_SETTER_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    // State variables for royalty management
    address[] private _royaltyReceivers;
    uint256[] private _royaltyShares;
    uint256 private _secondaryRoyaltyPercentage;
    
    // Mapping to track if a token has been purchased by a secondary buyer
    mapping(uint256 => bool) private _isSecondaryPurchase;

    // Mappings for token data
    struct TokenData {
        string uri;
        address[] authors;
        uint256 price;
        address owner;
    }
    mapping(uint256 => TokenData) private _tokenData;

    // Maximum quantity of tokens that can be minted
    uint256 maxQuantity;

    // ERC20 token used for payments
    IERC20 private _paymentToken;

    // Define a structure to hold rental information
    struct Rental {
        address renter;
        uint128 rentalEndTime;
    }

    // Mapping to store rental agreements
    mapping(uint256 => Rental) private _rentals;

    // Event to emit when a rental starts
    event RentalUpdate(uint256 indexed tokenId, address indexed renter, uint128 rentalEndTime, bool isStart);

    // Event to emit when a rental ends
    event RentalEnded(uint256 indexed tokenId, address indexed renter);

    // Event to emit when a token is minted
    event Minted(uint256 indexed tokenId);

    // Event to emit when a token is bought
    event Bought(uint256 indexed tokenId, address indexed buyer);   

    // Add a state variable to keep track of the current token ID
    uint256 private _currentTokenId;

    // Event for royalty distribution
    event RoyaltyDistributed(uint256 indexed tokenId, address receiver, uint256 amount);

    // Add debugging events
    event DebugTotalReceived(uint256 totalReceived);
    event DebugRoyaltyShare(uint256 index, uint256 share, uint256 payment);
    event DebugSecondaryPurchase(bool isSecondary, uint256 sp);

    // Custom errors
    error TokenRented();
    error NotAuthorized();
    error InvalidRoyalties();
    error SharesLengthMismatch();
    error InvalidTotalShares();
    error NoFundsToDistribute();
    error TransferFailed();
    error TokenNotForSale();
    error InvalidPrice();
    error MaxQuantityReached();
    error TokenAlreadyOwned();
    error InsufficientFunds();

    // Initialize the contract with necessary parameters
    /**
     * @dev Initializes the contract with the given parameters.
     * @param name The name of the token.
     * @param symbol The symbol of the token.   
     */
    function initialize(
        string memory name,
        string memory symbol
    ) public initializer {
        // Initialize inherited contracts
        __ERC721_init(name, symbol);
        __ERC721URIStorage_init();
        __ERC721Burnable_init();
        __ERC721Enumerable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        // Setup roles for access control
        AccessControlUpgradeable._grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(MINTER_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(UPGRADER_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(PRICE_SETTER_ROLE, msg.sender);
        AccessControlUpgradeable._grantRole(OWNER_ROLE, msg.sender);

        _currentTokenId = 0;
        maxQuantity = 1;        
    }

    function setPaymentToken(address paymentTokenAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _paymentToken = IERC20(paymentTokenAddress);
    }

    function getPaymentToken() public view returns (address) {
        return address(_paymentToken);
    }

    function setMaxQuantity(uint256 maxQty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        maxQuantity = maxQty;
    }

    // Get the maximum quantity of tokens that can be minted
    /**
     * @dev Returns the maximum quantity of tokens that can be minted.
     * @return The maximum quantity of tokens that can be minted.
     */
    function getMaxQuantity() public view returns (uint256) {
        return maxQuantity;
    }   

    // Set the royalty receivers and shares
    /**
     * @dev Sets the royalty receivers and shares.
     * @param royaltyReceivers The addresses that will receive royalties.
     * @param royaltyShares The shares of royalties for each receiver.
     */ 
    function setRoyaltyReceivers(address[] memory royaltyReceivers, uint256[] memory royaltyShares) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _royaltyReceivers = royaltyReceivers;
        _royaltyShares = royaltyShares;
    }

    // Get the royalty receivers
    /**
     * @dev Returns the royalty receivers.
     * @return The addresses that will receive royalties.
     */
    function getRoyaltyReceivers() public view returns (address[] memory) {
        return _royaltyReceivers;
    }   

    // Get the royalty shares
    /**
     * @dev Returns the royalty shares.
     * @return The shares of royalties for each receiver.
     */
    function getRoyaltyShares() public view returns (uint256[] memory) {
        return _royaltyShares;
    }

    function getRoyaltyShareForReceiver(uint256 index) public view returns (uint256) {
        return _royaltyShares[index];
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


    // Get the current token ID
    /**
     * @dev Returns the current token ID.
     * @return The current token ID.
     */
    function getCurrentTokenId() public view returns (uint256) {
        return _currentTokenId;
    }

    // Mint a new token
    /**
     * @dev Mints a new token with the given parameters.
     * @param to The address to mint the token to.
     * @param uri The URI of the token.
     * @param price The price of the token. 
     * @param collaborators The addresses of the collaborators.
     * @param initialTokenId The initial token ID to use.
     */
    function mint(address to, string memory uri, uint256 price, address[] memory collaborators, uint256 initialTokenId) public  onlyRole(MINTER_ROLE) { 
        // Check if the maximum quantity has been reached   
        if(initialTokenId == 0) {
            if (maxQuantity > 0 && _currentTokenId >= maxQuantity) revert MaxQuantityReached();
            _currentTokenId++; // Use the current token ID
        } 
       
        uint256 tokenId = _currentTokenId;
        if(initialTokenId > 0) {
            tokenId = initialTokenId;
            _currentTokenId = initialTokenId;
        }

        _mint(to, tokenId);
        _tokenData[tokenId].uri = uri;
        _tokenData[tokenId].price = price;
        _tokenData[tokenId].owner = msg.sender;
        _tokenData[tokenId].authors = collaborators;
        if (!KamiUtilities._isAddressInArray(collaborators, msg.sender)) {
            _tokenData[tokenId].authors.push(msg.sender);
        }
        _isSecondaryPurchase[tokenId] = false;
        emit Minted(tokenId);
    }

    // Set the price of a token
    /**
     * @dev Sets the price of a token.
     * @param tokenId The ID of the token.
     * @param price The new price of the token.
     */
    function setPrice(uint256 tokenId, uint256 price) public onlyRole(PRICE_SETTER_ROLE) {
        _tokenData[tokenId].price = price;
    }

    // Get the price of a token
    /**
     * @dev Returns the price of a token.
     * @param tokenId The ID of the token.
     * @return The current price of the token.
     */
    function getPrice(uint256 tokenId) public view returns (uint256) {
        return _tokenData[tokenId].price;
    }

    // Buy a token
    /**
     * @dev Allows a user to buy a token.
     * @param tokenId The ID of the token to buy.
     */
    function buy(uint256 tokenId) public {
        // Check if the token is rented
        if(isRented(tokenId)) revert TokenRented();

        // Check if the token is already owned by the sender    
        if(_tokenData[tokenId].owner == msg.sender) revert TokenAlreadyOwned();

        // Check if the token exists
        if(bytes(_tokenData[tokenId].uri).length == 0) revert TokenNotForSale();

        // Get the token data   
        TokenData storage token = _tokenData[tokenId];

        // Check if the token is for sale
        if (token.price == 0) revert TokenNotForSale();

        address currentOwner = ownerOf(tokenId); // Get the current owner from ERC721

        // Check if the current owner is the contract itself
        if (currentOwner == address(0)) revert TokenNotForSale();
        
        // Check if the sender has enough funds
        if(_paymentToken.balanceOf(msg.sender) < token.price) revert InsufficientFunds();
        
        // Transfer the funds to the contract
        if (!_paymentToken.transferFrom(msg.sender, address(this), token.price)) revert TransferFailed();
        
        // Distribute the royalty
        (, uint256 totalDistributed) = KamiUtilities.distributeRoyalty(address(this), token.price, _royaltyShares, _royaltyReceivers, _secondaryRoyaltyPercentage, _paymentToken);

        // Transfer the remaining funds to the current owner
        if(token.price > totalDistributed) {
            if (!_paymentToken.transfer(currentOwner, token.price - totalDistributed)) revert TransferFailed();
        }
        
        _transfer(currentOwner, msg.sender, tokenId);
        token.owner = msg.sender;
        AccessControlUpgradeable.grantRole(OWNER_ROLE, msg.sender);
        _isSecondaryPurchase[tokenId] = true;
        emit Bought(tokenId, msg.sender);
    }

    // Authorize contract upgrade
    /**
     * @dev Authorizes an upgrade to a new implementation.
     * @param newImplementation The address of the new implementation.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {                
    }

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



    // Override _update function for ERC721Enumerable
    /**
     * @dev Updates the token ownership and balance.
     * @param to The address to transfer the token to.
     * @param tokenId The ID of the token.
     * @param author The address of the author.
     */
    function _update(
        address to,
        uint256 tokenId,
        address author
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
        if (isRented(tokenId)) revert TokenRented();
        return super._update(to, tokenId, author);
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

    // Function to start a rental
    /**
     * @dev Starts a rental for a given token.
     * @param tokenId The ID of the token to rent.
     * @param renter The address of the renter.
     * @param duration The duration of the rental in seconds.
     */
    function startRental(uint256 tokenId, address renter, uint256 duration) public onlyRole(MINTER_ROLE) {
        require(ownerOf(tokenId) == msg.sender, "Only the owner can rent out the token");
        require(_rentals[tokenId].renter == address(0), "Token is already rented");

        uint128 rentalEndTime = uint128(block.timestamp) + uint128(duration);
        _rentals[tokenId] = Rental(renter, rentalEndTime);

        emit RentalUpdate(tokenId, renter, rentalEndTime, true);
    }

    // Function to end a rental
    /**
     * @dev Ends a rental for a given token.
     * @param tokenId The ID of the token to end the rental for.
     */
    function endRental(uint256 tokenId) public {
        require(_rentals[tokenId].renter == msg.sender || ownerOf(tokenId) == msg.sender, "Only the renter or owner can end the rental");
        require(_rentals[tokenId].renter != address(0), "Token is not rented");

        address renter = _rentals[tokenId].renter;
        delete _rentals[tokenId];

        emit RentalEnded(tokenId, renter);
    }

    // Function to check if a token is rented
    /**
     * @dev Checks if a token is currently rented.
     * @param tokenId The ID of the token.
     * @return True if the token is rented, false otherwise.
     */
    function isRented(uint256 tokenId) public view returns (bool) {
        Rental storage rental = _rentals[tokenId];
        return rental.renter != address(0) && rental.rentalEndTime > uint128(block.timestamp);
    }
}
