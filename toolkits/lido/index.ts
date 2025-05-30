import * as dotenv from 'dotenv';
dotenv.config();

import { Toolkit, ActionContext, TransactionAPI } from 'unifai-sdk';
import { getTokenAddressBySymbol } from '../common/tokenaddress';


async function getTokenAddress(token: string) : Promise<string> {
  return await getTokenAddressBySymbol(token, 'bsc') || token;
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
    // 工具包的名称:投资，投资描述:投资资产到Venus协议，获得cTokens
    action: 'invest',
    // 投资描述:投资资产到Venus协议，获得cTokens
    actionDescription: 'invests (lends, stake, PoS) assets into the market and receives cTokens in exchange on BNB (a.k.a. BSC) blockchain.',
    // 投资参数:链名:BNB (a.k.a. BSC)，amount:投资金额，asset:投资资产，action:投资操作
    payloadDescription: {
      // 链名:BNB (a.k.a. BSC)，描述:只支持BNB (a.k.a. BSC)
      chain: {
        type: 'string',
        description: 'The chain name, only support BNB (a.k.a. BSC) for now.',
        required: true,
      },
      // 投资金额:投资金额，描述:投资金额
      amount: {
        type: 'string',
        description: 'The amount of the underlying asset to invest(lend, stake, PoS)',
        required: true,
      },
      // 投资资产:投资资产，描述:投资资产
      asset: {
        type: 'string',
        description: 'The token symbol or ticker of underlying asset. Leave blank for BNB.',
        required: false,
      },
      // 投资操作:投资操作，描述:投资操作
      action: {
        type: 'string',
        description: 'The action for the calling the venus protocol. Leave blank for invest.',
        required: false,
      }
    }
  }, async (ctx: ActionContext, payload: any = {}) => {
    try {
      // 投资操作:投资操作，描述:投资操作
      payload.action = 'invest';
      const result = await api.createTransaction('venus/v5', ctx, payload);
      return ctx.result(result);
    } catch (error) {
      return ctx.result({ error: `Failed to create transaction: ${error}` });
    }
  });

  // toolkit.action({
  //   // 工具包的名称:供应，供应描述:供应资产到Venus协议，获得cTokens
  //   action: 'supply',
  //   actionDescription: 'supplies(lends, stake, PoS) assets into the market and receives cTokens in exchange on BNB (a.k.a. BSC) blockchain.',
  //   payloadDescription: {
  //     // 链名:BNB (a.k.a. BSC)，描述:只支持BNB (a.k.a. BSC)
  //     chain: {
  //       type: 'string',
  //       description: 'The chain name, only support BNB (a.k.a. BSC) for now.',
  //       required: true,
  //     },
  //     // 供应金额:供应金额，描述:供应金额
  //     amount: {
  //       type: 'string',
  //       description: 'The amount of the underlying asset to supply(lend, stake, PoS)',
  //       required: true,
  //     },
  //     // 供应资产:供应资产，描述:供应资产
  //     asset: {
  //       type: 'string',
  //       description: 'The token symbol or ticker of underlying asset. Leave blank for BNB.',
  //       required: false,
  //     },
  //     // 供应操作:供应操作，描述:供应操作
  //     action: {
  //       type: 'string',
  //       description: 'The action for the calling the venus protocol. Leave blank for supply.',
  //       required: false,
  //     }
  //   }
  // }, async (ctx: ActionContext, payload: any = {}) => {
  //   try {
  //     // 供应操作:供应操作，描述:供应操作
  //     payload.action = 'supply';
  //     const result = await api.createTransaction('venus/v5', ctx, payload);
  //     return ctx.result(result);
  //   } catch (error) {
  //     return ctx.result({ error: `Failed to create transaction: ${error}` });
  //   }
  // });

