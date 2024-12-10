import { ethers, Provider } from 'ethers';

// ERC721C
const erc721json = require('../artifacts/contracts/ERC721-C.sol/ERC721C.json');
const erc721abi = erc721json.abi;
const erc721bytecode = erc721json.bytecode;

// KamiUSD
const kamiusdjson = require('../artifacts/contracts/KamiUSD.sol/KamiUSD.json');
const kamiusdabi = kamiusdjson.abi;
const kamiusdbytecode = kamiusdjson.bytecode;

// Replace with your contract's address and ABI
const CONTRACT_ABI: any[] = erc721abi;

// Add your implementation contract's bytecode and ABI
const IMPLEMENTATION_ABI: any[] = erc721abi;
const IMPLEMENTATION_BYTECODE = erc721bytecode;

// Add your KamiUSD token contract's ABI and bytecode
const KAMIUSD_ABI: any[] = kamiusdabi;
const KAMIUSD_BYTECODE = kamiusdbytecode;

class NFT721 {
	private provider: Provider | null;
	private wallet: ethers.Wallet | null;
	private contract: ethers.Contract | null;

	public walletAddress: string;

	// Add a static property for the contract address
	static CONTRACT_ADDRESS: string = '0xYourContractAddress';

	constructor(providerUrl: string, privateKey: string) {
		this.provider = new ethers.JsonRpcProvider(providerUrl);
		this.wallet = new ethers.Wallet(privateKey, this.provider);
		this.contract = null;
		this.walletAddress = this.wallet.address;
		console.log('Contract setup complete');
	}

	async deployProxyContract(
		name: string,
		symbol: string,
		royaltyReceivers: string[],
		royaltyShares: number[],
		secondaryRoyaltyPercentage: number,
		paymentTokenAddress: string,
		maxQty: number
	): Promise<string> {
		console.log(name, symbol, royaltyReceivers, royaltyShares, secondaryRoyaltyPercentage, paymentTokenAddress, maxQty);

		// Deploy the proxy contract using the UUPS pattern
		const ProxyFactory = new ethers.ContractFactory(IMPLEMENTATION_ABI, IMPLEMENTATION_BYTECODE, this.wallet);
		const proxyContract = await ProxyFactory.deploy(
			[name, symbol, royaltyReceivers, royaltyShares, secondaryRoyaltyPercentage, paymentTokenAddress, maxQty],
			{
				initializer: 'initialize',
			}
		);
		await proxyContract.waitForDeployment();

		// Set the contract address and initialize the contract instance
		NFT721.CONTRACT_ADDRESS = await proxyContract.getAddress();
		this.contract = new ethers.Contract(NFT721.CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);

		return NFT721.CONTRACT_ADDRESS;
	}

	async deployKamiUSDToken(): Promise<string> {
		if (!this.wallet) {
			throw new Error('Wallet is not initialized');
		}

		const TokenFactory = new ethers.ContractFactory(KAMIUSD_ABI, KAMIUSD_BYTECODE, this.wallet);
		const tokenContract = await TokenFactory.deploy();
		await tokenContract.waitForDeployment();

		return await tokenContract.getAddress();
	}

	async initialize(
		name: string,
		symbol: string,
		royaltyReceivers: string[],
		royaltyShares: number[],
		secondaryRoyaltyPercentage: number,
		paymentTokenAddress: string,
		maxQty: number
	): Promise<void> {
		const tx = await this.contract?.initialize(
			name,
			symbol,
			royaltyReceivers,
			royaltyShares,
			secondaryRoyaltyPercentage,
			paymentTokenAddress,
			maxQty
		);
		await tx.wait();
		console.log('Contract initialized');
	}

	async setSecondaryRoyaltyPercentage(share: number): Promise<void> {
		const tx = await this.contract?.setSecondaryRoyaltyPercentage(share);
		await tx.wait();
		console.log('Secondary royalty percentage set');
	}

	async getSecondaryRoyaltyPercentage(): Promise<number> {
		const percentage = await this.contract?.getSecondaryRoyaltyPercentage();
		console.log('Secondary royalty percentage:', percentage.toString());
		return percentage;
	}

	async mint(to: string, uri: string, price: number, collaborators: string[]): Promise<void> {
		const tx = await this.contract?.mint(to, uri, price, collaborators);
		await tx.wait();
		console.log('Token minted');
	}

	async setPrice(tokenId: number, price: number): Promise<void> {
		const tx = await this.contract?.setPrice(tokenId, price);
		await tx.wait();
		console.log('Price set for token:', tokenId);
	}

	async getPrice(tokenId: number): Promise<number> {
		const price = await this.contract?.getPrice(tokenId);
		console.log('Price for token', tokenId, ':', price.toString());
		return price;
	}

	async buy(tokenId: number): Promise<void> {
		const tx = await this.contract?.buy(tokenId);
		await tx.wait();
		console.log('Token bought:', tokenId);
	}

	async getCurrentTokenId(): Promise<number> {
		const tokenId = await this.contract?.getCurrentTokenId();
		console.log('Current token ID:', tokenId.toString());
		return tokenId;
	}

	async getMaxQuantity(): Promise<number> {
		const maxQty = await this.contract?.getMaxQuantity();
		console.log('Max quantity:', maxQty.toString());
		return maxQty;
	}

	async startRental(tokenId: number, renter: string, duration: number): Promise<void> {
		const tx = await this.contract?.startRental(tokenId, renter, duration);
		await tx.wait();
		console.log('Rental started for token:', tokenId);
	}

	async endRental(tokenId: number): Promise<void> {
		const tx = await this.contract?.endRental(tokenId);
		await tx.wait();
		console.log('Rental ended for token:', tokenId);
	}

	async isRented(tokenId: number): Promise<boolean> {
		const rented = await this.contract?.isRented(tokenId);
		console.log('Is token rented:', rented);
		return rented;
	}
}

export default NFT721;
