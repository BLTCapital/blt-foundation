import { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Connection } from '@solana/web3.js';

// Default styles
require('@solana/wallet-adapter-react-ui/styles.css');

// 自定义 RPC 节点
const CUSTOM_RPC_ENDPOINTS = {
  // [WalletAdapterNetwork.Devnet]: '***',
  [WalletAdapterNetwork.Mainnet]: '***'
};

export const WalletContextProvider = ({ children, initialNetwork = WalletAdapterNetwork.Mainnet }) => {
  const [mounted, setMounted] = useState(false);
  const [network, setNetwork] = useState(initialNetwork);
  console.log('initialNetwork', initialNetwork);
  // 确保组件只在客户端渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听网络变化
  useEffect(() => {
    setNetwork(initialNetwork);
  }, [initialNetwork]);

  // 使用自定义 RPC 节点
  const endpoint = useMemo(() => CUSTOM_RPC_ENDPOINTS[network], [network]);

  // 创建连接
  const connection = useMemo(() => new Connection(endpoint, 'confirmed'), [endpoint]);

  // @solana/wallet-adapter-wallets包含与Solana生态系统兼容的钱包适配器列表
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({ network }),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter({ network })
    ],
    [network]
  );

  if (!mounted) {
    return null;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}; 