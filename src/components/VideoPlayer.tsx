import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types';
import '../styles/VideoPlayer.css';

interface VideoPlayerProps {
  channel: Channel | null;
  onError?: (error: string) => void;
}

// 🔥 BACKEND PROXY URL
const BACKEND_PROXY = 'http://localhost:3001/proxy?url=';

// 🔥 HLS Config
const HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 30,
  maxBufferLength: 20,
  maxMaxBufferLength: 40,
  maxBufferSize: 30 * 1000 * 1000,
  maxBufferHole: 0.3,
  maxFragLookUpTolerance: 0.2,
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 10,
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 3,
  manifestLoadingRetryDelay: 500,
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 3,
  levelLoadingRetryDelay: 500,
  fragLoadingTimeOut: 15000,
  fragLoadingMaxRetry: 3,
  fragLoadingRetryDelay: 500,
  startLevel: -1,
  autoStartLoad: true,
  xhrSetup: (xhr: XMLHttpRequest) => {
    xhr.withCredentials = false;
    xhr.timeout = 15000;
  },
  debug: false
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ channel, onError }) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

  // 🔥 Proxy URL oluştur
  const getProxiedUrl = useCallback((url: string): string => {
    return BACKEND_PROXY + encodeURIComponent(url);
  }, []);

  // Clean up function
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    playPromiseRef.current = null;
  }, []);

  // Setup HLS
  const setupHLS = useCallback((streamUrl: string, video: HTMLVideoElement) => {
    const hls = new Hls(HLS_CONFIG);
    hlsRef.current = hls;
    let fragmentCount = 0;
    let errorCount = 0;
    const MAX_ERRORS = 3;

    // Fragment loading
    hls.on(Hls.Events.FRAG_LOADING, () => {
      if (fragmentCount === 0) {
        console.log('📦 İlk fragment yükleniyor...');
      }
    });

    // Fragment loaded
    hls.on(Hls.Events.FRAG_LOADED, () => {
      fragmentCount++;
      errorCount = 0; // Reset error count on success
      
      if (fragmentCount === 1) {
        console.log('✅ İlk fragment yüklendi');
        setIsLoading(false);
        setIsReady(true);
        setError(null);
      }
      
      // Update buffer
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration;
        if (duration > 0) {
          setBufferProgress((bufferedEnd / duration) * 100);
        }
      }
    });

    // Manifest parsed
    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('✅ Manifest:', data.levels.length, 'kalite');
      if (data.levels.length > 0) {
        hls.currentLevel = data.levels.length - 1;
        console.log('🎯 Kalite:', data.levels[hls.currentLevel].height + 'p');
      }
      setError(null);
    });

    // Buffer events
    hls.on(Hls.Events.BUFFER_APPENDING, () => {
      setIsLoading(false);
    });

    hls.on(Hls.Events.BUFFER_APPENDED, () => {
      setError(null);
    });

    // Error handling
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal) {
        console.warn('⚠️ HLS Warning:', data.details);
        return;
      }

      console.error('❌ Fatal HLS Error:', data.type, data.details);
      errorCount++;

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.log('🔄 Ağ hatası - deneme:', errorCount);
          
          if (errorCount >= MAX_ERRORS) {
            console.log('🔄 Maksimum hata sayısına ulaşıldı, yeniden deneniyor...');
            setError('Bağlantı hatası, yeniden deneniyor...');
            
            cleanup();
            
            if (channel) {
              retryTimeoutRef.current = setTimeout(() => {
                console.log('🔄 Yeniden yükleniyor...');
                if (videoRef.current) {
                  loadVideo(channel.url, videoRef.current);
                }
              }, 2000);
            }
          } else {
            setError('Bağlantı hatası...');
            retryTimeoutRef.current = setTimeout(() => {
              hls.startLoad();
              setError(null);
            }, 1000);
          }
          break;

        case Hls.ErrorTypes.MEDIA_ERROR:
          console.log('🔄 Medya hatası - düzeltiliyor...');
          hls.recoverMediaError();
          break;

        default:
          setError('Oynatma hatası! Farklı bir kanal deneyin.');
          setIsLoading(false);
          break;
      }
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);
  }, [cleanup, channel]);

  // 🔥 Load video with Backend Proxy
  const loadVideo = useCallback((streamUrl: string, video: HTMLVideoElement) => {
    try {
      // URL fix
      if (streamUrl.includes('/live/')) {
        streamUrl = streamUrl.replace(/\.ts$/, '.m3u8');
      }

      // 🔥 Backend Proxy ile URL'i wrap et
      const proxiedUrl = getProxiedUrl(streamUrl);
      
      console.log('📡 Original URL:', streamUrl);
      console.log('🔄 Proxied URL:', proxiedUrl);

      // HLS check
      if (streamUrl.includes('.m3u8') || streamUrl.includes('/live/')) {
        if (Hls.isSupported()) {
          setupHLS(proxiedUrl, video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS
          console.log('🍎 Safari native HLS');
          video.src = proxiedUrl;
          video.addEventListener('loadeddata', () => {
            console.log('✅ Safari HLS yüklendi');
            setIsLoading(false);
            setIsReady(true);
          }, { once: true });
        } else {
          setError('HLS desteklenmiyor!');
          setIsLoading(false);
        }
      } else {
        // Normal video
        video.src = proxiedUrl;
        video.addEventListener('loadeddata', () => {
          setIsLoading(false);
          setIsReady(true);
        }, { once: true });
      }
    } catch (err: any) {
      console.error('❌ Load error:', err);
      setError(err.message || 'Yükleme hatası!');
      setIsLoading(false);
    }
  }, [setupHLS, getProxiedUrl]);

  // Channel change effect
  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    console.log('🎬 Kanal yükleniyor:', channel.name);
    
    // Reset state
    setIsLoading(true);
    setError(null);
    setNeedsUserInteraction(false);
    setIsPlaying(false);
    setIsReady(false);
    setBufferProgress(0);

    cleanup();
    loadVideo(channel.url, video);

    return cleanup;
  }, [channel, cleanup, loadVideo]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlaying = () => {
      console.log('▶️ Oynatılıyor');
      setIsPlaying(true);
      setIsLoading(false);
      setNeedsUserInteraction(false);
      setError(null);
    };

    const handlePause = () => {
      console.log('⏸️ Duraklatıldı');
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      console.log('⏳ Buffering...');
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      console.log('✅ Oynatılabilir');
      setIsLoading(false);
    };

    const handleStalled = () => {
      console.warn('⚠️ Stalled');
      if (hlsRef.current) {
        console.log('🔄 HLS yeniden başlatılıyor...');
        hlsRef.current.startLoad();
      }
    };

    const handleProgress = () => {
      if (video.buffered.length > 0 && isPlaying) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedAhead = bufferedEnd - video.currentTime;
        if (bufferedAhead < 5) {
          console.log('⚠️ Buffer düşük:', bufferedAhead.toFixed(1), 's');
        }
      }
    };

    const handleSeeking = () => {
      console.log('⏩ Seeking...');
      setIsLoading(true);
    };

    const handleSeeked = () => {
      console.log('✅ Seeked');
      setIsLoading(false);
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [isPlaying]);

  // Auto play
  useEffect(() => {
    if (isReady && !isPlaying && !error) {
      console.log('🎯 Otomatik oynatma...');
      const timeout = setTimeout(() => {
        playVideo();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isReady]);

  // Play video
  const playVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    try {
      if (playPromiseRef.current) await playPromiseRef.current;

      video.volume = volume;
      video.muted = isMuted;

      console.log('🎬 play() çağrılıyor...');
      playPromiseRef.current = video.play();
      await playPromiseRef.current;
      
      console.log('✅ play() başarılı');
      setIsPlaying(true);
      setNeedsUserInteraction(false);
      playPromiseRef.current = null;

    } catch (err: any) {
      console.warn('⚠️ play() hatası:', err.name);
      playPromiseRef.current = null;

      if (err.name === 'NotAllowedError') {
        setNeedsUserInteraction(true);
        setIsPlaying(false);
        setIsLoading(false);
      } else if (err.name !== 'AbortError') {
        setError('Oynatma hatası: ' + err.message);
      }
    }
  }, [isReady, volume, isMuted]);

  // Pause video
  const pauseVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (playPromiseRef.current) {
        await playPromiseRef.current;
        playPromiseRef.current = null;
      }
      video.pause();
      setIsPlaying(false);
    } catch (err) {
      console.warn('⚠️ pause() hatası:', err);
    }
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!isReady) return;
    isPlaying ? await pauseVideo() : await playVideo();
  }, [isReady, isPlaying, playVideo, pauseVideo]);

  // Volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) videoRef.current.volume = newVolume;
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
  }, [isMuted]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!videoRef.current) return;
    !document.fullscreenElement 
      ? videoRef.current.requestFullscreen() 
      : document.exitFullscreen();
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Mouse move
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Placeholder
  if (!channel) {
    return (
      <div className="video-player">
        <div className="video-placeholder">
          <div className="placeholder-icon">📺</div>
          <h2>Kanal Seçin</h2>
          <p>Soldan bir kanal seçerek izlemeye başlayın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player" onMouseMove={handleMouseMove}>
      {/* Video */}
      <video
        ref={videoRef}
        className="video-element"
        playsInline
        preload="auto"
        onClick={togglePlayPause}
      />

      {/* Channel Info */}
      <div className={`channel-info-overlay ${showControls ? 'visible' : ''}`}>
        {channel.logo && <img src={channel.logo} alt={channel.name} className="channel-logo" />}
        <div className="channel-details">
          <h3>{channel.name}</h3>
          {channel.group && <span className="channel-group">{channel.group}</span>}
          {channel.quality && <span className="quality-badge">{channel.quality}</span>}
        </div>
      </div>

      {/* Loading */}
      {isLoading && !needsUserInteraction && !error && (
        <div className="video-loading">
          <div className="spinner"></div>
          <p>Yükleniyor...</p>
          {bufferProgress > 0 && (
            <div className="buffer-progress">
              <div className="buffer-bar" style={{ width: `${bufferProgress}%` }}></div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !needsUserInteraction && (
        <div className="video-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
          </svg>
          <h3>Hata!</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Manual Play */}
      {needsUserInteraction && (
        <div className="manual-play-overlay">
          <button className="manual-play-button" onClick={playVideo}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Oynat</span>
          </button>
          <p className="autoplay-message">Oynatmak için tıklayın</p>
        </div>
      )}

      {/* Controls */}
      <div className={`video-controls ${showControls ? 'visible' : ''}`}>
        <button className="control-button" onClick={togglePlayPause} disabled={!isReady}>
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </button>

        <div className="volume-control">
          <button className="control-button" onClick={toggleMute}>
            {isMuted || volume === 0 ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" strokeWidth="2"/>
                <line x1="23" y1="9" x2="17" y2="15" strokeWidth="2"/>
                <line x1="17" y1="9" x2="23" y2="15" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" strokeWidth="2"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeWidth="2"/>
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>

        <div className="spacer"></div>

        <button className="control-button" onClick={toggleFullscreen}>
          {isFullscreen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" strokeWidth="2"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeWidth="2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;
