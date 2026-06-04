import { useState } from 'react';
import { api, tokens } from '../api/index.js';
import { generateKeyPair, saveKeys, loadKeys } from '../crypto/e2e.js';
import { Btn, Input } from './UI.jsx';
import { ZEnodeLogo } from './ZEnodeLogo.jsx';

export function LoginPage({ onLogin }) {
  const [tab, setTab]         = useState('login');  // 'login' | 'register'
  const [login, setLogin]     = useState('');
  const [username, setUser]   = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      let result;
      if (tab === 'register') {
        if (password !== confirm) { setError('Passwords do not match'); setLoading(false); return; }
        result = await api.register(username, email, password);
      } else {
        result = await api.login(login, password);
      }

      const { user, accessToken, refreshToken } = result;
      tokens.set(accessToken, refreshToken);

      // E2E keypair
      let keys = loadKeys(user.id);
      if (!keys) { keys = await generateKeyPair(); saveKeys(user.id, keys); }
      await api.updatePubKey(JSON.stringify(keys.publicJwk));

      localStorage.setItem('ze_user', JSON.stringify(user));
      onLogin(user);
    } catch (e) {
      // Give a helpful message for accounts created before password auth
      if (e.message?.includes('no password set')) {
        setError('This account was created before passwords were added. Please register a new account.');
      } else {
        setError(e.message);
      }
    }
    finally { setLoading(false); }
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div className="fade-up" style={{
        width:'100%', maxWidth:420,
        background:'var(--glass)', backdropFilter:'var(--blur)', WebkitBackdropFilter:'var(--blur)',
        border:'1px solid var(--glass-border)', borderRadius:'var(--r-xl)',
        padding:'44px 40px', boxShadow:'var(--sh-lg)', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,
          background:'linear-gradient(90deg,transparent,rgba(235,219,178,.12),transparent)' }}/>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:30 }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <ZEnodeLogo size={72} />
          </div>
          <h1 style={{
            fontSize:32, fontWeight:800, letterSpacing:'-1px', marginBottom:4,
            background:'linear-gradient(135deg,var(--blue-b),var(--purple-b))',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>ZEnode</h1>
          <p style={{ color:'var(--fg3)', fontSize:13 }}>Communities · Channels · Encrypted DMs</p>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', background:'var(--bg1)', borderRadius:'var(--r-sm)', padding:3, marginBottom:24 }}>
          {['login','register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
              flex:1, padding:'7px 0', borderRadius:'var(--r-xs)', border:'none', cursor:'pointer',
              background: tab===t ? 'var(--blue)' : 'transparent',
              color: tab===t ? '#1d2021' : 'var(--fg3)',
              fontWeight:700, fontSize:13, transition:'all .18s',
              textTransform:'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {tab === 'login' ? (
          <>
            <Input label="Username or email" value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={onKey} placeholder="Enter username or email" autoFocus />
            <Input label="Password" type="password" value={password} onChange={e=>setPass(e.target.value)} onKeyDown={onKey} placeholder="Your password" />
          </>
        ) : (
          <>
            <Input label="Username" value={username} onChange={e=>setUser(e.target.value)} onKeyDown={onKey} placeholder="Choose a username" autoFocus />
            <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKey} placeholder="your@email.com" />
            <Input label="Password" type="password" value={password} onChange={e=>setPass(e.target.value)} onKeyDown={onKey} placeholder="Min 6 characters" />
            <Input label="Confirm password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={onKey} placeholder="Repeat password" />
          </>
        )}

        {error && (
          <p style={{ color:'var(--red-b)', fontSize:13, marginBottom:14, padding:'8px 12px',
            background:'rgba(204,36,29,.1)', borderRadius:'var(--r-sm)', border:'1px solid rgba(251,73,52,.2)' }}>
            {error}
          </p>
        )}

        <Btn disabled={loading} onClick={submit} style={{ width:'100%', padding:12, fontSize:15 }}>
          {loading ? 'Please wait…' : tab === 'login' ? 'Sign in →' : 'Create account →'}
        </Btn>

        {tab === 'register' && (
          <p style={{ marginTop:16, textAlign:'center', fontSize:11, color:'var(--fg4)' }}>
            🔒 E2E encryption auto-configured for DMs
          </p>
        )}
      </div>
    </div>
  );
}
