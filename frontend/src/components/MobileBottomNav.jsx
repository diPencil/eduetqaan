import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Video, Star, User, MessageSquare } from 'lucide-react';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

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
