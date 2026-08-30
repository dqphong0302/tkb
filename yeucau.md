# YÊU CẦU PHẦN MỀM XẾP THỜI KHÓA BIỂU

## 1. Mục tiêu

Xây dựng phần mềm xếp thời khóa biểu chạy **offline trên máy tính cá nhân**, tham khảo quy trình nghiệp vụ của `tkb.com.vn` nhưng sử dụng giao diện, mã nguồn và thiết kế hệ thống độc lập.

Mục tiêu quan trọng nhất của phiên bản đầu:

1. Nhập đủ dữ liệu phục vụ xếp lịch.
2. Xếp thời khóa biểu thủ công có kiểm tra xung đột.
3. Xếp thời khóa biểu tự động theo các ràng buộc.
4. Tinh chỉnh kết quả nhanh và an toàn.
5. In hoặc xuất thời khóa biểu.

Phần mềm là ứng dụng desktop một người dùng, không có tài khoản, không có đăng nhập, không cần Internet.

## 2. Nguyên tắc xây dựng

- Bám theo nghiệp vụ thực tế, không sao chép giao diện hoặc mã nguồn của website tham khảo.
- Ưu tiên chức năng xếp lịch trước các chức năng quản trị nâng cao.
- Mọi thao tác xếp tay phải được kiểm tra xung đột ngay lập tức.
- Bộ xếp tự động phải tạo kết quả có thể kiểm chứng, không dùng mô hình AI để quyết định lịch.
- Cho phép người dùng kết hợp xếp tự động, khóa tiết và chỉnh sửa thủ công.
- Toàn bộ dữ liệu nằm trên máy người dùng. Mọi chức năng lõi phải chạy được khi không có mạng.

## 3. Đối tượng sử dụng

- Người phụ trách chuyên môn.
- Ban giám hiệu.
- Giáo viên được giao nhiệm vụ xếp thời khóa biểu.

Phần mềm được cài trên máy của người xếp lịch. Mỗi máy giữ dữ liệu riêng, không có đồng bộ giữa các máy. Muốn chuyển việc cho người khác thì dùng chức năng sao lưu/khôi phục bằng file.

Dữ liệu vẫn gắn `schoolId` và `semesterId` ngay từ đầu để không phải thay đổi cấu trúc khi mở rộng sau này.

## 4. Quy trình sử dụng chính

### 4.1. Khởi động ứng dụng

1. Lần chạy đầu tiên, ứng dụng tạo cơ sở dữ liệu cục bộ trong thư mục dữ liệu ứng dụng của hệ điều hành.
2. Ứng dụng yêu cầu nhập tên trường và tạo năm học, học kỳ đầu tiên.
3. Các lần sau, ứng dụng mở thẳng học kỳ đang hoạt động.
4. Không có màn hình đăng ký hoặc đăng nhập.

Tùy chọn có thể làm sau: đặt mật khẩu mở ứng dụng để bảo vệ dữ liệu trên máy dùng chung. Đây là khóa cục bộ, không phải tài khoản.

### 4.2. Quy trình khai báo 9 bước

Luồng nhập dữ liệu chính được trình bày theo từng bước:

1. Khối.
2. Lớp.
3. Ngày học và tiết học.
4. Phòng học.
5. Môn học.
6. Giáo viên.
7. Giáo viên chủ nhiệm.
8. Phân công giảng dạy.
9. Thiết lập số tiết mỗi tuần.

Bước 4 (Phòng học) có thể bỏ qua. Nếu bỏ qua, các ràng buộc liên quan đến phòng không được áp dụng.

Mỗi bước cần có:

- Danh sách dữ liệu hiện có.
- Thêm, sửa, xóa.
- Nhập nhanh nhiều dòng.
- Cảnh báo dữ liệu thiếu hoặc trùng.
- Nút chuyển sang bước tiếp theo.
- Hiển thị trạng thái hoàn thành của từng bước.

## 5. Yêu cầu chức năng chi tiết

### 5.1. Trường, năm học và học kỳ

- Lưu tên trường và thông tin cơ bản.
- Tạo năm học, ví dụ `2026–2027`.
- Tạo học kỳ 1, học kỳ 2 hoặc học kỳ tùy chỉnh.
- Chọn học kỳ đang làm việc.
- Sao chép danh mục và phân công từ học kỳ trước ở giai đoạn sau.

### 5.2. Quản lý khối

