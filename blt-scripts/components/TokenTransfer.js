import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const TokenTransfer = ({ network }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [accountInfo, setAccountInfo] = useState(null);
  const [formData, setFormData] = useState({
    mintAddress: '',
    recipientAddress: '',
    amount: ''
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
      const pubkey = new PublicKey(address);
      // 特别检查地址是否在ed25519曲线上
      return PublicKey.isOnCurve(pubkey.toBuffer());
    } catch (error) {
      return false;
    }
  };

  // 检查代币余额
  const checkTokenBalance = async () => {
    if (!publicKey || !formData.mintAddress || !isValidSolanaAddress(formData.mintAddress)) {
      return;
    }

    try {
      const mintPublicKey = new PublicKey(formData.mintAddress);
      // 计算当前用户的关联代币账户地址
      const userTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey
      );
      
      try {
        // 尝试获取代币账户信息
        const accountInfo = await getAccount(connection, userTokenAccount);
        setAccountInfo(accountInfo);
        return { exists: true, info: accountInfo };
      } catch (error) {
        console.error('获取账户信息失败:', error);
        setAccountInfo(null);
        return { exists: false, error };
      }
    } catch (error) {
      console.error('检查代币余额时出错:', error);
      setAccountInfo(null);
      return { exists: false, error };
    }
  };

  // 创建接收方的ATA账户（如果不存在）
  const createRecipientATA = async (mintPublicKey, recipientPublicKey) => {
    try {
      // 计算接收方的ATA地址
      const recipientTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientPublicKey
      );
      
      try {
        // 检查接收方ATA是否存在
        await getAccount(connection, recipientTokenAccount);
        // 如果没有错误，说明账户已存在
        return { exists: true, address: recipientTokenAccount };
      } catch (error) {
        // 如果账户不存在，为接收方创建ATA
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey, // 支付账户
            recipientTokenAccount, // 新建的ATA地址
            recipientPublicKey, // 接收方地址
            mintPublicKey // 代币铸造地址
          )
        );
        
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, {
          commitment: 'confirmed',
          maxRetries: 5
        });
        
        return { created: true, address: recipientTokenAccount };
      }
    } catch (error) {
      console.error('创建接收方代币账户时出错:', error);
      throw error;
    }
  };
  
  // 执行转账
  const transferToken = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      setStatus('请先连接钱包');
      return;
    }

    if (!formData.mintAddress || !formData.recipientAddress || !formData.amount) {
      setStatus('请填写所有必填字段');
      return;
    }

    // 严格验证地址格式
    if (!isValidSolanaAddress(formData.mintAddress)) {
      setStatus('错误: 无效的代币Mint地址');
      return;
    }
    
    if (!isValidSolanaAddress(formData.recipientAddress)) {
      setStatus('错误: 无效的接收方地址（地址不在椭圆曲线上）');
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      setStatus('转账金额必须大于0');
      return;
    }

    setLoading(true);
    setStatus('准备转账...');

    try {
      const mintPublicKey = new PublicKey(formData.mintAddress);
      const recipientPublicKey = new PublicKey(formData.recipientAddress);
      
      // 检查发送方代币账户
      const senderAccountResult = await checkTokenBalance();
      if (!senderAccountResult.exists) {
        setStatus('错误: 您没有此代币的关联账户或余额不足');
        setLoading(false);
        return;
      }
      
      // 确保发送方有足够的代币余额
      const tokenDecimals = senderAccountResult.info.mint._decimals || 0;
      const transferAmount = BigInt(Math.floor(parseFloat(formData.amount) * 10 ** tokenDecimals));
      const userTokenBalance = senderAccountResult.info.amount;
      
      if (transferAmount > userTokenBalance) {
        setStatus(`错误: 余额不足。您的余额为 ${Number(userTokenBalance) / (10 ** tokenDecimals)}`);
        setLoading(false);
        return;
      }
      
      // 获取发送方代币账户地址
      const userTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey
      );
      
      setStatus('检查接收方账户...');
      
      // 检查并创建接收方代币账户（如果不存在）
      const recipientAccountResult = await createRecipientATA(mintPublicKey, recipientPublicKey);
      const recipientTokenAccount = recipientAccountResult.address;
      
      if (recipientAccountResult.created) {
        setStatus('已为接收方创建代币账户，准备转账...');
      }
      
      // 创建转账交易
      const transferTransaction = new Transaction().add(
        createTransferInstruction(
          userTokenAccount, // 发送方代币账户
          recipientTokenAccount, // 接收方代币账户
          publicKey, // 发送方钱包（作为代币账户所有者）
          transferAmount, // 转账金额
          [], // 多签账户（如有）
          TOKEN_PROGRAM_ID
        )
      );
      
      // 发送交易
      setStatus('发送转账交易...');
      const signature = await sendTransaction(transferTransaction, connection);
      console.log('转账交易 hash:', signature);
      setStatus(`发送转账交易... 交易 hash: ${signature}`);
      
      // 确认交易
      await connection.confirmTransaction(signature, {
        commitment: 'confirmed',
        maxRetries: 5
      });
      
      setStatus(`成功转账 ${formData.amount} 代币到 ${formData.recipientAddress.substring(0, 6)}...${formData.recipientAddress.substring(formData.recipientAddress.length - 4)}`);
      
      // 重新检查代币余额
      setTimeout(() => checkTokenBalance(), 2000);
      
    } catch (error) {
      console.error('转账时出错:', error);
      
      // 提供更友好的错误消息
      let errorMessage = `错误: ${error.message}`;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = '错误: SOL余额不足以支付交易费用';
      } else if (error.message.includes('0x1')) {
        errorMessage = '错误: 余额不足或账户不存在';
      } else if (error.message.includes('Transaction was not confirmed')) {
        errorMessage = '错误: 交易未被确认，请检查网络状态';
      } else if (error.message.includes('TokenOwnerOffCurveError')) {
        errorMessage = '错误: 接收方地址无效。接收方必须是一个标准的Solana钱包地址，而不是程序派生地址或非曲线上地址。';
      }
      
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 每当代币地址改变时检查余额
  useEffect(() => {
    if (formData.mintAddress && isValidSolanaAddress(formData.mintAddress) && publicKey) {
      checkTokenBalance();
    } else {
      setAccountInfo(null);
    }
  }, [formData.mintAddress, publicKey, connection]);
  
  // 格式化代币余额显示
  const formatTokenBalance = () => {
    if (!accountInfo) return '0';
    
    const decimals = accountInfo.mint._decimals || 0;
    const balance = Number(accountInfo.amount) / (10 ** decimals);
    
    // 处理可能的精度问题
    if (decimals > 0) {
      return balance.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      });
    }
    
    return balance.toString();
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
      <h2 className="text-2xl font-bold mb-6 text-indigo-700">代币转账</h2>
      
      <form onSubmit={transferToken}>
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
          
          {accountInfo && (
            <div className="p-3 bg-green-50 rounded-md">
              <p className="text-sm text-green-700">
                <span className="font-medium">您的余额: </span>
                {formatTokenBalance()}
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              接收方地址 *
            </label>
            <input
              type="text"
              name="recipientAddress"
              value={formData.recipientAddress}
              onChange={handleFormChange}
              placeholder="输入接收方钱包地址"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">接收方的Solana钱包地址</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              转账数量 *
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleFormChange}
              step="any"
              min="0.000000001"
              placeholder="输入转账数量"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">转账的代币数量，考虑代币精度</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-700 mb-2 font-medium">转账说明:</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>如果接收方没有此代币的账户，将会自动为其创建</li>
              <li>创建新账户需要消耗少量SOL作为租金</li>
              <li>转账成功后会立即从您的余额中扣除相应数量的代币</li>
            </ul>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading || !publicKey}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${loading || !publicKey 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
            >
              {!publicKey 
                ? '请先连接钱包' 
                : loading 
                  ? '处理中...' 
                  : '转账'
              }
            </button>
          </div>
        </div>
      </form>
      
      {status && (
        <div className={`mt-6 p-4 rounded-md ${
          status.includes('错误') 
            ? 'bg-red-50 text-red-700' 
            : status.includes('成功') 
              ? 'bg-green-50 text-green-700' 
              : 'bg-blue-50 text-blue-700'
        }`}>
          <p>{status}</p>
        </div>
      )}
      
      {formData.mintAddress && isValidSolanaAddress(formData.mintAddress) && (
        <div className="mt-6 text-center">
          <button
            onClick={() => viewInExplorer(formData.mintAddress)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            在 Solana Explorer 中查看代币
          </button>
        </div>
      )}
    </div>
  );
};

export default TokenTransfer; 