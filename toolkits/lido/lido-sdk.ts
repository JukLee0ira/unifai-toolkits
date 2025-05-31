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
const yourHoleskyRpcUrl = process.env.YOUR_HOLESKY_RPC_URL;

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

  console.log('initLidoSDK 返回值检查:', {
    sdk: !!sdk,
    account: !!account,
    walletClient: !!walletClient,
    accountAddress: account?.address
  });

  return [sdk, account, walletClient];
}

export async function stake(stakeValueWei, mypk) {
  let sdk, account, walletClient;

  try {
    [sdk, account, walletClient] = await initLidoSDK(mypk);

    // 查询余额
    console.log(`正在查询账户 ${account.address} 的 ETH 余额...`);
    const balanceWei = await sdk.core.balanceETH(account.address);
    console.log(`账户的 ETH 余额为: ${formatEther(balanceWei)} ETH`);
    if (balanceWei < stakeValueWei) {
      throw new Error('账户余额不足，无法进行质押');
    }

    // 准备质押
    console.log(`准备为账户 ${account.address} 质押 ${formatEther(stakeValueWei)} ETH...`);

    const referralAddress = '0x0000000000000000000000000000000000000000';

    const stakeOperationResult = await sdk.stake.stakeEth({
      account: account,
      value: stakeValueWei,
      referralAddress: referralAddress,
    });

    if (!stakeOperationResult || !stakeOperationResult.hash || !stakeOperationResult.result) {
      console.error('质押操作未按预期返回结果（缺少 hash 或 result 对象）:', stakeOperationResult);
      throw new Error('质押操作未返回有效的交易哈希或结果对象。');
    }

    const txHash = stakeOperationResult.hash; // 直接从 stakeOperationResult 获取交易哈希
    console.log(`质押交易已发送，交易哈希: ${txHash}，等待确认...`);

    console.log(`质押交易已确认，区块号: ${stakeOperationResult.blockNumber}`);

    console.log('Lido SDK 处理质押操作完成。');

    const { stethReceived, sharesReceived } = stakeOperationResult.result;
    console.log(`模拟将收到的 stETH 数量: ${formatEther(stethReceived)}`);
    console.log(`模拟将收到的份额 (shares) 数量: ${formatEther(sharesReceived)}`);
    console.log(`交易信息: ${stakeOperationResult.result.blockNumber}`);

    return `交易哈希: ${txHash}，将收到的 stETH 数量: ${formatEther(stethReceived)}，将收到的份额 (shares) 数量: ${formatEther(sharesReceived)}`;

  } catch (error) {
    console.error('在 stake操作过程中发生错误:', error);
    let errorMessage = `错误信息: ${error.message}`;
    // 尝试从错误对象中获取交易哈希（如果存在）
    if (error.transactionHash) {
      errorMessage += `, 交易哈希: ${error.transactionHash}`;
    } else if (error.cause && error.cause.transactionHash) { // 有时交易哈希可能在 cause 中
      errorMessage += `, 交易哈希: ${error.cause.transactionHash}`;
    }
    return errorMessage;
  }
}

async function approveStEthAllowance(
  amountToApprove: bigint,
  mypk: string
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

export async function unstakeEth(privateKey, amountToUnstake) {
  let sdk, account;
  try {

    [sdk, account] = await initLidoSDK(privateKey);


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

    console.log(`\n--- 请求成功，获取最新信息 ---`);

    // 4. 请求成功,提醒用户有等待期，当前余额是多少
    const newStethBalance = await stETHContract.balanceOf(account.address);
    console.log(`钱包中的 stETH 余额: ${ethers.formatEther(newStethBalance)} stETH`);

    return `哈希: ${requestTx.hash} 钱包中的 stETH 余额: ${ethers.formatEther(newStethBalance)} stETH`;

  } catch (error: any) {
    console.error(`\n发生错误: ${error.message}`); // An error occurred:

    return `错误信息: ${error.message}`;
  }
}