- Thêm tên khối và thứ tự hiển thị.
- Sửa, xóa khối chưa được sử dụng.
- Hỗ trợ các tên như Khối 6, Khối 7 hoặc tên tùy chỉnh.
- Hiển thị số lớp thuộc từng khối.

### 5.3. Quản lý lớp

- Thêm mã lớp, tên lớp và khối.
- Chọn ca học sáng, chiều hoặc cả ngày.
- Thiết lập số tiết tối đa trong ngày.
- Có thể gán phòng học cố định.
- Không cho phép trùng mã lớp trong cùng học kỳ.

### 5.4. Ngày học và tiết học

- Chọn các ngày học trong tuần.
- Khai báo tiết học theo ca sáng và chiều.
- Mỗi tiết có số thứ tự, tên hiển thị, giờ bắt đầu và giờ kết thúc.
- Cho phép một số lớp không học ở một ngày hoặc ca nhất định.
- Hỗ trợ tiết cố định như chào cờ, sinh hoạt: người dùng khai báo tiết đó thuộc lớp nào, môn nào, giáo viên nào; hệ thống ghi thẳng vào thời khóa biểu và đánh dấu khóa trước khi bộ giải chạy.

### 5.5. Quản lý phòng học

- Thêm mã phòng, tên phòng và loại phòng.
- Đánh dấu phòng chuyên môn, ví dụ phòng Tin học, phòng Thí nghiệm.
- Khai báo sức chứa và ghi chú, dùng để tham khảo.
- Khai báo thời gian phòng không sử dụng được.
- Không cho phép trùng mã phòng.
- Toàn bộ phần phòng học là tùy chọn. Trường không dùng phòng chuyên môn có thể bỏ trống danh mục này.

### 5.6. Quản lý môn học

- Thêm mã môn, tên môn, màu hiển thị và thứ tự.
- Đánh dấu môn có thể học tiết đôi.
- Đặt số tiết tối đa của môn trong một ngày.
- Đặt khoảng cách mong muốn giữa các buổi học.
- Cho phép cấu hình yêu cầu phòng chuyên môn.

### 5.7. Quản lý giáo viên

- Thêm mã giáo viên, họ tên, tên viết tắt và tổ chuyên môn.
- Gán màu hiển thị tùy chọn.
- Khai báo số tiết tối đa trong ngày.
- Khai báo thời gian không thể dạy.
- Khai báo thời gian ưu tiên dạy.
- Có thể bật ưu tiên hạn chế tiết trống.
- Không cho phép trùng mã giáo viên.

### 5.8. Giáo viên chủ nhiệm

- Gán một giáo viên chủ nhiệm cho một lớp.
- Một lớp chỉ có một GVCN trong một học kỳ.
- Cảnh báo nếu một giáo viên được gán cho nhiều lớp.
- Cho phép cấu hình tiết sinh hoạt do GVCN phụ trách.

### 5.9. Phân công giảng dạy

Một phân công gồm:

- Lớp.
- Môn học.
- Giáo viên.
- Số tiết mỗi tuần.
- Số tiết đôi mong muốn hoặc bắt buộc.
- Phòng học chuyên môn nếu có.
- Ghi chú.

Mỗi cặp lớp–môn chỉ có một phân công và một giáo viên phụ trách.

Chức năng cần có:

- Thêm từng phân công.
- Nhập nhanh theo ma trận lớp–môn.
- Sao chép phân công giữa các lớp cùng khối.
- Lọc theo lớp, giáo viên hoặc môn.
- Tính tổng số tiết của từng giáo viên.
- Cảnh báo phân công thiếu giáo viên hoặc thiếu số tiết.
- Cảnh báo cùng lớp và môn được khai báo trùng.

### 5.10. Nhập dữ liệu Excel

- Cung cấp file mẫu.
- Nhập danh sách lớp, môn, giáo viên, phòng và phân công.
- Hiển thị bản xem trước trước khi lưu.
- Chỉ rõ dòng lỗi và nguyên nhân.
- Không ghi dữ liệu nếu file có lỗi nghiêm trọng.
- Cho phép sửa lỗi rồi nhập lại.

Chức năng nhập Excel phải hoàn thành **trước khi bắt đầu xây dựng bộ giải**, vì bộ giải cần dữ liệu trường thật để phát triển và kiểm thử. Xem mục 15.

## 6. Xếp thời khóa biểu thủ công

### 6.1. Giao diện lưới

