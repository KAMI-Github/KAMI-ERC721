import { config } from 'dotenv';
import NFT721 from './nft721';

config();

const pk = process.env.KAMI_PRIVATE_KEY ?? '';
const providerUrl = process.env.RPC_URL ?? 'http://localhost:8545';
let paymentTokenAddress = process.env.KAMI_USD_ADDRESS;

async function main() {
	console.log(`Using provider ${providerUrl}`);
	const nft = new NFT721(providerUrl, pk);
	console.log(`Wallet address: ${nft.walletAddress}`);

	if (!paymentTokenAddress) paymentTokenAddress = await nft.deployKamiUSDToken();
	console.log(`Payment token address: ${paymentTokenAddress}`);

	const proxyAddress = await nft.deployProxyContract('Test', 'TEST', [nft.walletAddress], [10000], 1000, paymentTokenAddress, 0);
	console.log(`Proxy contract address: ${proxyAddress}`);

	await nft.mint(nft.walletAddress, 'https://paulstinchcombe.com', 1e18, [nft.walletAddress]);
	console.log(`Current token id: ${await nft.getCurrentTokenId()}`);
}

main();
