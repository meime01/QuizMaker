import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Firebase imports have been removed.

// Utility function for generating IDs
const generateId = () => crypto.randomUUID();

// --- Local Storage Helpers ---
const LEADERBOARD_KEY = 'gemini-quiz-leaderboard';
const THEME_KEY = 'gemini-quiz-theme';

const getLeaderboardFromStorage = () => {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error reading leaderboard from localStorage:", error);
    return [];
  }
};

const saveLeaderboardToStorage = (leaderboard) => {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch (error) {
    console.error("Error saving leaderboard to localStorage:", error);
  }
};

const getInitialTheme = () => {
  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme) return storedTheme;
    // Check system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches 
      ? 'light' 
      : 'dark';
  } catch {
    return 'dark';
  }
};

// --- Hardcoded Initial Quiz Data ---
const initialQuizzes = [
  {
    id: 'q1',
    title: 'Technology & AI Basics',
    questions: [
      {
        text: 'Which company developed the Gemini family of models?',
        options: [
          { text: 'Microsoft', isCorrect: false },
          { text: 'Google', isCorrect: true },
          { text: 'OpenAI', isCorrect: false },
        ],
      },
      {
        text: 'What does React primarily use to build user interfaces?',
        options: [
          { text: 'CSS', isCorrect: false },
          { text: 'HTML', isCorrect: false },
          { text: 'Components', isCorrect: true },
        ],
      },
    ],
    createdBy: 'system',
  },
  {
    id: 'q2',
    title: 'General Knowledge',
    questions: [
      {
        text: 'What is the chemical symbol for water?',
        options: [
          { text: 'O2', isCorrect: false },
          { text: 'H2O', isCorrect: true },
          { text: 'CO2', isCorrect: false },
        ],
      },
      {
        text: 'What is the largest planet in our solar system?',
        options: [
          { text: 'Saturn', isCorrect: false },
          { text: 'Mars', isCorrect: false },
          { text: 'Jupiter', isCorrect: true },
        ],
      },
      {
        text: 'How many continents are there?',
        options: [
          { text: 'Five', isCorrect: false },
          { text: 'Six', isCorrect: false },
          { text: 'Seven', isCorrect: true },
        ],
      },
    ],
    createdBy: 'system',
  },
];


// --- Embedded Standard CSS Styling (Modern & Themed) ---
const styles = `
:root {
  --font-family: 'Inter', sans-serif;
  --transition-speed: 0.3s ease-in-out;
}

/* Dark Theme Variables */
.dark-theme {
  --bg-color: #1a1a2e; /* Deep Blue/Purple */
  --card-bg: #2e304b; /* Slightly lighter card */
  --text-color: #e4e6eb;
  --primary-color: #00bcd4; /* Cyan/Teal - Primary action */
  --secondary-color: #ff6a99; /* Pink/Magenta - Accent */
  --shadow-color: rgba(0, 0, 0, 0.4);
  --border-color: #4a4e69;
  --input-bg: #1a1a2e;
  --success-color: #4caf50;
  --error-color: #f44336;
}

/* Light Theme Variables */
.light-theme {
  --bg-color: #f0f4f8; /* Very light gray/blue */
  --card-bg: #ffffff; /* White card */
  --text-color: #1a1a2e;
  --primary-color: #1e88e5; /* Deep Blue - Primary action */
  --secondary-color: #00bcd4; /* Cyan/Teal - Accent */
  --shadow-color: rgba(0, 0, 0, 0.15);
  --border-color: #d1d9e6;
  --input-bg: #ffffff;
  --success-color: #4caf50;
  --error-color: #f44336;
}

body, #root {
  margin: 0;
  padding: 0;
  font-family: var(--font-family);
  background-color: var(--bg-color);
  min-height: 100vh;
  color: var(--text-color);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color var(--transition-speed), color var(--transition-speed);
}

.app-header {
  /* Simplified header to hold the title */
  text-align: center;
  margin-bottom: 20px;
  position: relative; /* Added relative positioning for the button */
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
  position: relative; /* Added relative positioning for the button */
}

h1 {
  color: var(--primary-color);
  text-align: center;
  margin: 0;
  font-size: 2.5em;
  text-shadow: 1px 1px 3px var(--shadow-color);
}

.card {
  background-color: var(--input-bg); /* Use input-bg for inner cards for contrast */
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
}

.theme-toggle-button:hover {
    background-color: rgba(0, 188, 212, 0.1);
}


.quiz-list h3 {
  color: var(--text-color);
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
  border: 1px solid var(--border-color);
  margin: 8px 0;
  background-color: var(--card-bg);
}

.quiz-list h3:hover {
  background-color: var(--primary-color);
  color: white;
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

input[type="text"], textarea {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 6px;
  transition: all var(--transition-speed);
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
`;

// --- UI Components (Unchanged Logic, updated style usage) ---

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
      <h2 style={{ color: 'var(--primary-color)', textAlign: 'center' }}>Welcome to the Quiz!</h2>
      <p>Please enter your nickname to start or view the leaderboard.</p>
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
          Start Playing
        </button>
      </form>
    </div>
  );
};

