# Đo tải nộp code ngày 25/10/2026

Phạm vi: luồng Kho bot đọc file `.py` rồi gửi đến `POST /api/support/submissions`.
HTTP, xác thực JWT, SQL nhận bài, biên nhận, máy chấm Python và lưu bot đều chạy thật.
Máy chủ chỉ lắng nghe `127.0.0.1`; cơ sở dữ liệu PGlite trong bộ nhớ và thư mục bot
được tạo riêng rồi xóa sau phép thử. Không dùng tài khoản hoặc dữ liệu giải đấu thật.

Máy thử: Windows, Node 18.20.8, 16 CPU logic khả dụng. Client tạo tải và cơ sở dữ
liệu PGlite cùng chạy trên máy này. Số đo này **không xác lập giới hạn của Render**,
vì CPU, mạng, PostgreSQL từ xa, proxy, số instance và tải trận đấu thực tế khác nhau.

## Kết quả nhận bài

File mẫu 20 KB. Mỗi người dùng có JWT, mã bài và một bài nộp riêng. Sau lỗi mạng,
client gửi lại một lần với cùng mã bài. Nếu vẫn chưa có biên nhận, pha phục hồi đợi
2 giây rồi giới hạn còn 20 request song song; mỗi bài được thử tối đa ba lần nữa.

| Số tài khoản | Request đồng thời | Lỗi kết nối ban đầu | Chưa có biên nhận sau một lần thử lại | Tổng số bài trong DB sau phục hồi |
| ---: | ---: | ---: | ---: | ---: |
| 50 | 10 | 0 | 0 | 50 |
| 200 | 50 | 0 | 0 | 200 |
| 500 | 100 | 0 | 0 | 500 |
| 1.000 | 200 | 15 | 0 | 1.000 |
| 1.000 | 500 | 107 | 9 | 1.000 |
| 1.000 | 1.000 | 664 | 535 | 1.000 |

Lỗi ghi nhận là `ECONNRESET` / `ECONNREFUSED` trên đường TCP localhost khi tăng
mạnh số kết nối, không phải phản hồi HTTP 429 từ quota. Vì client, API và DB cùng
chạy một máy, chưa thể quy riêng nguyên nhân cho API hoặc suy ra Render chịu được
bao nhiêu người. Ngưỡng 100 request đồng thời là mức không thấy lỗi trong các lượt
thử cục bộ; ở 200 trở lên bắt đầu xuất hiện lỗi. 1.000 tài khoản có thể có bài trong
hàng chờ sau phục hồi, nhưng không nên coi 1.000 lần nộp tức thời là đã đạt yêu cầu.

Ở mức 100 request song song, 500 bài được nhận trong 3,73 giây; p95 thời gian phản
hồi là 1,16 giây. Đợt 1.000 request cùng lúc chỉ xác nhận 465 bài sau pha gửi/thử lại
đầu tiên; phục hồi 535 bài còn lại mất thêm 9,38 giây. Mọi lần thử lại giữ nguyên ID,
và kiểm tra DB xác nhận không tạo thêm bài trùng.

10 file đúng 2 MB nộp đồng thời đều được nhận. File vượt 2 MB bị từ chối (400 cho
giới hạn độ dài chuỗi, 413 cho giới hạn byte UTF-8). Tài khoản có 20 bài đang chờ
nhận 429 cho bài mới tiếp theo; gửi lại ID đã nhận vẫn trả biên nhận. 100 lần gửi
cùng một ID chỉ lưu một bản. Chưa đăng nhập nhận 401. PGlite dùng một kết nối SQL,
nên phép thử quota này chưa kiểm chứng race giữa nhiều kết nối PostgreSQL thật.

Không có một con số tổng người chơi tối đa được cấu hình cho hàng chờ nộp code.
Giới hạn 20 là số bài đang chờ của một tài khoản; tốc độ chấm và dung lượng lưu
trữ mới quyết định thời gian chờ khi nhiều người nộp. Mã nguồn được giữ ở biên nhận
Submissions, bản Bot và file trên đĩa; dự toán dung lượng phải tính cả ba bản.

## Máy chấm và thay đổi đã áp dụng

Trước thay đổi, `setInterval(..., 2000)` tạo thời gian nghỉ giữa các bài dù hàng
chờ còn việc. 8 bot heuristic hợp lệ mất 14,65 giây, tương đương 32,8 bài/phút ở
mẫu ngắn này. Bộ lập lịch mới lấy bài tiếp theo ngay sau khi hoàn thành; vẫn chỉ
có một worker. Hàng chờ rỗng, tạm dừng hoặc lỗi DB vẫn chờ 2 giây trước khi dò lại.
Lỗi hạ tầng vẫn giữ bài pending với thời gian retry của từng bài như trước.

Sau thay đổi, mẫu 8 bot hoàn thành trong 3,70 giây. Đợt chấm liên tục 100 bot thật
hoàn tất trong 48,39 giây (124 bài/phút); kiểm tra cú pháp và nước đi ở cả hai phe,
lưu bot/file và cập nhật biên nhận đều thành công. p95 ping API trong lúc chấm là
5,9 ms. Đây là bot mẫu và phần cứng cục bộ; bot tính chậm hoặc lượt bị timeout sẽ
có tốc độ khác. Không dùng số đo này làm cam kết thời gian chấm trên Render.

Kiểm tra hồi quy xác nhận pause giữ nguyên bài chờ, stop hủy việc dò tiếp, start
nhiều lần không chấm trùng, mất kết nối/lease hết hạn có thể phục hồi, và retry
sau khi lưu Bot không tạo Bot thứ hai. Test upload multipart, source dự phòng và
hai bot Python đấu PvP cũng chạy qua.

## Chạy lại

Test cần `@electric-sql/pglite` và Python. Đặt `TEST_PGLITE_MODULE` tới đường dẫn
module PGlite đã cài riêng cho test và `PYTHON_EXECUTABLE` tới Python trên máy.
Sau đó từ thư mục `backend`:

```powershell
$env:SUBMISSION_JUDGE_SAMPLES = '100'
$env:SUBMISSION_CAPACITY_REPORT = 'E:\batte-code-2\docs\submission-capacity-after.json'
npm run test:submission-capacity
npm run test:resilience
npm run test:bot-uploads
```

Test không nhận URL máy chủ ngoài và không tải `.env` của ứng dụng. Quá tải trong
pha thăm dò vẫn được ghi rõ trong JSON; chỉ kết luận thành công khi phục hồi đủ
biên nhận và đợt chấm thật hoàn tất. Dữ liệu đo nằm trong
`submission-capacity-before.json` và `submission-capacity-after.json` cùng thư mục.
