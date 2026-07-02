import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  BookOpen, Video, FileText, Award, Wallet, 
  ArrowLeft, ChevronDown, CheckCircle2, 
  Sun, Moon, QrCode, LogOut, User, AlertCircle, Send, DollarSign, Calendar, Search, Menu, Home, Star
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { QRCodeSVG } from 'qrcode.react';
import MobileBottomNav from '../components/MobileBottomNav';
import SimpleFooter from '../components/SimpleFooter';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, student, logout, refreshProfile } = useAuth();

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Student Dashboard States
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [myCourses, setMyCourses] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [exams, setExams] = useState([]);
  const [walletData, setWalletData] = useState({ balanceCents: 0, recent: [] });
  const [voucherCode, setVoucherCode] = useState('');
  const [pointsData, setPointsData] = useState([]);
  const [topupLoading, setTopupLoading] = useState(false);

  const [profileGPhone, setProfileGPhone] = useState('');
  const [profileRegion, setProfileRegion] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Interactive Quiz States
  const [quizSelectedOption, setQuizSelectedOption] = useState(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizIsCorrect, setQuizIsCorrect] = useState(null);
  const [quizSubmitLoading, setQuizSubmitLoading] = useState(false);

  // YouTube modal player state
  const [activeYtVideoId, setActiveYtVideoId] = useState(null);

  // Course showcase data
  const [selectedClass, setSelectedClass] = useState('كل الصفوف');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Set active tab based on query param if present
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (student) {
      setProfileGPhone(student.guardianPhone || '');
      setProfileRegion(student.region || '');
    }
  }, [student]);

  // Load Data based on Tab
  useEffect(() => {
    if (!student || !isAuthenticated) return;

    if (activeTab === 'home' || activeTab === 'lectures') {
      loadMyCourses();
    } else if (activeTab === 'homework') {
      loadHomeworks();
    } else if (activeTab === 'exams') {
      loadExams();
    } else if (activeTab === 'wallet') {
      loadWalletData();
    } else if (activeTab === 'points') {
      loadPointsData();
    }
  }, [activeTab, student, isAuthenticated]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const loadMyCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/checkout/my-courses');
      if (res.data && res.data.success) {
        setMyCourses(res.data.data || []);
      }
    } catch (e) {
      console.error('Error fetching my courses', e);
      setError('فشل في تحميل الكورسات الخاصة بك');
    } finally {
      setLoading(false);
    }
  };

  const loadHomeworks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/student-homework');
      if (res.data && res.data.success) {
        setHomeworks(res.data.data || []);
      }
    } catch (e) {
      console.error('Error fetching homeworks', e);
      setError('فشل في تحميل الواجبات المنزلية');
    } finally {
      setLoading(false);
    }
  };

  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/exams');
      if (res.data && res.data.success) {
        setExams(res.data.data || []);
      }
    } catch (e) {
      console.error('Error fetching exams', e);
      setError('فشل في تحميل الامتحانات');
    } finally {
      setLoading(false);
    }
  };

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/me');
      if (res.data && res.data.success) {
        setWalletData(res.data.data || { balanceCents: 0, recent: [] });
      }
    } catch (e) {
      console.error('Error fetching wallet', e);
      setError('فشل في تحميل بيانات المحفظة');
    } finally {
      setLoading(false);
    }
  };

  const loadPointsData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/students/me/points');
      if (res.data && res.data.success) {
        setPointsData(res.data.data || []);
      }
    } catch (e) {
      console.error('Error fetching points', e);
      setError('فشل في تحميل سجل النقاط');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemVoucher = async (e) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;

    setError('');
    setSuccess('');
    setTopupLoading(true);

    try {
      const res = await api.post('/vouchers/redeem', { code: voucherCode.trim() });
      if (res.data && res.data.success) {
        setSuccess(`تم شحن المحفظة بنجاح بقيمة ${(res.data.amountCents || res.data.data?.amountCents || 0) / 100} جنيه!`);
        setVoucherCode('');
        loadWalletData();
        refreshProfile();
      } else {
        setError(res.data.message || 'كود الشحن غير صالح');
      }
    } catch (err) {
      console.error('Voucher redeem error:', err);
      setError(err.response?.data?.message || 'فشل شحن الكود.');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUpdatingProfile(true);

    try {
      const res = await api.patch('/students/me', {
        guardianPhone: profileGPhone.trim(),
        region: profileRegion.trim()
      });

      if (res.data && res.data.success) {
        setSuccess('تم تحديث بيانات الملف الشخصي بنجاح!');
        refreshProfile();
      } else {
        setError(res.data.message || 'فشل تحديث البيانات');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleQuizSubmit = async (questionText, correctKey) => {
    if (!quizSelectedOption) return;
    
    setError('');
    setSuccess('');
    setQuizSubmitLoading(true);

    const isCorrect = quizSelectedOption === correctKey;
    setQuizIsCorrect(isCorrect);
    setQuizSubmitted(true);

    if (isCorrect) {
      try {
        const res = await api.post('/students/me/quiz-points', { question: questionText });
        if (res.data && res.data.success) {
          setSuccess(`تم حل الكويز بنجاح وإضافة 5 نقاط لحسابك! 🎉`);
          refreshProfile();
        }
      } catch (err) {
        console.error('Quiz submit points error:', err);
        setError(err.response?.data?.message || 'فشل في حفظ نقاط الكويز.');
      } finally {
        setQuizSubmitLoading(false);
      }
    } else {
      setQuizSubmitLoading(false);
    }
  };

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setError('');
    setSuccess('');
  };

  // Don't render anything if not authenticated (redirect will handle it)
  if (!isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      
      {/* Student Header */}
      <header className="header-glass fade-in-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { setActiveTab('home'); navigate('/dashboard'); }}>
            <div className="flex-center" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', color: 'white' }}>
              <BookOpen size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.1', letterSpacing: '-0.3px' }}>إتقان</span>
              <span className="header-subtitle" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700' }}>مستر مصطفى الصباغ</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'home', label: 'الرئيسية' },
              { id: 'lectures', label: 'المحاضرات' },
              { id: 'homework', label: 'الواجبات المنزلية' },
              { id: 'exams', label: 'الامتحانات والتقييم' },
              { id: 'qr', label: 'كود الحضور' }
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setError(''); setSuccess(''); }}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            
            {/* Points Stat */}
            <div 
              onClick={() => { setActiveTab('points'); setError(''); setSuccess(''); }}
              className="card-clay" 
              style={{ 
                padding: '4px 10px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                borderRadius: '12px', 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              title="نقاطي - اضغط لعرض سجل النقاط"
            >
              <div className="flex-center" style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', overflow: 'hidden' }}>
                <DotLottieReact
                  src="https://lottie.host/0dbfca8a-8482-4e7f-bbbc-773183539fd2/FeQ8lECQQc.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%', transform: 'scale(1.6)', transformOrigin: 'center' }}
                />
              </div>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {student?.totalPoints || 0}
                <span className="hide-mobile-text">نقطة</span>
              </strong>
            </div>

            {/* Wallet Balance Stat */}
            <div 
              onClick={() => setActiveTab('wallet')}
              className="card-clay" 
              style={{ 
                padding: '4px 10px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                borderRadius: '12px', 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              title="رصيد المحفظة - اضغط لفتح المحفظة"
            >
              <div className="flex-center" style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.12)', overflow: 'hidden' }}>
                <DotLottieReact
                  src="https://lottie.host/d8144e91-07ee-4f95-bf7a-d26cdd9a5255/9EBiPn85qQ.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {(student?.balanceCents || walletData.wallet?.balanceCents || 0) / 100}
                <span className="hide-mobile-text">ج.م</span>
              </strong>
            </div>

            {/* Profile Button */}
            <button 
              onClick={() => { setActiveTab('profile'); setError(''); setSuccess(''); }}
              className="nav-circle-btn"
              style={{
                background: activeTab === 'profile' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'profile' ? '#ffffff' : 'var(--text-main)',
                borderColor: activeTab === 'profile' ? 'var(--primary)' : 'var(--border-color)',
                boxShadow: activeTab === 'profile' ? 'var(--shadow-glow-blue)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="حسابي / الملف الشخصي"
            >
              <User size={16} />
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme} 
              className="nav-circle-btn hide-on-mobile"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Logout */}
            <button 
              onClick={handleLogout} 
              className="nav-circle-btn hide-on-mobile" 
              style={{ color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.1)', border: 'none' }}
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main style={{ flex: 1, padding: '140px 20px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Header Info Banner — only on home tab */}
        {activeTab === 'home' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>أهلاً بك يا {student?.studentName ? student.studentName.split(' ')[0] : ''} 👋</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>منصة إتقان تتمنى لك يوماً دراسياً مثمراً</p>
            </div>
          </div>
        )}

        {/* Global Notifications / Alert Banner */}
        {error && (
          <div className="flex-center" style={{ gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '2px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', padding: '12px 20px', borderRadius: '12px', marginBottom: '24px', fontWeight: '600' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}
        {success && (
          <div className="flex-center" style={{ gap: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '2px solid rgba(16, 185, 129, 0.25)', color: 'var(--accent)', padding: '12px 20px', borderRadius: '12px', marginBottom: '24px', fontWeight: '600' }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
            <div>{success}</div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>جاري التحميل...</div>}

        {!loading && (
          <>
            {/* Tab: Home Overview */}
            {activeTab === 'home' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '65px' }}>
                
                {/* Premium Project-Branded Hero Section */}
                <div className="card-clay animate-float" style={{ 
                  background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.25) 0%, rgba(202, 138, 4, 0.08) 100%)', 
                  padding: '35px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap', 
                  gap: '30px',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '2px solid rgba(234, 88, 12, 0.15)'
                }}>
                  {/* Glowing lights behind */}
                  <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.15)', filter: 'blur(40px)', top: '-40px', left: '-40px', zIndex: 0 }}></div>
                  
                  <div style={{ flex: '1 1 500px', zIndex: 1 }}>
                    <span className="badge badge-primary" style={{ marginBottom: '12px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800' }}>
                      {student?.year || 'طالب منصة إتقان'}
                    </span>
                    <h3 className="hero-title-mobile" style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '12px', lineHeight: '1.3' }}>
                      جاهز لقفل الدرجة النهائية في <span style={{ whiteSpace: 'nowrap' }}>التاريخ؟ 🏆</span>
                    </h3>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '1rem', marginBottom: '20px', fontWeight: '500' }}>
                      أهلاً بك يا <strong>{student?.studentName ? student.studentName.split(' ')[0] : 'بطل'}</strong> في لوحة تحكمك الذكية. بنوفرلك هنا تجربة تعلم تفاعلية كاملة مع مستر مصطفى الصباغ عشان تفهم وتتميز وتتفوق من غير أي حفظ أو تعقيد.
                    </p>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <button onClick={() => setActiveTab('lectures')} className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '0.9rem' }}>
                        تصفح المحاضرات الآن
                        <ArrowLeft size={16} />
                      </button>
                      <button onClick={() => setActiveTab('qr')} className="btn-premium btn-premium-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '0.9rem' }}>
                        <QrCode size={16} />
                        كود حضور السنتر (QR)
                      </button>
                    </div>
                  </div>

                  {/* Decorative background shape behind Lottie */}
                  <div style={{
                    position: 'absolute',
                    width: '320px',
                    height: '320px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(202, 138, 4, 0.05) 100%)',
                    left: '-80px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 0,
                    pointerEvents: 'none'
                  }}></div>

                  {/* Small decorative circle in top-left corner */}
                  <div style={{
                    position: 'absolute',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(202, 138, 4, 0.05) 100%)',
                    left: '-30px',
                    top: '-30px',
                    zIndex: 0,
                    pointerEvents: 'none'
                  }}></div>

                  {/* Lottie Animation */}
                  <div className="hero-lottie-wrapper" style={{ zIndex: 1, flex: '0 0 350px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible' }}>
                    <div className="hero-lottie-inner" style={{ width: '100%', height: '100%', transform: 'scale(1.75)', transformOrigin: 'center', marginTop: '-15px' }}>
                      <DotLottieReact
                        src="https://lottie.host/e1ca5b38-f181-4902-a8c4-084bc314020c/dizQA0Mgob.lottie"
                        loop
                        autoplay
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </div>

                </div>

                {/* Section 1: Available Lectures */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                      <div style={{ textAlign: 'right' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>المحاضرات المتاحة لصفك الدراسي</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>تصفح المناهج والحصص المتاحة للشراء أو الاشتراك فوراً</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('lectures')} className="hide-on-mobile" style={{ color: 'var(--primary)', background: 'none', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '0.9rem' }}>
                      شاهد الكل
                    </button>
                  </div>

                  <div className="grid-cards mobile-slider">
                    {(() => {
                      const studentYearNorm = (student?.year || '').replace(/أ|إ|آ/g, 'ا').trim();
                      let matched = showcaseCourses.filter(c => {
                        const courseYearNorm = c.classLevel.replace(/أ|إ|آ/g, 'ا').trim();
                        return studentYearNorm ? courseYearNorm === studentYearNorm : c.classLevel === 'الصف الثالث الثانوي';
                      });
                      if (matched.length === 0) {
                        matched = showcaseCourses.slice(0, 3);
                      }
                      return matched.map((course) => (
                        <div key={course.id} className="uiverse-course-card">
                        <div className="uiverse-top-card">
                          <img src={course.imageUrl} alt={course.title} />
                          <span className="badge badge-primary" style={{ position: 'absolute', top: '15px', right: '15px', fontWeight: '800', zIndex: 5 }}>{course.classLevel}</span>
                        </div>
                        <div className="uiverse-bottom-card">
                          <div className="uiverse-card-content">
                            <span className="uiverse-card-title">{course.title}</span>
                            <p className="uiverse-card-desc">{course.description}</p>
                            
                            <div className="uiverse-card-stats">
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12} /> {course.lecturesCount} حصة</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> {course.filesCount} ملفات</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Award size={12} /> {course.examsCount} امتحان</span>
                            </div>

                            <div className="uiverse-card-footer">
                              <div>
                                <span className="uiverse-card-price-label">قيمة الاشتراك</span>
                                <strong className="uiverse-card-price">{course.price} ج.م</strong>
                              </div>
                              <button onClick={() => navigate('/course/' + course.id)} className="uiverse-card-btn">
                                تفاصيل الحصة
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                  </div>
                  
                  {/* Mobile-only "View All" button below the slider */}
                  <button onClick={() => setActiveTab('lectures')} className="mobile-only-btn" style={{ width: '100%', padding: '12px', background: 'rgba(234, 88, 12, 0.08)', color: 'var(--primary)', border: '1px solid rgba(234, 88, 12, 0.2)', borderRadius: '12px', fontWeight: '800', fontSize: '0.95rem', marginTop: '5px', display: 'none', justifyContent: 'center', alignItems: 'center' }}>
                    شاهد كل المحاضرات
                  </button>
                </div>

                {/* Section 2: Recommended/Latest Lectures */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>اخترنا لك (المقترحة والأحدث)</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>مجموعة منتقاة خصيصاً لمساعدتك على التفوق هذا الأسبوع</p>
                    </div>
                  </div>

                  <div className="grid-cards mobile-slider">
                    {(() => {
                      const studentYearNorm = (student?.year || '').replace(/أ|إ|آ/g, 'ا').trim();
                      let matched = showcaseCourses.filter(c => {
                        const courseYearNorm = c.classLevel.replace(/أ|إ|آ/g, 'ا').trim();
                        return studentYearNorm ? courseYearNorm === studentYearNorm : c.classLevel === 'الصف الثالث الثانوي';
                      });
                      
                      let recommended = matched.slice(0, 2);
                      if (recommended.length < 2) {
                        const remaining = showcaseCourses.filter(c => !recommended.find(r => r.id === c.id));
                        recommended = [...recommended, ...remaining].slice(0, 2);
                      }

                      return recommended.map((course, idx) => (
                        <div key={'rec-' + course.id} className="uiverse-course-card theme-secondary">
                          <div className="uiverse-top-card">
                            <img src={course.imageUrl} alt={course.title} />
                            <span className="badge badge-primary" style={{ position: 'absolute', top: '15px', right: '15px', fontWeight: '800', zIndex: 5 }}>
                              {idx === 0 ? '🔥 الأحدث' : '💡 مقترح وموصى به'}
                            </span>
                          </div>
                        <div className="uiverse-bottom-card">
                          <div className="uiverse-card-content">
                            <span className="uiverse-card-title">{course.title}</span>
                            <p className="uiverse-card-desc">{course.description}</p>
                            
                            <div className="uiverse-card-stats">
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12} /> {course.lecturesCount} حصة</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> {course.filesCount} ملفات</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Award size={12} /> {course.examsCount} امتحان</span>
                            </div>

                            <div className="uiverse-card-footer">
                              <div>
                                <span className="uiverse-card-price-label">قيمة الاشتراك</span>
                                <strong className="uiverse-card-price">{course.price} ج.م</strong>
                              </div>
                              <button onClick={() => navigate('/course/' + course.id)} className="uiverse-card-btn">
                                تفاصيل الحصة
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                  </div>
                </div>

                {/* Section 3: Live Reviews & Prep Lessons */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>مراجعات لايف ودروس تقوية</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>انضم للمدرس مباشرة واسأل كل أسئلتك أونلاين</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {(() => {
                      const studentYearNorm = (student?.year || '').replace(/أ|إ|آ/g, 'ا').trim();
                      
                      let sessions = [];
                      if (studentYearNorm === 'الصف الاول الثانوي') {
                        sessions = [
                          {
                            id: 'live-1',
                            status: 'active',
                            title: 'لايف مراجعة تاريخ مصر القديمة والشرق',
                            desc: 'مستر مصطفى الصباغ يحل أسئلة الفصل الأول وبابل شيت أولى ثانوي أونلاين',
                            thumbnail: '/ancient_egypt.png',
                            duration: '01:30 ساعة',
                            time: 'لايف الآن',
                            actionLabel: 'دخول البث المباشر',
                            zoomUrl: 'https://zoom.us'
                          },
                          {
                            id: 'live-2',
                            status: 'upcoming',
                            title: 'ورشة حل وتدريبات حضارة اليونان والرومان',
                            desc: 'شرح كيفية استخراج نواتج التعلم وحل الأسئلة المقالية لطلاب الصف الأول الثانوي',
                            thumbnail: '/greek_roman.png',
                            duration: '📅 الخميس القادم - الساعة 7 مساءً',
                            time: 'الخميس 07:00م'
                          }
                        ];
                      } else if (studentYearNorm === 'الصف الثاني الثانوي') {
                        sessions = [
                          {
                            id: 'live-1',
                            status: 'active',
                            title: 'لايف مراجعة جغرافيا مصر الطبيعية',
                            desc: 'مراجعة خرائط التضاريس والتنمية الاقتصادية لطلاب تانية ثانوي أونلاين',
                            thumbnail: '/egypt_geography.png',
                            duration: '01:45 ساعة',
                            time: 'لايف الآن',
                            actionLabel: 'دخول البث المباشر',
                            zoomUrl: 'https://zoom.us'
                          },
                          {
                            id: 'live-2',
                            status: 'upcoming',
                            title: 'ورشة عمل وتطبيق على جغرافيا مصر البشرية',
                            desc: 'التدريب على مهارات قراءة الخرائط وحل بنك أسئلة الجغرافيا المقالي والموضوعي',
                            thumbnail: '/egypt_geography.png',
                            duration: '📅 الخميس القادم - الساعة 8 مساءً',
                            time: 'الخميس 08:00م'
                          }
                        ];
                      } else {
                        sessions = [
                          {
                            id: 'live-1',
                            status: 'active',
                            title: 'لايف حل ومراجعة الفصل الثالث',
                            desc: 'مستر مصطفى الصباغ يحل بنك الأسئلة بالكامل أونلاين',
                            thumbnail: '/french_campaign.png',
                            duration: '02:00 ساعة',
                            time: 'لايف الآن',
                            actionLabel: 'دخول البث المباشر',
                            zoomUrl: 'https://zoom.us'
                          },
                          {
                            id: 'live-2',
                            status: 'upcoming',
                            title: 'ورشة عمل كتابة المقال التاريخي',
                            desc: 'شرح كيفية الحصول على الدرجة الكاملة في السؤال المقالي للثانوية العامة',
                            thumbnail: '/ancient_egypt.png',
                            duration: '📅 الجمعة القادم - الساعة 8 مساءً',
                            time: 'الجمعة 08:00م'
                          }
                        ];
                      }

                      return sessions.map((sess) => (
                        <div key={sess.id} className={'live-ticket-card status-' + sess.status}>
                          <div className="live-thumbnail-wrapper">
                            <img src={sess.thumbnail} alt={sess.title} />
                            {sess.status === 'active' ? (
                              <div className="live-pulse-badge">
                                <span style={{ 
                                  width: '6px', 
                                  height: '6px', 
                                  borderRadius: '50%', 
                                  background: '#ffffff', 
                                  display: 'inline-block',
                                  animation: 'pulse 1.5s infinite'
                                }}></span>
                                <span>{sess.time}</span>
                              </div>
                            ) : (
                              <div className="live-upcoming-badge">
                                <span>{sess.time}</span>
                              </div>
                            )}
                          </div>
                          <div className="live-ticket-info">
                            <h4 className="live-ticket-title">{sess.title}</h4>
                            <p className="live-ticket-desc">{sess.desc}</p>
                            <div className="live-ticket-meta">
                              <span>🎙️ مستر مصطفى الصباغ</span>
                              <span>{sess.duration}</span>
                            </div>
                          </div>
                          <div className="live-ticket-action">
                            {sess.status === 'active' ? (
                              <button 
                                onClick={() => window.open(sess.zoomUrl, '_blank')} 
                                className="btn-premium" 
                                style={{ padding: '10px 24px', fontSize: '0.85rem', background: 'var(--primary)', borderColor: 'var(--primary)', boxShadow: '0 4px 14px rgba(234, 88, 12, 0.3)' }}
                              >
                                {sess.actionLabel}
                              </button>
                            ) : (
                              <button 
                                disabled 
                                className="btn-premium btn-premium-outline" 
                                style={{ padding: '10px 24px', fontSize: '0.85rem', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                              >
                                غرفة الانتظار ⏳
                              </button>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Section: YouTube Enrichment Videos Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '4px', height: '26px', background: '#ff0000', borderRadius: '2px' }}></div>
                      <div style={{ textAlign: 'right' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>المكتبة الإثرائية على يوتيوب</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>سلاسل وفيديوهات مميزة وممتعة من قناتنا الرسمية على اليوتيوب</p>
                      </div>
                    </div>
                    {/* Navigation Buttons for Slider */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => {
                          const slider = document.getElementById('youtube-slider');
                          if (slider) slider.scrollBy({ left: 340, behavior: 'smooth' });
                        }}
                        className="btn-clay btn-clay-outline" 
                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'pointer' }}
                        title="السابق"
                      >
                        <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                      <button 
                        onClick={() => {
                          const slider = document.getElementById('youtube-slider');
                          if (slider) slider.scrollBy({ left: -340, behavior: 'smooth' });
                        }}
                        className="btn-clay btn-clay-outline" 
                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'pointer' }}
                        title="التالي"
                      >
                        <ArrowLeft size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll Slider */}
                  <div id="youtube-slider" className="youtube-slider-container">
                    {[
                      {
                        id: 'yt-1',
                        youtubeId: 'I0rR8YvE1as',
                        title: 'أسرار عالم الجن | هل إبليس مسلم ؟!',
                        channelName: 'مستر مصطفى الصباغ',
                        duration: '21:32',
                        views: '222 ألف مشاهدة',
                        publishedAt: 'قبل 8 أشهر',
                        thumbnail: 'https://img.youtube.com/vi/I0rR8YvE1as/hqdefault.jpg'
                      },
                      {
                        id: 'yt-2',
                        youtubeId: 'V2S-h_uX6Lg',
                        title: 'ماذا حدث عندما واجه المسلمون الفايكنج؟! ملحمة تاريخية',
                        channelName: 'مستر مصطفى الصباغ',
                        duration: '21:19',
                        views: '1 مليون مشاهدة',
                        publishedAt: 'قبل 4 أشهر',
                        thumbnail: 'https://img.youtube.com/vi/V2S-h_uX6Lg/hqdefault.jpg'
                      },
                      {
                        id: 'yt-3',
                        youtubeId: '9f6TzY8e-iY',
                        title: 'كل اللي محتاج تفتكره قبل الموسم الثالث من House of the Dragon',
                        channelName: 'مستر مصطفى الصباغ',
                        duration: '15:20',
                        views: '65 ألف مشاهدة',
                        publishedAt: 'قبل أسبوعين',
                        thumbnail: 'https://img.youtube.com/vi/9f6TzY8e-iY/hqdefault.jpg'
                      },
                      {
                        id: 'yt-4',
                        youtubeId: 'I0rR8YvE1as', // placeholder, can be changed
                        title: 'بناء الدولة الحديثة في مصر: عبقرية التخطيط والسياسة عهد محمد علي 🇪🇬',
                        channelName: 'مستر مصطفى الصباغ',
                        duration: '35:14',
                        views: '120 ألف مشاهدة',
                        publishedAt: 'قبل أسبوعين',
                        thumbnail: '/muhammad_ali.png'
                      },
                      {
                        id: 'yt-5',
                        youtubeId: 'V2S-h_uX6Lg', // placeholder, can be changed
                        title: 'الحملة الفرنسية على مصر والشام - فهم عميق بكافة الأسرار ونواتج التعلم 🏺',
                        channelName: 'مستر مصطفى الصباغ',
                        duration: '42:10',
                        views: '185 ألف مشاهدة',
                        publishedAt: 'قبل شهرين',
                        thumbnail: '/french_campaign.png'
                      }
                    ].map((video) => (
                      <div 
                        key={video.id} 
                        className="youtube-video-card"
                        onClick={() => setActiveYtVideoId(video.youtubeId)}
                      >
                        {/* Thumbnail Wrap */}
                        <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden', background: '#0e1320' }}>
                          <img 
                            src={video.thumbnail} 
                            alt={video.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                            onError={(e) => { e.target.src = '/student_hero.png'; }}
                          />
                          {/* Dark overlay with dynamic play icon */}
                          <div className="youtube-play-overlay" style={{ 
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                            background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.3s ease'
                          }}>
                            <div style={{
                              width: '50px', height: '50px', borderRadius: '50%', background: '#ff0000',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(255, 0, 0, 0.5)'
                            }}>
                              <span style={{ color: '#ffffff', fontSize: '1.5rem', marginRight: '-2px' }}>▶</span>
                            </div>
                          </div>
                          {/* Duration Overlay */}
                          <span style={{
                            position: 'absolute', bottom: '8px', right: '8px',
                            background: 'rgba(0,0,0,0.85)', color: '#ffffff', fontSize: '0.75rem',
                            padding: '3px 6px', borderRadius: '4px', fontWeight: '800', letterSpacing: '0.5px'
                          }}>
                            {video.duration}
                          </span>
                        </div>

                        {/* Metadata below Thumbnail */}
                        <div style={{ padding: '16px', display: 'flex', gap: '12px' }}>
                          {/* Channel Avatar circular background */}
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', background: '#ff0000',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
                            fontWeight: '900', fontSize: '0.9rem', flexShrink: 0
                          }}>
                            {video.channelName[0]}
                          </div>
                          {/* Content Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <h4 style={{
                              fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', 
                              lineHeight: '1.4', margin: 0, minHeight: '38px', overflow: 'hidden',
                              display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical'
                            }}>
                              {video.title}
                            </h4>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span>{video.channelName}</span>
                              <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>✓</span>
                            </span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '1px' }}>
                              <span>{video.views}</span>
                              <span>•</span>
                              <span>{video.publishedAt}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Interactive Quiz Banner */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>اختبر معلوماتك السريعة (Quiz)</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>جاوب على الأسئلة التفاعلية واحصل على تقييم فوري</p>
                    </div>
                  </div>

                  {/* Premium Horizontal Quiz Banner */}
                  <div className="card-premium animate-float" style={{ 
                    background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.9) 0%, rgba(202, 138, 4, 0.95) 100%)',
                    border: 'none',
                    borderRadius: '24px',
                    padding: '35px',
                    color: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '30px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(234, 88, 12, 0.15)'
                  }}>
                    {/* Left: Illustration Thumbnail Card */}
                    <div style={{ 
                      width: '240px', 
                      height: '160px', 
                      borderRadius: '20px', 
                      overflow: 'hidden', 
                      background: '#ffffff',
                      border: '4px solid rgba(255, 255, 255, 0.3)',
                      flexShrink: 0,
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
                    }}>
                      <img 
                        src="/student_hero.png" 
                        alt="Student studying illustration" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Center: Title & Description */}
                    <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(255, 255, 255, 0.2)', padding: '4px 12px', borderRadius: '6px', alignSelf: 'flex-start' }}>
                        قسم التدريب والتقييم الذاتي
                      </span>
                      <h4 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', margin: 0 }}>
                        قفل المادة بالتدريب المستمر
                      </h4>
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.9)', margin: 0, fontWeight: '500' }}>
                        ادخل الآن وجرب نظام التقييم الذاتي المطور. يحتوي هذا القسم على مئات الأسئلة التفاعلية والامتحانات التجريبية السريعة التي تغطي كافة فصول المنهج لمساعدتك على التدرب وحل نقاط الضعف.
                      </p>
                      <button 
                        onClick={() => { setActiveTab('quiz'); setError(''); setSuccess(''); }} 
                        className="btn-premium" 
                        style={{ 
                          background: '#ffffff', 
                          color: 'var(--primary)', 
                          fontWeight: '900', 
                          padding: '12px 28px', 
                          fontSize: '0.9rem',
                          border: 'none',
                          alignSelf: 'flex-start',
                          marginTop: '15px',
                          boxShadow: '0 10px 20px rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        ابدأ الاختبارات التجريبية الآن
                      </button>
                    </div>

                    {/* Right: Vertical List of Features */}
                    <div style={{ 
                      flex: '1 1 250px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '15px',
                      borderRight: '1px solid rgba(255, 255, 255, 0.25)',
                      paddingRight: '20px',
                      textAlign: 'right'
                    }}>
                      {[
                        { title: 'أسئلة تفاعلية خيار متعدد', desc: 'تدريب على نظام بابل شيت والوزارة الجديد.' },
                        { title: 'مؤقت زمني ومحاكاة للوقت', desc: 'لزيادة سرعة التفكير والحل بالامتحان.' },
                        { title: 'تقييم أداء فوري وتلقائي', desc: 'اعرف نتيجتك ونقاط ضعفك مباشرة.' },
                        { title: 'مكافآت نقاط إضافية للمتفوقين', desc: 'كلما أجبت بشكل صحيح، زادت نقاطك بالمحفظة.' }
                      ].map((feat, index) => (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>✓ {feat.title}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)' }}>{feat.desc}</span>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* Tab: Lectures */}
            {activeTab === 'lectures' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>محاضراتي ودوراتي الدراسية</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>المحاضرات والمناهج التي قمت بالاشتراك فيها والمتاحة للمشاهدة الآن</p>
                    </div>
                  </div>
                  {myCourses.length === 0 ? (
                    <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <p style={{ margin: 0 }}>ليس لديك أي محاضرات نشطة حالياً.</p>
                    </div>
                  ) : (
                    <div className="grid-cards">
                      {myCourses.map((item) => {
                        const course = item.Course || item;
                        return (
                          <div key={course.id} className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '280px' }}>
                            <div>
                              <span className="badge badge-primary" style={{ marginBottom: '15px' }}>{course.level}</span>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '10px' }}>{course.title}</h4>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                                {course.shortDesc}
                              </p>
                            </div>
                            <button onClick={() => navigate('/watch/course/' + course.id)} className="btn-clay" style={{ width: '100%' }}>
                              ابدأ المشاهدة والتعلم
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available Lectures for Class */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                      <div style={{ textAlign: 'right' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>المحاضرات المتاحة لصفك الدراسي</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>تصفح المناهج والحصص المتاحة للشراء أو الاشتراك فوراً</p>
                      </div>
                    </div>

                    {/* Search Bar Input */}
                    <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                      <input 
                        type="text" 
                        placeholder="ابحث عن محاضرة هنا..." 
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 16px 10px 40px',
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          outline: 'none',
                          transition: 'all 0.3s ease',
                          textAlign: 'right',
                          direction: 'rtl'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                      />
                      <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    </div>
                  </div>

                  <div className="grid-cards">
                    {(() => {
                      const studentYearNorm = (student?.year || '').replace(/أ|إ|آ/g, 'ا').trim();
                      let classCourses = showcaseCourses.filter(c => {
                        const courseYearNorm = c.classLevel.replace(/أ|إ|آ/g, 'ا').trim();
                        return studentYearNorm ? courseYearNorm === studentYearNorm : c.classLevel === 'الصف الثالث الثانوي';
                      });

                      if (classCourses.length === 0) {
                        classCourses = showcaseCourses.slice(0, 3);
                      }

                      const filtered = classCourses.filter(c => 
                        c.title.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                        c.description.toLowerCase().includes(courseSearchQuery.toLowerCase())
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="card-clay" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            لا توجد محاضرات تطابق بحثك حالياً.
                          </div>
                        );
                      }

                      return filtered.map((course) => (
                        <div key={'avail-' + course.id} className="uiverse-course-card">
                          <div className="uiverse-top-card">
                            <img src={course.imageUrl} alt={course.title} />
                            <span className="badge badge-primary" style={{ position: 'absolute', top: '15px', right: '15px', fontWeight: '800', zIndex: 5 }}>{course.classLevel}</span>
                          </div>
                          <div className="uiverse-bottom-card">
                            <div className="uiverse-card-content">
                              <span className="uiverse-card-title">{course.title}</span>
                              <p className="uiverse-card-desc">{course.description}</p>
                              
                              <div className="uiverse-card-stats">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12} /> {course.lecturesCount} حصة</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> {course.filesCount} ملفات</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Award size={12} /> {course.examsCount} امتحان</span>
                              </div>

                              <div className="uiverse-card-footer">
                                <div>
                                  <span className="uiverse-card-price-label">قيمة الاشتراك</span>
                                  <strong className="uiverse-card-price">{course.price} ج.م</strong>
                                </div>
                                <button onClick={() => navigate('/course/' + course.id)} className="uiverse-card-btn">
                                  تفاصيل الحصة
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Homework */}
            {activeTab === 'homework' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                  <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>الواجبات المنزلية</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: '4px' }}>تابع واجباتك المطلوبة وسلّمها بانتظام لمتابعة تقييمك.</p>
                  </div>
                </div>
                {homeworks.length === 0 ? (
                  <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    لا توجد واجبات منزلية مسجلة حالياً.
                  </div>
                ) : (
                  <div className="card-clay" style={{ padding: '0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ background: 'rgba(11, 15, 25, 0.4)', borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>عنوان الواجب</th>
                          <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>المحاضرة المرتبطة</th>
                          <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>الحالة</th>
                          <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>الدرجة والتقييم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {homeworks.map((hw) => (
                          <tr key={hw.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700' }}>{hw.title}</td>
                            <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{hw.lessonTitle || 'محاضرة عامة'}</td>
                            <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                              <span className={'badge ' + (hw.status === 'GRADED' ? 'badge-success' : hw.status === 'SUBMITTED' ? 'badge-primary' : 'badge-warning')}>
                                {hw.status === 'GRADED' ? 'تم التصحيح' : hw.status === 'SUBMITTED' ? 'قيد المراجعة' : 'لم يحل بعد'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--primary)' }}>
                              {hw.status === 'GRADED' ? (hw.score || 0) + ' / ' + (hw.maxScore || 10) : '---'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Exams */}
            {activeTab === 'exams' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                  <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>الامتحانات والتقييم</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: '4px' }}>قيّم مستواك الدراسي من خلال الاختبارات والامتحانات الدورية.</p>
                  </div>
                </div>
                {exams.length === 0 ? (
                  <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    لا توجد امتحانات متاحة حالياً لصفك الدراسي.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {exams.map((exam) => (
                      <div key={exam.id} className="card-clay" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <h4 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px' }}>{exam.title}</h4>
                          <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <span>⏱️ مدة الامتحان: {exam.durationMins} دقيقة</span>
                            <span>📝 عدد الأسئلة: {exam.questionsCount || 0}</span>
                          </div>
                        </div>
                        <button onClick={() => navigate('/watch/course/' + (exam.courseId || exam.id))} className="btn-clay">
                          دخول الامتحان
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Quiz */}
            {activeTab === 'quiz' && (() => {
              const studentYearNorm = (student?.year || '').replace(/أ|إ|آ/g, 'ا').trim();
              
              let quizData = {
                question: "ما هي المحافظة المصرية التي انطلقت منها شرارة ثورة 1919 العظيمة بقيادة سعد زغلول؟",
                options: [
                  { key: 'a', text: 'محافظة القاهرة (العاصمة)' },
                  { key: 'b', text: 'محافظة الإسماعيلية' },
                  { key: 'c', text: 'محافظة المنوفية' },
                  { key: 'd', text: 'محافظة أسيوط' }
                ],
                correctKey: 'a',
                correctFeedback: '🎉 إجابة صحيحة وممتازة! انطلقت الثورة من القاهرة عقب اعتقال سعد زغلول ورفاقه. تم منحك 5 نقاط!',
                wrongFeedback: '😅 إجابة غير صحيحة. الإجابة الصحيحة هي القاهرة. راجع الفصل الرابع وحاول في الكويز القادم!'
              };

              if (studentYearNorm === 'الصف الاول الثانوي') {
                quizData = {
                  question: "أي من العوامل التالية يُعد من العوامل الطبيعية الأساسية لقيام الزراعة واستقرار المصري القديم؟",
                  options: [
                    { key: 'a', text: 'اعتدال المناخ وجفاف الجو' },
                    { key: 'b', text: 'وجود نهر النيل والتربة الخصبة' },
                    { key: 'c', text: 'الحدود الجغرافية الطبيعية الآمنة' },
                    { key: 'd', text: 'وفرة المعادن النفيسة والصخور' }
                  ],
                  correctKey: 'b',
                  correctFeedback: '🎉 إجابة صحيحة وممتازة! نهر النيل والتربة الخصبة هما أساس استقرار المصري القديم وقيام الزراعة. تم منحك 5 نقاط!',
                  wrongFeedback: '😅 إجابة غير صحيحة. الإجابة الصحيحة هي وجود نهر النيل والتربة الخصبة كعامل طبيعي رئيسي للزراعة والاستقرار. جرب مرة أخرى!'
                };
              } else if (studentYearNorm === 'الصف الثاني الثانوي') {
                quizData = {
                  question: "أي من الموارد المائية التالية تعتمد عليها الزراعة بشكل أساسي في واحات الصحراء الغربية بمصر؟",
                  options: [
                    { key: 'a', text: 'المياه الجوفية (الآبار والعيون)' },
                    { key: 'b', text: 'مياه الأمطار الشتوية الشمالية' },
                    { key: 'c', text: 'الترع المتفرعة من نهر النيل' },
                    { key: 'd', text: 'مياه الصرف الصحي المعالجة' }
                  ],
                  correctKey: 'a',
                  correctFeedback: '🎉 إجابة صحيحة وممتازة! واحات الصحراء الغربية تعتمد بشكل كلي على خزانات المياه الجوفية والآبار والعيون للزراعة. تم منحك 5 نقاط!',
                  wrongFeedback: '😅 إجابة غير صحيحة. الإجابة الصحيحة هي المياه الجوفية (الآبار والعيون) التي تتيح الحياة والزراعة في الواحات الصحراوية. جرب مرة أخرى!'
                };
              }

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>اختبر معلوماتك السريعة</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: '4px' }}>جاوب على الأسئلة التفاعلية واحصل على تقييم فوري وتراكم نقاط</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Quiz Card */}
                    <div className="card-clay animate-float" style={{ padding: '35px', maxWidth: '820px', margin: '0 auto', width: '100%' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ background: 'rgba(234, 88, 12, 0.1)', color: 'var(--primary)', padding: '4px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900' }}>كويز أسبوعي</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)' }}>5 نقاط للإجابة الصحيحة</span>
                        </div>
                      </div>

                      {/* Question */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '28px' }}>
                        <span style={{ background: 'var(--primary)', color: 'white', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.9rem', flexShrink: 0 }}>س</span>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.6', margin: 0 }}>
                          {quizData.question}
                        </h4>
                      </div>

                      {/* Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                        {quizData.options.map((opt) => {
                          const isSelected = quizSelectedOption === opt.key;
                          const isCorrect = quizSubmitted && opt.key === quizData.correctKey;
                          const isWrong = quizSubmitted && isSelected && opt.key !== quizData.correctKey;
                          return (
                            <button
                              key={opt.key}
                              disabled={quizSubmitted}
                              onClick={() => setQuizSelectedOption(opt.key)}
                              style={{
                                width: '100%',
                                padding: '16px 22px',
                                borderRadius: '14px',
                                border: isCorrect ? '2px solid var(--accent)' : isWrong ? '2px solid var(--danger)' : isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border-color)',
                                background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : isWrong ? 'rgba(239, 68, 68, 0.08)' : isSelected ? 'rgba(234, 88, 12, 0.06)' : 'var(--bg-surface)',
                                color: isCorrect ? 'var(--accent)' : isWrong ? 'var(--danger)' : 'var(--text-main)',
                                fontWeight: '700',
                                textAlign: 'right',
                                cursor: quizSubmitted ? 'not-allowed' : 'pointer',
                                fontSize: '1rem',
                                transition: 'all 0.2s',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span>{opt.text}</span>
                              {isCorrect && <span style={{ fontSize: '1.2rem' }}>✅</span>}
                              {isWrong && <span style={{ fontSize: '1.2rem' }}>❌</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Action */}
                      {quizSubmitted ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <div style={{
                            background: quizIsCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `2px solid ${quizIsCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: quizIsCorrect ? 'var(--accent)' : 'var(--danger)',
                            padding: '18px 22px', borderRadius: '14px', fontSize: '1rem', fontWeight: '700', textAlign: 'center', lineHeight: '1.7'
                          }}>
                            {quizIsCorrect ? quizData.correctFeedback : quizData.wrongFeedback}
                          </div>
                          <button
                            onClick={() => { setQuizSelectedOption(null); setQuizSubmitted(false); setQuizIsCorrect(null); }}
                            className="btn-clay btn-clay-outline"
                            style={{ width: '100%', padding: '12px' }}
                          >
                            إعادة المحاولة 🔄
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={!quizSelectedOption || quizSubmitLoading}
                          onClick={() => handleQuizSubmit(quizData.question, quizData.correctKey)}
                          className="btn-clay"
                          style={{
                            width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: '900',
                            background: quizSelectedOption ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: quizSelectedOption ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {quizSubmitLoading ? 'جاري التحقق وإضافة النقاط...' : 'تأكيد الإجابة'}
                        </button>
                      )}
                    </div>

                    {/* Coming Soon more questions card */}
                    <div className="card-clay" style={{ padding: '24px', textAlign: 'center', opacity: 0.8 }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
                        🚀 قريباً — مئات الأسئلة التفاعلية من كل فصول المنهج مع شرح الإجابة الصحيحة والمراجعة الفورية
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tab: Wallet */}
            {activeTab === 'wallet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="grid-cards">
                  
                  {/* Balance Visual */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(59,130,246,0.1) 100%)', padding: '30px' }}>
                    <div className="flex-center" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.12)', marginBottom: '20px', overflow: 'hidden' }}>
                      <DotLottieReact
                        src="https://lottie.host/d8144e91-07ee-4f95-bf7a-d26cdd9a5255/9EBiPn85qQ.lottie"
                        loop
                        autoplay
                        style={{ width: '100%', height: '100%', transform: 'scale(1.2)' }}
                      />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>رصيدك الحالي بالمحفظة</span>
                    <strong style={{ fontSize: '2.5rem', color: 'var(--text-main)' }}>{(student?.balanceCents || walletData.wallet?.balanceCents || 0) / 100} <span style={{ fontSize: '1.2rem' }}>جنيه مصري</span></strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>يمكنك استخدام الرصيد لشراء المراجعات والمحاضرات فوراً.</span>
                  </div>

                  {/* Voucher Recharge */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                      <div style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>شحن رصيد المحفظة</h3>
                    </div>
                    <form onSubmit={handleRedeemVoucher} style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, justifyContent: 'center' }}>
                      <div>
                        <label className="input-label">كود كارت الشحن (Voucher Code)</label>
                        <input 
                          type="text" 
                          value={voucherCode} 
                          onChange={(e) => setVoucherCode(e.target.value)} 
                          placeholder="اكتب كود الشحن هنا..."
                          style={{ 
                            width: '100%', 
                            padding: '12px 16px', 
                            borderRadius: '12px', 
                            border: '1px solid var(--border-color)', 
                            background: 'var(--bg-surface)', 
                            color: 'var(--text-main)',
                            fontWeight: '600',
                            outline: 'none'
                          }} 
                        />
                      </div>
                      <button type="submit" disabled={topupLoading} className="btn-clay" style={{ width: '100%' }}>
                        {topupLoading ? 'جاري شحن الكارت...' : 'شحن الكود'}
                        {!topupLoading && <Send size={18} />}
                      </button>
                    </form>
                  </div>

                </div>

                {/* Transaction Logs */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ width: '4px', height: '22px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>سجل المعاملات المالية الأخيرة</h3>
                  </div>
                  {walletData.recent && walletData.recent.length === 0 ? (
                    <div className="card-clay" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      لا توجد معاملات سابقة مسجلة.
                    </div>
                  ) : (
                    <div className="card-clay" style={{ padding: '0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                          <tr style={{ background: 'rgba(11, 15, 25, 0.4)', borderBottom: '2px solid var(--border-color)' }}>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>نوع العملية</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>المبلغ</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>التفاصيل</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {walletData.recent?.map((tx) => (
                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                                <span className={'badge ' + (tx.type === 'DEPOSIT' || tx.type === 'TOPUP' ? 'badge-success' : 'badge-danger')}>
                                  {tx.type === 'DEPOSIT' || tx.type === 'TOPUP' ? 'شحن رصيد' : 'خصم اشتراك'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700' }}>
                                {(tx.type === 'DEPOSIT' || tx.type === 'TOPUP' ? '+' : '-') + (tx.amountCents / 100)} ج.م
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {tx.description || tx.reason || 'عملية محفظة'}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {new Date(tx.createdAt || tx.updatedAtLocal).toLocaleDateString('ar-EG')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Points History */}
            {activeTab === 'points' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="grid-cards">
                  
                  {/* Points Balance Visual */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.1) 0%, rgba(202, 138, 4, 0.1) 100%)', padding: '30px' }}>
                    <div className="flex-center" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.12)', marginBottom: '20px', overflow: 'hidden' }}>
                      <DotLottieReact
                        src="https://lottie.host/0dbfca8a-8482-4e7f-bbbc-773183539fd2/FeQ8lECQQc.lottie"
                        loop
                        autoplay
                        style={{ width: '100%', height: '100%', transform: 'scale(1.6)', transformOrigin: 'center' }}
                      />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>رصيدك الإجمالي من النقاط</span>
                    <strong style={{ fontSize: '2.5rem', color: 'var(--text-main)' }}>{student?.totalPoints || 0} <span style={{ fontSize: '1.2rem' }}>نقطة</span></strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>استخدم نقاطك للمنافسة والترتيب والحصول على جوائز!</span>
                  </div>

                  {/* How to Earn Points Guide */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                      <div style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>كيف تكسب النقاط؟</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem', color: 'var(--text-main)', padding: '10px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span>✦ حل كويز التاريخ الأسبوعي</span>
                        <strong style={{ color: 'var(--primary)', fontWeight: '800' }}>+5 نقاط</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span>✦ حضور المحاضرات أونلاين أو بالسنتر</span>
                        <strong style={{ color: 'var(--primary)', fontWeight: '800' }}>+10 نقاط</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span>✦ تسليم الواجب المنزلي المطلوب</span>
                        <strong style={{ color: 'var(--primary)', fontWeight: '800' }}>+15 نقطة</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px' }}>
                        <span>✦ اجتياز الامتحانات والتقييمات</span>
                        <strong style={{ color: 'var(--primary)', fontWeight: '800' }}>+20 نقطة</strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Points Transaction Logs */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ width: '4px', height: '22px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>سجل حركات النقاط الأخيرة</h3>
                  </div>
                  {!pointsData || pointsData.length === 0 ? (
                    <div className="card-clay" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      لا توجد حركات نقاط مسجلة حالياً.
                    </div>
                  ) : (
                    <div className="card-clay" style={{ padding: '0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                          <tr style={{ background: 'rgba(11, 15, 25, 0.4)', borderBottom: '2px solid var(--border-color)' }}>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>نوع العملية</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>النقاط</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>السبب / التفاصيل</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.9rem' }}>التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pointsData.map((pt) => (
                            <tr key={pt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                                <span className={'badge ' + (pt.points >= 0 ? 'badge-success' : 'badge-danger')}>
                                  {pt.points >= 0 ? 'إضافة نقاط' : 'خصم نقاط'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700', color: pt.points >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                                {(pt.points >= 0 ? '+' : '') + pt.points} نقطة
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                {pt.reason || 'عملية نقاط'}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {new Date(pt.createdAtLocal || pt.createdAt).toLocaleDateString('ar-EG')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: QR Attend Code */}
            {activeTab === 'qr' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
                  <div style={{ width: '4px', height: '26px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>بطاقة هوية الطالب</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: '4px' }}>امسح الكود بالسنتر لتسجيل الحضور فوراً</p>
                  </div>
                </div>

                {/* Split Card Container */}
                <div>
                  <div className="qr-grid-container" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                    border: '2px solid var(--border-color)'
                  }}>

                    {/* LEFT PANEL — Student Info */}
                    <div style={{
                      background: 'linear-gradient(160deg, var(--primary) 0%, #b45309 100%)',
                      padding: '40px 35px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '24px',
                      color: '#ffffff',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {/* Decorative circles */}
                      <div style={{ position: 'absolute', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-50px', right: '-50px' }}></div>
                      <div style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', bottom: '-30px', left: '-30px' }}></div>

                      {/* Avatar + Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                        <div style={{
                          width: '60px', height: '60px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.2)',
                          border: '3px solid rgba(255,255,255,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '900', fontSize: '1.6rem', color: '#ffffff', flexShrink: 0
                        }}>
                          {student?.studentName ? student.studentName[0] : 'ط'}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0, lineHeight: 1.3 }}>{student?.studentName}</h4>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '6px', fontWeight: '700' }}>
                            {student?.year || 'طالب منصة إتقان'}
                          </span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', position: 'relative', zIndex: 1 }}></div>

                      {/* Info Rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
                        {[
                          { label: 'السنة الدراسية', value: student?.year || '—' },
                          { label: 'رقم الهاتف', value: student?.studentPhone || '—' },
                          { label: 'المحافظة', value: student?.region || '—' },
                          { label: 'السنتر المعتاد', value: student?.centerName || '—' },
                          { label: 'كود الحضور', value: student?.centerCode || 'غير متوفر' },
                        ].map((row, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: '600' }}>{row.label}</span>
                            <strong style={{ fontSize: '0.9rem', background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '8px' }}>
                              {row.value}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {/* Brand */}
                      <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>منصة إتقان — مستر مصطفى الصباغ</span>
                      </div>
                    </div>

                    {/* RIGHT PANEL — QR Code */}
                    <div style={{
                      background: 'var(--bg-surface)',
                      padding: '40px 35px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '20px'
                    }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700', textAlign: 'center', margin: 0 }}>
                        وجّه كاميرا السنتر على هذا الكود لتسجيل حضورك فوراً
                      </p>

                      {/* QR Frame */}
                      <div style={{
                        background: '#ffffff',
                        padding: '18px',
                        borderRadius: '20px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        border: '4px solid var(--primary)',
                        display: 'inline-flex'
                      }}>
                        {student?.centerCode ? (
                          <QRCodeSVG
                            value={student.centerCode}
                            size={180}
                            bgColor="#ffffff"
                            fgColor="#0b0f19"
                            level="Q"
                          />
                        ) : (
                          <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: 'var(--text-muted)' }}>
                            <QrCode size={40} style={{ opacity: 0.3 }} />
                            <span style={{ fontSize: '0.8rem', textAlign: 'center', fontWeight: '600' }}>لا يوجد كود مفعل</span>
                          </div>
                        )}
                      </div>

                      {/* Code text */}
                      {student?.centerCode && (
                        <div style={{
                          background: 'rgba(234, 88, 12, 0.08)',
                          border: '1px solid rgba(234, 88, 12, 0.2)',
                          borderRadius: '10px',
                          padding: '10px 20px',
                          textAlign: 'center'
                        }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', fontWeight: '600' }}>كود الحضور</span>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--primary)', letterSpacing: '2px', fontFamily: 'monospace' }}>{student.centerCode}</strong>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}


            {/* Tab: My Account */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>بيانات حساب الطالب</h3>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>يمكنك مراجعة وتحديث بياناتك الشخصية هنا</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'stretch' }} className="grid-cards">
                  
                  {/* Left Column: ID Card Visual */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '30px', textAlign: 'center', height: '100%', justifyContent: 'center' }}>
                    <div className="flex-center" style={{ 
                      width: '80px', 
                      height: '80px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', 
                      boxShadow: 'var(--shadow-glow-blue)', 
                      color: 'white',
                      fontWeight: '900',
                      fontSize: '2rem'
                    }}>
                      {student?.studentName ? student.studentName[0] : 'ط'}
                    </div>

                    <div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '5px' }}>{student?.studentName}</h4>
                      <span className="badge badge-primary">{student?.year}</span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>رقم الهاتف:</span>
                        <strong>{student?.studentPhone}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>كود الحضور:</span>
                        <strong style={{ color: 'var(--primary)' }}>{student?.centerCode || 'غير متوفر'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>البريد الإلكتروني:</span>
                        <strong style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{student?.studentEmail || 'studi@itqan.com'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>رقم ولي الأمر:</span>
                        <strong>{student?.guardianPhone || '01234567191'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>المحافظة:</span>
                        <strong>{student?.region || 'القاهرة'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>حالة الحساب:</span>
                        <strong style={{ color: 'var(--accent)', fontWeight: '800' }}>حساب نشط ✅</strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Editable Profile Form */}
                  <div className="card-clay" style={{ padding: '30px' }}>
                    <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="grid-cards">
                        
                        {/* Student Name (Read Only / Disabled) */}
                        <div>
                          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            الاسم بالكامل 
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              🔒 مقفل
                            </span>
                          </label>
                          <input 
                            type="text" 
                            value={student?.studentName || ''} 
                            disabled 
                            style={{ 
                              width: '100%', 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-main)', 
                              color: 'var(--text-muted)', 
                              cursor: 'not-allowed',
                              fontWeight: '600'
                            }} 
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>لا يمكن تعديل الاسم لضمان صحة طباعة الشهادات</span>
                        </div>

                        {/* Email (Read Only / Disabled) */}
                        <div>
                          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            البريد الإلكتروني
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              🔒 مقفل
                            </span>
                          </label>
                          <input 
                            type="email" 
                            value={student?.email || ''} 
                            disabled 
                            style={{ 
                              width: '100%', 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-main)', 
                              color: 'var(--text-muted)', 
                              cursor: 'not-allowed',
                              fontWeight: '600'
                            }} 
                          />
                        </div>

                        {/* Student Phone (Read Only / Disabled) */}
                        <div>
                          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            رقم هاتف الطالب
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              🔒 مقفل
                            </span>
                          </label>
                          <input 
                            type="text" 
                            value={student?.studentPhone || ''} 
                            disabled 
                            style={{ 
                              width: '100%', 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-main)', 
                              color: 'var(--text-muted)', 
                              cursor: 'not-allowed',
                              fontWeight: '600'
                            }} 
                          />
                        </div>

                        {/* Year / Grade Level (Read Only / Disabled) */}
                        <div>
                          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            السنة الدراسية
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              🔒 مقفل
                            </span>
                          </label>
                          <input 
                            type="text" 
                            value={student?.year || ''} 
                            disabled 
                            style={{ 
                              width: '100%', 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-main)', 
                              color: 'var(--text-muted)', 
                              cursor: 'not-allowed',
                              fontWeight: '600'
                            }} 
                          />
                        </div>

                        {/* Guardian Phone (Editable) */}
                        <div>
                          <label className="input-label">رقم هاتف ولي الأمر</label>
                          <input 
                            type="text" 
                            value={profileGPhone} 
                            onChange={(e) => setProfileGPhone(e.target.value)} 
                            required
                            style={{ 
                              width: '100%', 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-surface)', 
                              color: 'var(--text-main)',
                              fontWeight: '600',
                              outline: 'none',
                              transition: 'border-color 0.2s'
                            }} 
                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                          />
                        </div>

                        {/* Governorate / Region (Editable) */}
                        <div>
                          <label className="input-label">المحافظة</label>
                          <input 
                            type="text" 
                            value={profileRegion} 
                            onChange={(e) => setProfileRegion(e.target.value)} 
                            required
                            style={{ 
                              width: '100%', 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-surface)', 
                              color: 'var(--text-main)',
                              fontWeight: '600',
                              outline: 'none',
                              transition: 'border-color 0.2s'
                            }} 
                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                          />
                        </div>

                      </div>

                      <button 
                        type="submit" 
                        disabled={updatingProfile} 
                        className="btn-clay" 
                        style={{ alignSelf: 'flex-start', marginTop: '10px' }}
                      >
                        {updatingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                      </button>

                    </form>
                  </div>

                </div>

              </div>
            )}
          </>
        )}
      </main>

      <SimpleFooter />
      {/* Custom Dashboard Mobile Bottom Nav */}
      <div className="mobile-bottom-nav">
        {[
          { id: 'home', label: 'الرئيسية', icon: Home },
          { id: 'lectures', label: 'المحاضرات', icon: Video },
          { id: 'homework', label: 'الواجبات', icon: BookOpen },
          { id: 'exams', label: 'الامتحانات', icon: Star }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setError(''); setSuccess(''); window.scrollTo(0,0); setMobileMenuOpen(false); }}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`mobile-nav-item ${mobileMenuOpen ? 'active' : ''}`}
        >
          <Menu size={20} />
          <span>المزيد</span>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '16px',
          right: '16px',
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '2px solid var(--border-color)',
          borderRadius: '20px',
          padding: '20px',
          zIndex: 9998,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <button 
            onClick={() => { setActiveTab('qr'); setMobileMenuOpen(false); window.scrollTo(0,0); }}
            className="btn-clay"
            style={{ width: '100%', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', justifyContent: 'flex-start', gap: '12px', padding: '12px 20px' }}
          >
            <QrCode size={18} />
            كود الحضور (QR)
          </button>
          <button 
            onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
            className="btn-clay"
            style={{ width: '100%', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', justifyContent: 'flex-start', gap: '12px', padding: '12px 20px' }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            {theme === 'light' ? 'الوضع الليلي' : 'الوضع الفاتح'}
          </button>
          <button 
            onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
            className="btn-clay"
            style={{ width: '100%', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--danger)', border: '1px solid rgba(244, 63, 94, 0.2)', justifyContent: 'flex-start', gap: '12px', padding: '12px 20px' }}
          >
            <LogOut size={18} />
            تسجيل الخروج
          </button>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>

          <a 
            href="https://wa.me/201000000000"
            target="_blank"
            rel="noreferrer"
            className="btn-clay"
            style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: 'none', justifyContent: 'flex-start', gap: '12px', padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none' }}
          >
            <Send size={16} />
            تواصل معنا
          </a>
          <a 
            href="/terms"
            className="btn-clay"
            style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: 'none', justifyContent: 'flex-start', gap: '12px', padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none' }}
          >
            <FileText size={16} />
            شروط الاستخدام
          </a>
          <a 
            href="/privacy"
            className="btn-clay"
            style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: 'none', justifyContent: 'flex-start', gap: '12px', padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none' }}
          >
            <AlertCircle size={16} />
            سياسة الخصوصية
          </a>
        </div>
      )}

      {/* YouTube Video Modal Player */}
      {activeYtVideoId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '20px'
        }}
        onClick={() => setActiveYtVideoId(null)}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '900px',
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-color)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            animation: 'slideDown 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Title Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <strong style={{ fontSize: '1.1rem', fontWeight: '800' }}>المشاهدة السريعة على المنصة 🎬</strong>
              <button 
                onClick={() => setActiveYtVideoId(null)}
                className="btn-clay btn-clay-outline"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>

            {/* Video Player Frame 16:9 Aspect Ratio Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              paddingTop: '56.25%', /* 16:9 Aspect Ratio */
              background: '#000000'
            }}>
              <iframe 
                src={`https://www.youtube.com/embed/${activeYtVideoId}?autoplay=1`}
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%'
                }}
              ></iframe>
            </div>
            
            {/* Hint bar */}
            <div style={{ padding: '12px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-color)', background: 'rgba(234, 88, 12, 0.03)' }}>
              💡 يمكنك مشاهدة الفيديو بالكامل تكبيراً أو تصغيراً داخل هذه النافذة دون مغادرة المنصة.
            </div>
          </div>
        </div>
      )}

      {/* Full screen celebration overlay when quiz answer is correct */}
      {quizSubmitted && quizIsCorrect && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ width: '400px', height: '400px' }}>
            <DotLottieReact
              src="https://lottie.host/88a95b26-3243-4f5e-9cdb-5ab18e881431/yYPabCq0RU.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
