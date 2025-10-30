import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
    getFirestore, collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, limit, orderBy, serverTimestamp
} from 'firebase/firestore';

// --- Firebase Configuration ---
const YOUR_DEBUG_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCxbMsC90uRDf7x537j_10iMEhW6xmEY1g",
    authDomain: "quizzify-backend-f2103.firebaseapp.com",
    projectId: "quizzify-backend-f2103",
    storageBucket: "quizzify-backend-f2103.firebasestorage.app",
    messagingSenderId: "827687038991",
    appId: "1:827687038991:web:90979ffad7444d0fe9737a",
    measurementId: "G-E05XHC0RGW"
};

// Use environment variables or fallback to debug config
const firebaseConfig = YOUR_DEBUG_FIREBASE_CONFIG;
const initialAuthToken ='' ; // No custom token for now
const appId = 'default-quiz-app';

// Utility function to normalize text for flexible scoring
const normalizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text.toLowerCase().replace(/[.,/#!$%^&*;:{}=_`~()]/g, "").replace(/\s{2,}/g, ' ').trim();
};

// --- Firestore Paths ---
const getQuizzesCollectionPath = (appId) => `artifacts/${appId}/public/data/quizzes`;
const getLeaderboardCollectionPath = (appId) => `artifacts/${appId}/public/data/leaderboard`;

// --- Theming & Styles ---
const THEME_KEY = 'gemini-quiz-theme';
const getInitialTheme = () => {
  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme) return storedTheme;
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
};


