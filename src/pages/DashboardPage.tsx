import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import { 
  UserGroupIcon, 
  UserIcon,
  BellIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Course {
  id: number;
  name: string;
  code: string;
  credit: number;
  student_count?: number;
}

interface SubmittedResult {
  id: number;
  course_id: number;
  submitted_at: string;
  status: string;
  lecturer_id: number;
  course_name?: string;
}

function DigitalClockCalendar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const year = now.getFullYear();
  const month = now.toLocaleString('default', { month: 'long' });
  const monthNum = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, monthNum, 1).getDay();
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Digital Clock */}
      <div className="mb-1 flex flex-col items-center">
        <span className="text-2xl font-mono font-bold text-gray-800 tracking-widest drop-shadow">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className="text-xs text-gray-600 mt-1">{month} {year}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <CalendarDaysIcon className="h-5 w-5 text-gray-600" />
        <span className="text-base font-bold text-gray-800">Calendar</span>
      </div>
      {/* Visual calendar grid (smaller, real month, shorter) */}
      <div className="w-full grid grid-cols-7 gap-0.5 text-center">
        <span className="text-[10px] text-gray-600">S</span>
        <span className="text-[10px] text-gray-600">M</span>
        <span className="text-[10px] text-gray-600">T</span>
        <span className="text-[10px] text-gray-600">W</span>
        <span className="text-[10px] text-gray-600">T</span>
        <span className="text-[10px] text-gray-600">F</span>
        <span className="text-[10px] text-gray-600">S</span>
        {days.map((d, i) =>
          d ? (
            <span
              key={i}
              className={`rounded-full w-6 h-6 flex items-center justify-center mx-auto my-0.5 text-gray-700 text-xs ${d === today ? 'bg-blue-600 text-white font-bold shadow-lg' : 'hover:bg-gray-200 transition-colors'}`}
            >
              {d}
            </span>
          ) : (
            <span key={i} />
          )
        )}
      </div>
    </div>
  );
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [submittedResults, setSubmittedResults] = useState<SubmittedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<{ id: number | null; type: 'approve' | 'reject' | null }>({ id: null, type: null });
  const [notifications, setNotifications] = useState([]);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | null;
    resultId: number | null;
    courseName: string;
  }>({
    isOpen: false,
    type: null,
    resultId: null,
    courseName: ''
  });
  const bellRef = useRef<HTMLDivElement>(null);
  const [secondConfirm, setSecondConfirm] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch courses for lecturers
        if (user?.is_lecturer) {
          const coursesResponse = await api.get('/result-system/courses/');
          setCourses(coursesResponse.data.results || []);
        }
        
        // Fetch submitted results for DRO/FRO/Correction Officer
        if (user?.is_dro || user?.is_fro || user?.is_co) {
          const resultsResponse = await api.get('/result-system/submitted-results/');
          const submittedResults = resultsResponse.data.results || [];

          // Fetch course names
          const resultsWithCourseDetails = await Promise.all(
            submittedResults.map(async (result: any) => {
              try {
                const courseResponse = await api.get(`/result-system/courses/${result.course_id}/`);
                return {
                  ...result,
                  status: result.status || result.result_status, // ensure status is present
                  course_name: courseResponse.data.name
                };
              } catch {
                return {
                  ...result,
                  status: result.status || result.result_status, // ensure status is present
                  course_name: `Course ${result.course_id}`
                };
              }
            })
          );
          setSubmittedResults(resultsWithCourseDetails);
        }
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        console.error("Full error object:", JSON.stringify(err, null, 2));
        console.error("Response data:", err.response?.data);
        console.error("Response status:", err.response?.status);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  useEffect(() => {
    // Fetch notifications
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notification/');
        setNotifications(response.data.results || []);
      } catch {
        setNotifications([]);
      }
    };
    fetchNotifications();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !(bellRef.current as any).contains(event.target)) {
        // setShowDropdown(false); // This line is removed as per the edit hint
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Count results by status for DRO/FRO/CO
  const approvedCount = submittedResults.filter(r => r.status === 'A').length;
  const pendingCount = submittedResults.filter(r => r.status === 'P_D' || r.status === 'P_F').length;
  const rejectedCount = submittedResults.filter(r => r.status === 'R').length;
  const draftCount = submittedResults.filter(r => r.status === 'D').length;
  const totalCount = submittedResults.length;

  // For CO, only show Approved and Edited (Draft)
  let statCards = [
    { label: 'Total', value: totalCount, color: 'text-gray-800', bg: 'bg-gray-100/80' },
    { label: 'Approved', value: approvedCount, color: 'text-gray-700', bg: 'bg-green-50/80' },
    { label: 'Pending', value: pendingCount, color: 'text-gray-700', bg: 'bg-yellow-50/80' },
    { label: 'Rejected', value: rejectedCount, color: 'text-gray-700', bg: 'bg-red-50/80' },
  ];
  let chartData = [
    { name: 'Approved', value: approvedCount, color: '#10b981' },
    { name: 'Pending', value: pendingCount, color: '#f59e0b' },
    { name: 'Rejected', value: rejectedCount, color: '#ef4444' },
  ];
  if (user?.is_co) {
    statCards = [
      { label: 'Total', value: totalCount, color: 'text-gray-800', bg: 'bg-gray-100/80' },
      { label: 'Approved', value: approvedCount, color: 'text-gray-700', bg: 'bg-green-50/80' },
      { label: 'Edited', value: draftCount, color: 'text-gray-700', bg: 'bg-blue-50/80' },
    ];
    chartData = [
      { name: 'Approved', value: approvedCount, color: '#10b981' },
      { name: 'Edited', value: draftCount, color: '#3b82f6' },
    ];
  }

  let gridCols = 'md:grid-cols-4';
  if (user?.is_co) gridCols = 'md:grid-cols-3';

  // Debug: print user object and roles
  console.log('DashboardPage user:', user);
  console.log('is_lecturer:', user?.is_lecturer, 'is_dro:', user?.is_dro, 'is_fro:', user?.is_fro, 'is_co:', user?.is_co);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Error</div>
          <div className="text-muted">{error}</div>
        </div>
      </div>
    );
  }

  // Helper: Reset confirmation dialog
  function resetConfirmation(
    setConfirmationDialog: React.Dispatch<React.SetStateAction<{ isOpen: boolean; type: 'approve' | 'reject' | null; resultId: number | null; courseName: string }>>,
    setSecondConfirm: React.Dispatch<React.SetStateAction<boolean>>
  ) {
    setConfirmationDialog({ isOpen: false, type: null, resultId: null, courseName: '' });
    setSecondConfirm(false);
  }

  return (
    <div className="p-6 lg:ml-64">
      {/* Floating Welcome Card */}
      <div className="w-full mb-10">
        <div className="bg-blue-600/90 backdrop-blur-md rounded-[2rem] shadow-lg px-8 py-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto relative">
          {/* Notification Bell */}
          <div className="absolute top-6 right-8" ref={bellRef}>
            <button
              className="relative focus:outline-none"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              <BellIcon className="h-7 w-7 text-blue-100 hover:text-white transition-colors" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow">Welcome back, {user?.username}!</h1>
          <p className="text-blue-100 text-lg">
            {user?.is_lecturer && !user?.is_dro && 'Manage your courses and enter student results'}
            {user?.is_dro && user?.is_lecturer && 'Manage your assigned courses and enter student results. You can also create results for courses with inactive lecturers.'}
            {user?.is_dro && !user?.is_lecturer && 'Review and approve submitted results. You can also create results for courses with inactive lecturers.'}
            {user?.is_fro && 'Review and process submitted results'}
            {user?.is_co && 'Handle result corrections and updates'}
          </p>
        </div>
      </div>
      {/* Success Notification */}
      {actionSuccess && (
        <div className="mb-6 bg-green-900/50 border border-green-600 rounded-lg p-4">
          <p className="text-green-200">{actionSuccess}</p>
        </div>
      )}

      {/* DRO/FRO/CO Dashboard: Show analytics dashboard for all DRO/FRO/CO users */}
      {(user?.is_dro || user?.is_fro || user?.is_co) && (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col lg:flex-row gap-8 p-0 rounded-3xl lg:rounded-[2rem] m-4 shadow-2xl">
          {/* Main Content Left: Stats and Charts */}
          <div className="flex-1 flex flex-col gap-8 p-10 bg-white/90 rounded-3xl shadow-2xl">
            {/* Success Notification */}
            {actionSuccess && (
              <div className="mb-6 bg-green-100 border border-green-600 rounded-lg p-4">
                <p className="text-green-800">{actionSuccess}</p>
              </div>
            )}
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-gray-800 mb-1 tracking-wide">Result Analytics Overview</h2>
              <p className="text-gray-600 text-base">Visual summary of all submitted results.</p>
            </div>
            {/* Digital Stat Cards */}
            <div className={`grid grid-cols-2 ${gridCols} gap-8 mb-8`}>
              {statCards.map((card) => (
                <div key={card.label} className={`backdrop-blur-xl ${card.bg} border border-gray-200 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[120px]`}>
                  <span className={`text-4xl font-extrabold ${card.color} drop-shadow-lg`}>{card.value}</span>
                  <span className="text-gray-600 text-base mt-3 tracking-wide">{card.label}</span>
                </div>
              ))}
            </div>
            {/* Status Bar Chart */}
            <div className="w-full max-w-2xl mx-auto mb-6 backdrop-blur-xl bg-white/80 border border-gray-200 rounded-3xl shadow-lg p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#374151" tick={{ fontSize: 14 }} />
                  <YAxis stroke="#374151" tick={{ fontSize: 14 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #e5e7eb', borderRadius: '1rem', color: '#374151', fontWeight: 'bold', fontSize: '1rem' }} labelStyle={{ color: '#374151', fontWeight: 'bold' }} itemStyle={{ color: '#374151', fontWeight: 'bold' }} cursor={{ fill: 'rgba(229,231,235,0.3)' }} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}> {chartData.map((entry, idx) => (<Cell key={`bar-cell-${idx}`} fill={entry.color} />))} </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Status Pie Chart */}
            {/* (Pie chart removed as per request) */}
          </div>
          {/* Right Panel: Profile and Calendar */}
          <div className="w-full lg:w-96 flex flex-col gap-8 p-8">
            {/* Profile Card */}
            <div className="backdrop-blur-xl bg-white/90 border border-gray-200 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-4">
                <UserIcon className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">{user?.username}</h3>
              <p className="text-blue-600 text-sm mb-2">
                {user?.is_dro && user?.is_lecturer && 'DRO & Lecturer'}
                {user?.is_dro && !user?.is_lecturer && 'Departmental Results Officer'}
                {user?.is_fro && 'Faculty Results Officer'}
                {user?.is_co && 'Correction Officer'}
              </p>
              <div className="flex flex-col gap-1 text-blue-700 text-xs">
                <span>Role: {user?.is_dro ? 'DRO' : user?.is_fro ? 'FRO' : user?.is_co ? 'CO' : ''}</span>
                {user?.is_dro && user?.is_lecturer && <span>Also: Lecturer</span>}
              </div>
            </div>
            {/* Digital Clock and Calendar Card (visual only) */}
            <div className="backdrop-blur-xl bg-white/90 border border-gray-200 rounded-3xl shadow-2xl p-8 w-full flex flex-col items-center">
              <DigitalClockCalendar />
            </div>
          </div>
        </div>
      )}

      {/* Lecturer Dashboard: Show analytics dashboard for lecturers */}
      {user?.is_lecturer && !user?.is_dro && !user?.is_fro && !user?.is_co && (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col lg:flex-row gap-8 p-0 rounded-3xl lg:rounded-[2rem] m-4 shadow-2xl">
          {/* Main Content Left: Stats and Charts */}
          <div className="flex-1 flex flex-col gap-8 p-10 bg-white/90 rounded-3xl shadow-2xl">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-gray-800 mb-1 tracking-wide">Course Analytics Overview</h2>
              <p className="text-gray-600 text-base">Visual summary of your assigned courses and results.</p>
            </div>
            {/* Digital Stat Cards for Lecturers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div className="backdrop-blur-xl bg-blue-50/80 border border-blue-200 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
                <span className="text-4xl font-extrabold text-blue-600 drop-shadow-lg">{courses.length}</span>
                <span className="text-gray-600 text-base mt-3 tracking-wide">Total Courses</span>
              </div>
              <div className="backdrop-blur-xl bg-green-50/80 border border-green-200 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
                <span className="text-4xl font-extrabold text-green-600 drop-shadow-lg">
                  {courses.reduce((total, course) => total + (course.student_count || 0), 0)}
                </span>
                <span className="text-gray-600 text-base mt-3 tracking-wide">Total Students</span>
              </div>
              <div className="backdrop-blur-xl bg-purple-50/80 border border-purple-200 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
                <span className="text-4xl font-extrabold text-purple-600 drop-shadow-lg">
                  {courses.filter(course => course.student_count && course.student_count > 0).length}
                </span>
                <span className="text-gray-600 text-base mt-3 tracking-wide">Active Courses</span>
              </div>
              <div className="backdrop-blur-xl bg-orange-50/80 border border-orange-200 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
                <span className="text-4xl font-extrabold text-orange-600 drop-shadow-lg">
                  {courses.reduce((total, course) => total + (course.credit || 0), 0)}
                </span>
                <span className="text-gray-600 text-base mt-3 tracking-wide">Total Credits</span>
              </div>
            </div>
            {/* Course Distribution Chart */}
            <div className="w-full max-w-2xl mx-auto mb-6 backdrop-blur-xl bg-white/80 border border-gray-200 rounded-3xl shadow-lg p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={courses.map(course => ({ name: course.code, students: course.student_count || 0 }))} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#374151" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#374151" tick={{ fontSize: 14 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #e5e7eb', borderRadius: '1rem', color: '#374151', fontWeight: 'bold', fontSize: '1rem' }} labelStyle={{ color: '#374151', fontWeight: 'bold' }} itemStyle={{ color: '#374151', fontWeight: 'bold' }} cursor={{ fill: 'rgba(229,231,235,0.3)' }} />
                  <Bar dataKey="students" radius={[12, 12, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
          {/* Right Panel: Profile and Calendar */}
          <div className="w-full lg:w-96 flex flex-col gap-8 p-8">
            {/* Profile Card */}
            <div className="backdrop-blur-xl bg-white/90 border border-gray-200 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-4">
                <UserIcon className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">{user?.username}</h3>
              <p className="text-blue-600 text-sm mb-2">Lecturer</p>
              <div className="flex flex-col gap-1 text-blue-700 text-xs">
                <span>Role: Lecturer</span>
                <span>Courses: {courses.length}</span>
              </div>
            </div>
            {/* Digital Clock and Calendar Card */}
            <div className="backdrop-blur-xl bg-white/90 border border-gray-200 rounded-3xl shadow-2xl p-8 w-full flex flex-col items-center">
              <DigitalClockCalendar />
            </div>
          </div>
        </div>
      )}

      {/* No Role Dashboard */}
              {!user?.is_lecturer && !user?.is_dro && !user?.is_fro && !user?.is_co && (
        <div className="text-center py-12">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="h-8 w-8 text-muted" />
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">No Role Assigned</h2>
          <p className="text-muted">Please contact your administrator to assign a role.</p>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmationDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-gray-800 rounded-[2rem] p-8 max-w-md w-full mx-4 border border-gray-700">
            <div className="text-center">
              <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${
                confirmationDialog.type === 'approve' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {confirmationDialog.type === 'approve' ? (
                  <CheckCircleIcon className="h-8 w-8 text-green-400" />
                ) : (
                  <XCircleIcon className="h-8 w-8 text-red-400" />
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {confirmationDialog.type === 'approve' ? 'Approve Results' : 'Reject Results'}
              </h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to {confirmationDialog.type === 'approve' ? 'approve' : 'reject'} the results for{' '}
                <span className="font-semibold text-white">{confirmationDialog.courseName}</span>?
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setSecondConfirm(false);
                    resetConfirmation(setConfirmationDialog, setSecondConfirm);
                  }}
                  className="px-6 py-2 rounded-full border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                {(!secondConfirm) ? (
                  <button
                    onClick={() => setSecondConfirm(true)}
                    className={`px-6 py-2 rounded-full font-semibold transition-colors ${
                      confirmationDialog.type === 'approve'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {confirmationDialog.type === 'approve' ? 'Approve' : 'Reject'}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!confirmationDialog.resultId || !confirmationDialog.type) return;
                      setActionLoading({ id: confirmationDialog.resultId, type: confirmationDialog.type });
                      try {
                        const newStatus = confirmationDialog.type === 'approve' 
                          ? (user?.is_dro ? 'P_F' : 'A') 
                          : (user?.is_dro ? 'D' : 'P_D');
                        await api.patch(`/result-system/submitted-results/${confirmationDialog.resultId}/`, { status: newStatus });
                        const msg = `${confirmationDialog.type === 'approve' ? 'Approved' : 'Rejected'} successfully`;
                        setActionSuccess(msg);
                        console.log('setActionSuccess:', msg);
                        setTimeout(() => setActionSuccess(''), 3000);
                        // Refresh data
                        const resultsResponse = await api.get('/result-system/submitted-results/');
                        const submittedResults = resultsResponse.data.results || [];
                        const resultsWithCourseDetails = await Promise.all(
                          submittedResults.map(async (result: any) => {
                            try {
                              const courseResponse = await api.get(`/result-system/courses/${result.course_id}/`);
                              return {
                                ...result,
                                status: result.status || result.result_status,
                                course_name: courseResponse.data.name
                              };
                            } catch {
                              return {
                                ...result,
                                status: result.status || result.result_status,
                                course_name: `Course ${result.course_id}`
                              };
                            }
                          })
                        );
                        setSubmittedResults(resultsWithCourseDetails);
                      } catch (err) {
                        setActionSuccess(`Failed to ${confirmationDialog.type}`);
                        setTimeout(() => setActionSuccess(''), 2000);
                      } finally {
                        setActionLoading({ id: null, type: null });
                        resetConfirmation(setConfirmationDialog, setSecondConfirm);
                      }
                    }}
                    className={`px-6 py-2 rounded-full font-semibold transition-colors ${
                      confirmationDialog.type === 'approve'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                    disabled={actionLoading.id === confirmationDialog.resultId && actionLoading.type === confirmationDialog.type}
                  >
                    {actionLoading.id === confirmationDialog.resultId && actionLoading.type === confirmationDialog.type ? (
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block mr-2 align-middle"></span>
                    ) : null}
                    Yes, {confirmationDialog.type === 'approve' ? 'Approve' : 'Reject'}
                  </button>
                )}
              </div>
              {secondConfirm && (
                <div className="mt-4 text-yellow-200 text-sm font-semibold">Please confirm this action. This cannot be undone.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;