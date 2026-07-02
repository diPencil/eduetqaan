import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import StudentDashboard from './pages/StudentDashboard';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CourseDetail from './pages/CourseDetail';
import Checkout from './pages/Checkout';
import VideoPlayer from './pages/VideoPlayer';
import Support from './pages/Support';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Protected Route Component to restrict access to logged-in students
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-muted)' }}>جاري التحميل...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth?tab=login" replace />;
  }
  
  return children;
}

// HomeWrapper dynamically decides what to render at / based on Auth state
function HomeWrapper() {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-muted)' }}>جاري التحميل...</div>;
  }
  
  if (isAuthenticated) {
    return <StudentDashboard />;
  }
  
  return <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Dynamically render dashboard or landing on root / */}
          <Route path="/" element={<HomeWrapper />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/support" element={<Support />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Redirect /dashboard to / to clean up the URL */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          
          <Route path="/course/:id" element={
            <ProtectedRoute>
              <CourseDetail />
            </ProtectedRoute>
          } />

          <Route path="/checkout/:id" element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          } />

          <Route path="/watch/course/:courseId" element={
            <ProtectedRoute>
              <VideoPlayer />
            </ProtectedRoute>
          } />

          {/* Redirect all unmatched routes to Landing Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
