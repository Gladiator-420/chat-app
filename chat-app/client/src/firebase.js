import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDV5Ff4K6OozgqwNUbCImUACkgwshUGKcQ",
  authDomain: "nextchat-7a5b4.firebaseapp.com",
  projectId: "nextchat-7a5b4",
  storageBucket: "nextchat-7a5b4.firebasestorage.app",
  messagingSenderId: "897223520113",
  appId: "1:897223520113:web:c8f725cfb7a073a30dd0d0",
  measurementId: "G-5BQP20G9SM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);