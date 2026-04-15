import { useRef } from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme.js';

const THEME_ITEMS = [
  { id: 'light', label: 'Light theme', Icon: Sun },
  { id: 'dark', label: 'Dark theme', Icon: Moon },
  { id: 'system', label: 'System theme', Icon: Laptop },
];

export default function ThemeToggle({ className = '' }) {
  const { mode, setMode } = useTheme();
  const buttonRefs = useRef([]);

  const onKeyDown = (event) => {
    const currentIndex = THEME_ITEMS.findIndex((item) => item.id === mode);
    const total = THEME_ITEMS.length;

    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1 + total) % total;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + total) % total;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = total - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextItem = THEME_ITEMS[nextIndex];
    if (!nextItem) {
      return;
    }

    setMode(nextItem.id);
    requestAnimationFrame(() => {
      buttonRefs.current[nextIndex]?.focus();
    });
  };

  return (
    <div className={`theme-toggle ${className}`} role="radiogroup" aria-label="Theme mode" onKeyDown={onKeyDown}>
      {THEME_ITEMS.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            buttonRefs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={mode === item.id}
          aria-label={item.label}
          tabIndex={mode === item.id ? 0 : -1}
          data-active={mode === item.id}
          onClick={() => setMode(item.id)}
          className="theme-toggle-button"
        >
          <item.Icon size={15} />
        </button>
      ))}
    </div>
  );
}