- Cột biểu diễn ngày học và tiết học.
- Hàng hoặc bảng chọn biểu diễn lớp/giáo viên.
- Chuyển chế độ xem theo lớp, giáo viên và phòng.
- Mỗi ô hiển thị môn, giáo viên, lớp và phòng phù hợp với chế độ xem.
- Màu sắc giúp phân biệt môn học hoặc trạng thái.
- Có thanh tìm kiếm lớp và giáo viên.

### 6.2. Thao tác xếp tay

- Click ô trống để chọn phân công cần xếp.
- Kéo thả một tiết sang vị trí khác.
- Đổi chỗ hai tiết nếu hợp lệ.
- Xóa tiết khỏi lưới nhưng không xóa phân công.
- Khóa hoặc mở khóa một tiết.
- Hoàn tác và làm lại các thao tác gần nhất.

Hoàn tác/làm lại chỉ áp dụng trong phiên làm việc hiện tại, lưu trong bộ nhớ, tối thiểu 50 bước. Không lưu lịch sử thao tác vào cơ sở dữ liệu ở MVP.

### 6.3. Kiểm tra tức thời

Không cho phép lưu một thao tác gây ra:

- Một lớp học hai môn cùng lúc.
- Một giáo viên dạy hai lớp cùng lúc.
- Một phòng được sử dụng bởi hai lớp cùng lúc, nếu có khai báo phòng.
- Giáo viên bị xếp vào thời gian không thể dạy.
- Lớp bị xếp ngoài ca học.
- Vượt quá số tiết yêu cầu của phân công.

Các vi phạm quy tắc mềm có thể được lưu nhưng phải hiện cảnh báo rõ ràng.

### 6.4. Theo dõi tiến độ xếp

- Hiển thị số tiết đã xếp và chưa xếp theo lớp.
- Hiển thị phân công còn thiếu tiết.
- Hiển thị tổng số xung đột.
- Cho phép click vào cảnh báo để mở đúng lớp, giáo viên và tiết liên quan.

## 7. Xếp thời khóa biểu tự động

Tự động xếp lịch là chức năng lõi thuộc phạm vi P0 của MVP, không phải tính năng mở rộng.

### 7.1. Luồng sử dụng

1. Người dùng hoàn thành khai báo dữ liệu.
2. Hệ thống chạy tiền kiểm dữ liệu (mục 7.6).
3. Người dùng chọn phạm vi xếp.
4. Người dùng chọn các quy tắc và mức ưu tiên.
5. Người dùng nhấn **Xếp tự động**.
6. Bộ giải chạy nền trên máy, giao diện không bị khóa.
7. Ứng dụng hiển thị tiến độ, phương án tốt nhất tạm thời và nút hủy.
8. Khi hoàn tất, ứng dụng hiển thị phương án xem trước.
9. Người dùng áp dụng, lưu thành phương án khác hoặc chạy lại.
10. Người dùng kéo thả để tinh chỉnh kết quả.

### 7.2. Phạm vi xếp

- Xếp toàn trường.
- Xếp một khối.
- Xếp một hoặc nhiều lớp được chọn.
- Xếp các phân công còn thiếu tiết.
- Xếp lại phần chưa khóa.
- Giữ nguyên tất cả các tiết đã khóa.

Khi phạm vi nhỏ hơn toàn trường, tất cả tiết đã xếp của các lớp **ngoài** phạm vi được nạp vào mô hình như dữ liệu cố định. Giáo viên dạy chéo khối vì vậy vẫn không bị xếp trùng.

### 7.3. Ràng buộc bắt buộc

Phương án hợp lệ phải đảm bảo:

- Một lớp không học hai môn trong cùng một tiết.
- Một giáo viên không dạy hai lớp trong cùng một tiết.
- Mỗi phân công được xếp đúng số tiết mỗi tuần.
- Giáo viên không bị xếp vào thời gian bận.
- Lớp chỉ được xếp trong ngày và ca có thể học.
- Các tiết đã khóa không bị di chuyển.
- Không xếp tiết ngoài cấu hình ngày/tiết của học kỳ.
- Không vượt số tiết tối đa trong ngày của lớp, môn hoặc giáo viên.

Các ràng buộc bắt buộc **có điều kiện**, chỉ áp dụng khi dữ liệu tương ứng được khai báo:

- Một phòng không được sử dụng bởi hai lớp trong cùng một tiết.
- Môn yêu cầu phòng chuyên môn được xếp đúng loại phòng.
- Tiết đôi được đánh dấu bắt buộc phải xếp liền nhau trong cùng buổi.

