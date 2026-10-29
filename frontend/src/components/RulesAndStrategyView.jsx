import React from 'react';
import Icon from './Icons';
import {BoardGlyph} from './GameBoard';
import './LearningViews.css';

const matchups=[{winner:'scissors',loser:'paper',title:'Kéo thắng Giấy',description:'Kéo loại bỏ Giấy (Bao), dù là bên tấn công hay phòng thủ.',tone:'blue'},
  {winner:'rock',loser:'scissors',title:'Búa thắng Kéo',description:'Búa khắc chế Kéo. Tránh đưa quân Kéo vào vùng đối thủ có Búa.',tone:'violet'},
  {winner:'paper',loser:'rock',title:'Giấy thắng Búa',description:'Giấy (Bao) khắc chế Búa, hoàn thành vòng tương khắc ba hệ.',tone:'rose'}];
const items=[{kind:'potion',tone:'violet',title:'Đồng hóa',badge:'ĐỔI PHE',text:'Khi quân có buff này thắng giao tranh, quân địch bị ăn có thể trở thành đồng minh thay vì bị loại bỏ.'},
  {kind:'speed',tone:'cyan',title:'Tăng tốc',badge:'ĐI 2 Ô',text:'Cho phép di chuyển 2 ô theo hướng ngang, dọc hoặc chéo trong một lượt. Dùng để áp sát cờ hoặc đổi vị trí bất ngờ.'},
  {kind:'clone',tone:'green',title:'Thêm quân',badge:'+1 QUÂN',text:'Tạo thêm một quân cùng loại ở ô trống kề bên khi có chỗ. Giúp tăng lực lượng và khả năng kiểm soát bàn cờ.'}];
function SectionHeading({number,title,description}){return <div className="rules-section-heading"><span>{number}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;}
  // 5 Tier definition cards
  const tiers = [
    {
      icon: 'BR',
      name: 'Đồng Kỳ Thủ',
      desc: 'Dưới 1,200 Elo',
      border: 'border-amber-700/30 hover:border-amber-600/50',
      bg: 'from-amber-950/20 to-orange-950/10',
      iconBg: 'bg-amber-900/40 text-amber-400',
    },
    {
      icon: 'SI',
      name: 'Bạc Tinh Anh',
      desc: '1,200 - 1,349 Elo',
      border: 'border-slate-400/30 hover:border-slate-300/50',
      bg: 'from-slate-800/30 to-blue-950/20',
      iconBg: 'bg-slate-700/50 text-slate-200',
    },
    {
      icon: 'GO',
      name: 'Vàng Dũng Sĩ',
      desc: '1,350 - 1,499 Elo',
      border: 'border-yellow-500/30 hover:border-yellow-400/50',
      bg: 'from-amber-900/20 to-yellow-950/10',
      iconBg: 'bg-yellow-700/40 text-yellow-300',
    },
    {
      icon: 'DI',
      name: 'Kim Cương Bậc Thầy',
      desc: '1,500 - 1,699 Elo',
      border: 'border-cyan-500/30 hover:border-cyan-400/50',
      bg: 'from-cyan-950/30 to-blue-950/20',
      iconBg: 'bg-cyan-800/40 text-cyan-300',
    },
    {
      icon: 'EL',
      name: 'Thách Đấu Thần Thoại',
      desc: '1,700+ Elo',
      border: 'border-purple-500/30 hover:border-purple-400/50',
      bg: 'from-purple-950/30 to-pink-950/20',
      iconBg: 'bg-purple-800/40 text-pink-300',
    },
  ];

