import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './Login';
import Signup from './Signup';
import ChatRoom from './ChatRoom';
import LoadingScreen from './LoadingScreen';

export default function App() {
  const [authPage, setAuthPage] = useState('login');
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);

  // Always show loading screen for at least 2.8s for the animation to play
  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.emailVerified) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setUserProfile(snap.data());
          setFirebaseUser(user);
        }
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Show loading screen while animating OR while firebase is initializing
  if (showLoader || loading) return <LoadingScreen />;

  if (firebaseUser && userProfile) {
    return <ChatRoom firebaseUser={firebaseUser} userProfile={userProfile} />;
  }

  if (authPage === 'signup') {
    return <Signup onSwitch={() => setAuthPage('login')} />;
  }

  return <Login onSwitch={() => setAuthPage('signup')} />;
}