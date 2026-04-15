import { NavLink, useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ui/ThemeToggle.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/platform', label: 'Platform' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/status', label: 'Status' }
];

export default function AppTopNav({ className = '' }) {
  const navigate = useNavigate();

  return (
    <header className={`surface-panel sticky top-0 z-40 rounded-2xl px-4 py-3 backdrop-blur ${className}`}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg border border-blue-700/40 bg-blue-950/30 px-3 py-1.5 text-sm font-semibold tracking-wide text-blue-300 transition hover:border-blue-500 hover:text-blue-200"
        >
          Curalink
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition ${
                  isActive
                    ? 'border border-blue-700 bg-blue-950/40 text-blue-300'
                    : 'border border-transparent text-slate-300 hover:border-slate-700 hover:text-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-secondary hidden rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex"
          >
            Start Research
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
