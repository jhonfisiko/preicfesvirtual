import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arvadqcclpujilvkcsrl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydmFkcWNjbHB1amlsdmtjc3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5OTI1OTMsImV4cCI6MjA2NjU2ODU5M30.cWAnH8WbN2fhA9nGCRV5Bf4xG3tylhqbZwSS1OQdDfw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Funciones helper para interactuar con las tablas

// Obtener todas las materias
export const getSubjects = async () => {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data;
};

// Obtener preguntas por materia
export const getQuestionsBySubject = async (subjectId) => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('subject_id', subjectId)
    .order('difficulty');
  
  if (error) throw error;
  return data;
};

// Guardar respuesta del usuario
export const saveUserAnswer = async (questionId, selectedAnswer, isCorrect, timeSpent = 0) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('user_answers')
    .upsert({
      user_id: user.id,
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      time_spent: timeSpent
    }, {
      onConflict: 'user_id,question_id'
    });
  
  if (error) throw error;
  return data;
};

// Obtener estadísticas del usuario por materia
export const getUserStatsBySubject = async (subjectId) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('user_answers')
    .select(`
      is_correct,
      questions!inner(subject_id)
    `)
    .eq('user_id', user.id)
    .eq('questions.subject_id', subjectId);
  
  if (error) throw error;
  
  const total = data.length;
  const correct = data.filter(answer => answer.is_correct).length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  return { total, correct, percentage };
};

// Obtener estadísticas generales del usuario
export const getUserOverallStats = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('user_answers')
    .select('is_correct')
    .eq('user_id', user.id);
  
  if (error) throw error;
  
  const total = data.length;
  const correct = data.filter(answer => answer.is_correct).length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  return { total, correct, percentage };
};

// Crear o actualizar perfil de usuario
export const upsertUserProfile = async (profileData) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: user.id,
      ...profileData
    });
  
  if (error) throw error;
  return data;
};

// Obtener perfil del usuario
export const getUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
}; 