import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ethers as ethersLib, BigNumberish, Contract } from 'ethers';
import { Signer } from 'ethers';

type ERC721C = Contract & {
	mint: (to: string, tokenId: number, uri: string, price: BigNumberish) => Promise<any>;
	distributeRoyalties: (options: { value: any }) => Promise<any>;
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

		console.log('Owner Address:', await owner.getAddress());

		// Deploy KamiUSD token
		const KamiUSDFactory = await ethers.getContractFactory('KamiUSD');
		kamiUSD = (await KamiUSDFactory.deploy()) as unknown as KamiUSD;
		await kamiUSD.waitForDeployment();

		const royaltyReceivers = [await addr1.getAddress(), await addr2.getAddress()];
		const royaltyShares = [5000, 5000];
		const secondaryRoyaltyPercentage = 500;

		const ERC721CFactory = await ethers.getContractFactory('ERC721CUpgradeable');
		erc721c = (await upgrades.deployProxy(
			ERC721CFactory,
			['TestToken', 'TTK', royaltyReceivers, royaltyShares, secondaryRoyaltyPercentage, kamiUSD.address],
			{
				initializer: 'initialize',
			}
		)) as typeof erc721c;
		await erc721c.waitForDeployment();

		await erc721c.grantRole(await erc721c.MINTER_ROLE(), await owner.getAddress());
		await erc721c.grantRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress());

		// Distribute some KamiUSD tokens to addr1 and addr2 for testing
		await kamiUSD.transfer(await addr1.getAddress(), ethersLib.parseUnits('1000', 18));
		await kamiUSD.transfer( await addr2.getAddress(), ethersLib.parseUnits( '1000', 18 ) );
		console.log(await kamiUSD.connect(addr1).)
	});

	it('should assign roles correctly', async function () {
		expect(await erc721c.hasRole(await erc721c.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.MINTER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress())).to.be.true;
	});

	it('should allow minting by minter', async function () {
		await erc721c.mint(await addr1.getAddress(), 1, 'https://token-uri.com/1', ethersLib.parseUnits('1.0', 18));
		expect(await erc721c.ownerOf(1)).to.equal(await addr1.getAddress());
		expect(await erc721c.getPrice(1)).to.equal(ethersLib.parseUnits('1.0', 18));
	});

	it('set token uri correctly', async function () {
		await erc721c.setTokenUri(1, 'https://paulstinchcombe.com');
		expect(await erc721c.tokenURI(1)).to.equal('https://paulstinchcombe.com');
	});

	it('should not allow minting by non-minter', async function () {
		expect(
			await erc721c.mint(await addr1.getAddress(), 2, 'https://token-uri.com/2', ethersLib.parseUnits('1.0', 18))
		).to.be.revertedWith('AccessControl: account');
	});

	it('should distribute royalties correctly', async function () {
		const initialBalance1 = await ethers.provider.getBalance(await addr1.getAddress());
		const initialBalance2 = await ethers.provider.getBalance(await addr2.getAddress());

		await (erc721c.connect(owner) as ERC721C).distributeRoyalties({ value: ethersLib.parseUnits('1.0', 18) });

		const finalBalance1 = await ethers.provider.getBalance(await addr1.getAddress());
		const finalBalance2 = await ethers.provider.getBalance(await addr2.getAddress());

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
		await erc721c.mint(await addr1.getAddress(), 2, 'https://token-uri.com/2', ethersLib.parseUnits('1.0', 18));
		await (erc721c.connect(addr1) as ERC721C).setPrice(2, ethersLib.parseUnits('1.0', 18));

		// Approve ERC721 contract to spend KamiUSD on behalf of addr2
		await (kamiUSD.connect(addr2) as KamiUSD).approve(erc721c.address, ethersLib.parseUnits('1.0', 18));

		// Simulate token purchase
		await (erc721c.connect(addr2) as ERC721C).buy(2);
		expect(await erc721c.ownerOf(2)).to.equal(await addr2.getAddress());
	});
});
