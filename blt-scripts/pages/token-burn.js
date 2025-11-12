import { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import TokenBurn from '../components/TokenBurn';
import NetworkSelect from '../components/NetworkSelect';
import Navigation from '../components/Navigation';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

export default function TokenBurnPage() {
  const { publicKey } = useWallet();
  const [network, setNetwork] = useState(WalletAdapterNetwork.Mainnet);

  const handleNetworkChange = (newNetwork) => {
    setNetwork(newNetwork);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10">
          <h1 className="text-3xl font-bold text-indigo-600 mb-4 md:mb-0">
            代币燃烧
          </h1>
          
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <NetworkSelect onNetworkChange={handleNetworkChange} />
            <WalletMultiButton />
          </div>
        </header>

        <Navigation />

        <main>
          <div className="bg-white overflow-hidden shadow rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                燃烧 Solana 代币
              </h2>
              <p className="text-sm text-gray-500">
                永久销毁您拥有的代币。燃烧操作将从总供应量中移除代币，此操作不可逆转。
                请确保您了解燃烧操作的后果，并仔细检查燃烧数量。
              </p>
            </div>
          </div>

          {!publicKey ? (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    请先连接您的 Solana 钱包来燃烧代币。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <TokenBurn network={network} />
          )}

          {/* 安全提示 */}
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  安全提示
                </h3>
                <div className="mt-2 text-sm text-amber-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>燃烧操作是永久性的，无法撤销或恢复</li>
                    <li>燃烧的代币将从总供应量中永久移除</li>
                    <li>请仔细检查代币地址和燃烧数量</li>
                    <li>建议先在测试网上进行测试</li>
                    <li>确保您有足够的 SOL 来支付交易费用</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-12 py-8 border-t border-gray-200">
          <div className="text-center text-sm text-gray-500">
            <p>Solana 代币创建器 © {new Date().getFullYear()}</p>
            <p className="mt-2">基于 Solana 和 Metaplex 构建</p>
          </div>
        </footer>
      </div>
    </div>
  );
}