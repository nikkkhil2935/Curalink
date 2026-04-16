import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Beaker, FileText, Database, Layers, ArrowRight,  } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle.jsx';
import Button from '@/components/ui/Button.jsx';
import { cn } from '@/lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Research', icon: Beaker },
  { to: '/platform', label: 'Platform', icon: Layers },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/status', label: 'Status', icon: Database }
];

export default function AppTopNav({ className = '' }) {
  const navigate = useNavigate();

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b border-[#24324a] bg-[#101726]/80 backdrop-blur-md", className)}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm transition-transform group-hover:scale-105">
              C
            </div>
            <span className="font-bold tracking-tight text-white hidden sm:block">Curalink</span>
          </button>

          <nav className="hidden md:flex items-center space-x-1" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#1a263a] text-blue-400 border border-[#24324a]"
                      : "text-[#c6d3eb] hover:bg-[#131d2d] hover:text-white border border-transparent"
                  )
                }
              >
                <item.icon className="h-4 w-4 opacity-70" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            onClick={() => { navigate('/'); }}
            size="sm"
            variant="primary"
            className="hidden sm:inline-flex shadow-sm bg-blue-600 hover:bg-blue-500 text-white gap-2 flex-row rounded-md h-9 px-4 text-xs font-semibold tracking-wide border-none"
          >
            New Session
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