const styles = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    
    :root {
        --color-primary: #00bcd4; /* Cyan/Teal Accent */
        --color-secondary: #00e5ff; /* Bright Cyan */
        --color-success: #4CAF50;
        --color-error: #F44336;
        --color-warning: #FFC107;
        --font-family: 'Inter', sans-serif;
    }

    .dark-mode {
        --color-bg-main: #121212;
        --color-bg-card: #1e1e1e;
        --color-text-main: #e0e0e0;
        --color-text-secondary: #f0e7e7ff;
        --color-border: #333333;
        --color-shadow: rgba(0, 0, 0, 0.4);
        --color-input-bg: #7c7777ff;
    }

    .light-mode {
        --color-bg-main: #f0f2f5;
        --color-bg-card: #ffffff;
        --color-text-main: #333333;
        --color-text-secondary: #666666;
        --color-border: #cccccc;
        --color-shadow: rgba(0, 0, 0, 0.1);
        --color-input-bg: #ffffff;
    }

    body, #root {
        margin: 0;
        padding: 0;
        background-color: var(--color-bg-main);
        color: var(--color-text-main);
        font-family: var(--font-family);
        transition: background-color 0.3s, color 0.3s;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow-x: hidden;
    }

    .app-container {
        width: 100%;
        max-width: 900px;
        min-height: 100vh;
        padding: 20px;
        box-sizing: border-box;
        z-index: 10;
        position: relative;
    }

    /* --- Header & Title --- */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        margin-bottom: 20px;
    }

    .app-title {
        font-size: 2.2rem;
        font-weight: 800;
        text-align: center;
        flex-grow: 1;
        color: var(--color-primary);
        text-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
    }

    /* --- Card & Forms --- */
    .card {
        background-color: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 12px var(--color-shadow);
        margin-bottom: 20px;
        transition: background-color 0.3s, border 0.3s, box-shadow 0.3s;
    }
    
    .center-card {
        max-width: 448px; /* max-w-md */
        margin: 0 auto 20px auto; /* mx-auto mb-5 */
    }

    .card-title {
        font-size: 1.25rem; /* text-xl */
        font-weight: 700; /* font-bold */
        margin-bottom: 1rem; /* mb-4 */
        text-align: center;
    }
    
    .card-subtitle {
        margin-bottom: 1.5rem; /* mb-6 */
        text-align: center;
        font-size: 0.875rem; /* text-sm */
    }

    input[type="text"], input[type="number"], select, textarea {
        width: 100%;
        padding: 12px;
        margin-bottom: 15px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-input-bg);
        color: var(--color-text-main);
        font-family: var(--font-family);
        transition: border-color 0.2s;
        box-sizing: border-box;
    }

    input[type="text"]:focus, input[type="number"]:focus, select:focus, textarea:focus {
        border-color: var(--color-primary);
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 188, 212, 0.3);
    }
    
    .input-group {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }

    /* --- Buttons --- */
    .btn {
        padding: 12px 20px;
        margin: 5px 0;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s, transform 0.1s, opacity 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 1rem;
    }
    
    .btn.w-full {
        width: 100%;
    }
    
    .btn-row {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .btn-primary {
        background-color: var(--color-primary);
        color: var(--color-bg-main);
        box-shadow: 0 4px 6px rgba(0, 188, 212, 0.3);
    }

    .btn-primary:hover {
        background-color: var(--color-secondary);
        transform: translateY(-1px);
    }

    .btn-secondary {
        background-color: var(--color-bg-card);
        color: var(--color-text-main);
        border: 1px solid var(--color-border);
    }

    .btn-secondary:hover {
        background-color: rgba(0, 188, 212, 0.1);
    }
    
    .btn-danger {
        background-color: var(--color-error);
        color: #fff;
    }
    
    .btn-danger:hover {
        background-color: #e53935;
    }

    .btn-icon {
        background: none;
        border: none;
        color: var(--color-text-main);
        cursor: pointer;
        padding: 10px;
        font-size: 1.5rem;
        transition: color 0.2s;
    }

    .btn-icon:hover {
        color: var(--color-primary);
    }
    
    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
    }

    /* --- Quiz List --- */
    .quiz-list {
        display: grid;
        gap: 15px;
    }

    .quiz-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background-color: var(--color-bg-main);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        transition: border-color 0.2s;
    }

    .quiz-item:hover {
        border-color: var(--color-primary);
    }
    
    .quiz-info h3 {
        margin: 0 0 5px 0;
        font-weight: 700;
        color: var(--color-primary);
    }

    .quiz-info p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary);
    }

    .quiz-code {
        font-family: monospace;
        font-weight: 700;
        font-size: 1.125rem;
        color: var(--color-primary);
    }

    .quiz-item-actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
    }

    /* --- Leaderboard --- */
    .leaderboard-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }

    .leaderboard-table th, .leaderboard-table td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid var(--color-border);
    }

    .leaderboard-table th {
        background-color: rgba(0, 188, 212, 0.1);
        font-weight: 700;
        color: var(--color-primary);
    }

    .leaderboard-table tr:last-child td {
        border-bottom: none;
    }
    
    .current-user-row {
        font-weight: bold;
        background-color: rgba(0, 188, 212, 0.05);
    }

    /* --- Animation Background --- */
    .animated-bg {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
    }

    .bg-element {
        position: absolute;
        opacity: 0.1;
        font-size: 1.5rem;
        animation: fall linear infinite;
        color: var(--color-primary);
    }

    @keyframes fall {
        0% { transform: translateY(-100vh) translateX(0); opacity: 0.1; }
        50% { opacity: 0.2; }
        100% { transform: translateY(100vh) translateX(5vw); opacity: 0; }
    }
    
    /* --- Specific Quiz Styles --- */
    .quiz-section-header {
        font-size: 1.125rem; /* text-lg */
        font-weight: 700; /* font-bold */
        margin-bottom: 0.75rem; /* mb-3 */
        border-bottom: 1px dashed var(--color-border);
        padding-bottom: 0.5rem; /* pb-2 */
    }

    .question-image {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 1px solid var(--color-border);
    }

    .quiz-footer {
        margin-top: 20px;
        text-align: center;
        font-size: 0.8rem;
        color: var(--color-text-secondary);
    }

    .quiz-timer {
        position: fixed;
        top: 20px;
        right: 20px;
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--color-error);
        background-color: var(--color-bg-card);
        padding: 8px 15px;
        border-radius: 8px;
        box-shadow: 0 2px 4px var(--color-shadow);
        z-index: 20;
    }
    
    .quiz-content-box {
        margin-bottom: 1.5rem; /* mb-6 */
        padding: 1rem; /* p-4 */
        border: 1px dashed var(--color-border);
        border-radius: 0.5rem; /* rounded-lg */
    }

    .quiz-question-text {
        font-weight: 600; /* font-semibold */
        font-size: 1.125rem; /* text-lg */
        margin-bottom: 0.75rem; /* mb-3 */
    }

    .feedback-message {
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-weight: 600;
        text-align: center;
        animation: fadeInOut 1.5s ease-in-out forwards;
    }
    
    .feedback-correct {
        background-color: rgba(76, 175, 80, 0.2);
        color: var(--color-success);
    }

    .feedback-incorrect {
        background-color: rgba(244, 67, 54, 0.2);
        color: var(--color-error);
    }

    @keyframes fadeInOut {
        0% { opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
    }
    
    /* Quiz Review Specifics */
    .review-summary {
        text-align: center;
        margin-bottom: 1.5rem;
    }
    
    .review-score-number {
        font-size: 2.25rem; /* text-4xl */
        font-weight: 800; /* font-extrabold */
    }
    
    .review-answer-box {
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
    
    .review-answer-correct {
        background-color: rgba(76, 175, 80, 0.1);
    }
    
    .review-answer-incorrect {
        background-color: rgba(244, 67, 54, 0.1);
    }
    
    .review-your-answer {
        font-weight: 500;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }

    /* --- Media Queries for Responsiveness --- */
    @media (max-width: 600px) {
        .app-title {
            font-size: 1.8rem;
        }
        .app-container {
            padding: 10px;
        }
        .btn {
            padding: 10px 15px;
            font-size: 0.9rem;
        }
        .quiz-timer {
            top: 10px;
            right: 10px;
            font-size: 1rem;
        }
        .btn-row, .input-group {
            flex-direction: column;
            gap: 10px;
        }
        .quiz-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }
        .quiz-item-actions {
            width: 100%;
            justify-content: space-between;
        }
        .quiz-item-actions button {
            flex-grow: 1;
        }
    }
    
`;

// --- Global Context for Firebase and Auth ---
const FirebaseContext = React.createContext({});
const useFirebase = () => React.useContext(FirebaseContext);

// --- Component: AnimatedBackground ---
const AnimatedBackground = () => {
    const chars = useMemo(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""), []);
    const elements = useMemo(() => {
        return Array.from({ length: 50 }).map((_, i) => {
            const char = chars[Math.floor(Math.random() * chars.length)];
            const size = Math.random() * 0.8 + 1;
            const left = Math.random() * 100;
            const duration = Math.random() * 7 + 5;
            const delay = Math.random() * 12;

            return (
                <span
                    key={i}
                    className="bg-element"
                    style={{
                        fontSize: `${size}rem`,
                        left: `${left}vw`,
                        animationDuration: `${duration}s`,
                        animationDelay: `${delay}s`,
                    }}
                >
                    {char}
                </span>
            );
        });
    }, [chars]);

    return (
        <div className="animated-bg" style={{ zIndex: 5 }}>
            {elements}
        </div>
    );
};

// --- Custom Hook: useFirebaseAuth ---
const useFirebaseAuth = () => {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        console.log("🔥 Starting Firebase initialization...");
        
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const userAuth = getAuth(app);
            
            console.log("✅ Firebase app initialized successfully");
            setDb(firestore);
            setAuth(userAuth);

            // Set up auth state listener
            const unsubscribe = onAuthStateChanged(userAuth, (user) => {
                console.log("🔄 Auth state changed:", user ? `User ${user.uid}` : "No user");
                
                if (user) {
                    setUserId(user.uid);
                    setIsAuthenticated(true);
                    setAuthError(null);
                    console.log("✅ User authenticated:", user.uid);
                } else {
                    setUserId(null);
                    setIsAuthenticated(false);
                    console.log("❌ User signed out");
                    
                    // Try to sign in anonymously
                    console.log("🔄 Attempting anonymous sign-in...");
                    signInAnonymously(userAuth)
                        .then((userCredential) => {
                            console.log("✅ Anonymous sign-in successful:", userCredential.user.uid);
                        })
                        .catch((error) => {
                            console.error("❌ Anonymous sign-in failed:", error);
                            setAuthError(error.message);
                        });
                }
            });

            // Initial sign-in attempt
            const performAuth = async () => {
                try {
                    if (initialAuthToken) {
                        console.log("🔄 Attempting custom token sign-in...");
                        await signInWithCustomToken(userAuth, initialAuthToken);
                        console.log("✅ Custom token sign-in successful");
                    } else {
                        console.log("🔄 Attempting anonymous sign-in...");
                        await signInAnonymously(userAuth);
                        console.log("✅ Anonymous sign-in successful");
                    }
                } catch (error) {
                    console.error("❌ Initial authentication failed:", error);
                    setAuthError(error.message);
                }
            };

            performAuth();

            return () => unsubscribe();
        } catch (error) {
            console.error("❌ Firebase initialization failed:", error);
            setAuthError(error.message);
        }
    }, []);

    return { auth, db, userId, isAuthenticated, authError };
};

// --- Custom Hook: useQuizData ---
const useQuizData = (db, isAuthenticated) => {
    const [quizzes, setQuizzes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !isAuthenticated) {
            console.log("📊 Quiz data: Waiting for DB or auth");
            setIsLoading(true);
            return;
        }

        console.log("📊 Starting to fetch quizzes...");
        const q = query(collection(db, getQuizzesCollectionPath(appId)), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const fetchedQuizzes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate().toLocaleDateString() || 'N/A'
                }));
                console.log(`📊 Fetched ${fetchedQuizzes.length} quizzes`);
                setQuizzes(fetchedQuizzes);
                setIsLoading(false);
            }, 
            (error) => {
                console.error("❌ Error fetching quizzes:", error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [db, isAuthenticated]);

    return { quizzes, isLoading };
};

// --- Component: DebugView ---
const DebugView = ({ auth, db, userId, isAuthenticated, authError, onRetry }) => {
    return (
        <div className="card center-card">
            <h2 className="card-title">Debug Information</h2>
            <div style={{ textAlign: 'left', fontSize: '0.875rem' }}>
                <p><strong>Firebase Auth:</strong> {auth ? '✅ Initialized' : '❌ Not initialized'}</p>
                <p><strong>Firestore DB:</strong> {db ? '✅ Initialized' : '❌ Not initialized'}</p>
                <p><strong>Authentication:</strong> {isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}</p>
                <p><strong>User ID:</strong> {userId || 'None'}</p>
                {authError && (
                    <p style={{ color: 'var(--color-error)' }}>
                        <strong>Error:</strong> {authError}
                    </p>
                )}
            </div>
            <button 
                className="btn btn-primary w-full" 
                onClick={onRetry}
                style={{ marginTop: '1rem' }}
            >
                Retry Authentication
            </button>
            <button 
                className="btn btn-secondary w-full" 
                onClick={() => window.location.reload()}
                style={{ marginTop: '0.5rem' }}
            >
                Reload Page
            </button>
        </div>
    );
};


// --- Component: LoginView ---
const LoginView = ({ setNickname, setGameState, nickname }) => {
    const [localNickname, setLocalNickname] = useState(nickname || '');

    const handleLogin = () => {
        if (localNickname.trim()) {
            // Save nickname to localStorage immediately
            const trimmedNickname = localNickname.trim();
            localStorage.setItem('quizmaker_nickname', trimmedNickname);
            // Update the nickname state in parent component
            setNickname(trimmedNickname);
            // Navigate to dashboard
            setGameState('dashboard');
        }
    };

    // Update local state when parent nickname changes
    useEffect(() => {
        if (nickname) {
            setLocalNickname(nickname);
        }
    }, [nickname]);

    return (
        <div className="card center-card">
            <h2 className="card-title">Welcome to QuizMaker</h2>
            <p className="card-subtitle">Create your nickname.</p>
            <input
                type="text"
                placeholder="Enter your nickname"
                value={localNickname}
                onChange={(e) => setLocalNickname(e.target.value)}
                onKeyDown={(e) => {
                    // Only trigger on Enter key AND when there's actual text
                    if (e.key === 'Enter' && localNickname.trim()) {
                        handleLogin();
                    }
                }}
                style={{ marginBottom: '1rem' }}
            />
            <button
                className="btn btn-primary w-full"
                onClick={handleLogin}
                disabled={!localNickname.trim()}
            >
                Continue
            </button>
        </div>
    );
};
// --- Component: DashboardView ---
const DashboardView = ({ setGameState, setQuizToJoin, quizzes, isLoading, setLeaderboardQuizCode, nickname }) => {
    const { userId } = useFirebase();

    const handleJoinClick = (quizCode) => {
        setQuizToJoin(quizCode);
        setGameState('join_quiz');
    };

    const handleLeaderboardClick = (quizCode) => {
        setLeaderboardQuizCode(quizCode);
        setGameState('leaderboard_view');
    };

    return (
        <div className="card">
             
         {/* Welcome Message Section */}
            <div style={{ 
                textAlign: 'center', 
                marginBottom: '2rem',
                padding: '1rem',
                backgroundColor: 'rgba(0, 188, 212, 0.1)',
                borderRadius: '12px',
                border: '1px solid var(--color-primary)'
            }}>
                <h2 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 700, 
                    color: 'var(--color-primary)',
                    margin: '0 0 0.5rem 0'
                }}>
                    Welcome, {nickname}! 👋
                </h2>
                <p style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--color-text-secondary)',
                    margin: 0
                }}>
                    Ready to create or take some quizzes?
                </p>
                    <button
    className="btn btn-secondary"
    onClick={() => {
        localStorage.removeItem('quizmaker_nickname');
        window.location.reload();
    }}
    style={{ marginTop: '1rem' }}
>
    Change Nickname
</button>
            </div>
            <h2 className="quiz-section-header" style={{ fontSize: '1.25rem', paddingBottom: 0 }}>Dashboard</h2>
        
            <div className="btn-row">
                <button
                    className="btn btn-primary"
                    onClick={() => setGameState('create_quiz')}
                    style={{ flexGrow: 1 }}
                >
                    + Create Quiz
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={() => setGameState('my_quizzes')}
                    style={{ flexGrow: 1 }}
                >
                    My Quizzes
                </button>
            </div>

            <h3 className="quiz-section-header">Available Quizzes ({isLoading ? 'Loading...' : quizzes.length})</h3>

            <div className="quiz-list">
                {quizzes.length === 0 && !isLoading && <p className="text-center" style={{ padding: '1rem' }}>No quizzes available yet. Be the first to create one!</p>}
                {quizzes.map(quiz => (
                    <div key={quiz.id} className="quiz-item">
                        <div className="quiz-info">
                            <h3>{quiz.title}</h3>
                            <p>Creator: {quiz.creatorNickname} | Code: <span className="quiz-code">{quiz.quizCode}</span></p>
                            <p>Questions: {quiz.questions.length} | Timer: {quiz.timeLimitMinutes} mins</p>
                        </div>
                        <div className="quiz-item-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleLeaderboardClick(quiz.quizCode)}
                            >
                                🏆Leaderboard
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleJoinClick(quiz.quizCode)}
                            >
                                Join
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <p className="quiz-footer">Logged in as: {nickname} (User ID: {userId})</p>
        </div>
    );
};

// --- Component: JoinQuizView ---
const JoinQuizView = ({ setGameState, setQuizToPlay, quizToJoin, quizzes }) => {
    const [inputCode, setInputCode] = useState(quizToJoin || '');
    const [error, setError] = useState('');

    const handleStartQuiz = () => {
        setError('');
        const quiz = quizzes.find(q => q.quizCode === inputCode.trim());
        if (quiz) {
            setQuizToPlay(quiz);
            setGameState('playing_quiz');
        } else {
            setError('Quiz code not found. Please check the code.');
        }
    };

    return (
        <div className="card center-card">
            <h2 className="card-title">Enter Quiz Code</h2>
            <input
                type="text"
                placeholder="Enter 6-digit Quiz Code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleStartQuiz();
                }}
                maxLength={6}
            />
            {error && <p style={{ color: 'var(--color-error)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
            <button
                className="btn btn-primary w-full"
                onClick={handleStartQuiz}
                disabled={inputCode.length !== 6}
                style={{ marginBottom: '0.75rem' }}
            >
                Start Quiz
            </button>
            <button
                className="btn btn-secondary w-full"
                onClick={() => setGameState('dashboard')}
            >
                Back to Dashboard
            </button>
        </div>
    );
};

// --- Component: QuizTaker ---
const QuizTaker = ({ setGameState, quizToPlay, nickname }) => {
    const { db, userId } = useFirebase();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [isFinished, setIsFinished] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(quizToPlay.timeLimitMinutes * 60);
    const [feedback, setFeedback] = useState(null);

    const currentQuestion = quizToPlay.questions[currentQuestionIndex];

    // Timer Logic
    useEffect(() => {
        if (isFinished || timeRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmitQuiz(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isFinished, timeRemaining, quizToPlay.timeLimitMinutes]);

    const handleAnswerChange = (value) => {
        setAnswers(prev => ({ ...prev, [currentQuestionIndex]: value }));
    };

    const checkAnswer = (question, userAnswer) => {
        if (!userAnswer) return false;

        switch (question.type) {
            case 'mcq': {
                const selectedOption = question.options?.find(opt => opt.text === userAnswer);
                return selectedOption ? selectedOption.isCorrect : false;
            }
            case 'open_ended':
            case 'image_text': {
                const normalizedUserAnswer = normalizeText(userAnswer);
                const correctAnswers = (question.correctAnswerText || '').split('|').map(normalizeText).filter(Boolean);
                return correctAnswers.some(correctAns => normalizedUserAnswer === correctAns);
            }
            default:
                return false;
        }
    };
    
    const handleNext = () => {
        const userAnswer = answers[currentQuestionIndex];
        const isCorrect = checkAnswer(currentQuestion, userAnswer);

        if (currentQuestion.type === 'mcq' || currentQuestion.type === 'open_ended' || currentQuestion.type === 'image_text') {
            const correctAnswerDisplay = currentQuestion.type === 'mcq'
                ? currentQuestion.options.find(opt => opt.isCorrect)?.text
                : currentQuestion.correctAnswerText;

            setFeedback({
                isCorrect: isCorrect,
                correctAnswer: correctAnswerDisplay
            });

            setTimeout(() => {
                setFeedback(null);
                if (currentQuestionIndex < quizToPlay.questions.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                } else {
                    handleSubmitQuiz(false);
                }
            }, 1500);
        } else {
            if (currentQuestionIndex < quizToPlay.questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                handleSubmitQuiz(false);
            }
        }
    };

    const calculateScore = () => {
        let score = 0;
        quizToPlay.questions.forEach((q, index) => {
            if (checkAnswer(q, answers[index])) {
                score += 1;
            }
        });
        return score;
    };

    const handleSubmitQuiz = async (isTimeout) => {
        setIsFinished(true);
        const finalScore = calculateScore();
        const timeTaken = quizToPlay.timeLimitMinutes * 60 - timeRemaining;

        if (db && userId) {
            const leaderboardEntry = {
                quizCode: quizToPlay.quizCode,
                quizTitle: quizToPlay.title,
                userId: userId,
                nickname: nickname,
                score: finalScore,
                totalQuestions: quizToPlay.questions.length,
                timeTaken: timeTaken,
                timestamp: new Date().toISOString(),
                createdAt: serverTimestamp()
            };

            try {
                await addDoc(collection(db, getLeaderboardCollectionPath(appId)), leaderboardEntry);
                console.log("Score submitted to leaderboard successfully.");
            } catch (error) {
                console.error("Error submitting score:", error);
            }
        } else {
            console.error("Cannot submit score: Firebase not initialized or user ID missing.");
        }
        
        if (isTimeout) {
            console.log("Time's up! Quiz automatically submitted.");
        }
    };

    if (isFinished) {
        const finalScore = calculateScore();
        return (
            <QuizReview
                setGameState={setGameState}
                quiz={quizToPlay}
                answers={answers}
                finalScore={finalScore}
                timeTaken={quizToPlay.timeLimitMinutes * 60 - timeRemaining}
                checkAnswer={checkAnswer}
                setLeaderboardQuizCode={(code) => setGameState('leaderboard_view', code)}
            />
        );
    }

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isLastQuestion = currentQuestionIndex === quizToPlay.questions.length - 1;
    const isAnswered = currentQuestion.type === 'mcq' ? answers[currentQuestionIndex] !== undefined : answers[currentQuestionIndex]?.trim();

    return (
        <>
            <div className="quiz-timer">{formatTime(timeRemaining)}</div>
            <div className="card">
                <h2 className="quiz-section-header" style={{ fontSize: '1.25rem', paddingBottom: 0 }}>{quizToPlay.title}</h2>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    Question {currentQuestionIndex + 1} of {quizToPlay.questions.length}
                </p>

                {feedback && (
                    <div className={feedback.isCorrect ? "feedback-message feedback-correct" : "feedback-message feedback-incorrect"}>
                        {feedback.isCorrect ? "✅ Correct!" : "❌ Incorrect."}
                        {feedback.isCorrect === false && (
                            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                                {currentQuestion.type !== 'mcq' && (
                                    <span>Expected answer (normalized): {feedback.correctAnswer.split('|').join(' OR ')}</span>
                                )}
                            </p>
                        )}
                    </div>
                )}

                <div className="quiz-content-box">
                    <p className="quiz-question-text">{currentQuestion.text}</p>
                    {currentQuestion.imageUrl && (
                        <img src={currentQuestion.imageUrl} alt="Quiz Question" className="question-image" />
                    )}
                </div>

                {currentQuestion.type === 'mcq' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {currentQuestion.options.map((option, idx) => (
                            <button
                                key={idx}
                                className={`btn w-full ${answers[currentQuestionIndex] === option.text ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleAnswerChange(option.text)}
                                style={{ textAlign: 'left' }}
                            >
                                {option.text}
                            </button>
                        ))}
                    </div>
                )}

                {(currentQuestion.type === 'open_ended' || currentQuestion.type === 'image_text') && (
                    <>
                        <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>Type your answer below:</p>
                        <textarea
                            rows="3"
                            placeholder="Type your answer here..."
                            value={answers[currentQuestionIndex] || ''}
                            onChange={(e) => handleAnswerChange(e.target.value)}
                        />
                    </>
                )}

                <button
                    className="btn btn-primary w-full"
                    onClick={handleNext}
                    disabled={!isAnswered || feedback}
                    style={{ marginTop: '1rem' }}
                >
                    {isLastQuestion ? 'Finish Quiz' : 'Submit & Next'}
                </button>
            </div>
        </>
    );
};

