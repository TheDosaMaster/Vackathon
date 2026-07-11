import { useState, useEffect } from 'react';
import {
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
  LogIn,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const API = '';

interface Course {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  courseState?: string;
}

interface CourseSummary {
  course_id: string;
  name: string;
  section?: string;
  student_count: number;
  coursework_count: number;
}

interface Coursework {
  id: string;
  title?: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  state?: string;
  maxPoints?: number;
}

interface Student {
  profile?: {
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
  userId?: string;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<'summary' | 'courses' | 'coursework' | 'students'>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<CourseSummary[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [coursework, setCoursework] = useState<Coursework[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API}/classroom/courses`);
      if (res.ok) {
        setAuthenticated(true);
      } else if (res.status === 401) {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    }
  };

  const handleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/classroom/summary`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummary(data.summary || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/classroom/courses`);
      if (!res.ok) throw new Error('Failed to fetch courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoursework = async (courseId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/classroom/courses/${courseId}/coursework`);
      if (!res.ok) throw new Error('Failed to fetch coursework');
      const data = await res.json();
      setCoursework(data.coursework || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (courseId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/classroom/courses/${courseId}/students`);
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      setStudents(data.students || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = async (nextView: typeof view, course?: Course) => {
    if (course) setSelectedCourse(course);
    setView(nextView);

    if (nextView === 'summary') await fetchSummary();
    if (nextView === 'courses') await fetchCourses();
    if (nextView === 'coursework' && course) await fetchCoursework(course.id);
    if (nextView === 'students' && course) await fetchStudents(course.id);
  };

  if (!authenticated) {
    return (
      <div className="app-root">
        <div className="login-card glass-panel">
          <div className="login-icon">
            <GraduationCap size={48} />
          </div>
          <h1>Google Classroom Dashboard</h1>
          <p>Connect your Google account to view courses, students, and coursework.</p>
          <button className="btn btn-primary btn-lg" onClick={handleLogin}>
            <LogIn size={18} /> Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="glass-panel app-header">
        <div className="brand">
          <GraduationCap size={28} className="brand-icon" />
          <div>
            <h1>Classroom Dashboard</h1>
            <p>Google Classroom overview</p>
          </div>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-btn ${view === 'summary' ? 'active' : ''}`}
            onClick={() => navigateTo('summary')}
          >
            <BarChart3 size={16} /> Summary
          </button>
          <button
            className={`nav-btn ${view === 'courses' ? 'active' : ''}`}
            onClick={() => navigateTo('courses')}
          >
            <BookOpen size={16} /> Courses
          </button>
        </nav>
      </header>

      <main className="main-content glass-panel">
        {error && (
          <div className="error-banner">
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        {loading && (
          <div className="loading">
            <Loader2 size={32} className="spin" /> Loading...
          </div>
        )}

        {!loading && view === 'summary' && (
          <div className="summary-grid">
            {summary.length === 0 ? (
              <div className="empty">
                <BarChart3 size={40} className="empty-icon" />
                <p>No courses found. Click Summary to load data.</p>
                <button className="btn btn-primary" onClick={fetchSummary}>
                  <RefreshCw size={14} /> Load Summary
                </button>
              </div>
            ) : (
              summary.map((s) => (
                <div
                  key={s.course_id}
                  className="summary-card glass-panel"
                  onClick={() => navigateTo('courses')}
                >
                  <h3>{s.name}</h3>
                  {s.section && <p className="section">{s.section}</p>}
                  <div className="stats">
                    <div className="stat">
                      <Users size={16} />
                      <span className="stat-value">{s.student_count}</span>
                      <span className="stat-label">Students</span>
                    </div>
                    <div className="stat">
                      <ClipboardList size={16} />
                      <span className="stat-value">{s.coursework_count}</span>
                      <span className="stat-label">Assignments</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && view === 'courses' && (
          <div className="list-view">
            {courses.length === 0 ? (
              <div className="empty">
                <BookOpen size={40} className="empty-icon" />
                <p>No courses loaded yet.</p>
                <button className="btn btn-primary" onClick={fetchCourses}>
                  <RefreshCw size={14} /> Load Courses
                </button>
              </div>
            ) : (
              courses.map((c) => (
                <div key={c.id} className="list-card glass-panel">
                  <div className="list-card-body">
                    <h3>{c.name}</h3>
                    {c.section && <p className="section">{c.section}</p>}
                    {c.room && <p className="meta">Room: {c.room}</p>}
                  </div>
                  <div className="list-card-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigateTo('coursework', c)}
                    >
                      <ClipboardList size={14} /> Coursework
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigateTo('students', c)}
                    >
                      <Users size={14} /> Students
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && view === 'coursework' && selectedCourse && (
          <div className="list-view">
            <div className="breadcrumb">
              <button onClick={() => navigateTo('courses')}>
                <BookOpen size={14} /> Courses
              </button>
              <ChevronRight size={14} />
              <span>{selectedCourse.name} — Coursework</span>
            </div>
            {coursework.length === 0 ? (
              <div className="empty">
                <ClipboardList size={40} className="empty-icon" />
                <p>No coursework found.</p>
              </div>
            ) : (
              coursework.map((cw) => (
                <div key={cw.id} className="list-card glass-panel">
                  <div className="list-card-body">
                    <h3>{cw.title || 'Untitled'}</h3>
                    {cw.description && <p className="desc">{cw.description}</p>}
                    <div className="meta-row">
                      {cw.maxPoints && <span className="badge">{cw.maxPoints} pts</span>}
                      {cw.state && <span className={`badge badge-${cw.state.toLowerCase()}`}>{cw.state}</span>}
                      {cw.dueDate && (
                        <span className="meta">
                          Due: {cw.dueDate.month}/{cw.dueDate.day}/{cw.dueDate.year}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && view === 'students' && selectedCourse && (
          <div className="list-view">
            <div className="breadcrumb">
              <button onClick={() => navigateTo('courses')}>
                <BookOpen size={14} /> Courses
              </button>
              <ChevronRight size={14} />
              <span>{selectedCourse.name} — Students</span>
            </div>
            {students.length === 0 ? (
              <div className="empty">
                <Users size={40} className="empty-icon" />
                <p>No students found.</p>
              </div>
            ) : (
              <div className="students-table glass-panel">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.userId || i}>
                        <td>
                          {s.profile?.photoUrl ? (
                            <img src={s.profile.photoUrl} alt="" className="avatar" />
                          ) : (
                            <div className="avatar avatar-placeholder">
                              {(s.profile?.name?.givenName?.[0] || '?').toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td>{s.profile?.name?.fullName || 'Unknown'}</td>
                        <td className="meta">{s.profile?.emailAddress || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
