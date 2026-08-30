# TKB – Phần mềm xếp thời khóa biểu

Ứng dụng desktop chạy offline để khai báo dữ liệu trường, xếp thời khóa biểu thủ công và tự động.

## Tính năng chính

- Khai báo khối, lớp, ngày/tiết, phòng, môn, giáo viên và phân công giảng dạy.
- Xếp tay theo lớp hoặc giáo viên bằng click, kéo-thả, đổi chỗ, hoàn tác/làm lại.
- Khay môn bên dưới lưới hiển thị giáo viên, số tiết đã xếp và số tiết còn thiếu.
- Chế độ toàn trường theo từng lớp hoặc ma trận tổng quan; lọc theo khối.
- Khóa tiết/lớp để giữ nguyên khi chỉnh tay hoặc chạy tự động.
- Xếp tự động theo phạm vi lớp, khối hoặc toàn trường.
- Bộ giải CP-SAT tìm lịch hợp lệ, sau đó dùng LNS để cải thiện các tiêu chí mềm mà không phá ràng buộc cứng.
- Kiểm tra xung đột giáo viên, lớp, phòng và thời gian bận theo thời gian thực.
- Nhập/xuất dữ liệu Excel và sao lưu dữ liệu cục bộ.

## Công nghệ

- Electron + React + TypeScript + Tailwind CSS.
- SQLite cục bộ với `better-sqlite3` và Drizzle ORM.
- Python OR-Tools CP-SAT/LNS cho xếp lịch tự động.
- pnpm là package manager mặc định.

## Cài đặt và chạy

Yêu cầu: Node.js 20+, pnpm và Python 3.10+.

```bash
pnpm install
pnpm dev
```

Ứng dụng tạo cơ sở dữ liệu riêng trên máy người dùng; không cần tài khoản hoặc Internet khi sử dụng.

## Kiểm thử và build

```bash
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` chạy bộ kiểm thử solver và tích hợp backend với SQLite.

## Đóng gói ứng dụng

```bash
pnpm build:mac
pnpm build:win
```

## Ghi chú dữ liệu

Thư mục `outputs/`, các file cơ sở dữ liệu cục bộ và artefact build được loại khỏi Git. Không đưa dữ liệu trường thật hoặc thông tin nhạy cảm lên repository.
