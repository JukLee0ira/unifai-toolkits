// 模拟 dotenv 配置
const mockDotenvConfig = jest.fn();
jest.mock('dotenv', () => ({
  config: mockDotenvConfig,
}));

// 模拟 unifai-sdk
const mockCreateTransaction = jest.fn();
const mockToolkitUpdateToolkit = jest.fn();
const mockToolkitEvent = jest.fn();
const mockToolkitRun = jest.fn();
const mockCtxResult = jest.fn((result) => ({ status: 'success', data: result })); // 模拟 ctx.result 返回值

jest.mock('unifai-sdk', () => ({
  Toolkit: jest.fn(() => ({
    updateToolkit: mockToolkitUpdateToolkit,
    event: mockToolkitEvent,
    action: jest.fn((actionConfig, handler) => {
      // 模拟 action 注册，并直接调用 handler 进行测试
      return { actionConfig, handler };
    }),
    run: mockToolkitRun,
  })),
  TransactionAPI: jest.fn(() => ({
    createTransaction: mockCreateTransaction,
  })),
}));

// 模拟 ethers
const mockIsAddress = jest.fn();
jest.mock('ethers', () => ({
  ethers: {
    isAddress: mockIsAddress,
  },
}));

// 模拟 common/tokenaddress
const mockGetTokenAddressBySymbol = jest.fn();
jest.mock('../common/tokenaddress', () => ({
  getTokenAddressBySymbol: mockGetTokenAddressBySymbol,
}));

// 导入要测试的模块 (假设 index.ts 是入口文件)
// 由于 Jest 的模块模拟机制，我们可以在导入之前设置 mock
// 这里我们直接导入并执行 main 函数，以触发 action 的注册
const mainModule = require('./index'); // 假设你的 main 函数在 index.ts 中