const LeaderboardView = ({ leaderboard, quizzes, onFinish }) => {
  // Group scores by quizId
  const groupedScores = useMemo(() => {
    return quizzes.map(quiz => {
      // Filter scores for this quiz, sort by score (desc) and totalQuestions (desc)
      const scores = leaderboard
        .filter(score => score.quizId === quiz.id)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return 0; 
        });

      return {
        quizId: quiz.id,
        quizTitle: quiz.title,
        scores: scores.slice(0, 10) // Show top 10
      };
    }).filter(group => group.scores.length > 0);
  }, [leaderboard, quizzes]);

  return (
    <div className="card" style={{ background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--secondary-color)' }}>Global Leaderboard</h2>
      
      {groupedScores.length === 0 ? (
        <p className="message" style={{ padding: '20px' }}>No scores recorded yet!</p>
      ) : (
        groupedScores.map(group => (
          <div key={group.quizId} className="card" style={{ marginTop: '20px' }}>
            <h3 style={{ color: 'var(--primary-color)' }}>{group.quizTitle}</h3>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Total Questions</th>
                </tr>
              </thead>
              <tbody>
                {group.scores.map((scoreEntry, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: scoreEntry.score === scoreEntry.totalQuestions ? 'bold' : 'normal' }}>
                      {index + 1} {index === 0 && '🏆'}
                    </td>
                    <td>{scoreEntry.username}</td>
                    <td>{scoreEntry.score}</td>
                    <td>{scoreEntry.totalQuestions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <button className="button button-primary" onClick={onFinish} style={{ marginTop: '20px' }}>
        Go Back Home
      </button>
    </div>
  );
};

const QuizTaker = ({ quiz, username, onFinish }) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selection, setSelection] = useState(null); 

  const question = quiz.questions[currentQIndex];
  const totalQuestions = quiz.questions.length;

  const handleOptionClick = (option, index) => {
    if (selection !== null) return;
    setSelection(index);

    // Calculate the score based on the current question's correctness
    const currentQuestionIsCorrect = option.isCorrect;
    
    // Immediately update the score state if correct
    const newScore = score + (currentQuestionIsCorrect ? 1 : 0);
    setScore(newScore);

    setTimeout(() => {
      if (currentQIndex < totalQuestions - 1) {
        setCurrentQIndex(currentQIndex + 1);
        setSelection(null);
      } else {
        // Pass the final calculated score (which includes the current question)
        onFinish({ 
          quizId: quiz.id, 
          score: newScore, 
          totalQuestions,
          username
        });
        setShowResult(true);
      }
    }, 1000);
  };

  if (showResult) {
    return (
      <div className="card" style={{ background: 'var(--card-bg)' }}>
        <h2>Quiz Complete, {username}!</h2>
        <p>Your final score of {score} out of {totalQuestions} has been recorded on the leaderboard.</p>
        <button 
          className="button button-primary" 
          onClick={() => onFinish(null)}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ background: 'var(--card-bg)' }}>
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

const QuizCreator = ({ onSaveQuiz, onFinish }) => { 
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { text: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddQuestion = () => {
    setQuestions([...questions, { 
      text: '', 
      options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] 
    }]);
  };

  const handleUpdateQuestion = (qIndex, field, value) => {
    const newQuestions = [...questions];
    if (field === 'text') {
      newQuestions[qIndex].text = value;
    }
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

  const handleSubmit = () => { 
    if (!title.trim() || questions.some(q => !q.text.trim() || q.options.some(o => !o.text.trim()))) {
      setMessage('Please fill in the quiz title and all question/option texts.');
      return;
    }
    setIsSaving(true);
    setMessage('');

    const newQuiz = {
      id: generateId(),
      title: title.trim(),
      questions: questions.map(q => ({
        text: q.text.trim(),
        options: q.options.map(o => ({
          text: o.text.trim(),
          isCorrect: o.isCorrect
        }))
      })),
      createdBy: 'local-creator',
      createdAt: new Date().toISOString()
    };

    try {
      onSaveQuiz(newQuiz);
      setMessage('Quiz saved successfully!');
      setTimeout(onFinish, 1500);
    } catch (error) {
      console.error("Error adding quiz locally: ", error);
      setMessage('Failed to save quiz locally.');
      setIsSaving(false);
    }
  };

  return (
    <div className="card" style={{ background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--primary-color)' }}>Create New Quiz (Local)</h2>
      
      <p style={{ color: 'var(--text-color)' }}>Quiz Title:</p>
      <input
        type="text"
        placeholder="Enter Quiz Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {questions.map((q, qIndex) => (
        <div key={qIndex} className="card" style={{ border: '1px solid var(--secondary-color)', background: 'var(--input-bg)' }}>
          <h3 style={{ marginTop: 0 }}>Question {qIndex + 1}</h3>
          <textarea
            placeholder="Question Text"
            value={q.text}
            onChange={(e) => handleUpdateQuestion(qIndex, 'text', e.target.value)}
          />
          
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
          {isSaving ? 'Saving...' : 'Save Quiz'}
        </button>
        <button 
          className="button button-secondary" 
          onClick={onFinish} 
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
      {message && <p className="message" style={{ color: isSaving ? 'var(--secondary-color)' : 'var(--error-color)' }}>{message}</p>}
    </div>
  );
};

const HomeView = ({ quizzes, username, onSelectQuiz, onCreateNew, onShowLeaderboard }) => {
  return (
    <div className="card quiz-list" style={{ background: 'var(--card-bg)' }}>
      <h2 style={{ color: 'var(--primary-color)' }}>Welcome, {username}!</h2>
      <button className="button button-secondary" onClick={onShowLeaderboard} style={{ marginBottom: '20px' }}>
        🏆 View Leaderboard
      </button>

      <h2 style={{ color: 'var(--primary-color)' }}>Available Quizzes</h2>
      {quizzes.length === 0 ? (
        <p className="message">No quizzes found. Be the first to create one!</p>
      ) : (
        quizzes.map(quiz => (
          <h3 key={quiz.id} onClick={() => onSelectQuiz(quiz.id)}>
            {quiz.title} ({quiz.questions.length} Questions)
          </h3>
        ))
      )}
      <button className="button button-secondary" onClick={onCreateNew} style={{ marginTop: '20px' }}>
        Create a New Quiz
      </button>
    </div>
  );
};


// --- Main Application Component ---
export default function App() {
  const [gameState, setGameState] = useState('login'); 
  const [username, setUsername] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [quizzes, setQuizzes] = useState(initialQuizzes); 
  const [leaderboard, setLeaderboard] = useState([]);
  const [theme, setTheme] = useState(getInitialTheme); // State for light/dark mode

  // Load leaderboard from localStorage on initial render
  useEffect(() => {
    const storedLeaderboard = getLeaderboardFromStorage();
    setLeaderboard(storedLeaderboard);
  }, []);

  // Sync theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  
  const toggleTheme = useCallback(() => {
    setTheme(current => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const selectedQuiz = useMemo(() => 
    quizzes.find(q => q.id === selectedQuizId)
  , [quizzes, selectedQuizId]);

  // Handler for login completion
  const handleLogin = useCallback((name) => {
    setUsername(name);
    setGameState('home');
  }, []);

  // Handler for score submission
  const handleScoreSubmission = useCallback((scoreData) => {
    if (scoreData) {
      const newEntry = {
        id: generateId(),
        quizId: scoreData.quizId,
        username: scoreData.username,
        score: scoreData.score,
        totalQuestions: scoreData.totalQuestions,
        date: new Date().toISOString()
      };

      setLeaderboard(prev => {
        const newLeaderboard = [...prev, newEntry];
        saveLeaderboardToStorage(newLeaderboard); 
        return newLeaderboard;
      });
    }
    setSelectedQuizId(null);
    setGameState('home');
  }, []);

  const handleStartCreation = useCallback(() => {
    setGameState('creating');
  }, []);

  const handleSelectQuiz = useCallback((id) => {
    setSelectedQuizId(id);
    setGameState('playing');
  }, []);

  const handleShowLeaderboard = useCallback(() => {
    setGameState('leaderboard');
  }, []);

  // Function to add a new quiz to the local state array
  const handleSaveQuiz = useCallback((newQuiz) => {
    setQuizzes(prev => [...prev, newQuiz]);
  }, []);

  let content;

  if (gameState === 'login') {
    content = <LoginView onLogin={handleLogin} />;
  } else if (gameState === 'playing' && selectedQuiz) {
    content = (
      <QuizTaker 
        quiz={selectedQuiz}
        username={username}
        onFinish={handleScoreSubmission}
      />
    );
  } else if (gameState === 'creating') {
    content = (
      <QuizCreator
        onSaveQuiz={handleSaveQuiz} 
        onFinish={() => setGameState('home')}
      />
    );
  } else if (gameState === 'leaderboard') {
    content = (
      <LeaderboardView
        leaderboard={leaderboard}
        quizzes={quizzes}
        onFinish={() => setGameState('home')}
      />
    );
  } else if (gameState === 'home') {
    content = (
      <HomeView 
        quizzes={quizzes} 
        username={username}
        onSelectQuiz={handleSelectQuiz}
        onCreateNew={handleStartCreation}
        onShowLeaderboard={handleShowLeaderboard}
      />
    );
  } else {
    content = <div className="message">Application error or unexpected state.</div>;
  }

  return (
    <>
      {/* Injecting CSS into the DOM */}
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className={`app-container ${theme}-theme`}>
        <div className="app-header">
            <h1 style={{ flexGrow: 1, textAlign: 'center' }}>QuizFest: The GK Odyssey</h1>
            {(gameState !== 'login') && (
                <button 
                    className="theme-toggle-button" 
                    onClick={toggleTheme} 
                    aria-label="Toggle Light/Dark Mode"
                    style={{ position: 'absolute', top: '30px', right: '40px' }} 
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            )}
        </div>
        
        {content}
      </div>
    </>
  );
}
