import StructuredAnswer from './StructuredAnswer.jsx';

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="max-w-[85%] rounded-xl rounded-tr-md bg-blue-600 px-4 py-3 text-sm text-white">
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
          <p className="mt-2 text-right text-[10px] text-blue-100">{formatDate(message.createdAt)}</p>
        </div>
      ) : (
        <div className="max-w-full w-full space-y-3">
          {message.contextBadge ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-800 bg-blue-950 px-2 py-0.5 text-xs text-blue-300">
                {message.contextBadge}
              </span>
            </div>
          ) : null}

          {message.structuredAnswer ? (
            <StructuredAnswer answer={message.structuredAnswer} retrievalStats={message.retrievalStats} />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-100">
              <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
            </div>
          )}

          {message.structuredAnswer?.follow_up_suggestions?.length ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Suggested follow-ups</p>
              <div className="flex flex-wrap gap-2">
                {message.structuredAnswer.follow_up_suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion}-${index}`}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: suggestion }))}
                    className="inline-flex min-h-11 items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 transition hover:border-blue-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[10px] text-slate-500">{formatDate(message.createdAt)}</p>
        </div>
      )}
    </div>
  );
}
