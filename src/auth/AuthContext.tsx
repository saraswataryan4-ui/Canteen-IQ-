import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut, signInWithCustomToken, } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../firebase';
import {
  hasStaffPermission,
  Permission,
  serverStaffAuthAdapter,
  StaffSession,
  StaffSignInResult,
  UserRole,
} from './authService';
import { AuditLog, CustomerAccount, StaffMember } from '../types';

export const BOOTSTRAP_ADMIN_EMAILS = [
  'saraswataryan2312@gmail.com',
  'saraswataryan87@gmail.com',
];
export const BOOTSTRAP_ADMIN_EMAIL = 'saraswataryan87@gmail.com';
const CUSTOMER_STORAGE_KEY = 'canteeniq_active_customer_v1';

interface AuthContextValue {
  user: User | null;
  customer: CustomerAccount | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  // loginWithEmailOtp: (account: CustomerAccount) => void;
  loginWithEmailOtp: (
    account: CustomerAccount,
    firebaseCustomToken: string
  ) => Promise<void>;
  updateCustomerPhone: (phone: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  staffSession: StaffSession | null;
  currentRole: UserRole;
  isStaffAuthenticated: boolean;
  loginStaff: (staffId: string, passcode: string) => Promise<StaffSignInResult>;
  logoutStaff: () => Promise<void>;
  can: (permission: Permission) => boolean;
  staffList: StaffMember[];
  auditLogs: AuditLog[];
  fetchStaffList: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;
  createStaffMember: (data: {
    name: string;
    email: string;
    passcode?: string;
    role: string;
    permissions: string[];
  }) => Promise<StaffMember>;
  toggleStaffStatus: (staffId: string, status: 'active' | 'inactive') => Promise<void>;
  updateStaffMember: (staffId: string, data: Partial<StaffMember>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerAccount | null>(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CustomerAccount) : null;
    } catch {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() => {
    return serverStaffAuthAdapter.getCurrentSession();
  });
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Synchronize Google Auth and admin rights
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      // Sync customer account on backend
      try {
        const resp = await fetch('/api/auth/customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email,
            uid: currentUser.uid,
            name: currentUser.displayName || currentUser.email?.split('@')[0],
            provider: 'google.com',
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.customer) {
            setCustomer(data.customer);
            localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(data.customer));
          }
        }
      } catch (err) {
        console.warn('Customer account sync notice:', err);
      }

      // Check admin status:
      // 1. Matches runtime owner email
      // 2. Or has document in Firestore /admins/{uid}
      const isOwnerEmail =
        Boolean(currentUser.email) &&
        BOOTSTRAP_ADMIN_EMAILS.some(
          (m) => m.toLowerCase() === currentUser.email?.toLowerCase().trim()
        );

      if (isOwnerEmail) {
        setIsAdmin(true);
        setAuthLoading(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(adminDoc.exists());
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStaffList = async () => {
    try {
      const resp = await fetch('/api/staff');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.staff)) {
          setStaffList(data.staff);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch staff list:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const resp = await fetch('/api/audit-logs');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err);
    }
  };

  useEffect(() => {
    fetchStaffList();
    fetchAuditLogs();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      throw err;
    }
  };

  // const loginWithEmailOtp = (account: CustomerAccount) => {
  //   setCustomer(account);
  //   try {
  //     localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(account));
  //   } catch {
  //     // Ignore storage exception
  //   }
  // };
  const loginWithEmailOtp = async (
    account: CustomerAccount,
    firebaseCustomToken: string
  ): Promise<void> => {
    await signInWithCustomToken(auth, firebaseCustomToken);

    setCustomer(account);

    try {
      localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify(account)
      );
    } catch {
      // Ignore storage exception
    }
  };

  const updateCustomerPhone = async (phone: string) => {
    if (!customer) return;
    const updated: CustomerAccount = { ...customer, phone };
    setCustomer(updated);
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updated));
      await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customer.email,
          uid: customer.uid,
          phone,
        }),
      });
    } catch (err) {
      console.warn('Failed to update customer phone:', err);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    setUser(null);
    setCustomer(null);
    setIsAdmin(false);
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Dedicated Staff Sign-in against backend /api/staff/login
  const loginStaff = async (
    staffId: string,
    passcode: string
  ): Promise<StaffSignInResult> => {
    const result = await serverStaffAuthAdapter.signInStaff(staffId, passcode);
    if (result.ok && result.session) {
      setStaffSession(result.session);
    }
    return result;
  };

  const logoutStaff = async (): Promise<void> => {
    await serverStaffAuthAdapter.signOutStaff();
    setStaffSession(null);
  };

  // Synthesize admin session if logged in with Admin Google Account
  const effectiveStaffSession: StaffSession | null = isAdmin && user
    ? {
        userId: user.uid,
        staffId: user.email?.split('@')[0].toUpperCase() || 'ADMIN',
        displayName: user.displayName || user.email || 'Administrator',
        roleTitle: 'Canteen Operations Lead',
        role: UserRole.Staff,
        permissions: [
          Permission.ViewStaffDashboard,
          Permission.UpdateOrderStatus,
          Permission.ManageInventory,
          Permission.ManageTables,
          Permission.ResetDemoData,
          Permission.ManageStaff,
        ],
        issuedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isDemoOnly: false,
        status: 'active',
      }
    : staffSession;

  const can = (permission: Permission): boolean => {
    if (isAdmin) return true;
    return hasStaffPermission(effectiveStaffSession, permission);
  };

  const createStaffMember = async (data: {
    name: string;
    email: string;
    passcode?: string;
    role: string;
    permissions: string[];
  }): Promise<StaffMember> => {
    const resp = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        adminEmail: user?.email || BOOTSTRAP_ADMIN_EMAIL,
      }),
    });
    const resData = await resp.json();
    if (!resp.ok || !resData.ok) {
      throw new Error(resData.error || 'Failed to create staff member');
    }
    await fetchStaffList();
    await fetchAuditLogs();
    return resData.staff;
  };

  const toggleStaffStatus = async (staffId: string, status: 'active' | 'inactive') => {
    const resp = await fetch(`/api/staff/${encodeURIComponent(staffId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        adminEmail: user?.email || BOOTSTRAP_ADMIN_EMAIL,
      }),
    });
    const resData = await resp.json();
    if (!resp.ok || !resData.ok) {
      throw new Error(resData.error || 'Failed to update staff status');
    }
    // If the currently logged in staff member was deactivated, terminate their session immediately
    if (staffSession && staffSession.staffId.toUpperCase() === staffId.toUpperCase() && status === 'inactive') {
      await logoutStaff();
    }
    await fetchStaffList();
    await fetchAuditLogs();
  };

  const updateStaffMember = async (staffId: string, data: Partial<StaffMember>) => {
    const resp = await fetch(`/api/staff/${encodeURIComponent(staffId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        adminEmail: user?.email || BOOTSTRAP_ADMIN_EMAIL,
      }),
    });
    const resData = await resp.json();
    if (!resp.ok || !resData.ok) {
      throw new Error(resData.error || 'Failed to edit staff member');
    }
    await fetchStaffList();
    await fetchAuditLogs();
  };

  const isAuthenticated = Boolean(user || customer);
  const isStaffAuthenticated = Boolean(isAdmin || (staffSession && staffSession.status !== 'inactive'));

  const value: AuthContextValue = {
    user,
    customer,
    isAuthenticated,
    isAdmin,
    authLoading,
    signInWithGoogle,
    loginWithEmailOtp,
    updateCustomerPhone,
    signOutUser,
    staffSession: effectiveStaffSession,
    currentRole: isStaffAuthenticated ? UserRole.Staff : UserRole.Student,
    isStaffAuthenticated,
    loginStaff,
    logoutStaff,
    can,
    staffList,
    auditLogs,
    fetchStaffList,
    fetchAuditLogs,
    createStaffMember,
    toggleStaffStatus,
    updateStaffMember,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
