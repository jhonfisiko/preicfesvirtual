import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EstadisticasAlumno = ({ userId }) => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase
        .from('user_answers')
        .select('is_correct')
        .eq('user_id', userId);
      if (!error) {
        const total = data.length;
        const correct = data.filter(a => a.is_correct).length;
        const precision = total > 0 ? Math.round((correct / total) * 100) : 0;
        setStats({ total, correct, precision });
      }
    };
    fetchStats();
  }, [userId]);
  if (!stats) return <span>Cargando...</span>;
  // Barra de progreso con color
  let color = '#e53e3e'; // rojo
  if (stats.precision >= 80) color = '#38a169'; // verde
  else if (stats.precision >= 50) color = '#ed8936'; // naranja
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{
        background: '#e2e8f0',
        borderRadius: 8,
        height: 16,
        width: '100%',
        marginBottom: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${stats.precision}%`,
          background: color,
          height: '100%',
          transition: 'width 0.5s',
        }}></div>
      </div>
      <span style={{ fontWeight: 600 }}>{stats.precision}% precisión</span>
      <span style={{ marginLeft: 8, fontSize: 12, color: '#718096' }}>
        ({stats.correct}/{stats.total} correctas)
      </span>
    </div>
  );
};

const AdminDashboard = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState('');
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentStats, setStudentStats] = useState(null);

  useEffect(() => {
    const fetchAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user && user.email.startsWith('rector@')) {
        // Mostrar todos los estudiantes, sin filtrar por colegio
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, name, grade, school, users:auth.users(email)');
        if (!error) setStudents(data);
      }
      setLoading(false);
    };
    fetchAdmin();
  }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const filteredStudents = students.filter(
    (stu) =>
      stu.name?.toLowerCase().includes(search.toLowerCase()) ||
      stu.users?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewStats = async (student) => {
    setSelectedStudent(student);
    // Obtener estadísticas detalladas
    const { data, error } = await supabase
      .from('user_answers')
      .select('is_correct, question_id, answered_at')
      .eq('user_id', student.id);
    if (!error) {
      const total = data.length;
      const correct = data.filter(a => a.is_correct).length;
      const incorrect = total - correct;
      const precision = total > 0 ? Math.round((correct / total) * 100) : 0;
      setStudentStats({ total, correct, incorrect, precision, answers: data });
    }
  };

  if (loading) return <div style={{textAlign:'center',marginTop:40}}>Cargando...</div>;
  if (!user || !user.email.startsWith('rector@')) return <div style={{textAlign:'center',marginTop:40}}>No autorizado</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <h2 style={{marginBottom:24, color:'#2d3748'}}>Todos los estudiantes</h2>
      <input
        type="text"
        placeholder="Buscar por nombre o correo..."
        value={search}
        onChange={handleSearch}
        style={{ marginBottom: 24, padding: 10, width: 320, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16 }}
      />
      <div style={{overflowX:'auto', borderRadius:12, boxShadow:'0 2px 12px #0001', background:'#fff'}}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
        <thead style={{background:'#f5f7fa'}}>
          <tr style={{color:'#4a5568', fontWeight:700}}>
            <th style={{padding:'14px 8px'}}>Nombre</th>
            <th style={{padding:'14px 8px'}}>Correo</th>
            <th style={{padding:'14px 8px'}}>Grado</th>
            <th style={{padding:'14px 8px'}}>Estadísticas</th>
            <th style={{padding:'14px 8px'}}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map((stu) => (
            <tr key={stu.id} style={{borderBottom:'1px solid #e2e8f0', background:'#fff', transition:'background 0.2s'}}>
              <td style={{padding:'12px 8px'}}>{stu.name}</td>
              <td style={{padding:'12px 8px'}}>{stu.users?.email || 'Sin correo'}</td>
              <td style={{padding:'12px 8px'}}>{stu.grade}</td>
              <td style={{padding:'12px 8px'}}><EstadisticasAlumno userId={stu.id} /></td>
              <td style={{padding:'12px 8px'}}>
                <button onClick={() => handleViewStats(stu)} style={{background:'#667eea',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',fontWeight:600,cursor:'pointer',boxShadow:'0 2px 8px #667eea22'}}>Ver detalle</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {/* Modal de detalle de estudiante */}
      {selectedStudent && studentStats && (
        <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow:'0 8px 32px #0002', padding: 32, maxWidth: 500, width:'90%' }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0, color:'#2d3748'}}>Detalle de {selectedStudent.name}</h3>
              <button onClick={() => { setSelectedStudent(null); setStudentStats(null); }} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:'#718096'}}>✕</button>
            </div>
            <p style={{margin:'8px 0'}}><strong>Correo:</strong> {selectedStudent.users?.email || 'Sin correo'}</p>
            <p style={{margin:'8px 0'}}><strong>Grado:</strong> {selectedStudent.grade}</p>
            <p style={{margin:'8px 0'}}><strong>Preguntas respondidas:</strong> {studentStats.total}</p>
            <p style={{margin:'8px 0'}}><strong>Correctas:</strong> {studentStats.correct}</p>
            <p style={{margin:'8px 0'}}><strong>Incorrectas:</strong> {studentStats.incorrect}</p>
            <p style={{margin:'8px 0'}}><strong>Precisión:</strong> {studentStats.precision}%</p>
            <h4 style={{marginTop:24,marginBottom:8,color:'#667eea'}}>Respuestas recientes:</h4>
            <ul style={{maxHeight:180,overflowY:'auto',paddingLeft:18}}>
              {studentStats.answers.slice(-10).reverse().map((a, i) => (
                <li key={i} style={{marginBottom:4}}>
                  Pregunta: <span style={{fontFamily:'monospace'}}>{a.question_id}</span> | Correcta: {a.is_correct ? '✅' : '❌'} | Fecha: {a.answered_at?.slice(0, 16).replace('T', ' ')}
                </li>
              ))}
            </ul>
            <div style={{textAlign:'right',marginTop:16}}>
              <button onClick={() => { setSelectedStudent(null); setStudentStats(null); }} style={{background:'#667eea',color:'#fff',border:'none',borderRadius:6,padding:'8px 24px',fontWeight:600,cursor:'pointer'}}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 