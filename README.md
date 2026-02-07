<<<<<<< HEAD
# CodeSync
CodeSynch: A Model-Driven Engineering Framework for Automated UML-to-Web Code Generation Using Model-Driven Engineering 
=======
# CodeSynch - UML to Code Generator

A Model-Driven Engineering Framework for Automated UML-to-Web Code Generation.

## Thesis Project

- **Group:** CodeSync
- **Program:** BS Computer Science (Software Engineering)
- **Members:** Christer Vhon Peregrin, Ronin Bernardo, Andrea Ysabelle Rogon, Stephan Bernal
- **Academic Year:** 2025-2026

## Summary

CodeSynch is a small web app for visually editing UML class diagrams and generating web-oriented source code (JavaScript, Python, Java) from the diagram model. It includes a diagram editor UI, hooks for canvas interactions and history, services for mapping types and generating code, and utilities to help manage diagram state.

**This README** contains quick start instructions and a guided explanation of the project source so you can run, extend, or contribute to the tool.

## Requirements

- Node.js (recommended v16 or v18)
- npm (comes with Node.js)

On Windows you can verify your environment with:

```powershell
node --version
npm --version
```

## Install

1. From the project root run:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Open http://localhost:3000 in your browser.

## Scripts

- `npm start` — start dev server (create-react-app dev server)
- `npm run build` — build production bundle into `build/`
- `npm test` — run tests (uses the test runner configured in the project)

## Build / Production

To create an optimized production build:

```bash
npm run build
```

## Usage
1. Click "Add Class" to create a UML class
2. Define attributes with visibility modifiers (+, -, #)
3. Add methods with parameters