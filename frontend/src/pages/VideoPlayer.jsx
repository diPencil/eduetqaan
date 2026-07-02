import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowRight, Video, FileText, Download, PlayCircle, Lock, AlertCircle, RefreshCw 
} from 'lucide-react';
import api from '../utils/api';

export default function VideoPlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { student } = useAuth();

  const [courseData, setCourseData] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  
  // Player state
  const [playerConfig, setPlayerConfig] = useState({ type: null, otp: null, playbackInfo: null, url: null, videoId: null });
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [error, setError] = useState('');
  const [playerError, setPlayerError] = useState('');

  // 1. Fetch Course Watchable details (lessons and homework)
  useEffect(() => {
    async function loadWatchData() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/watch/course/${courseId}`);
        if (res.data) {
          setCourseData(res.data);
          // Set first video as active if available
          if (res.data.videos && res.data.videos.length > 0) {
            setActiveLesson(res.data.videos[0]);
          }
        }
      } catch (err) {
        console.error('Watch course error:', err);
        setError(err.response?.data?.message || 'عذراً، لا تمتلك صلاحية لمشاهدة هذا الكورس أو تم رفض الطلب.');
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      loadWatchData();
    }
  }, [courseId]);

  // 2. Play Video whenever activeLesson changes
  useEffect(() => {
    if (!activeLesson) return;
    
    playVideo(activeLesson.id);
  }, [activeLesson]);

  // Fetch Token and Stream Data for Video
  const playVideo = async (lessonId) => {
    setPlayerLoading(true);
    setPlayerError('');
    setPlayerConfig({ type: null, otp: null, playbackInfo: null, url: null, videoId: null });

    try {
      // Step A: Request Playback Token
      const tokenRes = await api.post('/playback/token', {
        courseId: Number(courseId),
        lessonId: Number(lessonId)
      });

      if (!tokenRes.data || !tokenRes.data.success) {
        throw new Error(tokenRes.data?.message || 'Failed to fetch playback token');
      }

      const token = tokenRes.data.token;

      // Step B: Fetch Stream Metadata
      const streamRes = await api.get(`/playback/stream/${token}`);
      if (!streamRes.data || !streamRes.data.success) {
        throw new Error(streamRes.data?.message || 'Failed to fetch stream details');
      }

      const streamData = streamRes.data.data;
      
      // Step C: Handle based on streamType
      if (streamData.streamType === 'vdocipher') {
        const videoId = streamData.videoId;
        
        // Fetch VdoCipher OTP
        const otpRes = await api.get(`/vdocipher/otp?videoId=${videoId}`);
        if (otpRes.data && otpRes.data.otp) {
          setPlayerConfig({
            type: 'vdocipher',
            otp: otpRes.data.otp,
            playbackInfo: otpRes.data.playbackInfo,
            videoId: videoId
          });
        } else {
          throw new Error('فشل توليد مفتاح تشغيل VdoCipher');
        }
      } else if (streamData.streamType === 'external') {
        // Handle YouTube/Vimeo
        setPlayerConfig({
          type: 'external',
          provider: streamData.provider,
          videoId: streamData.videoId,
          url: streamData.streamUrl || streamData.embedUrl || `https://www.youtube.com/embed/${streamData.videoId}`
        });
      } else {
        // Direct MP4 / HLS / Dash URL
        setPlayerConfig({
          type: 'direct',
          url: streamData.streamUrl
        });
      }
    } catch (err) {
      console.error('Error starting playback:', err);
      setPlayerError(err.response?.data?.message || err.message || 'حدث خطأ أثناء تحميل مشغل الفيديو.');
    } finally {
      setPlayerLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>جاري تحميل محتوى الحصة التعليمية...</div>;
  }

  if (error) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '20px', padding: '24px' }}>
        <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
          <AlertCircle size={24} />
          <span>{error}</span>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-clay">العودة للوحة التحكم</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-main)' }}>
      
      {/* Left Sidebar: Lessons List */}
      <aside style={{ 
        width: '320px', 
        background: 'rgba(20, 28, 47, 0.8)', 
        borderLeft: '3px solid var(--border-color)', 
        padding: '30px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '25px',
        flexShrink: 0
      }}>
        {/* Back navigation */}
        <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)' }} onMouseOver={(e) => e.target.style.color = 'var(--text-main)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>
          <ArrowRight size={18} />
          <span>لوحة التحكم</span>
        </button>

        <div>
          <span className="badge badge-primary" style={{ marginBottom: '8px' }}>{courseData?.grade}</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '900', lineHeight: '1.4' }}>{courseData?.title}</h2>
        </div>

        {/* Section: Videos */}
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={16} />
            <span>المحاضرات المرئية ({courseData?.videos?.length || 0})</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {courseData?.videos?.map((vid) => {
              const isActive = activeLesson?.id === vid.id;
              return (
                <button
                  key={vid.id}
                  onClick={() => setActiveLesson(vid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 15px',
                    borderRadius: '12px',
                    border: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                    background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'rgba(11, 15, 25, 0.3)',
                    color: isActive ? 'var(--primary-light)' : 'var(--text-main)',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'right',
                    width: '100%',
                    transition: 'var(--transition)'
                  }}
                >
                  <PlayCircle size={18} style={{ flexShrink: 0, color: isActive ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {vid.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section: Homeworks / Files */}
        {courseData?.homework && courseData.homework.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} />
              <span>ملفات وواجبات الحصة ({courseData.homework.length})</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {courseData.homework.map((hw) => (
                <div 
                  key={hw.id} 
                  style={{ 
                    padding: '12px 15px', 
                    borderRadius: '12px', 
                    background: 'rgba(11, 15, 25, 0.2)', 
                    border: '2px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{hw.title}</div>
                  
                  {/* Download buttons for resources */}
                  {hw.resources && hw.resources.map((res, idx) => (
                    <a 
                      key={res.id || idx}
                      href={res.url ? `/uploads/${res.url.split('/').pop()}` : '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-clay btn-clay-outline"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', width: '100%', gap: '5px' }}
                    >
                      <Download size={14} />
                      <span>تحميل {res.label || 'الملف المرفق'}</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Right Area: Player & Lesson info */}
      <main style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
        
        {/* Video Player Box */}
        <div 
          className="card-clay" 
          style={{ 
            padding: '0', 
            overflow: 'hidden', 
            background: '#000000', 
            borderRadius: '24px', 
            aspectRatio: '16/9', 
            position: 'relative',
            borderWidth: '4px'
          }}
        >
          {playerLoading ? (
            <div className="flex-center" style={{ position: 'absolute', inset: 0, flexDirection: 'column', gap: '15px', color: 'white' }}>
              <RefreshCw size={40} className="animate-spin" />
              <span>جاري تحميل مشغل الفيديوهات الآمن...</span>
            </div>
          ) : playerError ? (
            <div className="flex-center" style={{ position: 'absolute', inset: 0, flexDirection: 'column', gap: '15px', color: 'var(--danger)', padding: '20px', textAlign: 'center' }}>
              <Lock size={40} />
              <strong style={{ fontSize: '1.2rem' }}>محتوى محمي / خطأ في التشغيل</strong>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '400px' }}>{playerError}</span>
            </div>
          ) : playerConfig.type === 'vdocipher' ? (
            /* VdoCipher Iframe Player */
            <iframe 
              src={`https://player.vdocipher.com/v2/?otp=${playerConfig.otp}&playbackInfo=${playerConfig.playbackInfo}`} 
              style={{ border: 0, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
              allowFullScreen 
              allow="encrypted-media"
            ></iframe>
          ) : playerConfig.type === 'external' ? (
            /* External Youtube/Vimeo */
            <iframe 
              src={playerConfig.url} 
              style={{ border: 0, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
              allowFullScreen
            ></iframe>
          ) : playerConfig.type === 'direct' ? (
            /* Direct MP4 HTML5 Video Player with watermark */
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video 
                src={playerConfig.url} 
                controls 
                controlsList="nodownload"
                style={{ width: '100%', height: '100%' }}
              ></video>
              
              {/* Security Watermark floating */}
              <div style={{ 
                position: 'absolute', 
                top: '20%', 
                left: '30%', 
                color: 'rgba(255, 255, 255, 0.15)', 
                pointerEvents: 'none', 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                transform: 'rotate(-25deg)',
                userSelect: 'none'
              }}>
                {student?.studentName} - {student?.studentPhone}
              </div>
            </div>
          ) : (
            <div className="flex-center" style={{ position: 'absolute', inset: 0, color: 'var(--text-muted)' }}>
              يرجى اختيار محاضرة لبدء المشاهدة
            </div>
          )}
        </div>

        {/* Lesson Details below player */}
        {activeLesson && (
          <div className="card-clay">
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px' }}>{activeLesson.title}</h2>
            
            {activeLesson.teacherNotes && (
              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '15px', marginTop: '15px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '8px' }}>ملاحظات وتنبيهات المعلم:</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  {activeLesson.teacherNotes}
                </p>
              </div>
            )}

            {/* Individual Lecture files download */}
            {activeLesson.resources && activeLesson.resources.length > 0 && (
              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '15px', marginTop: '15px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px' }}>ملفات الحصة المتاحة للتحميل:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {activeLesson.resources.map((res, idx) => (
                    <a 
                      key={res.id || idx}
                      href={res.url ? `/uploads/${res.url.split('/').pop()}` : '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-clay btn-clay-outline"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      <Download size={16} />
                      <span>تحميل {res.label || 'ملف المحاضرة'}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
