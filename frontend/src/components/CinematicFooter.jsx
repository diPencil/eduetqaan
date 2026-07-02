import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAuth } from "../context/AuthContext";

// Register ScrollTrigger safely
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -------------------------------------------------------------------------
// MAGNETIC BUTTON PRIMITIVE
// -------------------------------------------------------------------------
const MagneticButton = React.forwardRef(
  ({ className, children, as: Component = "button", onClick, style, ...props }, forwardedRef) => {
    const localRef = useRef(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const element = localRef.current;
      if (!element) return;

      const handleMouseMove = (e) => {
        const rect = element.getBoundingClientRect();
        const h = rect.width / 2;
        const w = rect.height / 2;
        const x = e.clientX - rect.left - h;
        const y = e.clientY - rect.top - w;

        gsap.to(element, {
          x: x * 0.35,
          y: y * 0.35,
          rotationX: -y * 0.12,
          rotationY: x * 0.12,
          scale: 1.03,
          ease: "power2.out",
          duration: 0.4,
        });
      };

      const handleMouseLeave = () => {
        gsap.to(element, {
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          ease: "elastic.out(1, 0.3)",
          duration: 1.2,
        });
      };

      element.addEventListener("mousemove", handleMouseMove);
      element.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        element.removeEventListener("mousemove", handleMouseMove);
        element.removeEventListener("mouseleave", handleMouseLeave);
      };
    }, []);

    return (
      <Component
        ref={(node) => {
          localRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className={className}
        onClick={onClick}
        style={style}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

// -------------------------------------------------------------------------
// MARQUEE TRACK
// CSS animation بـ translateX(-50%) - دايماً مستمر بدون فراغ أو قطع
// -------------------------------------------------------------------------
function MarqueeTrack({ items }) {
  const renderItems = (prefix) =>
    items.map((text, idx) => (
      <React.Fragment key={`${prefix}-${idx}`}>
        <span style={{ whiteSpace: "nowrap", padding: "0 28px", flexShrink: 0 }}>{text}</span>
        <span style={{ color: "var(--primary)", opacity: 0.85, fontSize: "1.1rem", flexShrink: 0 }}>✦</span>
      </React.Fragment>
    ));

  return (
    <div style={{ overflow: "hidden", width: "100%", direction: "ltr" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: "0.85rem",
          fontWeight: "800",
          color: "var(--text-main)",
          userSelect: "none",
          animation: "marquee-scroll 35s linear infinite",
          willChange: "transform",
          width: "max-content",
        }}
      >
        {/* كوبي A */}
        <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          {renderItems("a")}
        </div>
        {/* كوبي B - نسخة مطابقة ورا A عشان الدوران يكون seamless */}
        <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          {renderItems("b")}
        </div>
      </div>
    </div>
  );
}

export default function CinematicFooter({ setActiveTab }) {
  const { isAuthenticated } = useAuth();
  const textItems = [
    "المنصة التعليمية الأولى للتاريخ بمصر",
    "معاك لحد التقفيل والدرجات النهائية",
    "خبرة أكتر من 10 سنوات في تدريس الثانوية العامة بمصر",
    "متابعة دورية وتقارير كاملة لأولياء الأمور",
    "امتحانات دورية وواجبات إلكترونية وحل أسئلة متنوعة",
    "التاريخ أسهل بكتير معانا مع الصباغ",
    "شرح ونواتج تعلم متكاملة بدون حفظ معقد",
    "أقوى شرح لنواتج التعلم والخرائط الذهنية",
    "تأسيس سليم ومراجعات ليلة الامتحان لضمان التفوق",
    "مستر مصطفى الصباغ - معلم التاريخ الأول"
  ];

  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const giantTextRef = useRef(null);
  const headingRef = useRef(null);
  const linksRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!wrapperRef.current) return;

    const ctx = gsap.context(() => {
      // Parallax scroll on the giant background name
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.9, opacity: 0 },
        {
          y: "3vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 95%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );

      // Staggered contents reveal animation
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 80%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLinkClick = (path) => {
    navigate(path);
    window.scrollTo({ top: 0 });
  };

  return (
    <div ref={wrapperRef} className="cinematic-footer-reveal-container cinematic-footer-wrapper">
      <footer className="cinematic-footer">
        
        {/* Ambient Light & Grid Background */}
        <div className="footer-aurora animate-footer-breathe" />
        <div className="footer-bg-grid" />

        {/* Giant background text (Arabic name of teacher is beautiful in English representation) */}
        <div ref={giantTextRef} className="footer-giant-bg-text">
          EL-SABBAGH
        </div>

        {/* 1. Diagonal Sleek Marquee (Top of footer) */}
        <div 
          style={{
            position: "absolute",
            top: "40px",
            left: "-5%",
            width: "110%",
            overflow: "hidden",
            borderTop: "1.5px solid var(--border-color)",
            borderBottom: "1.5px solid var(--border-color)",
            background: "var(--bg-surface-glass)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "14px 0",
            zIndex: 10,
            transform: "rotate(-2deg) scale(1.02)",
            boxShadow: "var(--shadow-md)"
          }}
        >
          <MarqueeTrack items={textItems} />
        </div>

        {/* 2. Main Center Content */}
        <div 
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 20px",
            marginTop: "120px",
            width: "100%",
            maxWidth: "960px",
            marginRight: "auto",
            marginLeft: "auto",
            flexGrow: 1
          }}
        >
          <h2
            ref={headingRef}
            className="footer-text-glow"
            style={{
              fontSize: "clamp(2rem, 5vw, 3.8rem)",
              fontWeight: "900",
              marginBottom: "35px",
              textAlign: "center",
              lineHeight: 1.2
            }}
          >
            {isAuthenticated ? "هتتسلى وتتعلم مع كويز التاريخ الأسبوعي؟" : "جاهز تبدأ رحلة التفوق؟"}
          </h2>

          {/* Interactive Magnetic Pills Layout */}
          <div ref={linksRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "25px", width: "100%" }}>
            
            {/* Primary Action Button */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "15px", width: "100%" }}>
              <MagneticButton 
                as="button" 
                onClick={() => {
                  if (isAuthenticated) {
                    if (setActiveTab) setActiveTab('quiz');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    navigate("/auth?tab=register");
                  }
                }}
                className="footer-glass-pill"
                style={{
                  padding: "16px 36px",
                  borderRadius: "50px",
                  fontSize: "1rem",
                  fontWeight: "800",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                {isAuthenticated ? "ابدأ كويز التاريخ الآن" : "ابدأ رحلتك دلوقتي"}
              </MagneticButton>
              
              <MagneticButton 
                as="a" 
                href="https://wa.me/201000000000"
                target="_blank"
                rel="noreferrer"
                className="footer-glass-pill"
                style={{
                  padding: "16px 36px",
                  borderRadius: "50px",
                  fontSize: "1rem",
                  fontWeight: "800",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.18 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.351-2.903-6.985-2.904-5.442 0-9.866 4.42-9.869 9.866-.001 1.773.465 3.506 1.348 5.029l-1.008 3.685 3.774-.99zm12.302-5.382c-.33-.166-1.95-.963-2.251-1.074-.3-.11-.52-.165-.74.165-.22.33-.85 1.074-1.04 1.295-.19.22-.38.24-.71.075-.33-.165-1.393-.513-2.656-1.64-1.06-.946-1.78-2.115-1.99-2.446-.21-.33-.02-.51.145-.674.15-.147.33-.347.49-.52.16-.174.22-.294.33-.49.11-.196.05-.367-.02-.517-.07-.15-.62-1.492-.85-2.043-.224-.54-.47-.466-.648-.475-.166-.008-.356-.01-.546-.01-.19 0-.5.07-.76.357-.26.287-1 .978-1 2.387 0 1.41 1.02 2.77 1.16 2.96.14.19 2.01 3.07 4.87 4.31.68.293 1.21.47 1.62.6.68.217 1.3.187 1.79.114.545-.08 1.95-.797 2.22-1.527.277-.73.277-1.353.197-1.492-.08-.14-.3-.223-.63-.39z"/>
                </svg>
                تواصل معنا واتساب
              </MagneticButton>
            </div>

            {/* Secondary Platform Links */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px", width: "100%", marginTop: "10px" }}>
              <MagneticButton 
                as="button" 
                onClick={() => handleLinkClick("/support")} 
                className="footer-glass-pill"
                style={{ padding: "10px 24px", borderRadius: "30px", fontSize: "0.85rem", fontWeight: "700" }}
              >
                الدعم الفني
              </MagneticButton>
              <MagneticButton 
                as="button" 
                onClick={() => handleLinkClick("/terms")} 
                className="footer-glass-pill"
                style={{ padding: "10px 24px", borderRadius: "30px", fontSize: "0.85rem", fontWeight: "700" }}
              >
                شروط الاستخدام
              </MagneticButton>
              <MagneticButton 
                as="button" 
                onClick={() => handleLinkClick("/privacy")} 
                className="footer-glass-pill"
                style={{ padding: "10px 24px", borderRadius: "30px", fontSize: "0.85rem", fontWeight: "700" }}
              >
                سياسة الخصوصية
              </MagneticButton>
            </div>
          </div>
        </div>

        {/* 3. Bottom Bar / Credits */}
        <div 
          style={{
            position: "relative",
            zIndex: 20,
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px",
            borderTop: "1px solid var(--border-color)",
            paddingTop: "24px",
            marginTop: "40px"
          }}
        >
          {/* Copyright */}
          <div style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: "800" }}>
            حقوق الطبع والنشر © 2026. كل الحقوق محفوظة لمنصة مستر مصطفى الصباغ التعليمية.
          </div>

          {/* Action elements: Made with Love & Back to Top side-by-side */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "nowrap" }}>
            {/* "Made with Love" Badge */}
            <div className="footer-glass-pill" style={{ padding: "8px 20px", borderRadius: "30px", display: "flex", alignItems: "center", gap: "8px", cursor: "default" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "800", letterSpacing: "0.5px" }}>صُنع بحب</span>
              <span className="animate-footer-heartbeat" style={{ fontSize: "1rem", color: "var(--danger)" }}>❤</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "800", letterSpacing: "0.5px" }}>بواسطة</span>
              <span style={{ fontWeight: "900", fontSize: "0.85rem", color: "var(--text-main)" }}>منصة إتقان</span>
            </div>

            {/* Back to top button */}
            <MagneticButton
              as="button"
              onClick={scrollToTop}
              className="footer-glass-pill"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
              </svg>
            </MagneticButton>
          </div>

        </div>
      </footer>
    </div>
  );
}
