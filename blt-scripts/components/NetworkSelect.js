import { useState, useEffect } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useConnection } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';

const NetworkSelect = ({ onNetworkChange }) => {
  const [selectedNetwork, setSelectedNetwork] = useState(WalletAdapterNetwork.Mainnet);
  const { connection } = useConnection();

  useEffect(() => {
    onNetworkChange(selectedNetwork);
  }, [selectedNetwork, onNetworkChange]);

  const handleNetworkChange = (event) => {
    const network = event.target.value;
    setSelectedNetwork(network);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">网络</label>
      <select
        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        value={selectedNetwork}
        onChange={handleNetworkChange}
      >
        <option value={WalletAdapterNetwork.Devnet}>Devnet</option>
        <option value={WalletAdapterNetwork.Mainnet}>Mainnet</option>
      </select>
      <p className="text-xs text-gray-500 mt-1">
        当前网络: {selectedNetwork === WalletAdapterNetwork.Mainnet ? '主网' : '测试网'}
      </p>
    </div>
  );
};

export default NetworkSelect; 