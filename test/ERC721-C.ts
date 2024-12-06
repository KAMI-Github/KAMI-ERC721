import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ethers as ethersLib, BigNumberish, Contract } from 'ethers';
import { Signer } from 'ethers';

type ERC721C = Contract & {
	mint: (to: string, uri: string, price: BigNumberish, collaborators: string[]) => Promise<any>;
	distributeRoyalties: (totalReceived: BigNumberish, tokenId: number) => Promise<any>;
	address: string;
	getPrice: (tokenId: number) => Promise<ethersLib.BigNumberish>;
	setPrice: (tokenId: number, price: BigNumberish) => Promise<any>;
	getSecondaryRoyaltyPercentage: () => Promise<number>;
	setSecondaryRoyaltyPercentage: (percentage: number) => Promise<any>;
};

type KamiUSD = Contract & {
	approve: (spender: string, amount: BigNumberish) => Promise<any>;
};

describe('ERC721CUpgradeable', function () {
	let owner: Signer;
	let addr1: Signer;
	let addr2: Signer;
	let addr3: Signer;
	let erc721c: ERC721C;
	let kamiUSD: KamiUSD;

	beforeEach(async function () {
		[owner, addr1, addr2, addr3] = await ethers.getSigners();

		// Deploy KamiUSD token
		const KamiUSDFactory = await ethers.getContractFactory('KamiUSD');
		kamiUSD = ((await KamiUSDFactory.deploy()) as unknown) as KamiUSD;
		await kamiUSD.waitForDeployment();

		const royaltyReceivers = [await addr1.getAddress(), await addr2.getAddress()];
		const royaltyShares = [5000, 5000];
		const secondaryRoyaltyPercentage = 500;

		// Deploy ERC721CUpgradeable contract
		const ERC721CFactory = await ethers.getContractFactory('ERC721C');
		erc721c = (await upgrades.deployProxy(
			ERC721CFactory,
			['TestToken', 'TTK', royaltyReceivers, royaltyShares, secondaryRoyaltyPercentage, await kamiUSD.getAddress(), 10],
			{
				initializer: 'initialize',
			}
		)) as typeof erc721c;
		await erc721c.waitForDeployment();

		await erc721c.grantRole(await erc721c.MINTER_ROLE(), await owner.getAddress());
		await erc721c.grantRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress());

		// Distribute some KamiUSD tokens to addr1 and addr2 for testing
		await kamiUSD.transfer(await addr1.getAddress(), ethersLib.parseUnits('1000', 18));
		await kamiUSD.transfer(await addr2.getAddress(), ethersLib.parseUnits('1000', 18));
	});

	it('should assign roles correctly', async function () {
		expect(await erc721c.hasRole(await erc721c.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.MINTER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress())).to.be.true;
	});

	it('should allow minting by minter', async function () {
		await erc721c.mint(await addr1.getAddress(), 'https://token-uri.com/1', ethersLib.parseUnits('1.0', 18), [
			await owner.getAddress(),
		]);
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
		const initialBalance1 = await ethers.provider.getBalance(await addr1.getAddress());
		const initialBalance2 = await ethers.provider.getBalance(await addr2.getAddress());

		const v = ethersLib.parseUnits('1.0', 18);
		await (erc721c.connect(owner) as ERC721C).distributeRoyalties(v, 1);

		const finalBalance1 = await ethers.provider.getBalance(await addr1.getAddress());
		const finalBalance2 = await ethers.provider.getBalance(await addr2.getAddress());
		console.log(finalBalance1, finalBalance2);
		expect(finalBalance1 - initialBalance1).to.equal(ethersLib.parseUnits('0.5', 18));
		expect(finalBalance2 - initialBalance2).to.equal(ethersLib.parseUnits('0.5', 18));
	});

	it('should allow upgrades by upgrader', async function () {
		const ERC721CUpgradeableV2 = await ethers.getContractFactory('ERC721CUpgradeable');
		const erc721c_v2 = await upgrades.upgradeProxy(await erc721c.getAddress(), ERC721CUpgradeableV2);
		expect(erc721c_v2.address).to.equal(await erc721c.address);
	});

	it('should allow setting and getting secondary royalty percentage', async function () {
		await erc721c.setSecondaryRoyaltyPercentage(300);
		expect(await erc721c.getSecondaryRoyaltyPercentage()).to.equal(300);
	});

	it('should handle token purchase with KamiUSD', async function () {
		await erc721c.mint(await addr1.getAddress(), 'https://token-uri.com/2', ethersLib.parseUnits('1.0', 18), [
			await owner.getAddress(),
		]);
		const nft = (await erc721c.connect(addr1)) as ERC721C;
		await nft.setPrice(2, ethersLib.parseUnits('1.0', 18));

		// Approve ERC721 contract to spend KamiUSD on behalf of addr2
		const kusd = (await kamiUSD.connect(addr2)) as KamiUSD;
		await kusd.approve(erc721c.address, ethersLib.parseUnits('1.0', 18));

		// Simulate token purchase
		const nft2 = (await erc721c.connect(addr2)) as ERC721C;
		await nft2.buy(2);
		expect(await erc721c.ownerOf(2)).to.equal(await addr2.getAddress());
	});
});
