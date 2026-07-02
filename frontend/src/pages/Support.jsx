import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Sun, Moon, HelpCircle, Phone, Mail, MessageSquare, Send, CheckCircle2, AlertCircle, Clock, User, Wallet, Award, LogOut } from 'lucide-react';
import MobileBottomNav from '../components/MobileBottomNav';
import CinematicFooter from '../components/CinematicFooter';

export default function Support() {
  const navigate = useNavigate();
  const { isAuthenticated, student, logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const [formData, setFormData] = useState({
    name: student?.studentName || '',
    phone: student?.studentPhone || '',
    email: student?.email || '',
    subject: 'شحن المحفظة والاكواد',
    message: ''
  });

  useEffect(() => {
    if (student) {
      setFormData(prev => ({
        ...prev,
        name: student.studentName || prev.name,
        phone: student.studentPhone || prev.phone,
        email: student.email || prev.email,
      }));
    }
  }, [student]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) {
      setError('من فضلك املأ جميع الحقول الإلزامية (الاسم، الهاتف، ونص الرسالة)');
      return;
    }
    setError('');
    setLoading(true);
    
    // Simulate API request
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', phone: '', email: '', subject: 'شحن المحفظة والاكواد', message: '' });
    }, 1200);
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
          <span className="badge badge-primary" style={{ marginBottom: '12px', fontWeight: '800' }}>مركز المساعدة</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)' }}>مركز الدعم الفني للمنصة</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '1.1rem', maxWidth: '650px', margin: '10px auto 0' }}>
            معاك دايماً للرد على أي استفسارات أو حل أي مشكلة تقنية تواجهك في تشغيل المحاضرات أو شحن الكروت.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', alignItems: 'start' }}>
          
          {/* Right Column: Contact Channels - STICKY */}
          <div style={{ position: 'sticky', top: '90px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="card-premium" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '18px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>قنوات الدعم المباشرة</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Channel 1: WhatsApp - Real SVG Icon */}
                <a 
                  href="https://wa.me/201000000000" 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start', 
                    gap: '14px', 
                    textDecoration: 'none', 
                    color: 'inherit', 
                    padding: '14px', 
                    borderRadius: '16px', 
                    border: '1.5px solid #25d366', 
                    background: 'rgba(37, 211, 102, 0.05)',
                    transition: 'all 0.25s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37, 211, 102, 0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,211,102,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 211, 102, 0.05)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 2px', color: 'var(--text-main)' }}>تواصل فوري عبر الواتساب</h4>
                    <span style={{ fontSize: '0.8rem', color: '#25d366', fontWeight: '700' }}>أسرع رد للمشكلات العاجلة (شغال 24 ساعة)</span>
                  </div>
                </a>

                {/* Channel 2: Phone */}
                <div 
                  style={{ 
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'flex-start', 
                    gap: '14px', 
                    padding: '14px', 
                    borderRadius: '16px', 
                    border: '1.5px solid var(--border-color)', 
                    background: 'var(--bg-surface-glass)'
                  }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={22} color="white" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 2px', color: 'var(--text-main)' }}>الدعم الهاتفي للطلاب</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>01002345678 - 01223456789</span>
                  </div>
                </div>

                {/* Channel 3: Email */}
                <div 
                  style={{ 
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'flex-start', 
                    gap: '14px', 
                    padding: '14px', 
                    borderRadius: '16px', 
                    border: '1.5px solid var(--border-color)', 
                    background: 'var(--bg-surface-glass)'
                  }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={22} color="white" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 2px', color: 'var(--text-main)' }}>البريد الإلكتروني للدعم</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>support@etqan-academy.com</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Working Hours Card */}
            <div className="card-premium" style={{ padding: '24px', background: 'rgba(234, 88, 12, 0.03)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <Clock size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <h4 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>مواعيد عمل فريق الدعم التقني</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { day: 'السبت - الخميس', hours: '10:00 ص – 11:00 م', active: true },
                  { day: 'الجمعة', hours: '12:00 م – 6:00 م', active: false },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', background: row.active ? 'rgba(16,185,129,0.07)' : 'var(--bg-surface-glass)', border: `1.5px solid ${row.active ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}` }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>{row.day}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: row.active ? '#10b981' : 'var(--text-muted)', background: row.active ? 'rgba(16,185,129,0.1)' : 'transparent', padding: '3px 10px', borderRadius: '20px' }}>{row.hours}</span>
                  </div>
                ))}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: '1.6', fontWeight: '600' }}>
                  💬 الرد عبر الواتساب عادةً خلال دقائق معدودة خلال ساعات العمل
                </p>
              </div>
            </div>

          </div>

          {/* Left Column: Contact Form */}
          <div className="card-premium" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '8px', color: 'var(--text-main)' }}>أرسل تذكرة دعم فني</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', fontWeight: '600' }}>
              لو عندك مشكلة ومش عارف تتواصل، املأ البيانات دي وفريق الدعم هيتواصل معاك فوراً على موبايلك.
            </p>

            {submitted ? (
              <div className="flex-center" style={{ flexDirection: 'column', gap: '14px', padding: '30px 10px', textAlign: 'center' }}>
                <div className="flex-center" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <CheckCircle2 size={36} />
                </div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>تم إرسال رسالتك بنجاح!</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                  فريق الدعم الفني استلم المشكلة وهيراجعها وهيتصل بيك على رقم الموبايل اللي كتبته في أقرب وقت. شكراً ليك!
                </p>
                <button 
                  onClick={() => setSubmitted(false)} 
                  className="btn-premium" 
                  style={{ marginTop: '10px', padding: '10px 24px', fontSize: '0.85rem' }}
                >
                  إرسال رسالة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {error && (
                  <div className="flex-center" style={{ gap: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '2px solid rgba(244, 63, 94, 0.2)', color: 'var(--danger)', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <div style={{ textAlign: 'right' }}>{error}</div>
                  </div>
                )}

                <div>
                  <label className="input-label">الاسم الكامل *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input-clay"
                    placeholder="اكتب اسمك ثلاثي أو رباعي"
                    required
                  />
                </div>

                <div>
                  <label className="input-label">رقم الهاتف المرتبط بالحساب *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-clay"
                    placeholder="رقم الموبايل للتواصل معاك"
                    required
                  />
                </div>

                <div>
                  <label className="input-label">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-clay"
                    placeholder="بريدك الإلكتروني لمتابعة التحديثات"
                  />
                </div>

                <div>
                  <label className="input-label">نوع المشكلة</label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="input-clay"
                    style={{ background: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer' }}
                  >
                    <option value="شحن المحفظة والاكواد">شحن المحفظة والأكواد</option>
                    <option value="تشغيل الفيديوهات والمحاضرات">تشغيل الفيديوهات والمحاضرات</option>
                    <option value="الملخصات وملفات الـ PDF">الملخصات وملفات الـ PDF</option>
                    <option value="مشكلة في تسجيل الدخول">مشكلة في تسجيل الدخول / إنشاء حساب</option>
                    <option value="أخرى">استفسار أو مشكلة أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">تفاصيل المشكلة *</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="input-clay"
                    rows="4"
                    placeholder="اكتب المشكلة بالتفصيل ومكان حدوثها بالظبط عشان نقدر نساعدك بسرعة"
                    style={{ resize: 'none', padding: '12px' }}
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-premium"
                  style={{ width: '100%', padding: '12px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={16} />
                  <span>{loading ? 'جاري الإرسال...' : 'إرسال طلب الدعم'}</span>
                </button>
              </form>
            )}
          </div>

        </div>
      </main>

      {/* Platform Footer (Same as Landing Page) */}
      <CinematicFooter />
      <MobileBottomNav />
    </div>
  );
}
