import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'vi' | 'en';

export interface Translations {
  // Navigation & Header
  home: string;
  dashboard: string;
  roomList: string;
  calendar: string;
  myBookings: string;
  roomManagement: string;
  reports: string;
  newBooking: string;
  logout: string;
  emailLabel: string;
  roomDeptLabel: string;
  roleLabel: string;
  restoreDemo: string;
  restoreDemoConfirmTitle: string;
  restoreDemoConfirmContent: string;
  lightMode: string;
  darkMode: string;
  switchLang: string;
  adminSection: string;
  roomDetailsBreadcrumb: string;
  mobileNavDashboard: string;
  mobileNavRooms: string;
  mobileNavBook: string;
  mobileNavSchedule: string;
  mobileNavMore: string;

  // Roles
  roleAdmin: string;
  roleManager: string;
  roleEmployee: string;
  roleAdminBadge: string;
  roleManagerBadge: string;
  roleEmployeeBadge: string;

  // Common Actions & Buttons
  bookNow: string;
  viewDetails: string;
  cancel: string;
  close: string;
  confirm: string;
  checkIn: string;
  checkInNow: string;
  checkInSuccess: string;
  checkInFailed: string;
  checkInWindowHint: string;
  back: string;
  edit: string;
  delete: string;
  save: string;
  searchPlaceholder: string;
  allRooms: string;
  all: string;
  refreshData: string;
  clearFilters: string;
  totalRoomsUnit: string;
  totalBookingsUnit: string;
  peopleUnit: string;

  // Statuses
  statusAvailable: string;
  statusOccupied: string;
  statusMaintenance: string;
  statusArchived: string;
  statusConfirmed: string;
  statusCheckedIn: string;
  statusCancelled: string;
  statusUpcoming: string;
  allStatuses: string;

  // Dashboard Page
  welcomeUser: string;
  todayScheduleIndicator: string;
  myScheduleBtn: string;
  statActiveRooms: string;
  statActiveRoomsSub: string;
  statTodayBookings: string;
  statTodayBookingsSub: string;
  statCheckedIn: string;
  statCheckedInSub: string;
  statUtilization: string;
  weeklyScheduleTitle: string;
  weeklyScheduleSub: string;
  noMeetingsOnDate: string;
  upcomingMeetingsTitle: string;
  upcomingMeetingsSub: string;
  viewAllBookings: string;
  noUpcomingMeetings: string;
  needsCheckInNow: string;
  internalWorkMeeting: string;
  dayMon: string;
  dayTue: string;
  dayWed: string;
  dayThu: string;
  dayFri: string;
  daySat: string;
  daySun: string;

  // Room List Page
  roomListTitle: string;
  roomListSubtitle: string;
  filterSearchPlaceholder: string;
  filterCapacityAll: string;
  filterEquipmentLabel: string;
  resetFilterTooltip: string;
  roomPhotoPlaceholder: string;
  roomPhotoHint: string;
  locationLabel: string;
  equipmentCount: string;
  otherEquipmentCount: string;
  otherEquipmentTitle: string;
  roomDetailsBtn: string;
  roomBookNowBtn: string;
  roomUnderMaintenanceBtn: string;
  loadingRooms: string;
  noRoomsFound: string;
  defaultRoomFloor: string;

  // Room Detail Page
  backToRoomList: string;
  backToRoomDetails: string;
  facilityDept: string;
  unassigned: string;
  defaultRoomDescription: string;
  availableAmenities: string;
  bookThisRoomNow: string;
  roomUnderMaintenanceAlert: string;
  calendarToday: string;
  calendarPrevWeek: string;
  calendarNextWeek: string;
  calendarWeekView: string;
  calendarDayView: string;
  calendarNewBooking: string;
  calendarSlotBookHint: string;
  calendarContinuedMeeting: string;
  calendarAvailableSlot: string;
  calendarBookThisSlot: string;
  previewMeetingTitle: string;
  meetingOrganizer: string;
  meetingTimeLabel: string;
  meetingAttendeesLabel: string;
  meetingAttendeeListLabel: string;
  bookThisRoomBtn: string;

  // Booking Form Page
  bookingFormTitle: string;
  bookingFormSubtitle: string;
  fieldRoom: string;
  fieldRoomPlaceholder: string;
  fieldDate: string;
  fieldDatePlaceholder: string;
  fieldStartTime: string;
  fieldStartTimePlaceholder: string;
  fieldEndTime: string;
  fieldEndTimePlaceholder: string;
  fieldAttendeesCount: string;
  fieldPurpose: string;
  fieldPurposePlaceholder: string;
  optionalAttendeesTitle: string;
  optionalAttendeesSub: string;
  attendeeNamePlaceholder: string;
  attendeeEmailPlaceholder: string;
  addAttendeeBtn: string;
  summaryTitle: string;
  summaryRoom: string;
  summaryDate: string;
  summaryTime: string;
  summaryAttendees: string;
  summaryCapacity: string;
  summaryOrganizer: string;
  unselected: string;
  confirmBookingBtn: string;
  cancelBtn: string;
  errEndTimeAfterStart: string;
  errBookingConflict: string;
  errBookingFailed: string;
  bookingSuccess: string;
  errRequiredRoom: string;
  errRequiredDate: string;
  errRequiredStartTime: string;
  errRequiredEndTime: string;
  errRequiredAttendees: string;
  errRequiredPurpose: string;
  errRequiredName: string;
  errRequiredEmail: string;
  errInvalidEmail: string;

  // My Bookings Page
  myBookingsTitle: string;
  myBookingsSubtitle: string;
  tabAll: string;
  tabUpcoming: string;
  tabCheckedIn: string;
  tabCancelled: string;
  colId: string;
  colRoom: string;
  colTime: string;
  colAttendees: string;
  colStatus: string;
  colActions: string;
  cancelBookingConfirmTitle: string;
  cancelBookingConfirmContent: string;
  cancelBookingConfirmWarning: string;
  confirmCancelBtn: string;
  keepBookingBtn: string;
  cancelBookingSuccess: string;
  cancelBookingError: string;
  actionNotYetTime: string;
  meetingDetailHeader: string;
  meetingOrganizerLabel: string;
  createdAtLabel: string;
  actualCheckInLabel: string;
  notYetCheckedIn: string;
  autoCancelLabel: string;
  noValue: string;
  attendeesListLabel: string;
  quickCheckInBtn: string;
  quickCancelBtn: string;

  // Room Management Page
  roomManagementTitle: string;
  roomManagementSubtitle: string;
  addNewRoomBtn: string;
  searchRoomManagementPlaceholder: string;
  actionView: string;
  actionEdit: string;
  actionDelete: string;
  deleteRoomConfirmTitle: string;
  deleteRoomConfirmDesc: string;
  drawerCreateRoomTitle: string;
  drawerEditRoomTitle: string;
  fieldName: string;
  fieldNamePlaceholder: string;
  fieldCapacityNumber: string;
  fieldStatus: string;
  fieldLocationFloor: string;
  fieldLocationFloorPlaceholder: string;
  fieldManagerInCharge: string;
  fieldManagerInChargePlaceholder: string;
  fieldAvailableEquipment: string;
  addCustomEquipmentLabel: string;
  customEquipmentPlaceholder: string;
  addCustomEquipmentBtn: string;
  createRoomSubmitBtn: string;
  saveChangesSubmitBtn: string;
  roomDeleteSuccess: string;
  roomDeleteErrorHasBookings: string;
  roomUpdateSuccess: string;
  roomCreateSuccess: string;
  addedEquipmentSuccess: string;

  // Reports Page
  reportsTitle: string;
  reportsSubtitle: string;
  tabReportsCharts: string;
  tabCompanyHistory: string;
  timeRangeLabel: string;
  range7Days: string;
  range30Days: string;
  rangeQuarter: string;
  kpiTotalBookings: string;
  kpiTotalBookingsSub: string;
  kpiOnTimeRate: string;
  kpiOnTimeRateSub: string;
  kpiCancelRate: string;
  kpiCancelRateSub: string;
  kpiMostPopularRoom: string;
  kpiMostPopularRoomSub: string;
  chartDailyTitle: string;
  chartStatusTitle: string;
  chartTopRoomsTitle: string;
  barConfirmed: string;
  barCheckedIn: string;
  barCancelled: string;
  metricBookingsCount: string;
  filterHistorySearch: string;
  allMeetingRoomsOption: string;
  noDataAvailable: string;

