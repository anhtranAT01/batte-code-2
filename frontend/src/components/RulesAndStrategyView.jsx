import React from 'react';

export default function RulesAndStrategyView({ onGoToTemplates }) {
  return (
    <div className="view-shell animate-fadeIn max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="page-header">
        <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
          <span>Luật thi đấu và chiến thuật</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Nắm luật chơi, điều kiện thắng và cách xây dựng chiến thuật hiệu quả.
        </p>
      </div>

      {/* Section 1: Combat Matrix */}
      <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>1. Ma Trận Tương Khắc Kéo - Búa - Bao</span>
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Mỗi đấu thủ điều khiển một đội quân gồm các quân cờ thuộc 3 hệ. Khi di chuyển vào ô có quân cờ của đối phương, giao tranh sẽ lập tức diễn ra theo quy luật:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 text-center space-y-2">
            <div className="rule-matchup"><b>S</b><span>thắng</span><b>P</b></div>
            <h4 className="font-bold text-sm text-white">Kéo Ăn Bao</h4>
            <p className="text-[11px] text-slate-400">
              Quân Kéo tấn công hoặc bị tấn công bởi Bao đều giành chiến thắng và loại bỏ quân Bao.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/20 text-center space-y-2">
            <div className="rule-matchup"><b>R</b><span>thắng</span><b>S</b></div>
            <h4 className="font-bold text-sm text-white">Búa Ăn Kéo</h4>
            <p className="text-[11px] text-slate-400">
              Quân Búa đập nát quân Kéo. Búa là khắc tinh tuyệt đối của các đợt càn quét bằng Kéo.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-pink-950/40 to-slate-900 border border-pink-500/20 text-center space-y-2">
            <div className="rule-matchup"><b>P</b><span>thắng</span><b>R</b></div>
            <h4 className="font-bold text-sm text-white">Bao Ăn Búa</h4>
            <p className="text-[11px] text-slate-400">
              Quân Bao bao trùm lấy Búa. Hoàn tất vòng lặp tương khắc chiến thuật cân bằng.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-amber-300 font-medium">
          Lưu ý: Khi 2 quân cùng hệ giao chiến (Búa vs Búa, Kéo vs Kéo, Bao vs Bao), kết quả là <strong>Hòa (Mutual Destruction)</strong> - cả 2 quân cờ đều bị tiêu diệt khỏi bàn cờ!
        </div>
      </div>

      {/* Section 2: Win Conditions */}
      <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>2. Điều Kiện Giành Chiến Thắng</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 to-[#090d18] border border-rose-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="feature-code">BASE</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                MỤC TIÊU SỐ 1 - THẮNG NGAY
              </span>
            </div>
            <h4 className="font-bold text-sm text-white">Cướp Cờ Đối Phương (Flag Capture)</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bên nào đưa được quân cờ của mình tiến vào <strong>ô Căn cứ Cờ của đối thủ</strong> trước sẽ <strong>chiến thắng ngay lập tức</strong> mà không cần tiêu diệt hết quân:
            </p>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li><strong className="text-sky-400">Phe 1 (Xanh)</strong>: Cướp ô cờ Phe 2 tại <code className="text-rose-400 bg-rose-950/60 px-1 py-0.5 rounded font-mono font-bold">(8, 8)</code></li>
              <li><strong className="text-rose-400">Phe 2 (Đỏ)</strong>: Cướp ô cờ Phe 1 tại <code className="text-sky-400 bg-sky-950/60 px-1 py-0.5 rounded font-mono font-bold">(0, 0)</code></li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[#090d18] border border-white/5 space-y-2">
            <span className="feature-code">KO</span>
            <h4 className="font-bold text-sm text-white">Quét Sạch Toàn Bộ Quân</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tiêu diệt 100% quân cờ của đối thủ trên bàn cờ. Đối phương không còn quân nào để di chuyển sẽ lập tức xử thua.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#090d18] border border-white/5 space-y-2">
            <span className="text-2xl">⏳</span>
            <h4 className="font-bold text-sm text-white">Hết Lượt Tối Đa</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Khi đạt tới giới hạn lượt tối đa (200 lượt), bên nào bảo toàn được số lượng quân cờ nhiều hơn sẽ giành chiến thắng.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: The 3 Power-Up Potions */}
      <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>3. Ba Bình Vật Phẩm Chiến Lược (Power-Ups)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-b from-purple-950/30 to-transparent border border-purple-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <span className="feature-code">SYNC</span>
              <h4 className="font-bold text-sm text-purple-300">Bình Đồng Hóa (Infection)</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Quân cờ nhặt được bình này khi ăn một quân địch sẽ <strong>biến quân địch thành đồng minh</strong> gia nhập đội quân của mình thay vì bị tiêu diệt!
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-b from-cyan-950/30 to-transparent border border-cyan-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <span className="feature-code">2X</span>
              <h4 className="font-bold text-sm text-cyan-300">Bình Tăng Tốc (Speed)</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Kích hoạt khả năng <strong>nhảy 2 bước trong một lượt</strong> (theo hướng ngang, dọc hoặc đường chéo), giúp mở rộng tầm kiểm soát và phản công bất ngờ.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/30 to-transparent border border-emerald-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <span className="feature-code">+1</span>
              <h4 className="font-bold text-sm text-emerald-300">Bình Sinh Sản (Clone)</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ngay khi giẫm vào ô có bình Sinh Sản, quân cờ sẽ tự động <strong>nhân đôi tạo thêm 1 quân cờ đồng loại</strong> ở ô kề bên trống!
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: AI Algorithm Recommendations */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-[#0e1322] border border-indigo-500/30 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>4. Gợi Ý Chiến Thuật & Thuật Toán AI Cho Học Sinh</span>
          </h2>
          <button
            onClick={onGoToTemplates}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md"
          >
            <span>Lấy Bản Mẫu Code</span>
            <span>→</span>
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-[#090d18] border border-white/5 space-y-1">
            <div className="font-bold text-indigo-300 text-sm">A. Thuật toán Minimax kết hợp Tỉa nhánh Alpha-Beta</div>
            <p className="text-slate-400">
              Dự đoán trước 2 đến 3 nước đi của đối thủ. Xây dựng hàm đánh giá Heuristic tính tổng điểm lực lượng (Material Balance), cộng điểm ưu thế vị trí, trừ điểm khi tiến vào vùng nguy hiểm có quân địch khắc chế.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d18] border border-white/5 space-y-1">
            <div className="font-bold text-cyan-300 text-sm">B. Thuật toán Tìm đường A* Lao Cờ (A* Flag Rusher)</div>
            <p className="text-slate-400">
              Sử dụng hàm đánh giá $f(n) = g(n) + h(n)$ với khoảng cách Manhattan tới hàng đích của đối thủ. Đặt trọng số né tránh chướng ngại vật và các quân địch khắc chế ta để tìm đường chạy cướp cờ an toàn nhất.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d18] border border-white/5 space-y-1">
            <div className="font-bold text-amber-300 text-sm">C. Chống Lỗi Timeout (1.0 giây) & Vòng Lặp Vô Hạn (Infinite Loop)</div>
            <p className="text-slate-400">
              Máy chấm phân tán (Judge Worker) đặt thời gian giới hạn nghiêm ngặt <strong>1.0 giây cho mỗi lượt tính toán</strong>. Nếu lặp lại trạng thái bàn cờ 5 lần liên tiếp sẽ bị xử thua do lặp vô hạn. Hãy cài đặt bộ đếm thời gian an toàn khoảng 0.85 giây trong code Python!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
