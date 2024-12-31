import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ethers as ethersLib, BigNumberish, Contract, Signer } from 'ethers';

type ERC721AC = Contract & {
	initialize: (to: string, uri: string, price: BigNumberish, collaborators: string[]) => Promise<any>;
	claim: (to: string) => Promise<any>;
	address: string;
	getPrice: (tokenId: number) => Promise<ethersLib.BigNumberish>;
	setPrice: (tokenId: number, price: BigNumberish) => Promise<any>;
	getSecondaryRoyaltyPercentage: () => Promise<number>;
	setSecondaryRoyaltyPercentage: (percentage: number) => Promise<any>;
	PRICE_SETTER_ROLE: () => Promise<string>;
	buy: (tokenId: number) => Promise<any>;
};

type KamiUSD = Contract & {
	approve: (spender: string, amount: BigNumberish) => Promise<any>;
};

describe('ERC721CUpgradeable', function () {
	let owner: Signer;
	let addr1: Signer;
	let addr2: Signer;
	let erc721ac: ERC721AC;
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
		const ERC721ACFactory = await ethers.getContractFactory('ERC721AC');
		erc721ac = (await upgrades.deployProxy(ERC721ACFactory, ['TestTokenAC', 'TTKAC', 'https://token-uri.com/1', 100, 100000, royaltyReceivers, await kamiUSD.getAddress()], {
			initializer: 'initialize',
		})) as typeof erc721ac;
		await erc721ac.waitForDeployment();

		await erc721ac.gratntRole(await erc721ac.DEFAULT_ADMIN_ROLE(), await owner.getAddress());
		await erc721ac.grantRole(await erc721ac.OWNER_ROLE(), await owner.getAddress());
		await erc721ac.grantRole(await erc721ac.MINTER_ROLE(), await owner.getAddress());
		await erc721ac.grantRole(await erc721ac.UPGRADER_ROLE(), await owner.getAddress());
		await erc721ac.grantRole(await erc721ac.PRICE_SETTER_ROLE(), await owner.getAddress());

		await erc721ac.setRoyaltyReceivers(royaltyReceivers, royaltyShares);
		await erc721ac.setSecondaryRoyaltyPercentage(secondaryRoyaltyPercentage);
		await erc721ac.setPaymentToken(await kamiUSD.getAddress());
		await erc721ac.setMaxQuantity(10);

		// Distribute some KamiUSD tokens to addr1 and addr2 for testing
		await kamiUSD.transfer(await addr1.getAddress(), ethersLib.parseUnits('100000', 18));
		await kamiUSD.transfer(await addr2.getAddress(), ethersLib.parseUnits('100000', 18));
		await kamiUSD.transfer(await erc721ac.getAddress(), ethersLib.parseUnits('100000', 18));
	});

	it('should assign roles correctly', async function () {
		expect(await erc721ac.hasRole(await erc721ac.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721ac.hasRole(await erc721ac.MINTER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721ac.hasRole(await erc721ac.UPGRADER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721ac.hasRole(await erc721ac.PRICE_SETTER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721ac.hasRole(await erc721ac.OWNER_ROLE(), (), await addr1.getAddress())).to.be.true;
	});

	it('should handle claining', async function () {
		await erc721ac.claim(await addr1.getAddress());
		expect(await erc721ac.ownerOf(1)).to.equal(await addr1.getAddress());
		expect(await erc721ac.getPrice(1)).to.equal(ethersLib.parseUnits('1.0', 18));
	});

	// it('should not allow minting by non-minter', async function () {
	// 	const nft = (await erc721c.connect(addr2)) as ERC721C;
	// 	await expect(
	// 		nft.mint(await addr1.getAddress(), 'https://token-uri.com/2', ethersLib.parseUnits('1.0', 18), [await owner.getAddress()])
	// 	).to.be.revertedWith('AccessControl: account');
	// });


	it('should allow upgrades by upgrader', async function () {
		const ERC721ACUpgradeableV2 = await ethers.getContractFactory('ERC721AC');
		const erc721ac_v2 = await upgrades.upgradeProxy(await erc721ac.getAddress(), ERC721ACUpgradeableV2);
		expect(erc721ac_v2.address).to.equal(await erc721ac.address);
	});

	it('should allow setting and getting secondary royalty percentage', async function () {
		await erc721ac.setSecondaryRoyaltyPercentage(300);
		expect(await erc721ac.getSecondaryRoyaltyPercentage()).to.equal(300);
	});



	it('should handle token purchase with KamiUSD', async function () {
		// First mint the token - Note the tokenId will be 1, not 2
		await erc721ac.mint(await addr1.getAddress(), 'https://token-uri.com/1', ethersLib.parseUnits('1.0', 18), [
			await owner.getAddress(),
		]);
		await erc721ac.waitForDeployment();

		// Transfer some KamiUSD to the contract for royalty distribution
		await kamiUSD.transfer(await erc721ac.getAddress(), ethersLib.parseUnits('10', 18));

		await erc721ac.grantRole(await erc721ac.PRICE_SETTER_ROLE(), await addr1.getAddress());

		const nft = (await erc721ac.connect(addr1)) as ERC721AC;
		await nft.setPrice(1, ethersLib.parseUnits('1.0', 18)); // Changed tokenId to 1

		const kusd = (await kamiUSD.connect(addr2)) as KamiUSD;
		await kusd.approve(await erc721ac.getAddress(), ethersLib.parseUnits('1.0', 18));

		const nft2 = (await erc721ac.connect(addr2)) as ERC721AC;
		await nft2.buy(1); // Changed tokenId to 1
		expect(await erc721ac.ownerOf(1)).to.equal(await addr2.getAddress()); // Changed tokenId to 1
	});
});
