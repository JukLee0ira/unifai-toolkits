import * as dotenv from 'dotenv';
dotenv.config();

import { Toolkit, ActionContext, TransactionAPI } from 'unifai-sdk';
import { getTokenAddressBySymbol } from '../common/tokenaddress';
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';

/**
 * 辅助函数：根据代币符号和链获取代币地址。
 * 这个函数会尝试识别地址类型（EVM 或 Solana），并使用通用解析器。
 * @param token 代币符号或地址。
 * @param chain 链名称（例如："ethereum", "solana", "bnb", "base"）。
 * @returns 解析后的代币地址，如果无法解析则返回原始代币字符串。
 */

// async function getLidoTokenAddress(token: string, chain: string): Promise<string> {
//   const lowerCaseChain = chain.toLowerCase(); // 将链名转换为小写，以便与内部逻辑匹配

//   // 如果是 EVM 链，尝试检查是否为有效的 EVM 地址
//   if (['ethereum', 'base', 'bsc'].includes(lowerCaseChain)) {
//     if (ethers.isAddress(token.toLowerCase())) {
//       return token.toLowerCase();
//     }
//   }
//   // 如果是 Solana 链，尝试检查是否为有效的 Solana PublicKey
//   else if (lowerCaseChain === 'solana') {
//     try {
//       new PublicKey(token); // 尝试创建 PublicKey，如果无效会抛出错误
//       return token; // 如果是有效的 PublicKey，直接返回
//     } catch (e) {
//       // 不是有效的 PublicKey，继续通过符号查找
//     }
//   }

//   // 使用通用的 getTokenAddressBySymbol 查找代币地址
//   // 这个函数会从 DexScreener 或 CoinGecko 等服务中查找
//   return await getTokenAddressBySymbol(token, lowerCaseChain) || token;
// }

async function getTokenAddress(token: string, chain: string) : Promise<string> {
  if (ethers.isAddress(token.toLowerCase())) {
    return token.toLowerCase();
  }
  return await getTokenAddressBySymbol(token, chain) || token;
}

/**
 * 主函数：初始化 Lido Toolkit 并注册所有 action。
 */
