import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Result, Button, Spin } from 'antd';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <Result
          status="403"
          title="403 - Giới hạn quyền truy cập"
          subTitle={`Tài khoản hiện tại (${user?.name} - Vai trò: ${user?.role}) không có quyền truy cập mục này.`}
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              Quay lại Trang chủ
            </Button>
          }
        />
      </div>
    );
  }

  return children;
};
