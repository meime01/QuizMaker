import React, { useState, useEffect, useCallback, useMemo } from 'react';
// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, where, getDocs } from 'firebase/firestore';

// --- Firebase Configuration for Local Use (HARDCODED) ---
const firebaseConfig = {
  apiKey: "AIzaSyCxbMsC90uRDf7x537j_10iMEhW6xmEY1g",
  authDomain: "quizzify-backend-f2103.firebaseapp.com",
  projectId: "quizzify-backend-f2103",
  storageBucket: "quizzify-backend-f2103.firebasestorage.app",
  messagingSenderId: "827687038991",
  appId: "1:827687038991:web:90979ffad7444d0fe9737a"
};

// --- Data & Utility Constants ---
const QUIZ_STATUS_LIVE = 'live';
const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice Question (MCQ)' },
  { value: 'image', label: 'Image-Based Question (Placeholder)' },
  { value: 'open', label: 'Open-Ended Question (Placeholder)' },
];

// Generates a short, unique code for quiz sharing
const generateQuizCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// --- Firestore Path Helpers (Simplified for Local Use) ---
const getQuizzesCollectionPath = () => `quizzes`;
const getLeaderboardCollectionPath = () => `leaderboard`;

// --- Local Storage Helpers (for Theme only) ---
const THEME_KEY = 'gemini-quiz-theme';
const getInitialTheme = () => {
  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme) return storedTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  } catch {
    return 'light';
  }
};

// --- Embedded Standard CSS Styling (Modern & Themed) ---
const styles = `
:root {
  --font-family: 'Inter', sans-serif;
  --transition-speed: 0.3s ease-in-out;
}
/* Dark Theme Variables */
.dark-theme {
  --bg-color: #1a1a2e;
  --card-bg: #2e304b;
  --text-color: #e4e6eb;
  --primary-color: #00bcd4;
  --secondary-color: #ff6a99;
  --shadow-color: rgba(0, 0, 0, 0.4);
  --border-color: #4a4e69;
  --input-bg: #1a1a2e;
  --success-color: #4caf50;
  --error-color: #f44336;
  --warning-color: #ffc107;
}
/* Light Theme Variables */
.light-theme {
  --bg-color: #f0f4f8;
  --card-bg: #ffffff;
  --text-color: #1a1a2e;
  --primary-color: #1e88e5;
  --secondary-color: #00bcd4;
  --shadow-color: rgba(0, 0, 0, 0.15);
  --border-color: #d1d9e6;
  --input-bg: #ffffff;
  --success-color: #4caf50;
  --error-color: #f44336;
  --warning-color: #ff9800;
}
body, #root {
  margin: 0;
  padding: 0;
  font-family: var(--font-family);
  background-color: transparent;
  min-height: 100vh;
  color: var(--text-color);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: color var(--transition-speed);
}
/* --- Animated Background Styles --- */
@keyframes moveBackground {
  0% { transform: translateY(-10vh); opacity: 0; }
  50% { opacity: 0.8; }
  100% { transform: translateY(100vh); opacity: 0; }
}
.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  z-index: -1;
  background-color: var(--bg-color);
  transition: background-color var(--transition-speed);
}
.particle {
  position: absolute;
  color: var(--primary-color);
  font-size: clamp(10px, 3vw, 24px);
  opacity: 0;
  animation-name: moveBackground;
  animation-iteration-count: infinite;
  pointer-events: none;
  font-weight: 600;
  text-shadow: 0 0 2px var(--primary-color);
}
/* --- End Animated Background Styles --- */
.app-header {
  text-align: center;
  margin-bottom: 20px;
  position: relative;
}
.app-container {
  width: 95%;
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background-color: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 10px 30px var(--shadow-color);
  border: 1px solid var(--border-color);
  transition: all var(--transition-speed);
  position: relative;
  z-index: 1;
}
h1 {
  color: var(--primary-color);
  text-align: center;
  margin: 0;
  font-size: 2.5em;
  text-shadow: 1px 1px 3px var(--shadow-color);
}
.card {
  background-color: var(--input-bg);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 15px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  transition: all var(--transition-speed);
}
.button {
  display: inline-block;
  padding: 10px 18px;
  margin: 5px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
}
.button-primary {
  background-color: var(--primary-color);
  color: var(--card-bg);
}
.button-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--shadow-color);
}
.button-secondary {
  background-color: var(--secondary-color);
  color: var(--input-bg);
}
.button-secondary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--shadow-color);
}
.theme-toggle-button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--secondary-color);
    font-size: 1.5em;
    padding: 10px;
    border-radius: 50%;
    transition: background-color 0.2s;
    position: absolute;
    top: 0;
    right: 0;
}
.theme-toggle-button:hover {
    background-color: rgba(0, 188, 212, 0.1);
}
.option-button {
  display: block;
  width: 100%;
  text-align: left;
  margin-bottom: 10px;
  padding: 14px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  transition: all 0.2s;
}
.option-button:hover:not(:disabled) {
  background-color: rgba(0, 188, 212, 0.1);
  border-color: var(--primary-color);
}
.option-button.correct {
  background-color: var(--success-color);
  color: white;
  border-color: var(--success-color);
}
.option-button.incorrect {
  background-color: var(--error-color);
  color: white;
  border-color: var(--error-color);
}
input[type="text"], input[type="number"], textarea, select {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 6px;
  transition: all var(--transition-speed);
  box-sizing: border-box;
}
.message {
  text-align: center;
  padding: 40px;
  font-size: 1.2em;
  color: var(--secondary-color);
}
/* Leaderboard specific styles */
.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}
.leaderboard-table th, .leaderboard-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}
.leaderboard-table th {
  background-color: var(--primary-color);
  color: white;
  font-weight: 700;
}
.leaderboard-table tr:nth-child(even) {
  background-color: var(--bg-color);
}
.leaderboard-table tr:hover {
  background-color: rgba(0, 188, 212, 0.1);
}
.review-item {
    padding: 15px;
    margin-bottom: 15px;
    border-left: 5px solid;
}
.review-item.correct { border-left-color: var(--success-color); }
.review-item.incorrect { border-left-color: var(--error-color); }
.review-options p {
    margin: 5px 0;
    padding: 8px;
    border-radius: 4px;
}
.review-options .user-selected {
    font-weight: bold;
    background-color: var(--warning-color);
    color: var(--input-bg);
}
.review-options .actual-correct {
    font-weight: bold;
    background-color: var(--success-color);
    color: white;
}
.timer {
    position: absolute;
    top: 0;
    right: 0;
    padding: 8px 12px;
    background-color: var(--primary-color);
    color: white;
    border-radius: 0 16px 0 12px;
    font-weight: bold;
    font-size: 1.1em;
}
`;

