import React, { useState } from 'react';
import { XtreamCredentials } from '../types';
import '../styles/XtreamLogin.css';

interface XtreamLoginProps {
  onLogin: (credentials: XtreamCredentials) => void;
  loading: boolean;
  error: string | null;
}

const XtreamLogin: React.FC<XtreamLoginProps> = ({ onLogin, loading, error }) => {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      return;
    }

    onLogin({
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password.trim()
    });
  };

  return (
    <div className="xtream-login">
      <div className="xtream-login-header">
        <div className="xtream-icon">🔐</div>
        <h2>Xtream Codes Girişi</h2>
        <p>IPTV sağlayıcınızdan aldığınız bilgilerle giriş yapın</p>
      </div>

      <form className="xtream-form" onSubmit={handleSubmit}>
        {/* Server URL */}
        <div className="form-group">
          <label htmlFor="serverUrl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="2"/>
            </svg>
            Sunucu URL
          </label>
          <input
            id="serverUrl"
            type="text"
            placeholder="http://example.com:8080"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          <small>Örnek: http://server.com:8080 veya http://192.168.1.1:8080</small>
        </div>

        {/* Username */}
        <div className="form-group">
          <label htmlFor="username">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2"/>
              <circle cx="12" cy="7" r="4" strokeWidth="2"/>
            </svg>
            Kullanıcı Adı
          </label>
          <input
            id="username"
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            autoComplete="username"
          />
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="password">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2"/>
            </svg>
            Şifre
          </label>
          <div className="password-input">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeWidth="2"/>
                  <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="form-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="submit-button"
          disabled={loading || !serverUrl.trim() || !username.trim() || !password.trim()}
        >
          {loading ? (
            <>
              <div className="spinner-small"></div>
              Bağlanıyor...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeWidth="2"/>
                <polyline points="10 17 15 12 10 7" strokeWidth="2"/>
                <line x1="15" y1="12" x2="3" y2="12" strokeWidth="2"/>
              </svg>
              Giriş Yap
            </>
          )}
        </button>
      </form>

      {/* Info */}
      <div className="xtream-info">
        <div className="info-item">
          <span className="info-icon">💡</span>
          <span>Bilgilerinizi IPTV sağlayıcınızdan alabilirsiniz</span>
        </div>
        <div className="info-item">
          <span className="info-icon">🔒</span>
          <span>Bilgileriniz güvenli bir şekilde saklanır</span>
        </div>
      </div>
    </div>
  );
};

export default XtreamLogin;
