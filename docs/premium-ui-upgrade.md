# Nâng cấp giao diện BattleCode

## Kiến trúc và phạm vi

Giữ React 18, Vite, Tailwind và cấu trúc component hiện có. `PremiumGaming.css` được tải sau `index.css`, `light.css`, `ArenaDesign.css`, dùng chung biến màu, lớp nền, viền, bóng, chuyển động và trạng thái tương tác. Bàn luyện AI vẫn sử dụng bố cục lớn và lưới vuông đã chỉnh trước đó.

Không sửa backend, API, database, luật, thuật toán bot, hàng đợi chấm, điểm Elo hoặc chính sách lưu replay. Nút điều hướng, chọn bot, nộp file, lịch và đăng ký giải vẫn gọi các handler cũ. Khung kết quả chỉ trình bày dữ liệu hiện có; hòa được ghi đúng là hòa, không hiển thị thành Boss thắng.

## Các khu vực nâng cấp

- Trang chủ: hero hai cột, chữ gradient, bàn minh họa có phối cảnh và quân cờ dùng SVG sẵn có; ba thẻ vào PvP, luyện AI, giải đấu. Bàn hero được đánh dấu là minh họa và ẩn khỏi trình đọc màn hình.
- Hệ thống dùng chung: bề mặt kính, bóng nhiều lớp, nút nổi, viền sáng nhẹ, form/focus/disabled, modal, bảng và menu. Tablet 768–1023px dùng thanh biểu tượng để dành thêm diện tích cho nội dung; tên mục vẫn có aria-label và tooltip.
- PvP: thẻ hai phe có lớp sáng riêng, avatar nổi và huy hiệu đối đầu; giữ nguyên dữ liệu và khả năng chọn đối thủ.
- Bàn chơi: khung nhiều lớp, ô có cạnh nổi, quân có highlight và bóng; nước vừa đi, ô được chọn và đích đi hợp lệ nổi bật hơn.
- Boss: thẻ cấp độ có màu riêng và trạng thái chọn rõ ràng.
- Giải đấu: thẻ lịch/đếm ngược, lựa chọn thể thức, bảng điểm và nhánh đấu có chiều sâu; khung chung kết được nhấn màu vàng. Các trạng thái hiển thị được dịch sang tiếng Việt, giá trị gửi/nhận API giữ nguyên.
- Luyện AI: biểu tượng riêng cho A*, Alpha-Beta và Heuristic; thẻ chọn, quân cờ, chỉ số và mã giả có chiều sâu. Không đổi nội dung bài học hoặc kết quả thuật toán.
- Kho bot, lịch sử, quản trị, hỗ trợ và đăng nhập: dùng cùng hệ thống bề mặt, trường nhập và nút.

## Chuyển động và hiệu năng

- Hover lift/tilt rất nhẹ chỉ áp dụng trên thiết bị có chuột; có phản hồi khi nhấn nút.
- Viền nút chính phát sáng hai lần lúc xuất hiện. Vòng sáng hero chuyển động chậm bằng opacity/transform, không dùng canvas hoặc vòng lặp JavaScript.
- Quân vừa đi có hiệu ứng hạ xuống ngắn; khung kết quả hiện một lần, chiến thắng có huy hiệu và dải sáng lướt một lần.
- `prefers-reduced-motion: reduce` tắt chuyển động, transition và cuộn mượt.
- Không thêm package, thư viện animation hoặc thư viện 3D. Dùng SVG hiện có. Asset CSS+JS đầu trang tăng khoảng 8 KB sau gzip so với bản trước; đây là dung lượng build, không phải số đo FPS hay sức chứa máy chủ.
- Nhật ký trực tiếp vẫn giới hạn 50 dòng. Countdown vẫn nằm trong component riêng, không dựng lại bảng điểm mỗi giây.

## File thay đổi

| File | Thay đổi |
| --- | --- |
| `frontend/src/PremiumGaming.css` | Design system, giao diện các khu vực, animation, responsive và reduced motion |
| `frontend/src/components/ArenaPresentation.jsx` | Component dùng chung `ArenaShowcase`, `ArenaModeCard`, `MatchOutcome` |
| `frontend/src/components/LeaderboardView.jsx` | Hero và thẻ chọn chế độ |
| `frontend/src/components/BossArenaView.jsx` | Khung kết quả, nhãn độ khó và điểm móc giao diện |
| `frontend/src/components/PvPBotArenaView.jsx` | Khung kết quả thắng/thua/hòa dùng chung |
| `frontend/src/components/AlgorithmTrainingView.jsx` | Biểu tượng thẻ thuật toán |
| `frontend/src/components/TournamentBracketsView.jsx` | Trạng thái tiếng Việt và lớp trình bày nhánh đấu |
| `frontend/src/components/BotVaultView.jsx` | Lớp định danh giao diện kho bot |
| `frontend/src/components/DataExplorerView.jsx` | Lớp định danh giao diện lịch sử |
| `frontend/src/components/AdminDashboardView.jsx` | Lớp định danh giao diện quản trị |
| `frontend/src/main.jsx` | Nạp stylesheet dùng chung |
| `frontend/tests/load-arena-presentation.cjs` | Nạp component trình bày thật vào test harness hiện có |
| `frontend/tests/duel-stream.cjs` | Kiểm tra thêm khung kết quả hòa sau luồng trận hoàn tất |
| `frontend/tests/bot-flows.cjs` | Tích hợp component trình bày với kiểm thử luồng bot |
| `frontend/tests/leaderboard-loading.cjs` | Tích hợp component trình bày với kiểm thử tải bảng xếp hạng |
| `frontend/tests/preview-resilience.cjs` | Fixture nhánh đấu và trận PvP để kiểm tra trực quan cục bộ |
| `docs/premium-ui-upgrade.md` | Báo cáo này |

## Kiểm chứng

Đã đạt: `test:performance`, `test:bot-flows`, `test:learning`, `test:tournament`, `test:replay`, `test:navigation`, `test:offline`, `test:support-ui`, `test:match-labels` và `npm run build` trong frontend.

Các kiểm thử bao gồm: luồng bàn cờ trước khi trận kết thúc, tua/dừng/về trực tiếp, kết quả hòa, tải bảng xếp hạng độc lập, chọn bot, giữ nguyên nội dung file Python khi nộp, tài khoản, đăng ký đội, chọn nhánh, chống kết quả cũ ghi đè giải mới, replay, outbox và quyền hiển thị quản trị. Kiểm thử điều hướng vẫn ghi nhận 70 lần đổi số người online không gây dựng lại trang hiện tại.

Kiểm tra trình duyệt cục bộ với fixture dữ liệu và worker đấu bot thật: hero sáng/tối, một trận Boss và một trận PvP đến kết quả, bảng luyện AI, PvP và giải đấu; các khung viewport 390px, 768px, 1024px và desktop 1280px. Các bảng và nhánh rộng dùng vùng cuộn riêng. Bàn luyện AI desktop đo được 433×433px, giữ nguyên kích thước lớn. Không thực hiện thử tải đông người trên hệ thống thật trong thay đổi giao diện này.

Không còn lỗi build hoặc kiểm thử đã chạy. Chưa xác nhận việc Cloudflare đã triển khai phiên bản này; cần frontend deploy commit mới để website công khai nhận giao diện mới.
