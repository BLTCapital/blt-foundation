import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount
} from '@solana/spl-token';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const TokenCreatorHelper = ({ network }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [formData, setFormData] = useState({
    mintAddress: '',
    targetAddress: ''
  });

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
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  };

  // 检查代币账户状态
  const checkTokenAccount = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      setStatus('请先连接钱包');
      return;
    }

    if (!formData.mintAddress) {
      setStatus('请填写代币的Mint地址');
      return;
    }

    if (!isValidSolanaAddress(formData.mintAddress)) {
      setStatus('无效的Solana地址格式');
      return;
    }

    setLoading(true);
    setStatus('检查代币账户...');
    setTokenInfo(null);

    try {
      const mintPublicKey = new PublicKey(formData.mintAddress);
      // 计算当前用户的关联代币账户地址
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey
      );
      
      try {
        // 尝试获取代币账户信息
        const accountInfo = await getAccount(connection, associatedTokenAddress);
        
        setTokenInfo({
          address: associatedTokenAddress.toString(),
          exists: true,
          amount: accountInfo.amount.toString(),
          owner: accountInfo.owner.toString(),
          mint: accountInfo.mint.toString(),
          delegatedAmount: accountInfo.delegatedAmount ? accountInfo.delegatedAmount.toString() : '0'
        });
        
        setStatus('找到代币账户！');
      } catch (error) {
        console.error('获取账户信息失败:', error);
        setTokenInfo({
          address: associatedTokenAddress.toString(),
          exists: false,
          error: error.message
        });
        setStatus('未找到代币账户。您可以创建一个关联代币账户(ATA)。');
      }
    } catch (error) {
      console.error('检查代币账户时出错:', error);
      setStatus(`错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 创建关联代币账户
  const createATA = async () => {
    if (!publicKey) {
      setStatus('请先连接钱包');
      return;
    }

    if (!formData.mintAddress) {
      setStatus('请填写代币的Mint地址');
      return;
    }

    if (!isValidSolanaAddress(formData.mintAddress)) {
      setStatus('无效的Solana地址格式');
      return;
    }

    setLoading(true);
    setStatus('创建关联代币账户...');

    try {
      const mintPublicKey = new PublicKey(formData.mintAddress);
      // 计算当前用户的关联代币账户地址
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey
      );
      
      // 创建关联代币账户交易
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey, // 支付账户
          associatedTokenAddress, // 新建的ATA地址
          publicKey, // 所有者
          mintPublicKey, // 代币铸造地址
          TOKEN_PROGRAM_ID
        )
      );
      
      // 发送交易
      const signature = await sendTransaction(transaction, connection);
      console.log('创建ATA交易 hash:', signature);
      setStatus(`发送交易... 交易 hash: ${signature}`);
      
      // 确认交易
      await connection.confirmTransaction(signature, {
        commitment: 'confirmed',
        maxRetries: 5
      });
      
      setStatus('关联代币账户创建成功！');
      
      // 更新代币账户信息
      setTimeout(() => checkTokenAccount(new Event('submit')), 2000);
      
    } catch (error) {
      console.error('创建关联代币账户时出错:', error);
      
      // 提供更友好的错误消息
      let errorMessage = `错误: ${error.message}`;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = '错误: 账户SOL余额不足支付交易费用';
      } else if (error.message.includes('account already exists')) {
        errorMessage = '关联代币账户已存在';
        // 重新检查账户信息
        setTimeout(() => checkTokenAccount(new Event('submit')), 1000);
      }
      
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 为目标地址创建关联代币账户
  const createATAForTarget = async () => {
    if (!publicKey) {
      setStatus('请先连接钱包');
      return;
    }

    if (!formData.mintAddress || !formData.targetAddress) {
      setStatus('请填写代币的Mint地址和目标钱包地址');
      return;
    }

    if (!isValidSolanaAddress(formData.mintAddress) || !isValidSolanaAddress(formData.targetAddress)) {
      setStatus('无效的Solana地址格式');
      return;
    }

    setLoading(true);
    setStatus('为目标地址创建关联代币账户...');

    try {
      const mintPublicKey = new PublicKey(formData.mintAddress);
      const targetPublicKey = new PublicKey(formData.targetAddress);
      
      // 计算目标用户的关联代币账户地址
      const targetAssociatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        targetPublicKey
      );
      
      // 创建关联代币账户交易
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey, // 支付账户
          targetAssociatedTokenAddress, // 新建的ATA地址
          targetPublicKey, // 目标地址作为所有者
          mintPublicKey, // 代币铸造地址
          TOKEN_PROGRAM_ID
        )
      );
      
      // 发送交易
      const signature = await sendTransaction(transaction, connection);
      console.log('创建目标ATA交易 hash:', signature);
      setStatus(`发送交易... 交易 hash: ${signature}`);
      
      // 确认交易
      await connection.confirmTransaction(signature, {
        commitment: 'confirmed',
        maxRetries: 5
      });
      
      setStatus(`已成功为地址 ${formData.targetAddress.substring(0, 6)}...${formData.targetAddress.substring(formData.targetAddress.length - 4)} 创建代币账户！`);
      
    } catch (error) {
      console.error('为目标地址创建关联代币账户时出错:', error);
      
      // 提供更友好的错误消息
      let errorMessage = `错误: ${error.message}`;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = '错误: 账户SOL余额不足支付交易费用';
      } else if (error.message.includes('account already exists')) {
        errorMessage = '目标地址的关联代币账户已存在';
      }
      
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const viewInExplorer = (address) => {
    if (!address) return;
    
    const baseUrl = network === WalletAdapterNetwork.Mainnet
      ? 'https://explorer.solana.com/address/' 
      : 'https://explorer.solana.com/address/';
    
    const clusterParam = network === WalletAdapterNetwork.Mainnet
      ? ''
      : '?cluster=devnet';
    
    window.open(`${baseUrl}${address}${clusterParam}`, '_blank');
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-indigo-700">代币账户管理工具</h2>
      
      <form onSubmit={checkTokenAccount} className="mb-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              代币Mint地址 *
            </label>
            <input
              type="text"
              name="mintAddress"
              value={formData.mintAddress}
              onChange={handleFormChange}
              placeholder="输入代币的Mint地址"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">这是创建代币时生成的Mint地址</p>
          </div>
          
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={loading || !publicKey}
              className={`flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${loading || !publicKey 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
            >
              检查代币账户
            </button>
            
            <button
              type="button"
              onClick={createATA}
              disabled={loading || !publicKey}
              className={`flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${loading || !publicKey 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                }`}
            >
              创建我的ATA
            </button>
          </div>
        </div>
      </form>
      
      {tokenInfo && (
        <div className="mb-8 p-4 border rounded-md bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 mb-2">代币账户信息</h3>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">账户地址: </span>
              <span className="font-mono break-all">{tokenInfo.address}</span>
              <button
                onClick={() => viewInExplorer(tokenInfo.address)}
                className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
              >
                查看
              </button>
            </p>
            <p className="text-sm">
              <span className="font-medium">状态: </span>
              {tokenInfo.exists ? (
                <span className="text-green-600">已创建</span>
              ) : (
                <span className="text-red-600">未创建</span>
              )}
            </p>
            {tokenInfo.exists && (
              <>
                <p className="text-sm">
                  <span className="font-medium">余额: </span>
                  {tokenInfo.amount}
                </p>
                <p className="text-sm">
                  <span className="font-medium">所有者: </span>
                  <span className="font-mono">{tokenInfo.owner}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">代币Mint: </span>
                  <span className="font-mono">{tokenInfo.mint}</span>
                </p>
              </>
            )}
            {!tokenInfo.exists && (
              <p className="text-sm text-red-600">{tokenInfo.error}</p>
            )}
          </div>
        </div>
      )}
      
      <div className="border-t border-gray-200 pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">为其他地址创建代币账户</h3>
        <p className="text-sm text-gray-600 mb-4">
          如果您想向他人发送代币，但他们还没有相应的代币账户，您可以为他们创建一个。
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              目标钱包地址
            </label>
            <input
              type="text"
              name="targetAddress"
              value={formData.targetAddress}
              onChange={handleFormChange}
              placeholder="输入目标钱包地址"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <button
            type="button"
            onClick={createATAForTarget}
            disabled={loading || !publicKey || !formData.targetAddress}
            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${loading || !publicKey || !formData.targetAddress
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
          >
            为目标地址创建代币账户
          </button>
        </div>
      </div>
      
      {status && (
        <div className={`mt-6 p-4 rounded-md ${
          status.includes('错误') 
            ? 'bg-red-50 text-red-700' 
            : status.includes('成功') || status.includes('找到')
              ? 'bg-green-50 text-green-700' 
              : 'bg-blue-50 text-blue-700'
        }`}>
          <p>{status}</p>
        </div>
      )}
    </div>
  );
};

export default TokenCreatorHelper; 