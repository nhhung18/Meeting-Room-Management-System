# Frontend Missing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the two UI features that are missing despite the backend already having working APIs: (1) edit booking flow using `PATCH /api/bookings/{id}`, and (2) proper error/loading/empty states for all pages now calling real APIs.

**Architecture:** BookingFormPage gains an edit mode triggered by route `/bookings/:bookingId/edit`; it fetches the existing booking with `getBookingById`, pre-fills the form, and calls `updateBooking` on submit. A shared `ApiErrorState` component maps `ApiError.status` to user-friendly Vietnamese messages with a retry button for network errors. Both tasks build on the HTTP/API layer from Tasks 1-4.

**Tech Stack:** React 19, TypeScript 7, antd 6, dayjs, Vitest

**Spec:** `docs/superpowers/specs/2026-10-30-frontend-backend-parity-spec.md` (gap A1: updateBooking missing from UI; Review Focus 2–4: error states)

## Global Constraints

- Backend `BookingUpdate` accepts optional: `room_id`, `start_at`, `end_at`, `num_attendees`, `attendees` — all nullable, PATCH semantics
- `purpose` field exists in UI form but NOT in `BookingCreate`/`BookingUpdate` schemas — do not send it
- Only `CONFIRMED` bookings can be edited (backend returns `InvalidStateError` → 409 for CHECKED_IN/CANCELLED)
- All datetime must be timezone-aware (Z suffix); naive → 422
- `limit` max 100, default 20 — client-side filters for userId/startDate/endDate/q
- Code/identifier/commit in English; user-facing strings in Vietnamese
- Equipment/Reports/Profile pages stay on mock — do NOT touch them
- Conventional Commits, one commit per task

## Prerequisite

Tasks 1–4 (HTTP foundation, mappers, rooms API, bookings API) must be done. They are — committed on branch `feat/frontend-api-integration`.

## Review Focus

1. **Edit a CHECKED_IN booking** → backend returns 409 `InvalidStateError`; UI must show "Không thể sửa lịch đã check-in" via ApiErrorState, not crash. (Task 1, Step 1)
2. **Edit with conflicting time** → backend returns 409 overlap; UI must show conflict message in Vietnamese. (Task 1, Step 1)
3. **Backend down during page load** → fetch throws `ApiError(0, …)`; page must show retry button, not spinner forever. (Task 2, Step 1)
4. **Employee opens admin page** → backend returns 403; page must show permission message, not blank. (Task 2, Step 1)
5. **Empty room list** → `items: []`; page must show antd Empty, not crash on `.map`. (Task 2, Step 1)

---

### Task 1: Edit booking flow

**Files:**
- Modify: `frontend/src/App.tsx` (add route `/bookings/:bookingId/edit`)
- Modify: `frontend/src/pages/BookingFormPage.tsx` (edit mode: fetch booking, pre-fill, updateBooking)
- Modify: `frontend/src/pages/MyBookingsPage.tsx` (add edit button for CONFIRMED bookings)
- Modify: `frontend/src/context/LanguageContext.tsx` (add translation keys for edit mode)
- Create: `frontend/src/api/bookings-edit.test.ts`

**Interfaces:**
- Consumes: `getBookingById(id)`, `updateBooking(id, data)`, `getRooms()` from `api/client`; `BookingWriteInput` from `api/bookings`
- Produces: BookingFormPage now handles both create (`/rooms/:id/book`, `/book`) and edit (`/bookings/:bookingId/edit`) modes

- [ ] **Step 1: Write the failing tests**

`frontend/src/api/bookings-edit.test.ts` — integration tests verifying the edit flow calls the right API:

```ts
test('updateBooking PATCHes with only changed fields')
test('updateBooking sends timezone-aware datetimes')
test('updateBooking surfaces ApiError 409 for conflict unchanged')
test('updateBooking surfaces ApiError 409 for invalid state unchanged')
```

These tests verify `updateBooking` handles edit-specific scenarios. The function already exists and has basic tests; these add coverage for edit-mode edge cases from Review Focus 1 and 2.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/api/bookings-edit.test.ts`
Expected: FAIL (or some tests fail if asserting new behavior)

- [ ] **Step 3: Add translation keys**

In `LanguageContext.tsx`, add to both `vi` and `en` blocks:
- `editBookingTitle`: "Chỉnh sửa lịch họp" / "Edit Booking"
- `editBookingSubtitle`: "Thay đổi thông tin cuộc họp đã đặt" / "Update your existing booking"
- `editBookingSuccess`: "Cập nhật lịch họp thành công" / "Booking updated successfully"
- `editBookingBtn`: "Cập nhật" / "Update"
- `actionEditBooking`: "Sửa lịch" / "Edit"
- `errCannotEditStatus`: "Không thể sửa lịch đã check-in hoặc đã hủy" / "Cannot edit checked-in or cancelled bookings"

- [ ] **Step 4: Add the edit route in App.tsx**

Add `<Route path="bookings/:bookingId/edit" element={<BookingFormPage />} />` alongside existing booking routes. Import nothing new — BookingFormPage is already imported.

- [ ] **Step 5: Implement edit mode in BookingFormPage**

Key changes:
1. Extract `bookingId` from `useParams` alongside existing `id` (room id)
2. `const isEditMode = !!bookingId`
3. In `useEffect`: if `isEditMode`, call `getBookingById(Number(bookingId))` to fetch existing booking, then pre-fill form fields (`room_id`, `date`, `start_time`, `end_time`, `num_attendees`, `attendees`). Fetch rooms with `getRooms()` (not just AVAILABLE — the booking's room may be any status).
4. Title/subtitle/button text changes based on `isEditMode` using new translation keys
5. In `onFinish`: if `isEditMode`, call `updateBooking(Number(bookingId), data)` instead of `createBooking(data)`. On success, navigate to `/my-bookings`.
6. Error handling: map 409 to Vietnamese conflict message (existing code already does this for create; reuse for edit)

- [ ] **Step 6: Add edit button on MyBookingsPage**

In the actions column / expanded row of MyBookingsPage, add an edit button (`EditOutlined`) for bookings with `status === 'CONFIRMED'`. On click: `navigate(`/bookings/${booking.id}/edit`)`. Use `t.actionEditBooking` for the tooltip/label.

- [ ] **Step 7: Run tests and lint**

Run: `cd frontend && npm test && npm run lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/BookingFormPage.tsx \
        frontend/src/pages/MyBookingsPage.tsx frontend/src/context/LanguageContext.tsx \
        frontend/src/api/bookings-edit.test.ts
