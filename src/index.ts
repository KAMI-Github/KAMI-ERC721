import NFT721 from './nft721';

const address = '0x16c607Dbe5e4959B159510C63925051e31d2E0A6';
const pk = '21a60c30d07a1e0483c8547b72217ea08a427f95d2503d78f3fd1a54b8527021';
const providerUrl = 'https://testnet.skalenodes.com/v1/giant-half-dual-testnet';

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
