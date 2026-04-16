import React from 'react';
import StructuredAnswer from './StructuredAnswer';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-blue-600 text-white text-sm py-2 px-4 rounded-xl max-w-[80%] break-words">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full mb-6">
      {message.contextBadge && (
        <span className="self-start text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {message.contextBadge}
        </span>
      )}
      <div className="w-full text-sm text-gray-200">
        {message.structuredAnswer ? (
          <StructuredAnswer answer={message.structuredAnswer} stats={message.retrievalStats} />
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">{message.text}</div>
        )}
      </div>
      {message.structuredAnswer?.follow_up_suggestions?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {message.structuredAnswer.follow_up_suggestions.map((chip, i) => (
            <button
              key={i}
              onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: chip }))}
              className="text-xs bg-gray-900 text-blue-400 border border-gray-800 rounded-full px-3 py-1.5 hover:bg-gray-800 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}