import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('11°');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!name || !school || !grade) {
      setError('Por favor completa todos los campos.');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;
      // Crear perfil en user_profiles
      const user = data.user || (data.session && data.session.user);
      if (user) {
        const { error: profileError } = await supabase.from('user_profiles').upsert({
          id: user.id,
          name,
          school,
          grade
        });
        if (profileError) throw profileError;
      }
      setSuccess('¡Cuenta creada exitosamente! Revisa tu email para confirmar tu cuenta.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <span className="logo-icon">🎓</span>
            <h1>PreICFES Virtual</h1>
          </div>
          <p className="subtitle">Únete a nuestra comunidad educativa</p>
        </div>
        <form onSubmit={handleRegister} className="login-form">
          <div className="form-group">
            <label htmlFor="name">Nombre completo</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="school">Colegio</label>
            <input
              type="text"
              id="school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Nombre del colegio"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="grade">Grado</label>
            <input
              type="text"
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Ej: 11°"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="form-input"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>
        <div className="login-footer">
          <p>¿Ya tienes cuenta? <a href="/login" className="link">Inicia sesión aquí</a></p>
        </div>
      </div>
      <div className="background-decoration">
        <div className="floating-shapes">
          <div className="shape shape-1">📚</div>
          <div className="shape shape-2">✏️</div>
          <div className="shape shape-3">🎯</div>
          <div className="shape shape-4">📝</div>
          <div className="shape shape-5">🔬</div>
          <div className="shape shape-6">📊</div>
        </div>
      </div>
    </div>
  );
};

export default Register; 