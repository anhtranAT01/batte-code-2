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
export default function RulesAndStrategyView({onGoToTemplates}){
  return <div className="view-shell learning-view rules-view">
    <header className="learning-header"><div><span className="learning-kicker"><Icon name="rules" size={15} /> CẨM NANG ĐẤU TRƯỜNG</span><h1>Luật chơi, dễ nhớ hơn</h1><p>Nắm vòng tương khắc, xác định mục tiêu và dùng vật phẩm đúng lúc. Bắt đầu từ ba quy tắc dưới đây.</p></div><span className="learning-tag">Kéo · Búa · Giấy</span></header>
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
