import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check login status on mount
  useEffect(() => {
    async function loadStudent() {
      const accessToken = localStorage.getItem('etqan_access_token');
      if (accessToken) {
        try {
          // Fetch student profile info
          const res = await api.get('/students/me');
          if (res.data && res.data.success) {
            // Depending on response shape, it might return data or data.data
            const studentData = res.data.data || res.data.me || res.data.data?.student;
            setStudent(studentData);
            localStorage.setItem('etqan_student_data', JSON.stringify(studentData));
          } else {
            clearAuth();
          }
        } catch (e) {
          console.error('Failed to load student profile', e);
          // Try loading from localStorage if network fails
          const cached = localStorage.getItem('etqan_student_data');
          if (cached) {
            setStudent(JSON.parse(cached));
          } else {
            clearAuth();
          }
        }
      }
      setLoading(false);
    }

    loadStudent();

    // Listen to unauthorized event from API interceptor
    const handleUnauthorized = () => {
      setStudent(null);
    };
    window.addEventListener('etqan_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('etqan_unauthorized', handleUnauthorized);
    };
  }, []);

  const clearAuth = () => {
    localStorage.removeItem('etqan_access_token');
    localStorage.removeItem('etqan_refresh_token');
    localStorage.removeItem('etqan_student_data');
    setStudent(null);
  };

  // Login handler
  const login = async (loginId, password) => {
    try {
      const res = await api.post('/students/login', {
        login: loginId,
        password: password
      });

      if (res.data && res.data.success) {
        const { accessToken, refreshToken, data } = res.data;
        localStorage.setItem('etqan_access_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('etqan_refresh_token', refreshToken);
        }
        localStorage.setItem('etqan_student_data', JSON.stringify(data));
        setStudent(data);
        return { success: true };
      } else {
        return { success: false, message: res.data?.message || 'خطأ في تسجيل الدخول' };
      }
    } catch (error) {
      console.error('Login error:', error);
      const msg = error.response?.data?.message || 'البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة';
      return { success: false, message: msg, code: error.response?.data?.code };
    }
  };

  // Register handler
  const register = async (formData) => {
    try {
      const res = await api.post('/students', formData);
      if (res.data && res.data.success) {
        return { success: true };
      } else {
        return { success: false, message: res.data?.message || 'خطأ في إنشاء الحساب' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      let msg = 'حدث خطأ أثناء إنشاء الحساب';
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        msg = error.response.data.errors.join(' - ');
      } else if (error.response?.data?.message) {
        msg = error.response.data.message;
      }
      return { success: false, message: msg };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      // Call logout endpoint to revoke session
      await api.post('/students/logout');
    } catch (e) {
      console.error('Logout error on backend', e);
    } finally {
      clearAuth();
    }
  };

  // Refresh profile details
  const refreshProfile = async () => {
    try {
      const res = await api.get('/students/me');
      if (res.data && res.data.success) {
        const studentData = res.data.data || res.data.me || res.data.data?.student;
        setStudent(studentData);
        localStorage.setItem('etqan_student_data', JSON.stringify(studentData));
        return studentData;
      }
    } catch (e) {
      console.error('Error refreshing profile', e);
    }
    return null;
  };

  const value = {
    student,
    loading,
    isAuthenticated: !!student,
    login,
    register,
    logout,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
