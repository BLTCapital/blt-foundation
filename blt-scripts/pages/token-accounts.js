import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useState } from 'react';
import TokenCreatorHelper from '../components/TokenCreatorHelper';
import NetworkSelect from '../components/NetworkSelect';
import Navigation from '../components/Navigation';

export default function TokenAccounts() {
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
            Solana 代币账户管理
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
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                代币账户管理
              </h2>
              <p className="text-sm text-gray-500">
                这个工具可以帮助您检查并创建关联代币账户(ATA)。当您想持有或转移某个代币时，
                首先需要为该代币创建一个关联代币账户。如果您无法看到或转移某个代币，很可能是因为
                您或接收方没有对应的关联代币账户。
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
                    请先连接你的 Solana 钱包来管理代币账户。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <TokenCreatorHelper network={network} />
          )}
        </main>

        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-medium text-indigo-700 mb-4">关于关联代币账户(ATA)</h3>
          <div className="text-sm text-indigo-900 space-y-2">
            <p>
              <strong>什么是关联代币账户？</strong> 在Solana上，每种代币都需要一个专门的账户来存储。关联代币账户(ATA)是一种特殊类型的代币账户，它是通过确定性算法从您的钱包地址和代币铸造地址派生出来的。
            </p>
            <p>
              <strong>为什么需要ATA？</strong> 当您想要持有或接收一种新的代币时，您需要先创建对应的ATA。如果您尝试发送代币但收到错误，很可能是因为接收方没有该代币的ATA。
            </p>
            <p>
              <strong>谁来支付创建ATA的费用？</strong> 创建ATA需要支付少量SOL作为存储租金。通常由发送方支付这笔费用。本工具允许您为自己或他人创建ATA。
            </p>
          </div>
        </div>

        <footer className="mt-12 py-8 border-t border-gray-200">
          <div className="text-center text-sm text-gray-500">
            <p>Solana 代币账户管理 © {new Date().getFullYear()}</p>
            <p className="mt-2">基于 Solana 和 SPL-Token 构建</p>
          </div>
        </footer>
      </div>
    </div>
  );
} 