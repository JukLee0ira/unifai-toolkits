// Or, if you are using ES6+:
import { LidoSDK } from '@lidofinance/lido-ethereum-sdk';
import * as dotenv from 'dotenv';
// Or, import separate each module separately to save up on bundle size
import { LidoSDKStake } from '@lidofinance/lido-ethereum-sdk/stake';
import { resolve } from 'path';
// Pass your own viem PublicClient

import { createWalletClient, http, createPublicClient, formatEther, Hash, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { holesky } from 'viem/chains';
import { ethers } from 'ethers';
// 确保 dotenv 配置在最开始就加载


const result = dotenv.config({ path: resolve(__dirname, '../../.env') });
// 修改私钥处理方式
const PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY;
const yourHoleskyRpcUrl =process.env.YOUR_HOLESKY_RPC_URL;

// 验证和格式化私钥
function formatPrivateKey(key: string | undefined): `0x${string}` {
    if (!key) {
        throw new Error('私钥未设置');
    }
    
    // 移除可能存在的 '0x' 前缀
    const cleanKey = key.replace('0x', '');
    
    // 验证是否是有效的64位十六进制
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
        throw new Error('无效的私钥格式：需要64位十六进制字符');
    }
    
    return `0x${cleanKey}` as `0x${string}`;
}

async function initLidoSDK(mypk) {
  console.log('你好！初始化sdk...');
  
  // 声明在最外层，这样所有代码块都能访问
  let account;
    const formattedKey = formatPrivateKey(mypk);
    account = privateKeyToAccount(formattedKey);
    
    console.log(`将使用账户: ${account.address}`);
    console.log(`将连接到 RPC: ${yourHoleskyRpcUrl}`);

    // 2. 创建 WalletClient（用于签名交易）
    console.log('正在创建 Viem WalletClient...');
    const walletClient = createWalletClient({
      account,
      chain: holesky,
      transport: http(yourHoleskyRpcUrl)
    });

    // 3. 创建 PublicClient（用于读取操作）
    console.log('正在创建 Viem PublicClient...');
    const publicClient = createPublicClient({
      chain: holesky,
      transport: http(yourHoleskyRpcUrl)
    });

    // 4. 初始化 Lido SDK（使用 WalletClient）
    console.log('正在初始化 Lido SDK...');
    const sdk = new LidoSDK({
      chainId: holesky.id,
      rpcUrls: [yourHoleskyRpcUrl],
      web3Provider: walletClient  // 恢复使用 WalletClient
    });
    console.log('Lido SDK 初始化完成。');
    
    // 添加调试输出，确保返回值正确
    console.log('initLidoSDK 返回值检查:', { 
        sdk: !!sdk, 
        account: !!account, 
        accountAddress: account?.address
    });
    
    return [sdk, account];  // 只返回 sdk 和 account
}
// --- 主函数 ---
// 我们将所有异步操作都放在这个 async 函数中
export async function stake( stakeValueWei, mypk) {
  let sdk, account;  // 恢复原来的变量声明

  try {
    [sdk, account] = await initLidoSDK( mypk);
    
    // 查询余额
    console.log(`正在查询账户 ${account.address} 的 ETH 余额...`);
    const balanceWei = await sdk.core.balanceETH(account.address);
    console.log(`账户的 ETH 余额为: ${formatEther(balanceWei)} ETH`);

    // 准备质押
    console.log(`准备为账户 ${account.address} 质押 ${formatEther(stakeValueWei)} ETH...`);

    const referralAddress = '0x0000000000000000000000000000000000000000';

    const stakeOperationResult = await sdk.stake.stakeEth({
        account: account,
        value: stakeValueWei,
        referralAddress: referralAddress,
    });

    console.log('Lido SDK 处理质押操作完成。');

    // 处理质押结果
    if (stakeOperationResult && stakeOperationResult.result) {
      const { stethReceived, sharesReceived } = stakeOperationResult.result;
      console.log(`模拟将收到的 stETH 数量: ${formatEther(stethReceived)}`);
      console.log(`模拟将收到的份额 (shares) 数量: ${formatEther(sharesReceived)}`);
	  return `将收到的 stETH 数量: ${formatEther(stethReceived)} ，将收到的份额 (shares) 数量: ${formatEther(sharesReceived)}`;
    } else {
      console.log('质押操作模拟未返回明确的 result 字段，请检查 stakeOperationResult 对象:', stakeOperationResult);
	  throw new Error('质押操作模拟未返回明确的 result 字段，请检查 stakeOperationResult 对象');
    }
	

  } catch (error) {
    console.error('在 Lido SDK 操作过程中发生错误:', error);
    
    if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
            console.error(`错误提示：账户 ${account?.address || 'unknown'} 在 Holesky 测试网上的资金可能不足以质押 ${formatEther(stakeValueWei)} ETH 或支付 Gas 费用。`);
        } else if (error.message.includes('NETWORK_ERROR') || error.message.toLowerCase().includes('fetchfailed') || error.message.includes('Failecd to fetch')) {
            console.error(`网络错误：无法连接到 RPC URL (${yourHoleskyRpcUrl})。请检查 URL 是否正确、网络是否通畅，以及 RPC 服务是否正常运行。`);
        } else if (error.message.includes('invalid url')) {
            console.error(`错误提示：提供的 RPC URL (${yourHoleskyRpcUrl}) 无效。请检查其格式。`);
        } else if (error.message.includes('invalid private key')) {
            console.error('错误提示：私钥格式无效。请确保你的私钥是正确的64位十六进制字符串。');
        }
    }
  }
}

