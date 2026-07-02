import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Video, FileText, Award, Wallet, HelpCircle, 
  ArrowLeft, ChevronDown, CheckCircle2, Play, Users, TrendingUp,
  Sun, Moon, LogIn, UserPlus, Lock, Phone, Mail, User, MapPin, Calendar, School, AlertCircle, Eye, EyeOff, X
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import CinematicFooter from '../components/CinematicFooter';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [faqs, setFaqs] = useState([]);

  // Login Dropdown States
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login Form States
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginId || !loginPassword) {
      setAuthError('يرجى كتابة رقم الهاتف أو البريد الإلكتروني وكلمة المرور');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    const res = await login(loginId, loginPassword);
    setAuthLoading(false);
    if (res.success) {
      setShowLoginDropdown(false);
      navigate('/');
    } else {
      setAuthError(res.message);
    }
  };
  const [activeFaq, setActiveFaq] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [selectedClass, setSelectedClass] = useState('كل الصفوف');

  // Redirect to dashboard if logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Close login dropdown on click outside
  useEffect(() => {
    if (!showLoginDropdown) return;
    const handleClose = (e) => {
      const isDropdown = e.target.closest('.login-dropdown-container');
      const isAvatarBtn = e.target.closest('.avatar-btn-container');
      if (!isDropdown && !isAvatarBtn) {
        setShowLoginDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, [showLoginDropdown]);

  const words = ["بأسهل طريقة شرح!", "من غير ما تحفظ كلمة!", "من غير أي تعقيد!", "مع مستر الصباغ!"];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fullWord = words[currentWordIndex];
    let delay = isDeleting ? 60 : 140; // Speed values: 140ms for human typing, 60ms for fast deleting

    if (!isDeleting && currentText === fullWord) {
      delay = 2000; // Pause at the end of word
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, delay);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && currentText === '') {
      setIsDeleting(false);
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
      const timeout = setTimeout(() => {}, 400); // Small pause before typing next word
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setCurrentText(
        isDeleting 
          ? fullWord.substring(0, currentText.length - 1) 
          : fullWord.substring(0, currentText.length + 1)
      );
    }, delay);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWordIndex]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    async function fetchFaqs() {
      try {
        const res = await api.get('/faq');
        if (res.data && res.data.success && res.data.data && res.data.data.length > 0) {
          setFaqs(res.data.data.slice(0, 5));
        } else {
          throw new Error('Empty FAQ data from API');
        }
      } catch (e) {
        setFaqs([
          {
            id: 1,
            question: 'إزاي بسجل وببدأ الدراسة في المنصة؟',
            answer: 'اضغط على زرار "ابدأ دلوقتي" فوق واكتب بياناتك وسنتك الدراسية، بعدها بتقدر تشحن المحفظة بأكواد الكروت وتفتح أي محاضرة فوراً.'
          },
          {
            id: 2,
            question: 'يعني إيه محفظة الطالب وشحن الكروت؟',
            answer: 'دي محفظة إلكترونية خاصة بيك على المنصة، بتشحنها بكروت الشحن اللي بتستلمها من السنتر أو المساعدين، وبتستخدم الرصيد ده لفتح المحاضرات والملفات أونلاين.'
          },
          {
            id: 3,
            question: 'هل الفيديوهات بتشتغل على الموبايل والكمبيوتر؟',
            answer: 'أكيد، الفيديوهات بتشتغل بجودة عالية ومحمية بالكامل على الموبايل، التابلت، والكمبيوتر. الحساب بيشتغل على جهاز واحد بس لضمان الأمان.'
          },
          {
            id: 4,
            question: 'إزاي حضور السنتر بيتربط بالمنصة؟',
            answer: 'لما بتروح السنتر، بتفتح كود الـ QR الخاص بيك من الموبايل والمساعد بيمسحه، وتلقائياً بتفتح الحصة والملفات والواجبات على حسابك في المنصة أوتوماتيك.'
          }
        ]);
      }
    }
    fetchFaqs();
  }, []);

  const handleStart = () => {
    if (isAuthenticated) {
      navigate('/');
    } else {
      navigate('/auth?tab=register');
    }
  };

  const showcaseCourses = [
    {
      id: 1,
      title: 'محاضرات بناء الدولة الحديثة (عهد محمد علي)',
      description: 'شرح تفصيلي لشخصية محمد علي، سياسته الداخلية والخارجية، نواتج التعلم بالفصل الثاني، وتدريبات شاملة على نواتج التعلم الحديثة.',
      classLevel: 'الصف الثالث الثانوي',
      price: 150,
      lecturesCount: 12,
      filesCount: 8,
      examsCount: 12,
      imageUrl: '/muhammad_ali.png'
    },
    {
      id: 2,
      title: 'محاضرات الحملة الفرنسية على مصر والشام',
      description: 'دراسة أسباب مجيء الحملة الفرنسية، المقاومة الوطنية، الآثار الفكرية والسياسية، وكيف بدأت مصر الحديثة كقصة تاريخية مشوقة.',
      classLevel: 'الصف الثالث الثانوي',
      price: 140,
      lecturesCount: 10,
      filesCount: 6,
      examsCount: 10,
      imageUrl: '/french_campaign.png'
    },
    {
      id: 3,
      title: 'محاضرات ثورة 1919 ونشأة الدولة المصرية الحديثة',
      description: 'دراسة الحركة الوطنية المصرية بزعامة سعد زغلول، أحداث ثورة 1919، تصريح 28 فبراير، ودستور 1923 كفترة تاريخية غيرت مجرى الوطن.',
      classLevel: 'الصف الثالث الثانوي',
      price: 130,
      lecturesCount: 9,
      filesCount: 6,
      examsCount: 9,
      imageUrl: '/egypt_1919.png'
    },
    {
      id: 4,
      title: 'محاضرات جغرافيا مصر الطبيعية والتنمية الاقتصادية',
      description: 'شرح مبسط للتنمية الاقتصادية والموارد المائية والبشرية لجمهورية مصر العربية، مع خرائط تحليلية تفصيلية لنواتج تعلم الجغرافيا بالصف الثاني الثانوي.',
      classLevel: 'الصف الثاني الثانوي',
      price: 120,
      lecturesCount: 8,
      filesCount: 5,
      examsCount: 8,
      imageUrl: '/egypt_geography.png'
    },
    {
      id: 5,
      title: 'محاضرات حضارة مصر القديمة والشرق الأدنى القديم',
      description: 'جولة تاريخية ممتعة في حضارة مصر القديمة (الفرعونية)، حضارات بلاد الرافدين، وحضارة فينيقيا القديمة، فهم عميق للجذور التاريخية.',
      classLevel: 'الصف الأول الثانوي',
      price: 100,
      lecturesCount: 6,
      filesCount: 4,
      examsCount: 6,
      imageUrl: '/ancient_egypt.png'
    },
    {
      id: 6,
      title: 'محاضرات حضارة اليونان والرومان القديمة وتأثيرها',
      description: 'شرح تفاعلي للحضارة الإغريقية، الإمبراطورية الرومانية، توسعات الإسكندر الأكبر في الشرق القديم، وتأثير الحضارة الهيلينستية في مصر.',
      classLevel: 'الصف الأول الثانوي',
      price: 90,
      lecturesCount: 7,
      filesCount: 4,
      examsCount: 7,
      imageUrl: '/greek_roman.png'
    }
  ];

  const filteredCourses = selectedClass === 'كل الصفوف' 
    ? showcaseCourses 
    : showcaseCourses.filter(c => c.classLevel === selectedClass);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      
      <header className="header-glass fade-in-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div className="flex-center" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', color: 'white' }}>
              <BookOpen size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.1', letterSpacing: '-0.3px' }}>إتقان</span>
              <span className="header-subtitle" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700' }}>مستر مصطفى الصباغ</span>
            </div>
          </div>

          <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <a href="#courses-showcase" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }} onMouseOver={(e) => e.target.style.color = 'var(--text-main)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>المحاضرات والمناهج</a>
            <a href="#features" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }} onMouseOver={(e) => e.target.style.color = 'var(--text-main)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>مزايا المنصة</a>
            <a href="#about" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }} onMouseOver={(e) => e.target.style.color = 'var(--text-main)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>عن المدرس</a>
            <a href="#faq" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }} onMouseOver={(e) => e.target.style.color = 'var(--text-main)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>الأسئلة الشائعة</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={toggleTheme} 
              className="nav-circle-btn"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <a href="#faq" className="nav-circle-btn help-btn-hide-mobile" style={{ color: 'var(--text-main)', textDecoration: 'none' }} title="الأسئلة الشائعة">
              <HelpCircle size={16} />
            </a>

            {isAuthenticated ? (
              <button onClick={() => navigate('/')} className="btn-premium" style={{ padding: '8px 22px', fontSize: '0.85rem' }}>
                بوابة الطالب
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="avatar-btn-container" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button 
                    onClick={() => { 
                      setShowLoginDropdown(!showLoginDropdown);
                      setAuthError(''); 
                    }} 
                    className="flex-center animate-pulse-subtle"
                    style={{ 
                      background: 'var(--primary)', 
                      border: 'none', 
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--primary-hover)';
                      const tooltip = e.currentTarget.nextSibling;
                      if (tooltip && !showLoginDropdown) {
                        tooltip.style.opacity = '1';
                        tooltip.style.transform = 'translateX(50%) translateY(0)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--primary)';
                      const tooltip = e.currentTarget.nextSibling;
                      if (tooltip) {
                        tooltip.style.opacity = '0';
                        tooltip.style.transform = 'translateX(50%) translateY(5px)';
                      }
                    }}
                  >
                    <User size={16} />
                  </button>
                  {/* Tooltip */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-35px',
                    right: '50%',
                    transform: 'translateX(50%) translateY(5px)',
                    background: 'var(--text-main)',
                    color: 'var(--bg-main)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    pointerEvents: 'none',
                    opacity: 0,
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-sm)',
                    zIndex: 100
                  }}>
                    تسجيل الدخول
                  </div>

                  {/* Small Dropdown Popover */}
                  {showLoginDropdown && (
                    <div className="login-dropdown-container" style={{
                      position: 'absolute',
                      top: '50px',
                      left: '0',
                      background: 'var(--bg-surface)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '16px',
                      boxShadow: 'var(--shadow-lg)',
                      width: '320px',
                      padding: '20px',
                      zIndex: 1000,
                      animation: 'slideDown 0.2s ease',
                      direction: 'rtl'
                    }}>
                      {/* Logo and Greeting Header */}
                      <div style={{ 
                        textAlign: 'center', 
                        marginBottom: '16px', 
                        borderBottom: '1px solid var(--border-color)', 
                        paddingBottom: '14px' 
                      }}>
                        <h2 style={{ 
                          fontSize: '1.35rem', 
                          fontWeight: '900', 
                          color: 'var(--text-main)', 
                          marginBottom: '4px', 
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                          <span>منصة</span>
                          <span style={{ 
                            color: 'var(--primary)', 
                            background: 'rgba(234, 88, 12, 0.08)', 
                            padding: '1px 8px', 
                            borderRadius: '6px' 
                          }}>إتقان</span>
                        </h2>
                        <p style={{ 
                          color: 'var(--text-muted)', 
                          fontSize: '0.72rem', 
                          fontWeight: '700', 
                          textAlign: 'center',
                          margin: 0
                        }}>بوابتك التعليمية للتفوق في الثانوية العامة</p>
                      </div>

                      {/* Error Messages */}
                      {authError && (
                        <div style={{
                          background: 'rgba(244, 63, 94, 0.1)',
                          border: '1.5px solid rgba(244, 63, 94, 0.2)',
                          color: 'var(--danger)',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <AlertCircle size={14} style={{ flexShrink: 0 }} />
                          <span style={{ textAlign: 'right' }}>{authError}</span>
                        </div>
                      )}

                      <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label className="input-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>رقم الهاتف أو البريد الإلكتروني</label>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type="text" 
                              value={loginId}
                              onChange={(e) => setLoginId(e.target.value)}
                              className="input-clay" 
                              placeholder="01xxxxxxxxx أو student@email.com"
                              style={{ paddingRight: '40px', fontSize: '0.85rem', height: '42px' }}
                              required
                            />
                            <Phone size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          </div>
                        </div>

                        <div>
                          <label className="input-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>كلمة المرور</label>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type={showPassword ? 'text' : 'password'} 
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              className="input-clay" 
                              placeholder="••••••••"
                              style={{ paddingRight: '40px', paddingLeft: '40px', fontSize: '0.85rem', height: '42px' }}
                              required
                            />
                            <Lock size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <button 
                              type="button" 
                              onClick={() => setShowPassword(!showPassword)}
                              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <button 
                          type="submit" 
                          disabled={authLoading} 
                          className="btn-clay" 
                          style={{
                            height: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '800',
                            marginTop: '5px'
                          }}
                        >
                          <span>{authLoading ? 'جاري التحقق...' : 'دخول'}</span>
                          {!authLoading && <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />}
                        </button>
                      </form>

                      {/* Not registered? Go to normal register page */}
                      <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ليس لديك حساب؟ </span>
                        <button 
                          onClick={() => {
                            setShowLoginDropdown(false);
                            navigate('/auth?tab=register');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: '800',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                        >
                          سجل الآن
                        </button>
                      </div>

                    </div>
                  )}

                </div>

                <button 
                  onClick={() => navigate('/auth?tab=register')} 
                  className="btn-premium" 
                  style={{ padding: '8px 22px', fontSize: '0.85rem' }}
                >
                  ابدأ دلوقتي
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-container grid-cards">
          
          <div className="hero-text-col">
            <span className="badge badge-primary fade-in-up hero-badge" style={{ fontWeight: '800', fontSize: '0.8rem', padding: '6px 16px' }}>
              المنصة التعليمية المتكاملة للثانوية العامة
            </span>
            <h1 className="hero-title fade-in-up delay-1">
              قفل التاريخ والجغرافيا<br />
              في الثانوية العامة<br />
              <span className="hero-highlight">{currentText || '\u200b'}<span className="typewriter-cursor">|</span></span>
            </h1>
            <p className="hero-desc fade-in-up delay-2">
              منصة إتقان هي رفيقك الأول في الثانوية العامة. بنوفرلك نظام شرح تفاعلي، واجبات دورية، امتحانات إلكترونية، ومتابعة فورية لولي الأمر، وحضور سنتر ذكي بربط تلقائي.
            </p>
            
            <div className="hero-actions fade-in-up delay-3">
              <button onClick={handleStart} className="btn-premium" style={{ padding: '14px 32px', fontSize: '1rem' }}>
                ابدأ رحلة التفوق دلوقتي
              </button>
              <button onClick={() => navigate('/auth?tab=login')} className="flex-center" style={{ background: 'none', border: 'none', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                <div className="flex-center" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--border-color)', color: 'var(--primary-hover)', background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                  <Play size={16} fill="currentColor" style={{ marginRight: '-2px' }} />
                </div>
                <span>شاهد تريلر الحصة</span>
              </button>
            </div>

            <div className="fade-in-up delay-4 hero-student-count" style={{ marginTop: '15px' }}>
              <div className="hero-student-count-row">
                <div style={{ display: 'flex', direction: 'ltr' }}>
                  {['/teacher_avatar.png', '/teacher_avatar.png', '/teacher_avatar.png'].map((avatar, idx) => (
                    <div key={idx} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #ffffff', marginLeft: idx > 0 ? '-10px' : '0', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
                <span className="hero-student-count-main">انضم لأكثر من 2000 طالب</span>
              </div>
              <span className="hero-student-count-sub">بيقفلوا المادة سنوياً</span>
            </div>
          </div>

          <div className="hero-media-col">
            
            <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(202, 138, 4, 0.15)', filter: 'blur(40px)', zIndex: 0 }}></div>
            <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.1)', filter: 'blur(30px)', zIndex: 0, bottom: '20px', right: '40px' }}></div>

            <div className="hero-student-img-wrapper" style={{ border: 'none', background: 'transparent', boxShadow: 'none', borderRadius: 0, height: 'auto', overflow: 'visible', display: 'flex', justifyContent: 'center', maxWidth: '100%' }}>
              <img 
                src="/manhero.png" 
                alt="Teacher" 
                draggable="false"
                style={{ width: '100%', height: 'auto', objectFit: 'contain', position: 'relative', top: '85px', zIndex: 1, pointerEvents: 'none', userSelect: 'none' }}
              />
            </div>

            <div className="hero-float-card-1 animate-float-slow" style={{ background: 'url(/hero3.png) no-repeat center center / cover', border: 'none', color: '#000000', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '400', color: '#000000', fontFamily: "'Rakkas', serif" }}>التاريخ أسهل بكتير معانا</span>
            </div>

            <div className="hero-float-card-2 animate-float-medium" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
              <img 
                src="/hero1.png" 
                alt="Hero 1" 
                draggable="false"
                style={{ width: '160px', height: 'auto', transform: 'rotate(30deg)', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
              />
            </div>

            <div className="hero-float-card-3 animate-float-slow" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, bottom: '-35px', left: '-15px' }}>
              <img 
                src="/hero2.png" 
                alt="Hero 2" 
                draggable="false"
                style={{ width: '130px', height: 'auto', transform: 'rotate(-30deg)', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
              />
            </div>

          </div>
        </div>
      </section>

      <section className="centers-section scroll-reveal">
        <div className="centers-container">
          <p className="centers-title">
            متواجدين في أكبر السناتر التعليمية بمحافظات مصر
          </p>
          <div className="logo-slider-container" style={{ marginTop: '20px' }}>
            <div className="logo-slider-track">
              {[1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8].map((num, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={`/logos/logo${num}.jpg`}
                    alt={`Center logo ${num}`}
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      height: '55px',
                      width: 'auto',
                      objectFit: 'contain',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="courses-showcase" className="courses-showcase scroll-reveal">
        <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(202, 138, 4, 0.08)', filter: 'blur(40px)', top: '-20px', left: '-50px', zIndex: 0 }}></div>

        <div className="courses-container">
          
          <div className="courses-header">
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '12px', fontWeight: '800' }}>المحاضرات والمناهج الدراسية</span>
              <h3 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.3' }}>ابدأ رحلتك التاريخية دلوقتي مع الصباغ</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1rem', fontWeight: '500' }}>اختر سنتك الدراسية وادخل المحاضرات والملفات والواجبات فوراً</p>
            </div>
            
            <div className="courses-filter-tabs">
              {['كل الصفوف', 'الصف الثالث الثانوي', 'الصف الثاني الثانوي', 'الصف الأول الثانوي'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedClass(tab)}
                  className={`btn-premium ${selectedClass === tab ? '' : 'btn-premium-outline'}`}
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-full)',
                    border: selectedClass === tab ? 'none' : '2px solid transparent',
                    background: selectedClass === tab ? 'var(--primary)' : 'transparent',
                    color: selectedClass === tab ? '#ffffff' : 'var(--text-muted)',
                    boxShadow: selectedClass === tab ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-cards" style={{ gridGap: '30px' }}>
            {filteredCourses.map((course, idx) => (
              <div 
                key={course.id} 
                className={`card-premium course-card fade-in-up delay-${(idx % 4) + 1}`}
              >
                <div className="course-card-banner">
                  <img 
                    src={course.imageUrl} 
                    alt={course.title} 
                    className="course-icon-hover"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span className="badge badge-secondary course-card-badge">
                    {course.classLevel}
                  </span>
                </div>

                <div className="course-card-content">
                  <h4 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.4' }}>{course.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', flexGrow: 1 }}>{course.description}</p>
                  
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '5px 0' }}></div>
                  
                  <div className="course-card-stats">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Video size={14} style={{ color: 'var(--primary)' }} />
                      <span>{course.lecturesCount} محاضرات</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} style={{ color: 'var(--secondary)' }} />
                      <span>{course.filesCount} ملفات</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Award size={14} style={{ color: 'var(--accent)' }} />
                      <span>{course.examsCount} امتحانات</span>
                    </div>
                  </div>

                  <div className="course-card-footer">
                    <div className="course-card-price-wrapper">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>سعر الحصة</span>
                      <div className="course-card-price">
                        <strong style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)' }}>{course.price}</strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>ج.م</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (isAuthenticated) {
                          navigate(`/course/${course.id}`);
                        } else {
                          navigate('/auth?tab=register');
                        }
                      }}
                      className="btn-premium" 
                      style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                    >
                      دخول الحصة
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      </section>

      <section id="features" className="features-section scroll-reveal">
        <div className="features-header fade-in-up">
          <span className="badge badge-secondary" style={{ marginBottom: '15px', fontWeight: '800' }}>مزايا المنصة</span>
          <h3 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-main)' }}>كل اللي هتحتاجه علشان تقفل المادة بقلب حديد</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px', fontSize: '1.05rem' }}>نظام تعليمي متكامل يجمع بين الشرح والحل والمتابعة والتقييم</p>
        </div>

        <div className="bento-container fade-in-up">
          
          {/* Column 1 */}
          <div className="bento-column">
            
            {/* Card 1: Lessons timeline (Tall) */}
            <div className="bento-card tall">
              <div className="bento-visual-lessons">
                <div className="bento-visual-lessons-item">
                  <span>الحصة الأولى: الدولة الحديثة</span>
                  <span style={{ color: '#10b981' }}>اكتملت ✓</span>
                </div>
                <button className="bento-visual-lessons-btn">تحميل ملخص الفصل الثاني PDF</button>
                <div className="bento-visual-lessons-item">
                  <span>الواجب المنزلي (الفصل الثاني)</span>
                  <span style={{ color: '#10b981' }}>تم التأكيد ✓</span>
                </div>
              </div>
              <div className="bento-card-header">
                <h4 className="bento-card-title">شرح وافي كقصة مترابطة</h4>
                <p className="bento-card-desc">بنشرح المنهج كقصة ممتعة ومترابطة تفهم بيها جذور الأحداث التاريخية والجغرافية ونواتج التعلم في المنصة من الصفر للتقفيل.</p>
              </div>
            </div>

            {/* Card 2: Mind Maps (Medium, Blue box) */}
            <div className="bento-card bento-visual-bluebox medium">
              <div className="bento-visual-bluebox-graphic" style={{ fontSize: 'inherit', overflow: 'hidden' }}>
                <DotLottieReact
                  src="https://lottie.host/959d0c41-23ec-42a7-af0f-48a172ca4ca0/l8QlLsBfno.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%', maxHeight: '110px', transform: 'scale(1.4)' }}
                />
              </div>
              <div className="bento-card-header">
                <h4 className="bento-card-title">خرائط ذهنية وجداول مقارنات</h4>
                <p className="bento-card-desc">ورق ملخصات وجداول مقارنات ذهبية تلم بيهم الفصل والتواريخ والشخصيات في ورقتين بس، عشان تراجع وتلم المنهج بسرعة.</p>
              </div>
            </div>

          </div>

          {/* Column 2 */}
          <div className="bento-column">
            
            {/* Card 3: Training/Chart (Medium) */}
            <div className="bento-card medium">
              <div className="bento-visual-chart" style={{ justifyContent: 'center', alignItems: 'center', padding: '5px' }}>
                <DotLottieReact
                  src="https://lottie.host/9378a2ee-9168-4ce6-b48b-1707dd91ee46/8kmPud80PN.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%', maxHeight: '110px' }}
                />
              </div>
              <div className="bento-card-header">
                <h4 className="bento-card-title">حل وتدريب على نواتج التعلم</h4>
                <p className="bento-card-desc">حل ملازم الشرح، أسئلة الوزارة، والامتحانات الاسترشادية لضمان الدرجة النهائية.</p>
              </div>
            </div>

            {/* Card 4: Exams/Globe (Tall) */}
            <div className="bento-card tall">
              <div className="bento-visual-globe" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <DotLottieReact
                  src="https://lottie.host/b1d456ee-0c81-483a-906c-91188a7cdc6d/smUQDIbTAE.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%', maxHeight: '150px' }}
                />
              </div>
              <div className="bento-card-header">
                <h4 className="bento-card-title">امتحانات تفاعلية دورية</h4>
                <p className="bento-card-desc">بعد كل حصة فيه امتحان شامل بوقت محدد بيقيس استيعابك ويصلحلك غلطك فوراً عشان تكون جاهز دايماً.</p>
              </div>
            </div>

          </div>

          {/* Column 3 */}
          <div className="bento-column">
            
            {/* Card 5: Orbiting Avatars (Tall) */}
            <div className="bento-card tall">
              <div className="bento-visual-avatars" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <DotLottieReact
                  src="https://lottie.host/1c16b8e0-0f98-400e-846f-b5fe950155c5/w7Q0fdDEoA.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%', maxHeight: '150px' }}
                />
              </div>
              <div className="bento-card-header">
                <h4 className="bento-card-title">جروب مناقشة واستفسارات 24 ساعة</h4>
                <p className="bento-card-desc">معاك طاقم مساعدين متميزين للرد على أي سؤال تاريخي أو فكري يقف قدامك في أي وقت من اليوم بكل سرور.</p>
              </div>
            </div>

            {/* Card 6: Parent report card (Medium) */}
            <div className="bento-card medium">
              <div className="bento-visual-report">
                <div className="bento-report-row">
                  <span>درجة الحصة الأخيرة</span>
                  <span className="bento-report-badge">19 / 20 ممتاز</span>
                </div>
                <div className="bento-report-row">
                  <span>نسبة حضور السنتر</span>
                  <span className="bento-report-badge" style={{ background: 'rgba(202, 138, 4, 0.1)', color: 'var(--primary)' }}>100% منتظم</span>
                </div>
              </div>
              <div className="bento-card-header">
                <h4 className="bento-card-title">متابعة ولي الأمر أول بأول</h4>
                <p className="bento-card-desc">تقارير تلقائية ودورية تطلع أهلك على درجاتك وحضورك ومستواك أول بأول.</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      <section id="about" className="about-section scroll-reveal">
        <div className="about-container">
          <div className="card-premium about-card fade-in-up">
            
            <div className="about-text-col">
              <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>مؤسس المنصة</span>
              <h3 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)' }}>أهلاً بيكم يا شباب، أنا مستر مصطفى الصباغ! 👋</h3>
              <p className="about-bio">
                بدأت رحلتي في تدريس التاريخ والجغرافيا للمرحلة الثانوية بهدف أساسي: تحويل المادة من مجرد حفظ أعمى لتواريخ وأرقام، إلى فهم وتحليل علمي ممتع للأحداث التاريخية ونواتج التعلم. تأسيس منصة إتقان التعليمية جاء ليوفر للطلاب نظاماً تعليمياً تفاعلياً متكاملاً يضمن التقفيل والدرجات النهائية.
              </p>
              
              <div className="about-stats-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ea580c', flexShrink: 0, boxShadow: '0 0 6px rgba(234, 88, 12, 0.4)' }}></span>
                  <span style={{ fontWeight: '600' }}>بكالوريوس التربية والعلوم قسم تاريخ ودراسات</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#f97316', flexShrink: 0, boxShadow: '0 0 6px rgba(249, 115, 22, 0.4)' }}></span>
                  <span style={{ fontWeight: '600' }}>خبرة أكتر من 10 سنين في تدريس التاريخ للثانوية العامة بمصر</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#fdba74', flexShrink: 0, boxShadow: '0 0 6px rgba(253, 186, 116, 0.4)' }}></span>
                  <span style={{ fontWeight: '600' }}>مئات الطلاب الحاصلين على الدرجات النهائية في التاريخ سنوياً</span>
                </div>
              </div>
            </div>

            <div className="about-media-col">
              <div className="about-avatar-wrapper">
                <img src="/teacher_avatar.png" alt="Mr. Mostafa Elsabbagh" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <strong style={{ fontSize: '1.2rem', display: 'block', fontWeight: '800' }}>أ/ مصطفى الصباغ</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>مؤسس منصة إتقان التعليمية</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-section scroll-reveal">
        <div className="pricing-container grid-cards">
          
          <div className="pricing-text-col">
            <h3 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)' }}>انضم لمنصة إتقان واضمن درجتك الكاملة</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: '1.6' }}>
              انضم لزمايلك وابدأ المذاكرة بنظام تفاعلي متكامل يضمن لك الدرجات والترتيب على الجمهورية.
            </p>
            
            <div className="pricing-bullets">
              {[
                'وصول كامل مدى الحياة لكافة فيديوهات الحصة وملفات الشرح',
                'ملازم التدريبات والواجبات المنزلية والامتحانات بصيغة PDF للطباعة',
                'اشتراحة مجانية في مجتمع الطلاب وجروب الأسئلة والمناقشات',
                'متابعة دورية وإرسال تقارير الدرجات لأولياء الأمور تلقائياً'
              ].map((text, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem', fontWeight: '600' }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-premium pricing-card-box fade-in-up delay-2">
            <div className="badge badge-secondary" style={{ position: 'absolute', top: '-15px', right: '50%', transform: 'translateX(50%)', fontWeight: '800', padding: '6px 16px' }}>
              قيمة الاشتراك
            </div>
            
            <div style={{ marginTop: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-muted)' }}>ج.م</span>
                <strong style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--text-main)' }}>150</strong>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block', marginTop: '5px' }}>اشتراك للحصة الشاملة شاملة الشرح والحل والواجب والامتحان</span>
            </div>

            <button onClick={handleStart} className="btn-premium btn-premium-secondary" style={{ width: '100%', padding: '14px', fontSize: '1rem', marginBottom: '15px' }}>
              ابدأ رحلة التفوق دلوقتي
            </button>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>
              🔒 أمان كامل ودعم فني متواجد لمساعدتك 24 ساعة
            </span>
          </div>

        </div>
      </section>

      <section id="faq" className="faq-section scroll-reveal">
        <div className="faq-header">
          <h3 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '10px' }}>الأسئلة الشائعة</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>إجابات لكل التفاصيل والأسئلة اللي بتدور في دماغك عن المنصة</p>
        </div>

        <div className="faq-grid">
          {faqs.map((faq, index) => (
            <div 
              key={faq.id || index} 
              className="card-premium" 
              style={{ padding: '18px 24px', cursor: 'pointer', borderColor: activeFaq === index ? 'var(--primary)' : 'var(--border-color)', borderRadius: '16px' }} 
              onClick={() => setActiveFaq(activeFaq === index ? null : index)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800' }}>{faq.question}</h4>
                <ChevronDown size={20} style={{ transform: activeFaq === index ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'var(--transition-smooth)', color: activeFaq === index ? 'var(--primary)' : 'var(--text-muted)' }} />
              </div>
              {activeFaq === index && (
                <p style={{ marginTop: '15px', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                  {faq.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <CinematicFooter />

    </div>
  );
}
