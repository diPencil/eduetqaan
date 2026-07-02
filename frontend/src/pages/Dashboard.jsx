import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, Video, FileText, Award, Wallet, QrCode, LogOut, 
  User, CheckCircle2, AlertCircle, RefreshCw, Send, DollarSign, Calendar, ArrowLeft,
  Moon, Sun
} from 'lucide-react';
import api from '../utils/api';
import { QRCodeSVG } from 'qrcode.react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function Dashboard() {
  const { student, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data States
  const [myCourses, setMyCourses] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [exams, setExams] = useState([]);
  const [walletData, setWalletData] = useState({ balanceCents: 0, recent: [] });
  const [voucherCode, setVoucherCode] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  // Profile Form States
  const [profileGPhone, setProfileGPhone] = useState('');
  const [profileRegion, setProfileRegion] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (student) {
      setProfileGPhone(student.guardianPhone || '');
      setProfileRegion(student.region || '');
    }
  }, [student]);

  // Load Data based on Tab
  useEffect(() => {
    if (!student) return;

    if (activeTab === 'home' || activeTab === 'lectures') {
      loadMyCourses();
    } else if (activeTab === 'homework') {
      loadHomeworks();
    } else if (activeTab === 'exams') {
      loadExams();
    } else if (activeTab === 'wallet') {
      loadWalletData();
    }
  }, [activeTab, student]);

  // Load Purchased Courses
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

  // Load Student Homework
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

  // Load Exams
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

  // Load Wallet and Recent Transactions
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

  // Redeem Voucher Code
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
        refreshProfile(); // refresh point balance/etc.
      } else {
        setError(res.data.message || 'كود الشحن غير صالح أو تم استخدامه مسبقاً');
      }
    } catch (err) {
      console.error('Voucher redeem error:', err);
      setError(err.response?.data?.message || 'فشل شحن الكود. تأكد من صحة الكود والمحاولة مرة أخرى.');
    } finally {
      setTopupLoading(false);
    }
  };

  // Update Profile
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
        refreshProfile(); // update AuthContext
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-main)' }}>
      {/* Sidebar Navigation */}
      <aside style={{ 
        width: '260px', 
        background: 'var(--bg-surface)', 
        borderLeft: '1px solid var(--border-color)', 
        padding: '30px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '30px',
        flexShrink: 0
      }}>
        {/* User Card */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div className="flex-center" style={{ 
            width: '50px', 
            height: '50px', 
            borderRadius: '12px', 
            background: 'var(--primary)', 
            boxShadow: 'var(--shadow-glow-blue)', 
            color: 'white',
            fontWeight: '800',
            fontSize: '1.2rem'
          }}>
            {student?.studentName ? student.studentName[0] : 'ط'}
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {student?.studentName}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{student?.year}</span>
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { id: 'home', label: 'الرئيسية', icon: BookOpen },
            { id: 'lectures', label: 'المحاضرات', icon: Video },
            { id: 'homework', label: 'الواجبات المنزلية', icon: FileText },
            { id: 'exams', label: 'الامتحانات والتقييم', icon: Award },
            { id: 'wallet', label: 'المحفظة الإلكترونية', icon: Wallet },
            { id: 'qr', label: 'كود الحضور (QR)', icon: QrCode },
            { id: 'profile', label: 'حسابي', icon: User }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => { setActiveTab(item.id); setError(''); setSuccess(''); }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '14px 18px', 
                  borderRadius: '12px', 
                  border: 'none', 
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'var(--transition)'
                }}
                className={!isActive ? 'btn-hover-effect' : ''}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions Container */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '14px 18px', 
              borderRadius: '12px', 
              border: 'none', 
              background: 'var(--border-light)', 
              color: 'var(--text-main)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'الوضع الداكن' : 'الوضع المضيء'}</span>
          </button>

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '14px 18px', 
              borderRadius: '12px', 
              border: '3px solid transparent', 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: 'var(--danger)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', maxHeight: '100vh' }}>
        
        {/* Top Header info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>أهلاً بك يا {student?.studentName?.split(' ')[0]} 👋</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>منصة إتقان تتمنى لك يوماً دراسياً مثمراً</p>
          </div>

          {/* Quick Stats Panel */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="card-clay" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', minWidth: '150px' }}>
              <div className="flex-center" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', overflow: 'hidden' }}>
                <DotLottieReact
                  src="https://lottie.host/0dbfca8a-8482-4e7f-bbbc-773183539fd2/FeQ8lECQQc.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%', transform: 'scale(1.6)', transformOrigin: 'center' }}
                />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>النقاط المجمعة</span>
                <strong style={{ fontSize: '1.2rem' }}>{student?.totalPoints || 0} نقطة</strong>
              </div>
            </div>

            <div className="card-clay" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', minWidth: '150px' }}>
              <div className="flex-center" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', overflow: 'hidden' }}>
                <DotLottieReact
                  src="https://lottie.host/d8144e91-07ee-4f95-bf7a-d26cdd9a5255/9EBiPn85qQ.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>رصيد المحفظة</span>
                <strong style={{ fontSize: '1.2rem' }}>{(student?.balanceCents || walletData.wallet?.balanceCents || 0) / 100} ج.م</strong>
              </div>
            </div>
          </div>
        </div>

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

        {/* Dynamic Tab Renderer */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>جاري التحميل...</div>}

        {!loading && (
          <>
            {/* Tab: Home / Overview */}
            {activeTab === 'home' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
                {/* Promo Card */}
                <div className="card-clay" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(6, 182, 212, 0.1) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px', flexWrap: 'wrap', gap: '20px' }}>
                  <div style={{ maxWidth: '500px' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px' }}>ابدأ الدراسة والتعلم اليوم!</h3>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                      قم بشحن محفظتك، وتصفح المحاضرات والمنهج المتاح. تذكر تسليم واجباتك أولاً بأول للحفاظ على تقييمك مستقراً والحصول على المزيد من نقاط الجوائز!
                    </p>
                  </div>
                  <button onClick={() => setActiveTab('lectures')} className="btn-clay">
                    شاهد المحاضرات الآن
                    <ArrowLeft size={18} />
                  </button>
                </div>

                {/* Grid layout for my courses */}
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '20px' }}>محاضراتي الحالية</h3>
                  {myCourses.length === 0 ? (
                    <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <p style={{ marginBottom: '15px' }}>لم تشترك في أي محاضرة بعد.</p>
                      <button onClick={() => navigate('/')} className="btn-clay btn-clay-outline">تصفح المحاضرات المتاحة</button>
                    </div>
                  ) : (
                    <div className="grid-cards">
                      {myCourses.map((item) => {
                        const course = item.Course || item;
                        return (
                          <div key={course.id} className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'between', minHeight: '280px' }}>
                            <div>
                              <span className="badge badge-primary" style={{ marginBottom: '15px' }}>{course.level}</span>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '10px' }}>{course.title}</h4>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                                {course.shortDesc}
                              </p>
                            </div>
                            <button onClick={() => navigate(`/watch/course/${course.id}`)} className="btn-clay" style={{ width: '100%' }}>
                              ابدأ المشاهدة والدراسة
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Lectures & Courses */}
            {activeTab === 'lectures' && (
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px' }}>محاضراتي ودوراتي الدراسية</h3>
                {myCourses.length === 0 ? (
                  <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <p style={{ marginBottom: '15px' }}>ليس لديك أي محاضرات نشطة حالياً.</p>
                    <button onClick={() => navigate('/')} className="btn-clay">تصفح المحاضرات المتاحة</button>
                  </div>
                ) : (
                  <div className="grid-cards">
                    {myCourses.map((item) => {
                      const course = item.Course || item;
                      return (
                        <div key={course.id} className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '300px' }}>
                          <div>
                            <img 
                              src={course.coverImageUrl ? `/uploads/${course.coverImageUrl.split('/').pop()}` : '/vite.svg'} 
                              alt={course.title} 
                              style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', marginBottom: '15px', border: '2px solid var(--border-color)' }}
                              onError={(e) => { e.target.src = '/vite.svg'; }}
                            />
                            <span className="badge badge-primary" style={{ marginBottom: '10px' }}>{course.level}</span>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '10px' }}>{course.title}</h4>
                          </div>
                          <button onClick={() => navigate(`/watch/course/${course.id}`)} className="btn-clay" style={{ width: '100%', marginTop: '15px' }}>
                            دخول المحاضرة والبدء بالدراسة
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Homework */}
            {activeTab === 'homework' && (
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px' }}>الواجبات المنزلية والمهام</h3>
                {homeworks.length === 0 ? (
                  <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    لا توجد واجبات معلقة حالياً أو أنك لم تسجل حضور السنتر لفتح الحصة بعد.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {homeworks.map((hw) => (
                      <div key={hw.id} className="card-clay" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <span className="badge badge-primary" style={{ marginBottom: '8px' }}>{hw.courseTitle}</span>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '5px' }}>{hw.title}</h4>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{hw.description}</p>
                          {hw.dueDate && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--danger)', display: 'block', marginTop: '5px' }}>
                              آخر موعد للتسليم: {new Date(hw.dueDate).toLocaleDateString('ar-EG')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <span className={`badge ${
                            hw.hwStatus === 'submitted' ? 'badge-primary' : 
                            hw.hwStatus === 'graded' ? 'badge-success' : 'badge-warning'
                          }`}>
                            {hw.hwStatus === 'submitted' ? 'تم التسليم' : 
                             hw.hwStatus === 'graded' ? 'تم التصحيح والتقييم' : 'مطلوب التسليم'}
                          </span>
                          <button onClick={() => navigate(`/watch/course/${hw.courseId}`)} className="btn-clay" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                            عرض تفاصيل الحصة والواجب
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Exams */}
            {activeTab === 'exams' && (
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px' }}>الامتحانات والاختبارات الدورية</h3>
                {exams.length === 0 ? (
                  <div className="card-clay" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    لا توجد اختبارات متاحة حالياً على حسابك.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {exams.map((exam) => (
                      <div key={exam.id} className="card-clay" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <h4 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px' }}>{exam.title}</h4>
                          <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <span>⏳ المدة الزمنية: {exam.durationMins} دقيقة</span>
                            <span>📋 عدد الأسئلة: {exam.questionsCount || 0}</span>
                          </div>
                        </div>
                        <button onClick={() => navigate(`/exams/${exam.id}`)} className="btn-clay">
                          ابدأ الامتحان الآن
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Wallet & Voucher */}
            {activeTab === 'wallet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="grid-cards">
                  {/* Recharge Card */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyBlock: 'between' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '15px' }}>شحن المحفظة بكارت شحن</h3>
                    <form onSubmit={handleRedeemVoucher} style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, justifyContent: 'center' }}>
                      <div>
                        <label className="input-label">كود كارت الشحن (Voucher Code)</label>
                        <input 
                          type="text" 
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value)}
                          className="input-clay" 
                          placeholder="أدخل كود الكارت هنا المكون من 8 أحرف"
                          required
                        />
                      </div>
                      <button type="submit" disabled={topupLoading} className="btn-clay" style={{ width: '100%' }}>
                        {topupLoading ? 'جاري الشحن...' : 'تفعيل الكود وشحن المحفظة'}
                        {!topupLoading && <Send size={18} />}
                      </button>
                    </form>
                  </div>

                  {/* Wallet Info Card */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(59,130,246,0.1) 100%)' }}>
                    <div className="flex-center" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'var(--primary)', color: 'white', marginBottom: '20px', boxShadow: 'var(--shadow-glow-blue)' }}>
                      <Wallet size={36} />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>الرصيد المتاح حالياً</span>
                    <strong style={{ fontSize: '2.5rem', color: 'var(--text-main)' }}>{(student?.balanceCents || walletData.wallet?.balanceCents || 0) / 100} <span style={{ fontSize: '1.2rem' }}>جنيه مصري</span></strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>يمكنك استخدام هذا الرصيد للاشتراك في الكورسات وحجز الحصص مباشرة.</span>
                  </div>
                </div>

                {/* Recent transaction logs */}
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '15px' }}>سجل المعاملات المالية الأخيرة</h3>
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
                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}>
                              <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                                <span className={`badge ${tx.type === 'DEPOSIT' || tx.type === 'TOPUP' ? 'badge-success' : 'badge-danger'}`}>
                                  {tx.type === 'DEPOSIT' || tx.type === 'TOPUP' ? 'شحن رصيد' : 'خصم اشتراك'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700' }}>
                                {tx.type === 'DEPOSIT' || tx.type === 'TOPUP' ? '+' : '-'}{tx.amountCents / 100} ج.م
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

            {/* Tab: QR Student Code */}
            {activeTab === 'qr' && (
              <div className="flex-center" style={{ padding: '20px 0' }}>
                <div className="card-clay animate-float" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px', padding: '40px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '5px' }}>بطاقة هوية الطالب</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>امسح الكود بالسنتر لتسجيل الحضور فوراً</p>
                  </div>

                  {/* QR Code generator */}
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '6px solid var(--primary-light)' }}>
                    {student?.centerCode ? (
                      <QRCodeSVG 
                        value={student.centerCode} 
                        size={200}
                        bgColor="#ffffff"
                        fgColor="#0b0f19"
                        level="Q"
                      />
                    ) : (
                      <div className="flex-center" style={{ width: '200px', height: '200px', color: 'var(--bg-main)' }}>
                        لا يوجد كود مفعل
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '20px', width: '100%' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '10px' }}>{student?.studentName}</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>السنة الدراسية:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{student?.year}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>المحافظة:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{student?.region}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>كود الحضور:</span>
                        <strong style={{ color: 'var(--primary-light)' }}>{student?.centerCode || 'غير متوفر'}</strong>
                      </div>
                      {student?.centerName && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>السنتر المعتاد:</span>
                          <strong style={{ color: 'var(--text-main)' }}>{student?.centerName}</strong>
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
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px' }}>بيانات حساب الطالب</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>يمكنك مراجعة وتحديث بياناتك الشخصية هنا</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }} className="grid-cards">
                  
                  {/* Left Column: ID Card Visual */}
                  <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '30px', textAlign: 'center' }}>
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

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>رقم الهاتف:</span>
                        <strong>{student?.studentPhone}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>كود الحضور:</span>
                        <strong style={{ color: 'var(--primary)' }}>{student?.centerCode || 'غير متوفر'}</strong>
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
    </div>
  );
}
