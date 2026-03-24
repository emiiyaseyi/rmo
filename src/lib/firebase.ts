import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCuyP05fmg0gPRmmHNWKXX8hkXpwHUKkzg",
  authDomain: "dsn-hr-rmo.firebaseapp.com",
  projectId: "dsn-hr-rmo",
  storageBucket: "dsn-hr-rmo.firebasestorage.app",
  messagingSenderId: "496695348227",
  appId: "1:496695348227:web:149bbec718661cdb7f1236",
  measurementId: "G-7J550WD8B0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;

