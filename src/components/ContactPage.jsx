/**
 * ============================================================
 * ContactPage.jsx — Contact Us slide-in panel
 * ============================================================
 * Same slide-in style as AboutPage. Shows the team and
 * their roles so users know who made CodeSynch.
 *
 * Wire-up in App.js:
 *   import ContactPage from './components/ContactPage';
 *   const [showContact, setShowContact] = useState(false);
 *   <button onClick={() => setShowContact(true)}>Contact Us</button>
 *   {showContact && <ContactPage onClose={() => setShowContact(false)} />}
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { X, Mail, Users, GraduationCap } from 'lucide-react';

const A1 = '#9c9b7f';
const A2 = '#d9dccc';

// ─── Logo (same as AboutPage) ─────────────────────────────────────────────────
const CodeSynchLogo = ({ size = 28 }) => (
  <img
    src="/codesynch.jpg"
    alt="CodeSynch"
    style={{ width: size, height: size, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }}
  />
);

// ─── DATA ─────────────────────────────────────────────────────────────────────

const TEAM = [
  {
    name: 'Stephan C. Bernal',
    id: '202310400',
    color: A2,
  },
  {
    name: 'Michael Ronin V. Bernardo',
    id: '202312571',
    color: A1,
  },
  {
    name: 'Christer Vhon G. Peregrin',
    id: '202310999',
    color: A2,
  },
  {
    name: 'Andrea Ysabelle C. Rogon',
    id: '202311046',
    color: A1,
  },
];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const SectionHeading = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
    <span style={{ color: A1 }}>{icon}</span>
    <span style={{ color: A2, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: '#2d2d30' }} />
  </div>
);

const TeamCard = ({ name, role, id, color, desc }) => {
  const [hov, setHov] = useState(false);
  const parts = name.split(' ');
  const initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#252526',
        border: `1px solid ${hov ? color : '#2d2d30'}`,
        borderRadius: 8, padding: '16px 18px',
        transition: 'border-color 0.18s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: color + '1a', border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: 15, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ color: A2, fontSize: 14, fontWeight: 600 }}>{name}</div>
          <div style={{ color, fontSize: 12, marginTop: 2 }}>{role}</div>
          <div style={{ color: '#4a4a4a', fontSize: 11, marginTop: 2 }}>FEU Institute of Technology · {id}</div>
        </div>
      </div>
      <p style={{ color: '#777', fontSize: 12, lineHeight: 1.65, margin: 0 }}>{desc}</p>
    </div>
  );
};

// ─── MAIN ────────────────────────────────────────────────────────────────────

const ContactPage = ({ onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 12);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          marginLeft: 'auto',
          width: 'min(720px, 100vw)',
          height: '100%',
          background: '#1e1e1e',
          borderLeft: '1px solid #2d2d30',
          boxShadow: '-8px 0 48px rgba(0,0,0,0.65)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* NAV BAR */}
        <div style={{
          background: '#1a1a1a', borderBottom: '1px solid #2d2d30',
          height: 48, padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CodeSynchLogo size={28} />
            <span style={{ color: A2, fontWeight: 700, fontSize: 14 }}>CodeSynch</span>
            <span style={{ color: '#3e3e42', margin: '0 2px' }}>·</span>
            <span style={{ color: '#6a6a6a', fontSize: 13 }}>Contact Us</span>
          </div>
          <button
            onClick={handleClose}
            title="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6a6a6a', padding: '6px 8px', borderRadius: 5,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2d2d30'; e.currentTarget.style.color = A2; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6a6a6a'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 44px' }}>

          {/* Intro */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1e1c 0%, #1e1e1e 55%, #1c1c1a 100%)',
            border: `1px solid ${A1}44`,
            borderRadius: 10, padding: '20px 22px', marginBottom: 32,
          }}>
            <h2 style={{ color: A2, fontWeight: 700, fontSize: 17, margin: '0 0 10px', lineHeight: 1.4 }}>
              Meet the Team Behind CodeSynch
            </h2>
            <p style={{ color: '#8a8a8a', fontSize: 13, lineHeight: 1.75, margin: 0 }}>
              CodeSynch was built by four BS Computer Science students from FEU Institute of Technology
              as their undergraduate thesis. Reach out through your institution or department
              for academic inquiries related to this project.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
              {['BS Computer Science', 'FEU Institute of Technology', 'Thesis 2026', 'Software Engineering'].map(t => (
                <span key={t} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11,
                  background: A1 + '18', color: A1,
                  border: `1px solid ${A1}44`,
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Team */}
          <section style={{ marginBottom: 32 }}>
            <SectionHeading icon={<Users size={13} />} label="The Team" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TEAM.map(t => <TeamCard key={t.id} {...t} />)}
            </div>
          </section>

          {/* Contact info */}
          <section>
            <SectionHeading icon={<Mail size={13} />} label="Academic Inquiries" />
            <div style={{
              background: '#252526', border: '1px solid #2d2d30',
              borderRadius: 8, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <GraduationCap size={16} color={A1} />
                <span style={{ color: A2, fontSize: 13, fontWeight: 600 }}>FEU Institute of Technology</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              </div>
            </div>
          </section>

        </div>

        {/* FOOTER */}
        <div style={{
          background: '#1a1a1a', borderTop: '1px solid #2d2d30',
          padding: '9px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ color: '#444', fontSize: 11 }}>
            © 2025 CodeSynch · UML to Code Generator &nbsp;·&nbsp; Powered by Model-Driven Engineering
          </span>
          <button
            onClick={handleClose}
            style={{
              background: '#e8e0d0', color: '#1a1a1a',
              border: 'none', borderRadius: 6,
              padding: '5px 18px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0e8d8'}
            onMouseLeave={e => e.currentTarget.style.background = '#e8e0d0'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
