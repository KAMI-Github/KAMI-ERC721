import NFT721 from './nft721';

const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const pk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const providerUrl = 'http://localhost:8545';

async function main() {
	const nft = new NFT721(providerUrl, pk);
	const paymentTokenAddress = await nft.deployKamiUSDToken();
	const proxyAddress = await nft.deployProxyContract();
	NFT721.CONTRACT_ADDRESS = proxyAddress;
	await nft.initialize('Test', 'TEST', [address], [100], 10, paymentTokenAddress, 0);
	await nft.mint(address, 'https://paulstinchcombe.com', 1e18, [address]);
	console.log(await nft.getCurrentTokenId());
}

main();