async function main() {
  // 这里创建了工具包实例和交易API实例，符合要求将交易构建与签名分离
  const apikey="Gql1M90sAR0SR0FLw7VGhT1GLjU9pSW37Tt5HWsc9W3"//TODO:remove it
  const toolkit = new Toolkit({ apiKey: apikey });
  // 初始化 TransactionAPI 实例，用于创建链上交易
  const api = new TransactionAPI({ apiKey: apikey });

  // 更新 toolkit 的元数据（名称和描述）
  await toolkit.updateToolkit({
    name: 'Lido',
    description: "Lido is a liquid staking solution for ETH, SOL, and other PoS assets. It allows users to stake their tokens and receive liquid staked tokens (e.g., stETH, stSOL) in return, which can then be used across various DeFi protocols.",
  });

  // 监听 toolkit 准备就绪事件
  toolkit.event('ready', () => {
    console.log('Toolkit is ready to use');
  });

  // ========================================================================
  // Action: stake (质押原生代币获取流动性质押代币)
  // ========================================================================
  toolkit.action({
    action: 'stake',
    actionDescription: 'Stake native tokens (ETH or SOL) to receive corresponding liquid staked tokens (stETH or stSOL).',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network to stake on (e.g., "ethereum", "solana").',
        required: true,
        enums: ['ethereum', 'solana'], // 支持的链
      },
      amount: {
        type: 'number',
        description: 'The amount of native token (ETH or SOL) to stake.',
        required: true,
      },
      recipientAddress: {
        type: 'string',
        description: 'The wallet address to receive the liquid staked tokens (stETH or stSOL).',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase(); // 获取并标准化链名
      let transactionType: string;

      // 根据链类型确定交易类型
      if (chain === 'ethereum') {
        transactionType = 'lido/stake-eth'; // 以太坊上的质押交易类型
      } else if (chain === 'solana') {
        transactionType = 'lido/stake-sol'; // Solana 上的质押交易类型
      } else {
        throw new Error(`Unsupported chain for staking: ${payload.chain}`);
      }

      // 调用 TransactionAPI 创建质押交易
      const result = await api.createTransaction(transactionType, ctx, {
        chain: chain,
        amount: payload.amount.toString(), // 将数量转换为字符串以保持精度
        recipient: payload.recipientAddress,
      });
      return ctx.result(result); // 返回交易结果
    } catch (error) {
      return ctx.result({ error: `Failed to stake: ${error}` }); // 捕获并返回错误
    }
  });

  // ========================================================================
  // Action: unstake (赎回流动性质押代币获取原生代币)
  // ========================================================================
  toolkit.action({
    action: 'unstake',
    actionDescription: 'Unstake liquid staked tokens (stETH or stSOL) to receive native tokens (ETH or SOL). Note: unstaking may involve a waiting period depending on the protocol.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network to unstake from (e.g., "ethereum", "solana").',
        required: true,
        enums: ['ethereum', 'solana'],
      },
      amount: {
        type: 'number',
        description: 'The amount of liquid staked tokens (stETH or stSOL) to unstake.',
        required: true,
      },
      liquidStakedToken: {
        type: 'string',
        description: 'The symbol or address of the liquid staked token (e.g., "stETH", "stSOL").',
        required: true,
      },
      recipientAddress: {
        type: 'string',
        description: 'The wallet address to receive the native tokens (ETH or SOL).',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      // 解析流动性质押代币的地址
      const liquidStakedTokenAddress = await getTokenAddress(payload.liquidStakedToken, chain);

      if (!liquidStakedTokenAddress) {
        throw new Error(`Could not resolve address for liquid staked token: ${payload.liquidStakedToken} on ${payload.chain}`);
      }

      let transactionType: string;
      if (chain === 'ethereum') {
        transactionType = 'lido/unstake-eth'; // 以太坊上的赎回交易类型
      } else if (chain === 'solana') {
        transactionType = 'lido/unstake-sol'; // Solana 上的赎回交易类型
      } else {
        throw new Error(`Unsupported chain for unstaking: ${payload.chain}`);
      }

      // 调用 TransactionAPI 创建赎回交易
      const result = await api.createTransaction(transactionType, ctx, {
        chain: chain,
        amount: payload.amount.toString(),
        liquidStakedToken: liquidStakedTokenAddress,
        recipient: payload.recipientAddress,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to unstake: ${error}` });
    }
  });

  // ========================================================================
  // Action: getLiquidStakedBalance (获取流动性质押代币余额)
  // ========================================================================
  toolkit.action({
    action: 'getLiquidStakedBalance',
    actionDescription: 'Get the balance of stETH or stSOL for a given wallet address.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network (e.g., "ethereum", "solana").',
        required: true,
        enums: ['ethereum', 'solana'],
      },
      walletAddress: {
        type: 'string',
        description: 'The wallet address to query.',
        required: true,
      },
      liquidStakedToken: {
        type: 'string',
        description: 'The symbol or address of the liquid staked token (e.g., "stETH", "stSOL").',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      // 解析流动性质押代币的地址
      const liquidStakedTokenAddress = await getTokenAddress(payload.liquidStakedToken, chain);

      if (!liquidStakedTokenAddress) {
        throw new Error(`Could not resolve address for liquid staked token: ${payload.liquidStakedToken} on ${payload.chain}`);
      }

      // 假设有一个通用的 API 端点来获取代币余额
      // 实际实现可能需要调用特定链的 RPC 或第三方 API
      const result = await api.createTransaction('lido/get-balance', ctx, {
        chain: chain,
        walletAddress: payload.walletAddress,
        tokenAddress: liquidStakedTokenAddress,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to get liquid staked balance: ${error}` });
    }
  });

  // ========================================================================
  // Action: getAPY (获取年化收益率)
  // ========================================================================
  toolkit.action({
    action: 'getAPY',
    actionDescription: 'Get the current Annual Percentage Yield (APY) for Lido staking on a specific chain.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network (e.g., "ethereum", "solana").',
        required: true,
        enums: ['ethereum', 'solana'],
      },
      apr: { // 添加 apr 字段
        type: 'number',
        description: 'Annual Percentage Rate (APR) for Lido staking. This is a direct yield without compounding.',
        required: false,
      },
      // 可以添加 asset 字段来指定查询特定流动性质押代币的APY，如果协议支持细分
      // asset: {
      //   type: 'string',
      //   description: 'Optional: The liquid staked token symbol (e.g., "stETH", "stSOL").',
      //   required: false,
      // },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      // 假设有一个通用的 API 端点来获取 APY
      // 实际实现可能需要调用 Lido 的官方 API 或聚合器
      const result = await api.createTransaction('lido/get-apy', ctx, {
        chain: chain,
        apr: payload.apr, // 传递 apr 字段
        // asset: payload.asset, // 如果 payloadDescription 中有 asset 字段，可以传递
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to get APY: ${error}` });
    }
  });

  
  // ========================================================================
  // Action: bridgeLiquidStakedToken (桥接流动性质押代币)
  // ========================================================================
  toolkit.action({
    action: 'bridgeLiquidStakedToken',
    actionDescription: 'Bridge liquid staked tokens (e.g., stETH, stSOL) from one chain to another.',
    payloadDescription: {
      sourceChain: {
        type: 'string',
        description: 'The source blockchain network (e.g., "ethereum", "solana").',
        required: true,
      },
      destinationChain: {
        type: 'string',
        description: 'The destination blockchain network (e.g., "solana", "ethereum", "polygon").',
        required: true,
      },
      amount: {
        type: 'number',
        description: 'The amount of liquid staked token to bridge.',
        required: true,
      },
      liquidStakedToken: {
        type: 'string',
        description: 'The symbol or address of the liquid staked token (e.g., "stETH", "stSOL").',
        required: true,
      },
      recipientAddress: {
        type: 'string',
        description: 'The recipient wallet address on the destination chain.',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const sourceChain = payload.sourceChain.toLowerCase();
      const destinationChain = payload.destinationChain.toLowerCase();
      // 解析源链上的流动性质押代币地址
      const liquidStakedTokenAddress = await getTokenAddress(payload.liquidStakedToken, sourceChain);

      if (!liquidStakedTokenAddress) {
        throw new Error(`Could not resolve address for liquid staked token: ${payload.liquidStakedToken} on ${payload.sourceChain}`);
      }

      // 假设有一个通用的桥接交易类型，需要源链、目标链、代币地址等信息
      const result = await api.createTransaction('lido/bridge', ctx, {
        sourceChain: sourceChain,
        destinationChain: destinationChain,
        amount: payload.amount.toString(),
        tokenAddress: liquidStakedTokenAddress,
        recipient: payload.recipientAddress,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to bridge liquid staked token: ${error}` });
    }
  });

  // ========================================================================
  // Action: lendLiquidStakedToken (借出流动性质押代币作为抵押)
  // 此 action 模拟将 stETH/stSOL 存入通用借贷协议（如 Aave 或 Compound）
  // ========================================================================
  toolkit.action({
    action: 'lendLiquidStakedToken',
    actionDescription: 'Deposit liquid staked tokens (e.g., stETH, stSOL) into a lending protocol (e.g., Aave, Compound) as collateral.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network where the lending protocol resides (e.g., "ethereum", "polygon").',
        required: true,
        enums: ['ethereum', 'polygon', 'base', 'bsc'], // 示例支持的链
      },
      amount: {
        type: 'number',
        description: 'The amount of liquid staked token to deposit.',
        required: true,
      },
      liquidStakedToken: {
        type: 'string',
        description: 'The symbol or address of the liquid staked token (e.g., "stETH", "stSOL").',
        required: true,
      },
      protocol: {
        type: 'string',
        description: 'The lending protocol to interact with (e.g., "Aave", "Compound", "Venus").',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      // 解析流动性质押代币的地址
      const liquidStakedTokenAddress = await getTokenAddress(payload.liquidStakedToken, chain);

      if (!liquidStakedTokenAddress) {
        throw new Error(`Could not resolve address for liquid staked token: ${payload.liquidStakedToken} on ${payload.chain}`);
      }

      // 假设有一个通用的借贷交易类型，需要协议名称、代币地址等信息
      const result = await api.createTransaction('lido/lend', ctx, {
        chain: chain,
        amount: payload.amount.toString(),
        tokenAddress: liquidStakedTokenAddress,
        protocol: payload.protocol,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to lend liquid staked token: ${error}` });
    }
  });

  // ========================================================================
  // Action: borrowAgainstLiquidStakedToken (以流动性质押代币为抵押借款)
  // ========================================================================
  toolkit.action({
    action: 'borrowAgainstLiquidStakedToken',
    actionDescription: 'Borrow other assets using your deposited liquid staked tokens as collateral on a lending protocol.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network where the lending protocol resides (e.g., "ethereum", "polygon").',
        required: true,
        enums: ['ethereum', 'polygon', 'base', 'bsc'], // 示例支持的链
      },
      borrowAmount: {
        type: 'number',
        description: 'The amount of asset to borrow.',
        required: true,
      },
      borrowAsset: {
        type: 'string',
        description: 'The symbol or address of the asset to borrow (e.g., "USDC", "DAI").',
        required: true,
      },
      protocol: {
        type: 'string',
        description: 'The lending protocol to interact with (e.g., "Aave", "Compound", "Venus").',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      // 解析要借入资产的地址
      const borrowAssetAddress = await getTokenAddress(payload.borrowAsset, chain);

      if (!borrowAssetAddress) {
        throw new Error(`Could not resolve address for borrow asset: ${payload.borrowAsset} on ${payload.chain}`);
      }

      // 调用 TransactionAPI 创建借款交易
      const result = await api.createTransaction('lido/borrow', ctx, {
        chain: chain,
        amount: payload.borrowAmount.toString(),
        tokenAddress: borrowAssetAddress,
        protocol: payload.protocol,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to borrow against liquid staked token: ${error}` });
    }
  });

  // ========================================================================
  // Action: repayLiquidStakedTokenLoan (偿还流动性质押代币贷款)
  // ========================================================================
  toolkit.action({
    action: 'repayLiquidStakedTokenLoan',
    actionDescription: 'Repay a loan taken against your liquid staked tokens on a lending protocol.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network where the lending protocol resides (e.g., "ethereum", "polygon").',
        required: true,
        enums: ['ethereum', 'polygon', 'base', 'bsc'], // 示例支持的链
      },
      repayAmount: {
        type: 'number',
        description: 'The amount of asset to repay.',
        required: true,
      },
      repayAsset: {
        type: 'string',
        description: 'The symbol or address of the asset to repay (e.g., "USDC", "DAI").',
        required: true,
      },
      protocol: {
        type: 'string',
        description: 'The lending protocol to interact with (e.g., "Aave", "Compound", "Venus").',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      // 解析要偿还资产的地址
      const repayAssetAddress = await getTokenAddress(payload.repayAsset, chain);

      if (!repayAssetAddress) {
        throw new Error(`Could not resolve address for repay asset: ${payload.repayAsset} on ${payload.chain}`);
      }

      // 调用 TransactionAPI 创建还款交易
      const result = await api.createTransaction('lido/repay', ctx, {
        chain: chain,
        amount: payload.repayAmount.toString(),
        tokenAddress: repayAssetAddress,
        protocol: payload.protocol,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to repay liquid staked token loan: ${error}` });
    }
  });

  // 运行 toolkit
  await toolkit.run();
}

// 调用主函数并捕获任何未处理的错误
main().catch(console.error);