describe('Venus Toolkit Actions', () => {
  let toolkitInstance;
  let transactionApiInstance;
  let registeredActions = {}; // 用于存储注册的 action 处理器

  beforeAll(async () => {
    // 重置所有 mock
    mockDotenvConfig.mockClear();
    mockCreateTransaction.mockClear();
    mockToolkitUpdateToolkit.mockClear();
    mockToolkitEvent.mockClear();
    mockToolkitRun.mockClear();
    mockGetTokenAddressBySymbol.mockClear();
    mockIsAddress.mockClear();

    // 重新实例化 Toolkit 和 TransactionAPI，因为它们是单例模式
    const { Toolkit, TransactionAPI } = require('unifai-sdk');
    toolkitInstance = new Toolkit({ apiKey: 'mock-api-key' });
    transactionApiInstance = new TransactionAPI({ apiKey: 'mock-api-key', endpoint: 'mock-endpoint' });

    // 捕获 toolkit.action 的调用，以便我们可以测试其处理函数
    toolkitInstance.action = jest.fn((config, handler) => {
      registeredActions[config.action] = handler;
    });

    // 调用 main 函数来注册 actions
    await mainModule.main();
  });

  // Helper function to create a mock context
  const createContext = () => ({
    result: mockCtxResult,
    // Add other context properties if needed
  });

  // Test for 'invest' action
  describe('invest action', () => {
    test('should create an invest transaction successfully with asset symbol', async () => {
      const ctx = createContext();
      const payload = {
        chain: 'BNB',
        amount: '100',
        asset: 'USDT',
      };

      // 模拟 getTokenAddressBySymbol 返回 USDT 的地址
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0x12345...USDT');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'tx123', status: 'pending' });

      // 调用注册的 action handler
      const result = await registeredActions.invest(ctx, payload);

      // 验证 mock 函数是否被正确调用
      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('USDT', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'invest',
          chain: 'BNB',
          amount: '100',
          asset: '0x12345...USDT', // 验证 asset 是否被转换为地址
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'tx123', status: 'pending' });
      expect(result).toEqual({ status: 'success', data: { txId: 'tx123', status: 'pending' } });
    });

    test('should create an invest transaction successfully with native BNB (empty asset)', async () => {
      const ctx = createContext();
      const payload = {
        chain: 'BNB',
        amount: '0.5',
        asset: '', // 空资产表示原生 BNB
      };

      // 对于空资产，getTokenAddressBySymbol 不会被调用，或者返回原始值
      mockGetTokenAddressBySymbol.mockResolvedValueOnce(''); // 模拟返回空字符串
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'tx456', status: 'pending' });

      const result = await registeredActions.invest(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('', 'bnb'); // 仍然会尝试获取，但返回空
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'invest',
          chain: 'BNB',
          amount: '0.5',
          asset: '', // 验证 asset 保持为空
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'tx456', status: 'pending' });
      expect(result).toEqual({ status: 'success', data: { txId: 'tx456', status: 'pending' } });
    });

    test('should return error if transaction creation fails', async () => {
      const ctx = createContext();
      const payload = {
        chain: 'BNB',
        amount: '10',
        asset: 'DAI',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0x67890...DAI');
      mockCreateTransaction.mockRejectedValueOnce(new Error('Network error'));

      const result = await registeredActions.invest(ctx, payload);

      expect(mockCtxResult).toHaveBeenCalledWith({ error: 'Failed to create transaction: Error: Network error' });
      expect(result).toEqual({ status: 'success', data: { error: 'Failed to create transaction: Error: Network error' } });
    });
  });

  // Test for 'supply' action
  describe('supply action', () => {
    test('should create a supply transaction successfully with asset symbol', async () => {
      const ctx = createContext();
      const payload = {
        chain: 'BNB',
        amount: '50',
        asset: 'BUSD',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xabcde...BUSD');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'tx789', status: 'completed' });

      const result = await registeredActions.supply(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('BUSD', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'supply',
          chain: 'BNB',
          amount: '50',
          asset: '0xabcde...BUSD',
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'tx789', status: 'completed' });
      expect(result).toEqual({ status: 'success', data: { txId: 'tx789', status: 'completed' } });
    });

    test('should return error if supply transaction fails', async () => {
      const ctx = createContext();
      const payload = {
        chain: 'BNB',
        amount: '10',
        asset: 'CAKE',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xfedcba...CAKE');
      mockCreateTransaction.mockRejectedValueOnce(new Error('Insufficient funds'));

      const result = await registeredActions.supply(ctx, payload);

      expect(mockCtxResult).toHaveBeenCalledWith({ error: 'Failed to create transaction: Error: Insufficient funds' });
      expect(result).toEqual({ status: 'success', data: { error: 'Failed to create transaction: Error: Insufficient funds' } });
    });
  });

  // Test for 'redeem' action
  describe('redeem action', () => {
    test('should create a redeem transaction successfully with asset symbol and wallet address', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xUserWalletAddress',
        chain: 'BNB',
        amount: '10',
        asset: 'USDT',
      };

      // 模拟 getTokenAddress 返回钱包地址和 USDT 地址
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xUserWalletAddress'); // for wallet
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0x12345...USDT'); // for asset
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txRedeem1', status: 'success' });

      const result = await registeredActions.redeem(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('0xUserWalletAddress', 'bnb'); // 验证钱包地址也被处理
      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('USDT', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'redeem',
          wallet: '0xUserWalletAddress',
          chain: 'BNB',
          amount: '10',
          asset: '0x12345...USDT',
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'txRedeem1', status: 'success' });
      expect(result).toEqual({ status: 'success', data: { txId: 'txRedeem1', status: 'success' } });
    });

    test('should use "token" as fallback for "asset" in redeem action', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xUserWalletAddress',
        chain: 'BNB',
        amount: '5',
        token: 'DAI', // 使用 token 字段
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xUserWalletAddress'); // for wallet
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xabcde...DAI'); // for token (as asset)
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txRedeem2', status: 'success' });

      const result = await registeredActions.redeem(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('DAI', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'redeem',
          wallet: '0xUserWalletAddress',
          chain: 'BNB',
          amount: '5',
          asset: '0xabcde...DAI', // 验证 asset 被设置为 token 的值
          token: 'DAI',
        }
      );
      expect(result).toEqual({ status: 'success', data: { txId: 'txRedeem2', status: 'success' } });
    });

    test('should return error if redeem transaction fails', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xUserWalletAddress',
        chain: 'BNB',
        amount: '1',
        asset: 'ETH',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xUserWalletAddress');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      mockCreateTransaction.mockRejectedValueOnce(new Error('Redemption failed'));

      const result = await registeredActions.redeem(ctx, payload);

      expect(mockCtxResult).toHaveBeenCalledWith({ error: 'Failed to redeem: Error: Redemption failed' });
      expect(result).toEqual({ status: 'success', data: { error: 'Failed to redeem: Error: Redemption failed' } });
    });
  });

  // Test for 'withdraw' action
  describe('withdraw action', () => {
    test('should create a withdraw transaction successfully with asset symbol and wallet address', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xAnotherWalletAddress',
        chain: 'BNB',
        amount: '20',
        asset: 'BTCB',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xAnotherWalletAddress');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xbbbbbb...BTCB');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txWithdraw1', status: 'success' });

      const result = await registeredActions.withdraw(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('0xAnotherWalletAddress', 'bnb');
      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('BTCB', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'redeem', // withdraw 内部实际调用 redeem
          wallet: '0xAnotherWalletAddress',
          chain: 'BNB',
          amount: '20',
          asset: '0xbbbbbb...BTCB',
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'txWithdraw1', status: 'success' });
      expect(result).toEqual({ status: 'success', data: { txId: 'txWithdraw1', status: 'success' } });
    });

    test('should use "token" as fallback for "asset" in withdraw action', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xAnotherWalletAddress',
        chain: 'BNB',
        amount: '15',
        token: 'XVS', // 使用 token 字段
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xAnotherWalletAddress');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xcccccc...XVS');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txWithdraw2', status: 'success' });

      const result = await registeredActions.withdraw(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('XVS', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'redeem', // withdraw 内部实际调用 redeem
          wallet: '0xAnotherWalletAddress',
          chain: 'BNB',
          amount: '15',
          asset: '0xcccccc...XVS',
          token: 'XVS',
        }
      );
      expect(result).toEqual({ status: 'success', data: { txId: 'txWithdraw2', status: 'success' } });
    });

    test('should return error if withdraw transaction fails', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xAnotherWalletAddress',
        chain: 'BNB',
        amount: '2',
        asset: 'LINK',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xAnotherWalletAddress');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xdddddd...LINK');
      mockCreateTransaction.mockRejectedValueOnce(new Error('Withdrawal failed'));

      const result = await registeredActions.withdraw(ctx, payload);

      expect(mockCtxResult).toHaveBeenCalledWith({ error: 'Failed to redeem: Error: Withdrawal failed' });
      expect(result).toEqual({ status: 'success', data: { error: 'Failed to redeem: Error: Withdrawal failed' } });
    });
  });

  // Test for 'borrow' action
  describe('borrow action', () => {
    test('should create a borrow transaction successfully with asset symbol', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xBorrowerWallet',
        chain: 'BNB',
        amount: '500',
        asset: 'USDC',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xBorrowerWallet');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xeeeeee...USDC');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txBorrow1', status: 'pending' });

      const result = await registeredActions.borrow(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('0xBorrowerWallet', 'bnb');
      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('USDC', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'borrow',
          wallet: '0xBorrowerWallet',
          chain: 'BNB',
          amount: '500',
          asset: '0xeeeeee...USDC',
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'txBorrow1', status: 'pending' });
      expect(result).toEqual({ status: 'success', data: { txId: 'txBorrow1', status: 'pending' } });
    });

    test('should use "token" as fallback for "asset" in borrow action', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xBorrowerWallet',
        chain: 'BNB',
        amount: '1',
        token: 'BNB', // 使用 token 字段
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xBorrowerWallet');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txBorrow2', status: 'pending' });

      const result = await registeredActions.borrow(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('BNB', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'borrow',
          wallet: '0xBorrowerWallet',
          chain: 'BNB',
          amount: '1',
          asset: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          token: 'BNB',
        }
      );
      expect(result).toEqual({ status: 'success', data: { txId: 'txBorrow2', status: 'pending' } });
    });

    test('should return error if borrow transaction fails', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xBorrowerWallet',
        chain: 'BNB',
        amount: '10000',
        asset: 'BUSD',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xBorrowerWallet');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xabcde...BUSD');
      mockCreateTransaction.mockRejectedValueOnce(new Error('Borrow limit exceeded'));

      const result = await registeredActions.borrow(ctx, payload);

      expect(mockCtxResult).toHaveBeenCalledWith({ error: 'Failed to borrow: Error: Borrow limit exceeded' });
      expect(result).toEqual({ status: 'success', data: { error: 'Failed to borrow: Error: Borrow limit exceeded' } });
    });
  });

  // Test for 'repayborrow' action
  describe('repayborrow action', () => {
    test('should create a repayborrow transaction successfully with asset symbol', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xRepayerWallet',
        chain: 'BNB',
        amount: '250',
        asset: 'USDT',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xRepayerWallet');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0x12345...USDT');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txRepay1', status: 'completed' });

      const result = await registeredActions.repayborrow(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('0xRepayerWallet', 'bnb');
      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('USDT', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'repayborrow',
          wallet: '0xRepayerWallet',
          chain: 'BNB',
          amount: '250',
          asset: '0x12345...USDT',
        }
      );
      expect(mockCtxResult).toHaveBeenCalledWith({ txId: 'txRepay1', status: 'completed' });
      expect(result).toEqual({ status: 'success', data: { txId: 'txRepay1', status: 'completed' } });
    });

    test('should use "token" as fallback for "asset" in repayborrow action', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xRepayerWallet',
        chain: 'BNB',
        amount: '0.1',
        token: 'BNB', // 使用 token 字段
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xRepayerWallet');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      mockCreateTransaction.mockResolvedValueOnce({ txId: 'txRepay2', status: 'completed' });

      const result = await registeredActions.repayborrow(ctx, payload);

      expect(mockGetTokenAddressBySymbol).toHaveBeenCalledWith('BNB', 'bnb');
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'venus/v5',
        ctx,
        {
          action: 'repayborrow',
          wallet: '0xRepayerWallet',
          chain: 'BNB',
          amount: '0.1',
          asset: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          token: 'BNB',
        }
      );
      expect(result).toEqual({ status: 'success', data: { txId: 'txRepay2', status: 'completed' } });
    });

    test('should return error if repayborrow transaction fails', async () => {
      const ctx = createContext();
      const payload = {
        wallet: '0xRepayerWallet',
        chain: 'BNB',
        amount: '5000',
        asset: 'DAI',
      };

      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0xRepayerWallet');
      mockGetTokenAddressBySymbol.mockResolvedValueOnce('0x67890...DAI');
      mockCreateTransaction.mockRejectedValueOnce(new Error('Repay failed'));

      const result = await registeredActions.repayborrow(ctx, payload);

      expect(mockCtxResult).toHaveBeenCalledWith({ error: 'Failed to repayborrow: Error: Repay failed' });
      expect(result).toEqual({ status: 'success', data: { error: 'Failed to repayborrow: Error: Repay failed' } });
    });
  });
});
