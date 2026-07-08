# 🤝 NEXUS AI — Code of Conduct

> Bằng cách tham gia dự án NEXUS AI, bạn đồng ý tuân thủ Code of Conduct này.

---

## 🌟 Tiêu chuẩn của chúng tôi

NEXUS AI là dự án mã nguồn mở dành cho cộng đồng **tiếng Việt** (và quốc tế). Chúng tôi cam kết duy trì môi trường:

- ✅ **Chuyên nghiệp** — giao tiếp lịch sự, tôn trọng
- ✅ **Học hỏi** — chia sẻ kiến thức, giúp đỡ người mới
- ✅ **Chuẩn xác** — code + docs phải đúng thực tế, không bịa
- ✅ **Kiến tạo** — đóng góp tính năng, sửa lỗi, cải thiện docs

## 🚫 Hành vi không chấp nhận

- ❌ **Harassment** — quấy rối, công kích cá nhân
- ❌ **Spam / self-promotion** — quảng cáo không liên quan
- ❌ **Plagiarism** — sao chép code không ghi nguồn
- ❌ **AI hallucination trong docs** — khai báo sai tính năng/số liệu không có trong code
- ❌ **Fake claims** — nói "đã xong" khi chưa xong, "đã test" khi chưa test
- ❌ **Breaking changes không thông báo** — sửa API/schema mà không update docs
- ❌ **Bỏ `console.log` trong production code** — dùng `appendLog()` cho AI pipeline

## ✅ Trách nhiệm của Contributor

### Trước khi commit
- [ ] `bun run lint` pass (0 errors)
- [ ] Không có TypeScript errors
- [ ] Test trên mobile + desktop
- [ ] Update docs nếu API/feature thay đổi
- [ ] Conventional commit message (`feat:`, `fix:`, `docs:`, `chore:`)

### Khi viết docs
- **Chuẩn xác trước, đẹp sau** — số liệu phải verify từ source, không ước lượng
- **Code example phải chạy được** — test trước khi paste vào docs
- **Cập nhật khi refactor** — đổi tên file/hàm → update mọi reference
- **Không claim "đã xong" khi chưa xong** — ghi "TODO", "Planned", "WIP" thay vì sai sự thật

### Khi review PR
- **Constructive feedback** — góp ý cụ thể, không phán xét
- **Verify claims** — nếu PR nói "fix bug X", kiểm tra bug X thực sự được fix
- **Kiểm tra docs accuracy** — số model, số endpoint, số agent phải đúng code

## 📐 Nguyên tắc kỹ thuật

1. **KISS** — Keep It Simple, Stupid. Không over-engineer.
2. **DRY** — Don't Repeat Yourself. Tránh code trùng lặp.
3. **SOLID** — Single responsibility cho mỗi module/function.
4. **Type Safety** — TypeScript strict, tránh `any`.
5. **Error Handling** — try-catch mọi route, return `{ error, details }`.
6. **No Silent Failure** — log error, không swallow exception.

## 🔒 Bảo mật

- **Không commit `.env`** — file chứa API keys
- **Không commit `db/custom.db`** — file chứa data user
- **Không hardcode secrets** — dùng env vars
- **Report vulnerability** — email riêng, không public issue

## 🌍 Phạm vi áp dụng

Code of Conduct áp dụng cho:
- GitHub issues + PRs
- Discussions
- Chat (Discord/Telegram nếu có)
- Mọi không gian đại diện dự án

## 📬 Báo cáo vi phạm

Gửi email cho maintainer: **vanhoi04082006@gmail.com**

Mọi báo cáo sẽ được xử lý kín đáo. Retaliation (trả đũa người báo cáo) = vi phạm nghiêm trọng.

## ⚖️ Hậu quả vi phạm

| Mức độ | Hành vi | Hậu quả |
|---|---|---|
| Nhẹ | Spam, off-topic | Warning + xóa comment |
| Vừa | Công kích cá nhân, harassment | Warning + temporary ban (7 ngày) |
| Nặng | Threats, doxxing, plagiarism | Permanent ban |

## 📜 Attribution

Code of Conduct này được điều chỉnh từ [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) + bổ sung quy tắc riêng của NEXUS AI.

---

**License:** MIT · **Version:** 1.0 · **Cập nhật:** 2026-07-08
