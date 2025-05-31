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


const result = dotenv.config({ path: resolve(__dirname, '../../.env') });

const PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY;
const yourHoleskyRpcUrl = process.env.YOUR_HOLESKY_RPC_URL;

// validate and format private key
function formatPrivateKey(key: string | undefined): `0x${string}` {
  if (!key) {
    throw new Error('私钥未设置');
  }

  // remove possible '0x' prefix
  const cleanKey = key.replace('0x', '');

  // validate if it is a valid 64-bit hexadecimal
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    throw new Error('invalid private key format: need 64-bit hexadecimal');
  }

  return `0x${cleanKey}` as `0x${string}`;
}

async function initLidoSDK(mypk) {
  let account;
  const formattedKey = formatPrivateKey(mypk);
  account = privateKeyToAccount(formattedKey);

  console.log(`will use account: ${account.address}`);
  console.log(`will connect to RPC: ${yourHoleskyRpcUrl}`);

  // create WalletClient (for signing transactions)
  console.log('creating Viem WalletClient...');
  const walletClient = createWalletClient({
    account,
    chain: holesky,
    transport: http(yourHoleskyRpcUrl)
  });

  // create PublicClient (for reading operations)
  console.log('creating Viem PublicClient...');
  const publicClient = createPublicClient({
    chain: holesky,
    transport: http(yourHoleskyRpcUrl)
  });

  // initialize Lido SDK (using WalletClient)
  console.log('initializing Lido SDK...');
  const sdk = new LidoSDK({
    chainId: holesky.id,
    rpcUrls: [yourHoleskyRpcUrl],
    web3Provider: walletClient  // use WalletClient
  });
  console.log('Lido SDK initialized.');

  console.log('initLidoSDK return value check:', {
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

    // query balance
    console.log(`querying ETH balance of account ${account.address}...`);
    const balanceWei = await sdk.core.balanceETH(account.address);
    console.log(`ETH balance of account: ${formatEther(balanceWei)} ETH`);
    if (balanceWei < stakeValueWei) {
      throw new Error('account balance is not enough, cannot stake');
    }

    // prepare to stake
    console.log(`prepare to stake ${formatEther(stakeValueWei)} ETH for account ${account.address}...`);

    const referralAddress = '0x0000000000000000000000000000000000000000';

    const stakeOperationResult = await sdk.stake.stakeEth({
      account: account,
      value: stakeValueWei,
      referralAddress: referralAddress,
    });

    if (!stakeOperationResult || !stakeOperationResult.hash || !stakeOperationResult.result) {
      console.error('stake operation result is not as expected (missing hash or result object):', stakeOperationResult);
      throw new Error('stake operation result is not as expected (missing hash or result object).');
    }

    const txHash = stakeOperationResult.hash; // get tx hash from stakeOperationResult
    console.log(`stake transaction sent, tx hash: ${txHash}, waiting for confirmation...`);

    console.log(`stake transaction confirmed, block number: ${stakeOperationResult.blockNumber}`);

    console.log('Lido SDK processed stake operation.');

    const { stethReceived, sharesReceived } = stakeOperationResult.result;
    console.log(`will receive stETH: ${formatEther(stethReceived)}`);
    console.log(`will receive shares: ${formatEther(sharesReceived)}`);
    console.log(`transaction info: ${stakeOperationResult.result.blockNumber}`);

    return `tx hash: ${txHash}, will receive stETH: ${formatEther(stethReceived)}, will receive shares: ${formatEther(sharesReceived)}`;

  } catch (error) {
    console.error('error during stake operation:', error);
    let errorMessage = `error message: ${error.message}`;
    // try to get tx hash from error object (if exists)
    if (error.transactionHash) {
      errorMessage += `, tx hash: ${error.transactionHash}`;
    } else if (error.cause && error.cause.transactionHash) { // sometimes tx hash is in cause
      errorMessage += `, tx hash: ${error.cause.transactionHash}`;
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
      throw new Error('missing required parameters');
    }

    console.log('initializing ethers provider and wallet...');

    // create provider
    const provider = new ethers.JsonRpcProvider(yourHoleskyRpcUrl);

    // create wallet
    const formattedKey = formatPrivateKey(mypk);
    const wallet = new ethers.Wallet(formattedKey, provider);

    console.log(`will use account: ${wallet.address}`);

    // stETH contract address (Holesky testnet)
    const stETH_ADDRESS = '0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034';
    // Withdrawal Queue contract address (Holesky testnet)  
    const WITHDRAWAL_QUEUE_ADDRESS = '0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50';

    // stETH contract ABI (only allowance and approve methods)
    const stETH_ABI = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ];

    console.log(`\n--- check allowance ---`);
    console.log(`stETH contract address: ${stETH_ADDRESS}`);
    console.log(`Withdrawal Queue address: ${WITHDRAWAL_QUEUE_ADDRESS}`);

    // 创建合约实例
    const stETHContract = new ethers.Contract(stETH_ADDRESS, stETH_ABI, wallet);

    // 查询当前批准额度
    console.log(`query current allowance, parameters: owner=${wallet.address}, spender=${WITHDRAWAL_QUEUE_ADDRESS}`);
    const currentAllowance = await stETHContract.allowance(wallet.address, WITHDRAWAL_QUEUE_ADDRESS);
    console.log(`current allowance: ${ethers.formatEther(currentAllowance)} stETH`);

    // check if allowance is enough
    if (currentAllowance < amountToApprove) {
      console.log('allowance is not enough, sending approve transaction...');

      // send approve transaction
      const approveTx = await stETHContract.approve(WITHDRAWAL_QUEUE_ADDRESS, amountToApprove);
      console.log(`approve transaction hash: ${approveTx.hash}`);

      // wait for transaction confirmation
      console.log('waiting for transaction confirmation...');
      const receipt = await approveTx.wait();
      console.log(`transaction confirmed, block number: ${receipt.blockNumber}`);
      console.log('stETH allowance approved successfully!');

      return approveTx.hash;
    } else {
      console.log('allowance is enough, no need to approve again.');
      return undefined;
    }
  } catch (error) {
    console.error('error during approve allowance:', error);
    throw error;
  }
}