Bộ giải không được tự bỏ qua bất kỳ ràng buộc bắt buộc nào đang có hiệu lực.

### 7.4. Chế độ chạy

- **Chế độ đầy đủ** (mặc định): phải xếp đúng toàn bộ số tiết. Nếu không có nghiệm, trả về `Không tìm thấy phương án`.
- **Chế độ một phần**: cho phép để lại tiết chưa xếp, mỗi tiết thiếu chịu một điểm phạt rất lớn. Dùng để dò xem dữ liệu vướng ở đâu. Kết quả phải ghi rõ danh sách phân công còn thiếu tiết.

Cả hai chế độ đều không được vi phạm ràng buộc bắt buộc.

### 7.5. Tiêu chí tối ưu

Bộ giải sử dụng điểm phạt để chọn phương án tốt hơn:

- Giảm tiết trống của giáo viên.
- Phân bố các tiết của một môn đều trong tuần.
- Tránh dồn nhiều tiết cùng môn trong một ngày.
- Ưu tiên thời gian giáo viên mong muốn.
- Hạn chế giáo viên chỉ dạy một tiết trong một buổi.
- Hạn chế tiết đầu hoặc tiết cuối theo cấu hình.
- Ưu tiên tiết đôi liền nhau khi không bắt buộc.
- Hạn chế đổi phòng liên tục.
- Ưu tiên lịch phù hợp cho GVCN.

Mỗi tiêu chí có bốn mức cấu hình: `Không áp dụng`, `Thấp`, `Vừa`, `Cao`. Ứng dụng ánh xạ bốn mức này sang trọng số số học bên trong, người dùng không cần nhập số.

Định nghĩa dùng chung để tính điểm và viết kiểm thử:

- **Buổi**: tập hợp các tiết của một ca (sáng hoặc chiều) trong một ngày.
- **Tiết trống của giáo viên**: số tiết không dạy nằm giữa tiết đầu tiên và tiết cuối cùng mà giáo viên đó dạy trong cùng một buổi.
- **Phân bố môn**: độ lệch giữa số ngày thực tế có môn đó và số ngày lý tưởng, tính theo số tiết mỗi tuần của phân công.

### 7.6. Tiền kiểm dữ liệu và báo vô nghiệm

Trước khi gọi bộ giải, ứng dụng chạy kiểm tra số học nhanh và chặn lại nếu phát hiện mâu thuẫn hiển nhiên:

- Tổng số tiết phân công của một lớp vượt số ô khả dụng của lớp đó.
- Tổng số tiết của một giáo viên vượt số ô mà giáo viên đó rảnh.
- Tổng số tiết cần phòng chuyên môn vượt sức chứa thời gian của nhóm phòng đó.
- Phân công có số tiết mỗi tuần bằng 0 hoặc thiếu giáo viên.
- Số tiết tối đa mỗi ngày nhân số ngày học nhỏ hơn số tiết mỗi tuần.

Nếu vượt qua tiền kiểm nhưng bộ giải vẫn không tìm được nghiệm, bộ giải phải trả về nhóm ràng buộc nghi vấn. Cách triển khai: gắn mỗi nhóm ràng buộc mềm hóa được với một biến giả định và dùng cơ chế phân tích tập giả định gây vô nghiệm của CP-SAT, hoặc chạy lại ở chế độ một phần rồi liệt kê các phân công không xếp được. Không được chỉ trả về một thông báo lỗi chung.

### 7.7. Trạng thái và tiến độ

Trạng thái: `Chưa chạy`, `Đang chờ`, `Đang xếp`, `Tìm thấy phương án`, `Không tìm thấy phương án`, `Đã hủy`, `Có lỗi`.

Trong khi chạy, giao diện hiển thị thời gian đã chạy, trạng thái hiện tại, điểm của phương án tốt nhất tạm thời và nút hủy. Người dùng có thể rời màn hình và quay lại xem kết quả.

Bộ giải là một tiến trình riêng. Ứng dụng gửi dữ liệu đầu vào dạng JSON và nhận lại luồng thông điệp JSON theo dòng trên `stdout`, gồm các loại `progress`, `solution`, `done`, `error`. Hủy tác vụ được thực hiện bằng cách dừng tiến trình đó; dữ liệu hiện có trong ứng dụng không thay đổi.

### 7.8. Kết quả

