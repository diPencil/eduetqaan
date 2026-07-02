import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Lock, Phone, Mail, User, MapPin, Calendar, School, AlertCircle, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

export default function Auth() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Tabs: 'login' | 'register'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'login');
  
  // Shared States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login Form States
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGuardianPhone, setRegGuardianPhone] = useState('');
  const [regYear, setRegYear] = useState('الصف الثالث الثانوي'); // Default
  const [regRegion, setRegRegion] = useState('القاهرة'); // Default
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCenterId, setRegCenterId] = useState('');
  
  // Database dynamic states
  const [centers, setCenters] = useState([]);
  const [regStep, setRegStep] = useState(1);

  const validateStep1 = () => {
    setError('');
    if (!regName.trim()) {
      setError('يرجى كتابة الاسم رباعي باللغة العربية');
      return false;
    }
    if (!regEmail.trim()) {
      setError('يرجى كتابة البريد الإلكتروني');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setError('البريد الإلكتروني المكتوب غير صالح');
      return false;
    }
    if (!regPhone.trim()) {
      setError('يرجى كتابة رقم هاتف الطالب');
      return false;
    }
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(regPhone.trim())) {
      setError('رقم الهاتف الخاص بالطالب غير صالح (يجب أن يبدأ بـ 01 ومكون من 11 رقماً)');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setError('');
    if (!regGuardianPhone.trim()) {
      setError('يرجى كتابة رقم هاتف ولي الأمر');
      return false;
    }
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(regGuardianPhone.trim())) {
      setError('رقم هاتف ولي الأمر غير صالح (يجب أن يبدأ بـ 01 ومكون من 11 رقماً)');
      return false;
    }
    if (regPhone.trim() === regGuardianPhone.trim()) {
      setError('يجب أن يكون رقم هاتف الطالب مختلفاً عن رقم هاتف ولي الأمر');
      return false;
    }
    if (!regYear) {
      setError('يرجى اختيار المرحلة الدراسية');
      return false;
    }
    if (!regRegion) {
      setError('يرجى اختيار المحافظة');
      return false;
    }
    return true;
  };

  // Egyptian Governorates List
  const governorates = [
    "القاهرة", "الجيزة", "القليوبية", "الإسكندرية", "البحيرة", "مطروح", 
    "دمياط", "الدقهلية", "كفر الشيخ", "الغربية", "المنوفية", "الشرقية", 
    "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء", "جنوب سيناء", 
    "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", 
    "أسوان", "البحر الأحمر", "الوادي الجديد"
  ];

  // Secondary School Years
  const schoolYears = [
    "الصف الاول الثانوي",
    "الصف الثاني الثانوي",
    "الصف الثالث الثانوي"
  ];

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Sync searchParams with activeTab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setActiveTab('register');
    } else {
      setActiveTab('login');
    }
  }, [searchParams]);

  // Load Centers from Backend
  useEffect(() => {
    async function loadCenters() {
      try {
        const res = await api.get('/centers');
        if (res.data && res.data.success) {
          // Keep only active and non-deleted centers
          const list = Array.isArray(res.data.data) ? res.data.data : [];
          setCenters(list.filter(c => c.isActive && !c.isDeleted));
        }
      } catch (e) {
        console.error('Failed to load centers', e);
      }
    }
    if (activeTab === 'register') {
      loadCenters();
    }
  }, [activeTab]);

  // Update tab in URL
  const toggleTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setRegStep(1);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginId || !loginPassword) {
      setError('يرجى كتابة رقم الهاتف أو البريد الإلكتروني وكلمة المرور');
      return;
    }
    
    setError('');
    setLoading(true);
    
    const res = await login(loginId, loginPassword);
    setLoading(false);
    
    if (res.success) {
      navigate('/');
    } else {
      setError(res.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!regName || !regEmail || !regPhone || !regGuardianPhone || !regPassword) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(regPhone)) {
      setError('رقم الهاتف الخاص بالطالب غير صالح (يجب أن يبدأ بـ 01 ومكون من 11 رقماً)');
      return;
    }
    if (!phoneRegex.test(regGuardianPhone)) {
      setError('رقم هاتف ولي الأمر غير صالح (يجب أن يبدأ بـ 01 ومكون من 11 رقماً)');
      return;
    }
    if (regPhone === regGuardianPhone) {
      setError('يجب أن يكون رقم هاتف الطالب مختلفاً عن رقم هاتف ولي الأمر');
      return;
    }
    if (regPassword.length < 4) {
      setError('كلمة المرور يجب ألا تقل عن 4 أحرف');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);

    const formData = {
      studentName: regName,
      email: regEmail,
      studentPhone: regPhone,
      guardianPhone: regGuardianPhone,
      year: regYear,
      region: regRegion,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      centerId: regCenterId ? Number(regCenterId) : null
    };

    const res = await register(formData);
    setLoading(false);

    if (res.success) {
      // Auto login after registration
      const loginRes = await login(regPhone, regPassword);
      if (loginRes.success) {
        navigate('/');
      } else {
        setError('تم إنشاء الحساب بنجاح، يرجى تسجيل الدخول يدوياً.');
        setActiveTab('login');
      }
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '40px 24px', position: 'relative', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Decorative Warm Moving Gradients in background */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(-45deg, rgba(234, 88, 12, 0.03), rgba(202, 138, 4, 0.03), rgba(234, 179, 8, 0.03), rgba(234, 88, 12, 0.03))', backgroundSize: '400% 400%', animation: 'gradientBG 15s ease infinite', zIndex: 0 }}></div>
      
      {/* Watermark Texture behind */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/herosection.png)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.08, pointerEvents: 'none', zIndex: 0 }}></div>

      <div className="auth-grid-container" style={{ animation: 'floatUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        
        {/* Right Column: Form Card */}
        <div className="card-clay" style={{ display: 'flex', flexDirection: 'column', gap: '0px', position: 'relative', zIndex: 1, overflow: 'hidden', animation: 'floatInRight 1s cubic-bezier(0.16, 1, 0.3, 1) both 0.15s' }}>
          
          {/* Logo and Greeting */}
          <div style={{ textAlign: 'center', marginBottom: '16px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '6px', textAlign: 'center' }}>منصة <span style={{ color: 'var(--primary)', background: 'rgba(234, 88, 12, 0.08)', padding: '2px 10px', borderRadius: '8px' }}>إتقان</span></h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: '600', textAlign: 'center' }}>بوابتك التعليمية للتفوق في الثانوية العامة</p>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', background: 'var(--bg-main)', border: '2px solid var(--border-color)', borderRadius: '14px', padding: '5px', flexShrink: 0, marginBottom: '16px' }}>
            <button 
              type="button" 
              onClick={() => toggleTab('login')} 
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: '10px', 
                border: 'none', 
                background: activeTab === 'login' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'login' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: '800',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'login' ? '0 4px 12px rgba(234, 88, 12, 0.2)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              تسجيل الدخول
            </button>
            <button 
              type="button" 
              onClick={() => toggleTab('register')} 
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: '10px', 
                border: 'none', 
                background: activeTab === 'register' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'register' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: '800',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'register' ? '0 4px 12px rgba(234, 88, 12, 0.2)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              إنشاء حساب
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex-center" style={{ gap: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '2px solid rgba(244, 63, 94, 0.2)', color: 'var(--danger)', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', flexShrink: 0, marginBottom: '8px' }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div style={{ textAlign: 'right' }}>{error}</div>
            </div>
          )}

          {/* Stepper progress indicator — only when activeTab is 'register' */}
          {activeTab === 'register' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 10px 24px', direction: 'rtl', position: 'relative', flexShrink: 0 }}>
              {/* Connecting Line */}
              <div style={{ position: 'absolute', top: '16px', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
              <div style={{ position: 'absolute', top: '16px', right: '10%', left: regStep === 1 ? '90%' : regStep === 2 ? '50%' : '10%', height: '2px', background: 'var(--primary)', zIndex: 0, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>

              {/* Step 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, cursor: 'pointer' }} onClick={() => regStep > 1 && setRegStep(1)}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: regStep >= 1 ? 'var(--primary)' : 'var(--bg-main)',
                  color: regStep >= 1 ? '#ffffff' : 'var(--text-muted)',
                  border: '2px solid', borderColor: regStep >= 1 ? 'var(--primary)' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '900', fontSize: '0.85rem', transition: 'all 0.3s ease',
                  boxShadow: regStep >= 1 ? '0 0 10px rgba(234, 88, 12, 0.3)' : 'none'
                }}>
                  {regStep > 1 ? '✓' : '1'}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: regStep === 1 ? '900' : '700', color: regStep === 1 ? 'var(--primary)' : 'var(--text-muted)' }}>البيانات الشخصية</span>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, cursor: 'pointer' }} onClick={() => {
                if (regStep === 3) setRegStep(2);
                if (regStep === 1 && validateStep1()) setRegStep(2);
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: regStep >= 2 ? 'var(--primary)' : 'var(--bg-main)',
                  color: regStep >= 2 ? '#ffffff' : 'var(--text-muted)',
                  border: '2px solid', borderColor: regStep >= 2 ? 'var(--primary)' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '900', fontSize: '0.85rem', transition: 'all 0.3s ease',
                  boxShadow: regStep >= 2 ? '0 0 10px rgba(234, 88, 12, 0.3)' : 'none'
                }}>
                  {regStep > 2 ? '✓' : '2'}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: regStep === 2 ? '900' : '700', color: regStep === 2 ? 'var(--primary)' : 'var(--text-muted)' }}>البيانات الدراسية</span>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, cursor: 'pointer' }} onClick={() => {
                if (regStep === 2 && validateStep2()) setRegStep(3);
                if (regStep === 1 && validateStep1() && validateStep2()) setRegStep(3);
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: regStep >= 3 ? 'var(--primary)' : 'var(--bg-main)',
                  color: regStep >= 3 ? '#ffffff' : 'var(--text-muted)',
                  border: '2px solid', borderColor: regStep >= 3 ? 'var(--primary)' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '900', fontSize: '0.85rem', transition: 'all 0.3s ease',
                  boxShadow: regStep >= 3 ? '0 0 10px rgba(234, 88, 12, 0.3)' : 'none'
                }}>
                  3
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: regStep === 3 ? '900' : '700', color: regStep === 3 ? 'var(--primary)' : 'var(--text-muted)' }}>الحماية والأمان</span>
              </div>
            </div>
          )}

          {/* Form Container */}
          {activeTab === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, justifyContent: 'center' }}>
              <div>
                <label className="input-label">رقم الهاتف أو البريد الإلكتروني</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="input-clay" 
                    placeholder="01xxxxxxxxx أو student@email.com"
                    style={{ paddingRight: '45px' }}
                    required
                  />
                  <Phone size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div>
                <label className="input-label">كلمة المرور</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="input-clay" 
                    placeholder="••••••••"
                    style={{ paddingRight: '45px', paddingLeft: '45px' }}
                    required
                  />
                  <Lock size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-clay" style={{ marginTop: '10px' }}>
                {loading ? 'جاري التحقق...' : 'دخول'}
                {!loading && <LogIn size={18} />}
              </button>
            </form>
          ) : (
            /* Register Form (Multi-step) */
            <form onSubmit={handleRegisterSubmit} className="auth-form-scrollable" style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, overflowY: 'auto', paddingRight: '8px', minHeight: 0 }}>
              
              {/* STEP 1: Personal Info */}
              {regStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.4s ease' }}>
                  <div>
                    <label className="input-label">الاسم رباعي (باللغة العربية)</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="input-clay" 
                        placeholder="محمد أحمد محمود علي"
                        style={{ paddingRight: '45px' }}
                        required
                      />
                      <User size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">البريد الإلكتروني</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="email" 
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="input-clay" 
                        placeholder="student@example.com"
                        style={{ paddingRight: '45px' }}
                        required
                      />
                      <Mail size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">رقم هاتف الطالب</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="tel" 
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="input-clay" 
                        placeholder="01xxxxxxxxx"
                        style={{ paddingRight: '45px' }}
                        required
                      />
                      <Phone size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => { if (validateStep1()) setRegStep(2); }} 
                    className="btn-clay" 
                    style={{ marginTop: '15px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <span>الخطوة التالية: البيانات الدراسية</span>
                    <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                </div>
              )}

              {/* STEP 2: Academic Info */}
              {regStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.4s ease' }}>
                  <div>
                    <label className="input-label">رقم هاتف ولي الأمر</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="tel" 
                        value={regGuardianPhone}
                        onChange={(e) => setRegGuardianPhone(e.target.value)}
                        className="input-clay" 
                        placeholder="01xxxxxxxxx"
                        style={{ paddingRight: '45px' }}
                        required
                      />
                      <Phone size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="input-label">المرحلة الدراسية</label>
                      <div style={{ position: 'relative' }}>
                        <select 
                          value={regYear}
                          onChange={(e) => setRegYear(e.target.value)}
                          className="input-clay" 
                          style={{ paddingRight: '45px', appearance: 'none', cursor: 'pointer' }}
                        >
                          {schoolYears.map(y => (
                            <option key={y} value={y} style={{ background: 'var(--bg-surface)' }}>{y}</option>
                          ))}
                        </select>
                        <Calendar size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <label className="input-label">المحافظة</label>
                      <div style={{ position: 'relative' }}>
                        <select 
                          value={regRegion}
                          onChange={(e) => setRegRegion(e.target.value)}
                          className="input-clay" 
                          style={{ paddingRight: '45px', appearance: 'none', cursor: 'pointer' }}
                        >
                          {governorates.map(gov => (
                            <option key={gov} value={gov} style={{ background: 'var(--bg-surface)' }}>{gov}</option>
                          ))}
                        </select>
                        <MapPin size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">سنتر الحضور المعتاد (اختياري)</label>
                    <div style={{ position: 'relative' }}>
                      <select 
                        value={regCenterId}
                        onChange={(e) => setRegCenterId(e.target.value)}
                        className="input-clay" 
                        style={{ paddingRight: '45px', appearance: 'none', cursor: 'pointer' }}
                      >
                        <option value="" style={{ background: 'var(--bg-surface)' }}>أدرس أونلاين فقط (بدون سنتر)</option>
                        {centers.map(center => (
                          <option key={center.id} value={center.id} style={{ background: 'var(--bg-surface)' }}>{center.name} ({center.region})</option>
                        ))}
                      </select>
                      <School size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                    <button 
                      type="button" 
                      onClick={() => setRegStep(1)} 
                      className="btn-clay btn-clay-outline" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <ArrowLeft size={16} />
                      <span>السابق</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { if (validateStep2()) setRegStep(3); }} 
                      className="btn-clay" 
                      style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <span>الخطوة التالية: الأمان</span>
                      <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Security & Submit */}
              {regStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.4s ease' }}>
                  <div>
                    <label className="input-label">كلمة المرور</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="password" 
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="input-clay" 
                        placeholder="••••••••"
                        style={{ paddingRight: '45px' }}
                        required
                      />
                      <Lock size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">تأكيد كلمة المرور</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="password" 
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="input-clay" 
                        placeholder="••••••••"
                        style={{ paddingRight: '45px' }}
                        required
                      />
                      <Lock size={18} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                    <button 
                      type="button" 
                      onClick={() => setRegStep(2)} 
                      className="btn-clay btn-clay-outline" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <ArrowLeft size={16} />
                      <span>السابق</span>
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="btn-clay" 
                      style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <span>{loading ? 'جاري التسجيل...' : 'إنشاء حساب جديد'}</span>
                      {!loading && <UserPlus size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

        </div>

        {/* Left Column: Slogan/Image Card */}
        <div className="auth-image-card" style={{ animation: 'floatInLeft 1s cubic-bezier(0.16, 1, 0.3, 1) both 0.15s' }}>
          {/* Back button — top left */}
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(28, 25, 23, 0.75)',
              backdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '9px 16px',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.transform = 'translateX(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(28, 25, 23, 0.75)'; e.currentTarget.style.transform = 'translateX(0)'; }}
          >
            <ArrowRight size={15} />
            عودة للرئيسية
          </button>

          <div className="auth-image-overlay">
            <div className="auth-image-badge">مستر مصطفى الصباغ</div>
            <div className="auth-image-content">
              <h3 className="auth-image-title">تاريخ أسهل، درجة أعلى</h3>
              <p className="auth-image-text">منهج التاريخ والجغرافيا للثانوية العامة بأسهل شرح تفاعلي وبدون تعقيد الحفظ.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
