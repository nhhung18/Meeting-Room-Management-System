# Cấu hình Harness cơ bản cho Project

> Mục tiêu: cấu hình **tối thiểu** để AI coding agent (Claude Code, Cursor…) hiểu dự án, không làm bậy, và tự kiểm tra được kết quả.
> Không viết agent, không viết code harness — chỉ thêm **4 file** vào repo.
>
> Thời gian: ~30–60 phút.

---

## Harness cơ bản gồm gì?

| # | File | Vai trò | Một câu |
|---|---|---|---|
| 1 | `CLAUDE.md` | **Ngữ cảnh** | Agent cần biết gì về dự án |
| 2 | `scripts/check.sh` | **Kiểm chứng** | Agent tự biết mình làm đúng hay sai |
| 3 | `.claude/settings.json` | **Quyền hạn** | Agent được làm gì, cấm làm gì |
| 4 | `.gitignore` | **Bảo vệ bí mật** | Không lộ key, mật khẩu |

```
my-project/
├── CLAUDE.md
├── .claude/
│   └── settings.json
├── scripts/
│   └── check.sh
├── .githooks/
│   └── pre-commit            # (mục 5, khuyên dùng)
├── .github/workflows/
│   └── ci.yml                # (mục 5, khuyên dùng)
├── .gitignore
├── backend/
└── frontend/
```

Ví dụ dưới đây dùng dự án React + FastAPI. **Thay lệnh, đường dẫn theo dự án thật của bạn.**

---

## 1. `CLAUDE.md` — Ngữ cảnh

Agent đọc file này đầu tiên mỗi phiên. Chỉ ghi những gì agent **không tự suy ra** được từ code. Giữ dưới ~100 dòng.

```markdown
# Meeting Room System

Web đặt phòng họp: xem lịch phòng, đặt, hủy; admin quản lý phòng.

## Stack
- Frontend: React + Vite + TypeScript (`frontend/`)
- Backend: FastAPI + SQLAlchemy + PostgreSQL (`backend/`)

## Lệnh
- Chạy backend: `cd backend && uvicorn app.main:app --reload`
- Chạy frontend: `cd frontend && npm run dev`
- Kiểm tra toàn bộ: `./scripts/check.sh`

## Cấu trúc backend
- `app/api/` — router
- `app/services/` — logic nghiệp vụ
- `app/models/` — database model
- `app/schemas/` — Pydantic schema

## Luật nghiệp vụ quan trọng
- Hai lịch đặt cùng phòng không được trùng giờ
- Chỉ người đặt hoặc admin được hủy

## Quy tắc
- Không sửa migration cũ, luôn tạo migration mới
- Không thêm thư viện mới khi chưa hỏi
- Không xóa hoặc skip test để cho pass

## Khi hoàn thành
- Chạy `./scripts/check.sh` và báo kết quả thật
- Liệt kê các file đã sửa
```

---

## 2. `scripts/check.sh` — Kiểm chứng

Một lệnh duy nhất để agent (và bạn) kiểm tra toàn bộ dự án.

```bash
#!/usr/bin/env bash
set -e

echo "▶ Backend"
(cd backend && ruff check . && pytest -q)

echo "▶ Frontend"
(cd frontend && npm run lint && npx tsc --noEmit)

echo "✅ OK"
```

Cấp quyền chạy:

```bash
chmod +x scripts/check.sh
```

> Chưa có test? Vẫn tạo file này với lint trước, thêm `pytest` khi đã có test. Trên Windows không có bash, có thể dùng `check.ps1` hoặc chạy qua Git Bash.

---

## 3. `.claude/settings.json` — Quyền hạn

- **allow**: chạy luôn, không hỏi
- **deny**: cấm tuyệt đối
- Những lệnh không nằm trong hai danh sách → agent sẽ **hỏi bạn trước**

```json
{
  "permissions": {
    "allow": [
      "Bash(./scripts/check.sh)",
      "Bash(pytest:*)",
      "Bash(npm run lint)",
      "Bash(git status)",
      "Bash(git diff:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)"
    ]
  }
}
```

> Cú pháp theo Claude Code. Nếu dùng công cụ khác (Cursor, Codex), phần quyền hạn cấu hình trong giao diện cài đặt của công cụ đó; `CLAUDE.md` có thể đổi tên/copy thành `AGENTS.md`.

---

## 4. `.gitignore` — Bảo vệ bí mật

Thêm các dòng sau:

```gitignore
.env
.env.*
!.env.example
.claude/settings.local.json
```

Tạo `.env.example` chứa **tên** biến, không chứa giá trị thật:

```
DATABASE_URL=
JWT_SECRET=
```

---