/**
 * 批准 Lido 提款队列合约的 stETH 额度。
 * @param sdk Lido SDK 实例。
 * @param ownerAddress 批准额度的所有者地址。
 * @param spenderAddress 接收批准额度的合约地址（通常是 WithdrawalQueue）。
 * @param amountToApprove 要批准的 stETH 数量（BigNumber 格式）。
 * @returns 批准交易的哈希。
 */
async function approveStEthAllowance(
    amountToApprove: bigint,    // 批准金额
    mypk: string                // 私钥
): Promise<string | undefined> {
    try {
        // 确保所有参数都已提供
        if (!yourHoleskyRpcUrl || !amountToApprove || !mypk) {
            throw new Error('缺少必要参数');
        }

        console.log('初始化 ethers provider 和 wallet...');
        
        // 创建 provider
        const provider = new ethers.JsonRpcProvider(yourHoleskyRpcUrl);
        
        // 创建 wallet
        const formattedKey = formatPrivateKey(mypk);
        const wallet = new ethers.Wallet(formattedKey, provider);
        
        console.log(`将使用账户: ${wallet.address}`);

        // stETH 合约地址 (Holesky 测试网)
        const stETH_ADDRESS = '0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034';
        // Withdrawal Queue 合约地址 (Holesky 测试网)  
        const WITHDRAWAL_QUEUE_ADDRESS = '0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50';
        
        // stETH 合约 ABI (只需要 allowance 和 approve 方法)
        const stETH_ABI = [
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)"
        ];

        console.log(`\n--- 检查批准额度 ---`);
        console.log(`stETH 合约地址: ${stETH_ADDRESS}`);
        console.log(`Withdrawal Queue 地址: ${WITHDRAWAL_QUEUE_ADDRESS}`);
        
        // 创建合约实例
        const stETHContract = new ethers.Contract(stETH_ADDRESS, stETH_ABI, wallet);

        // 查询当前批准额度
        console.log(`查询当前批准额度，参数：owner=${wallet.address}, spender=${WITHDRAWAL_QUEUE_ADDRESS}`);
        const currentAllowance = await stETHContract.allowance(wallet.address, WITHDRAWAL_QUEUE_ADDRESS);
        console.log(`当前已批准的额度: ${ethers.formatEther(currentAllowance)} stETH`);

        // 检查是否需要批准
        if (currentAllowance < amountToApprove) {
            console.log('批准的额度不足，正在发送批准交易...');
            
            // 发送批准交易
            const approveTx = await stETHContract.approve(WITHDRAWAL_QUEUE_ADDRESS, amountToApprove);
            console.log(`批准交易哈希: ${approveTx.hash}`);
            
            // 等待交易确认
            console.log('等待交易确认...');
            const receipt = await approveTx.wait();
            console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
            console.log('stETH 额度批准成功！');
            
            return approveTx.hash;
        } else {
            console.log('已批准的额度足够，无需再次批准。');
            return undefined;
        }
    } catch (error) {
        console.error('批准额度时发生错误:', error);
        throw error;
    }
}

/**
 * 执行 stETH 的 unstake 操作。
 * @param rpcUrl 以太坊 RPC URL。
 * @param privateKey 用于签署交易的钱包私钥（警告：请勿在生产环境中直接使用私钥！）。
 * @param amountToUnstake 要 unstake 的 stETH 数量（字符串格式，例如 '1.5'）。
 */
