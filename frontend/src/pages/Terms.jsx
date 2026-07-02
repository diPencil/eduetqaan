import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Sun, Moon, HelpCircle, ShieldCheck, FileText, Scale, CheckCircle2, User, Wallet, Award, LogOut } from 'lucide-react';
import MobileBottomNav from '../components/MobileBottomNav';
import CinematicFooter from '../components/CinematicFooter';

export default function Terms() {
  const navigate = useNavigate();
  const { isAuthenticated, student, logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.05)', filter: 'blur(100px)', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '45%', height: '45%', borderRadius: '50%', background: 'rgba(202, 138, 4, 0.06)', filter: 'blur(120px)', zIndex: 0 }}></div>
      
      {/* Platform Header (Same as Landing Page) */}
      <header className="header-glass">
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

          {/* Dynamic Navigation */}
          {isAuthenticated ? (
            <nav style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/dashboard')} style={{ fontSize: '0.8rem', fontWeight: '800', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.2s ease-in-out' }}>الرئيسية</button>
              <button onClick={() => navigate('/dashboard')} style={{ fontSize: '0.8rem', fontWeight: '800', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.2s ease-in-out' }}>المحاضرات</button>
              <button onClick={() => navigate('/dashboard')} style={{ fontSize: '0.8rem', fontWeight: '800', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.2s ease-in-out' }}>الواجبات والتقييم</button>
            </nav>
          ) : (
            <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <a href="/#courses-showcase" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }}>المحاضرات والمناهج</a>
              <a href="/#features" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }}>مزايا المنصة</a>
              <a href="/#about" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }}>عن المدرس</a>
              <a href="/#faq" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', transition: 'var(--transition-smooth)' }}>الأسئلة الشائعة</a>
            </nav>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAuthenticated ? (
              <>
                <div className="card-clay" style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                  <div className="flex-center" style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}><Award size={14} /></div>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>{student?.totalPoints || 0} نقطة</strong>
                </div>
                <div className="card-clay" style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                  <div className="flex-center" style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(234, 88, 12, 0.12)', color: 'var(--primary)' }}><Wallet size={14} /></div>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>{student?.walletBalance || 0} ج.م</strong>
                </div>
                <button onClick={() => navigate('/dashboard')} className="nav-circle-btn" style={{ background: 'var(--bg-surface)' }}><User size={16} /></button>
                <button onClick={toggleTheme} className="nav-circle-btn" style={{ background: 'var(--bg-surface)' }}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
                <button onClick={() => { logout(); navigate('/'); }} className="nav-circle-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}><LogOut size={16} /></button>
              </>
            ) : (
              <>
                <button onClick={toggleTheme} className="nav-circle-btn">
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <a href="/#faq" className="nav-circle-btn help-btn-hide-mobile" style={{ color: 'var(--text-main)', textDecoration: 'none' }} title="الأسئلة الشائعة">
                  <HelpCircle size={16} />
                </a>
                <button onClick={() => navigate('/auth?tab=register')} className="btn-premium" style={{ padding: '8px 22px', fontSize: '0.85rem' }}>
                  ابدأ دلوقتي
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container - Standard layout spacing */}
      <main style={{ flex: 1, position: 'relative', zIndex: 2, padding: '130px 24px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '45px' }}>
          <span className="badge badge-secondary" style={{ marginBottom: '12px', fontWeight: '800' }}>اتفاقية الاستخدام</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)' }}>شروط وأحكام الاستخدام</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '1.1rem' }}>
            تاريخ التحديث: يوليو 2026. يرجى قراءة الشروط بعناية قبل استخدام المنصة.
          </p>
        </div>

        <div className="card-premium" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '35px' }}>
          
          {/* Section 1 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div className="flex-center" style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(234, 88, 12, 0.08)', color: 'var(--primary)', flexShrink: 0 }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '10px' }}>1. حساب الطالب والسرية</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.75', margin: 0 }}>
                حسابك على منصة إتقان شخصي وفردي بالكامل. يُمنع منعاً باتاً مشاركة بيانات تسجيل الدخول الخاصة بك مع أي شخص آخر، أو استخدام نفس الحساب من قبل أكثر من طالب. يتتبع نظام الحماية الأمني للموقع أجهزة الدخول المتزامنة تلقائياً لحظر الحسابات المخالفة حظراً نهائياً دون استرداد قيمة الاشتراك.
              </p>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

          {/* Section 2 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div className="flex-center" style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(202, 138, 4, 0.08)', color: 'var(--primary-hover)', flexShrink: 0 }}>
              <FileText size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '10px' }}>2. الملكية الفكرية وحماية المحتوى</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.75', margin: 0 }}>
                كافة المواد المعروضة على المنصة بما في ذلك الفيديوهات المصورة، الشروحات، ملازم الـ PDF، الأسئلة والامتحانات التفاعلية هي ملك فكري خاص وحصري للأستاذ مصطفى الصباغ ومنصة إتقان. يُحظر تماماً تصوير الشاشة، إعادة تسجيل الحصص، تحميل الفيديوهات بوسائل خارجية، أو طباعة ونشر الملازم خارج نطاق الاستخدام الشخصي للطالب.
              </p>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

          {/* Section 3 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div className="flex-center" style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(234, 88, 12, 0.08)', color: 'var(--primary)', flexShrink: 0 }}>
              <Scale size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '10px' }}>3. سياسة شحن المحفظة وحجز المحاضرات</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.75', margin: 0 }}>
                تتم عمليات حجز المحاضرات والمواد عن طريق محفظة الطالب الإلكترونية والتي تشحن إما بكروت الشحن في السناتر أو فوري أو فودافون كاش. عمليات الشراء وشحن المحفظة نهائية وغير قابلة للاسترداد المالي بمجرد فتح المحاضرة وتفعيلها. صلاحية المحاضرات والملفات تستمر طوال العام الدراسي لمساعدة الطالب على المراجعة.
              </p>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

          {/* Section 4 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div className="flex-center" style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(202, 138, 4, 0.08)', color: 'var(--primary-hover)', flexShrink: 0 }}>
              <CheckCircle2 size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '10px' }}>4. قواعد المتابعة وحضور الامتحانات</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.75', margin: 0 }}>
                لضمان التفوق التام والدرجات النهائية، تتطلب المنصة من الطالب أداء جميع الواجبات والامتحانات الدورية الملحقة بالحصة. يحق لإدارة المنصة مشاركة نتائج الامتحانات، تقارير الحضور والغياب، والمستوى العام للتحصيل مباشرة مع ولي الأمر (عن طريق رقم هاتف ولي الأمر المسجل) لمتابعة مسيرة الطالب.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Platform Footer (Same as Landing Page) */}
      <CinematicFooter />
      <MobileBottomNav />
    </div>
  );
}