export default function RulesAndStrategyView({onGoToTemplates}){
  return <div className="view-shell learning-view rules-view">
    <header className="learning-header"><div><span className="learning-kicker"><Icon name="rules" size={15} /> CẨM NANG ĐẤU TRƯỜNG</span><h1>Luật chơi, dễ nhớ hơn</h1><p>Nắm vòng tương khắc, xác định mục tiêu và dùng vật phẩm đúng lúc. Bắt đầu từ ba quy tắc dưới đây.</p></div><span className="learning-tag">Kéo · Búa · Giấy</span></header>
      {/* 3. QUY TRÌNH 4 BƯỚC THAM GIA THI ĐẤU */}
      <section className="space-y-4" aria-label="Lộ trình tham gia đấu trường">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Lộ Trình Chinh Phục Đấu Trường</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              4 bước đơn giản từ người mới bắt đầu đến vô địch giải đấu AI Bot
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-blue-400 font-black">BƯỚC 01</span>
              <span className="text-xl">💻</span>
            </div>
            <h4 className="font-bold text-sm text-white">Viết Bot Python</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dùng mẫu Heuristic hoặc A* có sẵn trong Kho Bot để lập trình chiến lược Kéo Búa Bao.
            </p>
          </div>

          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-purple-400 font-black">BƯỚC 02</span>
              <span className="text-xl">🧪</span>
            </div>
            <h4 className="font-bold text-sm text-white">Thử Nghiệm Ngoại Tuyến</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mô phỏng ván đấu trực tiếp trên trình duyệt qua Pyodide, không lo mất mạng làm mất bài.
            </p>
          </div>

          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-cyan-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400 font-black">BƯỚC 03</span>
              <span className="text-xl">⚔️</span>
            </div>
            <h4 className="font-bold text-sm text-white">Đấu Bot PvP & Leo Rank</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Thách đấu trực tiếp các bạn cùng trường, tích lũy điểm Elo để thăng hạng Bạc, Vàng, Kim Cương.
            </p>
          </div>

          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 font-black">BƯỚC 04</span>
              <span className="text-xl">🏆</span>
            </div>
            <h4 className="font-bold text-sm text-white">Tranh Cúp Giải Đấu</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ghi danh vào Giải đấu Nhánh (Bracket Knockout) và All-in Arena tranh tài cúp vàng vô địch.
            </p>
          </div>
        </div>
      </section>

      {/* 4. RANK TIER CARDS */}
      <section className="space-y-3" aria-label="Các bậc xếp hạng Elo">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">
            Hệ Thống Phân Hạng Elo Đấu Trường
          </h3>
          <span className="text-xs text-slate-400">Các mốc điểm Elo</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {tiers.map((t, idx) => (
            <div
              key={idx}
              className={`tier-card p-3.5 rounded-2xl bg-gradient-to-br ${t.bg} border ${t.border} backdrop-blur-sm transition-all duration-300 hover:-translate-y-1`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${t.iconBg} flex items-center justify-center font-black text-sm shadow-inner`}>
                  {t.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{t.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>


    <section className="learning-panel rules-section" aria-label="Ma trận tương khắc">
      <SectionHeading number="01" title="Mỗi quân có một khắc tinh" description="Kết quả giao tranh phụ thuộc loại quân, không phụ thuộc bên nào đi trước." />
      <div className="rules-card-grid">{matchups.map(item=><article key={item.winner} className="rule-card rule-combat-card" data-tone={item.tone}>
        <div className="rule-matchup" aria-hidden="true"><span className="rule-piece is-winner"><BoardGlyph kind={item.winner} /></span><span className="rule-beats"><Icon name="chevronRight" size={19} /><small>thắng</small></span><span className="rule-piece"><BoardGlyph kind={item.loser} /></span></div>
        <h3>{item.title}</h3><p>{item.description}</p>
      </article>)}</div>
      <div className="rules-callout" data-tone="gold"><Icon name="info" size={18} /><p><strong>Cùng loại thì cả hai bị loại.</strong> Búa gặp Búa, Kéo gặp Kéo hoặc Giấy gặp Giấy đều dẫn đến hủy diệt lẫn nhau.</p></div>
    </section>
    <section className="learning-panel rules-section" aria-label="Điều kiện chiến thắng">
      <SectionHeading number="02" title="Cướp cờ là mục tiêu ưu tiên" description="Không cần ăn hết quân đối phương mới có thể giành chiến thắng." />
      <div className="rules-card-grid">
        <article className="rule-card rule-win-card" data-tone="rose"><div className="rule-card-icon"><BoardGlyph kind="flag" /><span className="learning-tag">THẮNG NGAY</span></div><h3>Chạm cờ đối phương</h3><p>Đưa một quân của bạn tới ô căn cứ đối thủ để thắng ngay. Trên bàn 9×9:</p><div className="rules-base-row"><span>Phe Xanh →</span><code>(8, 8)</code></div><div className="rules-base-row"><span>Phe Đỏ →</span><code>(0, 0)</code></div><p className="rule-small-note">Bàn 8×8 dùng góc (7, 7) thay cho (8, 8).</p></article>
        <article className="rule-card rule-win-card" data-tone="blue"><div className="rule-card-icon"><Icon name="target" size={28} /><span className="learning-tag">LOẠI QUÂN</span></div><h3>Đối thủ hết quân</h3><p>Khi đối thủ không còn quân trên bàn, bạn thắng. Nếu cả hai cùng hết quân, trận đấu kết thúc hòa.</p><div className="rule-example">Quan sát loại quân địch trước khi chọn nước ăn quân.</div></article>
        <article className="rule-card rule-win-card" data-tone="gold"><div className="rule-card-icon"><Icon name="cpu" size={28} /><span className="learning-tag">GIỚI HẠN LƯỢT</span></div><h3>Bảo toàn lực lượng</h3><p>Giới hạn lượt tùy chế độ chơi. Khi hết lượt, bên còn nhiều quân hơn giành chiến thắng; bằng quân thì hòa.</p><div className="rule-example">Theo dõi số quân và kết quả chính thức trong trận hoặc replay.</div></article>
      </div>
    </section>
    <section className="learning-panel rules-section" aria-label="Vật phẩm chiến thuật">
      <SectionHeading number="03" title="Ba vật phẩm có thể đổi thế trận" description="Nhận diện biểu tượng trên bàn cờ và lựa chọn thời điểm sử dụng." />
      <div className="rules-card-grid">{items.map(item=><article className="rule-card rule-item-card" data-tone={item.tone} key={item.kind}><div className="rule-card-icon"><BoardGlyph kind={item.kind} /><span className="learning-tag">{item.badge}</span></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>
    <section className="learning-panel rules-section" aria-label="Gợi ý lập trình bot">
      <SectionHeading number="04" title="Từ luật chơi đến một bot tốt hơn" description="Học từng phần, thử nghiệm rồi mới kết hợp các chiến thuật." />
      <div className="rule-strategy-list">
        <article><span className="rule-strategy-index">A*</span><div><h3>Tìm đường tới cờ</h3><p>Dùng f(n) = g(n) + h(n), tránh vật cản và các quân khắc chế. Với di chuyển 8 hướng có cùng chi phí, khoảng cách Chebyshev là một cách ước tính phù hợp.</p></div></article>
        <article><span className="rule-strategy-index">AB</span><div><h3>Nhìn trước phản ứng của đối thủ</h3><p>Minimax kết hợp Alpha-Beta giúp so sánh nước đi và bỏ qua nhánh kém. Hàm Heuristic cần cân bằng quân số, tương khắc và khoảng cách tới cờ.</p></div></article>
        <article><span className="rule-strategy-index">1s</span><div><h3>Chừa thời gian an toàn</h3><p>Máy chấm giới hạn thời gian tính mỗi lượt. Với mức 1 giây, hãy dừng tìm kiếm sớm hơn, chẳng hạn khoảng 0,85 giây, và luôn có một nước đi hợp lệ dự phòng.</p></div></article>
      </div>
      {onGoToTemplates && <div className="rules-next-action"><span>Sẵn sàng thử một chiến thuật?</span><button type="button" className="primary-action" onClick={onGoToTemplates}>Mở bot mẫu <Icon name="chevronRight" size={16} /></button></div>}
    </section>
  </div>;
}
