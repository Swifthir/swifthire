// Import the required functions from the Firebase CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8AOxIyZlb_Zb21AMTW_Pp8yvJRwyXhOI",
  authDomain: "skilllink69-122aa.firebaseapp.com",
  projectId: "skilllink69-122aa",
  storageBucket: "skilllink69-122aa.firebasestorage.app",
  messagingSenderId: "673456146518",
  appId: "1:673456146518:web:1d09ea145a83e25ad213f7",
  measurementId: "G-H69LL8HKYQ"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Analytics
const analytics = getAnalytics(app);

// Initialize Auth & Firestore (CRITICAL for your signup and login to work)
const auth = getAuth(app);
const db = getFirestore(app);

// Export app, auth, and db so other HTML files can use them
export { app, auth, db };