git commit -m "feat(frontend): add edit booking flow using PATCH /api/bookings/{id}"
```

---

### Task 2: ApiErrorState component and page wiring

**Files:**
- Create: `frontend/src/components/ApiErrorState.tsx`
- Create: `frontend/src/components/ApiErrorState.test.ts`
- Modify: `frontend/src/pages/RoomListPage.tsx` (error + empty state)
- Modify: `frontend/src/pages/RoomDetailPage.tsx` (error state)
- Modify: `frontend/src/pages/RoomManagementPage.tsx` (error + empty state)
- Modify: `frontend/src/pages/MyBookingsPage.tsx` (error + empty state)
- Modify: `frontend/src/pages/BookingFormPage.tsx` (error state on room load failure)
- Modify: `frontend/src/pages/DashboardPage.tsx` (error state)
- Modify: `frontend/src/context/LanguageContext.tsx` (error message translations)

**Interfaces:**
- Consumes: `ApiError` from `api/http`
- Produces:
  ```ts
  interface ApiErrorStateProps {
    error: { status: number; detail: string };
    onRetry?: () => void;
  }
  export function ApiErrorState(props: ApiErrorStateProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/ApiErrorState.test.ts` — stub-free, render-free unit tests (node environment, no DOM):

```ts
test('getErrorConfig returns retry message for status 0')         // Review Focus 3
test('getErrorConfig returns permission message for status 403')  // Review Focus 4
test('getErrorConfig returns not-found message for status 404')
test('getErrorConfig returns the server detail for status 409')
test('getErrorConfig returns generic message for unknown status')
```

Since this is a node-env test file (no jsdom), test the mapping logic as a pure function `getErrorConfig(status, detail)` that returns `{ title, showRetry }`. The React component calls this function.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/ApiErrorState.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Add error translation keys**

In `LanguageContext.tsx`, add to both `vi` and `en` blocks:
- `errNetworkTitle`: "Không kết nối được máy chủ" / "Cannot connect to server"
- `errNetworkHint`: "Vui lòng kiểm tra mạng và thử lại" / "Please check your network and try again"
- `errForbiddenTitle`: "Bạn không có quyền xem nội dung này" / "You do not have permission to view this content"
- `errNotFoundTitle`: "Không tìm thấy" / "Not found"
- `errRetryBtn`: "Thử lại" / "Retry"
- `errGenericTitle`: "Đã xảy ra lỗi" / "An error occurred"
- `emptyRooms`: "Chưa có phòng họp nào" / "No meeting rooms found"
- `emptyBookings`: "Chưa có lịch họp nào" / "No bookings found"

- [ ] **Step 4: Implement ApiErrorState component**

Export `getErrorConfig(status: number, detail: string, t: Translations): { title: string; description?: string; showRetry: boolean }` as a pure function (testable), and `ApiErrorState` as the React component using antd `Result` with `getErrorConfig` output.

Status mapping:
- `0` → title: `t.errNetworkTitle`, description: `t.errNetworkHint`, showRetry: true
- `403` → title: `t.errForbiddenTitle`, showRetry: false
- `404` → title: `t.errNotFoundTitle`, showRetry: false
- Other → title: `detail || t.errGenericTitle`, showRetry: true

When `showRetry && onRetry` is provided, render a "Thử lại" button.

- [ ] **Step 5: Wire into the six data pages**

Each page gains:
1. An `error` state: `const [error, setError] = useState<{ status: number; detail: string } | null>(null)`
2. In the catch block of fetch: `setError({ status: err.status ?? 0, detail: err.detail ?? err.message })`
3. Before the main content: `if (error) return <ApiErrorState error={error} onRetry={fetchData} />`
4. For list pages (RoomListPage, RoomManagementPage, MyBookingsPage): when `items.length === 0 && !loading`, show antd `Empty` with appropriate description (`t.emptyRooms` or `t.emptyBookings`)
5. For action failures (cancel/check-in on MyBookingsPage): keep existing `message.error(detail)` — these are inline errors, not full-page errors

Pages to wire: RoomListPage, RoomDetailPage, RoomManagementPage, MyBookingsPage, BookingFormPage, DashboardPage.

Do NOT touch: EquipmentManagementPage, ReportsPage, ProfilePage (they stay on mock).

- [ ] **Step 6: Run tests and lint**

Run: `cd frontend && npm test && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ApiErrorState.tsx frontend/src/components/ApiErrorState.test.ts \
        frontend/src/pages/RoomListPage.tsx frontend/src/pages/RoomDetailPage.tsx \
        frontend/src/pages/RoomManagementPage.tsx frontend/src/pages/MyBookingsPage.tsx \
        frontend/src/pages/BookingFormPage.tsx frontend/src/pages/DashboardPage.tsx \
        frontend/src/context/LanguageContext.tsx
git commit -m "feat(frontend): add ApiErrorState and wire error/empty states to data pages"
```
