import { useState } from 'react';
import Portfolio from './pages/Portfolio.jsx';
import ControlRoom from './pages/ControlRoom.jsx';
import Expenses from './pages/Expenses.jsx';
import Settings from './pages/Settings.jsx';
import UpdateSession from './components/UpdateSession.jsx';
import Login from './components/Login.jsx';
import './App.css';

const NAV = [
  { id: 'portfolio', icon: 'ti-chart-pie',  label: 'Portfolio'     },
  { id: 'control',   icon: 'ti-radar',       label: 'Control Room'  },
  { id: 'expenses',  icon: 'ti-receipt',     label: 'Expenses'      }
];

const SESSION_KEY = 'ft_auth';

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [screen, setScreen] = useState('portfolio');
  const [showUpdate, setShowUpdate] = useState(false);
  const [portfolioRefresh, setPortfolioRefresh] = useState(0);

  function handleSaved() {
    setShowUpdate(false);
    setPortfolioRefresh(r => r + 1);
  }

  function handleLogin() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setAuthed(true);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  }

  if (!authed) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">FT</div>
        {NAV.map(n => (
          <button
            key={n.id}
            className={`nb ${screen === n.id ? 'active' : ''}`}
            onClick={() => setScreen(n.id)}
            title={n.label}
          >
            <i className={`ti ${n.icon}`} aria-hidden="true" />
          </button>
        ))}
        <button
          className={`nb ${screen === 'settings' ? 'active' : ''}`}
          style={{ marginTop: 'auto' }}
          onClick={() => setScreen('settings')}
          title="Settings"
        >
          <i className="ti ti-settings" aria-hidden="true" />
        </button>
        <button
          className="nb"
          onClick={handleLogout}
          title="Lock"
          style={{ marginTop: 8 }}
        >
          <i className="ti ti-lock" aria-hidden="true" />
        </button>
      </nav>

      <div className="main">
        <div className="topbar">
          <span className="topbar-title">
            {{ portfolio: 'Portfolio', control: 'Control room', expenses: 'Expenses', settings: 'Settings' }[screen]}
          </span>
          <div className="topbar-right">
            {screen !== 'settings' && screen !== 'expenses' && (
              <button className="upd-btn" onClick={() => setShowUpdate(true)}>
                <i className="ti ti-refresh" style={{ fontSize: 12 }} aria-hidden="true" /> Update portfolio
              </button>
            )}
          </div>
        </div>

        <div className="content">
          {screen === 'portfolio' && <Portfolio key={portfolioRefresh} onOpenUpdate={() => setShowUpdate(true)} />}
          {screen === 'control'   && <ControlRoom />}
          {screen === 'expenses'  && <Expenses />}
          {screen === 'settings'  && <Settings onRefresh={() => setPortfolioRefresh(r => r + 1)} />}
        </div>
      </div>

      {showUpdate && (
        <UpdateSession
          onClose={() => setShowUpdate(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
 
