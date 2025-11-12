import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navigation() {
  const router = useRouter();

  const navItems = [
    { href: '/', label: '创建代币', icon: '🪙', color: 'indigo' },
    { href: '/token-transfer', label: '代币转账', icon: '💸', color: 'yellow' },
    { href: '/token-burn', label: '代币燃烧', icon: '🔥', color: 'red' },
    { href: '/token-freeze', label: '冻结管理', icon: '❄️', color: 'purple' },
    { href: '/token-accounts', label: '账户管理', icon: '📋', color: 'green' },
    { href: '/transfer-authority', label: '权限转移', icon: '🔑', color: 'blue' },
  ];

  const getColorClasses = (color, isActive) => {
    const colors = {
      indigo: isActive
        ? 'bg-indigo-600 text-white'
        : 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200',
      yellow: isActive
        ? 'bg-yellow-600 text-white'
        : 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200',
      red: isActive
        ? 'bg-red-600 text-white'
        : 'text-red-700 bg-red-100 hover:bg-red-200',
      purple: isActive
        ? 'bg-purple-600 text-white'
        : 'text-purple-700 bg-purple-100 hover:bg-purple-200',
      green: isActive
        ? 'bg-green-600 text-white'
        : 'text-green-700 bg-green-100 hover:bg-green-200',
      blue: isActive
        ? 'bg-blue-600 text-white'
        : 'text-blue-700 bg-blue-100 hover:bg-blue-200',
    };
    return colors[color] || colors.indigo;
  };

  return (
    <nav className="bg-white rounded-lg shadow-md p-4 mb-8">
      <div className="flex flex-wrap gap-2 justify-center">
        {navItems.map((item) => {
          const isActive = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                inline-flex items-center justify-center px-4 py-2
                border border-transparent text-sm font-medium rounded-md
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${item.color}-500
                ${getColorClasses(item.color, isActive)}
              `}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}