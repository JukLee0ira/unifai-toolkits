import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { stake, unstakeEth } from './lido-sdk';

// 确保 dotenv 配置在最开始就加载
const result = dotenv.config({ path: resolve(__dirname, '../../.env') });


import { Toolkit, ActionContext } from 'unifai-sdk';
import { getTokenAddressBySymbol } from '../common/tokenaddress';
import { ethers } from 'ethers';


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
  // 这里创建了工具包实例
  const apikey=process.env.UNIFAI_TOOLKIT_API_KEY;
  const ethurl=process.env.ETHEREUM_RPC_URL;
  
  const toolkit = new Toolkit({ apiKey: apikey });

  // 更新 toolkit 的元数据（名称和描述）
  await toolkit.updateToolkit({
    name: 'Lido',
    description: "Lido is a liquid staking solution for ETH, and other PoS assets. It allows users to stake their tokens and receive liquid staked tokens (e.g., stETH) in return, which can then be used across various DeFi protocols.",
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
    actionDescription: 'Stake native tokens (ETH) to receive corresponding liquid staked tokens (stETH) .',
    payloadDescription: {
      amount: {
        type: 'number',
        description: 'The amount of native token (ETH) to stake.',
        required: true,
      },
  
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      console.log('开始处理质押请求，payload:', JSON.stringify(payload, null, 2));
      const yourHoleskyRpcUrl = 'https://ethereum-holesky-rpc.publicnode.com'; // 例如: 'https://holesky.infura.io/v3/YOUR_INFURA_PROJECT_ID'//TODO: 多处用到作为全局变量
      const stakeValueWei = BigInt(Math.floor(payload.amount * 1e18));
      const stakeOperationResult=await stake(yourHoleskyRpcUrl,stakeValueWei,process.env.ETHEREUM_PRIVATE_KEY);
      console.log('质押操作结果:', stakeOperationResult);
      // const chain = payload.chain.toLowerCase(); // 获取并标准化链名
      // // let transactionType: string; // transactionType is not needed if we handle chains 
     return ctx.result({ message: stakeOperationResult });
        
    } catch (error) {
      console.error('质押过程中发生错误:', error);
      if (error instanceof Error) {
        console.error('错误堆栈:', error.stack);
      }
      return ctx.result({ error: `Failed to stake: ${error}` }); // 捕获并返回错误
    }
  });

  // ========================================================================
  // Action: unstake (赎回流动性质押代币获取原生代币)
  // ========================================================================
  toolkit.action({
    action: 'unstake',
    actionDescription: 'Unstake liquid staked tokens (stETH) to receive native tokens (ETH). Note: unstaking may involve a waiting period depending on the protocol.',
    payloadDescription: {
      amount: {
        type: 'number',
        description: 'The amount of liquid staked tokens (stETH) to unstake.',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      console.log('开始处理赎回请求，payload:', JSON.stringify(payload, null, 2));
      const unstakeValueWei = BigInt(Math.floor(payload.amount * 1e18));
      console.log('unstakeValueWei:', unstakeValueWei);
      const ethurl = 'https://ethereum-holesky-rpc.publicnode.com';
      const unstakeOperationResult=await unstakeEth(ethurl,process.env.ETHEREUM_PRIVATE_KEY,unstakeValueWei);
      console.log('赎回操作结果:', unstakeOperationResult);
      return ctx.result({ message: unstakeOperationResult });
      

     
      // unstakeEth(ethurl, process.env.ETHEREUM_PRIVATE_KEY, '0.0001');//TODO: 需要修改为动态参数顺序要对齐
   
    } catch (error) {
      return ctx.result({ error: `Failed to unstake: ${error}` });
    }
  });

  // ========================================================================
  // Action: getLiquidStakedBalance (获取流动性质押代币余额)
  // ========================================================================
  toolkit.action({
    action: 'getLiquidStakedBalance',
    actionDescription: 'Get the balance of stETH for a given wallet address.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The blockchain network (e.g., "ethereum").',
        required: true,
        enums: ['ethereum'],
      },
      walletAddress: {
        type: 'string',
        description: 'The wallet address to query.',
        required: true,
      },
      liquidStakedToken: {
        type: 'string',
        description: 'The symbol or address of the liquid staked token (e.g., "stETH").',
        required: true,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      const liquidStakedTokenAddress = await getTokenAddress(payload.liquidStakedToken, chain);

      if (!liquidStakedTokenAddress) {
        throw new Error(`Could not resolve address for liquid staked token: ${payload.liquidStakedToken} on ${payload.chain}`);
      }

      if (chain === 'ethereum') {
        console.log(`Fetching stETH balance for ${payload.walletAddress} on Ethereum`);
        // 需要一个 provider 来与以太坊网络交互以进行只读调用
        const provider = ethers.getDefaultProvider(ethurl || 'mainnet'); 
        
        const stEthContractAbi = [
          "function balanceOf(address account) view returns (uint256)"
        ];
        const stEthContract = new ethers.Contract(liquidStakedTokenAddress, stEthContractAbi, provider);

        const balanceWei = await stEthContract.balanceOf(payload.walletAddress);
        const balanceEth = ethers.formatEther(balanceWei);

        console.log('Balance of stETH for', payload.walletAddress, 'on Ethereum:', balanceEth);

        return ctx.result({
          message: `Balance of ${payload.liquidStakedToken} for ${payload.walletAddress} on ${chain}: ${balanceEth}`,
          balance: balanceEth,
          balanceWei: balanceWei.toString()
        });

      }  else {
        throw new Error(`Unsupported chain for getLiquidStakedBalance: ${payload.chain}`);
      }

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
        description: 'The blockchain network (e.g., "ethereum").',
        required: true,
        enums: ['ethereum'],
      },
      apr: { // 添加 apr 字段
        type: 'number',
        description: 'Annual Percentage Rate (APR) for Lido staking. This is a direct yield without compounding.',
        required: false,
      },
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      const chain = payload.chain.toLowerCase();
      
      if (chain === 'ethereum') {
        // 使用 Lido staking router 合约获取 APR
        const provider = ethers.getDefaultProvider(ethurl || 'mainnet');
        const stakingRouterAddress = '0xB9D7934878B5FB9610B3fE8A5e441e8fad7E293f';
        const stakingRouterAbi = [
          "function getStakingAPR() view returns (uint256)"
        ];
        
        const stakingRouter = new ethers.Contract(stakingRouterAddress, stakingRouterAbi, provider);
        const aprBasisPoints = await stakingRouter.getStakingAPR();
        const apr = Number(aprBasisPoints) / 100; // Convert basis points to percentage
        
        // 计算 APY (假设每天复利)
        const apy = (1 + apr / 36500) ** 365 - 1;
        
        return ctx.result({
          apr: apr,
          apy: apy * 100, // Convert to percentage
          message: `Current Lido staking APR: ${apr.toFixed(2)}%, APY: ${(apy * 100).toFixed(2)}%`
        });
        
      } else {
        throw new Error(`Unsupported chain for getAPY: ${payload.chain}`);
      }
    } catch (error) {
      return ctx.result({ error: `Failed to get APY: ${error}` });
    }
  });

  
  

  // 运行 toolkit
  await toolkit.run();
}

// 调用主函数并捕获任何未处理的错误
main().catch(console.error);
