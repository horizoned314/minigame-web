import React, { useState } from 'react';
import { socket } from "../socket";

const EyeOpenIcon = () => (
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
<circle cx="12" cy="12" r="3"/>
</svg>
);

const EyeClosedIcon = () => (
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
<path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
<line x1="1" y1="1" x2="23" y2="23"/>
</svg>
);

function AuthScreen({ authMode, onAuthSuccess, onBack }) {
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [error, setError] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();

  if (!username || !password || (authMode === "register" && !confirmPassword)) {
    setError("FIELDS CANNOT BE EMPTY!");
    return;
  }

  if (authMode === "register" && password !== confirmPassword) {
    setError("PASSWORDS DO NOT MATCH!");
    return;
  }

  setError("");

  try {
    // Menggunakan URL statis Ngrok yang mengarah ke port 8000 (Tanpa tanda / di ujung)
    const NGROK_BASE_URL = "https://electrocratic-debatable-joannie.ngrok-free.dev"; 

    const endpoint = authMode === "register"
      ? `${NGROK_BASE_URL}/auth/register`
      : `${NGROK_BASE_URL}/auth/login`;

    const response = await fetch(endpoint, {  
      method: "POST",  
      headers: {  
        "Content-Type": "application/json",
        // Melewati halaman peringatan Ngrok agar request tidak diblokir
        "ngrok-skip-browser-warning": "true",  
      },  
      body: JSON.stringify({  
        username,  
        password,  
      }),  
    });  

    const data = await response.json();  

    if (!response.ok) {  
      if (Array.isArray(data.detail)) {
        setError(data.detail[0].msg || "Terjadi kesalahan");
      } else {
        setError(data.detail || "Terjadi kesalahan");
      }
      return;
    }  

// === GANTI BLOK INI ===
let tokenData = data;

if (authMode === "register") {
  // Register sukses tapi belum dapat token -> auto-login
  const loginRes = await fetch(`${NGROK_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!loginRes.ok) {
    setError("Registrasi berhasil, tapi auto-login gagal. Silakan login manual.");
    return;
  }

  tokenData = await loginRes.json();
}

localStorage.setItem("token", tokenData.access_token);

socket.auth = {
  token: tokenData.access_token
};

socket.off("connected_success");
socket.once("connected_success", (msg) => {
  console.log(msg);
});

if (!socket.connected) {
  socket.connect();
}

onAuthSuccess(username);

  } catch (err) {
    console.error(err);
    setError("Tidak dapat terhubung ke server");
  }
};

return (
<div className="screen-container start-screen-bg">
<div className="crt-overlay"></div>

<div className="auth-container">  
    <h2 className="auth-title">  
      {authMode === 'register' ? 'CREATE PROFILE' : 'LOAD PROFILE'}  
    </h2>  

    <form onSubmit={handleSubmit} className="auth-form">  
      {error && <p className="auth-error-msg">{error}</p>}  

      <div className="form-group">  
        <label className="form-label">ENTER USERNAME:</label>  
        <input  
          type="text"  
          className="retro-input"  
          maxLength={10}  
          value={username}  
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}  
          placeholder="PLAYER_1"  
        />  
      </div>  

      <div className="form-group">  
        <label className="form-label">ENTER PASSWORD:</label>  
        <div className="password-input-wrapper">  
          <input  
            type={showPassword ? 'text' : 'password'}  
            className="retro-input spec-padding"  
            value={password}  
            onChange={(e) => setPassword(e.target.value)}  
            placeholder="********"  
          />  
          <button   
            type="button"   
            className="password-toggle-btn"  
            onClick={() => setShowPassword(!showPassword)}  
          >  
            {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}  
          </button>  
        </div>  
      </div>  

      {authMode === 'register' && (  
        <div className="form-group">  
          <label className="form-label">CONFIRM PASSWORD:</label>  
          <div className="password-input-wrapper">  
            <input  
              type={showConfirmPassword ? 'text' : 'password'}  
              className="retro-input spec-padding"  
              value={confirmPassword}  
              onChange={(e) => setConfirmPassword(e.target.value)}  
              placeholder="********"  
            />  
            <button   
              type="button"   
              className="password-toggle-btn"  
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}  
            >  
              {showConfirmPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}  
            </button>  
          </div>  
        </div>  
      )}  

      <div className="auth-action-buttons">  
        <button type="submit" className="auth-menu-btn">  
          <span className="cursor">&gt;</span>   
          {authMode === 'register' ? 'REGISTER' : 'LOGIN'}  
        </button>  
          
        <button type="button" className="auth-menu-btn" onClick={onBack}>  
          <span className="cursor">&gt;</span> BACK TO MENU  
        </button>  
      </div>  
    </form>  
  </div>  
</div>

);
}

export default AuthScreen;