// --- Component: QuizReview ---
const QuizReview = ({ setGameState, quiz, answers, finalScore, timeTaken, checkAnswer }) => {
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };

    const isScorePerfect = finalScore === quiz.questions.length;
    const scoreColor = isScorePerfect ? 'var(--color-success)' : finalScore > quiz.questions.length / 2 ? 'var(--color-warning)' : 'var(--color-error)';

    return (
        <div className="card">
            <h2 className="card-title" style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>Quiz Complete!</h2>
            <div className="review-summary">
                <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Your Score:</p>
                <p className="review-score-number" style={{ color: scoreColor }}>{finalScore} / {quiz.questions.length}</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>Time taken: {formatTime(timeTaken)}</p>
            </div>

            <h3 className="quiz-section-header">Review Answers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {quiz.questions.map((q, index) => {
                    const userAnswer = answers[index];
                    const isCorrect = checkAnswer(q, userAnswer);
                    const indicator = isCorrect ? '✅' : '❌';

                    const correctAnswerText = q.type === 'mcq'
                        ? q.options.find(opt => opt.isCorrect)?.text
                        : q.correctAnswerText.split('|').join(' OR ');

                    return (
                        <div key={index} className={`review-answer-box ${isCorrect ? 'review-answer-correct' : 'review-answer-incorrect'}`}>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{index + 1}. {q.text} {indicator}</p>
                            {q.imageUrl && <img src={q.imageUrl} alt="Question" className="question-image" style={{ width: '8rem' }} />}

                            <p className="review-your-answer">Your Answer: <span style={{ fontWeight: 400, color: isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>{userAnswer || '(No answer provided)'}</span></p>
                            {!isCorrect && (
                                <p className="review-your-answer" style={{ color: 'var(--color-success)' }}>Correct Answer: <span style={{ fontWeight: 400 }}>{correctAnswerText}</span></p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="btn-row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
               
                <button
                    className="btn btn-primary"
                    onClick={() => setGameState('dashboard')}
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

// --- Component: LeaderboardView ---
const LeaderboardView = ({ setGameState, leaderboardQuizCode }) => {
    const { db } = useFirebase();
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { userId } = useFirebase();

    const quizTitle = useMemo(() => {
        return `Scores for Quiz Code: ${leaderboardQuizCode}`;
    }, [leaderboardQuizCode]);

    useEffect(() => {
        if (!db) return;

        const q = query(
            collection(db, getLeaderboardCollectionPath(appId)),
            where('quizCode', '==', leaderboardQuizCode),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data());

            const sortedData = data.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score; 
                }
                return a.timeTaken - b.timeTaken;
            });

            setLeaderboardData(sortedData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching leaderboard:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, leaderboardQuizCode]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };

    return (
        <div className="card">
            <h2 className="card-title" style={{ color: 'var(--color-primary)', fontSize: '1.25rem' }}>Leaderboard</h2>
            <p style={{ marginBottom: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }}>{quizTitle}</p>

            {isLoading && <p style={{ textAlign: 'center' }}>Loading leaderboard...</p>}
            {!isLoading && leaderboardData.length === 0 && <p style={{ textAlign: 'center' }}>No scores posted for this quiz yet.</p>}

            {!isLoading && leaderboardData.length > 0 && (
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Score</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboardData.map((entry, index) => (
                            <tr key={index} className={entry.userId === userId ? 'current-user-row' : ''}>
                                <td>{index + 1}</td>
                                <td>{entry.nickname}</td>
                                <td>{entry.score} / {entry.totalQuestions}</td>
                                <td>{formatTime(entry.timeTaken)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <button
                className="btn btn-secondary w-full"
                onClick={() => setGameState('dashboard')}
                style={{ marginTop: '1.5rem' }}
            >
                Back to Dashboard
            </button>
        </div>
    );
};

// --- Component: MyQuizzesView ---
const MyQuizzesView = ({ setGameState, nickname, quizzes, setEditingQuiz }) => {
    const { userId, db } = useFirebase();

    const myQuizzes = useMemo(() => {
        return quizzes.filter(q => q.creatorId === userId);
    }, [quizzes, userId]);

    const handleDelete = async (quizId) => {
        const isConfirmed = window.prompt("Type 'DELETE' to confirm deletion of this quiz.") === 'DELETE';

        if (!isConfirmed) {
            return;
        }
        if (db) {
            try {
                await deleteDoc(doc(db, getQuizzesCollectionPath(appId), quizId));
                console.log(`Quiz ${quizId} deleted successfully.`);
            } catch (error) {
                console.error("Error deleting quiz:", error);
            }
        }
    };

    const handleEdit = (quiz) => {
        setEditingQuiz(quiz);
        setGameState('create_quiz');
    };

    return (
        <div className="card">
            <h2 className="quiz-section-header" style={{ fontSize: '1.25rem', paddingBottom: 0 }}>My Created Quizzes</h2>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Quizzes created by {nickname} (ID: {userId})
            </p>

            <div className="quiz-list">
                {myQuizzes.length === 0 && <p style={{ textAlign: 'center', padding: '1rem' }}>You have not created any quizzes yet.</p>}
                {myQuizzes.map(quiz => (
                    <div key={quiz.id} className="quiz-item">
                        <div className="quiz-info">
                            <h3>{quiz.title}</h3>
                            <p>Code: <span className="quiz-code">{quiz.quizCode}</span></p>
                            <p>Questions: {quiz.questions.length} | Created: {quiz.createdAt}</p>
                        </div>
                        <div className="quiz-item-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleEdit(quiz)}
                            >
                                Edit
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(quiz.id)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                className="btn btn-secondary w-full"
                onClick={() => setGameState('dashboard')}
                style={{ marginTop: '1.5rem' }}
            >
                Back to Dashboard
            </button>
        </div>
    );
};

// --- Component: QuizCreator ---
const QuizCreator = ({ setGameState, nickname, editingQuiz, setEditingQuiz }) => {
    const { db, userId } = useFirebase();
    const isEditing = !!editingQuiz;
    const [showShareTooltip, setShowShareTooltip] = useState(false);

    const [quizTitle, setQuizTitle] = useState(editingQuiz?.title || '');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(editingQuiz?.timeLimitMinutes || 5);
    const [questions, setQuestions] = useState(editingQuiz?.questions.map((q, i) => ({ ...q, id: q.id || i + 1 })) || []);
    const [quizCode, setQuizCode] = useState(editingQuiz?.quizCode || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            setQuizCode(newCode);
        }
    }, [isEditing]);

    const generateNewQuestionId = () => {
        return questions.length > 0 ? Math.max(...questions.map(q => q.id || 0)) + 1 : 1;
    };

    const addQuestion = (type) => {
        const baseQuestion = {
            id: generateNewQuestionId(),
            text: '',
            type: type,
            imageUrl: '',
            correctAnswerText: '',
            options: type === 'mcq' ? [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }] : []
        };
        setQuestions(prev => [...prev, baseQuestion]);
    };

    const updateQuestion = (id, field, value) => {
        setQuestions(prev => prev.map(q =>
            q.id === id ? { ...q, [field]: value } : q
        ));
    };

    const deleteQuestion = (id) => {
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const updateOption = (qId, optIndex, field, value) => {
        setQuestions(prev => prev.map(q => {
            if (q.id === qId) {
                const newOptions = q.options.map((opt, index) => {
                    if (index === optIndex) {
                        return { ...opt, [field]: value };
                    }
                    if (field === 'isCorrect' && value === true && index !== optIndex) {
                        return { ...opt, isCorrect: false };
                    }
                    return opt;
                });
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const handleImageUpload = (qId, file) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateQuestion(qId, 'imageUrl', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const validateQuiz = () => {
        if (!quizTitle.trim() || questions.length === 0) return "Please provide a title and at least one question.";
        if (timeLimitMinutes <= 0) return "Time limit must be positive.";

        for (const q of questions) {
            if (!q.text.trim()) return `Question ${q.id} text is empty.`;

            if (q.type === 'mcq') {
                if (q.options.filter(o => o.text.trim()).length < 2) return `MCQ Question ${q.id} must have at least two options with text.`;
                if (q.options.every(o => !o.isCorrect)) return `MCQ Question ${q.id} must have a correct option selected.`;
                if (q.options.filter(o => o.isCorrect).length !== 1) return `MCQ Question ${q.id} must have exactly one correct answer.`;
            }

            if ((q.type === 'open_ended' || q.type === 'image_text')) {
                if (!q.correctAnswerText.trim()) return `${q.type === 'open_ended' ? 'Open-Ended' : 'Image-Based'} Question ${q.id} must have a correct answer text.`;
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        const validationError = validateQuiz();
        if (validationError) {
            console.error("Validation Error:", validationError);
            return;
        }

        setIsSaving(true);

        const cleanedQuestions = questions.map(q => {
            let cleanedQ = { ...q, text: q.text.trim() };

            if (q.type === 'mcq') {
                cleanedQ.options = q.options.filter(o => o.text.trim());
            } else if (q.type === 'open_ended' || q.type === 'image_text') {
                 cleanedQ.correctAnswerText = q.correctAnswerText.trim();
                 cleanedQ.options = []; 
            }

            delete cleanedQ.id;

            return cleanedQ;
        });

        const quizData = {
            title: quizTitle.trim(),
            quizCode: quizCode,
            timeLimitMinutes: timeLimitMinutes,
            questions: cleanedQuestions,
            creatorId: userId,
            creatorNickname: nickname,
        };

        try {
            if (isEditing) {
                await updateDoc(doc(db, getQuizzesCollectionPath(appId), editingQuiz.id), {
                    ...quizData,
                    updatedAt: serverTimestamp()
                });
                console.log("Quiz updated successfully:", editingQuiz.id);
            } else {
                await addDoc(collection(db, getQuizzesCollectionPath(appId)), {
                    ...quizData,
                    createdAt: serverTimestamp()
                });
                console.log("Quiz created successfully.");
            }

            console.log(`Quiz ${isEditing ? 'updated' : 'created'} successfully! Code: ${quizCode}`);
            setEditingQuiz(null);
            setGameState('dashboard');
        } catch (error) {
            console.error("Error saving quiz:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="card">
            <h2 className="quiz-section-header" style={{ fontSize: '1.25rem', paddingBottom: 0 }}>{isEditing ? 'Edit Quiz' : 'Create New Quiz'}</h2>

            <div className="input-group">
                <input
                    type="text"
                    placeholder="Quiz Title (e.g., General Knowledge 2024)"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    style={{ flexGrow: 1 }}
                />
                <input
                    type="number"
                    placeholder="Time Limit (minutes)"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    style={{ width: '150px', flexShrink: 0 }}
                />
            </div>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                Quiz Code: <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{quizCode}</span>
            </p>

            <h3 className="quiz-section-header">Questions ({questions.length})</h3>

            {questions.map((q, qIndex) => (
                <div key={q.id} className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--color-primary)', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                            {qIndex + 1}. {q.type === 'mcq' ? 'Multiple Choice' : q.type === 'open_ended' ? 'Open-Ended' : 'Image-Based'}
                        </p>
                        <button className="btn btn-danger" onClick={() => deleteQuestion(q.id)} style={{ padding: '4px 10px', fontSize: '0.875rem' }}>Delete</button>
                    </div>

                    <textarea
                        rows="2"
                        placeholder="Question Text"
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                    />

                    {(q.type === 'image_text') && (
                        <>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>Upload Question Image (Optional):</p>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(q.id, e.target.files[0])}
                                style={{ marginBottom: '0.75rem' }}
                            />
                            {q.imageUrl && <img src={q.imageUrl} alt="Question Preview" className="question-image" style={{ width: '8rem' }} />}
                        </>
                    )}

                    {(q.type === 'open_ended' || q.type === 'image_text') && (
                        <>
                            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                Correct Answer Text (Use | to separate multiple acceptable answers, e.g., Albert Einstein|Einstein):
                            </p>
                            <input
                                type="text"
                                placeholder="e.g., Albert Einstein|Einstein"
                                value={q.correctAnswerText}
                                onChange={(e) => updateQuestion(q.id, 'correctAnswerText', e.target.value)}
                            />
                        </>
                    )}

                    {q.type === 'mcq' && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>Options (Check the box for the correct answer):</p>
                            {q.options.map((opt, optIndex) => (
                                <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={opt.isCorrect}
                                        onChange={(e) => updateOption(q.id, optIndex, 'isCorrect', e.target.checked)}
                                        style={{ width: '1rem', height: '1rem', marginBottom: 0 }}
                                    />
                                    <input
                                        type="text"
                                        placeholder={`Option ${optIndex + 1}`}
                                        value={opt.text}
                                        onChange={(e) => updateOption(q.id, optIndex, 'text', e.target.value)}
                                        style={{ marginBottom: 0, flexGrow: 1 }}
                                    />
                                    {q.options.length > 2 && (
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => {
                                                setQuestions(prev => prev.map(currentQ => {
                                                    if (currentQ.id === q.id) {
                                                        const newOptions = [...currentQ.options];
                                                        newOptions.splice(optIndex, 1);
                                                        // If we're removing the correct option, make the first option correct
                                                        if (opt.isCorrect && newOptions.length > 0) {
                                                            newOptions[0].isCorrect = true;
                                                        }
                                                        return { ...currentQ, options: newOptions };
                                                    }
                                                    return currentQ;
                                                }));
                                            }}
                                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                            {q.options.length < 5 && (
                                <button className="btn btn-secondary" onClick={() => {
                                    setQuestions(prev => prev.map(currentQ => {
                                        if (currentQ.id === q.id) {
                                            return { ...currentQ, options: [...currentQ.options, { text: '', isCorrect: false }] };
                                        }
                                        return currentQ;
                                    }));
                                }} style={{ padding: '6px 10px', fontSize: '0.875rem', width: 'fit-content', marginTop: '0.5rem' }}>+ Add Option</button>
                            )}
                        </div>
                    )}
                </div>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <select
                    className="btn btn-secondary"
                    onChange={(e) => {
                        if (e.target.value) {
                            addQuestion(e.target.value);
                            e.target.value = '';
                        }
                    }}
                    value=""
                    style={{ flexGrow: 1 }}
                >
                    <option value="" disabled>+ Add Question Type</option>
                    <option value="mcq">Multiple Choice Question</option>
                    <option value="open_ended">Open-Ended Question (Text Answer)</option>
                    <option value="image_text">Image-Based Question (Text Answer with Image Prompt)</option>
                </select>
            </div>

            <div style={{ position: 'relative' }}>
                {isEditing && quizCode && (
                    <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                const shareUrl = `${window.location.origin}?quiz=${quizCode}`;
                                if (navigator.share) {
                                    navigator.share({
                                        title: quizTitle || 'Quiz',
                                        text: `Join my quiz: ${quizTitle}`,
                                        url: shareUrl
                                    }).catch(console.error);
                                } else {
                                    navigator.clipboard.writeText(shareUrl).then(() => {
                                        setShowShareTooltip(true);
                                        setTimeout(() => setShowShareTooltip(false), 2000);
                                    });
                                }
                            }}
                            style={{ width: 'auto', margin: '0 auto' }}
                        >
                            🔗 Share Quiz
                        </button>
                        {showShareTooltip && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: 'var(--color-bg-card)',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                boxShadow: '0 2px 4px var(--color-shadow)',
                                zIndex: 100,
                                marginTop: '0.5rem'
                            }}>
                                Quiz link copied!
                            </div>
                        )}
                    </div>
                )}
                <div className="btn-row" style={{ marginTop: '1.5rem', justifyContent: 'space-between' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => { setEditingQuiz(null); setGameState('dashboard'); }}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Publish Quiz')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
// --- Main App Component ---
const App = () => {
    const [gameState, setGameState] = useState('login'); 
    const [nickname, setNickname] = useState('');
    const [quizToPlay, setQuizToPlay] = useState(null);
    const [quizToJoin, setQuizToJoin] = useState('');
    const [leaderboardQuizCode, setLeaderboardQuizCode] = useState('');
    const [theme, setTheme] = useState(getInitialTheme);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const { auth, db, userId, isAuthenticated, authError } = useFirebaseAuth();
    const { quizzes, isLoading } = useQuizData(db, isAuthenticated);

    const isDarkMode = theme === 'dark';

    // Check for existing nickname on component mount - SIMPLIFIED
   useEffect(() => {
    const storedNickname = localStorage.getItem('quizmaker_nickname');
    if (storedNickname) {
        setNickname(storedNickname);
        // Don't automatically redirect to dashboard - let user click the button
        // This prevents automatic navigation when user might want to change nickname
    }
}, []);


    // Handle game state transitions - SIMPLIFIED
    useEffect(() => {
        // Handle shared quiz URL
        const params = new URLSearchParams(window.location.search);
        const sharedQuizCode = params.get('quiz');
        
        // If we have a nickname and either a shared quiz code or we're in login state
        const hasNickname = nickname && nickname.trim();
        
        if (hasNickname) {
            if (sharedQuizCode) {
                // Set the quiz code and navigate to join quiz
                setQuizToJoin(sharedQuizCode);
                setGameState('join_quiz');
                // Clear the URL parameter
                window.history.replaceState({}, '', window.location.pathname);
            } else if (gameState === 'login') {
                // Normal flow - go to dashboard
                setGameState('dashboard');
            }
        }
    }, [nickname, gameState, isAuthenticated]);

    // Persist nickname when it changes
    // Theme effect
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleThemeChange = () => {
            const storedTheme = localStorage.getItem(THEME_KEY);
            if (!storedTheme) {
                // Only update if user hasn't manually set a theme
                setTheme(mediaQuery.matches ? 'dark' : 'light');
            }
        };

        // Set up listener for system theme changes
        mediaQuery.addEventListener('change', handleThemeChange);

        // Initial check
        handleThemeChange();

        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, []);

    useEffect(() => {
        if (nickname && nickname.trim()) {
            localStorage.setItem('quizmaker_nickname', nickname.trim());
        }
    }, [nickname]);

    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem(THEME_KEY, newTheme); // Save manual theme choice
    }, [theme]);

    const handleRetryAuth = () => {
        setRetryCount(prev => prev + 1);
        window.location.reload();
    };

    const renderContent = () => {
        // SIMPLIFIED: Show login screen if no nickname
        if (!nickname || gameState === 'login') {
            return <LoginView setNickname={setNickname} setGameState={setGameState} nickname={nickname} />;
        }

        // Show Firebase loading/error states only if we need Firebase functionality
        if (authError || retryCount > 0) {
            return (
                <DebugView 
                    auth={auth}
                    db={db}
                    userId={userId}
                    isAuthenticated={isAuthenticated}
                    authError={authError}
                    onRetry={handleRetryAuth}
                />
            );
        }

        // Show loading screen until Firebase services are initialized (but don't block UI)
        if (!auth || !db) {
            return (
                <div className="card center-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-primary)' }}>Welcome, {nickname}!</p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Setting up real-time features...</p>
                    <div style={{ marginTop: '1rem' }}>
                        <button 
                            className="btn btn-secondary" 
                            onClick={() => setGameState('dashboard')}
                        >
                            Continue to Dashboard
                        </button>
                    </div>
                </div>
            );
        }
        
        // If not authenticated but we have nickname, still allow access
        if (!isAuthenticated) {
            return (
                <div className="card center-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-primary)' }}>Welcome, {nickname}!</p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Setting up your session...</p>
                    <div style={{ marginTop: '1rem' }}>
                        <button 
                            className="btn btn-secondary" 
                            onClick={() => setGameState('dashboard')}
                        >
                            Continue to Dashboard
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleRetryAuth}
                            style={{ marginTop: '0.5rem' }}
                        >
                            Retry Connection
                        </button>
                    </div>
                </div>
            );
        }

        // Main app flow - user is logged in with nickname
        switch (gameState) {
            case 'dashboard':
                return <DashboardView
                    setGameState={setGameState}
                    setQuizToJoin={setQuizToJoin}
                    quizzes={quizzes}
                    isLoading={isLoading}
                    setLeaderboardQuizCode={setLeaderboardQuizCode}
                    nickname={nickname}
                />;
            case 'create_quiz':
                return <QuizCreator
                    setGameState={setGameState}
                    nickname={nickname}
                    editingQuiz={editingQuiz}
                    setEditingQuiz={setEditingQuiz}
                />;
            case 'join_quiz':
                return <JoinQuizView
                    setGameState={setGameState}
                    setQuizToPlay={setQuizToPlay}
                    quizToJoin={quizToJoin}
                    quizzes={quizzes}
                    nickname={nickname}
                />;
            case 'playing_quiz':
                if (!quizToPlay) {
                    setGameState('dashboard');
                    return null;
                }
                return <QuizTaker setGameState={setGameState} quizToPlay={quizToPlay} nickname={nickname} />;
            case 'leaderboard_view':
                if (!leaderboardQuizCode) {
                    setGameState('dashboard');
                    return null;
                }
                return <LeaderboardView setGameState={setGameState} leaderboardQuizCode={leaderboardQuizCode} />;
            case 'my_quizzes':
                return <MyQuizzesView
                    setGameState={setGameState}
                    nickname={nickname}
                    quizzes={quizzes}
                    setEditingQuiz={setEditingQuiz}
                />;
            default:
                return (
                    <div className="card center-card" style={{ textAlign: 'center' }}>
                        <p>Error: Unknown state.</p>
                        <button className="btn btn-secondary" onClick={() => setGameState('dashboard')}>
                            Go to Dashboard
                        </button>
                    </div>
                );
        }
    };

    return (
        <FirebaseContext.Provider value={{ auth, db, userId, isAuthenticated }}>
            <style>{styles}</style>
            <div className={isDarkMode ? 'dark-mode' : 'light-mode'}>
                <AnimatedBackground />
                <div className="app-container">
                    <div className="header">
                        <button
                            className="btn-icon"
                            onClick={toggleTheme}
                            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                        <h1 className="app-title">QuizMaker</h1>
                        <div style={{ width: '48px' }}></div>
                    </div>
                    {renderContent()}
                </div>
            </div>
        </FirebaseContext.Provider>
    );
};

export default App;