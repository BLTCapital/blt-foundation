import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createBurnInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
} from '@solana/spl-token';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const TokenBurn = ({ network }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [burnHistory, setBurnHistory] = useState([]);
  const [formData, setFormData] = useState({
    mintAddress: '',
    amount: ''
  });

  // 从本地存储加载燃烧历史记录
  useEffect(() => {
    const savedHistory = localStorage.getItem('tokenBurnHistory');
    if (savedHistory) {
      setBurnHistory(JSON.parse(savedHistory));
    }
  }, []);

  // 保存燃烧记录到本地存储
  const saveBurnRecord = (record) => {
    const newHistory = [record, ...burnHistory].slice(0, 50); // 只保留最近50条记录
    setBurnHistory(newHistory);
    localStorage.setItem('tokenBurnHistory', JSON.stringify(newHistory));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // 验证Solana地址格式
  const isValidSolanaAddress = (address) => {
    try {
      const pubkey = new PublicKey(address);
      return PublicKey.isOnCurve(pubkey.toBuffer());
    } catch (error) {
      return false;
    }
  };

  // 验证燃烧数量
  const validateBurnAmount = (amount, balance, decimals) => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return { valid: false, message: '请输入有效的燃烧数量' };
    }

    const burnAmount = parseFloat(amount);
    const maxBurnAmount = balance / Math.pow(10, decimals);

    if (burnAmount > maxBurnAmount) {
      return { 
        valid: false, 
        message: `燃烧数量不能超过余额 ${maxBurnAmount.toFixed(decimals)}` 
      };
    }

    return { valid: true, message: '' };
  };

  // 获取代币信息和余额
  const getTokenInfo = async () => {
    if (!formData.mintAddress || !publicKey) return;

    try {
      setLoading(true);
      setStatus('正在获取代币信息...');

      // 验证mint地址
      if (!isValidSolanaAddress(formData.mintAddress)) {
        throw new Error('无效的代币地址格式');
      }

      const mintPubkey = new PublicKey(formData.mintAddress);
      
      // 获取mint信息
      const mintInfo = await getMint(connection, mintPubkey);
      
      // 获取用户的关联代币账户地址
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPubkey,
        publicKey
      );

      // 获取代币账户信息
      let tokenAccount;
      try {
        tokenAccount = await getAccount(connection, associatedTokenAddress);
      } catch (error) {
        throw new Error('您没有此代币的账户或余额为0');
      }

      const tokenInfo = {
        mint: mintPubkey.toString(),
        decimals: mintInfo.decimals,
        supply: mintInfo.supply.toString(),
        balance: tokenAccount.amount.toString(),
        tokenAccount: associatedTokenAddress.toString()
      };

      setTokenInfo(tokenInfo);
      setStatus(`代币信息获取成功。余额: ${(Number(tokenInfo.balance) / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals)}`);
    } catch (error) {
      console.error('获取代币信息失败:', error);
      setStatus(`错误: ${error.message}`);
      setTokenInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // 执行代币燃烧
  const burnTokens = async () => {
    if (!publicKey || !tokenInfo) {
      setStatus('请先连接钱包并获取代币信息');
      return;
    }

    try {
      setLoading(true);
      setStatus('正在准备燃烧交易...');

      // 验证燃烧数量
      const validation = validateBurnAmount(
        formData.amount, 
        Number(tokenInfo.balance), 
        tokenInfo.decimals
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      const burnAmount = Math.floor(parseFloat(formData.amount) * Math.pow(10, tokenInfo.decimals));
      
      if (burnAmount <= 0) {
        throw new Error('燃烧数量必须大于0');
      }

      // 创建燃烧指令
      const mintPubkey = new PublicKey(tokenInfo.mint);
      const tokenAccountPubkey = new PublicKey(tokenInfo.tokenAccount);

      const burnInstruction = createBurnInstruction(
        tokenAccountPubkey,  // 代币账户
        mintPubkey,          // mint地址
        publicKey,           // 账户所有者
        burnAmount,          // 燃烧数量
        [],                  // 多重签名者（如果需要）
        TOKEN_PROGRAM_ID     // 代币程序ID
      );

      // 创建交易
      const transaction = new Transaction().add(burnInstruction);
      
      // 获取最新的区块哈希
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setStatus('请在钱包中确认燃烧交易...');

      // 发送交易
      const signature = await sendTransaction(transaction, connection);
      
      setStatus('正在确认交易...');

      // 等待交易确认
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error('交易失败: ' + confirmation.value.err.toString());
      }

      // 保存燃烧记录
      const burnRecord = {
        signature,
        mintAddress: tokenInfo.mint,
        amount: formData.amount,
        burnAmountRaw: burnAmount.toString(),
        decimals: tokenInfo.decimals,
        timestamp: new Date().toISOString(),
        network: network === WalletAdapterNetwork.Mainnet ? 'mainnet' : 'devnet',
        status: 'confirmed'
      };

      saveBurnRecord(burnRecord);

      setStatus(`燃烧成功! 交易签名: ${signature}`);
      
      // 重新获取代币信息以更新余额
      setTimeout(() => {
        getTokenInfo();
      }, 2000);

      // 清空表单
      setFormData(prev => ({ ...prev, amount: '' }));

    } catch (error) {
      console.error('燃烧代币失败:', error);
      setStatus(`燃烧失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 获取交易链接
  const getExplorerUrl = (signature, network) => {
    const baseUrl = network === 'mainnet' 
      ? 'https://explorer.solana.com/tx/' 
      : 'https://explorer.solana.com/tx/';
    const cluster = network === 'mainnet' ? '' : '?cluster=devnet';
    return `${baseUrl}${signature}${cluster}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">代币燃烧</h2>
        <p className="text-gray-600">
          永久销毁您拥有的代币。燃烧的代币将从总供应量中移除，无法恢复。
        </p>
      </div>

      {/* 代币信息输入 */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">代币信息</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              代币地址 (Mint Address)
            </label>
            <input
              type="text"
              name="mintAddress"
              value={formData.mintAddress}
              onChange={handleFormChange}
              placeholder="输入代币的mint地址"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={getTokenInfo}
              disabled={loading || !formData.mintAddress}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '获取中...' : '获取代币信息'}
            </button>
          </div>
        </div>

        {tokenInfo && (
          <div className="mt-4 p-4 bg-white rounded-md border">
            <h4 className="font-medium text-gray-900 mb-2">代币详情</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">精度:</span>
                <span className="ml-2 font-mono">{tokenInfo.decimals}</span>
              </div>
              <div>
                <span className="text-gray-600">余额:</span>
                <span className="ml-2 font-mono text-green-600">
                  {(Number(tokenInfo.balance) / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 燃烧操作 */}
      {tokenInfo && (
        <div className="mb-8 p-6 bg-red-50 rounded-lg border border-red-200">
          <h3 className="text-lg font-semibold text-red-900 mb-4">燃烧代币</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-red-700 mb-2">
              燃烧数量
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleFormChange}
              placeholder="输入要燃烧的代币数量"
              step="any"
              min="0"
              className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-red-600">
              最大可燃烧: {(Number(tokenInfo.balance) / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals)}
            </p>
          </div>

          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">警告</h4>
                <p className="text-sm text-red-700">
                  燃烧操作是不可逆的！燃烧的代币将永久从流通中移除，无法恢复。请确认您要燃烧的数量。
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={burnTokens}
            disabled={loading || !formData.amount || !tokenInfo}
            className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '燃烧中...' : '确认燃烧代币'}
          </button>
        </div>
      )}

      {/* 状态显示 */}
      {status && (
        <div className={`mb-6 p-4 rounded-md ${
          status.includes('错误') || status.includes('失败') 
            ? 'bg-red-50 border border-red-200 text-red-700'
            : status.includes('成功')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          <p className="text-sm">{status}</p>
        </div>
      )}

      {/* 燃烧历史记录 */}
      {burnHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">燃烧历史记录</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    代币地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    燃烧数量
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    网络
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    交易
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {burnHistory.slice(0, 10).map((record, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(record.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {record.mintAddress.slice(0, 8)}...{record.mintAddress.slice(-8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        record.network === 'mainnet' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.network === 'mainnet' ? '主网' : '测试网'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      <a
                        href={getExplorerUrl(record.signature, record.network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-800"
                      >
                        查看交易
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenBurn;