# Quản lý tài khoản

Trong trang **Quản trị hệ thống → Tài khoản**, Admin có thể sửa tên đăng nhập, đổi quyền và chọn **Tài khoản / Mật khẩu → Đặt lại mật khẩu**.

Đây là thao tác đặt **mật khẩu mới**. Hệ thống không hiển thị mật khẩu hiện tại hoặc mã băm của người dùng. Mật khẩu mới phải có ít nhất 8 ký tự, tối đa 72 byte UTF-8 và được băm bằng bcrypt trên máy chủ.

Giáo viên không được sửa tên, đổi quyền hoặc đặt lại mật khẩu tài khoản. Các API này kiểm tra lại quyền Admin trong cơ sở dữ liệu, kể cả khi token cũ vẫn ghi quyền Admin. Không thể tự gỡ quyền Admin hoặc gỡ Admin cuối cùng.

API yêu cầu Bearer token của Admin:

- `PUT /api/admin/users/:id/account` với `{ "username": "ten_moi" }`
- `PUT /api/admin/users/:id/role` với `{ "role": "STUDENT" }` (chấp nhận `STUDENT`, `TEACHER` hoặc `ADMIN`)
- `PUT /api/admin/users/:id/password` với `{ "password": "mat_khau_moi" }`

Các lần đăng nhập mới phải dùng mật khẩu mới. Phiên JWT đã cấp vẫn tồn tại đến khi hết hạn; thay đổi này không thêm cơ chế thu hồi phiên. Sau khi đổi quyền, người dùng cần đăng nhập lại để giao diện nhận quyền mới.

Admin có nút **Xóa người dùng** ở tab Tài Khoản và **Xóa trận** ở tab Trận Đấu.
Mỗi lần xóa phải xác nhận. Xóa người dùng xóa các bản ghi bot và lịch sử trận
liên quan qua khóa ngoại, đồng thời gỡ đăng ký giải trong danh sách participants.
Các file bot cũ trên ổ đĩa không được dọn bởi thao tác này. Không thể tự xóa
tài khoản đang dùng hoặc xóa Admin cuối cùng. Token của tài khoản đã xóa bị từ
chối ngay ở API yêu cầu đăng nhập; quyền hiện tại được kiểm tra từ cơ sở dữ liệu.

Xóa riêng trận xóa bản ghi và replay. Elo của người chơi và kết quả giải đã tính
được giữ nguyên, không hoàn điểm hay tính lại thứ hạng. Đây là thao tác xóa vĩnh
viễn, không có thùng rác. Danh sách trận có phân trang 25 trận.

- `GET /api/admin/matches?limit=25&offset=0`
- `DELETE /api/admin/matches/:id`
- `DELETE /api/admin/users/:id`
