import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { Permission } from '../auth/authService';
import { StaffLogin } from './StaffLogin';

interface RequireStaffAuthProps {
  children: React.ReactNode;
  onLoginSuccess: () => void;
  onReturnToStudentSite: () => void;
}

export const RequireStaffAuth: React.FC<RequireStaffAuthProps> = ({
  children,
  onLoginSuccess,
  onReturnToStudentSite,
}) => {
  const { isStaffAuthenticated, can } = useAuth();

  if (!isStaffAuthenticated || !can(Permission.ViewStaffDashboard)) {
    return (
      <StaffLogin
        onLoginSuccess={onLoginSuccess}
        onReturnToStudentSite={onReturnToStudentSite}
      />
    );
  }

  return <>{children}</>;
};
