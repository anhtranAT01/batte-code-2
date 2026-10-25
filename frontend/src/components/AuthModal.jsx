import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordRecovery from './PasswordRecovery';
import Icon from './Icons';

export default function AuthModal({ isOpen, initialMode = 'login', onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('REGISTER'); // 'REGISTER' | 'LOGIN' | 'RECOVERY'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [adminRegistrationSecret, setAdminRegistrationSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode.toLowerCase() === 'recovery' ? 'RECOVERY' : initialMode.toLowerCase() === 'register' ? 'REGISTER' : 'LOGIN');
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
        await register(username, password, role, role !== 'STUDENT' ? adminRegistrationSecret : undefined, {
          studentId,
          teamName,
          email,
          consent,
        });
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" role="dialog" aria-modal="true">
      <div className="modal-card relative w-full max-w-md p-6 sm:p-8 max-h-[92vh] overflow-y-auto cyber-card border border-blue-500/30 shadow-glow-blue">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Đóng cửa sổ"
          className="absolute top-5 right-5 text-slate-400 hover:text-white hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        >
          <Icon name="x" size={18} />
        </button>

        {/* Branding & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white font-black text-xl mb-3 shadow-glow-blue">
            BC
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">
            {mode === 'REGISTER' ? 'Tạo Tài Khoản Đấu Thủ' : mode === 'LOGIN' ? 'Đăng Nhập Đấu Trường' : 'Khôi Phục Mật Khẩu'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'REGISTER'
              ? 'Tham gia thi đấu AI Bot, ghi danh bảng vàng & tranh cúp giải đấu.'
              : mode === 'LOGIN'
              ? 'Đăng nhập để điều khiển bot, tham gia thách đấu & xem phân tích.'
              : 'Nhận liên kết đặt lại mật khẩu an toàn qua email của bạn.'}
          </p>
        </div>

        {/* Segmented Switch Tabs */}
        {mode !== 'RECOVERY' && (
          <div className="flex bg-navy-950/80 p-1 rounded-xl mb-6 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'REGISTER'
                  ? 'bg-blue-600 text-white shadow-md'
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
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'LOGIN'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Đăng Nhập
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
            <Icon name="alert" size={16} className="text-red-400 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form Body */}
        {mode === 'RECOVERY' ? (
          <PasswordRecovery onBack={() => setMode('LOGIN')} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                {mode === 'LOGIN' ? 'Tên đăng nhập / MSSV / Email' : 'Tên đăng nhập'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: student_pro_2026"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Mật Khẩu
                </label>
                {mode === 'LOGIN' && (
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    onClick={() => setMode('RECOVERY')}
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-navy-900/90 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            {mode === 'REGISTER' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Mã sinh viên (Đội trưởng)
                    </label>
                    <input
                      required
                      maxLength={50}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white text-sm"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="Ví dụ: 24020001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Tên đội thi đấu
                    </label>
                    <input
                      required
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white text-sm"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Ví dụ: K69 CyberBots"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Email chính xác (Đăng nhập & Khôi phục)
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Mỗi email và MSSV chỉ được gắn với một tài khoản duy nhất.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Vai Trò Đăng Ký
                  </label>
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setAdminRegistrationSecret('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="STUDENT">Học Sinh / Thí Sinh Thi Đấu</option>
                    <option value="TEACHER">Giáo Viên / Huấn Luyện Viên</option>
                    <option value="ADMIN">Ban Quản Trị Hệ Thống (ADMIN)</option>
                  </select>
                </div>

                {role !== 'STUDENT' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <label htmlFor="admin-registration-secret" className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                      Mã cấp quyền quản trị
                    </label>
                    <input
                      id="admin-registration-secret"
                      type="password"
                      autoComplete="off"
                      required
                      maxLength={256}
                      value={adminRegistrationSecret}
                      onChange={(event) => setAdminRegistrationSecret(event.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-amber-500/40 bg-navy-950 text-white text-sm"
                      placeholder="Nhập mã riêng do ban tổ chức cấp"
                    />
                    <p className="mt-1.5 text-[11px] text-amber-300/80">Mã này được kiểm tra trên máy chủ và khác với mật khẩu cá nhân.</p>
                  </div>
                )}

                <div className="pt-1">
                  <label className="flex gap-2.5 text-xs text-slate-300 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Tôi đồng ý với quy chế giải đấu và cho phép Ban tổ chức xử lý dữ liệu để vận hành trận đấu.</span>
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="primary-action w-full py-3 font-bold text-sm disabled:opacity-50 mt-2 shadow-glow-blue"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Icon name="refresh" className="animate-spin" size={16} /> Đang Xử Lý...
                </span>
              ) : mode === 'REGISTER' ? (
                'Xác Nhận Đăng Ký'
              ) : (
                'Đăng Nhập Ngay'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
