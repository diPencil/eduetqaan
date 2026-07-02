import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Video, Star, User, MessageSquare, BookOpen, Menu, QrCode, Moon, Sun, LogOut, Send, FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleNav = (path, anchorId) => {
    if (location.pathname !== path) {
      navigate(path + (anchorId ? `#${anchorId}` : ''));
      // Scroll to anchor on load
      if (anchorId) {
        setTimeout(() => {
          const el = document.getElementById(anchorId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      if (anchorId) {
        const el = document.getElementById(anchorId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const isActive = (path, anchorId) => {
    if (anchorId) {
      return location.pathname === path && location.hash === `#${anchorId}`;
    }
    return location.pathname === path && !location.hash;
  };

  if (isAuthenticated) {
    return (
      <>
        <div className="mobile-bottom-nav">
          <button onClick={() => navigate('/dashboard')} className="mobile-nav-item">
            <Home size={20} />
            <span>الرئيسية</span>
          </button>
          <button onClick={() => navigate('/dashboard')} className="mobile-nav-item">
            <Video size={20} />
            <span>المحاضرات</span>
          </button>
          <button onClick={() => navigate('/dashboard')} className="mobile-nav-item">
            <BookOpen size={20} />
            <span>الواجبات</span>
          </button>
          <button onClick={() => navigate('/dashboard')} className="mobile-nav-item">
            <Star size={20} />
            <span>الامتحانات</span>
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`mobile-nav-item ${mobileMenuOpen ? 'active' : ''}`}>
            <Menu size={20} />
            <span>المزيد</span>
          </button>
        </div>
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div style={{ position: 'fixed', bottom: '80px', left: '16px', right: '16px', background: 'var(--bg-surface-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '2px solid var(--border-color)', borderRadius: '20px', padding: '20px', zIndex: 9998, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }} className="btn-clay" style={{ width: '100%', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', justifyContent: 'flex-start', gap: '12px', padding: '12px 20px' }}><QrCode size={18} /> كود الحضور (QR)</button>
            <button onClick={() => { toggleTheme(); setMobileMenuOpen(false); }} className="btn-clay" style={{ width: '100%', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', justifyContent: 'flex-start', gap: '12px', padding: '12px 20px' }}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />} {theme === 'light' ? 'الوضع الليلي' : 'الوضع الفاتح'}</button>
            <button onClick={() => { logout(); navigate('/'); setMobileMenuOpen(false); }} className="btn-clay" style={{ width: '100%', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--danger)', border: '1px solid rgba(244, 63, 94, 0.2)', justifyContent: 'flex-start', gap: '12px', padding: '12px 20px' }}><LogOut size={18} /> تسجيل الخروج</button>
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>
            <a href="https://wa.me/201000000000" target="_blank" rel="noreferrer" className="btn-clay" style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: 'none', justifyContent: 'flex-start', gap: '12px', padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none' }}><Send size={16} /> تواصل معنا</a>
            <a href="/terms" className="btn-clay" style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: 'none', justifyContent: 'flex-start', gap: '12px', padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none' }} onClick={() => setMobileMenuOpen(false)}><FileText size={16} /> شروط الاستخدام</a>
            <a href="/privacy" className="btn-clay" style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: 'none', justifyContent: 'flex-start', gap: '12px', padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none' }} onClick={() => setMobileMenuOpen(false)}><AlertCircle size={16} /> سياسة الخصوصية</a>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mobile-bottom-nav">
      
      {/* Home */}
      <button 
        onClick={() => handleNav('/', null)}
        className={`mobile-nav-item ${isActive('/', null) ? 'active' : ''}`}
      >
        <Home size={20} />
        <span>الرئيسية</span>
      </button>

      {/* Courses */}
      <button 
        onClick={() => handleNav('/', 'courses-showcase')}
        className={`mobile-nav-item ${isActive('/', 'courses-showcase') ? 'active' : ''}`}
      >
        <Video size={20} />
        <span>المحاضرات</span>
      </button>

      {/* Features */}
      <button 
        onClick={() => handleNav('/', 'features')}
        className={`mobile-nav-item ${isActive('/', 'features') ? 'active' : ''}`}
      >
        <Star size={20} />
        <span>المزايا</span>
      </button>

      {/* About */}
      <button 
        onClick={() => handleNav('/', 'about')}
        className={`mobile-nav-item ${isActive('/', 'about') ? 'active' : ''}`}
      >
        <User size={20} />
        <span>عن المدرس</span>
      </button>

      {/* Support */}
      <button 
        onClick={() => navigate('/support')}
        className={`mobile-nav-item ${location.pathname === '/support' ? 'active' : ''}`}
      >
        <MessageSquare size={20} />
        <span>الدعم</span>
      </button>

    </div>
  );
}
