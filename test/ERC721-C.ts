import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ethers as ethersLib } from 'ethers';
import { Contract, Signer } from 'ethers';

type ERC721C = Contract & {
	mint: (to: string, tokenId: number, uri: string) => Promise<any>;
	distributeRoyalties: (options: { value: any }) => Promise<any>;
	address: string;
};

describe('ERC721CUpgradeable', function () {
	let owner: Signer;
	let addr1: Signer;
	let addr2: Signer;
	let addr3: Signer;
	let erc721c: ERC721C;

	beforeEach(async function () {
		[owner, addr1, addr2, addr3] = await ethers.getSigners();

		const royaltyReceivers = [await addr1.getAddress(), await addr2.getAddress()];
		const royaltyShares = [5000, 5000];

		const ERC721CFactory = await ethers.getContractFactory('ERC721CUpgradeable');
		erc721c = (await upgrades.deployProxy(ERC721CFactory, ['TestToken', 'TTK', royaltyReceivers, royaltyShares], {
			initializer: 'initialize',
		})) as typeof erc721c;
		// await erc721c.deployed();
		await erc721c.waitForDeployment();

		await erc721c.grantRole(await erc721c.MINTER_ROLE(), await owner.getAddress());
		await erc721c.grantRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress());
	});

	it('should assign roles correctly', async function () {
		expect(await erc721c.hasRole(await erc721c.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.MINTER_ROLE(), await owner.getAddress())).to.be.true;
		expect(await erc721c.hasRole(await erc721c.UPGRADER_ROLE(), await owner.getAddress())).to.be.true;
	});

	it('should allow minting by minter', async function () {
		await erc721c.mint(await addr1.getAddress(), 1, 'https://token-uri.com/1');
		expect(await erc721c.ownerOf(1)).to.equal(await addr1.getAddress());
	});

	it('set token uri correctly', async function () {
		await erc721c.setTokenUri(1, 'https://paulstinchcombe.com');
		expect(await erc721c.tokenURI(1)).to.equal('https://paulstinchcombe.com');
	});

	it('should not allow minting by non-minter', async function () {
		expect(await erc721c.mint(await addr1.getAddress(), 2, 'https://token-uri.com/2')).to.be.revertedWith('AccessControl: account');
	});

	it('should distribute royalties correctly', async function () {
		const initialBalance1 = await ethers.provider.getBalance(await addr1.getAddress());
		const initialBalance2 = await ethers.provider.getBalance(await addr2.getAddress());

		await (erc721c.connect(owner) as ERC721C).distributeRoyalties({ value: ethersLib.parseEther('1.0') });

		const finalBalance1 = await ethers.provider.getBalance(await addr1.getAddress());
		const finalBalance2 = await ethers.provider.getBalance(await addr2.getAddress());

		expect(finalBalance1 - initialBalance1).to.equal(ethersLib.parseEther('0.5'));
		expect(finalBalance2 - initialBalance2).to.equal(ethersLib.parseEther('0.5'));
	});

	it('should allow upgrades by upgrader', async function () {
		const ERC721CUpgradeableV2 = await ethers.getContractFactory('ERC721CUpgradeable');
		const erc721c_v2 = await upgrades.upgradeProxy(await erc721c.getAddress(), ERC721CUpgradeableV2);
		expect(erc721c_v2.address).to.equal(await erc721c.address);
	});
});
