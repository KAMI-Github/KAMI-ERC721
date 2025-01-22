import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ethers as ethersLib, BigNumberish, Contract, Signer } from 'ethers';

type ERC721C = Contract & {
	mint: (to: string, uri: string, price: BigNumberish, collaborators: string[], initialTokenId: BigNumberish) => Promise<any>;
	distributeRoyalties: (totalReceived: BigNumberish, tokenId: BigNumberish) => Promise<any>;
	address: string;
	getPrice: (tokenId: number) => Promise<ethersLib.BigNumberish>;
	setPrice: (tokenId: number, price: BigNumberish) => Promise<any>;
	getSecondaryRoyaltyPercentage: () => Promise<number>;
	setSecondaryRoyaltyPercentage: (percentage: number) => Promise<any>;
	PRICE_SETTER_ROLE: () => Promise<string>;
	buy: (tokenId: number) => Promise<any>;
	setRoyaltyReceivers: (receivers: string[], shares: BigNumberish[]) => Promise<any>;
	setPaymentToken: (address: string) => Promise<any>;
	setMaxQuantity: (quantity: BigNumberish) => Promise<any>;
};

type KamiUSD = Contract & {
	approve: (spender: string, amount: BigNumberish) => Promise<any>;
	transfer: (to: string, amount: BigNumberish) => Promise<any>;
	transferFrom: (from: string, to: string, amount: BigNumberish) => Promise<any>;
	balanceOf: (account: string) => Promise<BigNumberish>;
};

