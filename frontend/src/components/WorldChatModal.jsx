import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function WorldChatModal({ isOpen, onClose, socket, onlineCount = 1 }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'system_welcome',
      username: 'Hệ Thống',
      role: 'ADMIN',
      elo: 2000,
      text: 'Chào mừng các kỳ thủ và lập trình viên đến với Kênh Thế Giới Đấu Trường Battlecode 9x9!',
      timestamp: Date.now(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleBroadcast = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:broadcast', handleBroadcast);
    return () => {
      socket.off('chat:broadcast', handleBroadcast);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const msgData = {
      username: user?.username || 'Khách Vô Danh',
      role: user?.role || 'STUDENT',
      elo: user?.elo_rating || 1200,
      text: inputVal.trim(),
    };

    if (socket) {
      socket.emit('chat:message', msgData);
    } else {
      // Local fallback
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          ...msgData,
          timestamp: Date.now(),
        },
      ]);
    }

    setInputVal('');
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="modal-card w-full max-w-lg flex flex-col h-[520px] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#090d18] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="feature-code">CHAT</span>
            <div>
              <h3 className="font-bold text-white text-sm">Kênh trò chuyện</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{onlineCount} người đang trực tuyến</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {messages.map((m) => {
            const isMe = user?.username === m.username;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-200">{m.username}</span>
                  {m.role === 'ADMIN' ? (
                    <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-bold text-[9px]">
                      ADMIN
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[9px]">
                      {m.elo} Elo
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600">
                    {new Date(m.timestamp).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-[#141a2e] text-slate-200 border border-white/5 rounded-tl-none'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="p-3 bg-[#090d18] border-t border-white/5 flex gap-2">
          <input
            type="text"
            placeholder={user ? 'Nhập tin nhắn giao lưu chiến thuật...' : 'Đăng nhập để chat...'}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={!user}
            maxLength={250}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#11172a] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!user || !inputVal.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1"
          >
            <span>Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
}