  // Login Page
  loginAppTitle: string;
  loginAppSubtitle: string;
  ssoAuthBoxTitle: string;
  ssoAuthBoxDesc: string;
  loginWithAuth0Btn: string;
  orSelectTestRole: string;
  roleAdminFullAccess: string;
  roleManagerRoomAdmin: string;
  roleEmployeeBookingCheckin: string;
  loginConnecting: string;
  loginSuccess: string;
  instantSyncFeature: string;
  checkIn15mFeature: string;
  blueocSecurityFeature: string;

  // Equipment Management
  equipment: string;
  equipmentManagement: string;
  equipmentSubtitle: string;
  equipmentName: string;
  addNewEquipmentBtn: string;
  equipmentCategoryLabel: string;
  equipmentStatusLabel: string;
  equipmentAssignedRoom: string;
  equipmentSerialLabel: string;
  equipmentNotesLabel: string;
  equipmentInRoomTitle: string;
  unassignedStorage: string;
  deleteEquipmentConfirmTitle: string;
  deleteEquipmentConfirmDesc: string;
  addEquipmentSuccess: string;
  updateEquipmentSuccess: string;
  deleteEquipmentSuccess: string;

  // Profile Management
  myProfile: string;
  profileSubtitle: string;
  displayNameLabel: string;
  departmentLabel: string;
  phoneLabel: string;
  avatarUrlLabel: string;
  choosePresetAvatar: string;
  saveProfileBtn: string;
  profileUpdatedSuccess: string;
  personalBookingStats: string;
  totalBookingsCount: string;
  checkInRateLabel: string;

  // Maintenance Warning
  roomMaintenanceBlocked: string;
  roomMaintenanceWarningBadge: string;

  // Edit Booking
  editBookingTitle: string;
  editBookingSubtitle: string;
  editBookingSuccess: string;
  editBookingBtn: string;
  actionEditBooking: string;
  errCannotEditStatus: string;

  // ApiErrorState & Empty States
  errNetworkTitle: string;
  errNetworkHint: string;
  errForbiddenTitle: string;
  errNotFoundTitle: string;
  errRetryBtn: string;
  errGenericTitle: string;
  emptyRooms: string;
  emptyBookings: string;

  // Multi-room Shared Equipment
  sharedEquipmentBadge: string;
  sharedAcrossRooms: string;
  sharedWithRooms: string;
  selectMultipleRoomsPlaceholder: string;

  // Admin Capabilities: User Management & RBAC
  userManagement: string;
  userManagementSubtitle: string;
  searchUserPlaceholder: string;
  roleFilterLabel: string;
  deptFilterLabel: string;
  statusActiveLabel: string;
  statusSuspendedLabel: string;
  changeRoleConfirmTitle: string;
  changeRoleConfirmDesc: string;
  changeRoleSuccess: string;
  toggleStatusConfirmTitle: string;
  toggleStatusConfirmDesc: string;
  toggleStatusSuccess: string;
  cannotModifySelf: string;
  addNewUserBtn: string;
  createUserSuccess: string;
  colUserInfo: string;
  colUserDept: string;
  colUserRole: string;
  colUserStatus: string;
  colUserAction: string;
  lockAccountBtn: string;
  unlockAccountBtn: string;

  // Admin Capabilities: Audit Logs
  auditLogs: string;
  auditLogsSubtitle: string;
  exportCsvBtn: string;
  exportCsvSuccess: string;
  filterActorLabel: string;
  filterActionLabel: string;
  filterDateRangeLabel: string;
  colLogId: string;
  colLogTime: string;
  colLogActor: string;
  colLogAction: string;
  colLogTarget: string;
  colLogDetails: string;
  emptyAuditLogs: string;

  // Admin Capabilities: Booking Policy Settings
  bookingPolicySettings: string;
  policySubtitle: string;
  sectionBookingTimeLimits: string;
  sectionNoShowProtection: string;
  sectionCancellationPolicy: string;
  maxAdvanceDaysLabel: string;
  maxAdvanceDaysHelp: string;
  maxDurationLabel: string;
  maxDurationHelp: string;
  minDurationLabel: string;
  minDurationHelp: string;
  enableAutoReleaseLabel: string;
  autoReleaseGraceLabel: string;
  autoReleaseGraceHelp: string;
  bufferMinutesLabel: string;
  bufferMinutesHelp: string;
  minCancelNoticeLabel: string;
  minCancelNoticeHelp: string;
  savePolicyBtn: string;
  savePolicySuccess: string;
  resetPolicyBtn: string;
  resetPolicyConfirmTitle: string;
  resetPolicyConfirmDesc: string;
  resetPolicySuccess: string;
  lastUpdatedPolicyLabel: string;
  policyNoticeBanner: string;
  policyMaxAdvanceExceeded: string;
  policyMaxDurationExceeded: string;

  // Admin Capabilities: Room Override
  forceReleaseRoomBtn: string;
  forceReleaseConfirmTitle: string;
  forceReleaseReasonPrompt: string;
  forceReleaseReasonPlaceholder: string;
  forceReleaseSuccess: string;
  toggleMaintenanceBtn: string;
  maintenanceReasonPrompt: string;
  maintenanceReasonPlaceholder: string;
  maintenanceStatusUpdated: string;
  viewRoomBookingsBtn: string;
  adminOverrideBadge: string;
}

