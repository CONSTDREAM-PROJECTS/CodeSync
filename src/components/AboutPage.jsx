/**
 * AboutPage.jsx — About Us & FAQ full page
 * Full-page view with smooth transitions (no slide-in panel)
 */

import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp,
  BookOpen, Cpu, RefreshCw, Code2, Shield,
  Layers, Zap,
} from 'lucide-react';

// Brand accent colors
const A1 = '#9c9b7f';   // primary accent (warm olive)
const A2 = '#d9dccc';   // light accent (pale sage)

// DATA

const FEATURES = [
  { icon: <RefreshCw size={18} />, title: 'Round-Trip Engineering',    accent: A1,      desc: 'Bidirectional sync keeps UML diagrams and code consistent throughout the entire development lifecycle. Edit code and the diagram updates automatically.' },
  { icon: <Cpu size={18} />,       title: 'Rule-Based Transformation', accent: A2,      desc: 'Fully deterministic, auditable algorithms. No AI, no black boxes. Every element transformation is traceable to a specific predefined rule.' },
  { icon: <Code2 size={18} />,     title: 'Multi-Language Output',     accent: '#ce9178', desc: 'Generate executable Java, Python, or JavaScript from a single UML model, the same core triad powering modern web development.' },
  { icon: <Shield size={18} />,    title: '3-Stage Validation',        accent: '#dcdcaa', desc: 'Structural, semantic, and completeness checks block invalid diagrams before they reach the transformation engine. No partial code emitted.' },
  { icon: <Layers size={18} />,    title: '3 UML Diagram Types',       accent: '#c586c0', desc: 'Class (static structure), Sequence (dynamic behavior), and Use Case (functional requirements): the three dimensions of web application design.' },
  { icon: <Zap size={18} />,       title: 'Web-Based & Zero-Install',  accent: A1,      desc: 'Runs entirely in the browser. No IDE plugin, no installation. Accessible from any modern device with Chrome 90+, Firefox 88+, or Safari 14+.' },
];

const STEPS = [
  { n: '1', label: 'Draw',      desc: 'Create a Class, Sequence, or Use Case diagram in the in-browser UML editor.' },
  { n: '2', label: 'Validate',  desc: 'ValidationService runs 3 sequential checks: structural, semantic, and completeness before any code is emitted.' },
  { n: '3', label: 'Tokenize',  desc: "The diagram's JSON is decomposed into a typed token stream (CLASS_DEF, ATTRIBUTE, METHOD, RELATIONSHIP) and a Symbol Table." },
  { n: '4', label: 'Transform', desc: 'The Rule-Based Algorithm maps each token to its code construct via explicit, deterministic rules: ri (C to A) for every element.' },
  { n: '5', label: 'Sync',      desc: 'Edit the generated code and the Bidirectional Algorithm reconstructs the updated UML model, targeting a 95% or higher Consistency Rate.' },
];