- Toàn bộ các tiết đã xếp.
- Điểm chất lượng tổng thể.
- Số tiết còn thiếu, nếu chạy chế độ một phần.
- Danh sách quy tắc mềm chưa đạt.
- Thống kê tiết trống của giáo viên.
- Thống kê mức phân bố môn trong tuần.

Cho phép áp dụng hoặc bỏ kết quả. Lưu được nhiều phương án để so sánh. Không ghi đè thời khóa biểu hiện tại trước khi người dùng xác nhận áp dụng.

### 7.9. Tiêu chí nghiệm thu bộ xếp tự động

1. Chạy được khi máy không kết nối Internet.
2. Không làm treo giao diện trong quá trình giải.
3. Không tạo lịch trùng lớp, giáo viên hoặc phòng.
4. Xếp đủ số tiết khi dữ liệu có nghiệm.
5. Giữ nguyên tất cả tiết đã khóa.
6. Có thể hủy một lần chạy dài.
7. Không làm mất thời khóa biểu hiện tại khi chạy thất bại.
8. Báo được nhóm dữ liệu hoặc ràng buộc có khả năng gây vô nghiệm.
9. Cho phép xem trước trước khi áp dụng.
10. Cùng một bộ dữ liệu phải chạy được trên Windows và macOS.
11. Đạt mục tiêu hiệu năng ở mục 13.

## 8. Tinh chỉnh thời khóa biểu

- Chỉnh sửa bằng kéo thả sau khi xếp tự động.
- Tìm các vị trí có thể chuyển đến mà không xung đột.
- Đề xuất tiết có thể đổi chỗ.
- Khóa các tiết đã đạt yêu cầu.
- Chạy xếp lại chỉ cho phần chưa khóa.
- Lọc các giáo viên có nhiều tiết trống.
- Lọc môn bị phân bố chưa hợp lý.
- Hiển thị lịch lớp và lịch giáo viên cạnh nhau khi chỉnh sửa.
- Hoàn tác thay đổi.
- Lưu thành phương án mới thay vì ghi đè.

## 9. In, xuất và sao lưu

### 9.1. In và xuất

- In thời khóa biểu từng lớp.
- In thời khóa biểu từng giáo viên.
- In thời khóa biểu toàn trường.
- Xuất Excel.
- Xuất PDF.
- Chọn khổ giấy, hướng giấy và cỡ chữ.
- Hiển thị tên trường, năm học, học kỳ và ngày áp dụng.

### 9.2. Sao lưu

- Tạo bản sao dữ liệu của học kỳ thành một file duy nhất trên máy, gồm dữ liệu và thông tin phiên bản.
- Chọn nơi lưu file sao lưu.
- Khôi phục từ file sao lưu.
- Tự động tạo bản sao trước thao tác khôi phục và trước mỗi lần nâng cấp có migration.
- Cơ sở dữ liệu chỉ lưu danh sách các bản sao lưu đã tạo và đường dẫn file, không lưu nội dung bản sao.

## 10. Các màn hình chính

1. Tổng quan học kỳ.
2. Trình khai báo dữ liệu 9 bước.
3. Danh sách phân công giảng dạy.
4. Cấu hình ngày, tiết và ràng buộc.
5. Xếp thời khóa biểu thủ công.
6. Cấu hình và chạy xếp tự động.
7. Xem kết quả, cảnh báo và so sánh phương án.
8. In và xuất dữ liệu.
9. Cài đặt và sao lưu.

Thanh điều hướng chính nên tập trung vào: Khai báo, Phân công, Thời khóa biểu, Xếp tự động, In/Xuất, Cài đặt.

## 11. Mô hình dữ liệu dự kiến

### 11.1. Trường học

- `School`: trường học.
- `AcademicYear`: năm học.
- `Semester`: học kỳ.

### 11.2. Danh mục

- `Grade`: khối.
- `SchoolClass`: lớp.
- `Subject`: môn học.
- `Teacher`: giáo viên.
- `Room`: phòng học.
- `TeachingDay`: ngày học.
- `Period`: tiết học.

### 11.3. Nghiệp vụ xếp lịch

