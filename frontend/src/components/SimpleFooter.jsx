import React from 'react';

export default function SimpleFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      borderTop: '1px solid var(--border-color)',
      background: 'var(--bg-surface)',
      padding: '20px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px',
      marginTop: '60px',
      direction: 'rtl'
    }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>
        © {year} منصة إتقان — مستر مصطفى الصباغ. جميع الحقوق محفوظة.
      </span>
      <div className="hide-on-mobile" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <a
          href="https://wa.me/201000000000"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={e => e.target.style.color = 'var(--primary)'}
          onMouseOut={e => e.target.style.color = 'var(--text-muted)'}
        >
          تواصل معنا
        </a>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <a
          href="/terms"
          style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={e => e.target.style.color = 'var(--primary)'}
          onMouseOut={e => e.target.style.color = 'var(--text-muted)'}
        >
          شروط الاستخدام
        </a>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <a
          href="/privacy"
          style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={e => e.target.style.color = 'var(--primary)'}
          onMouseOut={e => e.target.style.color = 'var(--text-muted)'}
        >
          سياسة الخصوصية
        </a>
      </div>
    </footer>
  );
}