// --- UI Components ---
const LoginView = ({ onLogin }) => {
  const [name, setName] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin(name.trim());
    }
  };
  return (
    <div className="card" style={{ maxWidth: '400px', margin: 'auto', background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--primary-color)', textAlign: 'center' }}>Welcome to QuizMaker!</h2>
      <p>Create your nickname</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter Nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button
          className="button button-primary"
          type="submit"
          style={{ width: '100%', marginTop: '10px' }}
          disabled={!name.trim()}
        >
          Continue
        </button>
      </form>
    </div>
  );
};

const QuizLeaderboard = ({ quizTitle, leaderboard, onFinish }) => {
  const sortedScores = useMemo(() => {
    return leaderboard
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const timeA = parseInt(a.timeTaken.replace('s', '')) || Infinity;
        const timeB = parseInt(b.timeTaken.replace('s', '')) || Infinity;
        return timeA - timeB;
      });
  }, [leaderboard]);
  return (
    <div className="card" style={{ background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--secondary-color)' }}>Leaderboard for: {quizTitle}</h2>
      {sortedScores.length === 0 ? (
        <p className="message" style={{ padding: '20px' }}>No scores recorded for this quiz yet!</p>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Time Taken</th>
            </tr>
          </thead>
          <tbody>
            {sortedScores.map((scoreEntry, index) => (
              <tr key={index}>
                <td style={{ fontWeight: scoreEntry.score === scoreEntry.totalQuestions ? 'bold' : 'normal' }}>
                  {index + 1} {index === 0 && '🏆'}
                </td>
                <td>{scoreEntry.username}</td>
                <td>{scoreEntry.score}/{scoreEntry.totalQuestions}</td>
                <td>{scoreEntry.timeTaken || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="button button-primary" onClick={onFinish} style={{ marginTop: '20px' }}>
        Return to Dashboard
      </button>
    </div>
  );
};

const QuizReview = ({ userAnswers, score, totalQuestions, quizTitle, onFinish }) => {
  return (
    <div className="card" style={{ background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--primary-color)' }}>Review: {quizTitle}</h2>
      <h3 style={{ color: 'var(--secondary-color)' }}>
        Your Score: {score} / {totalQuestions}
      </h3>
      {userAnswers.map((answer, index) => (
        <div
          key={index}
          className={`review-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}
        >
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
            Question {index + 1}: {answer.question}
          </p>
          <div className="review-options">
            {answer.options.map((optionText, oIndex) => {
              const isSelected = answer.selectedOptionIndex === oIndex;
              const isCorrectOption = answer.fullOptions[oIndex].isCorrect;
              let className = '';
              if (isCorrectOption) {
                className = 'actual-correct';
              } else if (isSelected && !isCorrectOption) {
                className = 'user-selected';
              } else if (isSelected) {
                className = 'user-selected';
              }
              return (
                <p
                  key={oIndex}
                  className={className}
                  style={{ border: isSelected ? '2px solid var(--secondary-color)' : 'none' }}
                >
                  {isCorrectOption ? '✅ ' : (isSelected ? '❌ ' : '')}
                  {optionText}
                </p>
              );
            })}
          </div>
          <p style={{ color: answer.isCorrect ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 'bold', marginTop: '10px' }}>
            Result: {answer.isCorrect ? 'Correct' : 'Incorrect'}
          </p>
        </div>
      ))}
      <button className="button button-primary" onClick={onFinish} style={{ marginTop: '20px', width: '100%' }}>
        View Leaderboard
      </button>
    </div>
  );
};

const QuizTaker = ({ quiz, username, userId, db, onReview }) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selection, setSelection] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimitSeconds);
  const [startTime] = useState(Date.now());
  const question = quiz.questions[currentQIndex];
  const totalQuestions = quiz.questions.length;
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };
  const handleFinishQuiz = useCallback(async (finalScore, totalQs, timeEnd) => {
    if (!db) return;
    setIsSubmitting(true);
    const timeTaken = Math.floor((timeEnd - startTime) / 1000);
    const leaderboardRef = collection(db, getLeaderboardCollectionPath());
    const newEntry = {
      quizId: quiz.id,
      quizCode: quiz.code,
      username: username,
      userId: userId,
      score: finalScore,
      totalQuestions: totalQs,
      timeTaken: timeTaken + 's',
      date: new Date().toISOString()
    };
    try {
      await addDoc(leaderboardRef, newEntry);
      console.log("Score successfully submitted to Firestore!");
    } catch (error) {
      console.error("Error submitting score to Firestore: ", error);
    } finally {
      setIsSubmitting(false);
      onReview(finalScore, totalQs, userAnswers, quiz.title);
    }
  }, [db, quiz.id, quiz.code, username, userId, startTime, userAnswers, onReview, quiz.title]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinishQuiz(score, totalQuestions, Date.now());
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, score, totalQuestions, handleFinishQuiz]);

  const handleOptionClick = (option, index) => {
    if (selection !== null) return;
    setSelection(index);
    const isCorrect = option.isCorrect;
    const newScore = score + (isCorrect ? 1 : 0);
    setScore(newScore);
    setUserAnswers(prev => [...prev, {
      qIndex: currentQIndex,
      selectedOptionIndex: index,
      isCorrect: isCorrect,
      question: question.text,
      options: question.options.map(o => o.text),
      fullOptions: question.options,
    }]);
    setTimeout(() => {
      if (currentQIndex < totalQuestions - 1) {
        setCurrentQIndex(currentQIndex + 1);
        setSelection(null);
      } else {
        handleFinishQuiz(newScore, totalQuestions, Date.now());
      }
    }, 1000);
  };

  if (isSubmitting) {
    return <div className="message card">Submitting Score to Leaderboard...</div>;
  }

  if (question.type !== 'mcq') {
    return (
      <div className="card">
        <h2 style={{color: 'var(--warning-color)'}}>Question Type Not Fully Supported Yet</h2>
        <p>This is a **{question.type.toUpperCase()}** question. In the current iteration, only MCQ is functional.</p>
        <p>Question: {question.text}</p>
        <button className="button button-primary" onClick={() => {
          setCurrentQIndex(currentQIndex + 1);
          setSelection(null);
        }}>
          Skip/Next Question
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ background: 'var(--card-bg)', position: 'relative' }}>
      <div className="timer" style={{
        backgroundColor: timeLeft <= 60 ? 'var(--error-color)' : 'var(--primary-color)'
      }}>
        {formatTime(timeLeft)}
      </div>
      <h2 style={{ color: 'var(--primary-color)' }}>{quiz.title}</h2>
      <p>Player: <span style={{ color: 'var(--secondary-color)', fontWeight: 'bold' }}>{username}</span></p>
      <p>Question {currentQIndex + 1} of {totalQuestions}</p>
      <div className="card">
        <p style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
          {question.text}
        </p>
        <div>
          {question.options.map((option, index) => (
            <button
              key={index}
              className={`
                button option-button
                ${selection !== null && option.isCorrect ? 'correct' : ''}
                ${selection === index && !option.isCorrect ? 'incorrect' : ''}
              `}
              onClick={() => handleOptionClick(option, index)}
              disabled={selection !== null}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuizCreator = ({ onFinish, username, userId, db }) => {
  const [title, setTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(600);
  const [quizCode] = useState(generateQuizCode());
  const [questions, setQuestions] = useState([
    { type: 'mcq', text: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const handleAddQuestion = () => {
    setQuestions([...questions, {
      type: 'mcq',
      text: '',
      options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]
    }]);
  };
  const handleUpdateQuestion = (qIndex, field, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex][field] = value;
    setQuestions(newQuestions);
  };
  const handleUpdateOption = (qIndex, oIndex, field, value) => {
    const newQuestions = [...questions];
    const newOptions = [...newQuestions[qIndex].options];
    if (field === 'text') {
      newOptions[oIndex].text = value;
    } else if (field === 'isCorrect') {
      newOptions.forEach((opt, idx) => opt.isCorrect = (idx === oIndex));
    }
    newQuestions[qIndex].options = newOptions;
    setQuestions(newQuestions);
  };
  const handleAddOption = (qIndex) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.push({ text: '', isCorrect: false });
    setQuestions(newQuestions);
  };
  const handleSubmit = async () => {
    if (!db) {
      setMessage('Database not ready.');
      return;
    }
    const hasInvalidQuestion = questions.some(q =>
      !q.text.trim() ||
      (q.type === 'mcq' && q.options.some(o => !o.text.trim())) ||
      (q.type === 'mcq' && !q.options.some(o => o.isCorrect))
    );
    if (!title.trim() || !timeLimit || hasInvalidQuestion) {
      setMessage('Please fill in the quiz title, time limit, and ensure all questions have text and at least one correct option for MCQs.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    const newQuiz = {
      title: title.trim(),
      code: quizCode,
      timeLimitSeconds: parseInt(timeLimit),
      questions: questions.map(q => ({
        type: q.type,
        text: q.text.trim(),
        options: q.type === 'mcq' ? q.options.map(o => ({
          text: o.text.trim(),
          isCorrect: o.isCorrect
        })) : null,
      })).filter(q => q.text.length > 0),
      createdBy: username,
      creatorId: userId,
      status: QUIZ_STATUS_LIVE,
      createdAt: new Date().toISOString()
    };
    try {
      const quizzesRef = collection(db, getQuizzesCollectionPath());
      await addDoc(quizzesRef, newQuiz);
      setMessage(`Quiz saved successfully! Code: ${quizCode}`);
      setTimeout(onFinish, 2500);
    } catch (error) {
      console.error("Error adding quiz to Firestore: ", error);
      setMessage('Failed to save quiz to the cloud.');
      setIsSaving(false);
    }
  };
  return (
    <div className="card" style={{ background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--primary-color)' }}>Create New Quiz</h2>
      <p>Creator: <span style={{ color: 'var(--secondary-color)', fontWeight: 'bold' }}>{username}</span></p>
      <div className="card" style={{ backgroundColor: 'var(--warning-color)', color: 'var(--input-bg)' }}>
        <h3 style={{ margin: 0 }}>Quiz Code: {quizCode}</h3>
        <p style={{ margin: 0, fontSize: '0.9em' }}>Share this code for others to join.</p>
      </div>
      <p style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>Quiz Title:</p>
      <input
        type="text"
        placeholder="Enter Quiz Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <p style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>Time Limit (Seconds):</p>
      <input
        type="number"
        placeholder="e.g., 600 for 10 minutes"
        value={timeLimit}
        onChange={(e) => setTimeLimit(e.target.value)}
        min="60"
      />
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="card" style={{ border: '1px solid var(--secondary-color)', background: 'var(--input-bg)' }}>
          <h3 style={{ marginTop: 0 }}>Question {qIndex + 1}</h3>
          <p>Question Type:</p>
          <select
            value={q.type}
            onChange={(e) => handleUpdateQuestion(qIndex, 'type', e.target.value)}
          >
            {QUESTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <textarea
            placeholder="Question Text"
            value={q.text}
            onChange={(e) => handleUpdateQuestion(qIndex, 'text', e.target.value)}
          />
          {q.type === 'mcq' && (
            <>
              <p>Options (Check the correct answer):</p>
              {q.options.map((o, oIndex) => (
                <div key={oIndex} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                  <input
                    type="radio"
                    name={`q${qIndex}-correct`}
                    checked={o.isCorrect}
                    onChange={() => handleUpdateOption(qIndex, oIndex, 'isCorrect', true)}
                    style={{ marginRight: '10px' }}
                  />
                  <input
                    type="text"
                    placeholder={`Option ${oIndex + 1} Text`}
                    value={o.text}
                    onChange={(e) => handleUpdateOption(qIndex, oIndex, 'text', e.target.value)}
                    style={{ flexGrow: 1, marginBottom: 0 }}
                  />
                </div>
              ))}
              <button
                className="button button-secondary"
                onClick={() => handleAddOption(qIndex)}
                style={{ marginTop: '10px', padding: '5px 10px', fontSize: '0.9em' }}
              >
                + Add Option
              </button>
            </>
          )}
          {q.type !== 'mcq' && (
            <p style={{ color: 'var(--warning-color)' }}>
              Note: This question type is a placeholder and will be automatically skipped during the quiz.
            </p>
          )}
        </div>
      ))}
      <button className="button button-primary" onClick={handleAddQuestion}>
        + Add New Question
      </button>
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          className="button button-primary"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Publish Quiz'}
        </button>
        <button
          className="button button-secondary"
          onClick={onFinish}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
      {message && <p className="message" style={{ color: isSaving ? 'var(--secondary-color)' : 'var(--success-color)', padding: '10px' }}>{message}</p>}
    </div>
  );
};

const JoinQuizView = ({ onFinish, onStartQuiz, db, playerUsername }) => {
  const [quizCode, setQuizCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!db || !quizCode.trim() || !playerUsername.trim()) {
      setError('Please enter the quiz code.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const quizzesRef = collection(db, getQuizzesCollectionPath());
      const q = query(quizzesRef, where('code', '==', quizCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError(`Quiz with code '${quizCode.toUpperCase()}' not found.`);
      } else {
        const quizDoc = querySnapshot.docs[0];
        const quiz = { id: quizDoc.id, ...quizDoc.data() };
        onStartQuiz(quiz, playerUsername);
      }
    } catch (err) {
      console.error("Error finding quiz:", err);
      setError('An error occurred while searching for the quiz.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="card" style={{ maxWidth: '450px', margin: 'auto' }}>
      <h2 style={{ color: 'var(--secondary-color)', textAlign: 'center' }}>Join a Quiz</h2>
      <p style={{ textAlign: 'center' }}>Joining as: <strong style={{color: 'var(--primary-color)'}}>{playerUsername}</strong></p>
      <form onSubmit={handleJoin}>
        <p style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>Quiz Code:</p>
        <input
          type="text"
          placeholder="Enter 6-digit Code (e.g., GXY8A2)"
          value={quizCode}
          onChange={(e) => setQuizCode(e.target.value.toUpperCase())}
          required
          maxLength={6}
        />
        {error && <p style={{ color: 'var(--error-color)', textAlign: 'center' }}>{error}</p>}
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <button
            className="button button-primary"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Start Quiz'}
          </button>
          <button
            className="button button-secondary"
            onClick={onFinish}
            type="button"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

const DashboardView = ({ onJoin, onCreate, availableQuizzes, username, onShowLeaderboard }) => {
  return (
    <div className="card" style={{ background: 'var(--card-bg)', padding: '20px' }}>
      <p style={{ fontSize: '1.2em', color: 'var(--text-color)', textAlign: 'center', marginBottom: '10px' }}>
        Welcome, <strong style={{color: 'var(--secondary-color)'}}>{username}</strong>!
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
        <button className="button button-primary" onClick={onJoin} style={{ padding: '15px 30px', fontSize: '1.1em' }}>
          🤝 Join Quiz
        </button>
        <button className="button button-secondary" onClick={onCreate} style={{ padding: '15px 30px', fontSize: '1.1em' }}>
          ➕ Create a Quiz
        </button>
      </div>
      <h2 style={{ color: 'var(--primary-color)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        Available Quizzes ({availableQuizzes.length})
      </h2>
      {availableQuizzes.length === 0 ? (
        <p className="message" style={{ padding: '20px' }}>No live quizzes available right now. Be the first to create one!</p>
      ) : (
        <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
          {availableQuizzes.map((quiz) => (
            <div key={quiz.id} className="card" style={{
              marginBottom: '10px',
              background: 'var(--input-bg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{flexGrow: 1}}>
                <strong style={{ display: 'block', fontSize: '1.2em', color: 'var(--primary-color)' }}>
                  {quiz.title}
                </strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '1em' }}>
                  Code: <span style={{ fontWeight: 'bold', color: 'var(--warning-color)', backgroundColor: 'var(--card-bg)', padding: '2px 8px', borderRadius: '4px' }}>{quiz.code}</span>
                </p>
                <p style={{ margin: '0', fontSize: '0.9em', color: 'var(--text-color)' }}>
                  Created by: {quiz.createdBy} | Time Limit: {Math.floor(quiz.timeLimitSeconds / 60)} minutes
                </p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => onShowLeaderboard(quiz.id, quiz.title)}
                style={{ marginLeft: '15px', padding: '8px 15px', fontSize: '0.9em' }}
              >
                🏆 View Leaderboard
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Application Component ---
export default function App() {
  const [gameState, setGameState] = useState('loading');
  const [username, setUsername] = useState('');
  const [quizContext, setQuizContext] = useState(null);
  const [reviewContext, setReviewContext] = useState(null);
  const [leaderboardContext, setLeaderboardContext] = useState(null);

  // Firebase state
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [availableQuizzes, setAvailableQuizzes] = useState([]);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setDb(dbInstance);
      const authCleanup = onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthReady(true);
          if (gameState === 'loading') {
            setGameState('login');
          }
        } else {
          try {
            await signInAnonymously(authInstance);
          } catch (error) {
            console.error("Error during anonymous authentication:", error);
            setIsAuthReady(true);
            setUserId(crypto.randomUUID());
            if (gameState === 'loading') {
              setGameState('login');
            }
          }
        }
      });
      return () => authCleanup();
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setGameState('error');
    }
  }, []);

  // 2. Quiz List Listener
  useEffect(() => {
    if (!db || !isAuthReady) {
      setAvailableQuizzes([]);
      return;
    }
    const quizzesRef = collection(db, getQuizzesCollectionPath());
    const qQuizzes = query(quizzesRef, where('status', '==', QUIZ_STATUS_LIVE));
    const unsubscribeQuizzes = onSnapshot(qQuizzes, (snapshot) => {
      const fetchedQuizzes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableQuizzes(fetchedQuizzes);
    }, (error) => {
      console.error("Error listening to quizzes:", error);
    });
    return () => unsubscribeQuizzes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, isAuthReady]);

  // 3. Leaderboard Listener
  useEffect(() => {
    if (!db || !isAuthReady || gameState !== 'leaderboard' || !leaderboardContext) {
      setLeaderboardData([]);
      return;
    }
    const leaderboardRef = collection(db, getLeaderboardCollectionPath());
    const qLeaderboard = query(leaderboardRef, where('quizId', '==', leaderboardContext.quizId));
    const unsubscribeLeaderboard = onSnapshot(qLeaderboard, (snapshot) => {
      const fetchedLeaderboard = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeaderboardData(fetchedLeaderboard);
    }, (error) => {
      console.error("Error listening to leaderboard:", error);
    });
    return () => unsubscribeLeaderboard();
  }, [db, isAuthReady, gameState, leaderboardContext]);

  // Theme Sync
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(current => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  // --- Animated Background Logic ---
  const characters = useMemo(() => {
    const numbers = Array.from({ length: 10 }, (_, i) => i + 1);
    const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    return [...numbers, ...letters];
  }, []);

  const NUM_PARTICLES = 50;
  const particles = useMemo(() => {
    return Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      id: i,
      char: characters[Math.floor(Math.random() * characters.length)],
      left: `${Math.random() * 100}vw`,
      animationDuration: `${Math.random() * 7 + 5}s`,
      animationDelay: `${Math.random() * 10}s`,
      fontSize: `${Math.random() * 14 + 10}px`,
    }));
  }, [characters]);

  // --- State Handlers ---
  const handleLogin = useCallback((name) => {
    setUsername(name);
    setGameState('dashboard');
  }, []);

  const handleReturnToDashboard = useCallback(() => {
    setQuizContext(null);
    setReviewContext(null);
    setLeaderboardContext(null);
    setGameState('dashboard');
  }, []);

  const handleStartQuiz = useCallback((quiz, playerUsername) => {
    setQuizContext({ quiz, username: playerUsername });
    setGameState('playing');
  }, []);

  const handleQuizFinish = useCallback((score, totalQuestions, answers, quizTitle) => {
    setReviewContext({ score, totalQuestions, userAnswers: answers, quizTitle });
    setGameState('reviewing');
  }, []);

  const handleShowLeaderboardForQuiz = useCallback((quizId, quizTitle) => {
    setLeaderboardContext({ quizId, quizTitle });
    setGameState('leaderboard');
  }, []);

  // --- Render Logic ---
  let content;
  if (gameState === 'loading' || !isAuthReady) {
    content = <div className="message">Connecting to Firebase...</div>;
  } else if (gameState === 'login') {
    content = <LoginView onLogin={handleLogin} />;
  } else if (gameState === 'dashboard') {
    content = (
      <DashboardView
        onJoin={() => setGameState('joining')}
        onCreate={() => setGameState('creating')}
        availableQuizzes={availableQuizzes}
        username={username}
        onShowLeaderboard={handleShowLeaderboardForQuiz}
      />
    );
  } else if (gameState === 'joining') {
    content = (
      <JoinQuizView
        onFinish={handleReturnToDashboard}
        onStartQuiz={handleStartQuiz}
        db={db}
        playerUsername={username}
      />
    );
  } else if (gameState === 'creating') {
    content = (
      <QuizCreator
        db={db}
        onFinish={handleReturnToDashboard}
        username={username}
        userId={userId}
      />
    );
  } else if (gameState === 'playing' && quizContext) {
    content = (
      <QuizTaker
        quiz={quizContext.quiz}
        username={quizContext.username}
        userId={userId}
        db={db}
        onReview={handleQuizFinish}
      />
    );
  } else if (gameState === 'reviewing' && reviewContext) {
    content = (
      <QuizReview
        {...reviewContext}
        onFinish={() => handleShowLeaderboardForQuiz(
          quizContext.quiz.id,
          quizContext.quiz.title
        )}
      />
    );
  } else if (gameState === 'leaderboard' && leaderboardContext) {
    content = (
      <QuizLeaderboard
        quizTitle={leaderboardContext.quizTitle}
        leaderboard={leaderboardData}
        onFinish={handleReturnToDashboard}
      />
    );
  } else {
    content = <div className="message">Welcome to QuizMaker. Please Log In or choose an action.</div>;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="animated-bg">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              animationDuration: p.animationDuration,
              animationDelay: p.animationDelay,
              fontSize: p.fontSize,
              top: `-${Math.random() * 100}vh`
            }}
          >
            {p.char}
          </div>
        ))}
      </div>
      <div className={`app-container ${theme}-theme`}>
        <div className="app-header">
          <h1 style={{ flexGrow: 1, textAlign: 'center' }}>QuizMaker</h1>
          {(gameState !== 'login' && gameState !== 'loading') && (
            <button
              className="theme-toggle-button"
              onClick={toggleTheme}
              aria-label="Toggle Light/Dark Mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}
        </div>
        {content}
        {userId && gameState !== 'loading' && (
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.7em', color: 'var(--border-color)' }}>
            User ID: {userId}
          </div>
        )}
      </div>
    </>
  );
}