const FAQ_ITEMS = [
  { q: 'What is CodeSynch?', a: 'CodeSynch is a web-based Model-Driven Engineering (MDE) framework that automatically converts UML diagrams into executable source code for Java, Python, and JavaScript, and in reverse. Developed as a BS Computer Science thesis at FEU Institute of Technology by Bernal, Bernardo, Peregrin, and Rogon (2026).' },
  { q: 'What makes CodeSynch different from Visual Paradigm or StarUML?', a: 'Most existing tools only do forward generation (UML to code). CodeSynch adds bidirectional Round-Trip Engineering: edit the generated code and the system automatically updates the UML diagram. It also uses fully deterministic, rule-based algorithms instead of AI or proprietary engines, making every transformation transparent and auditable.' },
  { q: 'Which UML diagram types are supported?', a: 'Three diagram types covering the three essential dimensions of web application design: (1) Class Diagrams for static structure (entities, attributes, relationships); (2) Sequence Diagrams for dynamic behavior (message flows, lifelines); (3) Use Case Diagrams for functional requirements (actors, system boundaries).' },
  { q: 'Which programming languages does it generate?', a: 'Java, Python, and JavaScript, chosen as the core triad of modern web development. Java for enterprise backends, Python for rapid prototyping and scripted services, and JavaScript for full-stack development via Node.js.' },
  { q: 'How does the Rule-Based Model Transformation Algorithm work?', a: 'The algorithm applies a set of predefined rules R where each rule maps a UML element condition C to a code action A (ri: C to A). For every element including classes, attributes, methods, and relationships, the correct rule fires and produces the matching code construct deterministically. The full transformation is expressed as T(Ms, R) = Mt.' },
  { q: 'What is Bidirectional Model-Code Synchronization?', a: 'The core innovation. Two functions are defined: Forward (F: Model to Code) and Reverse (R: Code to Model), paired so R(F(M)) is approximately M and F(R(C)) is approximately C. Round-trips preserve all semantic content. Consistency Rate = (Matching Elements / Total Elements) x 100%, targeting 95% or higher. This solves the model-code drift problem.' },
  { q: 'What happens if I draw an invalid UML diagram?', a: 'CodeSynch never silently generates broken code. The ValidationService runs three stages: (1) Structural checks UML syntax and required fields; (2) Semantic checks logical consistency such as circular inheritance; (3) Completeness checks for sufficient content. Structural errors produce a hard block. Semantic and completeness issues produce warnings with TODO annotations in the generated code.' },
  { q: 'What is the Tokenization process?', a: "Before transformation, the diagram's internal JSON is decomposed into a typed token stream. Token types include CLASS_DEF, ATTRIBUTE, METHOD, RELATIONSHIP, ACTOR, USE_CASE, MESSAGE, LIFELINE, and GUARD. The tokenizer also builds a Symbol Table mapping class names to their attributes and methods, enabling cross-reference resolution." },
  { q: 'How accurate is the code generation?', a: 'Targets: 90% or higher transformation accuracy for the Rule-Based Algorithm; 95% or higher consistency rate for Bidirectional Synchronization; under 500ms generation time for medium diagrams (6 to 10 classes); baseline memory under 50MB. Generated code is validated by ESLint (Airbnb style), Pylint (PEP 8), and javac (Oracle Java Conventions).' },
  { q: 'Who is CodeSynch designed for?', a: 'Primarily CS students and software engineering educators who need a hands-on bridge between UML theory and code implementation. Also suited for practitioners in small-to-medium organizations who want to rapidly prototype web systems from UML models without heavyweight toolchains or AI dependencies.' },
  { q: 'Does CodeSynch use AI or machine learning?', a: 'No. CodeSynch intentionally avoids machine learning, large language models, and template engines like Acceleo or Xpand. All algorithms are fully deterministic, a critical requirement in educational and research contexts where traceability and auditability matter.' },
  { q: 'How does CodeSynch align with the UN Sustainable Development Goals?', a: 'SDG 4 (Quality Education): feedback-oriented learning environment for students observing UML designs alongside generated code. SDG 9 (Industry, Innovation and Infrastructure): open, non-proprietary prototype with reproducible evaluation metrics. SDG 12 (Responsible Consumption and Production): reduces redundant manual coding steps and resource waste.' },
];

// CodeSynch logo using the actual brand image
const CodeSynchLogo = ({ size = 28 }) => (
  <img
    src="/codesynch.jpg"
    alt="CodeSynch"
    style={{ width: size, height: size, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }}
  />
);

// SUB-COMPONENTS

const SectionHeading = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
    <span style={{ color: A1 }}>{icon}</span>
    <span style={{ color: A2, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: '#2d2d30' }} />
  </div>
);

const FeatureCard = ({ icon, title, desc, accent }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#2a2d2e' : '#252526',
        border: `1px solid ${hov ? accent : '#2d2d30'}`,
        borderRadius: 8, padding: '14px 16px',
        display: 'flex', gap: 12,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hov ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hov ? `0 8px 24px ${accent}20, 0 4px 8px rgba(0,0,0,0.3)` : 'none',
        cursor: 'pointer',
      }}
    >
      <div style={{ 
        color: accent, 
        flexShrink: 0, 
        marginTop: 1,
        transform: hov ? 'scale(1.15) rotate(5deg)' : 'scale(1) rotate(0deg)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>{icon}</div>
      <div>
        <div style={{ 
          color: hov ? '#fff' : A2, 
          fontSize: 13, 
          fontWeight: 600, 
          marginBottom: 4,
          transition: 'color 0.2s ease',
        }}>{title}</div>
        <div style={{ color: hov ? '#999' : '#777', fontSize: 12, lineHeight: 1.65, transition: 'color 0.2s ease' }}>{desc}</div>
      </div>
    </div>
  );
};

