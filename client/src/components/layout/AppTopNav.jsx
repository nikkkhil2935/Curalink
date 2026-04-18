import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Beaker, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button.jsx';
import { cn } from '@/lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Research', icon: Beaker },
  { to: '/analytics', label: 'Analytics', icon: Activity }
];

export default function AppTopNav({
  className = '',
  borderless = false,
  showNav = true,
  showPrimaryAction = true
}) {
  const navigate = useNavigate();

  return (
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
        </div>
      </div>
    </header>
  );
}
