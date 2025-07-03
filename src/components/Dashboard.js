import React, { useState, useEffect, useRef } from 'react';
import { supabase, getSubjects, getQuestionsBySubject, saveUserAnswer, getUserStatsBySubject, getUserOverallStats } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState({
    overallProgress: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    subjectsCompleted: 0
  });
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerStatus, setAnswerStatus] = useState(null); // 'correct' | 'incorrect' | null
  const [showExplanation, setShowExplanation] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [examTimer, setExamTimer] = useState(null);
  const [examSettings, setExamSettings] = useState({ timeLimit: 30 });
  const [examActive, setExamActive] = useState(false);
  const timerRef = useRef();
  const navigate = useNavigate();
  const [subjectStats, setSubjectStats] = useState({});
  const [examSummary, setExamSummary] = useState(null);
  const [examAnswers, setExamAnswers] = useState([]); // Guardar respuestas del simulacro
  const [isPremium, setIsPremium] = useState(false);

  // Cargar usuario y materias al inicio
  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSubjects();
      fetchOverallStats();
      // Detectar si el usuario es premium
      const checkPremium = async () => {
        const { data } = await supabase
          .from('user_premium_access')
          .select('user_id')
          .eq('user_id', user.id)
          .limit(1);
        setIsPremium(data && data.length > 0);
      };
      checkPremium();
    }
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (user && subjects.length > 0) {
      fetchAllSubjectStats();
    }
    // eslint-disable-next-line
  }, [user, subjects]);

  // Temporizador de examen
  useEffect(() => {
    if (examActive && examMode) {
      timerRef.current = setInterval(() => {
        setExamTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setExamActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [examActive, examMode]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      setSubjects([]);
    }
  };

  const fetchQuestions = async (subject) => {
    try {
      const data = await getQuestionsBySubject(subject.id);
      setQuestions(data);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      setAnswerStatus(null);
      setShowExplanation(false);
    } catch (error) {
      setQuestions([]);
    }
  };

  const fetchOverallStats = async () => {
    try {
      const stats = await getUserOverallStats();
      setStats((prev) => ({
        ...prev,
        overallProgress: stats.percentage,
        questionsAnswered: stats.total,
        correctAnswers: stats.correct
      }));
    } catch (error) {
      // No actualizar
    }
  };

  const fetchSubjectStats = async (subjectId) => {
    try {
      const stats = await getUserStatsBySubject(subjectId);
      return stats;
    } catch (error) {
      return { total: 0, correct: 0, percentage: 0 };
    }
  };

  const fetchAllSubjectStats = async () => {
    const statsObj = {};
    for (const subject of subjects) {
      const stats = await fetchSubjectStats(subject.id);
      statsObj[subject.id] = stats;
    }
    setSubjectStats(statsObj);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSubjectClick = async (subject) => {
    console.log('Materia seleccionada:', subject); // DEPURACIÓN: Verifica el id
    setCurrentSubject(subject);
    await fetchQuestions(subject);
    setShowQuestionModal(true);
  };

  const handleAnswerSelect = async (optionIndex) => {
    if (selectedOption !== null) return; // No permitir doble respuesta
    setSelectedOption(optionIndex);
    const question = questions[currentQuestionIndex];
    const correctLetter = question.correct_answer;
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
    const isCorrect = optionIndex === correctIndex;
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    setShowExplanation(true);
    // Guardar respuesta en Supabase
    try {
      await saveUserAnswer(question.id, ['A', 'B', 'C', 'D'][optionIndex], isCorrect);
      fetchOverallStats();
    } catch (error) {
      // Manejar error
    }
    // Guardar respuesta local si está en modo examen
    if (examMode) {
      setExamAnswers(prev => ([
        ...prev,
        {
          questionId: question.id,
          selected: optionIndex,
          correct: correctIndex,
          isCorrect
        }
      ]));
    }
  };

  const closeQuestionModal = () => {
    setShowQuestionModal(false);
    setCurrentSubject(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setAnswerStatus(null);
    setShowExplanation(false);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setAnswerStatus(null);
      setShowExplanation(false);
    } else {
      closeQuestionModal();
    }
  };

  // Modo examen
  const startExamMode = async () => {
    setExamMode(true);
    setExamTimer(examSettings.timeLimit * 60); // en segundos
    setExamActive(true);
    // Cargar preguntas de todas las materias
    let allQuestions = [];
    for (const subject of subjects) {
      try {
        const qs = await getQuestionsBySubject(subject.id);
        allQuestions = allQuestions.concat(qs);
      } catch {}
    }
    // Mezclar preguntas
    allQuestions = allQuestions.sort(() => Math.random() - 0.5);
    setQuestions(allQuestions);
    setCurrentQuestionIndex(0);
    setShowQuestionModal(true);
    setCurrentSubject(null);
    setSelectedOption(null);
    setAnswerStatus(null);
    setShowExplanation(false);
    setExamAnswers([]); // Limpiar respuestas del simulacro
  };

  const stopExamMode = () => {
    setExamMode(false);
    setExamTimer(null);
    setExamActive(false);
    closeQuestionModal();
  };

  // Cuando se acaba el tiempo
  useEffect(() => {
    if (examMode && examTimer === 0) {
      setExamActive(false);
      setShowQuestionModal(false);
      setExamMode(false);
      setExamTimer(null);
      handleExamSummary();
    }
  }, [examTimer, examMode]);

  // Al finalizar el simulacro manualmente
  const finishExam = () => {
    setExamActive(false);
    setShowQuestionModal(false);
    setExamMode(false);
    setExamTimer(null);
    handleExamSummary();
  };

  // Calcular resumen del simulacro
  const handleExamSummary = () => {
    if (!questions || questions.length === 0) return;
    const total = questions.length;
    const answered = examAnswers.length;
    const correct = examAnswers.filter(a => a.isCorrect).length;
    const incorrect = answered - correct;
    const precision = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    setExamSummary({
      total,
      answered,
      correct,
      incorrect,
      precision,
      timeUsed: examSettings.timeLimit * 60 - (examTimer || 0)
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className={isPremium ? 'premium-dark dashboard-container' : 'dashboard-container'}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="user-profile">
          <div className="user-avatar">
            <span className="avatar-icon">👤</span>
          </div>
          <h2 className="user-name">{user?.email?.split('@')[0] || 'Usuario'}</h2>
          <p className="user-email">{user?.email}</p>
        </div>

        <div className="user-details">
          <div className="detail-item">
            <span className="detail-label">Preguntas respondidas:</span>
            <span className="detail-value">{stats.questionsAnswered}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Respuestas correctas:</span>
            <span className="detail-value">{stats.correctAnswers}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Progreso general:</span>
            <span className="detail-value">{stats.overallProgress}%</span>
          </div>
        </div>

        <div className="sidebar-stats">
          <h3>Progreso General</h3>
          <div className="overall-progress">
            <div className="progress-circle">
              <div className="progress-number">{stats.overallProgress}%</div>
              <div className="progress-label">Completado</div>
            </div>
          </div>
        </div>

        <div className="logout-section">
          <button onClick={handleLogout} className="logout-button">
            <span className="logout-icon">🚪</span>
            <span className="logout-text">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Stats Section */}
        <div className="stats-section">
          <h2>Estadísticas de Rendimiento</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <h4>Preguntas Respondidas</h4>
                <span className="stat-percentage">{stats.questionsAnswered}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(stats.questionsAnswered / 200) * 100}%`,
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                  }}
                ></div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <h4>Precisión</h4>
                <span className="stat-percentage">{stats.questionsAnswered > 0 ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100) : 0}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${stats.questionsAnswered > 0 ? (stats.correctAnswers / stats.questionsAnswered) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #48bb78 0%, #38a169 100%)'
                  }}
                ></div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <h4>Progreso General</h4>
                <span className="stat-percentage">{stats.overallProgress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${stats.overallProgress}%`,
                    background: 'linear-gradient(90deg, #ed8936 0%, #dd6b20 100%)'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Subjects Section */}
        <div className="subjects-section">
          <h2>Materias Disponibles</h2>
          <div className="subjects-grid">
            {subjects.map((subject) => {
              const stats = subjectStats[subject.id] || { total: 0, correct: 0, percentage: 0 };
              return (
                <div 
                  key={subject.id} 
                  className="subject-card"
                  onClick={() => handleSubjectClick(subject)}
                >
                  <div className="subject-icon">{subject.icon}</div>
                  <h3>{subject.name}</h3>
                  <p>{subject.description}</p>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${stats.percentage}%`,
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                      }}
                    ></div>
                  </div>
                  <p className="progress-text">{stats.percentage}% de aciertos ({stats.correct}/{stats.total})</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Exam Controls */}
        <div className="exam-controls">
          {!examMode ? (
            <div className="exam-settings">
              <h4>Configurar Examen Simulado</h4>
              <div className="time-settings">
                <label>
                  Tiempo límite (minutos):
                  <input
                    type="number"
                    className="time-input"
                    value={examSettings.timeLimit}
                    onChange={(e) => setExamSettings({...examSettings, timeLimit: parseInt(e.target.value)})}
                    min="10"
                    max="120"
                  />
                </label>
                <p className="time-info">Tiempo recomendado: 30-60 minutos</p>
              </div>
              <div className="exam-settings-buttons">
                <button 
                  className="start-exam-button"
                  onClick={startExamMode}
                >
                  🎯 Iniciar Examen Simulado
                </button>
                <button className="cancel-exam-button" onClick={stopExamMode}>
                  ❌ Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="exam-mode-button">
              <div className="exam-timer">
                <span className="timer-icon">⏰</span>
                <span className="timer-text">Tiempo restante: {examTimer !== null ? `${Math.floor(examTimer/60)}:${(examTimer%60).toString().padStart(2,'0')}` : `${examSettings.timeLimit}:00`}</span>
              </div>
              <button 
                className="stop-exam-button"
                onClick={finishExam}
              >
                🛑 Detener Examen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Question Modal */}
      {showQuestionModal && questions.length > 0 && (
        <div className="question-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{currentSubject ? currentSubject.name : 'Examen Simulado'}</h3>
              <button className="close-button" onClick={closeQuestionModal}>
                ✕
              </button>
            </div>
            <div className="question-number">Pregunta {currentQuestionIndex + 1} de {questions.length}</div>
            <div className="question-text">{questions[currentQuestionIndex].question}</div>
            {questions[currentQuestionIndex].image_url && (
              <div className="question-image-container">
                <img
                  src={questions[currentQuestionIndex].image_url}
                  alt="Imagen de la pregunta"
                  className="question-image"
                />
              </div>
            )}
            <div className="options-grid">
              {(() => {
                const opciones = questions[currentQuestionIndex].options; // Siempre es un array
                const correctLetter = questions[currentQuestionIndex].correct_answer;
                const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
                return opciones.map((option, index) => {
                  let buttonClass = 'option-button';
                  if (selectedOption !== null) {
                    if (index === correctIndex) buttonClass += ' correct';
                    if (index === selectedOption && selectedOption !== correctIndex) buttonClass += ' incorrect';
                  }
                  return (
                    <button
                      key={index}
                      className={buttonClass}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={selectedOption !== null}
                    >
                      {option}
                    </button>
                  );
                });
              })()}
            </div>
            {showExplanation && (
              <div className="explanation">
                <strong>Explicación:</strong> {questions[currentQuestionIndex].explanation}
              </div>
            )}
            <div className="next-button-container">
              <button className="next-button" onClick={handleNextQuestion} disabled={selectedOption === null}>
                {currentQuestionIndex < questions.length - 1 ? 'Siguiente Pregunta →' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resumen del simulacro */}
      {examSummary && (
        <div className="question-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Resumen del Simulacro</h3>
              <button className="close-button" onClick={() => setExamSummary(null)}>
                ✕
              </button>
            </div>
            <div className="question-number">Simulacro finalizado</div>
            <div className="question-text">
              <p><strong>Preguntas totales:</strong> {examSummary.total}</p>
              <p><strong>Respondidas:</strong> {examSummary.answered}</p>
              <p><strong>Correctas:</strong> {examSummary.correct}</p>
              <p><strong>Incorrectas:</strong> {examSummary.incorrect}</p>
              <p><strong>Precisión:</strong> {examSummary.precision}%</p>
              <p><strong>Tiempo usado:</strong> {Math.floor(examSummary.timeUsed/60)}:{(examSummary.timeUsed%60).toString().padStart(2,'0')} minutos</p>
            </div>
            <div className="next-button-container">
              <button className="next-button" onClick={() => setExamSummary(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 