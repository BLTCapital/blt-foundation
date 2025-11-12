import { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import TokenCreator from '../components/TokenCreator';
import NetworkSelect from '../components/NetworkSelect';
import Navigation from '../components/Navigation';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

export default function Home() {
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
            Solana 代币创建器
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
                创建你自己的 Solana 代币
              </h2>
              <p className="text-sm text-gray-500">
                使用此工具在 Solana 区块链上创建你自己的定制代币。你可以设置代币的全称、简称、精度和总供应量。
                默认情况下，创建的代币开启可变数据元，关闭增发权限，开启冻结权限。
              </p>
            </div>
          </div>

          {!publicKey ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    请先连接你的 Solana 钱包来创建代币。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <TokenCreator network={network} />
          )}
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