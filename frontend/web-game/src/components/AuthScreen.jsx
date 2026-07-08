import React, { useState } from 'react';

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

localStorage.setItem("token", "dummy-token");
onAuthSuccess(username || "Player");
};

/*
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
const endpoint =
authMode === "register"
// nanti diganti sesuai endpoint backend
? "https://missed-share-constraints-voluntary.trycloudflare.com/auth/register"
: "https://missed-share-constraints-voluntary.trycloudflare.com/auth/login";

const response = await fetch(endpoint, {  
  method: "POST",  
  headers: {  
    "Content-Type": "application/json",  
  },  
  body: JSON.stringify({  
    username,  
    password,  
  }),  
});  

const data = await response.json();  

if (!response.ok) {  
  setError(data.detail || "Terjadi kesalahan");  
  return;  
}  

// Kalau login, simpan JWT  
if (authMode === "login") {  
  localStorage.setItem("token", data.access_token);  
}  

onAuthSuccess(username);

} catch (err) {
console.error(err);
setError("Tidak dapat terhubung ke server");
}
};
*/
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