export async function unstakeEth( privateKey, amountToUnstake) {
  let sdk, account; 
  try {

    [sdk, account] = await initLidoSDK( privateKey);

    // 将 unstake 数量转换为 BigNumber
    // const amountToUnstakeWei = parseEther(amountToUnstake);
    // if (amountToUnstakeWei === BigInt(0)) {
    //   throw new Error('Unstake 数量必须大于零。'); // Unstake amount must be greater than zero.
    // }

    console.log(`\n--- 检查钱包余额 ---`);

    // stETH 合约地址 (Holesky 测试网)
    const stETH_ADDRESS = '0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034';
    
    // 创建 provider 和合约实例
    const provider = new ethers.JsonRpcProvider(yourHoleskyRpcUrl);
    const stETH_ABI = [
      "function balanceOf(address account) view returns (uint256)"
    ];
    const stETHContract = new ethers.Contract(stETH_ADDRESS, stETH_ABI, provider);

    // 1. 检查钱包内是否有steth
    const stethBalance = await stETHContract.balanceOf(account.address);
    console.log(`钱包中的 stETH 余额: ${ethers.formatEther(stethBalance)} stETH`);

    if (stethBalance < amountToUnstake) {
      throw new Error(`余额不足以进行 unstake 操作。需要 ${amountToUnstake} stETH，但只有 ${ethers.formatEther(stethBalance)} stETH。`);
    }

    // 获取 unstake 合约地址 (WithdrawalQueue)
    const withdrawalQueueAddress = await sdk.core.getContractAddress('withdrawalQueue');
    console.log(`WithdrawalQueue 合约地址: ${withdrawalQueueAddress}`); // WithdrawalQueue contract address:

    // 2. 检查用户是否批准过对应的额度，如果不足则批准
    //amountToUnstakeWei为最大值，则批准
    await approveStEthAllowance(amountToUnstake, privateKey);

    console.log(`\n--- 提交 unstake 请求 ---`); // --- Submitting unstake request ---

    console.log(`正在提交 unstake 请求，数量: ${ethers.formatEther(amountToUnstake)} stETH...`);

// WithdrawalQueue 合约 ABI 扩展，添加获取等待时间的方法
const WITHDRAWAL_QUEUE_ABI = [
    "function requestWithdrawals(uint256[] amounts, address owner) returns (uint256[] requestIds)",
    "function getLastCheckpointIndex() view returns (uint256)",
    "function calculateExpectedCheckpoint() view returns (uint256 expectedCheckpoint)",
    "function getLastRequestTimestamp() view returns (uint256)"
];

// 创建 wallet 和合约实例
const formattedKey = formatPrivateKey(privateKey);
const wallet = new ethers.Wallet(formattedKey, provider);
const withdrawalQueueContract = new ethers.Contract(withdrawalQueueAddress, WITHDRAWAL_QUEUE_ABI, wallet);

// 调用 requestWithdrawals 方法
const requestTx = await withdrawalQueueContract.requestWithdrawals([amountToUnstake], wallet.address);
console.log(`unstake 交易哈希: ${requestTx.hash}`);
await requestTx.wait();
console.log('unstake 请求已成功提交！');

    console.log(`\n--- 请求成功，获取最新信息 ---`); // --- Request successful, getting latest information ---

    // 4. 请求成功,提醒用户有等待期，当前余额是多少
    const newStethBalance = await stETHContract.balanceOf(account.address);
    console.log(`钱包中的 stETH 余额: ${ethers.formatEther(newStethBalance)} stETH`);

   return `哈希: ${requestTx.hash} 钱包中的 stETH 余额: ${ethers.formatEther(newStethBalance)} stETH`;

  } catch (error: any) {
    console.error(`\n发生错误: ${error.message}`); // An error occurred:
    // 更详细的错误日志
    if (error.code) {
      console.error(`错误代码: ${error.code}`); // Error Code:
    }
    if (error.reason) {
      console.error(`错误原因: ${error.reason}`); // Error Reason:
    }
    if (error.transactionHash) {
      console.error(`交易哈希: ${error.transactionHash}`); // Transaction Hash:
    }
    //TODO: 需要返回错误信息
  }
}


// 2. 你的以太坊账户地址 (Holesky 测试网)
// 这个账户应该在 Holesky 测试网上有一些测试 ETH 用于质押和支付 gas 费
const yourAccountAddress = '0x873C36f9Fd02e0C57a393aFE80D14f244fE04378'; // 例如: '0x1234567890123456789012345678901234567890'

// 3. 想要质押的 ETH 数量
const stakeValueEth = 0.0001; // 例如，质押 0.01 ETH

// 将 ETH 数量转换为 Wei (最小单位)，并确保是 bigint 类型
const stakeValueWei = BigInt(Math.floor(stakeValueEth * 1e18));//这个要做初步的处理，在得到数值之后

const ownerAddress = '0x873C36f9Fd02e0C57a393aFE80D14f244fE04378';
const spenderAddress = '0x0000000000000000000000000000000000000000';
const amountToApprove = BigInt(Math.floor( 0.0001 * 1e18));

// 创建异步主函数
async function main() {
   //approveStEthAllowance
  // try {
  //       // 确保参数都已正确设置
  //       if (!yourHoleskyRpcUrl || !amountToApprove || !PRIVATE_KEY) {
  //           throw new Error('请检查所有必要参数是否已设置');
  //       }

  //       console.log('准备调用 approveStEthAllowance...');
  //       console.log('使用的 RPC URL:', yourHoleskyRpcUrl);
  //       console.log('批准金额:', formatEther(amountToApprove), 'ETH');

  //       const result = await approveStEthAllowance(
  //           yourHoleskyRpcUrl,
  //           amountToApprove,
  //           PRIVATE_KEY
  //       );

  //       if (result) {
  //           console.log('批准交易成功，交易哈希:', result);
  //       }
  //   } catch (error) {
  //       console.error('执行失败:', error);
  //   }
  //unstakeEth
  // --- 配置部分 ---
// 重要提示：请将下面的占位符替换为你的实际数据！

// 1. 你的 Holesky 测试网 RPC URL
// 你可以从 Alchemy, Infura 等服务获取
 // 例如: 'https://holesky.infura.io/v3/YOUR_INFURA_PROJECT_ID'
 const result = await unstakeEth( PRIVATE_KEY, amountToApprove);
 console.log(result);
}

// 执行主函数
main();