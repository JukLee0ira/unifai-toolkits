import * as dotenv from 'dotenv';
dotenv.config();

import { Toolkit, ActionContext, TransactionAPI } from 'unifai-sdk';
import { getTokenAddressBySymbol } from '../common/tokenaddress';


async function getTokenAddress(token: string, chain: string) : Promise<string> {
  if (ethers.isAddress(token.toLowerCase())) {
    return token.toLowerCase();
  }
  return await getTokenAddressBySymbol(token, chain) || token;
}

async function main() {
  // 这里创建了工具包实例和交易API实例，符合要求将交易构建与签名分离
  const apikey="Gql1M90sAR0SR0FLw7VGhT1GLjU9pSW37Tt5HWsc9W3"//TODO:remove it
  const toolkit = new Toolkit({ apiKey: apikey });
  const api = new TransactionAPI({ apiKey: apikey, endpoint:process.env.TRANSACTION_BUILD_URL });
  // 设置工具包的名称和描述，这对大模型理解工具的用途很重要
  await toolkit.updateToolkit({
    // 工具包的名称
    name: 'Lido', // 您工具包的名称
    description: 'interacting with Lido protocol, supporting staking ETH and querying APR', // 您工具包的描述：与Lido协议交互的自定义工具包，支持质押ETH和查询APR。
  });

  toolkit.event('ready', () => {
    console.log('Toolkit is ready to use');
  });

  
  toolkit.action({
    action: 'supply',
    actionDescription: 'Supplies assets into the market and receives cTokens in exchange.',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The chain name, only support ethereum for now.',
        required: true,
      },
      amount: {
        type: 'number',
        description: 'The amount of the underlying asset to supply',
        required: true,
      },
      asset: {
        type: 'string',
        description: 'The token address or contract address or symbol or ticker of underlying asset. Leave blank for ETH.',
        required: false,
      }
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      if (payload.asset) {
        payload.asset = await getTokenAddress(payload.asset, payload.chain);
      }
      const result = await api.createTransaction('compound/v2', ctx, {
        action: 'supply',
        chain: payload.chain,
        amount: payload.amount.toString(),
        asset: payload.asset,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to deposit: ${error}` });
    }
  });

  toolkit.action({
    action: 'borrow',
    actionDescription: 'Borrow tokens from Compound',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The chain name, only support ethereum for now.',
        required: true,
      },
      amount: {
        type: 'number',
        description: 'Amount of tokens to borrow',
        required: true,
      },
      asset: {
        type: 'string',
        description: 'The token address or contract address or symbol or ticker of underlying asset. Leave blank for ETH.',
        required: false,
      }
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      if (payload.asset) {
        payload.asset = await getTokenAddress(payload.asset, payload.chain);
      }
      const result = await api.createTransaction('compound/v2', ctx, {
        action: 'borrow',
        chain: payload.chain,
        amount: payload.amount.toString(),
        asset: payload.asset,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to borrow: ${error}` });
    }
  });

  toolkit.action({
    action: 'repayBorrow',
    actionDescription: 'Repay borrowed tokens to Compound',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The chain name, only support ethereum for now.',
        required: true,
      },
      amount: {
        type: 'number',
        description: 'The amount to repay',
        required: true,
      },
      asset: {
        type: 'string',
        description: 'The token address or contract address or symbol or ticker of underlying asset. Leave blank for ETH.',
        required: false,
      }
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      if (payload.asset) {
        payload.asset = await getTokenAddress(payload.asset, payload.chain);
      }
      const result = await api.createTransaction('compound/v2', ctx, {
        action: 'repayBorrow',
        chain: payload.chain,
        amount: payload.amount.toString(),
        asset: payload.asset,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to repay: ${error}` });
    }
  });

  toolkit.action({
    action: 'redeem',
    actionDescription: 'converts a specified quantity of cTokens into the underlying asset',
    payloadDescription: {
      chain: {
        type: 'string',
        description: 'The chain name, only support ethereum for now.',
        required: true,
      },
      amount: {
        type: 'number',
        description: 'The number of cTokens to redeem into underlying',
        required: true,
      },
      asset: {
        type: 'string',
        description: 'The token address or contract address or symbol or ticker of underlying asset. Leave blank for ETH.',
        required: false,
      }
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      if (payload.asset) {
        payload.asset = await getTokenAddress(payload.asset, payload.chain);
      }
      const result = await api.createTransaction('compound/v2', ctx, {
        action: 'redeem',
        chain: payload.chain,
        amount: payload.amount.toString(),
        asset: payload.asset,
      });
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to redeem: ${error}` });
    }
  });

  await toolkit.run();
}

main().catch(console.error);
