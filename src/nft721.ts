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
export let CONTRACT_ADDRESS = '0xYourContractAddress';
const CONTRACT_ABI: any[] = erc721abi;

// Add your implementation contract's bytecode and ABI
const IMPLEMENTATION_ABI: any[] = erc721abi;
const IMPLEMENTATION_BYTECODE = erc721bytecode;

// Add your KamiUSD token contract's ABI and bytecode
const KAMIUSD_ABI: any[] = kamiusdabi;
const KAMIUSD_BYTECODE = kamiusdbytecode;

class NFT721 {
	private provider: Provider;
	private wallet: ethers.Wallet;
	private contract: ethers.Contract;

	// Add a static property for the contract address
	static CONTRACT_ADDRESS: string = '0xYourContractAddress';

	constructor(providerUrl: string, privateKey: string) {
		this.provider = new ethers.JsonRpcProvider(providerUrl);
		// Ensure no ENS operations are being performed here
		this.wallet = new ethers.Wallet(privateKey, this.provider);
		this.contract = new ethers.Contract(NFT721.CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
	}

	async deployProxyContract(): Promise<string> {
		// Deploy the implementation contract
		const ImplementationFactory = new ethers.ContractFactory(IMPLEMENTATION_ABI, IMPLEMENTATION_BYTECODE, this.wallet);
		const implementationContract = await ImplementationFactory.deploy();
		await implementationContract.waitForDeployment();
		console.log('Implementation contract deployed at:', implementationContract.getAddress());

		// Deploy the proxy contract
		const ProxyFactory = new ethers.ContractFactory(CONTRACT_ABI, IMPLEMENTATION_BYTECODE, this.wallet);
		const proxyContract = await ProxyFactory.deploy(implementationContract.getAddress());
		await proxyContract.waitForDeployment();
		console.log('Proxy contract deployed at:', proxyContract.getAddress());

		return proxyContract.getAddress();
	}

	async deployKamiUSDToken(): Promise<string> {
		const TokenFactory = new ethers.ContractFactory(KAMIUSD_ABI, KAMIUSD_BYTECODE, this.wallet);
		const tokenContract = await TokenFactory.deploy();
		await tokenContract.waitForDeployment();
		console.log('KamiUSD token deployed at:', tokenContract.getAddress());

		return tokenContract.getAddress();
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
		const tx = await this.contract.initialize(
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
		const tx = await this.contract.setSecondaryRoyaltyPercentage(share);
		await tx.wait();
		console.log('Secondary royalty percentage set');
	}

	async getSecondaryRoyaltyPercentage(): Promise<number> {
		const percentage = await this.contract.getSecondaryRoyaltyPercentage();
		console.log('Secondary royalty percentage:', percentage.toString());
		return percentage;
	}

	async mint(to: string, uri: string, price: number, collaborators: string[]): Promise<void> {
		const tx = await this.contract.mint(to, uri, price, collaborators);
		await tx.wait();
		console.log('Token minted');
	}

	async setPrice(tokenId: number, price: number): Promise<void> {
		const tx = await this.contract.setPrice(tokenId, price);
		await tx.wait();
		console.log('Price set for token:', tokenId);
	}

	async getPrice(tokenId: number): Promise<number> {
		const price = await this.contract.getPrice(tokenId);
		console.log('Price for token', tokenId, ':', price.toString());
		return price;
	}

	async buy(tokenId: number): Promise<void> {
		const tx = await this.contract.buy(tokenId);
		await tx.wait();
		console.log('Token bought:', tokenId);
	}

	async getCurrentTokenId(): Promise<number> {
		const tokenId = await this.contract.getCurrentTokenId();
		console.log('Current token ID:', tokenId.toString());
		return tokenId;
	}

	async getMaxQuantity(): Promise<number> {
		const maxQty = await this.contract.getMaxQuantity();
		console.log('Max quantity:', maxQty.toString());
		return maxQty;
	}

	async startRental(tokenId: number, renter: string, duration: number): Promise<void> {
		const tx = await this.contract.startRental(tokenId, renter, duration);
		await tx.wait();
		console.log('Rental started for token:', tokenId);
	}

	async endRental(tokenId: number): Promise<void> {
		const tx = await this.contract.endRental(tokenId);
		await tx.wait();
		console.log('Rental ended for token:', tokenId);
	}

	async isRented(tokenId: number): Promise<boolean> {
		const rented = await this.contract.isRented(tokenId);
		console.log('Is token rented:', rented);
		return rented;
	}
}

export default NFT721;
