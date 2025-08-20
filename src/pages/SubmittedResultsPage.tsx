import React, { useEffect, useState, useRef } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CalendarIcon,
  UserIcon,
  XCircleIcon,
  BellIcon
} from "@heroicons/react/24/outline";
import { useAuth } from '../contexts/useAuth';

// Extend Window interface to include our global functions
declare global {
  interface Window {
    updateCourseDraftStatus: (courseId: number, status: string) => void;
  }
}

interface SubmittedResult {
  id: number;
  course_id: number;
  submitted_at: string;
  status: string;
  lecturer_id: number;
  course_name?: string; // We'll fetch this separately
  lecturer?: {
    id: number;
    name: string;
    isActive: boolean;
  };
}

const SubmittedResultsPage: React.FC = () => {
  const [results, setResults] = useState<SubmittedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<{ id: number | null; type: 'approve' | 'reject' | null }>({ id: null, type: null });
  const [actionSuccess, setActionSuccess] = useState("");
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef<HTMLDivElement>(null);

  // Function to set status to Correction (C) - for COs only
  const setStatusToCorrection = async (resultId: number) => {
    try {
      setActionLoading({ id: resultId, type: 'approve' }); // Use 'approve' type for loading state
      await api.patch(`/result-system/submitted-results/${resultId}/`, { status: 'C' });
      setActionSuccess("Result marked as Correction (C) successfully!");
      setTimeout(() => setActionSuccess(''), 3000);
      await fetchResults(); // Refresh the results list
    } catch (err: any) {
      let apiError = "Failed to mark result as Correction (C).";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setActionSuccess(apiError);
      setTimeout(() => setActionSuccess(''), 3000);
      console.error("Failed to mark result as Correction (C):", err);
    } finally {
      setActionLoading({ id: null, type: null });
    }
  };

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
    // if (showDropdown) { // This line is removed as per the edit hint
    //   document.addEventListener('mousedown', handleClickOutside); // This line is removed as per the edit hint
    // } else { // This line is removed as per the edit hint
    //   document.removeEventListener('mousedown', handleClickOutside); // This line is removed as per the edit hint
    // } // This line is removed as per the edit hint
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // This line is removed as per the edit hint

    const fetchResults = async () => {
      try {
        setLoading(true);
        // Try to get all results first, fall back to submitted-results if that fails
        let response;
        try {
          response = await api.get("/result-system/results/");
        } catch (err) {
          // Fallback to submitted-results endpoint with include_drafts parameter
          response = await api.get("/result-system/submitted-results/?include_drafts=true");
        }
        const submittedResults = response.data.results || [];
        const resultsWithCourseDetails = await Promise.all(
          submittedResults.map(async (result: any) => {
            try {
              const courseResponse = await api.get(`/result-system/courses/${result.course_id}/`);
              return {
                ...result,
                course_name: courseResponse.data.name,
                lecturer: courseResponse.data.lecturer
              };
            } catch (err) {
              return {
                ...result,
                course_name: `Course ${result.course_id}`,
                lecturer: undefined
              };
            }
          })
        );
        
        setResults(resultsWithCourseDetails);
      } catch (err: any) {
        setError("Failed to load submitted results.");
      } finally {
        setLoading(false);
      }
    };

  // Helper: Reset confirmation dialog
  function resetConfirmation() {
    setConfirmationDialog({ isOpen: false, type: null, resultId: null, courseName: '' });
  }

  useEffect(() => {
    fetchResults();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'A': // Approved
        return 'status-success';
      case 'P_D': // Pending Department
      case 'P_F': // Pending Faculty
        return 'status-warning';
      case 'R': // Rejected
        return 'status-error';
      case 'D': // Draft
        return 'status-info';
      default:
        return 'status-warning';
    }
  };

  const getStatusIcon = (status: string, small = false) => {
    const size = small ? 'h-2 w-2' : 'h-5 w-5';
    switch (status) {
      case 'A': // Approved
        return <CheckCircleIcon className={`${size} text-green-400`} />;
      case 'P_D': // Pending Department
      case 'P_F': // Pending Faculty
        return <ClockIcon className={`${size} text-yellow-400`} />;
      case 'R': // Rejected
        return <ExclamationTriangleIcon className={`${size} text-red-400`} />;
      case 'D': // Draft
        return <DocumentTextIcon className={`${size} text-blue-400`} />;
      default:
        return <ClockIcon className={`${size} text-yellow-400`} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'A':
        return 'Approved';
      case 'P_D':
        return 'Pending Department';
      case 'P_F':
        return 'Pending Faculty';
      case 'R':
        return 'Rejected';
      case 'D':
        return 'Draft';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="lg:ml-64 p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lg:ml-64 p-6">
        <div className="text-center py-12">
          <div className="text-red-400 text-lg mb-2">Error</div>
          <div className="text-muted">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:ml-64 bg-gray-50 min-h-screen">
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
            {user?.is_lecturer && 'Manage your courses and enter student results'}
            {user?.is_dro && 'Review and approve submitted results'}
            {user?.is_fro && 'Review and process submitted results'}
            {user?.is_co && 'Handle result corrections and updates'}
          </p>
        </div>
      </div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Course Results</h1>
        <p className="text-gray-600">
          {user?.is_lecturer && 'Review and manage your submitted course results'}
          {user?.is_dro && 'Review and manage course results for department approval'}
          {user?.is_fro && 'Review and manage submitted course results for faculty approval'}
          {user?.is_co && 'Review and manage course results for corrections'}
          {!user?.is_lecturer && !user?.is_dro && !user?.is_fro && !user?.is_co && 'Review and manage course results'}
        </p>
      </div>
      {/* Results Table */}
      <div className="bg-white rounded-[2rem] shadow-lg w-full min-w-[950px] overflow-x-auto border border-gray-200">
        <table className="w-full min-w-[950px] table-fixed">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-[28%] whitespace-nowrap">Course</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-[18%] whitespace-nowrap">Submitted By</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-[17%] whitespace-nowrap">Date</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-[18%] whitespace-nowrap">Status</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 w-[19%] whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50 text-sm">
                <td className="py-4 px-4 align-middle">
                  <div className="flex items-center min-w-0">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2 flex-shrink-0">
                      <DocumentTextIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-800 font-medium block">{result.course_name}</span>
                  </div>
                </td>
                <td className="py-4 px-4 align-middle">
                  <div className="flex items-center min-w-0">
                    <div className="h-6 w-6 bg-gray-600 rounded-full flex items-center justify-center mr-1 flex-shrink-0">
                      <UserIcon className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-gray-800 block">Lecturer {result.lecturer_id}</span>
                  </div>
                </td>
                <td className="py-4 px-4 align-middle">
                  <div className="flex items-center min-w-0">
                    <CalendarIcon className="h-4 w-4 mr-1 flex-shrink-0 text-gray-600" />
                    <span className="block text-gray-800">{new Date(result.submitted_at).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="py-4 px-4 align-middle">
                  <div className={`inline-flex items-center min-h-[20px] px-1 py-0.5 rounded-full border text-[10px] font-bold ${getStatusColor(result.status)}`}> 
                    <span className="flex items-center"><span className="h-2 w-2 mr-0.5 flex items-center">{getStatusIcon(result.status, true)}</span>{getStatusText(result.status)}</span>
                  </div>
                </td>
                <td className="py-4 px-4 align-middle">
                  <div className="flex flex-row flex-wrap gap-2 items-center min-h-[32px]">
                    <button
                      onClick={() => navigate(`/result-system/submitted-results/${result.id}/scores/`)}
                      className="inline-flex items-center px-2 py-1 rounded-full border border-gray-400 text-gray-600 bg-transparent font-medium text-xs hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      <EyeIcon className="h-4 w-4 mr-0.5" />
                      View
                    </button>
                    {/* DRO Actions */}
                    {user?.is_dro && result.status === 'P_D' && (
                      <>
                        <button
                          disabled={actionLoading.id === result.id && actionLoading.type === 'approve'}
                          className="inline-flex items-center px-2 py-1 rounded-full border border-green-600 text-green-600 bg-transparent font-bold text-xs shadow-sm hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300"
                          onClick={() => setConfirmationDialog({ isOpen: true, type: 'approve', resultId: result.id, courseName: result.course_name || `Course ${result.course_id}` })}
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" /> Approve
                        </button>
                        <button
                          disabled={actionLoading.id === result.id && actionLoading.type === 'reject'}
                          className="inline-flex items-center px-2 py-1 rounded-full border border-red-600 text-red-600 bg-transparent font-bold text-xs shadow-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                          onClick={() => setConfirmationDialog({ isOpen: true, type: 'reject', resultId: result.id, courseName: result.course_name || `Course ${result.course_id}` })}
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" /> Reject
                        </button>
                      </>
                    )}
                    {/* FRO Actions */}
                    {user?.is_fro && result.status === 'P_F' && (
                      <>
                        <button
                          disabled={actionLoading.id === result.id && actionLoading.type === 'approve'}
                          className="inline-flex items-center px-2 py-1 rounded-full border border-green-600 text-green-600 bg-transparent font-bold text-xs shadow-sm hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300"
                          onClick={() => setConfirmationDialog({ isOpen: true, type: 'approve', resultId: result.id, courseName: result.course_name || `Course ${result.course_id}` })}
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" /> Approve
                        </button>
                        <button
                          disabled={actionLoading.id === result.id && actionLoading.type === 'reject'}
                          className="inline-flex items-center px-2 py-1 rounded-full border border-red-600 text-red-600 bg-transparent font-bold text-xs shadow-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                          onClick={() => setConfirmationDialog({ isOpen: true, type: 'reject', resultId: result.id, courseName: result.course_name || `Course ${result.course_id}` })}
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" /> Reject
                        </button>
                      </>
                    )}
                    {/* Correction Officer C Action - Change status from A to C */}
                    {user?.is_co && result.status === 'A' && (
                      <button
                        onClick={() => setStatusToCorrection(result.id)}
                        disabled={actionLoading.id === result.id}
                        className="inline-flex items-center px-2 py-1 rounded-full border border-orange-600 text-orange-600 bg-transparent font-bold text-xs shadow-sm hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ExclamationTriangleIcon className="h-4 w-4 mr-0.5" /> C
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Empty State */}
        {results.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Course Results</h3>
            <p className="text-gray-600">There are no course results to review at this time.</p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmationDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full mx-4 border border-gray-200 shadow-2xl">
            <div className="text-center">
              <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${
                confirmationDialog.type === 'approve' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {confirmationDialog.type === 'approve' ? (
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircleIcon className="h-8 w-8 text-red-600" />
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {confirmationDialog.type === 'approve' ? 'Approve Results' : 'Reject Results'}
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to {confirmationDialog.type === 'approve' ? 'approve' : 'reject'} the results for{' '}
                <span className="font-semibold text-gray-800">{confirmationDialog.courseName}</span>?
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetConfirmation}
                  className="px-6 py-2 rounded-full border border-gray-400 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!confirmationDialog.resultId || !confirmationDialog.type) return;
                    setActionLoading({ id: confirmationDialog.resultId, type: confirmationDialog.type });
                    try {
                      let newStatus = '';
                      if (confirmationDialog.type === 'approve') {
                        newStatus = user?.is_dro ? 'P_F' : 'A';
                      } else {
                        newStatus = user?.is_dro ? 'D' : 'P_D'; // DRO rejects to Draft
                      }
                      await api.patch(`/result-system/submitted-results/${confirmationDialog.resultId}/`, { status: newStatus });
                      
                      // Update course badge status when DRO rejects to draft
                      if (confirmationDialog.type === 'reject' && user?.is_dro && window.updateCourseDraftStatus) {
                        // Find the course_id for this result
                        const rejectedResult = results.find(r => r.id === confirmationDialog.resultId);
                        if (rejectedResult) {
                          window.updateCourseDraftStatus(rejectedResult.course_id, 'R');
                        }
                      }
                      
                      setActionSuccess(`${confirmationDialog.type === 'approve' ? 'Approved' : 'Rejected'} successfully. Status: ${newStatus === 'P_F' ? 'Pending Faculty' : newStatus === 'D' ? 'Draft' : newStatus === 'R' ? 'Rejected' : 'Pending Department'}`);
                      setTimeout(() => setActionSuccess(''), 3000);
                      await fetchResults();
                    } catch (err) {
                      setActionSuccess(`Failed to ${confirmationDialog.type}`);
                      setTimeout(() => setActionSuccess(''), 2000);
                    } finally {
                      setActionLoading({ id: null, type: null });
                      resetConfirmation();
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
                  {confirmationDialog.type === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
              {actionSuccess && (
                <div className="mt-4 text-green-600 text-sm font-semibold">{actionSuccess}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmittedResultsPage;