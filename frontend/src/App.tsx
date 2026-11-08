/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import 'dayjs/locale/en';

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoomListPage } from './pages/RoomListPage';
import { RoomDetailPage } from './pages/RoomDetailPage';
import { BookingFormPage } from './pages/BookingFormPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { RoomManagementPage } from './pages/RoomManagementPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { EquipmentManagementPage } from './pages/EquipmentManagementPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { PolicySettingsPage } from './pages/PolicySettingsPage';

const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();

  // Dynamically sync dayjs locale
  useEffect(() => {
    dayjs.locale(language === 'vi' ? 'vi' : 'en');
  }, [language]);

  return (
    <ConfigProvider
      locale={language === 'vi' ? viVN : enUS}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#0a84ff' : '#1e40af',
          colorSuccess: isDark ? '#30d158' : '#10b981',
          colorWarning: isDark ? '#ffd60a' : '#f59e0b',
          colorError: isDark ? '#ff453a' : '#ef4444',
          colorInfo: isDark ? '#0a84ff' : '#1e40af',
          colorLink: isDark ? '#0a84ff' : '#1e40af',
          colorTextBase: isDark ? '#ffffff' : '#141b54',
          colorTextSecondary: isDark ? '#a1a1a6' : '#64748b',
          colorTextTertiary: isDark ? '#8e8e93' : '#94a3b8',
          colorTextDescription: isDark ? '#a1a1a6' : '#64748b',
          colorTextPlaceholder: isDark ? '#71717a' : '#94a3b8',
          colorBgBase: isDark ? '#000000' : '#ffffff',
          colorBgContainer: isDark ? '#1c1c1e' : '#ffffff',
          colorBgElevated: isDark ? '#2c2c2e' : '#ffffff',
          colorBgLayout: isDark ? '#000000' : '#f8fafc',
          colorBorder: isDark ? 'rgba(255, 255, 255, 0.20)' : '#e2e8f0',
          colorBorderSecondary: isDark ? 'rgba(255, 255, 255, 0.14)' : '#f1f5f9',
          colorSplit: isDark ? 'rgba(255, 255, 255, 0.16)' : '#f1f5f9',
          borderRadius: 12,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Be Vietnam Pro', Roboto, sans-serif",
        },
        components: {
          Layout: {
            headerBg: isDark ? 'rgba(0, 0, 0, 0.75)' : '#ffffff',
            headerColor: isDark ? '#ffffff' : '#141b54',
            headerPadding: '0 20px',
            siderBg: isDark ? 'rgba(18, 18, 20, 0.85)' : '#ffffff',
            bodyBg: isDark ? '#000000' : '#f8fafc',
          },
          Card: {
            headerFontSize: 14,
            paddingLG: 16,
            colorBgContainer: isDark ? '#1c1c1e' : '#ffffff',
            colorBorderSecondary: isDark ? 'rgba(255, 255, 255, 0.18)' : '#e2e8f0',
          },
          Button: {
            controlHeight: 36,
            borderRadius: 10,
          },
          Table: {
            headerBg: isDark ? '#242426' : '#f8fafc',
            headerColor: isDark ? '#ffffff' : '#141b54',
            rowHoverBg: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#e2e8f0',
            cellPaddingBlock: 12,
            cellPaddingInline: 14,
            fontSize: 13,
          },
          Menu: {
            itemBg: 'transparent',
            itemColor: isDark ? '#a1a1a6' : '#475569',
            itemSelectedColor: isDark ? '#ffffff' : '#1e40af',
            itemSelectedBg: isDark ? 'rgba(10, 132, 255, 0.22)' : '#eff6ff',
            itemHoverColor: isDark ? '#ffffff' : '#1e40af',
            itemHoverBg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f8fafc',
            itemBorderRadius: 10,
          },
          Modal: {
            contentBg: isDark ? '#242426' : '#ffffff',
            headerBg: isDark ? '#242426' : '#ffffff',
            titleColor: isDark ? '#ffffff' : '#141b54',
          },
          Dropdown: {
            colorBgElevated: isDark ? '#2c2c2e' : '#ffffff',
            colorText: isDark ? '#ffffff' : '#141b54',
          },
          Popover: {
            colorBgElevated: isDark ? '#2c2c2e' : '#ffffff',
            colorText: isDark ? '#ffffff' : '#141b54',
          },
          DatePicker: {
            colorBgElevated: isDark ? '#2c2c2e' : '#ffffff',
            colorBgContainer: isDark ? '#1c1c1e' : '#ffffff',
            colorText: isDark ? '#ffffff' : '#141b54',
            colorBorder: isDark ? 'rgba(255, 255, 255, 0.20)' : '#d9d9d9',
            cellHoverBg: isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9',
          },
          Tooltip: {
            colorBgSpotlight: isDark ? '#2c2c2e' : '#1e293b',
            colorTextLightSolid: '#ffffff',
          },
          Select: {
            selectorBg: isDark ? '#1c1c1e' : '#ffffff',
            colorBorder: isDark ? 'rgba(255, 255, 255, 0.20)' : '#d9d9d9',
            colorTextPlaceholder: isDark ? '#71717a' : '#94a3b8',
          },
          Input: {
            colorBgContainer: isDark ? '#1c1c1e' : '#ffffff',
            colorBorder: isDark ? 'rgba(255, 255, 255, 0.20)' : '#d9d9d9',
            colorTextPlaceholder: isDark ? '#71717a' : '#94a3b8',
          },
          Descriptions: {
            colorBgContainer: isDark ? '#1c1c1e' : '#ffffff',
            colorText: isDark ? '#ffffff' : '#141b54',
            colorTextSecondary: isDark ? '#a1a1a6' : '#64748b',
            colorSplit: isDark ? 'rgba(255, 255, 255, 0.16)' : '#f1f5f9',
          },
          Tabs: {
            itemColor: isDark ? '#a1a1a6' : '#64748b',
            itemSelectedColor: isDark ? '#0a84ff' : '#1e40af',
            itemHoverColor: isDark ? '#ffffff' : '#1e40af',
            inkBarColor: isDark ? '#0a84ff' : '#1e40af',
          },
          Segmented: {
            colorBgLayout: isDark ? '#1c1c1e' : '#f1f5f9',
            colorText: isDark ? '#a1a1a6' : '#64748b',
            colorBgElevated: isDark ? '#2c2c2e' : '#ffffff',
          },
          Form: {
            labelColor: isDark ? '#ffffff' : '#141b54',
          },
          Empty: {
            colorTextDescription: isDark ? '#a1a1a6' : '#64748b',
          },
          Divider: {
            colorSplit: isDark ? 'rgba(255, 255, 255, 0.16)' : '#e2e8f0',
          },
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Auth0 callback — Auth0Provider handles token extraction; just navigate home */}
              <Route path="/callback" element={<Navigate to="/dashboard" replace />} />

              {/* Protected App Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="rooms" element={<RoomListPage />} />
                <Route path="rooms/:id" element={<RoomDetailPage />} />
                <Route path="rooms/:id/book" element={<BookingFormPage />} />
                <Route path="book" element={<BookingFormPage />} />
                <Route path="bookings/:bookingId/edit" element={<BookingFormPage />} />
                <Route path="my-bookings" element={<MyBookingsPage />} />
                <Route path="profile" element={<ProfilePage />} />

                {/* Room Manager & Admin route */}
                <Route
                  path="admin/rooms"
                  element={
                    <ProtectedRoute allowedRoles={['ROOM_MANAGER', 'ADMINISTRATOR']}>
                      <RoomManagementPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="admin/equipment"
                  element={
                    <ProtectedRoute allowedRoles={['ROOM_MANAGER', 'ADMINISTRATOR']}>
                      <EquipmentManagementPage />
                    </ProtectedRoute>
                  }
                />

                {/* Administrator only routes */}
                <Route
                  path="admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['ADMINISTRATOR']}>
                      <UserManagementPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="admin/reports"
                  element={
                    <ProtectedRoute allowedRoles={['ADMINISTRATOR']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="admin/audit-logs"
                  element={
                    <ProtectedRoute allowedRoles={['ADMINISTRATOR']}>
                      <AuditLogPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="admin/settings"
                  element={
                    <ProtectedRoute allowedRoles={['ADMINISTRATOR']}>
                      <PolicySettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