- `HomeroomAssignment`: GVCN của lớp.
- `TeachingAssignment`: phân công giảng dạy.
- `TeacherAvailability`: thời gian bận hoặc ưu tiên của giáo viên.
- `ClassAvailability`: thời gian có thể học của lớp.
- `RoomAvailability`: thời gian phòng sử dụng được.
- `SchedulingConstraint`: cấu hình quy tắc và mức ưu tiên.
- `Timetable`: một phương án thời khóa biểu.
- `TimetableEntry`: một tiết đã xếp, có cờ khóa.
- `SolverJob`: tác vụ xếp tự động.
- `SolverViolation`: vi phạm quy tắc mềm hoặc nguyên nhân thất bại.
- `BackupRecord`: thông tin bản sao lưu đã tạo.

Tất cả dữ liệu nghiệp vụ phải gắn với `schoolId` và `semesterId` ngay từ đầu.

## 12. Kiến trúc kỹ thuật

Sản phẩm là ứng dụng desktop dùng chung một mã nguồn cho Windows và macOS.

### 12.1. Công nghệ

- Electron: khung ứng dụng desktop đa nền tảng.
- React, TypeScript và Vite: giao diện người dùng.
- Tailwind CSS và bộ component dùng chung.
- dnd-kit: kéo thả tiết học trên lưới thời khóa biểu.
- SQLite: lưu dữ liệu cục bộ trên máy.
- Drizzle ORM: truy cập và migration cơ sở dữ liệu.
- Python và Google OR-Tools CP-SAT: bộ xếp thời khóa biểu tự động.
- PyInstaller: đóng gói bộ giải thành chương trình chạy độc lập.
- electron-builder: tạo bộ cài Windows và macOS.

### 12.2. Cấu trúc ứng dụng

```text
Ứng dụng Electron
├── React UI
├── Electron Main Process
├── SQLite
└── Solver
    └── Python + OR-Tools
```

Bộ giải được đóng gói riêng cho từng hệ điều hành:

- Windows: `tkb-solver.exe`.
- macOS: `tkb-solver`.

Electron truyền dữ liệu đầu vào dạng JSON cho bộ giải. Bộ giải trả về phương án thời khóa biểu, điểm chất lượng, cảnh báo và nguyên nhân thất bại theo giao thức ở mục 7.7. Kết quả chỉ được ghi vào SQLite sau khi người dùng chọn áp dụng.

### 12.3. Chế độ hoạt động

Ứng dụng phải hoạt động đầy đủ khi không có Internet, bao gồm khai báo dữ liệu, xếp lịch thủ công, xếp lịch tự động, chỉnh sửa và khóa tiết, nhập/xuất Excel, xuất PDF và in, sao lưu/khôi phục bằng file.

Ở MVP không có máy chủ, không có đồng bộ và không có cập nhật tự động. Người dùng tải bản cài mới và cài đè khi có phiên bản mới. Dịch vụ trực tuyến cho cập nhật, đồng bộ hoặc sao lưu từ xa chỉ xem xét sau MVP và không tham gia vào quá trình xếp lịch.

## 13. Yêu cầu phi chức năng

- Giao diện ưu tiên desktop; màn hình xếp lịch cần độ rộng tối thiểu 1280px.
- Thao tác kéo thả phản hồi gần như tức thời.
- Kiểm tra xung đột khi xếp tay trả kết quả dưới 100ms.
- Mục tiêu quy mô và hiệu năng của bộ giải: 45 lớp, 90 giáo viên, 6 ngày × 10 tiết, tìm được phương án hợp lệ đầu tiên trong vòng 60 giây và dừng ở phương án chấp nhận được trong vòng 5 phút trên máy tính văn phòng phổ thông.
- Có nhật ký lỗi của bộ giải, ghi ra file trong thư mục dữ liệu ứng dụng.
- Một lần xếp lịch thất bại không được làm mất lịch đang sử dụng.
- Tự động lưu bản nháp khi chỉnh sửa.
- Hỗ trợ tiếng Việt và Unicode đầy đủ.
- Các thao tác nguy hiểm phải có xác nhận.
- Khi nâng cấp phiên bản, migration phải giữ nguyên dữ liệu cũ.

## 14. Ngoài phạm vi MVP

- Tài khoản, đăng nhập và phân quyền nhiều vai trò.
- Nhiều người chỉnh sửa cùng lúc, đồng bộ giữa nhiều máy.
- Bản web hoặc bản chạy trên máy chủ.
- Cập nhật tự động qua mạng.
- Lớp ghép, môn tự chọn tách nhóm, chia nửa lớp.
- Hai giáo viên cùng dạy một tiết của một lớp.
- Ứng dụng điện thoại riêng.
- Cổng xem lịch dành cho học sinh và phụ huynh.
- Điểm danh hoặc quản lý học sinh.
- Tính lương, thống kê giờ dạy nâng cao.
- AI hội thoại.
- Tự động gửi lịch qua email hoặc ứng dụng nhắn tin.
- Thanh toán và quản lý gói dịch vụ.