//   toolkit.action({
//     // 工具包的名称:赎回，赎回描述:赎回资产到Venus协议，获得底层资产
//     action: 'redeem',
//     // 赎回描述:赎回资产到Venus协议，获得底层资产
//     actionDescription: 'redeem a specified quantity of vTokens into the underlying asset',
//     // 赎回参数:钱包地址:钱包地址，描述:钱包地址
//     payloadDescription: {
//       wallet: {
//         type: 'string',
//         description: 'The wallet address that receives the fund redeem from the investment(lending, staking, PoS), only support BNB (a.k.a. BSC) for now.',
//         required: true,
//       },
//       // 链名:BNB (a.k.a. BSC)，描述:只支持BNB (a.k.a. BSC)
//       chain: {
//         type: 'string',
//         description: 'The chain name, only support BNB (a.k.a. BSC) for now.',
//         required: true,
//       },
//       // 赎回金额:赎回金额，描述:赎回金额
//       amount: {
//         type: 'string',
//         description: 'The number of vTokens to redeem into underlying',
//         required: true,
//       },
//       // 赎回资产:赎回资产，描述:赎回资产
//       asset: {
//         type: 'string',
//         description: 'The token symbol or ticker of underlying asset to redeem.',
//         required: false,
//       },
//       // 赎回操作:赎回操作，描述:赎回操作
//       action: {
//         type: 'string',
//         description: 'The action for the calling the venus protocol. Leave blank for redeem.',
//         required: false,
//       },
//       // 赎回资产:赎回资产，描述:赎回资产
//       token: {
//         type: 'string',
//         description: 'The token symbol or ticker of underlying asset to redeem.',
//         required: false,
//       },
//     }
//   }, async (ctx: ActionContext, payload: any = {}) => {
//     try {
//       // 赎回操作:赎回操作，描述:赎回操作
//       if (payload.wallet) {
//         payload.wallet = await getTokenAddress(payload.wallet);
//       }
//       payload.action = 'redeem';
//       if (!payload.asset) {
//         payload.asset = payload.token;
//       }
//       const result = await api.createTransaction('venus/v5', ctx, payload);
//       return ctx.result(result);
//     } catch (error) {
//       return ctx.result({ error: `Failed to redeem: ${error}` });
//     }
//   });

//   toolkit.action({
//     // 工具包的名称:提现，提现描述:提现资产到Venus协议，获得底层资产
//     action: 'withdraw',
//     // 提现描述:提现资产到Venus协议，获得底层资产
//     actionDescription: 'withdraw a specified quantity of vTokens into the underlying asset',
//     // 提现参数:钱包地址:钱包地址，描述:钱包地址
//     payloadDescription: {
//       wallet: {
//         type: 'string',
//         description: 'The wallet address that receives the fund redeem from the investment(lending, staking, PoS), only support BNB (a.k.a. BSC) for now.',
//         required: true,
//       },
//       // 链名:BNB (a.k.a. BSC)，描述:只支持BNB (a.k.a. BSC)
//       chain: {
//         type: 'string',
//         description: 'The chain name, only support BNB (a.k.a. BSC) for now.',
//         required: true,
//       },
//       // 提现金额:提现金额，描述:提现金额
//       amount: {
//         type: 'string',
//         description: 'The number of vTokens to withdraw into underlying',
//         required: true,
//       },
//       // 提现资产:提现资产，描述:提现资产
//       asset: {
//         type: 'string',
//         description: 'The token symbol or ticker of underlying asset to withdraw.',
//         required: false,
//       },
//       // 提现资产:提现资产，描述:提现资产
//       token: {
//         type: 'string',
//         description: 'The token symbol or ticker of underlying asset to redeem.',
//         required: false,
//       },
//       // 提现操作:提现操作，描述:提现操作
//       action: {
//         type: 'string',
//         description: 'The action for the calling the venus protocol. Leave blank for redeem.',
//         required: false,
//       }
//     }
//   }, async (ctx: ActionContext, payload: any = {}) => {
//     try {
//       // 提现操作:提现操作，描述:提现操作
//       if (payload.wallet) {
//         payload.wallet = await getTokenAddress(payload.wallet);
//       }
//       payload.action = 'redeem';
//       if (!payload.asset) {
//         payload.asset = payload.token;
//       }
//       const result = await api.createTransaction('venus/v5', ctx, payload);
//       return ctx.result(result);
//     } catch (error) {
//       return ctx.result({ error: `Failed to redeem: ${error}` });
//     }
//   });