const FaqItem = ({ item }) => {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  return (
    <div 
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${open ? A1 : hov ? A1 + '66' : '#2d2d30'}`,
        borderRadius: 7, overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)', 
        marginBottom: 6,
        transform: hov && !open ? 'translateX(4px)' : 'translateX(0)',
        boxShadow: hov ? `0 2px 8px ${A1}15` : 'none',
      }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '11px 16px',
          background: open ? '#2a2d2e' : hov ? '#282828' : '#252526',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.2s ease',
        }}
      >
        <span style={{ 
          color: hov || open ? '#fff' : A2, 
          fontSize: 13, 
          fontWeight: 500, 
          paddingRight: 16, 
          lineHeight: 1.4,
          transition: 'color 0.2s ease',
        }}>
          {item.q}
        </span>
        <span style={{ 
          color: A1, 
          flexShrink: 0,
          transform: open ? 'rotate(0deg)' : hov ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      <div style={{
        maxHeight: open ? 400 : 0, overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <p style={{
          margin: 0, padding: '12px 16px',
          background: '#1e1e1e', borderTop: '1px solid #2d2d30',
          color: '#8a8a8a', fontSize: 13, lineHeight: 1.72,
        }}>
          {item.a}
        </p>
      </div>
    </div>
  );
};

// MAIN - Full page component (no onClose, no slide-in)

const AboutPage = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e1e',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <div style={{
        background: '#1a1a1a', borderBottom: '1px solid #2d2d30',
        height: 48, padding: '0 20px',
        display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CodeSynchLogo size={28} />
          <span style={{ color: A2, fontWeight: 700, fontSize: 14 }}>CodeSynch</span>
          <span style={{ color: '#3e3e42', margin: '0 2px' }}>·</span>
          <span style={{ color: '#6a6a6a', fontSize: 13 }}>About Us</span>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 44px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Hero */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1e1c 0%, #1e1e1e 55%, #1c1c1a 100%)',
            border: `1px solid ${A1}44`,
            borderRadius: 10, padding: '20px 22px', marginBottom: 32,
          }}>
            <div style={{ marginBottom: 10 }}>
              <span style={{
                background: A1, color: '#0d0d0c',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                padding: '2px 9px', borderRadius: 3,
              }}>
                BS CS THESIS · FEU-TECH · 2026
              </span>
            </div>
            <h2 style={{ color: A2, fontWeight: 700, fontSize: 17, margin: '0 0 10px', lineHeight: 1.4 }}>
              Model-Driven Engineering Framework for<br />Automated UML-to-Web Code Generation
            </h2>
            <p style={{ color: '#8a8a8a', fontSize: 13, lineHeight: 1.75, margin: 0 }}>
              CodeSynch bridges the gap between UML design and production code. Draw a diagram,
              get executable Java, Python, or JavaScript instantly, then edit the code and watch
              the diagram update itself. No AI, no black boxes: every transformation is driven by
              transparent, deterministic rule-based algorithms built for academic rigor and
              real-world web development.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
              {['Rule-Based Transformation', 'Bidirectional Sync', 'Round-Trip Engineering', 'Multi-Language', 'Web-Based'].map(t => (
                <span key={t} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11,
                  background: A1 + '18', color: A1,
                  border: `1px solid ${A1}44`,
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Features */}
          <section style={{ marginBottom: 32 }}>
            <SectionHeading icon={<Zap size={13} />} label="Core Features" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
              {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
            </div>
          </section>

          {/* How it works */}
          <section style={{ marginBottom: 32 }}>
            <SectionHeading icon={<Cpu size={13} />} label="How It Works" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {STEPS.map(({ n, label, desc }) => (
                <div key={n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: A1, color: '#0d0d0c',
                    fontWeight: 700, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>{n}</div>
                  <p style={{ margin: 0, paddingTop: 3, fontSize: 13, lineHeight: 1.6 }}>
                    <span style={{ color: A2, fontWeight: 600 }}>{label} </span>
                    <span style={{ color: '#666' }}>{desc}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section style={{ marginBottom: 32 }}>
            <SectionHeading icon={<BookOpen size={13} />} label="Frequently Asked Questions" />
            {FAQ_ITEMS.map((item, i) => <FaqItem key={i} item={item} />)}
          </section>

        </div>
      </div>
    </div>
  );
};

export default AboutPage;