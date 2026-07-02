import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SimpleFooter from '../components/SimpleFooter';
import {
  ChevronLeft, Printer, ShieldCheck, Wallet, Smartphone, Hash,
  Upload, Check, AlertCircle, Phone, Bot, Loader2
} from 'lucide-react';
import api from '../utils/api';

const WALLETS = [
  { value: 'vodafone', label: 'فودافون كاش' },
  { value: 'orange', label: 'أورانج كاش' },
  { value: 'etisalat', label: 'اتصالات كاش' },
  { value: 'we', label: 'WE Pay' }
];

const MOCK_COURSES = [
  {
    id: 1, title: 'محاضرات بناء الدولة الحديثة (عهد محمد علي)', description: 'شرح تفصيلي لشخصية محمد علي، سياسته الداخلية والخارجية، نواتج التعلم بالفصل الثاني، وتدريبات شاملة على نواتج التعلم الحديثة.', classLevel: 'الصف الثالث الثانوي', priceCents: 15000, lessonsCount: 12, filesCount: 8, examsCount: 12, coverImageUrl: '/muhammad_ali.png'
  },
  {
    id: 2, title: 'محاضرات الحملة الفرنسية على مصر والشام', description: 'دراسة أسباب مجيء الحملة الفرنسية، المقاومة الوطنية، الآثار الفكرية والسياسية، وكيف بدأت مصر الحديثة كقصة تاريخية مشوقة.', classLevel: 'الصف الثالث الثانوي', priceCents: 14000, lessonsCount: 10, filesCount: 6, examsCount: 10, coverImageUrl: '/french_campaign.png'
  },
  {
    id: 3, title: 'محاضرات ثورة 1919 ونشأة الدولة المصرية الحديثة', description: 'دراسة الحركة الوطنية المصرية بزعامة سعد زغلول، أحداث ثورة 1919، تصريح 28 فبراير، ودستور 1923 كفترة تاريخية غيرت مجرى الوطن.', classLevel: 'الصف الثالث الثانوي', priceCents: 13000, lessonsCount: 9, filesCount: 6, examsCount: 9, coverImageUrl: '/egypt_1919.png'
  },
  {
    id: 4, title: 'محاضرات جغرافيا مصر الطبيعية والتنمية الاقتصادية', description: 'شرح مبسط للتنمية الاقتصادية والموارد المائية والبشرية لجمهورية مصر العربية، مع خرائط تحليلية تفصيلية لنواتج تعلم الجغرافيا بالصف الثاني الثانوي.', classLevel: 'الصف الثاني الثانوي', priceCents: 12000, lessonsCount: 8, filesCount: 5, examsCount: 8, coverImageUrl: '/egypt_geography.png'
  },
  {
    id: 5, title: 'محاضرات حضارة مصر القديمة والشرق الأدنى القديم', description: 'جولة تاريخية ممتعة في حضارة مصر القديمة (الفرعونية)، حضارات بلاد الرافدين، وحضارة فينيقيا القديمة، فهم عميق للجذور التاريخية.', classLevel: 'الصف الأول الثانوي', priceCents: 10000, lessonsCount: 6, filesCount: 4, examsCount: 6, coverImageUrl: '/ancient_egypt.png'
  },
  {
    id: 6, title: 'محاضرات الحضارة اليونانية والرومانية', description: 'دراسة شاملة لحضارة الإغريق والرومان، الإسكندر الأكبر، تأثيراتهم الثقافية والسياسية في حوض البحر المتوسط والعالم القديم.', classLevel: 'الصف الأول الثانوي', priceCents: 10000, lessonsCount: 6, filesCount: 4, examsCount: 6, coverImageUrl: '/greek_roman.png'
  }
];

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { student, refreshProfile } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  // Payment method: 'wallet' | 'transfer' | 'coupon'
  const [paymentMethod, setPaymentMethod] = useState('wallet');

  // Transfer fields
  const [transferPhone, setTransferPhone] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [proofFile, setProofFile] = useState(null);

  // Coupon fields
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // General
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [toastInfo, setToastInfo] = useState({ show: false, type: '', message: '', title: '', icon: null });
  
  const showCustomToast = (type) => {
    if (type === 'bot') {
      setToastInfo({ show: true, type: 'bot', title: 'المساعد الذكي (قريباً)', message: 'سيتم إطلاق الشات بوت الخاص بالمنصة قريباً جداً 🚀', icon: <Bot size={22} /> });
    } else if (type === 'call') {
      navigator.clipboard.writeText('01234567899');
      setToastInfo({ show: true, type: 'call', title: 'تم نسخ الرقم بنجاح', message: 'رقم الدعم الفني: 01234567899 (تم النسخ للحافظة) 📞', icon: <Phone size={22} /> });
    }
    setTimeout(() => setToastInfo(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/courses/${id}`);
        if (res.data && res.data.success) {
          setCourse(res.data.data);
        } else {
          setCourse(res.data);
        }
      } catch (e) {
        console.error('Failed to load course for checkout', e);
        
        // Fallback to mock data if backend fails
        const mockCourse = MOCK_COURSES.find(c => c.id === Number(id));
        if (mockCourse) {
          setCourse(mockCourse);
          setError('');
        } else {
          setError('تعذر تحميل بيانات الكورس. ' + (e.response?.data?.message || e.message));
        }
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // Scroll Reveal Animation logic
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
  }, [loading]);

  const price = course ? (course.priceCents / 100) : 0;
  const walletBalance = (student?.balanceCents || 0) / 100;
  const canPayWallet = walletBalance >= price;
  
  const getImageUrl = (url) => {
    if (!url) return '/vite.svg';
    if (url.startsWith('http') || url.startsWith('/')) return url;
    return `/uploads/${url.split('/').pop()}`;
  };
  const coverUrl = getImageUrl(course?.coverImageUrl || course?.imageUrl);

  // === Handlers ===
  const handleWalletPurchase = async () => {
    setError(''); setSuccess('');
    setPurchaseLoading(true);
    try {
      const res = await api.post('/checkout/pay-with-wallet', { courseId: course.id });
      if (res.data && res.data.success) {
        setSuccess('تم شراء الكورس بنجاح! 🎉 يمكنك الآن بدء الدراسة.');
        refreshProfile();
      } else {
        setError(res.data.message || 'فشل عملية الشراء.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'رصيد محفظتك غير كافٍ. يرجى الشحن أولاً.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleTransferPurchase = async (e) => {
    e.preventDefault();
    if (!proofFile) { setError('يرجى رفع صورة إثبات الدفع.'); return; }
    setError(''); setSuccess('');
    setPurchaseLoading(true);
    const formData = new FormData();
    formData.append('courseId', course.id);
    formData.append('image', proofFile);
    try {
      const res = await api.post('/checkout/upload-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success) {
        setSuccess('تم رفع إثبات الدفع بنجاح! سيقوم المشرف بمراجعته وتفعيل الكورس لك قريباً.');
        setProofFile(null);
      } else {
        setError(res.data.message || 'فشل رفع إثبات الدفع.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء رفع الملف.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleCouponRedeem = async (e) => {
    e.preventDefault();
    if (!couponCode || couponCode.length < 10) { setError('يرجى إدخال كود قسيمة صالح (14 رقماً).'); return; }
    setError(''); setSuccess('');
    setCouponLoading(true);
    try {
      const res = await api.post('/wallet/redeem', { code: couponCode });
      if (res.data && res.data.success) {
        setSuccess(`تم استرداد القسيمة بنجاح! تم إضافة الرصيد لمحفظتك.`);
        refreshProfile();
        setCouponCode('');
      } else {
        setError(res.data.message || 'كود القسيمة غير صالح أو مستخدم من قبل.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'كود القسيمة غير صالح.');
    } finally {
      setCouponLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }}></div>
          <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>جاري تحميل صفحة الدفع...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Payment method option component
  const PaymentOption = ({ method, icon: Icon, title, subtitle, badge, active }) => (
    <button
      type="button"
      onClick={() => { setPaymentMethod(method); setError(''); }}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        width: '100%', textAlign: 'right',
        background: active ? 'rgba(234,88,12,0.06)' : 'transparent',
        border: `2px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
        borderRadius: '16px', padding: '16px 18px',
        cursor: 'pointer', transition: 'var(--transition-smooth)',
        position: 'relative'
      }}
    >
      <div className="flex-center" style={{
        width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
        background: active ? 'rgba(234,88,12,0.12)' : 'rgba(0,0,0,0.03)',
        color: active ? 'var(--primary)' : 'var(--text-muted)'
      }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <strong style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>{title}</strong>
          {badge && (
            <span style={{
              fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px',
              borderRadius: '6px',
              background: badge === 'الرصيد لا يكفي' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
              color: badge === 'الرصيد لا يكفي' ? 'var(--danger)' : 'var(--accent)'
            }}>{badge}</span>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>{subtitle}</span>
      </div>
      <div style={{
        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--primary)' : 'transparent'
      }}>
        {active && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }}></div>}
      </div>
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>

      {/* Top Navigation Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 24px',
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '2px solid var(--border-color)',
                padding: '8px 16px', borderRadius: '12px', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700',
                transition: 'var(--transition-smooth)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <ChevronLeft size={16} />
              رجوع
            </button>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.85rem'
              }}
            >
              <Printer size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', animation: 'pulse-dot 2s infinite' }}></span>
              تأكيد الدفع
            </h2>
            <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
            
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap', padding: '3px 8px' }}>
                <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
                <span>اتصال آمن ومشفّر</span>
              </div>
              {['3D Secure', 'SSL Secured', 'PCI DSS'].map((b, i) => (
                <span key={i} className="hide-on-mobile" style={{
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                  padding: '3px 8px', borderRadius: '6px', fontSize: '0.65rem',
                  fontWeight: '700', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
                }}>
                  <span style={{ fontWeight: '900', color: 'var(--accent)' }}>✓</span> {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {success && (
        <div style={{ maxWidth: '1100px', margin: '20px auto 0', padding: '0 24px' }}>
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.2)',
            borderRadius: '16px', padding: '18px 24px',
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
          }}>
            <Check size={22} style={{ color: 'var(--accent)' }} />
            <strong style={{ color: 'var(--accent)', fontSize: '0.95rem', flex: 1 }}>{success}</strong>
            <button
              onClick={() => navigate(`/watch/course/${course.id}`)}
              className="btn-premium"
              style={{ padding: '10px 24px', fontSize: '0.85rem' }}
            >
              ابدأ المشاهدة
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ maxWidth: '1100px', margin: '20px auto 0', padding: '0 24px' }}>
          <div style={{
            background: 'rgba(244,63,94,0.06)', border: '2px solid rgba(244,63,94,0.15)',
            borderRadius: '16px', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <span style={{ color: 'var(--danger)', fontSize: '0.88rem', fontWeight: '700' }}>{error}</span>
          </div>
        </div>
      )}
      {/* Main Content Grid */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }} className="grid-cards">

          {/* RIGHT COLUMN: Payment Methods */}
          <div className="card-clay scroll-reveal fade-in-up" style={{ padding: '28px', order: window.innerWidth < 768 ? 1 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
              <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }}></div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0 }}>اختر طريقة الدفع</h3>
            </div>

            {/* Payment Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <PaymentOption
                method="wallet"
                icon={Wallet}
                title="ادفع من رصيد محفظتي الآن"
                subtitle="خصم فوري من رصيدك لدينا وفتح الكورس مباشرة"
                badge={canPayWallet ? null : 'الرصيد لا يكفي'}
                active={paymentMethod === 'wallet'}
              />
              <PaymentOption
                method="transfer"
                icon={Smartphone}
                title="تحويل لمحافظ الموبايل + إثبات"
                subtitle="Vodafone / Orange / Etisalat / WE"
                active={paymentMethod === 'transfer'}
              />
              <PaymentOption
                method="coupon"
                icon={Hash}
                title="قسيمة/كود شحن المحفظة"
                subtitle="أدخل قسيمة من 14 رقماً لشحن المحفظة"
                active={paymentMethod === 'coupon'}
              />
            </div>

            {/* Dynamic Content Based on Method */}
            {paymentMethod === 'wallet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.7', fontWeight: '600' }}>
                  <span style={{ marginLeft: '4px' }}>💡</span>
                  سيتم الخصم فوراً من رصيد محفظتك داخل المنصة وفتح الكورس لحظياً (لو الرصيد يكفي).
                </p>

                {!canPayWallet && (
                  <button
                    onClick={() => navigate('/?tab=wallet')}
                    className="btn-premium btn-premium-outline"
                    style={{ width: '100%', padding: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Wallet size={16} />
                    اشحن المحفظة
                  </button>
                )}

                <button
                  onClick={handleWalletPurchase}
                  disabled={purchaseLoading}
                  className="btn-premium"
                  style={{
                    width: '100%', padding: '15px', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: purchaseLoading ? 0.7 : 1
                  }}
                >
                  {purchaseLoading ? (
                    <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> جاري الدفع...</>
                  ) : 'ادفع من رصيدي الآن'}
                </button>

                {!canPayWallet && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--danger)', textAlign: 'center', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    رصيدك الحالي لا يكفي لإتمام الدفع. اشحن المحفظة أولاً أو اختر طريقة دفع أخرى.
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <form onSubmit={handleTransferPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Phone Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>رقم الموبايل اللي حوّلت منه</label>
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={transferPhone}
                    onChange={(e) => setTransferPhone(e.target.value)}
                    style={{
                      width: '100%', padding: '13px 16px',
                      border: '2px solid var(--border-color)', borderRadius: '14px',
                      background: 'var(--bg-surface)', color: 'var(--text-main)',
                      fontSize: '0.95rem', fontFamily: 'var(--font-en)',
                      outline: 'none', transition: 'var(--transition-smooth)',
                      direction: 'ltr', textAlign: 'left'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>

                {/* Wallet Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>المحفظة</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedWallet}
                      onChange={(e) => setSelectedWallet(e.target.value)}
                      style={{
                        width: '100%', padding: '13px 16px',
                        border: '2px solid var(--border-color)', borderRadius: '14px',
                        background: 'var(--bg-surface)', color: 'var(--text-main)',
                        fontSize: '0.9rem', fontWeight: '600',
                        outline: 'none', cursor: 'pointer', appearance: 'none',
                        WebkitAppearance: 'none'
                      }}
                    >
                      <option value="">اختر المحفظة</option>
                      {WALLETS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </select>
                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</span>
                  </div>
                </div>

                {/* Proof Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>صورة التحويل / إيصال الدفع</label>
                  <label
                    htmlFor="proof-upload-checkout"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      width: '100%', padding: '20px',
                      border: `3px dashed ${proofFile ? 'var(--accent)' : 'var(--border-color)'}`,
                      borderRadius: '14px', cursor: 'pointer',
                      background: proofFile ? 'rgba(16,185,129,0.05)' : 'rgba(0,0,0,0.01)',
                      color: proofFile ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: '0.88rem', fontWeight: '700',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <Upload size={20} style={{ color: proofFile ? 'var(--accent)' : 'var(--primary)' }} />
                    {proofFile ? proofFile.name : 'ارفع صورة الدفع (سكرين شوت)'}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>JPG / PNG — حد أقصى 5MB</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    id="proof-upload-checkout"
                    onChange={(e) => setProofFile(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.7', fontWeight: '600' }}>
                  <span style={{ marginLeft: '4px' }}>📋</span>
                  سيتم تسجيل طلب شحن وربطه بالطلب ومراجعته من المشرف.
                </p>

                <button
                  type="submit"
                  disabled={purchaseLoading || !proofFile}
                  className="btn-premium"
                  style={{
                    width: '100%', padding: '15px', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: (purchaseLoading || !proofFile) ? 0.6 : 1
                  }}
                >
                  {purchaseLoading ? (
                    <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> جاري الإرسال...</>
                  ) : 'إرسال إثبات التحويل'}
                </button>
              </form>
            )}

            {paymentMethod === 'coupon' && (
              <form onSubmit={handleCouponRedeem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>كود القسيمة (14 رقم)</label>
                  <input
                    type="text"
                    placeholder="ادخل 14 رقماً"
                    value={couponCode}
                    maxLength={14}
                    onChange={(e) => setCouponCode(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: '100%', padding: '13px 16px',
                      border: '2px solid var(--border-color)', borderRadius: '14px',
                      background: 'var(--bg-surface)', color: 'var(--text-main)',
                      fontSize: '1.1rem', fontFamily: 'var(--font-en)', fontWeight: '700',
                      letterSpacing: '3px', textAlign: 'center',
                      outline: 'none', transition: 'var(--transition-smooth)'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.7', fontWeight: '600' }}>
                  <span style={{ marginLeft: '4px' }}>💡</span>
                  استرداد القسيمة يشحن محفظتك — بعد الشحن تقدر تختار الدفع من رصيد المحفظة فوراً.
                </p>

                <button
                  type="submit"
                  disabled={couponLoading || couponCode.length < 10}
                  className="btn-premium"
                  style={{
                    width: '100%', padding: '15px', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: (couponLoading || couponCode.length < 10) ? 0.6 : 1
                  }}
                >
                  {couponLoading ? (
                    <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> جاري الاسترداد...</>
                  ) : 'استرداد القسيمة'}
                </button>
              </form>
            )}
          </div>

          {/* LEFT COLUMN: Order Summary */}
          <div className="scroll-reveal fade-in-up" style={{ position: 'sticky', top: '80px', transitionDelay: '0.1s', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Order Summary Card */}
            <div className="card-clay" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
                <div style={{ width: '4px', height: '24px', background: 'var(--secondary)', borderRadius: '2px' }}></div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0 }}>ملخص الطلب</h3>
              </div>

              {/* Course Item */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
                <img
                  src={coverUrl}
                  alt={course?.title}
                  style={{ width: '80px', height: '80px', borderRadius: '14px', objectFit: 'cover', border: '2px solid var(--border-color)' }}
                  onError={(e) => { e.target.src = '/vite.svg'; }}
                />
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '4px', lineHeight: '1.5' }}>{course?.title}</h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>{course?.level || 'الصف الأول الثانوي'}</span>
                </div>
              </div>

              {/* Wallet Balance */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>رصيد محفظتي الآن</span>
                  <strong>{walletBalance} جنيه</strong>
                </div>

                {!canPayWallet && (
                  <div style={{
                    background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.15)',
                    borderRadius: '12px', padding: '12px 14px',
                    fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', lineHeight: '1.6'
                  }}>
                    <span style={{ marginLeft: '4px' }}>⚠️</span>
                    رصيدك لا يكفي لهذا الكورس. اشحن المحفظة أو اختر طريقة دفع أخرى.
                    <br />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>يمكنك الدفع مباشرة من هذا الرصيد باختيار "ادفع من رصيدي الآن".</span>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>السعر الأساسي</span>
                  <strong>{price} جنيه</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', paddingTop: '12px', borderTop: '2px solid var(--border-color)' }}>
                  <strong style={{ fontWeight: '900' }}>الإجمالي</strong>
                  <strong style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.3rem' }}>{price} جنيه</strong>
                </div>
              </div>
            </div>

            {/* Need Help Card */}
            <div className="card-clay" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '1.1rem' }}>🤝</span>
                <strong style={{ fontSize: '0.95rem', fontWeight: '800' }}>محتاج مساعدة؟</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', width: '100%' }}>
                <a href="https://wa.me/201234567899" target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 10px', borderRadius: '12px',
                  border: '2px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)',
                  textDecoration: 'none', transition: 'var(--transition-smooth)', cursor: 'pointer'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.012 2c5.512 0 9.988 4.478 9.988 9.988 0 5.51-4.476 9.988-9.988 9.988a9.962 9.962 0 0 1-5.11-1.405l-4.9.1.1-4.9A9.96 9.96 0 0 1 2.024 11.99C2.024 6.478 6.5 2 12.012 2zm.006 1.7a8.28 8.28 0 0 0-8.288 8.288c0 1.8.468 3.518 1.34 5.023l.11.184-1.22 3.65 3.65-1.21.18.11a8.27 8.27 0 0 0 4.228 1.155c4.57 0 8.288-3.718 8.288-8.288 0-4.57-3.718-8.288-8.288-8.288zm4.49 11.458c-.225-.113-1.332-.657-1.538-.733-.207-.076-.357-.113-.507.113-.15.226-.58 .734-.712.885-.13.15-.262.17-.487.057-.225-.113-.95-.35-1.81-1.118-.67-.597-1.12-1.336-1.252-1.562-.132-.226-.014-.348.1-.46.1-.1.225-.262.338-.394.112-.13.15-.224.224-.374.075-.15.038-.282-.018-.395-.056-.113-.506-1.22-.693-1.67-.182-.44-.367-.38-.507-.387-.132-.007-.28-.007-.43-.007s-.395.056-.6.282c-.206.225-.788.77-.788 1.875 0 1.106.807 2.175.92 2.325.112.15 1.583 2.416 3.834 3.388 2.25.972 2.25.657 2.663.62.413-.038 1.333-.545 1.52-1.07.188-.526.188-.976.132-1.07-.057-.094-.207-.15-.432-.263z" fill="#25D366"/>
                  </svg>
                  واتساب
                </a>
                <a href="tel:+201234567899" onClick={(e) => { 
                  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
                  if (!isMobile) {
                    e.preventDefault(); 
                    showCustomToast('call');
                  }
                  // On mobile, let the default tel: link behavior happen
                }} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 10px', borderRadius: '12px',
                  border: '2px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)',
                  textDecoration: 'none', transition: 'var(--transition-smooth)'
                }}>
                  <Phone size={18} style={{ color: 'var(--primary)' }} />
                  اتصال
                </a>
                <a href="#" onClick={(e) => { 
                  e.preventDefault(); 
                  showCustomToast('bot');
                }} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 10px', borderRadius: '12px',
                  border: '2px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)',
                  textDecoration: 'none', transition: 'var(--transition-smooth)'
                }}>
                  <Bot size={18} style={{ color: 'var(--secondary)' }} />
                  شات بوت
                </a>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>نرد خلال 10-30 دقيقة في أوقات العمل.</p>
            </div>
          </div>

        </div>
      </div>
      <SimpleFooter />

      {/* Custom Toast Notification */}
      <div style={{
        position: 'fixed',
        bottom: toastInfo.show ? '40px' : '-100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-surface)',
        border: '2px solid var(--border-color)',
        borderRadius: '16px',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        zIndex: 1000,
        opacity: toastInfo.show ? 1 : 0,
        pointerEvents: toastInfo.show ? 'auto' : 'none'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: toastInfo.type === 'bot' ? 'rgba(234,88,12,0.1)' : 'rgba(37,211,102,0.1)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: toastInfo.type === 'bot' ? 'var(--primary)' : '#25D366'
        }}>
          {toastInfo.icon}
        </div>
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-main)' }}>{toastInfo.title}</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: '600' }}>{toastInfo.message}</p>
        </div>
      </div>
    </div>
  );
}