//   toolkit.action({
//     // 工具包的名称:借入，借入描述:借入资产到Venus协议，获得底层资产
//     action: 'borrow',
//     actionDescription: 'Borrow a specified amount of tokens from the Venus protocol. Users must provide sufficient collateral and maintain a health factor greater than 1.5. Supported tokens include BNB and other approved tokens on BSC.',
//     payloadDescription: {
//       wallet: {
//         type: 'string',
//         description: 'The wallet address that will receive the borrowed funds. Currently only supports addresses on BSC (BNB Chain).',
//         required: true,
//       },
//       // 链名:BNB (a.k.a. BSC)，描述:只支持BNB (a.k.a. BSC)
//       chain: {
//         type: 'string',
//         description: 'The blockchain network name. Currently only supports BSC (BNB Chain).',
//         required: true,
//       },
//       // 借入金额:借入金额，描述:借入金额
//       amount: {
//         type: 'string',
//         description: 'The amount of tokens to borrow (in base units, e.g., wei for BNB).',
//         required: true,
//       },
//       // 借入资产:借入资产，描述:借入资产
//       asset: {
//         type: 'string',
//         description: 'The identifier of the token to borrow. Can be a token symbol (e.g., "BNB", "USDT"). If not specified, defaults to BNB.',
//         required: false,
//       },
//       // 借入资产:借入资产，描述:借入资产
//       token: {
//         type: 'string',
//         description: 'The identifier of the token to use as collateral. Can be a token symbol or token code. If not specified, will use the default collateral.',
//         required: false,
//       },
//       // 借入操作:借入操作，描述:借入操作
//       action: {
//         type: 'string',
//         description: 'The operation type for the Venus protocol. Should be set to "borrow" for borrowing operations.',
//         required: false,
//       }
//     }
//   }, async (ctx: ActionContext, payload: any = {}) => {
//     try {
//       // 借入操作:借入操作，描述:借入操作
//       if (payload.wallet) {
//         payload.wallet = await getTokenAddress(payload.wallet);
//       }
//       payload.action = 'borrow';
//       if (!payload.asset) {
//         payload.asset = payload.token;
//       }
//       const result = await api.createTransaction('venus/v5', ctx, payload);
//       return ctx.result(result);
//     } catch (error) {
//       return ctx.result({ error: `Failed to borrow: ${error}` });
//     }
//   });

//   toolkit.action({
//     // 工具包的名称:还款，还款描述:还款资产到Venus协议，获得底层资产
//     action: 'repayborrow',
//     actionDescription: 'Repay borrowed tokens to the Venus protocol. This operation reduces the user\'s outstanding debt and improves their health factor. Supports repaying both BNB and other approved tokens on BSC.',
//     payloadDescription: {
//       wallet: {
//         type: 'string',
//         description: 'The wallet address that will repay the borrowed funds. Must be the same address that initially borrowed the tokens. Currently only supports addresses on BSC (BNB Chain).',
//         required: true,
//       },
//       // 链名:BNB (a.k.a. BSC)，描述:只支持BNB (a.k.a. BSC)
//       chain: {
//         type: 'string',
//         description: 'The blockchain network name. Currently only supports BSC (BNB Chain).',
//         required: true,
//       },
//       // 还款金额:还款金额，描述:还款金额
//       amount: {
//         type: 'string',
//         description: 'The amount of tokens to repay (in base units, e.g., wei for BNB). This should not exceed the total borrowed amount plus accrued interest.',
//         required: true,
//       },
//       // 还款资产:还款资产，描述:还款资产
//       asset: {
//         type: 'string',
//         description: 'The identifier of the token to repay. Can be a token symbol (e.g., "BNB", "USDT") or token code. If not specified, defaults to BNB.',
//         required: false,
//       },
//       // 还款资产:还款资产，描述:还款资产
//       token: {
//         type: 'string',
//         description: 'The identifier of the token being repaid. Should match the token that was initially borrowed. Can be a token symbol or token code.',
//         required: false,
//       },
//       // 还款操作:还款操作，描述:还款操作
//       action: {
//         type: 'string',
//         description: 'The operation type for the Venus protocol. Should be set to "repayborrow" for repaying borrowed tokens.',
//         required: false,
//         enum: ['repayborrow']
//       }
//     }
// }, async (ctx: ActionContext, payload: any = {}) => {
//     try {
//       // 还款操作:还款操作，描述:还款操作
//       if (payload.wallet) {
//         payload.wallet = await getTokenAddress(payload.wallet);
//       }
//       // 设置操作类型：还款操作
//       payload.action = 'repayborrow';
//       if (!payload.asset) {
//         payload.asset = payload.token;
//       }
//       const result = await api.createTransaction('venus/v5', ctx, payload);
//       // 返回结果
//       return ctx.result(result);
//     } catch (error) {
//       return ctx.result({ error: `Failed to repayborrow: ${error}` });
//     }
//   });

  await toolkit.run();
};


main().catch(console.error);