Mô hình `TeachingAssignment` cố ý giữ dạng một lớp – một môn – một giáo viên. Các trường hợp ghép lớp và chia nhóm không được hỗ trợ và không cần thiết kế trước.

## 15. Kế hoạch triển khai

### Giai đoạn 0 — Khởi tạo dự án và thu thập dữ liệu

Thời gian dự kiến: 1 tuần.

- Thu thập bộ dữ liệu thật của một trường theo mục 18. Đây là điều kiện bắt buộc để bước sang giai đoạn sau.
- Khởi tạo ứng dụng Electron, React và SQLite.
- Thiết lập migration và dữ liệu mẫu.
- Xây layout, điều hướng và component cơ bản.

Kết quả: ứng dụng chạy được trên máy phát triển và đã có dữ liệu trường thật để đối chiếu.

### Giai đoạn 1 — Khai báo dữ liệu

Thời gian dự kiến: 2–2,5 tuần.

- Trường, năm học và học kỳ.
- CRUD khối, lớp, ngày, tiết, phòng, môn và giáo viên.
- GVCN và phân công giảng dạy.
- Trình khai báo 9 bước.
- Kiểm tra dữ liệu đầu vào.

Kết quả: người dùng khai báo hoàn chỉnh một trường mẫu.

### Giai đoạn 2 — Nhập Excel

Thời gian dự kiến: 1 tuần.

- File mẫu, nhập lớp, môn, giáo viên, phòng và phân công.
- Xem trước, báo lỗi theo dòng.
- Nạp toàn bộ dữ liệu trường thật vào ứng dụng.

Kết quả: có bộ dữ liệu thật trong ứng dụng để phát triển và kiểm thử bộ giải.

### Giai đoạn 3 — Xếp thủ công

Thời gian dự kiến: 2 tuần.

- Lưới thời khóa biểu, xem theo lớp và giáo viên.
- Click/kéo thả tiết, khóa tiết, xóa tiết, đổi chỗ.
- Kiểm tra xung đột tức thời.
- Hoàn tác/làm lại.
- Theo dõi số tiết còn thiếu.

Kết quả: người dùng có thể tự xếp và lưu một thời khóa biểu hợp lệ.

### Giai đoạn 4 — Bộ xếp tự động cơ bản

Thời gian dự kiến: 3 tuần.

- Mô hình OR-Tools và các ràng buộc bắt buộc.
- Tiền kiểm dữ liệu.
- Tiến trình bộ giải, giao thức JSON, tiến độ và hủy.
- Giữ nguyên tiết khóa, xếp theo phạm vi.
- Trả và áp dụng kết quả, báo vô nghiệm kèm nhóm ràng buộc nghi vấn.

Kết quả: hệ thống xếp được lịch hợp lệ cho bộ dữ liệu trường thật.

### Giai đoạn 5 — Tối ưu và tinh chỉnh

Thời gian dự kiến: 2 tuần.

- Các tiêu chí tối ưu và bốn mức ưu tiên.
- Giảm tiết trống, phân bố môn trong tuần.
- Đề xuất di chuyển hoặc đổi tiết.
- Xếp lại phần chưa khóa.
- Lưu và so sánh nhiều phương án.

Kết quả: lịch không chỉ hợp lệ mà có chất lượng sử dụng tốt.

### Giai đoạn 6 — Xuất, in và sao lưu

Thời gian dự kiến: 1,5 tuần.

- Xuất Excel và PDF.
- Bản in theo lớp, giáo viên và toàn trường.
- Sao lưu và khôi phục bằng file.

### Giai đoạn 7 — Đóng gói, phát hành và kiểm thử thực tế

Thời gian dự kiến: 2–3 tuần.

- Đóng gói bộ giải bằng PyInstaller cho hai hệ điều hành.
- Tạo bộ cài bằng electron-builder, kiểm tra kích thước và thời gian khởi động.
- Pipeline CI riêng cho Windows và macOS.
- Ký mã Windows, ký và notarize macOS.
- Kiểm thử với dữ liệu trường thật, sửa lỗi và tối ưu hiệu năng.

