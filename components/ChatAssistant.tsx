import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AiModel, ModelInfo } from '../types.ts';
import { PaperAirplaneIcon, ChevronDownIcon } from './icons.tsx';

interface ChatAssistantProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  selectedModel: AiModel;
  onModelChange: (model: AiModel) => void;
  models: ModelInfo[];
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ messages, onSendMessage, isLoading, selectedModel, onModelChange, models }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };
  
  const selectedModelInfo = models.find(m => m.id === selectedModel);

  const formatMessage = (content: string) => {
    // Check if content contains code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    return (
      <div className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            // Extract language and code
            const code = part.slice(3, -3);
            const firstNewline = code.indexOf('\n');
            const language = firstNewline > -1 ? code.slice(0, firstNewline).trim() : '';
            const codeContent = firstNewline > -1 ? code.slice(firstNewline + 1) : code;

            return (
              <pre key={index} className="mt-2 mb-2 p-3 bg-black/30 rounded-md overflow-x-auto">
                {language && (
                  <div className="text-xs text-gray-400 mb-1">{language}</div>
                )}
                <code>{codeContent}</code>
              </pre>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="w-96 h-full bg-surface/50 backdrop-blur-md border-l border-white/10 flex flex-col z-10">
      <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="relative">
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full flex items-center justify-between p-2 bg-white/5 rounded-md hover:bg-white/10 transition-colors">
                  <span className="font-semibold">{selectedModelInfo?.name || 'Select Model'}</span>
                  <ChevronDownIcon />
              </button>
              {isDropdownOpen && (
                  <div className="absolute bottom-full mb-2 w-full bg-surface border border-white/10 rounded-md shadow-lg z-20">
                      {models.map(model => (
                          <div key={model.id} onClick={() => { onModelChange(model.id); setIsDropdownOpen(false); }} className="px-4 py-2 hover:bg-primary/50 cursor-pointer">
                              {model.name}
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-2.5 shadow-md ${
                msg.role === 'user'
                  ? 'bg-indigo-500 rounded-br-lg'
                  : msg.isError
                    ? 'bg-red-500/80 rounded-bl-lg'
                    : msg.isAutoFix
                      ? 'bg-amber-500/80 rounded-bl-lg'
                      : 'bg-primary rounded-bl-lg'
              }`}>
              {formatMessage(msg.content)}
              <p className="text-xs text-white/60 text-right mt-1 capitalize">{msg.model}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="max-w-xs md:max-w-sm rounded-2xl px-4 py-2.5 shadow-md bg-primary rounded-bl-lg">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Prompt to file..."
            disabled={isLoading}
            className="flex-1 w-full bg-surface/80 rounded-full py-2.5 px-5 focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="p-3 rounded-full bg-gradient-to-br from-primary to-accent hover:shadow-glow-purple disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <PaperAirplaneIcon />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatAssistant;