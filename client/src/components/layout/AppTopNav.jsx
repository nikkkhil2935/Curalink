import { NavLink, useNavigate } from 'react-router-dom';
<<<<<<< HEAD
import { Activity, FlaskConical, Layers, Server, Plus, Microscope } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle.jsx';
import { cn } from '@/lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Research', icon: Microscope, exact: true },
  { to: '/platform', label: 'Platform', icon: Layers },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/status', label: 'Status', icon: Server },
=======
import { Activity, Beaker, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button.jsx';
import { cn } from '@/lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Research', icon: Beaker },
  { to: '/analytics', label: 'Analytics', icon: Activity }
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
];

export default function AppTopNav({
  className = '',
  borderless = false,
  showNav = true,
  showPrimaryAction = true
}) {
  const navigate = useNavigate();

  return (
<<<<<<< HEAD
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
=======
    <header
      className={cn(
        'sticky top-0 z-40 w-full backdrop-blur-md',
        borderless ? 'border-b border-transparent' : 'border-b token-border',
        'bg-[color-mix(in_srgb,var(--bg-surface)_86%,transparent)]',
        className
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-300 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Open Curalink home"
            className="group flex items-center gap-2 rounded-md border border-transparent px-1 py-1 token-text focus-visible:border-(--accent)"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent) font-bold text-white shadow-sm transition-transform duration-150 ease-out group-hover:scale-105">
              C
            </div>
            <span className="hidden font-semibold tracking-tight token-text sm:block">Curalink</span>
          </button>

          {showNav ? (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
                      'duration-150 ease-out',
                      isActive
                        ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                        : 'border-transparent text-(--text-muted) hover:bg-(--bg-surface-2) hover:text-(--text-primary)'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 opacity-80" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {showPrimaryAction ? (
            <Button
              onClick={() => {
                navigate('/');
              }}
              size="sm"
              variant="primary"
              aria-label="Start a new research session"
              className="hidden gap-2 rounded-lg px-4 text-xs font-semibold tracking-wide sm:inline-flex"
            >
              New Session
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
        </div>
      </div>
    </header>
  );
}
