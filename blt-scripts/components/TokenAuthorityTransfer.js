import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createSetAuthorityInstruction,
  AuthorityType,
  getAccount
} from '@solana/spl-token';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const TokenAuthorityTransfer = ({ network }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [formData, setFormData] = useState({
    mintAddress: '',
    newAuthority: '',
    authorityType: 'MintTokens',
    revokeAuthority: false
  });

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
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

  const getAuthorityTypeEnum = (type) => {
    switch (type) {
      case 'MintTokens':
        return AuthorityType.MintTokens;
      case 'FreezeAccount':
        return AuthorityType.FreezeAccount;
      case 'UpdateAuthority':
        return 'UpdateAuthority'; // Metaplex 元数据权限
      default:
        return AuthorityType.MintTokens;
    }
  };

  const transferAuthority = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      setStatus('请先连接钱包');
      return;
    }

    if (!formData.mintAddress) {
      setStatus('请填写代币Mint地址');
      return;
    }

    if (!formData.revokeAuthority && !formData.newAuthority) {
      setStatus('请填写新权限地址，或勾选"撤销权限"选项');
      return;
    }

    if (!isValidSolanaAddress(formData.mintAddress)) {
      setStatus('无效的Mint地址格式');
      return;
    }

    if (!formData.revokeAuthority && !isValidSolanaAddress(formData.newAuthority)) {
      setStatus('无效的新权限地址格式');
      return;
    }

    setLoading(true);
    setStatus('准备转移权限...');

    try {
      const mintAddress = new PublicKey(formData.mintAddress);
      const authorityType = getAuthorityTypeEnum(formData.authorityType);

      // 处理元数据更新权限（使用 Metaplex）
      if (authorityType === 'UpdateAuthority') {
        if (formData.revokeAuthority) {
          setStatus('错误: 元数据更新权限不支持撤销操作，只能转移到其他地址');
          setLoading(false);
          return;
        }

        const newAuthorityPublicKey = new PublicKey(formData.newAuthority);

        setStatus('初始化 Metaplex...');
        const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet));

        setStatus('查找代币元数据...');
        // 查找代币的元数据账户
        const nft = await metaplex.nfts().findByMint({ mintAddress });

        setStatus('准备转移元数据更新权限...');

        // 更新元数据的 updateAuthority
        await metaplex.nfts().update({
          nftOrSft: nft,
          updateAuthority: publicKey,
          newUpdateAuthority: newAuthorityPublicKey,
        });

        setStatus('元数据更新权限转移成功！新的更新权限地址: ' + formData.newAuthority.substring(0, 8) + '...');

      } else {
        // 处理 SPL Token 权限（铸币和冻结）
        const newAuthorityPublicKey = formData.revokeAuthority ? null : new PublicKey(formData.newAuthority);

        // 创建转移权限的交易
        const transaction = new Transaction().add(
          createSetAuthorityInstruction(
            mintAddress,
            publicKey,
            authorityType,
            newAuthorityPublicKey,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        // 发送交易
        setStatus('发送交易...');
        const signature = await sendTransaction(transaction, connection);
        console.log('转移权限交易 hash:', signature);
        setStatus(`发送交易... 交易 hash: ${signature}`);

        // 确认交易
        setStatus('等待交易确认...');
        await connection.confirmTransaction(signature, {
          commitment: 'confirmed',
          maxRetries: 5
        });

        if (formData.revokeAuthority) {
          setStatus(`成功撤销${formData.authorityType === 'MintTokens' ? '铸币' : '冻结'}权限！此权限已永久移除。`);
        } else {
          setStatus(`权限转移成功！${formData.authorityType === 'MintTokens' ? '铸币' : '冻结'}权限已转移到新地址。`);
        }
      }
    } catch (error) {
      console.error('转移权限时出错:', error);
      
      // 提供更友好的错误消息
      let errorMessage = `错误: ${error.message}`;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = '错误: 账户SOL余额不足支付交易费用';
      } else if (error.message.includes('owner does not match')) {
        errorMessage = '错误: 您不是此账户的所有者，无权转移所有权';
      } else if (error.message.includes('authority does not match')) {
        errorMessage = '错误: 您不是此代币的权限持有者，无法执行此操作';
      }
      
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const viewInExplorer = () => {
    if (!formData.mintAddress) return;
    
    const baseUrl = network === WalletAdapterNetwork.Mainnet
      ? 'https://explorer.solana.com/address/' 
      : 'https://explorer.solana.com/address/';
    
    const clusterParam = network === WalletAdapterNetwork.Mainnet
      ? ''
      : '?cluster=devnet';
    
    window.open(`${baseUrl}${formData.mintAddress}${clusterParam}`, '_blank');
  };

  const renderAuthorityExplanation = () => {
    switch (formData.authorityType) {
      case 'MintTokens':
        return (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-gray-700">
            <p className="font-medium mb-2 text-blue-800">💎 铸币权限（Mint Authority）</p>
            <p className="mb-2">控制谁可以增发（铸造）更多的代币。</p>
            <ul className="text-xs space-y-1 list-disc list-inside ml-2">
              <li>转移此权限后，只有新地址可以铸造更多代币</li>
              <li>如果撤销此权限，代币总量将被永久锁定，无法增发</li>
              <li>需要使用代币的 <strong>Mint地址</strong>（创建代币时生成的地址）</li>
            </ul>
          </div>
        );
      case 'FreezeAccount':
        return (
          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md text-sm text-gray-700">
            <p className="font-medium mb-2 text-purple-800">❄️ 冻结权限（Freeze Authority）</p>
            <p className="mb-2">控制谁可以冻结或解冻代币账户。</p>
            <ul className="text-xs space-y-1 list-disc list-inside ml-2">
              <li>转移此权限后，只有新地址可以冻结/解冻代币账户</li>
              <li>如果撤销此权限，将无法再冻结任何代币账户</li>
              <li>需要使用代币的 <strong>Mint地址</strong>（创建代币时生成的地址）</li>
            </ul>
          </div>
        );
      case 'UpdateAuthority':
        return (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-gray-700">
            <p className="font-medium mb-2 text-green-800">📝 元数据更新权限（Update Authority）</p>
            <p className="mb-2">控制谁可以更新代币的元数据（名称、符号、图标、描述等）。</p>
            <ul className="text-xs space-y-1 list-disc list-inside ml-2">
              <li>转移此权限后，只有新地址可以更新代币元数据</li>
              <li>此权限<strong>不支持撤销</strong>，只能转移到其他地址</li>
              <li>需要使用代币的 <strong>Mint地址</strong>（创建代币时生成的地址）</li>
              <li>由 Metaplex 程序管理，与 SPL Token 权限独立</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-indigo-700">转移代币权限</h2>
      
      <form onSubmit={transferAuthority}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              权限类型
            </label>
            <select
              name="authorityType"
              value={formData.authorityType}
              onChange={handleFormChange}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="MintTokens">铸币权限（Mint Authority）</option>
              <option value="FreezeAccount">冻结权限（Freeze Authority）</option>
              <option value="UpdateAuthority">元数据更新权限（Update Authority）</option>
            </select>
            {renderAuthorityExplanation()}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              代币 Mint 地址 *
            </label>
            <input
              type="text"
              name="mintAddress"
              value={formData.mintAddress}
              onChange={handleFormChange}
              placeholder="输入代币的Mint地址（创建代币时生成的地址）"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">这是您创建代币时生成的 Mint 地址</p>
          </div>
          
          {formData.authorityType !== 'UpdateAuthority' && (
            <div className="flex items-center p-3 bg-gray-50 rounded-md">
              <input
                type="checkbox"
                name="revokeAuthority"
                id="revokeAuthority"
                checked={formData.revokeAuthority}
                onChange={handleFormChange}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="revokeAuthority" className="ml-2 block text-sm text-gray-900">
                <span className="font-medium">撤销权限</span>
                <span className="text-gray-500 ml-1">（设置为 null，永久移除此权限）</span>
              </label>
            </div>
          )}

          {!formData.revokeAuthority && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                新权限地址 *
              </label>
              <input
                type="text"
                name="newAuthority"
                value={formData.newAuthority}
                onChange={handleFormChange}
                placeholder="输入新的权限持有者钱包地址"
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required={!formData.revokeAuthority}
              />
              <p className="text-xs text-gray-500 mt-1">权限转移后，只有新地址可以行使该权限</p>
            </div>
          )}

          {formData.revokeAuthority && formData.authorityType !== 'UpdateAuthority' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">⚠️ 警告：不可逆操作</h3>
                  <p className="text-sm text-red-700 mt-1">
                    撤销权限后，该权限将<strong>永久移除</strong>，任何人（包括您）都无法再行使此权限。
                    {formData.authorityType === 'MintTokens' && '代币总量将被永久锁定。'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {formData.authorityType === 'UpdateAuthority' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">ℹ️ 提示</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    元数据更新权限不支持撤销操作，只能转移到其他地址。这是 Metaplex 程序的设计限制。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-8">
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
                : '转移权限'
            }
          </button>
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

      {(formData.mintAddress && isValidSolanaAddress(formData.mintAddress)) && (
        <div className="mt-6 text-center">
          <button
            onClick={viewInExplorer}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            在 Solana Explorer 中查看
          </button>
        </div>
      )}
    </div>
  );
};

export default TokenAuthorityTransfer; 