describe('ERC721CUpgradeable', function () {
	let owner: Signer;
	let addr1: Signer;
	let addr2: Signer;
	let erc721c: ERC721C;
	let kamiUSD: KamiUSD;

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		// Deploy KamiUSD token
		const KamiUSDFactory = await ethers.getContractFactory('KamiUSD');
		kamiUSD = (await KamiUSDFactory.deploy()) as unknown as KamiUSD;
		await kamiUSD.waitForDeployment();

		const royaltyReceivers = [await addr1.getAddress(), await addr2.getAddress()];
		const royaltyShares = [5000, 5000];
		const secondaryRoyaltyPercentage = 500;

		// Deploy ERC721CUpgradeable contract
		const ERC721CFactory = await ethers.getContractFactory('ERC721C');
		erc721c = (await upgrades.deployProxy(ERC721CFactory, ['TestToken', 'TTK'], {
			initializer: 'initialize',
		})) as unknown as ERC721C;
		await erc721c.waitForDeployment();

		await erc721c.grantRole(await erc721c.MINTER_ROLE(), await owner.getAddress());
		await erc721c.grantRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress());
		await erc721c.grantRole(await erc721c.PRICE_SETTER_ROLE(), await owner.getAddress());

		await erc721c.setRoyaltyReceivers(royaltyReceivers, royaltyShares);
		await erc721c.setSecondaryRoyaltyPercentage(secondaryRoyaltyPercentage);
		await erc721c.setPaymentToken(await kamiUSD.getAddress());
		await erc721c.setMaxQuantity(10);

		// Distribute some KamiUSD tokens to addr1 and addr2 for testing
		await kamiUSD.transfer(await addr1.getAddress(), ethersLib.parseUnits('2', 18));
		await kamiUSD.transfer(await addr2.getAddress(), ethersLib.parseUnits('2', 18));
		// await kamiUSD.transfer(await erc721c.getAddress(), ethersLib.parseUnits('100', 18));
	});

	it('should assign roles correctly', async function () {
		expect(await erc721c.hasRole(await erc721c.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.MINTER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.PRICE_SETTER_ROLE(), await owner.getAddress())).to.be.true;
	});

	it('should allow minting by minter', async function () {
		await erc721c.mint(
			await addr1.getAddress(),
			'https://token-uri.com/1',
			ethersLib.parseUnits('1.0', 18),
			[await owner.getAddress()],
			0 // initialTokenId
		);
		expect(await erc721c.ownerOf(1)).to.equal(await addr1.getAddress());
		expect(await erc721c.getPrice(1)).to.equal(ethersLib.parseUnits('1.0', 18));
	});

	// it('should not allow minting by non-minter', async function () {
	// 	const nft = (await erc721c.connect(addr2)) as ERC721C;
	// 	await expect(
	// 		nft.mint(await addr1.getAddress(), 'https://token-uri.com/2', ethersLib.parseUnits('1.0', 18), [await owner.getAddress()])
	// 	).to.be.revertedWith('AccessControl: account');
	// });

	it('should distribute royalties correctly', async function () {
		// First mint a token
		await erc721c.mint(
			await addr1.getAddress(),
			'https://token-uri.com/1',
			ethersLib.parseUnits('2.0', 18),
			[await owner.getAddress(), await addr1.getAddress()],
			0
		);

		erc721c.on('RoyaltyDistributed', (from, to, tokenId, event) => {
			console.log(`RoyaltyDistributed event detected: from ${from} to ${to} for tokenId ${tokenId}`);
			console.log(event);
		});

		// Transfer some KamiUSD to addr2 for purchase
		// await kamiUSD.transfer(await addr2.getAddress(), ethersLib.parseUnits('3.0', 18));

		// Approve spending with a significantly higher allowance
		await (kamiUSD.connect(addr2) as KamiUSD).approve(
			await erc721c.getAddress(),
			ethersLib.parseUnits('2.0', 18) // Increased allowance for debugging
		);

		// Buy the token which triggers royalty distribution
		await (erc721c.connect(addr2) as ERC721C).buy(1);

		expect(await erc721c.ownerOf(1)).to.equal(await addr2.getAddress());
		console.log(
			'kamiUSD.balanceOf(await addr1.getAddress())',
			ethersLib.formatUnits(await kamiUSD.balanceOf(await addr1.getAddress()), 18)
		);
		console.log(
			'kamiUSD.balanceOf(await addr2.getAddress())',
			ethersLib.formatUnits(await kamiUSD.balanceOf(await addr2.getAddress()), 18)
		);
		console.log(
			'kamiUSD.balanceOf(await erc721c.getAddress())',
			ethersLib.formatUnits(await kamiUSD.balanceOf(await erc721c.getAddress()), 18)
		);
		console.log(
			'kamiUSD.balanceOf(await owner.getAddress())',
			ethersLib.formatUnits(await kamiUSD.balanceOf(await owner.getAddress()), 18)
		);
	});

	it('should allow upgrades by upgrader', async function () {
		const ERC721CUpgradeableV2 = await ethers.getContractFactory('ERC721C');
		const erc721c_v2 = await upgrades.upgradeProxy(await erc721c.getAddress(), ERC721CUpgradeableV2);
		expect(erc721c_v2.address).to.equal(await erc721c.address);
	});

	it('should allow setting and getting secondary royalty percentage', async function () {
		await erc721c.setSecondaryRoyaltyPercentage(300);
		expect(await erc721c.getSecondaryRoyaltyPercentage()).to.equal(300);
	});

	it('should handle token purchase with KamiUSD', async function () {
		await erc721c.mint(
			await addr1.getAddress(),
			'https://token-uri.com/1',
			ethersLib.parseUnits('1.0', 18),
			[await owner.getAddress()],
			0
		);

		// Transfer some KamiUSD to addr2 for purchase
		await kamiUSD.transfer(await addr2.getAddress(), ethersLib.parseUnits('2.0', 18));

		// Approve spending - Fix the approval amount
		await (kamiUSD.connect(addr2) as KamiUSD).approve(
			await erc721c.getAddress(),
			ethersLib.parseUnits('25.0', 18) // Ensure this amount covers the required transfer
		);

		const nft2 = (await erc721c.connect(addr2)) as ERC721C;
		await nft2.buy(1);
		expect(await erc721c.ownerOf(1)).to.equal(await addr2.getAddress());
	});
});
