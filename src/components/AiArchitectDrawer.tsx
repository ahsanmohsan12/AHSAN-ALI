/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Multi-Turn Gemini Production Architect Chatbot Drawer
 * Supports gemini-4-argon (with ThinkingLevel.HIGH), gemini-3.8-flash, and gemini-3.1-flash-lite.
 */

import React, { useState } from 'react';
import { MessageSquare, X, Send, Cpu } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  thinkingLevel?: string;
}

export const AiArchitectDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [model, setModel] = useState<'gemini-4-argon' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite'>(
    'gemini-4-argon'
  );
  const [highThinking, setHighThinking] = useState(true);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Welcome to ViralMint AI Production Architect. Ask me to analyze long-form hooks, optimize FFmpeg 9:16 reframing filters, inspect Colab Tesla T4 checkpoints, or review YouTube Unlisted compliance.',
      modelUsed: 'gemini-4-argon',
      thinkingLevel: 'HIGH',
    },
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          model,
          highThinking,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed');
      }
      setMessages([
        ...nextMessages,
        {
          role: 'model',
          text: data.reply,
          modelUsed: data.modelUsed,
          thinkingLevel: data.thinkingLevel,
        },
      ]);
    } catch (err: any) {
      setMessages([
        ...nextMessages,
        {
          role: 'model',
          text: `Error: ${err.message}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Gemini Production Architect Chat"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 font-semibold text-xs shadow-lg border border-slate-700 dark:border-amber-300 hover:opacity-95 transition-opacity"
      >
        <MessageSquare className="w-4 h-4" />
        <span>AI Architect Chat</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Gemini Production Architect Chat"
          className="fixed bottom-5 right-5 z-50 w-[92vw] max-w-[420px] h-[540px] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                ViralMint Gemini Studio Chat
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat drawer"
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-100/60 dark:bg-slate-950/50 text-[11px]">
            <select
              aria-label="Select Gemini Chat Model"
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            >
              <option value="gemini-4-argon">gemini-4-argon (Complex)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (General)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
            </select>

            {model === 'gemini-4-argon' && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={highThinking}
                  onChange={(e) => setHighThinking(e.target.checked)}
                  className="rounded accent-amber-400"
                />
                <span>ThinkingLevel.HIGH</span>
              </label>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-amber-400/20 dark:bg-amber-400/15 text-slate-900 dark:text-slate-100 ml-6'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 mr-4'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                  {m.role === 'user'
                    ? 'You'
                    : `Architect · ${m.modelUsed || model}${
                        m.thinkingLevel === 'HIGH' ? ' · Thinking: HIGH' : ''
                      }`}
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSend}
            className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-950"
          >
            <input
              type="text"
              placeholder="Ask about hooks, FFmpeg, Colab T4, or SEO..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={isSending}
              aria-label="Send chat message"
              className="px-3 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
