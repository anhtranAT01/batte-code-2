import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordRecovery from './PasswordRecovery';

export default function AuthModal({ isOpen, initialMode = 'login', onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('REGISTER'); // 'REGISTER' | 'LOGIN'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [adminRegistrationSecret, setAdminRegistrationSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentId,setStudentId]=useState(''),[teamName,setTeamName]=useState(''),[email,setEmail]=useState(''),[consent,setConsent]=useState(false),[showPassword,setShowPassword]=useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode.toLowerCase() === 'recovery'?'RECOVERY':initialMode.toLowerCase() === 'register' ? 'REGISTER' : 'LOGIN');
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
        await register(username, password, role, role !== 'STUDENT' ? adminRegistrationSecret : undefined,{studentId,teamName,email,consent});
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
      <div className="modal-card relative w-full max-w-md p-6 max-h-[92vh] overflow-y-auto">
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
        {mode==='RECOVERY'?<PasswordRecovery onBack={()=>setMode('LOGIN')}/>:<form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {mode==='LOGIN'?'Tên đăng nhập / MSSV / Email':'Tên đăng nhập'}
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
              type={showPassword?'text':'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <button type="button" className="text-xs mt-2 underline" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'}</button>
          </div>

          {mode==='REGISTER'&&<>
            <label className="block text-sm">Mã sinh viên (Đội trưởng)<input required maxLength={50} className="w-full mt-2 px-3 py-2 rounded-xl border" value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Ví dụ: 24020001"/></label>
            <label className="block text-sm">Tên đội thi đấu<input required maxLength={100} className="w-full mt-2 px-3 py-2 rounded-xl border" value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Ví dụ: K69 CyberBots"/></label>
            <label className="block text-sm">Email (đăng nhập và khôi phục mật khẩu)<input type="email" required maxLength={254} className="w-full mt-2 px-3 py-2 rounded-xl border" value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <p className="text-xs">Mỗi email và mã sinh viên chỉ gắn với một tài khoản.</p>
            <label className="flex gap-2 text-xs items-start"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Tôi đồng ý quy chế giải và việc Ban tổ chức xử lý dữ liệu tài khoản để tổ chức giải.</span></label>
            <details className="text-xs"><summary className="cursor-pointer">Dữ liệu được thu và quyền của bạn</summary><p className="mt-2">Hệ thống lưu tên đăng nhập, mã sinh viên, tên đội, email, mật khẩu đã băm, mã bot và lịch sử thi đấu. Email và mã sinh viên không hiển thị công khai. Bạn có thể yêu cầu Ban tổ chức chỉnh sửa hoặc xóa dữ liệu qua Hỏi đáp. Tên đăng nhập, bot chính và kết quả có thể xuất hiện trên bảng thi đấu.</p></details>
          </>}

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

          {mode === 'REGISTER' && role !== 'STUDENT' && (
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
          {mode==='LOGIN'&&<button type="button" className="text-sm underline" onClick={()=>setMode('RECOVERY')}>Quên mật khẩu?</button>}
        </form>}
      </div>
    </div>
  );
}