const translations: Record<Language, Translations> = {
  vi: {
    // Navigation & Header
    home: 'Trang chủ',
    dashboard: 'Bảng điều khiển',
    roomList: 'Danh sách phòng họp',
    calendar: 'Lịch đặt phòng',
    myBookings: 'Lịch họp của tôi',
    roomManagement: 'Quản lý phòng họp',
    reports: 'Báo cáo & Thống kê',
    newBooking: 'Đặt phòng mới',
    logout: 'Đăng xuất',
    emailLabel: 'Email:',
    roomDeptLabel: 'Phòng:',
    roleLabel: 'Vai trò',
    restoreDemo: 'Khôi phục dữ liệu demo',
    restoreDemoConfirmTitle: 'Khôi phục dữ liệu mẫu ban đầu?',
    restoreDemoConfirmContent: 'Hệ thống sẽ đặt lại toàn bộ phòng và booking về trạng thái demo mặc định của BlueOC Tech.',
    lightMode: 'Giao diện Sáng',
    darkMode: 'Giao diện Tối',
    switchLang: 'Chuyển sang Tiếng Anh',
    adminSection: 'Quản trị',
    roomDetailsBreadcrumb: 'Chi tiết phòng',
    mobileNavDashboard: 'Tổng quan',
    mobileNavRooms: 'Phòng họp',
    mobileNavBook: 'Đặt phòng',
    mobileNavSchedule: 'Lịch họp',
    mobileNavMore: 'Thêm',

    // Roles
    roleAdmin: 'Quản trị viên',
    roleManager: 'Quản lý phòng',
    roleEmployee: 'Nhân viên',
    roleAdminBadge: 'Toàn quyền',
    roleManagerBadge: 'Quản trị phòng',
    roleEmployeeBadge: 'Đặt phòng & Check-in',

    // Common Actions & Buttons
    bookNow: 'Đặt phòng ngay',
    viewDetails: 'Xem chi tiết',
    cancel: 'Hủy',
    close: 'Đóng',
    confirm: 'Xác nhận',
    checkIn: 'Check-in',
    checkInNow: 'Check-in ngay',
    checkInSuccess: 'Check-in thành công! Phòng họp đã được xác nhận.',
    checkInFailed: 'Check-in thất bại',
    checkInWindowHint: 'Chỉ mở trước và sau giờ bắt đầu ±15 phút',
    back: 'Quay lại',
    edit: 'Sửa',
    delete: 'Xóa',
    save: 'Lưu thay đổi',
    searchPlaceholder: 'Tìm kiếm phòng họp theo tên, địa điểm...',
    allRooms: 'Tất cả phòng',
    all: 'Tất cả',
    refreshData: 'Làm mới dữ liệu',
    clearFilters: 'Xóa bộ lọc',
    totalRoomsUnit: 'phòng họp',
    totalBookingsUnit: 'lượt đặt',
    peopleUnit: 'người',

    // Statuses
    statusAvailable: 'Đang hoạt động',
    statusOccupied: 'Đang họp',
    statusMaintenance: 'Đang bảo trì',
    statusArchived: 'Lưu trữ',
    statusConfirmed: 'Đã xác nhận',
    statusCheckedIn: 'Đã check-in',
    statusCancelled: 'Đã hủy',
    statusUpcoming: 'Sắp tới',
    allStatuses: 'Tất cả trạng thái',

    // Dashboard Page
    welcomeUser: 'Chào mừng,',
    todayScheduleIndicator: 'Lịch làm việc hôm nay',
    myScheduleBtn: 'Lịch của tôi',
    statActiveRooms: 'Phòng hoạt động',
    statActiveRoomsSub: 'Sẵn sàng nhận lịch',
    statTodayBookings: 'Booking hôm nay',
    statTodayBookingsSub: 'Cuộc họp được lên lịch',
    statCheckedIn: 'Đã check-in',
    statCheckedInSub: 'Đúng chuẩn ±15 phút',
    statUtilization: 'Tỷ lệ sử dụng',
    weeklyScheduleTitle: 'Lịch họp trong tuần',
    weeklyScheduleSub: 'Bấm chọn ngày để xem danh sách các phiên hội nghị',
    noMeetingsOnDate: 'Không có phiên họp nào vào ngày',
    upcomingMeetingsTitle: 'Booking của bạn sắp tới',
    upcomingMeetingsSub: 'Danh sách các cuộc họp sắp bắt đầu, hỗ trợ điểm danh check-in trực tiếp',
    viewAllBookings: 'Xem tất cả booking',
    noUpcomingMeetings: 'Bạn chưa có cuộc họp nào sắp bắt đầu',
    needsCheckInNow: 'Cần Check-in ngay',
    internalWorkMeeting: 'Họp công việc nội bộ',
    dayMon: 'Thứ 2',
    dayTue: 'Thứ 3',
    dayWed: 'Thứ 4',
    dayThu: 'Thứ 5',
    dayFri: 'Thứ 6',
    daySat: 'Thứ 7',
    daySun: 'CN',

    // Room List Page
    roomListTitle: 'Danh sách phòng họp',
    roomListSubtitle: 'Hệ thống phòng họp thông minh BlueOC Tech — tìm kiếm, lọc theo thiết bị và đặt chỗ nhanh',
    filterSearchPlaceholder: 'Tìm tên phòng, thiết bị, vị trí...',
    filterCapacityAll: 'Sức chứa: Tất cả',
    filterEquipmentLabel: 'Thiết bị:',
    resetFilterTooltip: 'Đặt lại bộ lọc',
    roomPhotoPlaceholder: 'Khu vực thêm ảnh phòng',
    roomPhotoHint: '(Bấm để xem chi tiết & thêm ảnh)',
    locationLabel: 'Vị trí:',
    equipmentCount: 'Thiết bị',
    otherEquipmentCount: 'thiết bị',
    otherEquipmentTitle: 'Thiết bị khác',
    roomDetailsBtn: 'Chi tiết phòng',
    roomBookNowBtn: 'Đặt ngay',
    roomUnderMaintenanceBtn: 'Đang bảo trì',
    loadingRooms: 'Đang tải danh sách phòng họp...',
    noRoomsFound: 'Không tìm thấy phòng họp nào phù hợp với bộ lọc',
    defaultRoomFloor: 'Tầng 3 - Tòa nhà BlueOC Tech',

    // Room Detail Page
    backToRoomList: 'Quay lại danh sách phòng',
    backToRoomDetails: 'Quay lại chi tiết phòng',
    facilityDept: 'Ban CSVC',
    unassigned: 'Chưa phân công',
    defaultRoomDescription: 'Không gian họp tiêu chuẩn doanh nghiệp với hạ tầng mạng gigabit, trang bị đầy đủ công nghệ cho các cuộc họp trực tiếp và hybrid.',
    availableAmenities: 'Trang thiết bị sẵn có',
    bookThisRoomNow: 'Đặt phòng này ngay',
    roomUnderMaintenanceAlert: 'Phòng đang bảo trì (Không thể đặt)',
    calendarToday: 'Hôm nay',
    calendarPrevWeek: 'Tuần trước',
    calendarNextWeek: 'Tuần tiếp theo',
    calendarWeekView: 'Cả tuần',
    calendarDayView: 'Theo ngày',
    calendarNewBooking: 'Đặt lịch mới',
    calendarSlotBookHint: '* Bấm vào khung giờ để đặt phòng ngay',
    calendarContinuedMeeting: '(tiếp tục cuộc họp)',
    calendarAvailableSlot: 'Khung giờ trống (Bấm để đặt)',
    calendarBookThisSlot: 'Đặt giờ này',
    previewMeetingTitle: 'Chi tiết phiên họp',
    meetingOrganizer: 'Người đặt:',
    meetingTimeLabel: 'Thời gian:',
    meetingAttendeesLabel: 'Số lượng tham dự:',
    meetingAttendeeListLabel: 'Thành viên tham dự',
    bookThisRoomBtn: 'Đặt lịch phòng này',

    // Booking Form Page
    bookingFormTitle: 'Đặt phòng họp mới',
    bookingFormSubtitle: 'Điền thông tin khung giờ, mục đích và người tham dự để xác nhận phòng hội nghị BlueOC Tech',
    fieldRoom: 'Phòng họp',
    fieldRoomPlaceholder: 'Chọn phòng họp...',
    fieldDate: 'Ngày họp',
    fieldDatePlaceholder: 'Chọn ngày họp',
    fieldStartTime: 'Bắt đầu',
    fieldStartTimePlaceholder: 'Chọn giờ bắt đầu (vd: 17:00)',
    fieldEndTime: 'Kết thúc',
    fieldEndTimePlaceholder: 'Chọn giờ kết thúc (vd: 17:30)',
    fieldAttendeesCount: 'Số lượng tham dự',
    fieldPurpose: 'Mục đích / Tiêu đề cuộc họp',
    fieldPurposePlaceholder: 'Ví dụ: Sprint Planning, Họp điều hành...',
    optionalAttendeesTitle: 'Thành viên tham dự (Optional)',
    optionalAttendeesSub: 'Thêm email đồng nghiệp để gửi thư mời và thông báo phòng họp',
    attendeeNamePlaceholder: 'Họ và tên người tham gia',
    attendeeEmailPlaceholder: 'email@congty.com',
    addAttendeeBtn: 'Thêm người tham dự',
    summaryTitle: 'Tóm tắt thông tin đặt phòng',
    summaryRoom: 'Phòng họp',
    summaryDate: 'Ngày họp',
    summaryTime: 'Khung giờ',
    summaryAttendees: 'Quy mô',
    summaryCapacity: 'Sức chứa tối đa',
    summaryOrganizer: 'Người tạo',
    unselected: 'Chưa chọn',
    confirmBookingBtn: 'Xác nhận đặt phòng',
    cancelBtn: 'Hủy',
    errEndTimeAfterStart: 'Giờ kết thúc phải sau giờ bắt đầu',
    errBookingConflict: 'Phòng đã có người đặt trong khung giờ này. Vui lòng chọn giờ hoặc phòng khác.',
    errBookingFailed: 'Không thể hoàn tất đặt phòng. Vui lòng thử lại.',
    bookingSuccess: 'Đặt phòng họp thành công!',
    errRequiredRoom: 'Vui lòng chọn phòng họp',
    errRequiredDate: 'Vui lòng chọn ngày họp',
    errRequiredStartTime: 'Chọn giờ bắt đầu',
    errRequiredEndTime: 'Chọn giờ kết thúc',
    errRequiredAttendees: 'Vui lòng nhập số người tham dự',
    errRequiredPurpose: 'Vui lòng nhập mục đích cuộc họp',
    errRequiredName: 'Nhập họ tên',
    errRequiredEmail: 'Nhập email',
    errInvalidEmail: 'Email không hợp lệ',

    // My Bookings Page
    myBookingsTitle: 'Lịch họp của tôi',
    myBookingsSubtitle: 'Theo dõi, quản lý và thực hiện điểm danh check-in các cuộc họp của bạn tại BlueOC Tech',
    tabAll: 'Tất cả',
    tabUpcoming: 'Sắp tới',
    tabCheckedIn: 'Đã check-in',
    tabCancelled: 'Đã hủy',
    colId: 'Mã số',
    colRoom: 'Phòng họp',
    colTime: 'Thời gian',
    colAttendees: 'Số người',
    colStatus: 'Trạng thái',
    colActions: 'Hành động',
    cancelBookingConfirmTitle: 'Hủy lịch đặt phòng này?',
    cancelBookingConfirmContent: 'Bạn có chắc chắn muốn hủy lịch họp phòng',
    cancelBookingConfirmWarning: 'Hành động này sẽ giải phóng phòng cho người khác và không thể hoàn tác.',
    confirmCancelBtn: 'Xác nhận hủy',
    keepBookingBtn: 'Giữ lại',
    cancelBookingSuccess: 'Đã hủy lịch đặt phòng thành công',
    cancelBookingError: 'Lỗi khi hủy lịch',
    actionNotYetTime: 'Chưa đến giờ',
    meetingDetailHeader: 'Chi tiết cuộc họp',
    meetingOrganizerLabel: 'Người đặt',
    createdAtLabel: 'Thời gian tạo',
    actualCheckInLabel: 'Check-in thực tế',
    notYetCheckedIn: 'Chưa check-in',
    autoCancelLabel: 'Tự động hủy nếu vắng mặt',
    noValue: 'Không',
    attendeesListLabel: 'Danh sách người tham dự',
    quickCheckInBtn: 'Check-in ngay',
    quickCancelBtn: 'Hủy lịch',

    // Room Management Page
    roomManagementTitle: 'Quản lý phòng họp',
    roomManagementSubtitle: 'Thêm mới, cấu hình trạng thái hoạt động và cập nhật trang thiết bị các phòng họp',
    addNewRoomBtn: 'Thêm phòng họp',
    searchRoomManagementPlaceholder: 'Tìm theo tên phòng, trang thiết bị, vị trí...',
    actionView: 'Xem',
    actionEdit: 'Sửa',
    actionDelete: 'Xóa',
    deleteRoomConfirmTitle: 'Xóa phòng họp này?',
    deleteRoomConfirmDesc: 'Bạn có chắc muốn xóa vĩnh viễn phòng này?',
    drawerCreateRoomTitle: 'Tạo phòng họp mới',
    drawerEditRoomTitle: 'Chỉnh sửa phòng',
    fieldName: 'Tên phòng họp',
    fieldNamePlaceholder: 'Ví dụ: Phòng họp Hội An (VIP)',
    fieldCapacityNumber: 'Sức chứa (người)',
    fieldStatus: 'Trạng thái',
    fieldLocationFloor: 'Vị trí / Tầng',
    fieldLocationFloorPlaceholder: 'Ví dụ: Tầng 3 - Tòa nhà BlueOC Tech',
    fieldManagerInCharge: 'Quản lý phụ trách',
    fieldManagerInChargePlaceholder: 'Ví dụ: Trần Thị Mai',
    fieldAvailableEquipment: 'Thiết bị sẵn có',
    addCustomEquipmentLabel: 'Thêm thiết bị chuyên dụng khác:',
    customEquipmentPlaceholder: 'Nhập thiết bị...',
    addCustomEquipmentBtn: 'Thêm',
    createRoomSubmitBtn: 'Tạo phòng',
    saveChangesSubmitBtn: 'Lưu thay đổi',
    roomDeleteSuccess: 'Đã xóa phòng thành công',
    roomDeleteErrorHasBookings: 'Không thể xóa phòng đang có lịch đặt sắp tới. Hãy chuyển trạng thái sang Bảo trì hoặc Hủy lịch trước.',
    roomUpdateSuccess: 'Cập nhật phòng thành công',
    roomCreateSuccess: 'Tạo phòng họp mới thành công',
    addedEquipmentSuccess: 'Đã thêm thiết bị',

    // Reports Page
    reportsTitle: 'Báo cáo & Thống kê',
    reportsSubtitle: 'Tổng hợp chỉ số hiệu suất phòng họp, tần suất sử dụng và lịch sử hội nghị toàn công ty',
    tabReportsCharts: 'Báo cáo & Biểu đồ',
    tabCompanyHistory: 'Lịch sử đặt phòng toàn công ty',
    timeRangeLabel: 'Khoảng thời gian phân tích:',
    range7Days: '7 ngày qua',
    range30Days: '30 ngày qua',
    rangeQuarter: 'Quý này (90 ngày)',
    kpiTotalBookings: 'Tổng booking',
    kpiTotalBookingsSub: 'Số lượt đặt trong kỳ',
    kpiOnTimeRate: 'Đúng giờ',
    kpiOnTimeRateSub: 'Check-in ±15 phút',
    kpiCancelRate: 'Tỷ lệ hủy',
    kpiCancelRateSub: 'Hủy trước giờ họp',
    kpiMostPopularRoom: 'Phổ biến nhất',
    kpiMostPopularRoomSub: 'Lượng đặt cao nhất',
    chartDailyTitle: 'Số booking theo ngày (7 ngày gần nhất)',
    chartStatusTitle: 'Phân bố trạng thái booking',
    chartTopRoomsTitle: 'Top 5 phòng họp được đặt nhiều nhất',
    barConfirmed: 'Đã xác nhận',
    barCheckedIn: 'Đã check-in',
    barCancelled: 'Đã hủy',
    metricBookingsCount: 'Số lượt đặt',
    filterHistorySearch: 'Tìm theo phòng, tên người đặt, mục đích...',
    allMeetingRoomsOption: 'Tất cả phòng họp',
    noDataAvailable: 'Chưa có dữ liệu',

    // Login Page
    loginAppTitle: 'Hệ thống quản lý phòng họp',
    loginAppSubtitle: 'Nền tảng đặt phòng, quản lý thiết bị và báo cáo hội nghị thông minh',
    ssoAuthBoxTitle: 'Xác thực Doanh nghiệp (SSO)',
    ssoAuthBoxDesc: 'Tích hợp Auth0 Single Sign-On (JWT Token). Hỗ trợ 3 vai trò: Nhân viên, Quản lý phòng & Quản trị viên.',
    loginWithAuth0Btn: 'Đăng nhập với Auth0',
    orSelectTestRole: 'Hoặc chọn vai trò thử nghiệm nhanh',
    roleAdminFullAccess: 'Quản trị viên (Admin)',
    roleManagerRoomAdmin: 'Quản lý phòng (Manager)',
    roleEmployeeBookingCheckin: 'Nhân viên (Employee)',
    loginConnecting: 'Đang kết nối xác thực Auth0...',
    loginSuccess: 'Đăng nhập thành công qua Auth0!',
    instantSyncFeature: 'Đồng bộ tức thì',
    checkIn15mFeature: 'Check-in ±15p',
    blueocSecurityFeature: 'Bảo mật BlueOC',

    // Equipment Management
    equipment: 'Quản lý thiết bị',
    equipmentManagement: 'Quản lý thiết bị',
    equipmentSubtitle: 'Quản lý, phân bổ và theo dõi tình trạng thiết bị hội nghị tại các phòng',
    equipmentName: 'Tên thiết bị',
    addNewEquipmentBtn: 'Thêm thiết bị mới',
    equipmentCategoryLabel: 'Loại thiết bị',
    equipmentStatusLabel: 'Tình trạng',
    equipmentAssignedRoom: 'Phòng phân bổ',
    equipmentSerialLabel: 'Số sê-ri / Mã tài sản',
    equipmentNotesLabel: 'Ghi chú & cấu hình',
    equipmentInRoomTitle: 'Thiết bị phòng họp',
    unassignedStorage: 'Chưa phân bổ (Lưu kho IT)',
    deleteEquipmentConfirmTitle: 'Xác nhận xóa thiết bị này?',
    deleteEquipmentConfirmDesc: 'Hành động này sẽ gỡ thiết bị khỏi danh mục và phòng họp hiện tại.',
    addEquipmentSuccess: 'Đã thêm thiết bị mới thành công',
    updateEquipmentSuccess: 'Đã cập nhật thông tin thiết bị',
    deleteEquipmentSuccess: 'Đã xóa thiết bị thành công',

    // Profile Management
    myProfile: 'Hồ sơ cá nhân',
    profileSubtitle: 'Quản lý thông tin tài khoản và tùy chỉnh hồ sơ của bạn',
    displayNameLabel: 'Họ và tên',
    departmentLabel: 'Khối / Phòng ban',
    phoneLabel: 'Số điện thoại',
    avatarUrlLabel: 'Ảnh đại diện',
    choosePresetAvatar: 'Chọn ảnh đại diện mẫu',
    saveProfileBtn: 'Lưu thay đổi',
    profileUpdatedSuccess: 'Cập nhật hồ sơ cá nhân thành công!',
    personalBookingStats: 'Thống kê hoạt động cá nhân',
    totalBookingsCount: 'Tổng lượt đặt phòng',
    checkInRateLabel: 'Tỷ lệ check-in',

    // Maintenance Warning
    roomMaintenanceBlocked: 'Phòng đang bảo trì, tạm thời ngưng nhận đặt phòng',
    roomMaintenanceWarningBadge: 'Đang bảo trì - Tạm ngưng hoạt động',

    // Edit Booking
    editBookingTitle: 'Chỉnh sửa lịch họp',
    editBookingSubtitle: 'Thay đổi thông tin cuộc họp đã đặt',
    editBookingSuccess: 'Cập nhật lịch họp thành công',
    editBookingBtn: 'Cập nhật',
    actionEditBooking: 'Sửa lịch',
    errCannotEditStatus: 'Không thể sửa lịch đã check-in hoặc đã hủy',

    // ApiErrorState & Empty States
    errNetworkTitle: 'Không kết nối được máy chủ',
    errNetworkHint: 'Vui lòng kiểm tra mạng và thử lại',
    errForbiddenTitle: 'Bạn không có quyền xem nội dung này',
    errNotFoundTitle: 'Không tìm thấy dữ liệu',
    errRetryBtn: 'Thử lại',
    errGenericTitle: 'Đã xảy ra lỗi',
    emptyRooms: 'Chưa có phòng họp nào phù hợp',
    emptyBookings: 'Chưa có lịch họp nào',

    // Multi-room Shared Equipment
    sharedEquipmentBadge: 'Thiết bị dùng chung',
    sharedAcrossRooms: 'Phân bổ cho nhiều phòng',
    sharedWithRooms: 'Dùng chung với',
    selectMultipleRoomsPlaceholder: 'Chọn các phòng phân bổ thiết bị (có thể chọn nhiều phòng)...',

    // Admin Capabilities: User Management & RBAC
    userManagement: 'Quản lý người dùng & Phân quyền',
    userManagementSubtitle: 'Danh sách nhân sự, phân bổ vai trò hệ thống và quản lý trạng thái tài khoản',
    searchUserPlaceholder: 'Tìm kiếm theo tên, email hoặc phòng ban...',
    roleFilterLabel: 'Lọc theo vai trò',
    deptFilterLabel: 'Lọc theo phòng ban',
    statusActiveLabel: 'Hoạt động',
    statusSuspendedLabel: 'Đã khóa',
    changeRoleConfirmTitle: 'Xác nhận thay đổi vai trò người dùng?',
    changeRoleConfirmDesc: 'Bạn có chắc chắn muốn thay đổi vai trò của người dùng này?',
    changeRoleSuccess: 'Cập nhật vai trò người dùng thành công',
    toggleStatusConfirmTitle: 'Xác nhận thay đổi trạng thái tài khoản?',
    toggleStatusConfirmDesc: 'Bạn có chắc chắn muốn thay đổi trạng thái hoạt động của tài khoản này?',
    toggleStatusSuccess: 'Cập nhật trạng thái tài khoản thành công',
    cannotModifySelf: 'Bạn không thể thay đổi vai trò hoặc tự khóa tài khoản của chính mình',
    addNewUserBtn: 'Thêm người dùng mới',
    createUserSuccess: 'Tạo tài khoản người dùng mới thành công',
    colUserInfo: 'Nhân viên / Email',
    colUserDept: 'Phòng ban & Điện thoại',
    colUserRole: 'Vai trò hệ thống',
    colUserStatus: 'Trạng thái',
    colUserAction: 'Thao tác',
    lockAccountBtn: 'Khóa tài khoản',
    unlockAccountBtn: 'Mở khóa',

    // Admin Capabilities: Audit Logs
    auditLogs: 'Nhật ký hoạt động (Audit Log)',
    auditLogsSubtitle: 'Truy vết toàn diện lịch sử thay đổi phòng, hủy lịch, cấp quyền và chính sách',
    exportCsvBtn: 'Xuất file CSV',
    exportCsvSuccess: 'Đã xuất dữ liệu nhật ký thành file CSV thành công',
    filterActorLabel: 'Người thực hiện',
    filterActionLabel: 'Loại hành động',
    filterDateRangeLabel: 'Khoảng thời gian',
    colLogId: 'Mã Log',
    colLogTime: 'Thời gian thực hiện',
    colLogActor: 'Người thao tác',
    colLogAction: 'Hành động',
    colLogTarget: 'Đối tượng tác động',
    colLogDetails: 'Chi tiết thay đổi',
    emptyAuditLogs: 'Không có bản ghi nhật ký nào phù hợp với bộ lọc',

    // Admin Capabilities: Booking Policy Settings
    bookingPolicySettings: 'Cấu hình quy định đặt phòng',
    policySubtitle: 'Thiết lập các giới hạn thời gian, tự động hủy và chính sách vận hành toàn công ty',
    sectionBookingTimeLimits: '1. Quy định thời gian & Thời lượng',
    sectionNoShowProtection: '2. Tự động giải phóng phòng (No-Show Protection)',
    sectionCancellationPolicy: '3. Quy định hủy lịch & Giờ đệm',
    maxAdvanceDaysLabel: 'Số ngày cho phép đặt trước tối đa',
    maxAdvanceDaysHelp: 'Nhân viên chỉ có thể lên lịch họp trong phạm vi số ngày này kể từ hôm nay',
    maxDurationLabel: 'Thời lượng cuộc họp tối đa một lần (phút)',
    maxDurationHelp: 'Giới hạn thời gian của mỗi cuộc họp để tránh chiếm dụng phòng quá lâu',
    minDurationLabel: 'Thời lượng cuộc họp tối thiểu (phút)',
    minDurationHelp: 'Khoảng thời gian họp ngắn nhất cho phép',
    enableAutoReleaseLabel: 'Bật cơ chế tự động hủy lịch nếu không check-in',
    autoReleaseGraceLabel: 'Thời gian ân hạn tự hủy sau giờ bắt đầu (phút)',
    autoReleaseGraceHelp: 'Nếu sau số phút này kể từ giờ họp mà chủ phòng chưa Check-in, phòng sẽ được tự động giải phóng',
    bufferMinutesLabel: 'Thời gian đệm dọn dẹp giữa các cuộc họp (phút)',
    bufferMinutesHelp: 'Khoảng thời gian nghỉ giữa 2 cuộc họp liên tiếp tại cùng một phòng',
    minCancelNoticeLabel: 'Thời hạn tối thiểu hủy lịch trước giờ họp (phút)',
    minCancelNoticeHelp: 'Yêu cầu hủy lịch trước giờ bắt đầu để nhân viên khác kịp sử dụng',
    savePolicyBtn: 'Lưu quy định',
    savePolicySuccess: 'Cập nhật quy định đặt phòng toàn hệ thống thành công',
    resetPolicyBtn: 'Khôi phục mặc định',
    resetPolicyConfirmTitle: 'Khôi phục quy định về mặc định?',
    resetPolicyConfirmDesc: 'Toàn bộ các thông số chính sách sẽ được trả về thiết lập tiêu chuẩn của hệ thống.',
    resetPolicySuccess: 'Đã khôi phục quy định đặt phòng về mặc định thành công',
    lastUpdatedPolicyLabel: 'Cập nhật lần cuối:',
    policyNoticeBanner: 'Quy định công ty áp dụng:',
    policyMaxAdvanceExceeded: 'Ngày đặt phòng vượt quá giới hạn cho phép của công ty (tối đa {max} ngày)',
    policyMaxDurationExceeded: 'Thời lượng cuộc họp vượt quá giới hạn tối đa cho phép ({max} phút)',

    // Admin Capabilities: Room Override
    forceReleaseRoomBtn: 'Cưỡng chế giải phóng phòng',
    forceReleaseConfirmTitle: 'Cưỡng chế giải phóng phòng họp này?',
    forceReleaseReasonPrompt: 'Nhập lý do giải phóng phòng (sẽ được ghi nhận vào Audit Log):',
    forceReleaseReasonPlaceholder: 'Ví dụ: Cuộc họp đã kết thúc sớm, đối tác hoãn lịch, giải phóng khẩn cấp...',
    forceReleaseSuccess: 'Đã cưỡng chế giải phóng phòng thành công',
    toggleMaintenanceBtn: 'Chuyển trạng thái bảo trì',
    maintenanceReasonPrompt: 'Nhập lý do bảo trì hoặc ghi chú hoàn tất bảo trì:',
    maintenanceReasonPlaceholder: 'Ví dụ: Thay dây HDMI, sửa điều hòa, vệ sinh thiết bị định kỳ...',
    maintenanceStatusUpdated: 'Cập nhật trạng thái bảo trì phòng thành công',
    viewRoomBookingsBtn: 'Xem toàn bộ lịch họp của phòng',
    adminOverrideBadge: 'Quyền Quản trị viên',
  },
  en: {
    // Navigation & Header
    home: 'Home',
    dashboard: 'Dashboard',
    roomList: 'Meeting Rooms',
    calendar: 'Schedule Calendar',
    myBookings: 'My Bookings',
    roomManagement: 'Room Management',
    reports: 'Reports & Analytics',
    newBooking: 'New Booking',
    logout: 'Log Out',
    emailLabel: 'Email:',
    roomDeptLabel: 'Dept:',
    roleLabel: 'Role',
    restoreDemo: 'Reset Demo Data',
    restoreDemoConfirmTitle: 'Reset to demo default data?',
    restoreDemoConfirmContent: 'The system will reset all rooms and bookings to default BlueOC Tech demo state.',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    switchLang: 'Chuyển sang Tiếng Việt',
    adminSection: 'Admin',
    roomDetailsBreadcrumb: 'Room Details',
    mobileNavDashboard: 'Dashboard',
    mobileNavRooms: 'Rooms',
    mobileNavBook: 'Book',
    mobileNavSchedule: 'Schedule',
    mobileNavMore: 'More',

    // Roles
    roleAdmin: 'Administrator',
    roleManager: 'Room Manager',
    roleEmployee: 'Employee',
    roleAdminBadge: 'Full Access',
    roleManagerBadge: 'Room Admin',
    roleEmployeeBadge: 'Booking & Check-in',

    // Common Actions & Buttons
    bookNow: 'Book Now',
    viewDetails: 'View Details',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    checkIn: 'Check-in',
    checkInNow: 'Check-in Now',
    checkInSuccess: 'Check-in successful! Room status verified.',
    checkInFailed: 'Check-in failed',
    checkInWindowHint: 'Available within ±15 minutes of meeting start time',
    back: 'Back',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save Changes',
    searchPlaceholder: 'Search rooms by name, location...',
    allRooms: 'All Rooms',
    all: 'All',
    refreshData: 'Refresh Data',
    clearFilters: 'Clear Filters',
    totalRoomsUnit: 'meeting rooms',
    totalBookingsUnit: 'bookings',
    peopleUnit: 'attendees',

    // Statuses
    statusAvailable: 'Available',
    statusOccupied: 'In Meeting',
    statusMaintenance: 'Under Maintenance',
    statusArchived: 'Archived',
    statusConfirmed: 'Upcoming',
    statusCheckedIn: 'Checked In',
    statusCancelled: 'Cancelled',
    statusUpcoming: 'Upcoming',
    allStatuses: 'All Statuses',

    // Dashboard Page
    welcomeUser: 'Welcome,',
    todayScheduleIndicator: "Today's Schedule",
    myScheduleBtn: 'My Schedule',
    statActiveRooms: 'Active Rooms',
    statActiveRoomsSub: 'Ready for booking',
    statTodayBookings: "Today's Bookings",
    statTodayBookingsSub: 'Scheduled meetings',
    statCheckedIn: 'Checked In',
    statCheckedInSub: 'On-time ±15 min',
    statUtilization: 'Utilization Rate',
    weeklyScheduleTitle: 'Weekly Meeting Schedule',
    weeklyScheduleSub: 'Select a day to view conference sessions',
    noMeetingsOnDate: 'No meetings scheduled on',
    upcomingMeetingsTitle: 'Your Upcoming Meetings',
    upcomingMeetingsSub: 'Sessions starting soon with direct check-in attendance',
    viewAllBookings: 'View all bookings',
    noUpcomingMeetings: 'You have no meetings scheduled soon',
    needsCheckInNow: 'Check-in Required',
    internalWorkMeeting: 'Internal Team Meeting',
    dayMon: 'Mon',
    dayTue: 'Tue',
    dayWed: 'Wed',
    dayThu: 'Thu',
    dayFri: 'Fri',
    daySat: 'Sat',
    daySun: 'Sun',

    // Room List Page
    roomListTitle: 'Meeting Rooms',
    roomListSubtitle: 'BlueOC Tech intelligent meeting spaces — search, filter by equipment, and book instantly',
    filterSearchPlaceholder: 'Search room name, equipment, floor...',
    filterCapacityAll: 'Capacity: All',
    filterEquipmentLabel: 'Equipment:',
    resetFilterTooltip: 'Reset filters',
    roomPhotoPlaceholder: 'Room Photo Preview Slot',
    roomPhotoHint: '(Click to view details & manage photos)',
    locationLabel: 'Location:',
    equipmentCount: 'Equipment',
    otherEquipmentCount: 'more',
    otherEquipmentTitle: 'Other Equipment',
    roomDetailsBtn: 'Room Details',
    roomBookNowBtn: 'Book Now',
    roomUnderMaintenanceBtn: 'Under Maintenance',
    loadingRooms: 'Loading meeting rooms...',
    noRoomsFound: 'No rooms match your filter criteria',
    defaultRoomFloor: '3rd Floor - BlueOC Tech Tower',

    // Room Detail Page
    backToRoomList: 'Back to Room List',
    backToRoomDetails: 'Back to Room Details',
    facilityDept: 'Facility Ops',
    unassigned: 'Unassigned',
    defaultRoomDescription: 'Enterprise conference space equipped with gigabit network infrastructure, interactive displays, and audio solutions for hybrid collaboration.',
    availableAmenities: 'Available Amenities',
    bookThisRoomNow: 'Book This Room Now',
    roomUnderMaintenanceAlert: 'Room Under Maintenance (Booking Disabled)',
    calendarToday: 'Today',
    calendarPrevWeek: 'Previous Week',
    calendarNextWeek: 'Next Week',
    calendarWeekView: 'Week View',
    calendarDayView: 'Day View',
    calendarNewBooking: 'New Booking',
    calendarSlotBookHint: '* Click any time slot to book instantly',
    calendarContinuedMeeting: '(meeting continues)',
    calendarAvailableSlot: 'Available Slot (Click to Book)',
    calendarBookThisSlot: 'Book This Slot',
    previewMeetingTitle: 'Meeting Session Details',
    meetingOrganizer: 'Organizer:',
    meetingTimeLabel: 'Time:',
    meetingAttendeesLabel: 'Attendees Count:',
    meetingAttendeeListLabel: 'Attendee Members',
    bookThisRoomBtn: 'Book This Room',

    // Booking Form Page
    bookingFormTitle: 'Book a Meeting Room',
    bookingFormSubtitle: 'Specify schedule, purpose, and attendee list to confirm your BlueOC Tech conference room',
    fieldRoom: 'Meeting Room',
    fieldRoomPlaceholder: 'Select a room...',
    fieldDate: 'Meeting Date',
    fieldDatePlaceholder: 'Select date',
    fieldStartTime: 'Start Time',
    fieldStartTimePlaceholder: 'Select start time (e.g. 17:00)',
    fieldEndTime: 'End Time',
    fieldEndTimePlaceholder: 'Select end time (e.g. 17:30)',
    fieldAttendeesCount: 'Attendee Count',
    fieldPurpose: 'Meeting Purpose / Title',
    fieldPurposePlaceholder: 'e.g., Sprint Planning, Executive Review...',
    optionalAttendeesTitle: 'Additional Attendees (Optional)',
    optionalAttendeesSub: 'Add colleague emails to send automated invites and room notifications',
    attendeeNamePlaceholder: 'Full name of attendee',
    attendeeEmailPlaceholder: 'colleague@company.com',
    addAttendeeBtn: 'Add Attendee',
    summaryTitle: 'Booking Summary Preview',
    summaryRoom: 'Room',
    summaryDate: 'Date',
    summaryTime: 'Time Slot',
    summaryAttendees: 'Attendees',
    summaryCapacity: 'Max Capacity',
    summaryOrganizer: 'Organizer',
    unselected: 'Not selected',
    confirmBookingBtn: 'Confirm Booking',
    cancelBtn: 'Cancel',
    errEndTimeAfterStart: 'End time must be strictly after start time',
    errBookingConflict: 'The room is already booked for this time slot. Please choose another time or room.',
    errBookingFailed: 'Could not complete booking. Please try again.',
    bookingSuccess: 'Meeting room booked successfully!',
    errRequiredRoom: 'Please select a meeting room',
    errRequiredDate: 'Please select a meeting date',
    errRequiredStartTime: 'Please select start time',
    errRequiredEndTime: 'Please select end time',
    errRequiredAttendees: 'Please enter attendee count',
    errRequiredPurpose: 'Please enter meeting purpose',
    errRequiredName: 'Enter attendee name',
    errRequiredEmail: 'Enter attendee email',
    errInvalidEmail: 'Invalid email address',

    // My Bookings Page
    myBookingsTitle: 'My Bookings',
    myBookingsSubtitle: 'Track, manage, and complete attendance check-in for your meetings at BlueOC Tech',
    tabAll: 'All',
    tabUpcoming: 'Upcoming',
    tabCheckedIn: 'Checked In',
    tabCancelled: 'Cancelled',
    colId: 'ID',
    colRoom: 'Meeting Room',
    colTime: 'Schedule',
    colAttendees: 'Attendees',
    colStatus: 'Status',
    colActions: 'Actions',
    cancelBookingConfirmTitle: 'Cancel this booking?',
    cancelBookingConfirmContent: 'Are you sure you want to cancel the booking for',
    cancelBookingConfirmWarning: 'This action will release the room for others and cannot be undone.',
    confirmCancelBtn: 'Cancel Booking',
    keepBookingBtn: 'Keep Booking',
    cancelBookingSuccess: 'Booking cancelled successfully',
    cancelBookingError: 'Error cancelling booking',
    actionNotYetTime: 'Not Yet Time',
    meetingDetailHeader: 'Meeting Details',
    meetingOrganizerLabel: 'Organizer',
    createdAtLabel: 'Created At',
    actualCheckInLabel: 'Actual Check-in',
    notYetCheckedIn: 'Not checked in',
    autoCancelLabel: 'Auto-cancel on no-show',
    noValue: 'None',
    attendeesListLabel: 'Attendee Members',
    quickCheckInBtn: 'Check-in Now',
    quickCancelBtn: 'Cancel',

    // Room Management Page
    roomManagementTitle: 'Room Management',
    roomManagementSubtitle: 'Add new rooms, configure operational status, and maintain room equipment',
    addNewRoomBtn: 'Add New Room',
    searchRoomManagementPlaceholder: 'Search room by name, equipment, floor...',
    actionView: 'View',
    actionEdit: 'Edit',
    actionDelete: 'Delete',
    deleteRoomConfirmTitle: 'Delete this meeting room?',
    deleteRoomConfirmDesc: 'Are you sure you want to permanently delete this room?',
    drawerCreateRoomTitle: 'Create New Meeting Room',
    drawerEditRoomTitle: 'Edit Meeting Room',
    fieldName: 'Room Name',
    fieldNamePlaceholder: 'e.g., Hoi An VIP Conference Room',
    fieldCapacityNumber: 'Capacity (Attendees)',
    fieldStatus: 'Status',
    fieldLocationFloor: 'Location / Floor',
    fieldLocationFloorPlaceholder: 'e.g., 3rd Floor - BlueOC Tech Tower',
    fieldManagerInCharge: 'Manager In Charge',
    fieldManagerInChargePlaceholder: 'e.g., Tran Thi Mai',
    fieldAvailableEquipment: 'Available Equipment',
    addCustomEquipmentLabel: 'Add other custom equipment:',
    customEquipmentPlaceholder: 'Enter equipment name...',
    addCustomEquipmentBtn: 'Add',
    createRoomSubmitBtn: 'Create Room',
    saveChangesSubmitBtn: 'Save Changes',
    roomDeleteSuccess: 'Room deleted successfully',
    roomDeleteErrorHasBookings: 'Cannot delete a room that has upcoming bookings. Please set status to Maintenance or cancel bookings first.',
    roomUpdateSuccess: 'Room updated successfully',
    roomCreateSuccess: 'New room created successfully',
    addedEquipmentSuccess: 'Equipment added',

    // Reports Page
    reportsTitle: 'Reports & Analytics',
    reportsSubtitle: 'Comprehensive conference metrics, utilization frequency, and enterprise booking history',
    tabReportsCharts: 'Reports & Charts',
    tabCompanyHistory: 'Company-wide Booking History',
    timeRangeLabel: 'Analysis Time Range:',
    range7Days: 'Last 7 Days',
    range30Days: 'Last 30 Days',
    rangeQuarter: 'This Quarter (90 Days)',
    kpiTotalBookings: 'Total Bookings',
    kpiTotalBookingsSub: 'Bookings in period',
    kpiOnTimeRate: 'On-Time Check-in',
    kpiOnTimeRateSub: 'Check-in ±15m',
    kpiCancelRate: 'Cancellation Rate',
    kpiCancelRateSub: 'Cancelled before start',
    kpiMostPopularRoom: 'Most Booked',
    kpiMostPopularRoomSub: 'Highest booking volume',
    chartDailyTitle: 'Daily Bookings (Last 7 Days)',
    chartStatusTitle: 'Booking Status Distribution',
    chartTopRoomsTitle: 'Top 5 Most Booked Meeting Rooms',
    barConfirmed: 'Upcoming',
    barCheckedIn: 'Checked In',
    barCancelled: 'Cancelled',
    metricBookingsCount: 'Bookings Count',
    filterHistorySearch: 'Search room, organizer, purpose...',
    allMeetingRoomsOption: 'All Meeting Rooms',
    noDataAvailable: 'No data available',

    // Login Page
    loginAppTitle: 'Meeting Room Management System',
    loginAppSubtitle: 'Smart booking, equipment management, and conference analytics platform',
    ssoAuthBoxTitle: 'Enterprise Authentication (SSO)',
    ssoAuthBoxDesc: 'Integrated Auth0 Single Sign-On (JWT Token). Supports 3 roles: Employee, Room Manager & Administrator.',
    loginWithAuth0Btn: 'Log In with Auth0',
    orSelectTestRole: 'Or select a quick test role',
    roleAdminFullAccess: 'Administrator (Admin)',
    roleManagerRoomAdmin: 'Room Manager (Manager)',
    roleEmployeeBookingCheckin: 'Employee (Employee)',
    loginConnecting: 'Connecting to Auth0 authentication...',
    loginSuccess: 'Successfully logged in with Auth0!',
    instantSyncFeature: 'Instant Sync',
    checkIn15mFeature: 'Check-in ±15m',
    blueocSecurityFeature: 'BlueOC Security',

    // Equipment Management
    equipment: 'Equipment',
    equipmentManagement: 'Equipment Management',
    equipmentSubtitle: 'Manage, assign, and track status of conference equipment in all rooms',
    equipmentName: 'Equipment Name',
    addNewEquipmentBtn: 'Add New Equipment',
    equipmentCategoryLabel: 'Category',
    equipmentStatusLabel: 'Status',
    equipmentAssignedRoom: 'Assigned Room',
    equipmentSerialLabel: 'Serial Number / Asset Tag',
    equipmentNotesLabel: 'Notes & Configuration',
    equipmentInRoomTitle: 'Room Equipment',
    unassignedStorage: 'Unassigned (IT Storage)',
    deleteEquipmentConfirmTitle: 'Delete this equipment item?',
    deleteEquipmentConfirmDesc: 'This will remove the equipment from the catalog and the current meeting room.',
    addEquipmentSuccess: 'Successfully added new equipment',
    updateEquipmentSuccess: 'Equipment information updated',
    deleteEquipmentSuccess: 'Successfully deleted equipment',

    // Profile Management
    myProfile: 'My Profile',
    profileSubtitle: 'Manage your personal account information and settings',
    displayNameLabel: 'Display Name',
    departmentLabel: 'Department / Unit',
    phoneLabel: 'Phone Number',
    avatarUrlLabel: 'Avatar',
    choosePresetAvatar: 'Choose Preset Avatar',
    saveProfileBtn: 'Save Changes',
    profileUpdatedSuccess: 'Profile updated successfully!',
    personalBookingStats: 'Personal Activity Statistics',
    totalBookingsCount: 'Total Bookings',
    checkInRateLabel: 'Check-in Rate',

    // Maintenance Warning
    roomMaintenanceBlocked: 'Room is under maintenance, booking temporarily disabled',
    roomMaintenanceWarningBadge: 'Under Maintenance - Temporarily Disabled',

    // Edit Booking
    editBookingTitle: 'Edit Booking',
    editBookingSubtitle: 'Update your existing booking information',
    editBookingSuccess: 'Booking updated successfully',
    editBookingBtn: 'Update',
    actionEditBooking: 'Edit',
    errCannotEditStatus: 'Cannot edit checked-in or cancelled bookings',

    // ApiErrorState & Empty States
    errNetworkTitle: 'Cannot connect to server',
    errNetworkHint: 'Please check your network and try again',
    errForbiddenTitle: 'You do not have permission to view this content',
    errNotFoundTitle: 'Not found',
    errRetryBtn: 'Retry',
    errGenericTitle: 'An error occurred',
    emptyRooms: 'No meeting rooms found',
    emptyBookings: 'No bookings found',

    // Multi-room Shared Equipment
    sharedEquipmentBadge: 'Shared Equipment',
    sharedAcrossRooms: 'Shared across multiple rooms',
    sharedWithRooms: 'Shared with',
    selectMultipleRoomsPlaceholder: 'Select rooms to assign equipment (multiple selectable)...',

    // Admin Capabilities: User Management & RBAC
    userManagement: 'User Management & Permissions',
    userManagementSubtitle: 'Manage team directory, assign system roles, and govern account access',
    searchUserPlaceholder: 'Search by name, email or department...',
    roleFilterLabel: 'Filter by role',
    deptFilterLabel: 'Filter by department',
    statusActiveLabel: 'Active',
    statusSuspendedLabel: 'Suspended',
    changeRoleConfirmTitle: 'Confirm change user role?',
    changeRoleConfirmDesc: 'Are you sure you want to change the system role for this user?',
    changeRoleSuccess: 'User role updated successfully',
    toggleStatusConfirmTitle: 'Confirm toggle account status?',
    toggleStatusConfirmDesc: 'Are you sure you want to change this account access status?',
    toggleStatusSuccess: 'Account access status updated successfully',
    cannotModifySelf: 'You cannot change the role or lock your own administrator account',
    addNewUserBtn: 'Add New User',
    createUserSuccess: 'User account created successfully',
    colUserInfo: 'Employee / Email',
    colUserDept: 'Department & Phone',
    colUserRole: 'System Role',
    colUserStatus: 'Status',
    colUserAction: 'Action',
    lockAccountBtn: 'Suspend Account',
    unlockAccountBtn: 'Reactivate',

    // Admin Capabilities: Audit Logs
    auditLogs: 'System Audit Logs',
    auditLogsSubtitle: 'Comprehensive audit trail of room edits, force cancellations, permissions, and policies',
    exportCsvBtn: 'Export CSV',
    exportCsvSuccess: 'Audit logs exported to CSV successfully',
    filterActorLabel: 'Actor',
    filterActionLabel: 'Action Type',
    filterDateRangeLabel: 'Date Range',
    colLogId: 'Log ID',
    colLogTime: 'Timestamp',
    colLogActor: 'Actor',
    colLogAction: 'Action',
    colLogTarget: 'Target Entity',
    colLogDetails: 'Details',
    emptyAuditLogs: 'No audit logs found matching the filter criteria',

    // Admin Capabilities: Booking Policy Settings
    bookingPolicySettings: 'Booking Policy & Rules',
    policySubtitle: 'Configure booking timeframes, auto-cancellation grace periods, and organization rules',
    sectionBookingTimeLimits: '1. Booking Time & Duration Limits',
    sectionNoShowProtection: '2. No-Show Auto-Release Protection',
    sectionCancellationPolicy: '3. Cancellation Notice & Meeting Buffer',
    maxAdvanceDaysLabel: 'Maximum advance booking window (days)',
    maxAdvanceDaysHelp: 'Employees can only schedule meetings up to this many days into the future',
    maxDurationLabel: 'Maximum meeting duration (minutes)',
    maxDurationHelp: 'Caps single booking length to prevent excessive room reservation',
    minDurationLabel: 'Minimum meeting duration (minutes)',
    minDurationHelp: 'Smallest reservation interval allowed',
    enableAutoReleaseLabel: 'Enable auto-cancellation if no check-in',
    autoReleaseGraceLabel: 'No-show grace period after start (minutes)',
    autoReleaseGraceHelp: 'Releases the room automatically if organizer does not check in within this time',
    bufferMinutesLabel: 'Buffer cleaning time between meetings (minutes)',
    bufferMinutesHelp: 'Cooldown buffer required between back-to-back reservations in the same room',
    minCancelNoticeLabel: 'Minimum cancellation notice before start (minutes)',
    minCancelNoticeHelp: 'Advance notice required to cancel so others can utilize the room',
    savePolicyBtn: 'Save Policies',
    savePolicySuccess: 'Organization booking policies updated successfully',
    resetPolicyBtn: 'Reset to Defaults',
    resetPolicyConfirmTitle: 'Reset policies to default?',
    resetPolicyConfirmDesc: 'All booking policies will revert to standard factory settings.',
    resetPolicySuccess: 'Booking policies reverted to default settings successfully',
    lastUpdatedPolicyLabel: 'Last updated:',
    policyNoticeBanner: 'Company Booking Rules:',
    policyMaxAdvanceExceeded: 'Reservation date exceeds company advance window (max {max} days)',
    policyMaxDurationExceeded: 'Meeting length exceeds maximum allowed duration ({max} minutes)',

    // Admin Capabilities: Room Override
    forceReleaseRoomBtn: 'Force Release Room',
    forceReleaseConfirmTitle: 'Force release this meeting room?',
    forceReleaseReasonPrompt: 'Enter release reason (will be recorded in audit log):',
    forceReleaseReasonPlaceholder: 'e.g. Meeting ended early, organizer no-show, emergency reallocation...',
    forceReleaseSuccess: 'Meeting room force-released successfully',
    toggleMaintenanceBtn: 'Toggle Maintenance Status',
    maintenanceReasonPrompt: 'Enter maintenance reason or completion notes:',
    maintenanceReasonPlaceholder: 'e.g. HDMI cable replacement, AC maintenance, routine inspection...',
    maintenanceStatusUpdated: 'Room maintenance status updated successfully',
    viewRoomBookingsBtn: 'View All Room Bookings',
    adminOverrideBadge: 'Administrator Override',
  },
};

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'blueoc_mrms_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'vi' || saved === 'en') return saved;
      return 'vi';
    } catch {
      return 'vi';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      document.documentElement.lang = language;
    } catch (e) {
      console.warn('Cannot persist language to localStorage', e);
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'vi' ? 'en' : 'vi'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        toggleLanguage,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
