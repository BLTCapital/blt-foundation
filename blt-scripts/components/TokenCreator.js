import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { 
  MINT_SIZE, 
  TOKEN_PROGRAM_ID, 
  createInitializeMintInstruction, 
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const TokenCreator = ({ network }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [mintAddress, setMintAddress] = useState('');
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: 'BitDATA Loyalty Token',
    symbol: 'BLT',
    logoUrl: 'https://magenta-worthwhile-barracuda-168.mypinata.cloud/ipfs/bafkreiahr4mvnqtsf3icdzljxyqpckbts2ovjecl7bo6hybwyq4ikdjwhm',
    decimals: 9,
    supply: '',
    isMutable: true,
    disableMinting: true,
    enableFreezing: true,
    authorityAddress: ''
  });

  // 监听网络变化
  useEffect(() => {
    if (network) {
      setStatus(`当前网络: ${network === WalletAdapterNetwork.Mainnet ? '主网' : '测试网'}`);
    }
  }, [network]);

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

  const createToken = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      setStatus('请先连接钱包');
      return;
    }

    if (!formData.name || !formData.symbol || !formData.supply) {
      setStatus('请填写必填字段（名称、符号和总量）');
      return;
    }

    // 验证权限地址（如果提供）
    const authorityAddress = formData.authorityAddress.trim() 
      ? new PublicKey(formData.authorityAddress.trim()) 
      : publicKey;
    
    if (formData.authorityAddress.trim() && !isValidSolanaAddress(formData.authorityAddress)) {
      setStatus('错误: 无效的权限地址格式');
      return;
    }

    setLoading(true);
    setStatus('准备创建代币...');

    try {
      // 创建新的代币铸造账户
      const mintKeypair = Keypair.generate();
      const tokenMintAddress = mintKeypair.publicKey;
      
      // 计算所需的租金豁免金额
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      
      // 获取关联代币账户地址
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMintAddress,
        publicKey
      );
      
      // 创建交易
      const transaction = new Transaction();
      
      // 添加创建铸造账户的指令
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: tokenMintAddress,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          tokenMintAddress,
          Number(formData.decimals),
          authorityAddress,
          formData.enableFreezing ? authorityAddress : null,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedTokenAddress,
          publicKey,
          tokenMintAddress
        ),
        createMintToInstruction(
          tokenMintAddress,
          associatedTokenAddress,
          authorityAddress,
          Number(formData.supply) * (10 ** Number(formData.decimals)),
          [],
          TOKEN_PROGRAM_ID
        )
      );
      
      // 发送交易
      setStatus('发送交易...');
      const signature = await sendTransaction(transaction, connection, {
        signers: [mintKeypair],
      });
      console.log('创建代币交易 hash:', signature);
      setStatus(`发送交易... 交易 hash: ${signature}`);
      
      // 确认交易
      setStatus('等待交易确认...');
      await connection.confirmTransaction(signature, {
        commitment: 'confirmed',
        maxRetries: 5
      });
      console.log('创建代币交易已确认:', signature);
      
      // 添加元数据
      setStatus('添加代币元数据...');
      // 初始化 Metaplex
      const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet));

      // 创建代币元数据
      await metaplex.nfts().createSft({
        uri: formData.logoUrl,
        name: formData.name,
        symbol: formData.symbol,
        sellerFeeBasisPoints: 0,
        isMutable: formData.isMutable,
        useNewMint: mintKeypair,
      });

      // 如果选择禁用铸币权限，则添加授权指令
      if (formData.disableMinting) {
        const disableMintingTx = new Transaction().add(
          createSetAuthorityInstruction(
            tokenMintAddress,
            authorityAddress,
            AuthorityType.MintTokens,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        
        setStatus('禁用铸币权限...');
        const disableMintingSignature = await sendTransaction(disableMintingTx, connection);
        console.log('禁用铸币权限交易 hash:', disableMintingSignature);
        setStatus(`禁用铸币权限交易 hash: ${disableMintingSignature}`);
        
        await connection.confirmTransaction(disableMintingSignature, {
          commitment: 'confirmed',
          maxRetries: 5
        });
        console.log('禁用铸币权限交易已确认:', disableMintingSignature);
      }
      
      setMintAddress(tokenMintAddress.toString());
      setStatus('代币创建成功！');
      
    } catch (error) {
      console.error('创建代币时出错:', error);
      setStatus(`错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const viewInExplorer = () => {
    if (!mintAddress) return;
    
    const baseUrl = network === WalletAdapterNetwork.Mainnet
      ? 'https://explorer.solana.com/address/' 
      : 'https://explorer.solana.com/address/';
    
    const clusterParam = network === WalletAdapterNetwork.Mainnet
      ? ''
      : '?cluster=devnet';
    
    window.open(`${baseUrl}${mintAddress}${clusterParam}`, '_blank');
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-indigo-700">创建 Solana 代币</h2>
      
      <form onSubmit={createToken}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              全称 *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              placeholder="我的代币"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              简称 *
            </label>
            <input
              type="text"
              name="symbol"
              value={formData.symbol}
              onChange={handleFormChange}
              placeholder="TKN"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              maxLength={8}
              required
            />
            <p className="text-xs text-gray-500 mt-1">最多8个字符</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              元数据url
            </label>
            <input
              type="text"
              name="logoUrl"
              value={formData.logoUrl}
              onChange={handleFormChange}
              placeholder="https://magenta-worthwhile-barracuda-168.mypinata.cloud/ipfs/bafkreiahr4mvnqtsf3icdzljxyqpckbts2ovjecl7bo6hybwyq4ikdjwhm"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">如果不提供，将默认使用BLT元数据链接</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              精度
            </label>
            <select
              name="decimals"
              value={formData.decimals}
              onChange={handleFormChange}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">0适用于NFT，9是SOL标准</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              总量 *
            </label>
            <input
              type="number"
              name="supply"
              value={formData.supply}
              onChange={handleFormChange}
              placeholder="1000000"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              min="1"
              required
            />
          </div>
        </div>
        
        <div className="mt-6 space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isMutable"
              id="isMutable"
              checked={formData.isMutable}
              onChange={handleFormChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="isMutable" className="ml-2 block text-sm text-gray-700">
              开启可变数据元（允许更改代币元数据）
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              name="disableMinting"
              id="disableMinting"
              checked={formData.disableMinting}
              onChange={handleFormChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="disableMinting" className="ml-2 block text-sm text-gray-700">
              关闭增发权限（创建后无法铸造更多代币）
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              name="enableFreezing"
              id="enableFreezing"
              checked={formData.enableFreezing}
              onChange={handleFormChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="enableFreezing" className="ml-2 block text-sm text-gray-700">
              开启冻结权限（允许冻结代币账户）
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              权限地址（可选）
            </label>
            <input
              type="text"
              name="authorityAddress"
              value={formData.authorityAddress}
              onChange={handleFormChange}
              placeholder="输入代币权限的所有者地址（留空则使用创建者地址）"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">指定拥有代币铸造、冻结等权限的钱包地址</p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-md">
            <p className="text-sm text-yellow-700 mb-2 font-medium">关于权限地址:</p>
            <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
              <li>此地址将拥有代币的所有权限，包括铸造新代币和冻结账户的权限</li>
              <li>如果留空，创建者钱包地址将成为权限持有者</li>
              <li>请确保指定的地址安全且可信，因为它可以完全控制此代币</li>
              <li>一旦设置，某些权限转移可能需要该地址的签名</li>
            </ul>
          </div>
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
                : '创建代币'
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
      
      {mintAddress && (
        <div className="mt-6 p-4 border border-green-200 rounded-md bg-green-50">
          <h3 className="text-lg font-medium text-green-800 mb-2">代币创建成功！</h3>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Mint 地址:</span>
          </p>
          <p className="text-xs font-mono bg-white p-2 rounded border mb-4 break-all">
            {mintAddress}
          </p>
          
          <button
            onClick={viewInExplorer}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            在 Solana Explorer 中查看
          </button>
        </div>
      )}
    </div>
  );
};

export default TokenCreator; 