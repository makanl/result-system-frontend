import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/useAuth";
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BellIcon,
  PaperAirplaneIcon
} from "@heroicons/react/24/outline";

interface Score {
  id: number;
  student_id: number;
  ca_slot1: number | null;
  ca_slot2: number | null;
  ca_slot3: number | null;
  ca_slot4: number | null;
  exam_mark: number | null;
  total_score?: number;
  grade?: string;
}

interface SubmittedResult {
  id: number;
  course_id: number;
  submitted_at: string;
  status: string;
  lecturer_id: number;
  course_name?: string;
  lecturer?: {
    id: number;
    name: string;
    isActive: boolean;
  };
}

const SubmittedResultScorePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scores, setScores] = useState<Score[]>([]);
  const [submittedResult, setSubmittedResult] = useState<SubmittedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState<{[key: number]: string}>({});
  const [caConfig, setCaConfig] = useState({
    ca1Max: 0,
    ca2Max: 0,
    ca3Max: 0,
    ca4Max: 0
  });
  const [caConfigLoaded, setCaConfigLoaded] = useState(false);
  const [caConfigSaving, setCaConfigSaving] = useState(false);
  const [caConfigSaved, setCaConfigSaved] = useState(false);
  const [caConfigId, setCaConfigId] = useState<number | null>(null);
  const [caConfigMessage, setCaConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user } = useAuth();
  const isCorrectionOfficer = user && user.is_co;
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef<HTMLDivElement>(null);

  // Function to determine user permissions based on role, lecturer status, and result status
  const getUserPermissions = () => {
    if (!submittedResult || !user) return { canEdit: false, canSubmit: false, canSetC: false };
    
    const isLecturerActive = submittedResult.lecturer?.isActive ?? true;
    const isUserLecturer = user.is_lecturer;
    const isUserDRO = user.is_dro;
    const isUserCO = user.is_co;
    
    // Check if current user is the lecturer who submitted this result
    const isResultOwner = isUserLecturer && submittedResult.lecturer_id === user.id;
    
    // Debug logging
    console.log('Permission Debug:', {
      resultStatus: submittedResult.status,
      lecturerId: submittedResult.lecturer_id,
      lecturerName: submittedResult.lecturer?.name,
      isLecturerActive,
      currentUserId: user.id,
      isUserLecturer,
      isUserDRO,
      isResultOwner,
      canEdit: (isUserLecturer && isLecturerActive && (submittedResult.status === 'D' || submittedResult.status === 'C')) || 
               (isUserDRO && !isLecturerActive && (submittedResult.status === 'D' || submittedResult.status === 'C')),
      canSubmit: (isUserLecturer && isLecturerActive && submittedResult.status === 'C') || (isUserDRO && !isLecturerActive && submittedResult.status === 'C'),
      canSetC: isUserCO && submittedResult.status === 'A'
    });
    
    return {
      // For editing: Allow any active lecturer to edit results with status C or D, and DROs for inactive lecturers
      canEdit: (isUserLecturer && isLecturerActive && (submittedResult.status === 'D' || submittedResult.status === 'C')) || 
               (isUserDRO && !isLecturerActive && (submittedResult.status === 'D' || submittedResult.status === 'C')),
      // For submitting: Allow any active lecturer to submit results with status C, and DROs for inactive lecturers
      canSubmit: (isUserLecturer && isLecturerActive && submittedResult.status === 'C') || (isUserDRO && !isLecturerActive && submittedResult.status === 'C'),
      canSetC: isUserCO && submittedResult.status === 'A' // CO can only set C when status is Approved
    };
  };

  const permissions = getUserPermissions();

  // Function to set status to Correction (C) - for COs only
  const setStatusToCorrection = async () => {
    if (!submittedResult) {
      setError("No result found");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.patch(`/result-system/submitted-results/${submittedResult.id}/set_correction/`);
      setSuccess("Result marked as Correction (C) successfully!");
      // Update the local state to reflect the change
      setSubmittedResult(prev => prev ? { ...prev, status: 'C' } : null);
    } catch (err: any) {
      let apiError = "Failed to mark result as Correction (C).";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to mark result as Correction (C):", err);
    } finally {
      setSaving(false);
    }
  };

  // Function to approve result - for DROs only
  const handleApprove = async () => {
    if (!submittedResult) {
      setError("No result found");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/result-system/submitted-results/${submittedResult.id}/approve/`);
      setSuccess("Result approved successfully!");
      setSubmittedResult(prev => prev ? { ...prev, status: 'A' } : null);
    } catch (err: any) {
      let apiError = "Failed to approve result.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to approve result:", err);
    } finally {
      setSaving(false);
    }
  };

  // Function to reject result - for DROs only
  const handleReject = async () => {
    if (!submittedResult) {
      setError("No result found");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/result-system/submitted-results/${submittedResult.id}/reject/`);
      setSuccess("Result rejected successfully!");
      setSubmittedResult(prev => prev ? { ...prev, status: 'R' } : null);
    } catch (err: any) {
      let apiError = "Failed to reject result.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to reject result:", err);
    } finally {
      setSaving(false);
    }
  };

  // Function to process result - for FROs only
  const handleProcess = async () => {
    if (!submittedResult) {
      setError("No result found");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/result-system/submitted-results/${submittedResult.id}/process/`);
      setSuccess("Result processed successfully!");
      setSubmittedResult(prev => prev ? { ...prev, status: 'P_F' } : null);
    } catch (err: any) {
      let apiError = "Failed to process result.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to process result:", err);
    } finally {
      setSaving(false);
    }
  };

  // Function to resubmit result - for Lecturers and DROs when status is C
  const handleResubmit = async () => {
    if (!submittedResult) {
      setError("No result found");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Use PATCH to update the status to P_D (Pending Department)
      await api.patch(`/result-system/submitted-results/${submittedResult.id}/`, { status: 'P_D' });
      setSuccess("Result resubmitted successfully! Status changed to Pending Department.");
      setSubmittedResult(prev => prev ? { ...prev, status: 'P_D' } : null);
    } catch (err: any) {
      let apiError = "Failed to resubmit result.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to resubmit result:", err);
    } finally {
      setSaving(false);
    }
  };





  // Function to fetch CA max configuration from API
  const fetchCAConfiguration = async () => {
    try {
      setCaConfigLoaded(false);
      const response = await api.get('/result-system/ca_max/');
      if (response.data.results && response.data.results.length > 0) {
        // Use the first available configuration
        const config = response.data.results[0];
        const newCaConfig = {
          ca1Max: config.ca_slot1_max,
          ca2Max: config.ca_slot2_max,
          ca3Max: config.ca_slot3_max,
          ca4Max: config.ca_slot4_max
        };

        setCaConfig(newCaConfig);
        setCaConfigId(config.id);
        setCaConfigLoaded(true);
        setCaConfigSaved(true); // Mark as saved since it's from API
      } else {
        // No configuration found, use defaults
        setCaConfigLoaded(true);
        setCaConfigSaved(false);
      }
    } catch (err) {
      console.error('Failed to fetch CA configuration:', err);
      // Don't set any values if API call fails - keep initial state
      setCaConfigLoaded(false);
      setCaConfigSaved(false);
    }
  };

  // Function to handle CA configuration changes

  // Function to reset CA configuration to last saved values
  const resetCAConfiguration = async () => {
    try {
      setCaConfigSaving(true);
      await fetchCAConfiguration(); // Re-fetch from API to get last saved values
    } catch (err) {
      console.error('Failed to reset CA configuration:', err);
    } finally {
      setCaConfigSaving(false);
    }
  };

  // Function to save CA configuration to backend
  const saveCAConfiguration = async () => {
    if (!caConfigId) {
      console.error('No CA configuration ID available');
      return;
    }

    try {
      setCaConfigSaving(true);
      
      // Prepare the data to send
      const configData = {
        ca_slot1_max: caConfig.ca1Max,
        ca_slot2_max: caConfig.ca2Max,
        ca_slot3_max: caConfig.ca3Max,
        ca_slot4_max: caConfig.ca4Max
      };

      // Update the configuration via PATCH
      await api.patch(`/result-system/ca_max/${caConfigId}/`, configData);
      
      setCaConfigSaved(true);
      setCaConfigMessage({ type: 'success', text: 'CA configuration saved successfully!' });
      
      // Hide message after 3 seconds
      setTimeout(() => setCaConfigMessage(null), 3000);
      
    } catch (err) {
      console.error('Failed to save CA configuration:', err);
      setCaConfigMessage({ type: 'error', text: 'Failed to save CA configuration.' });
    } finally {
      setCaConfigSaving(false);
    }
  };

  // Function to validate CA scores for a score entry
  const validateCAScores = (score: any): string | null => {
    // Don't validate until CA configuration is loaded from backend
    if (!caConfigLoaded || !caConfig.ca1Max || !caConfig.ca2Max || !caConfig.ca3Max || !caConfig.ca4Max) {
      return null;
    }
    
    const ca1 = score.ca_slot1 || 0;
    const ca2 = score.ca_slot2 || 0;
    const ca3 = score.ca_slot3 || 0;
    const ca4 = score.ca_slot4 || 0;
    

    
    // Check individual CA slot limits
    if (ca1 > caConfig.ca1Max) {
      return `CA1 score (${ca1}) exceeds maximum allowed (${caConfig.ca1Max}).`;
    }
    if (ca2 > caConfig.ca2Max) {
      return `CA2 score (${ca2}) exceeds maximum allowed (${caConfig.ca2Max}).`;
    }
    if (ca3 > caConfig.ca3Max) {
      return `CA3 score (${ca3}) exceeds maximum allowed (${caConfig.ca3Max}).`;
    }
    if (ca4 > caConfig.ca4Max) {
      return `CA4 score (${ca4}) exceeds maximum allowed (${caConfig.ca4Max}).`;
    }
    
    const totalCA = ca1 + ca2 + ca3 + ca4;
    
    // Total CA must not exceed 40
    if (totalCA > 40) {
      return `Continuous Assessment total (${totalCA}) exceeds maximum allowed (40). Please adjust the scores.`;
    }
    
    return null;
  };

  // Function to validate all scores
  const validateAllScores = (): {isValid: boolean, errors: {[key: number]: string}} => {
    const errors: {[key: number]: string} = {};
    let isValid = true;
    
    scores.forEach(score => {
      const error = validateCAScores(score);
      if (error) {
        errors[score.id] = error;
        isValid = false;
      }
    });
    
    return { isValid, errors };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch submitted result details
        const resultResponse = await api.get(`/result-system/submitted-results/${id}/`);
        const result = resultResponse.data;
        
        // Fetch course details
        try {
          const courseResponse = await api.get(`/result-system/courses/${result.course_id}/`);
          result.course_name = courseResponse.data.name;
        } catch (err) {
          console.error(`Failed to fetch course ${result.course_id}:`, err);
          result.course_name = `Course ${result.course_id}`;
        }
        
        setSubmittedResult(result);
        
        // Fetch scores with pagination
        let allScores: any[] = [];
        let nextUrl = `/result-system/submitted-results/${id}/scores/`;
        
        while (nextUrl) {
          const scoresResponse = await api.get(nextUrl);
          
          if (scoresResponse.data.results) {
            allScores = [...allScores, ...scoresResponse.data.results];
          }
          
          // Check if there's a next page
          nextUrl = scoresResponse.data.next ? 
            scoresResponse.data.next.replace('https://result-system.onrender.com', '') : 
            null;
        }
        
        setScores(allScores);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load submitted result data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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

  useEffect(() => {
    fetchCAConfiguration();
  }, []);

  // Re-validate all scores when CA configuration is loaded
  useEffect(() => {
    if (caConfigLoaded && scores.length > 0) {
      const { errors } = validateAllScores();
      setValidationErrors(errors);
    }
  }, [caConfigLoaded, scores]);

  // Warn user before leaving page with unsaved CA configuration changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!caConfigSaved && caConfigLoaded) {
        e.preventDefault();
        e.returnValue = 'You have unsaved CA configuration changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [caConfigSaved, caConfigLoaded]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !(bellRef.current as any).contains(event.target)) {
        // setShowDropdown(false); // This line is removed as per the edit hint
      }
    }
    // if (showDropdown) { // This line is removed as per the edit hint
    //   document.addEventListener('mousedown', handleClickOutside);
    // } else {
    //   document.removeEventListener('mousedown', handleClickOutside);
    // }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // This line is removed as per the edit hint

  const handleInputChange = (id: number, field: keyof Score, value: string) => {
    setScores((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [field]: value === "" ? null : Number(value) } : s
      )
    );
    
    // Validate the updated score's CA scores
    const updatedScore = scores.find(s => s.id === id);
    if (updatedScore) {
      const updatedScoreWithNewValue = { ...updatedScore, [field]: value === "" ? null : Number(value) };
      const error = validateCAScores(updatedScoreWithNewValue);
      
      setValidationErrors(prev => ({
        ...prev,
        [id]: error || ""
      }));
    }
  };

  const handleSave = async () => {
    // Validate all scores before saving
    const { isValid, errors } = validateAllScores();
    if (!isValid) {
      setValidationErrors(errors);
      setError("Please fix the validation errors before saving.");
      return;
    }
    
    if (!reason) {
      setReasonOpen(true);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      await Promise.all(
        scores.map((s) =>
          api.patch(`/result-system/submitted-results/${id}/scores/${s.id}/`, {
            ca_slot1: s.ca_slot1,
            ca_slot2: s.ca_slot2,
            ca_slot3: s.ca_slot3,
            ca_slot4: s.ca_slot4,
            exam_mark: s.exam_mark,
            correction_reason: reason,
          })
        )
      );
      setReason("");
      setSuccess("Scores updated successfully!");
    } catch (err: any) {
      console.error("Failed to save scores:", err);
      setError("Failed to save score corrections.");
    } finally {
      setSaving(false);
      setReasonOpen(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'A': // Approved
        return 'border-green-600';
      case 'P_D': // Pending Department
      case 'P_F': // Pending Faculty
        return 'border-yellow-600';
      case 'R': // Rejected
        return 'border-red-600';
      case 'D': // Draft
        return 'border-blue-600';
      default:
        return 'border-yellow-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'A': // Approved
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case 'P_D': // Pending Department
      case 'P_F': // Pending Faculty
        return <ClockIcon className="h-5 w-5 text-yellow-400" />;
      case 'R': // Rejected
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />;
      case 'D': // Draft
        return <DocumentTextIcon className="h-5 w-5 text-blue-400" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-400" />;
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
      <div className="lg:ml-64 p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lg:ml-64 p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">
          <div className="text-red-600 text-lg mb-2">Error</div>
          <div className="text-gray-600">{error}</div>
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
        <button
          onClick={() => navigate("/result-system/submitted-results")}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Submitted Results
        </button>
        
        <div className="flex items-center mb-4">
          <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
            <DocumentTextIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Result Details</h1>
            <p className="text-gray-600">
              {submittedResult?.course_name} • Submitted on {submittedResult?.submitted_at ? new Date(submittedResult.submitted_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {submittedResult && (
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(submittedResult.status)}`}>
            {getStatusIcon(submittedResult.status)}
            <span className="ml-2">{getStatusText(submittedResult.status)}</span>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-100 border border-green-600 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-600 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Validation Errors Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded-lg p-4">
          <div className="flex items-center mb-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-red-800 font-semibold">Validation Errors</h3>
          </div>
          <p className="text-red-700 text-sm mb-2">
            {!caConfigLoaded 
              ? "Loading CA configuration from backend..." 
              : "The following students have continuous assessment scores that exceed the maximum allowed limits:"
            }
          </p>
          <ul className="text-red-700 text-sm space-y-1">
            {Object.entries(validationErrors).map(([scoreId, error]) => {
              const score = scores.find(s => s.id === parseInt(scoreId));
              return (
                <li key={scoreId} className="flex items-start">
                  <span className="font-medium mr-2">• Student {score?.student_id || scoreId}:</span>
                  <span>{error}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Scores Table */}
      <div className="bg-white rounded-[2rem] shadow-lg w-full min-w-[950px] overflow-x-auto border border-gray-200">
        <div className="mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Student Scores</h2>
          <p className="text-gray-600">
            {!caConfigLoaded 
              ? "Loading CA configuration from backend..." 
              : isCorrectionOfficer 
                ? `You can edit scores and provide correction reasons (CA1: 0-${caConfig.ca1Max}, CA2: 0-${caConfig.ca2Max}, CA3: 0-${caConfig.ca3Max}, CA4: 0-${caConfig.ca4Max}, Total CA must not exceed 40)`
                : submittedResult?.status === 'C'
                  ? `Correction mode: You can edit scores with CA limits (CA1: 0-${caConfig.ca1Max}, CA2: 0-${caConfig.ca2Max}, CA3: 0-${caConfig.ca3Max}, CA4: 0-${caConfig.ca4Max}, Total CA must not exceed 40)`
              : "View student scores for this submitted result"
            }
          </p>
          {caConfigLoaded && (isCorrectionOfficer || submittedResult?.status === 'C') && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Important:</strong> The sum of all CA scores (CA1 + CA2 + CA3 + CA4) must not exceed 40 for each student. Students can score less than 40.
              </div>
              
              {/* Save Configuration Messages */}
              {caConfigMessage && (
                <div className={`mt-3 p-2 rounded-md ${
                  caConfigMessage.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <div className="text-xs font-medium">
                    {caConfigMessage.type === 'success' ? '✓ ' : '✗ '}
                    {caConfigMessage.text}
                  </div>
                </div>
              )}
              
              {/* Save Configuration Section - Only show for users who can edit */}
              {!caConfigSaved && (permissions.canEdit || isCorrectionOfficer) && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700 font-medium">⚠ CA configuration modified</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={resetCAConfiguration}
                        disabled={caConfigSaving}
                        className="px-3 py-1 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Reset
                      </button>
                      <button
                        onClick={saveCAConfiguration}
                        disabled={caConfigSaving}
                        className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {caConfigSaving ? 'Saving...' : 'Save Config'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {scores.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Scores Found</h3>
            <p className="text-gray-600">There are no scores available for this result.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Student ID</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">CA1</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">CA2</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">CA3</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">CA4</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">CA Total</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Exam</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Total</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Grade</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => {
                  const hasError = validationErrors[score.id];
                  return (
                    <tr key={score.id} className={`border-b border-gray-100 hover:bg-gray-50 ${hasError ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                            <UserIcon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-gray-800 font-medium">{score.student_id}</span>
                        </div>
                        {validationErrors[score.id] && (
                          <div className="text-xs text-red-700 mt-1 flex items-center">
                                                          <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            <span className="font-semibold">Validation Error:</span> {validationErrors[score.id]}
                          </div>
                        )}
                      </td>
                      {permissions.canEdit ? (
                        <>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max={caConfig.ca1Max}
                              value={score.ca_slot1 || ""}
                              onChange={(e) => handleInputChange(score.id, "ca_slot1", e.target.value)}
                              disabled={!permissions.canEdit}
                              className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                !permissions.canEdit 
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                  : 'bg-white text-gray-800'
                              }`}
                              placeholder="0"
                              title={!permissions.canEdit ? "Editing not allowed for current user/status" : ""}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max={caConfig.ca2Max}
                              value={score.ca_slot2 || ""}
                              onChange={(e) => handleInputChange(score.id, "ca_slot2", e.target.value)}
                              disabled={!permissions.canEdit}
                              className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                !permissions.canEdit 
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                  : 'bg-white text-gray-800'
                              }`}
                              placeholder="0"
                              title={!permissions.canEdit ? "Editing not allowed for current user/status" : ""}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max={caConfig.ca3Max}
                              value={score.ca_slot3 || ""}
                              onChange={(e) => handleInputChange(score.id, "ca_slot3", e.target.value)}
                              disabled={!permissions.canEdit}
                              className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                !permissions.canEdit 
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                  : 'bg-white text-gray-800'
                              }`}
                              placeholder="0"
                              title={!permissions.canEdit ? "Editing not allowed for current user/status" : ""}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max={caConfig.ca4Max}
                              value={score.ca_slot4 || ""}
                              onChange={(e) => handleInputChange(score.id, "ca_slot4", e.target.value)}
                              disabled={!permissions.canEdit}
                              className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                !permissions.canEdit 
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                  : 'bg-white text-gray-800'
                              }`}
                              placeholder="0"
                              title={!permissions.canEdit ? "Editing not allowed for current user/status" : ""}
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-semibold text-sm ${(() => {
                              const caTotal = (score.ca_slot1 || 0) + (score.ca_slot2 || 0) + (score.ca_slot3 || 0) + (score.ca_slot4 || 0);
                              return caTotal > 40 ? 'text-red-600' : 'text-green-600';
                            })()}`}>
                              {(score.ca_slot1 || 0) + (score.ca_slot2 || 0) + (score.ca_slot3 || 0) + (score.ca_slot4 || 0)}
                            </span>
                            <div className="text-xs text-gray-500">/ 40</div>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={score.exam_mark || ""}
                              onChange={(e) => handleInputChange(score.id, "exam_mark", e.target.value)}
                              disabled={!permissions.canEdit}
                              className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                !permissions.canEdit 
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                  : 'bg-white text-gray-800'
                              }`}
                              placeholder="0"
                              title={!permissions.canEdit ? "Editing not allowed for current user/status" : ""}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-center">
                            <span className="text-gray-800">{score.ca_slot1 || 0}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-gray-800">{score.ca_slot2 || 0}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-gray-800">{score.ca_slot3 || 0}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-gray-800">{score.ca_slot4 || 0}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-semibold text-sm ${(() => {
                              const caTotal = (score.ca_slot1 || 0) + (score.ca_slot2 || 0) + (score.ca_slot3 || 0) + (score.ca_slot4 || 0);
                              return caTotal > 40 ? 'text-red-600' : 'text-green-600';
                            })()}`}>
                              {(score.ca_slot1 || 0) + (score.ca_slot2 || 0) + (score.ca_slot3 || 0) + (score.ca_slot4 || 0)}
                            </span>
                            <div className="text-xs text-gray-500">/ 40</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-gray-800">{score.exam_mark || 0}</span>
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-center">
                        <span className={`font-semibold ${typeof score.total_score === 'number' && score.total_score >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                          {typeof score.total_score === 'number' ? score.total_score : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-blue-600">
                          {score.grade || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200 p-6">
          {/* Left side - Save Corrections button for users who can edit */}
          {permissions.canEdit && (
            <button
              onClick={() => setReasonOpen(true)}
              disabled={saving || Object.keys(validationErrors).length > 0}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <DocumentTextIcon className="h-5 w-5 mr-2" />
              )}
              Save Corrections
            </button>
          )}
          
          {/* Center - Status-specific actions */}
          <div className="flex gap-3">
            {/* CO can only set status to C when result is approved */}
            {permissions.canSetC && (
              <button
                onClick={() => setStatusToCorrection()}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 rounded-full border border-orange-600 text-orange-600 bg-transparent font-bold text-base shadow-sm hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                C
              </button>
            )}
            
            {/* DRO can approve/reject when status is P_D */}
            {submittedResult && submittedResult.status === 'P_D' && user?.is_dro && (
              <>
                <button
                  onClick={() => handleApprove()}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-green-600 text-green-600 bg-transparent font-bold text-base shadow-sm hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Approve
                </button>
                <button
                  onClick={() => handleReject()}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-red-600 text-red-600 bg-transparent font-bold text-base shadow-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  Reject
                </button>
              </>
            )}
            
            {/* FRO can process when status is P_F */}
            {submittedResult && submittedResult.status === 'P_F' && user?.is_fro && (
              <button
                onClick={() => handleProcess()}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 rounded-full border border-blue-600 text-blue-600 bg-transparent font-bold text-base shadow-sm hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Process
              </button>
            )}
          </div>
          
          {/* Right side - Resubmit button for users who can submit */}
          {permissions.canSubmit && submittedResult && submittedResult.status === 'C' && (
            <button
              onClick={() => handleResubmit()}
              disabled={saving || Object.keys(validationErrors).length > 0}
              className="inline-flex items-center px-4 py-2 rounded-full border border-green-600 text-green-600 bg-transparent font-bold text-base shadow-sm hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
              {saving ? "Resubmitting..." : "Resubmit Results"}
            </button>
          )}
        </div>
      </div>

      {/* Reason Dialog */}
      {reasonOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Correction Reason Required</h3>
            <p className="text-gray-600 mb-4">Please provide a reason for this correction:</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-24 resize-none bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter correction reason..."
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => { setReasonOpen(false); setReason(""); }}
                disabled={saving}
                className="bg-gray-500 text-white font-medium px-4 py-2 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !reason.trim()}
                className="bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmittedResultScorePage;
