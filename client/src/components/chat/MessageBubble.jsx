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
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'border border-slate-800 bg-slate-900/80 text-slate-100'
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        <p className={`mt-2 text-right text-[10px] ${isUser ? 'text-blue-100' : 'text-slate-500'}`}>
          {formatDate(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