Kết quả: MVP có bộ cài chạy được trên máy người dùng thật.

Tổng thời gian dự kiến cho một lập trình viên toàn thời gian: khoảng **14–18 tuần**.

Chi phí cần chuẩn bị trước Giai đoạn 7: tài khoản Apple Developer, chứng chỉ ký mã Windows, và một máy macOS để build bản macOS.

## 16. Thứ tự backlog ưu tiên

### P0 — Bắt buộc có

- Khối, lớp, môn, giáo viên, ngày và tiết.
- GVCN và phân công giảng dạy, số tiết mỗi tuần.
- Nhập Excel dữ liệu danh mục và phân công.
- Lưới thời khóa biểu, xem theo lớp và giáo viên.
- Xếp tay, cảnh báo xung đột, khóa tiết, hoàn tác.
- Tiền kiểm dữ liệu.
- Xếp tự động với các ràng buộc bắt buộc, giữ tiết khóa, xem trước và áp dụng.
- Báo vô nghiệm kèm nhóm ràng buộc nghi vấn.
- Xuất Excel hoặc PDF cơ bản.
- Bộ cài Windows và macOS.

### P1 — Cần có sau P0

- Danh mục phòng và ràng buộc phòng.
- Tiết đôi.
- Tiêu chí tối ưu và bốn mức ưu tiên.
- Đề xuất đổi tiết, xếp lại phần chưa khóa.
- Lưu và so sánh nhiều phương án.
- In toàn trường, tùy chọn khổ giấy.
- Sao lưu và khôi phục.

### P2 — Hoàn thiện sản phẩm

- Sao chép học kỳ.
- Mật khẩu mở ứng dụng.
- Cập nhật tự động.
- Đồng bộ hoặc bản web.

## 17. Tiêu chí nghiệm thu MVP

MVP được xem là hoàn thành khi:

1. Cài đặt và chạy được trên máy Windows và macOS sạch, không cần cài thêm Python.
2. Người dùng tạo được trường, năm học và học kỳ ngay lần chạy đầu.
3. Người dùng nhập được toàn bộ dữ liệu của một trường thật, bằng tay và bằng Excel.
4. Hệ thống phát hiện dữ liệu thiếu hoặc mâu thuẫn trước khi chạy xếp lịch.
5. Người dùng xếp tay mà không tạo được xung đột bắt buộc.
6. Bộ giải tạo được lịch đúng số tiết và không trùng lớp/giáo viên.
7. Các tiết đã khóa không bị thay đổi khi xếp lại.
8. Khi vô nghiệm, hệ thống chỉ ra được nhóm ràng buộc nghi vấn.
9. Người dùng chỉnh sửa được kết quả tự động.
10. Có thể xem lịch theo lớp và giáo viên.
11. Có thể xuất hoặc in lịch.
12. Việc chạy bộ giải thất bại không làm mất dữ liệu hiện tại.
13. Đạt mục tiêu hiệu năng ở mục 13 với dữ liệu trường thật.

## 18. Dữ liệu cần thu thập trước khi lập trình

Phải có ít nhất một bộ dữ liệu thật hoặc gần thật trước khi bắt đầu Giai đoạn 1:

- Danh sách khối và lớp.
- Danh sách môn và số tiết chuẩn.
- Danh sách giáo viên.
- Phân công giảng dạy.
- Ngày, ca và số tiết học.
- Thời gian bận của giáo viên.
- Các trường hợp tiết đôi, phòng chuyên môn và tiết cố định.
- Một thời khóa biểu hiện đang được trường sử dụng để đối chiếu.

Bộ dữ liệu này được dùng để viết kiểm thử và đánh giá chất lượng thuật toán xuyên suốt dự án.

## 19. Đóng gói và phát hành

- Windows: bộ cài `.exe` hoặc `.msi`.
- macOS: `.dmg` cho Apple Silicon và Intel, hoặc bản universal.
- Build từng hệ điều hành bằng pipeline CI riêng.
- Ký mã ứng dụng Windows trước khi phát hành rộng rãi.
- Ký và notarize ứng dụng bằng Apple Developer ID.
- Bộ giải Python được đóng gói kèm trong bộ cài; máy người dùng không cần cài Python hay OR-Tools.
- Dữ liệu người dùng và file SQLite lưu trong thư mục dữ liệu ứng dụng của hệ điều hành.
- Trước mỗi migration quan trọng, ứng dụng tự động tạo một bản sao lưu.
