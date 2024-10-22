import * as fs from 'fs';
import { mainnet, pulsechain, base, bsc, degen, sepolia, holesky } from "viem/chains";
import { Chain, createPublicClient, erc20Abi, getAddress, http, HttpTransport } from "viem";
import { env } from "../env.js";

const chains = [mainnet, pulsechain,base];
const transportMap: Record<number, HttpTransport> = {
    1: http(env.RPC_HTTP_1),
    369: http(env.RPC_HTTP_369),
    8453: http(env.RPC_HTTP_8453),
}

export const buildTokenList = async () => {
    await Promise.all(chains.map(async (chain) => {
        await getTokenList(chain);
    }));
}

const getTokenList = async (chain: Chain) => {
    const chainName = chain.name.toLowerCase();
    const chainFolder = `${chain.id}_${chainName}`;
    
    let publicClient = createPublicClient({
        chain,
        transport: transportMap[chain.id]
    })

    let outBasePath = `./src/chains/${chainFolder}`;
    let inPath = `./src/shared/tokens/${chainFolder}/list.json`
    let outPath = `${outBasePath}/tokenList.json`

    const addressList = fs.readFileSync(inPath);
    const tokenAddresses = JSON.parse(addressList.toString());

    const tokensRequests = tokenAddresses.map(async (tokenAddress: string) => {
        return await publicClient.multicall({
            contracts: [{
                address: getAddress(tokenAddress),
                abi: erc20Abi,
                functionName: "name",
            }, {
                address: getAddress(tokenAddress),
                abi: erc20Abi,
                functionName: "symbol",
            }, {
                address: getAddress(tokenAddress),
                abi: erc20Abi,
                functionName: "decimals",
            }],
            allowFailure: false
        })
        .then((result) => {
            return {
                chainId: chain.id,
                address: getAddress(tokenAddress),
                name: result[0],
                symbol: result[1],
                decimals: result[2],
            }
        })
    });

    const tokens = await Promise.all(tokensRequests);
    const tokenMap: Record<string, any> = {};

    tokens.forEach((token) => {
        const nameSymbol = `${token.name}_${token.symbol}`.replace(/\s+/g, '-').toLowerCase();
        const tokenDataPath = `${outBasePath}/tokens/${nameSymbol}/${token.address}/`
        fs.mkdirSync(`${tokenDataPath}`, { recursive: true });
        fs.writeFileSync(`${tokenDataPath}/erc20.json`, JSON.stringify(token, null, 2));
        const key = `${token.chainId}-${token.address}`;
        tokenMap[key] = token;
    });

    const tokenList = {
        name: `superdapp-tokens-${chainName}`,
        timestamp: Date.now(),
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
        keywords: ["superdapp.com", "token", "list", chainName],
        tokens,
        tokenMap,
      };

    fs.writeFileSync(outPath, JSON.stringify(tokenList, null, 2));
}