import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, FlaskConical, Layers, Server, Plus, Microscope } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle.jsx';
import { cn } from '@/lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Research', icon: Microscope, exact: true },
  { to: '/platform', label: 'Platform', icon: Layers },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/status', label: 'Status', icon: Server },
];

export default function AppTopNav({ className = '' }) {
  const navigate = useNavigate();

  return (
    <header className={cn('cl-nav sticky top-0 z-40 w-full', className)}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group flex items-center gap-2.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm shadow-blue-500/30 transition-transform group-hover:scale-105">
              <FlaskConical className="h-4 w-4 text-white" />
            </div>
            <span
              className="hidden sm:block font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Curalink
            </span>
            <span
              className="hidden md:block text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(59,130,246,0.12)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
            >
              AI Research
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  cn('cl-nav-link', isActive && 'active')
                }
              >
                <item.icon className="h-3.5 w-3.5 opacity-75" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="cl-btn-primary hidden sm:inline-flex h-8 px-3 text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Research
          </button>
        </div>
      </div>
    </header>
  );
}
