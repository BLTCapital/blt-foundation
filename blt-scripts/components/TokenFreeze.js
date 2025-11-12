import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    createFreezeAccountInstruction,
    createThawAccountInstruction,
    getAccount,
    getAssociatedTokenAddress,
    getMint
} from '@solana/spl-token';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// 格式化金额 (默认保留 4 位小数)
const formatAmount = (amount, decimals) => {
    if (!decimals && decimals !== 0) return Number(amount).toString();
    const divisor = 10 ** decimals;
    return (Number(amount) / divisor).toFixed(4);
};

const TokenFreeze = ({ network }) => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { publicKey, sendTransaction } = wallet;

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [accountInfo, setAccountInfo] = useState(null);
    const [mintInfo, setMintInfo] = useState(null);
    const [formData, setFormData] = useState({
        mintAddress: '',
        tokenAccount: ''
    });

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const isValidSolanaAddress = (address) => {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    };

    // 监听 mint 地址变化，自动读取 freezeAuthority & 详细信息
    useEffect(() => {
        const fetchMintInfo = async () => {
            if (!formData.mintAddress || !isValidSolanaAddress(formData.mintAddress)) {
                setMintInfo(null);
                return;
            }

            try {
                const mintPk = new PublicKey(formData.mintAddress);
                const info = await getMint(connection, mintPk);
                setMintInfo(info);

                if (!info.freezeAuthority) {
                    setStatus("提示: 此代币未设置冻结权限 (freezeAuthority = null)，无法冻结/解冻");
                } else if (publicKey && info.freezeAuthority.toBase58() !== publicKey.toBase58()) {
                    setStatus(`提示: 此代币冻结权限属于 ${info.freezeAuthority.toBase58()}，当前钱包无权操作`);
                } else {
                    setStatus("已检测到代币冻结权限，可以执行操作");
                }
            } catch (error) {
                console.error("获取Mint信息失败:", error);
                setMintInfo(null);
                setStatus("错误: 获取代币Mint信息失败");
            }
        };

        fetchMintInfo();
    }, [formData.mintAddress, connection, publicKey]);

    // 获取正确的代币账户地址（如果用户输入的是钱包地址，就推算 ATA）
    const resolveTokenAccount = async (mintAddress, accountOrOwner) => {
        const mintPk = new PublicKey(mintAddress);
        const pk = new PublicKey(accountOrOwner);

        try {
            await getAccount(connection, pk);
            return pk; // 是 token account
        } catch {
            const ata = await getAssociatedTokenAddress(mintPk, pk);
            return ata;
        }
    };

    // 检查账户状态
    const checkAccountStatus = async () => {
        if (!formData.tokenAccount || !isValidSolanaAddress(formData.tokenAccount)) {
            setStatus("错误: 请输入有效的代币账户/钱包地址");
            return;
        }

        try {
            setStatus("正在检查账户状态...");
            const accountPublicKey = await resolveTokenAccount(formData.mintAddress, formData.tokenAccount);
            const accountInfo = await getAccount(connection, accountPublicKey);

            if (!accountInfo) {
                setStatus("错误: 账户不存在或无法访问");
                return null;
            }

            setAccountInfo(accountInfo);
            setStatus(`账户状态: ${accountInfo.isFrozen ? "已冻结" : "未冻结"}`);
            return accountInfo;
        } catch (error) {
            console.error("获取账户信息失败:", error);
            setStatus(`错误: ${error.message}`);
            setAccountInfo(null);
            return null;
        }
    };

    // 执行冻结/解冻操作
    const toggleFreeze = async (freeze) => {
        if (!publicKey) {
            setStatus("请先连接钱包");
            return;
        }
        if (!formData.mintAddress || !formData.tokenAccount) {
            setStatus("请填写代币Mint地址和代币账户地址");
            return;
        }
        if (!mintInfo) {
            setStatus("错误: 未能获取代币信息");
            return;
        }
        if (!mintInfo.freezeAuthority) {
            setStatus("错误: 此代币未设置冻结权限，无法冻结/解冻");
            return;
        }
        if (mintInfo.freezeAuthority.toBase58() !== publicKey.toBase58()) {
            setStatus("错误: 当前钱包不是该代币的冻结权限地址");
            return;
        }
        if (!isValidSolanaAddress(formData.mintAddress) || !isValidSolanaAddress(formData.tokenAccount)) {
            setStatus("错误: 无效的地址格式");
            return;
        }

        setLoading(true);
        setStatus(freeze ? "准备冻结账户..." : "准备解冻账户...");

        try {
            const mintPublicKey = new PublicKey(formData.mintAddress);
            const tokenAccountPublicKey = await resolveTokenAccount(formData.mintAddress, formData.tokenAccount);
            const transaction = new Transaction();

            if (freeze) {
                transaction.add(
                    createFreezeAccountInstruction(tokenAccountPublicKey, mintPublicKey, publicKey, [], TOKEN_PROGRAM_ID)
                );
            } else {
                transaction.add(
                    createThawAccountInstruction(tokenAccountPublicKey, mintPublicKey, publicKey, [], TOKEN_PROGRAM_ID)
                );
            }

            const signature = await sendTransaction(transaction, connection);
            setStatus(`${freeze ? "冻结" : "解冻"}交易已发送... 交易 hash: ${signature}`);

            await connection.confirmTransaction(signature, { commitment: "confirmed", maxRetries: 5 });
            setStatus(`成功${freeze ? "冻结" : "解冻"}代币账户`);
            setTimeout(() => checkAccountStatus(), 2000);
        } catch (error) {
            console.error(`${freeze ? "冻结" : "解冻"}时出错:`, error);
            let errorMessage = `错误: ${error.message}`;
            if (error.message.includes("insufficient funds")) {
                errorMessage = "错误: SOL余额不足以支付交易费用";
            } else if (error.message.includes("authority does not match")) {
                errorMessage = "错误: 您没有此代币的冻结权限";
            } else if (error.message.includes("Account does not exist")) {
                errorMessage = "错误: 代币账户不存在";
            }
            setStatus(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const viewInExplorer = (address) => {
        if (!address) return;
        const baseUrl = "https://explorer.solana.com/address/";
        const clusterParam = network === WalletAdapterNetwork.Mainnet ? "" : "?cluster=devnet";
        window.open(`${baseUrl}${address}${clusterParam}`, "_blank");
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-indigo-700">代币冻结管理</h2>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">代币Mint地址 *</label>
                    <input
                        type="text"
                        name="mintAddress"
                        value={formData.mintAddress}
                        onChange={handleFormChange}
                        placeholder="输入代币的Mint地址"
                        className="mt-1 block w-full px-3 py-2 border rounded-md"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">代币账户地址 / 用户钱包地址 *</label>
                    <input
                        type="text"
                        name="tokenAccount"
                        value={formData.tokenAccount}
                        onChange={handleFormChange}
                        placeholder="输入要冻结/解冻的代币账户或钱包地址"
                        className="mt-1 block w-full px-3 py-2 border rounded-md"
                    />
                </div>

                <div className="flex space-x-4">
                    <button
                        type="button"
                        onClick={() => checkAccountStatus()}
                        disabled={loading || !formData.tokenAccount}
                        className="flex-1 py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        检查账户状态
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleFreeze(true)}
                        disabled={loading || !publicKey}
                        className="flex-1 py-2 px-4 rounded-md text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
                    >
                        冻结账户
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleFreeze(false)}
                        disabled={loading || !publicKey}
                        className="flex-1 py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                    >
                        解冻账户
                    </button>
                </div>

                {mintInfo && (
                    <div className="p-3 bg-yellow-50 rounded-md space-y-1 text-sm text-yellow-700">
                        <p><span className="font-medium">Decimals: </span>{mintInfo.decimals}</p>
                        <p><span className="font-medium">Supply: </span>{formatAmount(mintInfo.supply, mintInfo.decimals)}</p>
                        <p><span className="font-medium">Mint Authority: </span>{mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : "无"}</p>
                        <p><span className="font-medium">Freeze Authority: </span>{mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : "无 (不支持冻结)"}</p>
                    </div>
                )}

                {accountInfo && (
                    <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-700">
                        <p><span className="font-medium">账户状态: </span>{accountInfo.isFrozen ? "已冻结" : "未冻结"}</p>
                        <p><span className="font-medium">代币余额: </span>{mintInfo ? formatAmount(accountInfo.amount, mintInfo.decimals) : accountInfo.amount.toString()}</p>
                    </div>
                )}

                {status && (
                    <div className={`p-4 rounded-md ${
                        status.includes("错误") ? "bg-red-50 text-red-700" :
                            status.includes("成功") ? "bg-green-50 text-green-700" :
                                "bg-blue-50 text-blue-700"
                    }`}>
                        <p>{status}</p>
                    </div>
                )}

                {(formData.mintAddress && isValidSolanaAddress(formData.mintAddress)) && (
                    <div className="text-center">
                        <button
                            onClick={() => viewInExplorer(formData.mintAddress)}
                            className="px-4 py-2 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        >
                            在 Solana Explorer 中查看代币
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TokenFreeze;