export async function unstakeEth(privateKey, amountToUnstake) {
  let sdk, account;
  try {

    [sdk, account] = await initLidoSDK(privateKey);


    console.log(`\n--- check wallet balance ---`);

    // stETH contract address (Holesky testnet)
    const stETH_ADDRESS = '0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034';

    // create provider and contract instance
    const provider = new ethers.JsonRpcProvider(yourHoleskyRpcUrl);
    const stETH_ABI = [
      "function balanceOf(address account) view returns (uint256)"
    ];
    const stETHContract = new ethers.Contract(stETH_ADDRESS, stETH_ABI, provider);

    // check if wallet has steth
    const stethBalance = await stETHContract.balanceOf(account.address);
    console.log(`stETH balance in wallet: ${ethers.formatEther(stethBalance)} stETH`);

    if (stethBalance < amountToUnstake) {
      throw new Error(`balance is not enough for unstake operation. need ${amountToUnstake} stETH, but only ${ethers.formatEther(stethBalance)} stETH.`);
    }

    // get unstake contract address (WithdrawalQueue)
    const withdrawalQueueAddress = await sdk.core.getContractAddress('withdrawalQueue');
    console.log(`WithdrawalQueue contract address: ${withdrawalQueueAddress}`); // WithdrawalQueue contract address:

    // check if user has approved enough allowance
    await approveStEthAllowance(amountToUnstake, privateKey);

    console.log(`\n--- submit unstake request ---`); // --- Submitting unstake request ---

    console.log(`submitting unstake request, amount: ${ethers.formatEther(amountToUnstake)} stETH...`);

    // WithdrawalQueue contract ABI, add get waiting time method
    const WITHDRAWAL_QUEUE_ABI = [
      "function requestWithdrawals(uint256[] amounts, address owner) returns (uint256[] requestIds)",
      "function getLastCheckpointIndex() view returns (uint256)",
      "function calculateExpectedCheckpoint() view returns (uint256 expectedCheckpoint)",
      "function getLastRequestTimestamp() view returns (uint256)"
    ];

    // create wallet and contract instance
    const formattedKey = formatPrivateKey(privateKey);
    const wallet = new ethers.Wallet(formattedKey, provider);
    const withdrawalQueueContract = new ethers.Contract(withdrawalQueueAddress, WITHDRAWAL_QUEUE_ABI, wallet);

    // call requestWithdrawals method
    const requestTx = await withdrawalQueueContract.requestWithdrawals([amountToUnstake], wallet.address);
    console.log(`unstake transaction hash: ${requestTx.hash}`);
    await requestTx.wait();
    console.log('unstake request submitted successfully!');

    console.log(`\n--- request successful, get latest information ---`);

    // request successful, remind user that there is a waiting period, and the current balance is how much
    const newStethBalance = await stETHContract.balanceOf(account.address);
    console.log(`stETH balance in wallet: ${ethers.formatEther(newStethBalance)} stETH`);

    return `tx hash: ${requestTx.hash} stETH balance in wallet: ${ethers.formatEther(newStethBalance)} stETH`;

  } catch (error: any) {
    console.error(`\nerror occurred: ${error.message}`); // An error occurred:

    return `error message: ${error.message}`;
  }
}