## 5. Pre-commit & CI — Hai lớp kiểm tra tự động (khuyên dùng)

`check.sh` chỉ chạy khi agent **nhớ** chạy. Pre-commit và CI chạy **tự động**, không phụ thuộc agent hay bạn có nhớ hay không.

| | Pre-commit hook | CI (GitHub Actions) |
|---|---|---|
| Chạy ở đâu | Máy của bạn | Server GitHub |
| Khi nào | Mỗi lần `git commit` | Mỗi lần `git push` / tạo PR |
| Chặn được gì | Commit code lỗi | Merge code lỗi |
| Nên chạy | Việc **nhanh** (lint, format) — vài giây | Việc **đầy đủ** (`check.sh` có test) |
| Áp dụng cho | Cả bạn lẫn agent khi commit | Mọi push, kể cả khi code từ điện thoại |

> Đây là hook của **Git/GitHub**, khác với "hooks" trong `.claude/settings.json` (hook của agent, chạy sau mỗi lần agent sửa file). Bản cơ bản chỉ cần hai loại này.

### 5a. Pre-commit hook

Dùng thư mục `.githooks/` (commit được vào repo, khác với `.git/hooks/` không commit được).

**`.githooks/pre-commit`**

```bash
#!/usr/bin/env bash
# Chỉ chạy kiểm tra nhanh. Test đầy đủ để CI lo.
set -e

echo "▶ pre-commit: lint"
(cd backend && ruff check .)
(cd frontend && npm run lint)

echo "✅ pre-commit OK"
```

Kích hoạt (mỗi người clone repo chạy **một lần**):

```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

Ghi lệnh kích hoạt này vào README để thành viên khác (và chính bạn trên máy mới) không quên.

**Chặn agent lách pre-commit** — thêm vào `deny` trong `.claude/settings.json`:

```json
"Bash(git commit --no-verify:*)",
"Bash(git commit -n:*)"
```

> Lựa chọn khác: framework [`pre-commit`](https://pre-commit.com) (Python) hoặc `husky` (Node). Mạnh hơn nhưng thêm dependency — với đồ án, script thuần ở trên là đủ.

### 5b. CI với GitHub Actions

**`.github/workflows/ci.yml`**

```yaml
name: CI
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Cài dependency
        run: |
          pip install -r backend/requirements.txt
          cd frontend && npm ci

      - name: Kiểm tra toàn bộ
        run: ./scripts/check.sh
```

Xem kết quả: tab **Actions** trên GitHub — dấu ✅ hoặc ❌ cạnh mỗi commit.

> Nếu test cần PostgreSQL thật, cần thêm khối `services: postgres` vào job. Nếu test dùng SQLite hoặc mock thì file trên chạy được ngay.

### Luồng hoàn chỉnh

```
Agent sửa code
   ↓
Agent chạy check.sh        ← CLAUDE.md dặn (có thể quên)
   ↓
git commit → pre-commit    ← tự động, chặn lỗi lint
   ↓
git push → CI              ← tự động, chạy test đầy đủ
```

---

## Kiểm tra nhanh sau khi cấu hình

- [ ] Chạy `./scripts/check.sh` thấy pass (hoặc thấy rõ lỗi gì)
- [ ] `.env` không xuất hiện trong `git status`
- [ ] Thử commit một file có lỗi lint → pre-commit chặn lại
- [ ] Push lên GitHub → tab Actions hiện ✅
- [ ] Mở agent, hỏi: *"Dự án này chạy test bằng lệnh gì?"* → agent trả lời đúng theo `CLAUDE.md`

---

## Cách dùng hằng ngày

1. Giao việc cụ thể: *"Thêm API hủy đặt phòng, chỉ người đặt hoặc admin được hủy"*
2. Agent làm xong → nó tự chạy `check.sh`
3. Bạn xem diff những file quan trọng (nhất là logic nghiệp vụ)
4. Agent mắc lỗi lặp lại → **thêm 1 dòng** vào `CLAUDE.md` để sửa đúng lỗi đó

---

## Khi nào nâng cấp?

Bản cơ bản là đủ cho đa số đồ án. Chỉ thêm khi gặp vấn đề thật:

| Gặp vấn đề | Thêm |
|---|---|
| Code bị lệch format liên tục | Hook tự format sau khi sửa file |
| Lặp đi lặp lại một quy trình | Slash command / skill |
| Muốn có bước review độc lập | Subagent reviewer |

---

**Ghi nhớ:** `check.sh` chỉ bảo vệ những gì có test. Với luật nghiệp vụ quan trọng (trùng lịch, phân quyền), hãy tự viết hoặc tự đọc kỹ test — đừng để agent vừa viết code vừa tự chấm điểm.
