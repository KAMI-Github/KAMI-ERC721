# KAMI ERC721-C

A Solidity smart contract which handles setting a selling price, primary and secondary rolalty splits, and tracking token authors.

```shell
npx hardhat compile
npx hardhat test
REPORT_GAS=true npx hardhat test
```

This is a Solidity smart contract code that implements an NFT (Non-Fungible Token) marketplace with various features. Here's a brief explanation of the code:

Importing OpenZeppelin Contracts

The contract imports several OpenZeppelin contracts to inherit their functionality, including ERC721Upgradeable for token management and AccessControlUpgradeable for role-based access control.

Contract Definition

The contract is named ERC721CUpgradeable and inherits from multiple OpenZeppelin contracts. It has two custom roles: MINTER_ROLE and UPGRADER_ROLE.

Variables and Functions

\_royaltyReceivers, \_royaltyShares: arrays to store royalty recipients and their shares.
\_secondaryRoyaltyPercentage: a variable to store the secondary royalty percentage.
tokenURIs, tokenAuthors, tokenPrices, tokenOwners: mappings to store token URIs, authors, prices, and owners.
The contract has several functions:

initialize: initializes the contract with name, symbol, royalty recipients, shares, and secondary royalty percentage.
setSecondaryRoyaltyPercentage: sets the secondary royalty percentage for a specific user role (MINTER_ROLE).
getSecondaryRoyaltyPercentage: returns the current secondary royalty percentage.
setupRoles: grants default admin, minter, and upgrader roles to the contract creator.
mint: creates a new token with specified URI, author, price, and owner.
setPrice: sets the price of an existing token for sale.
getPrice: returns the current price of a specific token.
buy: allows users to buy tokens by paying their prices; royalties are distributed among royalty recipients.
tokenURI: returns the URI associated with a specific token (overridden from ERC721Upgradeable).
setTokenUri: sets the URI for an existing token.
Other Functions

\_authorizeUpgrade: authorizes upgrades to the contract by checking UPGRADER_ROLE access control.
distributeRoyalties: distributes royalties among royalty recipients based on their shares and secondary royalty percentage (if applicable).
Overall, this code implements a basic NFT marketplace with features like minting tokens, setting prices, buying tokens, distributing royalties, and upgrading the contract.
