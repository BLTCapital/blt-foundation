import '../styles/globals.css';
import { WalletContextProvider } from '../components/WalletContextProvider';
import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// 动态导入 WalletContextProvider，禁用 SSR
const WalletContextProviderWithNoSSR = dynamic(
  () => Promise.resolve(WalletContextProvider),
  { ssr: false }
);

function MyApp({ Component, pageProps }) {
  const [network, setNetwork] = useState(WalletAdapterNetwork.Mainnet);

  const handleNetworkChange = useCallback((newNetwork) => {
    setNetwork(newNetwork);
  }, []);

  return (
    <WalletContextProviderWithNoSSR initialNetwork={network}>
      <Component {...pageProps} network={network} onNetworkChange={handleNetworkChange} />
    </WalletContextProviderWithNoSSR>
  );
}

export default MyApp; 