import React from 'react';
import StructuredAnswer from './StructuredAnswer';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  
  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="bg-[#101726] border border-[#24324A] text-gray-200 text-[15px] font-medium py-3 px-5 rounded-2xl max-w-[85%] wrap-break-word shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full mb-10">
      {message.contextBadge && (
        <div className="flex items-center gap-2 self-start text-xs font-semibold text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full uppercase tracking-wider mb-4 border border-blue-900/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          {message.contextBadge}
        </div>
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