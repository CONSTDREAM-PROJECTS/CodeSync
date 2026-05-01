// ============================================================
// firebase.js — Firebase App Initialization
// ============================================================
//
// WHAT THIS FILE DOES:
// Initializes the Firebase app and exports the Firestore database
// and Auth instances used across the app.
//
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Open your project → Project Settings → Your apps → Web app
// 3. Copy the firebaseConfig values and paste them below.
// 4. Place this file at: src/firebase.js
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Replace every value below with your actual Firebase project config.
// Never commit real API keys to a public repository —
// use environment variables (e.g. REACT_APP_FIREBASE_API_KEY) for production.
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore — used by diagramService.js to save/load diagrams
export const db = getFirestore(app);

// Auth — used by LoginModal.jsx for email, Google, and GitHub sign-in
export const auth = getAuth(app);

export default app;
