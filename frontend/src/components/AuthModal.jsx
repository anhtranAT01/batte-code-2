import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, initialMode = 'login', onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('REGISTER'); // 'REGISTER' | 'LOGIN'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [adminRegistrationSecret, setAdminRegistrationSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode.toLowerCase() === 'register' ? 'REGISTER' : 'LOGIN');
      setError('');
      setAdminRegistrationSecret('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'REGISTER') {
        await register(username, password, role, role === 'ADMIN' ? adminRegistrationSecret : undefined);
      } else {
        await login(username, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Thao tác không thành công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-card relative w-full max-w-md p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl p-1"
        >
          &times;
        </button>

        {/* Header & Tabs */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-white mb-2">
            {mode === 'REGISTER' ? 'Tạo Tài Khoản' : 'Đăng Nhập Hệ Thống'}
          </h3>
          <p className="text-xs text-slate-400">
            Đăng nhập để quản lý bot và tham gia thi đấu.
          </p>
        </div>

        <div className="flex bg-dark-900/60 p-1 rounded-xl mb-6 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'REGISTER'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Đăng Ký Mới
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'LOGIN'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Đăng Nhập
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tên Đăng Nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ví dụ: student_pro_2026"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Mật Khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {mode === 'REGISTER' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Vai Trò
              </label>
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); setAdminRegistrationSecret(''); }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
              >
                <option value="STUDENT">Học Sinh / Thí Sinh</option>
                <option value="TEACHER">Giáo Viên / Huấn Luyện Viên</option>
                <option value="ADMIN">Quản Trị Viên (ADMIN)</option>
              </select>
            </div>
          )}

          {mode === 'REGISTER' && role === 'ADMIN' && (
            <div>
              <label htmlFor="admin-registration-secret" className="block text-xs font-medium text-slate-300 mb-1.5">Mã cấp quyền quản trị</label>
              <input id="admin-registration-secret" type="password" autoComplete="off" required maxLength={256}
                value={adminRegistrationSecret} onChange={event => setAdminRegistrationSecret(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm" placeholder="Nhập mã riêng do chủ hệ thống cấp" />
              <p className="mt-1.5 text-xs text-slate-400">Mã riêng này được kiểm tra trên máy chủ và khác mật khẩu tài khoản.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="primary-action w-full py-2.5 font-bold text-sm disabled:opacity-50"
          >
            {loading ? 'Đang Xử Lý...' : mode === 'REGISTER' ? 'Xác Nhận Đăng Ký' : 'Đăng Nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
