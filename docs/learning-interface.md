# Giao diện bài học AI và chế độ sáng

- Hai màn Luyện thuật toán / Luật chơi dùng bề mặt và màu chữ riêng theo theme; bỏ các gradient tối cố định trên thẻ luật, tăng cỡ chữ và khoảng cách dòng.
- Bàn học 7×7 có tọa độ hàng/cột, đường đi nối ô, thứ tự đường đi, quân cùng hình vẽ SVG với bàn thi đấu, chú giải hai phe và ô đang xét/đã xét/vật cản/cờ. Chọn ô để đọc giải thích, dùng phím mũi tên để di chuyển tiêu điểm.
- Điều khiển từng bước, tự xem, tạm dừng, chọn tốc độ, xem lại; đổi bài hoặc rời trang hủy timer. Đặt điều khiển cạnh lời giải thích để dễ theo dõi cùng bàn cờ trên máy tính.
- Chỉ số dùng nhãn tiếng Việt, mã giả tô sáng dòng tương ứng, thêm giải nghĩa các chỉ số. Minimax hiển thị nhánh đang so sánh/tỉa; Heuristic thể hiện cả quân hai bên.
- Ví dụ là tình huống giảng dạy dựng sẵn, được ghi rõ trên màn hình. Sửa ví dụ A* dùng khoảng cách Chebyshev cho 8 hướng: đường đi 7 lượt hợp lệ, g/h/f khớp bản đồ. Không thay đổi engine hay luật máy chấm.
- Luật giải thích rõ bàn 8×8/9×9, không cố định sai giới hạn 200 lượt cho mọi chế độ. Tên Giấy (Bao) nhất quán với hình quân trên bàn.
- Rà các thẻ PvP, kết quả Boss và nhãn nền màu tối: theme sáng dùng nền trắng hoặc màu nhạt; chữ màu có opacity được tăng tương phản. Trên điện thoại, tiêu đề thanh trên thu gọn và ẩn phần thông tin tài khoản phụ để không bị chen lấp.

Kiểm thử: `npm run test:learning` xác nhận 49 ô, xem thông tin/phím mũi tên, đồng bộ bước/chỉ số, xem lại, chuyển cả ba bài, dọn timer và các đường dẫn Kho bot. BFS kiểm chứng đường minh họa A* ngắn nhất theo chính mô hình 8 hướng đã nêu. Các kiểm thử navigation/performance vẫn chạy. Preview cục bộ có `/fixture/responsive?width=390&view=training` (hoặc rules, width 768/1024), không dùng API thật.
