import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SimpleFooter from '../components/SimpleFooter';
import { BookOpen, Clock, ShieldCheck, Check, ArrowRight, FileText, ClipboardList, Star, Users, Play, ChevronLeft, Wallet } from 'lucide-react';
import api from '../utils/api';

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

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { student } = useAuth();

  const [course, setCourse] = useState(null);
  const [hasOwnership, setHasOwnership] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showStickySubscribe, setShowStickySubscribe] = useState(false);
  const subscribeCardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar only when the card is NOT intersecting (visible)
        setShowStickySubscribe(!entry.isIntersecting);
      },
      { root: null, threshold: 0.1 }
    );

    if (subscribeCardRef.current) observer.observe(subscribeCardRef.current);
    return () => {
      if (subscribeCardRef.current) observer.unobserve(subscribeCardRef.current);
    };
  }, [loading]);

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
  }, [loading, course]);

  useEffect(() => {
    window.scrollTo(0, 0);
    async function loadCourseDetails() {
      setLoading(true);
      try {
        const courseRes = await api.get(`/courses/${id}`);
        if (courseRes.data && courseRes.data.success) {
          setCourse(courseRes.data.data);
        } else {
          setCourse(courseRes.data);
        }

        const ownershipRes = await api.get(`/courses/${id}/ownership`);
        if (ownershipRes.data && ownershipRes.data.success) {
          setHasOwnership(ownershipRes.data.owned);
        }
      } catch (e) {
        console.error('Failed to load course details', e);
        
        // Fallback to mock data if backend fails (e.g. course doesn't exist in DB yet)
        const mockCourse = MOCK_COURSES.find(c => c.id === Number(id));
        if (mockCourse) {
          setCourse(mockCourse);
          setHasOwnership(false);
          setError('');
        } else {
          setError('تعذر تحميل تفاصيل الكورس. ' + (e.response?.data?.message || e.message));
        }
      } finally {
        setLoading(false);
      }
    }
    if (id) loadCourseDetails();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }}></div>
          <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>جاري تحميل تفاصيل الحصة...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '20px', padding: '24px', background: 'var(--bg-main)' }}>
        <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
          <span>{error}</span>
        </div>
        <button onClick={() => navigate('/')} className="btn-premium" style={{ padding: '12px 32px' }}>العودة للرئيسية</button>
      </div>
    );
  }

  const price = course ? (course.priceCents / 100) : 0;
  const getImageUrl = (url) => {
    if (!url) return '/vite.svg';
    if (url.startsWith('http') || url.startsWith('/')) return url;
    return `/uploads/${url.split('/').pop()}`;
  };
  const coverUrl = getImageUrl(course?.coverImageUrl || course?.imageUrl);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Top Navigation Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'none', border: '2px solid var(--border-color)',
              color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '700',
              cursor: 'pointer', padding: '8px 18px', borderRadius: '12px',
              transition: 'var(--transition-smooth)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <ChevronLeft size={18} />
            <span>رجوع</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
              <ShieldCheck size={14} />
              <span>اتصال آمن ومشفّر</span>
            </div>
            <span style={{ background: 'rgba(234,88,12,0.1)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary)', whiteSpace: 'nowrap' }}>SSL Secured</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 24px 60px' }}>

        {/* Course Hero Banner */}
        <div className="scroll-reveal fade-in-up" style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(234,88,12,0.08) 0%, rgba(202,138,4,0.04) 100%)',
          border: '1px solid var(--border-color)',
          marginBottom: '30px',
          position: 'relative'
        }}>
          {/* Cover Image */}
          <div style={{ position: 'relative', height: '320px', overflow: 'hidden' }}>
            <img
              src={coverUrl}
              alt={course?.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = '/vite.svg'; }}
            />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '120px',
              background: 'linear-gradient(to top, rgba(28,25,23,0.8), transparent)',
              pointerEvents: 'none'
            }}></div>

            {/* Badges on image */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'var(--primary)', color: 'white',
                padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800',
                boxShadow: '0 4px 12px rgba(234,88,12,0.3)'
              }}>{course?.level || 'الصف الأول الثانوي'}</span>
              {course?.category && (
                <span style={{
                  background: 'rgba(255,255,255,0.9)', color: 'var(--text-main)',
                  padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700',
                  backdropFilter: 'blur(10px)'
                }}>{course.category}</span>
              )}
            </div>

            {/* Title overlay on image */}
            <div style={{ position: 'absolute', bottom: '20px', right: '24px', left: '24px' }}>
              <h1 style={{
                fontSize: '1.8rem', fontWeight: '900', color: 'white',
                lineHeight: '1.5', textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                margin: 0
              }}>{course?.title}</h1>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }} className="grid-cards">

          {/* Left Column: Course Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Description Card */}
            <div className="card-clay scroll-reveal fade-in-up" style={{ padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>عن هذه الحصة</h2>
              </div>
              <p style={{
                color: 'var(--text-muted)', lineHeight: '1.9', fontSize: '0.95rem',
                whiteSpace: 'pre-wrap'
              }}>
                {course?.longDesc || course?.shortDesc || 'محاضرة شاملة تغطي جميع أجزاء الدرس بالتفصيل مع أمثلة توضيحية وتدريبات عملية. يتم شرح كل نقطة بأسلوب مبسط يناسب جميع مستويات الطلاب مع التركيز على الأسئلة المتوقعة في الامتحانات.'}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="scroll-reveal fade-in-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
              <div className="card-clay" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div className="flex-center" style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(234,88,12,0.1)', margin: '0 auto 12px', color: 'var(--primary)'
                }}>
                  <Play size={22} />
                </div>
                <strong style={{ fontSize: '1.3rem', display: 'block', marginBottom: '4px' }}>{course?.lessonsCount || 6}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>حصة مسجلة</span>
              </div>

              <div className="card-clay" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div className="flex-center" style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(202,138,4,0.1)', margin: '0 auto 12px', color: 'var(--secondary)'
                }}>
                  <FileText size={22} />
                </div>
                <strong style={{ fontSize: '1.3rem', display: 'block', marginBottom: '4px' }}>{course?.filesCount || 4}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>ملف ومذكرة</span>
              </div>

              <div className="card-clay" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div className="flex-center" style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(16,185,129,0.1)', margin: '0 auto 12px', color: 'var(--accent)'
                }}>
                  <ClipboardList size={22} />
                </div>
                <strong style={{ fontSize: '1.3rem', display: 'block', marginBottom: '4px' }}>{course?.examsCount || 6}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>اختبار تجريبي</span>
              </div>

              <div className="card-clay" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div className="flex-center" style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(244,63,94,0.1)', margin: '0 auto 12px', color: 'var(--danger)'
                }}>
                  <Clock size={22} />
                </div>
                <strong style={{ fontSize: '1.3rem', display: 'block', marginBottom: '4px' }}>
                  {course?.totalDurationSec ? `${Math.round(course.totalDurationSec / 3600)}` : '∞'}
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>ساعة محتوى</span>
              </div>
            </div>

            {/* Features Card */}
            <div className="card-clay scroll-reveal fade-in-up" style={{ padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <div style={{ width: '4px', height: '24px', background: 'var(--secondary)', borderRadius: '2px' }}></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>مميزات هذه الحصة</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'شرح مفصل وشامل لجميع أجزاء الدرس',
                  'تدريبات وأسئلة محلولة على كل جزء',
                  'ملخصات ومذكرات جاهزة للتحميل',
                  'اختبارات تجريبية لقياس مستوى الفهم',
                  'إمكانية إعادة المشاهدة في أي وقت',
                  'دعم فني متواصل للاستفسارات'
                ].map((feature, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="flex-center" style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: 'rgba(16,185,129,0.1)', color: 'var(--accent)'
                    }}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher Info */}
            <div className="card-clay scroll-reveal fade-in-up" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="flex-center" style={{
                width: '60px', height: '60px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: 'white', fontWeight: '900', fontSize: '1.3rem'
              }}>م</div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '4px' }}>مستر مصطفى الصباغ</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>مدرس التاريخ — خبرة أكثر من 10 سنوات في التدريس والتأسيس</p>
              </div>
              <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--secondary)' }}>
                <Star size={16} fill="currentColor" />
                <strong style={{ fontSize: '0.9rem' }}>4.9</strong>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Purchase Card */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div ref={subscribeCardRef} className="card-clay" style={{
              padding: '0', overflow: 'hidden',
              border: '2px solid var(--border-color)'
            }}>
              {/* Price Header */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                padding: '24px 28px',
                color: 'white',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '6px' }}>قيمة الاشتراك</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                  <strong style={{ fontSize: '2.8rem', fontWeight: '900', lineHeight: 1 }}>{price}</strong>
                  <span style={{ fontSize: '1.1rem', fontWeight: '700', opacity: 0.9 }}>ج.م</span>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {hasOwnership ? (
                  <>
                    <div style={{
                      background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.2)',
                      borderRadius: '14px', padding: '16px', textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                    }}>
                      <div className="flex-center" style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: 'var(--accent)', color: 'white'
                      }}>
                        <Check size={24} strokeWidth={3} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '4px', color: 'var(--accent)' }}>أنت مشترك بالفعل ✅</strong>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>الحصة متاحة لك بالكامل</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/watch/course/${course.id}`)}
                      className="btn-premium"
                      style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Play size={18} />
                      ابدأ المشاهدة الآن
                    </button>
                  </>
                ) : (
                  <>
                    {/* Quick Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>صلاحية الحصة</span>
                        <strong>مدى الحياة ♾️</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>المحاضرات</span>
                        <strong>{course?.lessonsCount || 6} حصة</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>رصيد محفظتك</span>
                        <strong style={{ color: (student?.balanceCents || 0) >= (course?.priceCents || 0) ? 'var(--accent)' : 'var(--danger)' }}>
                          {(student?.balanceCents || 0) / 100} جنيه
                        </strong>
                      </div>
                    </div>

                    {/* Wallet Warning */}
                    {((student?.balanceCents || 0) < (course?.priceCents || 0)) && (
                      <div style={{
                        background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)',
                        borderRadius: '12px', padding: '12px 14px', fontSize: '0.8rem',
                        color: 'var(--primary)', fontWeight: '700', lineHeight: '1.6',
                        display: 'flex', alignItems: 'flex-start', gap: '8px'
                      }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
                        <span>رصيدك لا يكفي لهذا الكورس. اشحن المحفظة أو اختر طريقة دفع أخرى.</span>
                      </div>
                    )}

                    {/* Purchase Button → Checkout */}
                    <button
                      onClick={() => navigate(`/checkout/${course.id}`)}
                      className="btn-premium"
                      style={{
                        width: '100%', padding: '15px', fontSize: '1.05rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                      }}
                    >
                      <Wallet size={20} />
                      اشتراك الآن
                    </button>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
                      بالضغط على "اشتراك الآن" ستنتقل لصفحة تأكيد الدفع واختيار طريقة الدفع المناسبة لك.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Trust Badges */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap'
            }}>
              {['3D Secure', 'SSL', 'PCI DSS'].map((b, i) => (
                <span key={i} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem',
                  fontWeight: '700', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <SimpleFooter />
      
      {/* Mobile Sticky Subscribe Bar */}
      {showStickySubscribe && !hasOwnership && !loading && (
        <div className="mobile-only-btn" style={{
          display: 'none', // Overridden by mobile-only-btn on mobile
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-surface)', borderTop: '2px solid var(--border-color)',
          padding: '12px 24px', zIndex: 1000,
          alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -10px 25px rgba(0,0,0,0.06)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: '700', marginBottom: '2px' }}>قيمة الاشتراك</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', color: 'var(--text-main)' }}>
              <strong style={{ fontSize: '1.4rem', fontWeight: '900' }}>{price}</strong>
              <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>ج.م</span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/checkout/${course.id}`)}
            className="btn-premium"
            style={{ padding: '10px 24px', fontSize: '0.95rem' }}
          >
            اشتراك الآن
          </button>
        </div>
      )}
    </div>
  );
}
