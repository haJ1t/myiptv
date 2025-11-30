import React, { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import ChannelList from './components/ChannelList';
import XtreamLogin from './components/XtreamLogin';
import { Channel, M3UPlaylist, XtreamCredentials } from './types';
import { M3UParser } from './utils/m3uParser';
import { XtreamParser } from './utils/xtreamParser';
import './styles/global.css';
import './styles/App.css';

type LoadMode = 'm3u' | 'xtream';

function App() {
  const [playlist, setPlaylist] = useState<M3UPlaylist | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadMode, setLoadMode] = useState<LoadMode>('m3u');

  // LocalStorage'dan son playlist'i yükle
  useEffect(() => {
    const savedPlaylist = localStorage.getItem('lastPlaylist');
    const savedXtream = localStorage.getItem('xtreamCredentials');

    if (savedPlaylist) {
      try {
        const parsed = JSON.parse(savedPlaylist);
        setPlaylist(parsed);
      } catch (e) {
        console.error('Saved playlist load error:', e);
      }
    } else if (savedXtream) {
      // Xtream bilgileri varsa otomatik yükle
      try {
        const credentials = JSON.parse(savedXtream);
        loadFromXtream(credentials);
      } catch (e) {
        console.error('Saved Xtream load error:', e);
      }
    }
  }, []);

  // M3U URL'den yükle
  const loadFromURL = async (url: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Playlist indirilemedi`);
      }

      const content = await response.text();
      const parsed = await M3UParser.parse(content);
      
      setPlaylist(parsed);
      
      // localStorage'a kaydetmeden önce boyut kontrolü
      try {
        const playlistData = JSON.stringify(parsed);
        
        if (playlistData.length > 5000000) { // 5MB'dan büyükse kaydetme
          console.warn('⚠️ Playlist çok büyük, localStorage\'a kaydedilmedi');
        } else {
          localStorage.setItem('lastPlaylist', playlistData);
        }
      } catch (storageError) {
        console.error('❌ localStorage hatası:', storageError);
        localStorage.removeItem('lastPlaylist');
      }

      localStorage.removeItem('xtreamCredentials'); // Xtream bilgilerini temizle
      
      // İlk kanalı otomatik seç
      if (parsed.channels.length > 0) {
        setCurrentChannel(parsed.channels[0]);
      }
    } catch (err: any) {
      setError(err.message || 'M3U yüklenemedi!');
    } finally {
      setLoading(false);
    }
  };

  // M3U dosyasından yükle
  const loadFromFile = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const parsed = await M3UParser.parse(content);
      
      setPlaylist(parsed);
      
      // localStorage'a kaydetmeden önce boyut kontrolü
      try {
        const playlistData = JSON.stringify(parsed);
        
        if (playlistData.length > 5000000) { // 5MB'dan büyükse kaydetme
          console.warn('⚠️ Playlist çok büyük, localStorage\'a kaydedilmedi');
        } else {
          localStorage.setItem('lastPlaylist', playlistData);
        }
      } catch (storageError) {
        console.error('❌ localStorage hatası:', storageError);
        localStorage.removeItem('lastPlaylist');
      }

      localStorage.removeItem('xtreamCredentials'); // Xtream bilgilerini temizle
      
      // İlk kanalı otomatik seç
      if (parsed.channels.length > 0) {
        setCurrentChannel(parsed.channels[0]);
      }
    } catch (err: any) {
      setError(err.message || 'M3U dosyası okunamadı!');
    } finally {
      setLoading(false);
    }
  };

  // Xtream'den yükle
  const loadFromXtream = async (credentials: XtreamCredentials) => {
    setLoading(true);
    setError(null);

    try {
      const parser = new XtreamParser(credentials);
      
      // Önce kimlik doğrula
      const authInfo = await parser.authenticate();
      console.log('Xtream Auth Success:', authInfo.user_info);

      // Kanalları al ve M3U formatına çevir
      const parsed = await parser.convertToM3U();
      
      if (parsed.channels.length === 0) {
        throw new Error('Hiç kanal bulunamadı!');
      }

      setPlaylist(parsed);
      
      // localStorage'a kaydetmeden önce boyut kontrolü
      try {
        const playlistData = JSON.stringify(parsed);
        
        if (playlistData.length > 5000000) { // 5MB'dan büyükse kaydetme
          console.warn('⚠️ Playlist çok büyük, localStorage\'a kaydedilmedi');
        } else {
          localStorage.setItem('lastPlaylist', playlistData);
        }
      } catch (storageError) {
        console.error('❌ localStorage hatası:', storageError);
        localStorage.removeItem('lastPlaylist');
      }

      localStorage.setItem('xtreamCredentials', JSON.stringify(credentials));
      
      // İlk kanalı otomatik seç
      setCurrentChannel(parsed.channels[0]);
      
      console.log(`✅ ${parsed.channels.length} kanal yüklendi!`);
    } catch (err: any) {
      console.error('Xtream load error:', err);
      setError(err.message || 'Xtream bağlantısı başarısız!');
    } finally {
      setLoading(false);
    }
  };

  // Kanal seçimi
  const handleChannelSelect = (channel: Channel) => {
    setCurrentChannel(channel);
  };

  // Playlist temizle
  const clearPlaylist = () => {
    setPlaylist(null);
    setCurrentChannel(null);
    localStorage.removeItem('lastPlaylist');
    localStorage.removeItem('xtreamCredentials');
  };

  // Playlist yoksa yükleme ekranı göster
  if (!playlist) {
    return (
      <div className="app">
        <LoadScreen
          loadMode={loadMode}
          setLoadMode={setLoadMode}
          onLoadURL={loadFromURL}
          onLoadFile={loadFromFile}
          onLoadXtream={loadFromXtream}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button 
            className="sidebar-toggle"
            onClick={() => setShowSidebar(!showSidebar)}
            title={showSidebar ? 'Kanalları Gizle' : 'Kanalları Göster'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2"/>
              <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2"/>
              <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2"/>
            </svg>
          </button>
          <h1 className="app-title">
            <span className="title-icon">📺</span>
            MyIPTV
          </h1>
        </div>

        <div className="header-center">
          {currentChannel && (
            <div className="current-channel-info">
              <span className="now-playing">Şimdi İzleniyor:</span>
              <span className="channel-name">{currentChannel.name}</span>
            </div>
          )}
        </div>

        <div className="header-right">
          <div className="channel-stats">
            <span className="stat-badge">
              📺 {playlist.totalChannels} Kanal
            </span>
            <span className="stat-badge">
              📁 {playlist.groups.length} Grup
            </span>
          </div>
          <button 
            className="header-button"
            onClick={clearPlaylist}
            title="Yeni Playlist Yükle"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="1 4 1 10 7 10" strokeWidth="2"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" strokeWidth="2"/>
            </svg>
            Yeni Playlist
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="app-content">
        {/* Sidebar */}
        <aside className={`app-sidebar ${showSidebar ? 'visible' : 'hidden'}`}>
          <ChannelList
            groups={playlist.groups}
            currentChannel={currentChannel}
            onChannelSelect={handleChannelSelect}
          />
        </aside>

        {/* Player */}
        <main className="app-main">
          <VideoPlayer
            channel={currentChannel}
            onError={(err) => setError(err)}
          />
        </main>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="error-toast">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

// Load Screen Component
interface LoadScreenProps {
  loadMode: LoadMode;
  setLoadMode: (mode: LoadMode) => void;
  onLoadURL: (url: string) => void;
  onLoadFile: (file: File) => void;
  onLoadXtream: (credentials: XtreamCredentials) => void;
  loading: boolean;
  error: string | null;
}

const LoadScreen: React.FC<LoadScreenProps> = ({ 
  loadMode,
  setLoadMode,
  onLoadURL, 
  onLoadFile,
  onLoadXtream,
  loading, 
  error 
}) => {
  const [urlInput, setUrlInput] = useState('');

  const handleURLSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onLoadURL(urlInput.trim());
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
    }
  };

  return (
    <div className="load-screen">
      <div className="load-screen-content">
        {/* Logo */}
        <div className="load-screen-logo">
          <div className="logo-icon">📺</div>
          <h1>MyIPTV</h1>
          <p>Profesyonel IPTV Player</p>
        </div>

        {/* Mode Selector */}
        <div className="mode-selector">
          <button
            className={`mode-button ${loadMode === 'm3u' ? 'active' : ''}`}
            onClick={() => setLoadMode('m3u')}
            disabled={loading}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" strokeWidth="2"/>
              <polyline points="13 2 13 9 20 9" strokeWidth="2"/>
            </svg>
            M3U Playlist
          </button>
          <button
            className={`mode-button ${loadMode === 'xtream' ? 'active' : ''}`}
            onClick={() => setLoadMode('xtream')}
            disabled={loading}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2"/>
            </svg>
            Xtream Codes
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>
              {loadMode === 'xtream' 
                ? 'Xtream sunucusuna bağlanılıyor...' 
                : 'Playlist yükleniyor...'}
            </p>
          </div>
        ) : (
          <>
            {/* M3U Mode */}
            {loadMode === 'm3u' && (
              <>
                {/* URL Input */}
                <form className="load-form" onSubmit={handleURLSubmit}>
                  <label>M3U URL</label>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="https://example.com/playlist.m3u"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      disabled={loading}
                    />
                    <button type="submit" disabled={loading || !urlInput.trim()}>
                      Yükle
                    </button>
                  </div>
                </form>

                {/* Divider */}
                <div className="divider">
                  <span>veya</span>
                </div>

                {/* File Upload */}
                <div className="file-upload">
                  <label htmlFor="file-input" className="file-upload-label">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2"/>
                      <polyline points="17 8 12 3 7 8" strokeWidth="2"/>
                      <line x1="12" y1="3" x2="12" y2="15" strokeWidth="2"/>
                    </svg>
                    <span>M3U Dosyası Seç</span>
                    <small>veya sürükle bırak</small>
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".m3u,.m3u8"
                    onChange={handleFileSelect}
                    disabled={loading}
                  />
                </div>

                {/* Sample URLs */}
                <div className="sample-urls">
                  <p>Örnek Playlist'ler:</p>
                  <button 
                    className="sample-button"
                    onClick={() => onLoadURL('https://iptv-org.github.io/iptv/index.m3u')}
                  >
                    🌍 Global Channels
                  </button>
                  <button 
                    className="sample-button"
                    onClick={() => onLoadURL('https://iptv-org.github.io/iptv/countries/tr.m3u')}
                  >
                    🇹🇷 Türkiye Kanalları
                  </button>
                </div>
              </>
            )}

            {/* Xtream Mode */}
            {loadMode === 'xtream' && (
              <XtreamLogin
                onLogin={onLoadXtream}
                loading={loading}
                error={error}
              />
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="load-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Features */}
        <div className="features">
          <div className="feature">
            <span className="feature-icon">🎬</span>
            <span>4K/8K Destek</span>
          </div>
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Hızlı & Stabil</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🎨</span>
            <span>Modern Arayüz</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
