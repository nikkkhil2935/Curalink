import { Sparkles, ChevronRight } from 'lucide-react';
import StructuredAnswer from './StructuredAnswer';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div
          className="msg-user max-w-[82%] wrap-break-word"
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full mb-8">
      {/* Context badge */}
      {message.contextBadge && (
        <div
          className="self-start flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-3"
          style={{
            background: 'rgba(59,130,246,0.1)',
            color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.2)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#60a5fa' }}
          />
          {message.contextBadge}
        </div>
      )}

      {/* Answer card */}
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Assistant label */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
          >
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Curalink AI
          </span>
        </div>

        <div className="p-4">
          {message.structuredAnswer ? (
            <StructuredAnswer answer={message.structuredAnswer} stats={message.retrievalStats} />
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {message.text}
            </p>
          )}
        </div>
      </div>

      {/* Follow-up chips */}
      {message.structuredAnswer?.follow_up_suggestions?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pl-1">
          <p
            className="w-full text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Continue exploring
          </p>
          {message.structuredAnswer.follow_up_suggestions.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: chip }))}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                e.currentTarget.style.color = '#60a5fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {chip}
              <ChevronRight className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
