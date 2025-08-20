import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  ArrowLeftIcon,
  UserIcon,
  AcademicCapIcon,
  DocumentArrowDownIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { useAuth } from '../contexts/useAuth';

// Extend Window interface to include our global functions
declare global {
  interface Window {
    updateCourseDraftStatus: (courseId: number, status: string) => void;
    clearAllDraftStatuses: () => void;
  }
}

interface Student {
  id: number;
  name?: string;
  student_name?: string;
  full_name?: string;
  index_number?: string;
  student_id?: string;
  student?: string;
  registration_number?: string;
  ca1?: number;
  ca2?: number;
  ca3?: number;
  ca4?: number;
  exam?: number;
  correction_reason?: string;
  total_score?: number;
  grade?: string;
}

interface Course {
  id: number;
  name: string;
  code: string;
  credit: number;
  lecturer?: {
    id: number;
    name: string;
    isActive: boolean;
  };
}

const CourseResultsPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [resultId, setResultId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [noResults, setNoResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resultStatus, setResultStatus] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [submitConfirmationOpen, setSubmitConfirmationOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: number]: string}>({});
  const [caConfig, setCaConfig] = useState({
    ca1Max: 20,
    ca2Max: 20,
    ca3Max: 20,
    ca4Max: 20
  });
  const [caConfigLoaded, setCaConfigLoaded] = useState(false);
  const [caConfigSaving, setCaConfigSaving] = useState(false);
  const [caConfigSaved, setCaConfigSaved] = useState(false);
  const [caConfigId, setCaConfigId] = useState<number | null>(null);
  const [caConfigMessage, setCaConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user } = useAuth();

  // Function to determine user permissions based on role, lecturer status, and result status
  const getUserPermissions = () => {
    if (!course || !user) return { canCreate: false, canEdit: false, canSubmit: false, canSetC: false };
    
    const isLecturerActive = course.lecturer?.isActive ?? true;
    const isUserLecturer = user.is_lecturer;
    const isUserDRO = user.is_dro;
    const isUserCO = user.is_co;
    const isUserFRO = user.is_fro;
    
    return {
      canCreate: (isUserLecturer && isLecturerActive) || (isUserDRO && !isLecturerActive),
      canEdit: (isUserLecturer && isLecturerActive && (resultStatus === 'D' || resultStatus === 'C' || resultStatus === null)) || 
               (isUserDRO && !isLecturerActive && (resultStatus === 'D' || resultStatus === 'C')),
      canSubmit: (isUserLecturer && isLecturerActive) || (isUserDRO && !isLecturerActive),
      canSetC: isUserCO && resultStatus === 'A', // CO can only set C when status is Approved
      canApprove: isUserDRO && resultStatus === 'P_D',
      canReject: isUserDRO && resultStatus === 'P_D',
      canProcess: isUserFRO && resultStatus === 'P_F'
    };
  };

  const permissions = getUserPermissions();

  // Function to fetch CA max configuration from API
  const fetchCAConfiguration = async () => {
    try {
      setCaConfigLoaded(false);
      console.log('Fetching CA configuration...');
      const response = await api.get('/result-system/ca_max/');
      console.log('CA configuration response:', response.data);
      
      if (response.data.results && response.data.results.length > 0) {
        // Use the first available configuration
        const config = response.data.results[0];
        console.log('Using CA configuration:', config);
        setCaConfig({
          ca1Max: config.ca_slot1_max || 20,
          ca2Max: config.ca_slot2_max || 20,
          ca3Max: config.ca_slot3_max || 20,
          ca4Max: config.ca_slot4_max || 20
        });
        setCaConfigId(config.id);
        setCaConfigLoaded(true);
        setCaConfigSaved(true); // Mark as saved since it's from API
        console.log('CA configuration loaded successfully:', {
          ca1Max: config.ca_slot1_max || 20,
          ca2Max: config.ca_slot2_max || 20,
          ca3Max: config.ca_slot3_max || 20,
          ca4Max: config.ca_slot4_max || 20
        });
      } else {
        // No configuration found, use defaults
        console.log('No CA configuration found, using defaults');
        setCaConfigLoaded(true);
        setCaConfigSaved(false);
      }
    } catch (err) {
      console.error('Failed to fetch CA configuration:', err);
      // Keep default values if API call fails
      setCaConfigLoaded(true);
      setCaConfigSaved(false);
    }
  };

  // Function to handle CA configuration changes
  const handleCAConfigChange = (field: keyof typeof caConfig, value: number) => {
    setCaConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setCaConfigSaved(false); // Mark as unsaved when configuration changes
  };

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
      // You could add error handling here (e.g., show error message)
    } finally {
      setCaConfigSaving(false);
    }
  };

  // Function to validate CA scores for a student
  const validateCAScores = (student: Student): string | null => {
    // Don't validate until CA configuration is loaded
    if (!caConfigLoaded) {
      return null;
    }
    
    const ca1 = student.ca1 || 0;
    const ca2 = student.ca2 || 0;
    const ca3 = student.ca3 || 0;
    const ca4 = student.ca4 || 0;
    
    const totalCA = ca1 + ca2 + ca3 + ca4;
    
    // Calculate the maximum total CA based on configuration
    
    // Check individual CA limits
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
    
    // Total CA must not exceed 40
    if (totalCA > 40) {
      return `Continuous Assessment total (${totalCA}) exceeds maximum allowed (40). Please adjust the scores.`;
    }
    
    return null;
  };

  // Function to validate all students
  const validateAllStudents = (): {isValid: boolean, errors: {[key: number]: string}} => {
    const errors: {[key: number]: string} = {};
    let isValid = true;
    
    students.forEach(student => {
      const error = validateCAScores(student);
      if (error) {
        errors[student.id] = error;
        isValid = false;
      }
    });
    
    return { isValid, errors };
  };

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        
        // Fetch course details
        const courseResponse = await api.get(`/result-system/courses/${courseId}/`);
        setCourse(courseResponse.data);
        
        // Debug: Log the course response to see what data is available
        console.log('Course response data:', courseResponse.data);
        console.log('Course fields:', Object.keys(courseResponse.data));
        
        // Additional debugging for student-related fields
        if (courseResponse.data.students) {
          console.log('Students field found:', courseResponse.data.students);
          console.log('Students type:', typeof courseResponse.data.students);
          console.log('Students is array:', Array.isArray(courseResponse.data.students));
          console.log('Students length:', courseResponse.data.students?.length);
        }
        if (courseResponse.data.enrolled_students) {
          console.log('Enrolled students field found:', courseResponse.data.enrolled_students);
          console.log('Enrolled students type:', typeof courseResponse.data.enrolled_students);
          console.log('Enrolled students is array:', Array.isArray(courseResponse.data.enrolled_students));
          console.log('Enrolled students length:', courseResponse.data.enrolled_students?.length);
        }
        if (courseResponse.data.student_list) {
          console.log('Student list field found:', courseResponse.data.student_list);
          console.log('Student list type:', typeof courseResponse.data.student_list);
          console.log('Student list is array:', Array.isArray(courseResponse.data.student_list));
          console.log('Student list length:', courseResponse.data.student_list?.length);
        }
        if (courseResponse.data.course_students) {
          console.log('Course students field found:', courseResponse.data.course_students);
          console.log('Course students type:', typeof courseResponse.data.course_students);
          console.log('Course students is array:', Array.isArray(courseResponse.data.course_students));
          console.log('Course students length:', courseResponse.data.course_students?.length);
        }
        
        // Follow the correct flow: Course → Results → Assessments
        
        // Step 1: Get results for this course
        let foundResultId: number | null = null;
        let foundResultStatus: string | null = null;
        let foundSubmittedAt: string | null = null;
        
        try {
          const resultsResponse = await api.get(`/result-system/courses/${courseId}/results/`);
          
          if (resultsResponse.data.results && resultsResponse.data.results.length > 0) {
            // Use the first available result
            const firstResult = resultsResponse.data.results[0];
            foundResultId = firstResult.id;
            foundResultStatus = firstResult.status || firstResult.result_status || null;
            foundSubmittedAt = firstResult.submitted_at || null;
            setResultId(foundResultId);
            setResultStatus(foundResultStatus);
            setSubmittedAt(foundSubmittedAt);
            setNoResults(false);
          } else {
            // No results found - this is not an error, just need to create one
            setNoResults(true);
            setResultId(null);
            setResultStatus(null);
            setSubmittedAt(null);
            // Don't clear students here - we'll load them from course data
          }
        } catch (err: any) {
          console.error('Failed to get results:', err);
          console.error('Results error details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            url: err.config?.url
          });
          throw new Error('Failed to get results for course');
        }
        
        // Step 2: Get students either from existing results or from course data
        if (foundResultId) {
          // Existing results found - get students from assessments
        try {
          const assessmentsResponse = await api.get(`/result-system/courses/${courseId}/results/${foundResultId}/assessments/`);
          
          // Extract assessments (which contain student IDs and scores)
          let assessmentsData = [];
          if (assessmentsResponse.data.results) {
            assessmentsData = assessmentsResponse.data.results;
          } else if (assessmentsResponse.data.assessments) {
            assessmentsData = assessmentsResponse.data.assessments;
          } else if (Array.isArray(assessmentsResponse.data)) {
            assessmentsData = assessmentsResponse.data;
          } else {
            assessmentsData = [];
          }
          
          console.log('Raw assessments response:', assessmentsResponse.data);
          console.log('Processed assessments data:', assessmentsData);
          
          // Extract student data directly from assessments
          const studentsData = assessmentsData.map((assessment: any) => {
            console.log('Processing assessment:', assessment);
            
            // Check if assessment has a nested student object
            const studentInfo = assessment.student || assessment.student_info || assessment.student_data;
            const studentId = typeof studentInfo === 'object' ? 
                  (studentInfo.student_id || studentInfo.id || studentInfo.registration_number || assessment.student_id) : 
              (assessment.student || assessment.student_id);
            
            const studentName = typeof studentInfo === 'object' ? 
              (studentInfo.name || studentInfo.full_name || studentInfo.student_name) : 
              undefined;
            
            const studentData = {
              id: assessment.id,
              student: assessment.student,
              student_id: studentId,
              name: studentName,
              ca1: assessment.ca_slot1,
              ca2: assessment.ca_slot2,
              ca3: assessment.ca_slot3,
              ca4: assessment.ca_slot4,
              exam: assessment.exam_mark,
              correction_reason: assessment.correction_reason,
              total_score: assessment.total_score,
              grade: assessment.grade
            };
            
            console.log('Final student data:', studentData);
            return studentData;
          });
          
          setStudents(studentsData);
        } catch (err: any) {
          console.error('Failed to get assessments:', err);
            // If we can't get assessments, set empty students array
            setStudents([]);
          }
        } else {
          // No results exist yet, but courses come with students already enrolled
          // This is crucial for DROs creating new results
          console.log('No existing results found. Loading students from course data for new result creation...');
          
          try {
            // Since courses come with students, we need to check if students are already available
            // from the initial course response or if we need to fetch them
            let courseStudents: any[] = [];
            
            // First, check if the initial course response already has student information
            if (courseResponse.data.students && Array.isArray(courseResponse.data.students)) {
              courseStudents = courseResponse.data.students;
              console.log('Found students in initial course response:', courseStudents);
            } else if (courseResponse.data.enrolled_students && Array.isArray(courseResponse.data.enrolled_students)) {
              courseStudents = courseResponse.data.enrolled_students;
              console.log('Found enrolled students in initial course response:', courseStudents);
            } else if (courseResponse.data.student_list && Array.isArray(courseResponse.data.student_list)) {
              courseStudents = courseResponse.data.student_list;
              console.log('Found student_list in initial course response:', courseStudents);
            } else if (courseResponse.data.course_students && Array.isArray(courseResponse.data.course_students)) {
              courseStudents = courseResponse.data.course_students;
              console.log('Found course_students in initial course response:', courseStudents);
            } else {
              // No students in initial response, try to fetch them from dedicated endpoints
              console.log('No students found in initial course response, trying dedicated endpoints...');
              
              // Try different possible endpoint patterns
              const possibleEndpoints = [
                `/result-system/courses/${courseId}/students/`,
                `/result-system/courses/${courseId}/enrollment/`,
                `/result-system/courses/${courseId}/enrolled-students/`,
                `/result-system/courses/${courseId}/course-students/`,
                `/result-system/courses/${courseId}/student-list/`
              ];
              
              for (const endpoint of possibleEndpoints) {
                try {
                  console.log(`Trying endpoint: ${endpoint}`);
                  const response = await api.get(endpoint);
                  if (response.data && response.data.results && Array.isArray(response.data.results)) {
                    courseStudents = response.data.results;
                    console.log(`Successfully fetched students from ${endpoint}:`, courseStudents);
                    break;
                  } else if (response.data && Array.isArray(response.data)) {
                    courseStudents = response.data;
                    console.log(`Successfully fetched students from ${endpoint} (direct array):`, courseStudents);
                    break;
                  }
                } catch (endpointErr: any) {
                  console.log(`Endpoint ${endpoint} not available:`, endpointErr.message);
                }
              }
            }
            
            // Map course students to the student format we need
            if (courseStudents.length > 0) {
              const mappedStudents = courseStudents.map((courseStudent: any) => ({
                id: courseStudent.id || courseStudent.student_id || courseStudent.registration_number,
                student: courseStudent.student_id || courseStudent.registration_number || courseStudent.index_number,
                student_id: courseStudent.student_id || courseStudent.registration_number || courseStudent.index_number,
                name: courseStudent.name || courseStudent.full_name || courseStudent.student_name,
                ca1: undefined, // No scores yet
                ca2: undefined,
                ca3: undefined,
                ca4: undefined,
                exam: undefined,
                correction_reason: undefined,
                total_score: undefined,
                grade: undefined
              }));
              
              setStudents(mappedStudents);
              console.log('Successfully loaded students from course for new result creation:', mappedStudents);
            } else {
              console.log('No students found in course data or endpoints');
              setStudents([]);
            }
          } catch (err: any) {
            console.error('Failed to get course students:', err);
            console.log('Could not retrieve students from course, setting empty array');
            setStudents([]);
          }
        }
        
      } catch (err: any) {
        console.error("Failed to load course data:", err);
        console.error("Error details:", err.response?.data || err.message);
        setError(`Failed to load course data: ${err.response?.data?.detail || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
    fetchCAConfiguration(); // Call the new function here
  }, [courseId]);

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

  const handleScoreChange = (studentId: number, field: keyof Student, value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    
    setStudents(prev => {
      const updatedStudents = prev.map(student => 
        student.id === studentId 
          ? { ...student, [field]: numValue }
          : student
      );
      
              // Validate the updated student's CA scores and calculate totals
        const updatedStudent = updatedStudents.find(s => s.id === studentId);
        if (updatedStudent) {
          const error = validateCAScores(updatedStudent);
          
          // Calculate total score and grade
          const ca1 = updatedStudent.ca1 || 0;
          const ca2 = updatedStudent.ca2 || 0;
          const ca3 = updatedStudent.ca3 || 0;
          const ca4 = updatedStudent.ca4 || 0;
          const exam = updatedStudent.exam || 0;
          
          const totalCA = ca1 + ca2 + ca3 + ca4;
          const totalScore = totalCA + exam;
          
          // Calculate grade based on total score
          let grade = '';
          if (totalScore >= 80) grade = 'A';
          else if (totalScore >= 70) grade = 'B';
          else if (totalScore >= 60) grade = 'C';
          else if (totalScore >= 50) grade = 'D';
          else if (totalScore >= 40) grade = 'E';
          else grade = 'F';
          
          // Update the student with calculated values
          const finalUpdatedStudent = {
            ...updatedStudent,
            total_score: totalScore,
            grade: grade
          };
          
          // Update the students array with calculated values
          const finalUpdatedStudents = updatedStudents.map(s => 
            s.id === studentId ? finalUpdatedStudent : s
          );
          
          setValidationErrors(prevErrors => {
            const newErrors = { ...prevErrors };
            if (error) {
              newErrors[studentId] = error;
            } else {
              // Remove the error if validation passes
              delete newErrors[studentId];
            }
            return newErrors;
          });
          
          return finalUpdatedStudents;
        }
      
      return updatedStudents;
    });
  };

  const handleSaveDraft = async () => {
    if (!resultId) {
      setError("No result found for this course");
      return;
    }
    
    // Validate all students before saving (but don't block draft saving)
    const { isValid, errors } = validateAllStudents();
    if (!isValid) {
      setValidationErrors(errors);
      // Show warning but don't block saving
      setError("Warning: Some validation errors exist. You can still save the draft, but please fix errors before submitting.");
    }
    
    // If status is draft and submittedAt exists, require reason
    if (resultStatus === 'D' && submittedAt) {
      if (!reasonOpen) {
        setReasonOpen(true);
        return;
      }
      if (!reason.trim()) {
        setError("Please provide a reason for editing this result.");
        return;
      }
    }
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      // Update assessments with new scores
      const updatePromises = students.map(student => 
        api.patch(`/result-system/courses/${courseId}/results/${resultId}/assessments/${student.id}/`, {
          ca_slot1: student.ca1,
          ca_slot2: student.ca2,
          ca_slot3: student.ca3,
          ca_slot4: student.ca4,
          exam_mark: student.exam,
          ...(resultStatus === 'D' && submittedAt ? { correction_reason: reason } : {})
        })
      );
      
      await Promise.all(updatePromises);
      
      // Update the draft status in localStorage and course page
      if (window.updateCourseDraftStatus) {
        window.updateCourseDraftStatus(parseInt(courseId!), 'D');
      }
      
      setSuccess("Draft saved successfully!");
      setReason("");
      setReasonOpen(false);
    } catch (err: any) {
      let apiError = "Failed to save draft.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to save draft:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateResult = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      // Create a new result for this course
      const response = await api.post(`/result-system/courses/${courseId}/results/`, {
        course_id: parseInt(courseId!)
      });
      
      const newResultId = response.data.id;
      setResultId(newResultId);
      setResultStatus('D'); // Set status to Draft for newly created results
      setNoResults(false);
      
      // Update the draft status in localStorage and course page
      if (window.updateCourseDraftStatus) {
        window.updateCourseDraftStatus(parseInt(courseId!), 'D');
      }
      
      // Now fetch the assessments for the new result
      const assessmentsResponse = await api.get(`/result-system/courses/${courseId}/results/${newResultId}/assessments/`);
      
      let assessmentsData = [];
      if (assessmentsResponse.data.results) {
        assessmentsData = assessmentsResponse.data.results;
      } else if (assessmentsResponse.data.assessments) {
        assessmentsData = assessmentsResponse.data.assessments;
      } else if (Array.isArray(assessmentsResponse.data)) {
        assessmentsData = assessmentsResponse.data;
      }
      
      const studentsData = assessmentsData.map((assessment: any) => {
        // Check if assessment has a nested student object
        const studentInfo = assessment.student || assessment.student_info || assessment.student_data;
        const studentId = typeof studentInfo === 'object' ? 
          (studentInfo.student_id || studentInfo.id || studentInfo.registration_number || studentInfo.index_number) : 
          (assessment.student || assessment.student_id);
        
        const studentName = typeof studentInfo === 'object' ? 
          (studentInfo.name || studentInfo.full_name || studentInfo.student_name) : 
          undefined;
        
        return {
          id: assessment.id,
          student: assessment.student,
          student_id: studentId,
          name: studentName,
          ca1: assessment.ca_slot1,
          ca2: assessment.ca_slot2,
          ca3: assessment.ca_slot3,
          ca4: assessment.ca_slot4,
          exam: assessment.exam_mark,
          correction_reason: assessment.correction_reason,
          total_score: assessment.total_score,
          grade: assessment.grade
        };
      });
      
      setStudents(studentsData);
      setSuccess("Result created successfully! You can now enter student scores.");
    } catch (err: any) {
      let apiError = "Failed to create result for this course.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to create result:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResults = async () => {
    if (!resultId) {
      setError("No result found for this course");
      return;
    }
    
    // Validate all students before submitting
    const { isValid, errors } = validateAllStudents();
    if (!isValid) {
      setValidationErrors(errors);
      setError("Please fix the validation errors before submitting.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    setSuccess("");
    
    try {
      // Submit the result using the submit endpoint
      await api.put(`/result-system/courses/${courseId}/results/${resultId}/submit/`);
      
      // Update the status to 'P_D' (Pending Department) in localStorage and course page
      if (window.updateCourseDraftStatus) {
        window.updateCourseDraftStatus(parseInt(courseId!), 'P_D');
      }
      
      setSuccess("Results submitted successfully!");
      navigate("/result-system/submitted-results");
    } catch (err: any) {
      let apiError = "Failed to submit results.";
      if (err.response && err.response.data && err.response.data.detail) {
        apiError = err.response.data.detail;
      } else if (err.message) {
        apiError = err.message;
      }
      setError(apiError);
      console.error("Failed to submit results:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const setStatusToCorrection = async () => {
    if (!resultId) {
      setError("No result found for this course");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.patch(`/result-system/courses/${courseId}/results/${resultId}/set_correction/`);
      setSuccess("Result marked as Correction (C) successfully!");
      setResultStatus('C'); // Update state to reflect the change
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
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!resultId) {
      setError("No result found for this course");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/result-system/courses/${courseId}/results/${resultId}/approve/`);
      setSuccess("Result approved successfully!");
      setResultStatus('A'); // Update state to reflect the change
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
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!resultId) {
      setError("No result found for this course");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/result-system/courses/${courseId}/results/${resultId}/reject/`);
      setSuccess("Result rejected successfully!");
      setResultStatus('R'); // Update state to reflect the change
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
      setSubmitting(false);
    }
  };

  const handleProcess = async () => {
    if (!resultId) {
      setError("No result found for this course");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/result-system/courses/${courseId}/results/${resultId}/process/`);
      setSuccess("Result processed successfully!");
      setResultStatus('P_F'); // Update state to reflect the change
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
      setSubmitting(false);
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

  if (error && !course) {
    return (
      <div className="lg:ml-64 p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">
          <div className="text-red-600 text-lg mb-2">Error</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  if (noResults && course) {
    return (
      <div className="lg:ml-64 p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Courses
          </button>
          
          <div className="flex items-center mb-4">
            <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
              <AcademicCapIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{course.name}</h1>
              <p className="text-gray-600">{course.code} • {course.credit} credits</p>
            </div>
          </div>
        </div>

        {/* No Results State */}
        <div className="bg-white rounded-[2rem] shadow-lg border border-gray-200">
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Results Found</h3>
            <p className="text-gray-600 mb-6">This course doesn't have any results yet. Create a new result to start entering student scores.</p>
            <button
              onClick={handleCreateResult}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 rounded-full border border-blue-600 text-blue-600 bg-transparent font-bold text-base shadow-sm hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 mx-auto"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
              ) : (
                <DocumentTextIcon className="h-5 w-5 mr-2" />
              )}
              Create Result
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:ml-64 bg-gray-50 min-h-screen">
      {/* Floating Welcome Card */}
      <div className="w-full mb-10">
        <div className="bg-blue-600/90 backdrop-blur-md rounded-[2rem] shadow-lg px-8 py-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
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
          onClick={() => navigate("/")}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Courses
        </button>
        
        <div className="flex items-center mb-4">
          <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
            <AcademicCapIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{course?.name}</h1>
            <p className="text-gray-600">{course?.code} • {course?.credit} credits</p>
          </div>
        </div>
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
            The following students have continuous assessment scores that exceed the maximum allowed total of 40:
          </p>
          <ul className="text-red-700 text-sm space-y-1">
            {Object.entries(validationErrors).map(([studentId, error]) => {
              const student = students.find(s => s.id === parseInt(studentId));
              return (
                <li key={studentId} className="flex items-start">
                  <span className="font-medium mr-2">• {student?.student_id || `Student ${studentId}`}:</span>
                  <span>{error}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* CA Configuration Section */}
      <div className="bg-white rounded-[2rem] shadow-lg border border-gray-200 w-full mb-6">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">CA Configuration</h2>
          
          {/* DRO Creating New Results Notice */}
          {user?.is_dro && noResults && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>DRO Action Required:</strong> You are creating new results for this course. 
                {students.length > 0 ? 
                  ` Enter the CA and exam scores for ${students.length} enrolled student${students.length > 1 ? 's' : ''}, then save and submit the results.` :
                  ' Students need to be enrolled in this course before you can create results. Contact the course administrator.'
                }
              </div>
            </div>
          )}
          
          {!caConfigLoaded ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600">Loading CA configuration...</span>
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Current Configuration:</strong> CA1: {caConfig.ca1Max}, CA2: {caConfig.ca2Max}, CA3: {caConfig.ca3Max}, CA4: {caConfig.ca4Max}
                </div>
                <div className="mt-1 text-xs text-blue-700">
                  Total CA Maximum: <span className="font-semibold">{caConfig.ca1Max + caConfig.ca2Max + caConfig.ca3Max + caConfig.ca4Max}</span>
                </div>
                {caConfigSaved && (
                  <div className="mt-2 text-xs text-green-700">
                    ✓ Configuration loaded from backend
                  </div>
                )}
              </div>
              
              {/* Sample Students Notice for DROs */}
              {user?.is_dro && students.length > 0 && students.some(s => s.name?.includes('Sample Student')) && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm text-yellow-800">
                    <strong>Note:</strong> Sample students are shown for demonstration. In a real scenario, you would see the actual enrolled students for this course.
                  </div>
                </div>
              )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">CA1 Max Score</label>
              <input
                type="number"
                min="0"
                max="40"
                value={caConfig.ca1Max}
                    onChange={(e) => handleCAConfigChange("ca1Max", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">CA2 Max Score</label>
              <input
                type="number"
                min="0"
                max="40"
                value={caConfig.ca2Max}
                    onChange={(e) => handleCAConfigChange("ca2Max", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">CA3 Max Score</label>
              <input
                type="number"
                min="0"
                max="40"
                value={caConfig.ca3Max}
                    onChange={(e) => handleCAConfigChange("ca3Max", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">CA4 Max Score</label>
              <input
                type="number"
                min="0"
                max="40"
                value={caConfig.ca4Max}
                    onChange={(e) => handleCAConfigChange("ca4Max", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-700">
                  Total CA Maximum: <span className="font-semibold">{caConfig.ca1Max + caConfig.ca2Max + caConfig.ca3Max + caConfig.ca4Max}</span>
                </div>
                <div className="mt-1">
                  <span className="text-sm font-semibold text-green-600">
                    Valid Configuration
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  <strong>Note:</strong> The sum of all CA scores must not exceed 40 for each student.
                </div>
                
                {/* Save Configuration Messages */}
                {caConfigMessage && (
                  <div className={`mt-3 p-3 rounded-md ${
                    caConfigMessage.type === 'success' 
                      ? 'bg-green-50 border border-green-200 text-green-800' 
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <div className="text-sm font-medium">
                      {caConfigMessage.type === 'success' ? '✓ ' : '✗ '}
                      {caConfigMessage.text}
                    </div>
                  </div>
                )}
                
                {/* Save Configuration Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {caConfigSaved ? (
                        <span className="text-sm text-green-600 font-medium">✓ Configuration saved</span>
                      ) : (
                        <span className="text-sm text-orange-600 font-medium">⚠ Configuration modified</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {!caConfigSaved && (
                        <button
                          onClick={resetCAConfiguration}
                          disabled={caConfigSaving}
                          className="px-4 py-2 rounded-md font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        onClick={saveCAConfiguration}
                        disabled={caConfigSaving || caConfigSaved}
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${
                          caConfigSaving || caConfigSaved
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {caConfigSaving ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
              </span>
                        ) : caConfigSaved ? (
                          'Saved'
                        ) : (
                          'Save Configuration'
                        )}
                      </button>
            </div>
          </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Student Results Table */}
      <div className="bg-white rounded-[2rem] shadow-lg border border-gray-200 w-full overflow-x-auto">
        <div className="mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Student Results</h2>
          <p className="text-gray-600">
            {!caConfigLoaded ? (
              "Loading CA configuration..."
            ) : (
              `Enter scores for each student (CA1: 0-${caConfig.ca1Max}, CA2: 0-${caConfig.ca2Max}, CA3: 0-${caConfig.ca3Max}, CA4: 0-${caConfig.ca4Max}, Total CA must not exceed 40, Exam: 0-60)`
            )}
          </p>
          {caConfigLoaded && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Important:</strong> The sum of all CA scores (CA1 + CA2 + CA3 + CA4) must not exceed 40 for each student. Students can score less than 40.
              </div>
            </div>
          )}
        </div>

        {/* Results Entry Section Header */}
        {user?.is_dro && noResults && (
          <div className="bg-white rounded-[2rem] shadow-lg border border-gray-200 w-full mb-6">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Student Results Entry</h2>
              <p className="text-gray-600 text-sm">
                {students.length > 0 
                  ? `Enter the Continuous Assessment (CA) and exam scores for ${students.length} student${students.length > 1 ? 's' : ''}. Use the Save Draft button to save your progress, then Submit Results when complete.`
                  : 'No students are currently enrolled in this course. Contact the course administrator to ensure students are properly enrolled before creating results.'
                }
              </p>
            </div>
          </div>
        )}

        {students.length === 0 && !(user?.is_dro && noResults) ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {noResults ? 'No Students Enrolled' : 'No Student Results Found'}
            </h3>
            <p className="text-gray-600 mb-4">
              {noResults 
                ? 'There are no students enrolled in this course yet, or no results have been created.'
                : 'No student results have been found for this course.'
              }
            </p>
            
            {/* Role-specific guidance */}
            {user?.is_dro && !user?.is_lecturer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="text-sm text-blue-800">
                  <strong>DRO Note:</strong> As a Departmental Results Officer, you can create results for this course when students are enrolled. 
                  {noResults && ' You may need to contact the course administrator to ensure students are properly enrolled.'}
                </div>
              </div>
            )}
            
            {user?.is_dro && user?.is_lecturer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="text-sm text-blue-800">
                  <strong>DRO & Lecturer Note:</strong> You can create results for this course. 
                  {noResults && ' You may need to contact the course administrator to ensure students are properly enrolled.'}
                </div>
              </div>
            )}
            
            {user?.is_lecturer && !user?.is_dro && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="text-sm text-blue-800">
                  <strong>Lecturer Note:</strong> You can create results for this course when students are enrolled.
                  {noResults && ' You may need to contact the course administrator to ensure students are properly enrolled.'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-600">Student ID</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">CA1</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">CA2</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">CA3</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">CA4</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">CA Total</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">Exam</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">Total</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-600">Grade</th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map((student) => {
                  const hasError = validationErrors[student.id];
                  return (
                    <tr key={student.id} className={`border-b border-gray-100 hover:bg-gray-50 ${hasError ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-2">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                            <UserIcon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-gray-800 font-medium">
                            {student.student_id || student.student || student.index_number || student.registration_number || `Student ${student.id}`}
                          </span>
                          {student.name && (
                            <div className="text-xs text-gray-500 mt-1">
                              {student.name}
                            </div>
                          )}
                          {student.correction_reason && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300" title={student.correction_reason}>
                              Corrected
                            </span>
                          )}
                        </div>
                        {student.correction_reason && (
                          <div className="text-xs text-yellow-700 mt-1">
                            <span className="font-semibold">Correction Reason:</span> {student.correction_reason}
                          </div>
                        )}
                        {validationErrors[student.id] && (
                          <div className="text-xs text-red-700 mt-1 flex items-center">
                                                          <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            <span className="font-semibold">Validation Error:</span> {validationErrors[student.id]}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max={caConfig.ca1Max}
                          value={student.ca1 ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "ca1", e.target.value)}
                            disabled={user?.is_co || !permissions.canEdit}
                            className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              user?.is_co || !permissions.canEdit 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-white text-gray-800'
                            }`}
                          placeholder="0"
                            title={user?.is_co ? "Editing disabled for Correction Officer role" : ""}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max={caConfig.ca2Max}
                          value={student.ca2 ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "ca2", e.target.value)}
                            disabled={user?.is_co || !permissions.canEdit}
                            className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              user?.is_co || !permissions.canEdit 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-white text-gray-800'
                            }`}
                          placeholder="0"
                            title={user?.is_co ? "Editing disabled for Correction Officer role" : ""}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max={caConfig.ca3Max}
                          value={student.ca3 ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "ca3", e.target.value)}
                            disabled={user?.is_co || !permissions.canEdit}
                            className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              user?.is_co || !permissions.canEdit 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-white text-gray-800'
                            }`}
                          placeholder="0"
                            title={user?.is_co ? "Editing disabled for Correction Officer role" : ""}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max={caConfig.ca4Max}
                          value={student.ca4 ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "ca4", e.target.value)}
                            disabled={user?.is_co || !permissions.canEdit}
                            className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              user?.is_co || !permissions.canEdit 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-white text-gray-800'
                            }`}
                          placeholder="0"
                            title={user?.is_co ? "Editing disabled for Correction Officer role" : ""}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-semibold text-sm ${(() => {
                          const caTotal = (student.ca1 || 0) + (student.ca2 || 0) + (student.ca3 || 0) + (student.ca4 || 0);
                            return caTotal > 40 ? 'text-red-600' : 'text-green-600';
                        })()}`}>
                          {(student.ca1 || 0) + (student.ca2 || 0) + (student.ca3 || 0) + (student.ca4 || 0)}
                        </span>
                        <div className="text-xs text-gray-500">/ 40</div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={student.exam ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "exam", e.target.value)}
                            disabled={user?.is_co || !permissions.canEdit}
                            className={`w-16 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              user?.is_co || !permissions.canEdit 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-white text-gray-800'
                            }`}
                          placeholder="0"
                            title={user?.is_co ? "Editing disabled for Correction Officer role" : ""}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-semibold ${(() => {
                          const total = (student.ca1 || 0) + (student.ca2 || 0) + (student.ca3 || 0) + (student.ca4 || 0) + (student.exam || 0);
                          return total >= 50 ? 'text-green-600' : 'text-red-600';
                        })()}`}>
                          {(student.ca1 || 0) + (student.ca2 || 0) + (student.ca3 || 0) + (student.ca4 || 0) + (student.exam || 0)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                          <span className={`font-semibold ${(() => {
                            const total = (student.ca1 || 0) + (student.ca2 || 0) + (student.ca3 || 0) + (student.ca4 || 0) + (student.exam || 0);
                            if (total >= 80) return 'text-green-600';
                            if (total >= 70) return 'text-blue-600';
                            if (total >= 60) return 'text-yellow-600';
                            if (total >= 50) return 'text-orange-600';
                            return 'text-red-600';
                          })()}`}>
                          {(() => {
                            const total = (student.ca1 || 0) + (student.ca2 || 0) + (student.ca3 || 0) + (student.ca4 || 0) + (student.exam || 0);
                            if (total >= 80) return 'A';
                              if (total >= 70) return 'B';
                              if (total >= 60) return 'C';
                              if (total >= 50) return 'D';
                              if (total >= 40) return 'E';
                              return 'F';
                          })()}
                        </span>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  // No students available for new result creation
                  user?.is_dro && noResults ? (
                    <tr className="border-b border-gray-100">
                      <td className="py-8 px-2 text-center text-gray-500" colSpan={9}>
                        <div className="flex flex-col items-center">
                          <UserIcon className="h-12 w-12 text-gray-300 mb-3" />
                          <p className="text-sm text-gray-600 mb-2">
                            No students are currently enrolled in this course.
                          </p>
                          <p className="text-xs text-gray-500">
                            Students need to be enrolled before you can create results. Contact the course administrator.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200 p-6">
          {/* Left side - Save Draft button */}
          {permissions.canEdit && (
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className={`font-medium px-4 py-2 rounded-md transition-colors flex items-center ${
              Object.keys(validationErrors).length > 0 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : Object.keys(validationErrors).length > 0 ? "Save Draft (with warnings)" : "Save Draft"}
          </button>
          )}
          
          {/* Center - Status-specific actions */}
          <div className="flex gap-3">
            {/* CO can only set status to C */}
            {permissions.canSetC && (
              <button
                onClick={() => setStatusToCorrection()}
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 rounded-full border border-orange-600 text-orange-600 bg-transparent font-bold text-base shadow-sm hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                Mark as Correction (C)
              </button>
            )}
            
            {/* DRO can approve/reject when status is P_D */}
            {permissions.canApprove && (
              <button
                onClick={() => handleApprove()}
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 rounded-full border border-green-600 text-green-600 bg-transparent font-bold text-base shadow-sm hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Approve
              </button>
            )}
            
            {permissions.canReject && (
              <button
                onClick={() => handleReject()}
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 rounded-full border border-red-600 text-red-600 bg-transparent font-bold text-base shadow-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  Reject
              </button>
            )}
            
            {/* FRO can process when status is P_F */}
            {permissions.canProcess && (
              <button
                onClick={() => handleProcess()}
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 rounded-full border border-blue-600 text-blue-600 bg-transparent font-bold text-base shadow-sm hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Process
              </button>
            )}
          </div>
          
          {/* Right side - Submit Results button */}
          {permissions.canSubmit && (
          <button
            onClick={() => setSubmitConfirmationOpen(true)}
            disabled={submitting || Object.keys(validationErrors).length > 0}
            className="inline-flex items-center px-4 py-2 rounded-full border border-blue-600 text-blue-600 bg-transparent font-bold text-base shadow-sm hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-4 w-4 mr-2" />
            {submitting ? "Submitting..." : "Submit Results"}
          </button>
          )}
        </div>
      </div>
      {/* Reason Dialog for Lecturer Editing Draft with Submitted Date */}
      {reasonOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Reason Required</h3>
            <p className="text-gray-600 mb-4">Please provide a reason for editing this result (required for audit):</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-24 resize-none bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter reason..."
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
                onClick={handleSaveDraft}
                disabled={saving || !reason.trim()}
                className="bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Results Confirmation Dialog */}
      {submitConfirmationOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full mx-4 border border-gray-200 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-blue-100">
                <PaperAirplaneIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Submit Results</h3>
              {Object.keys(validationErrors).length > 0 ? (
                <div className="text-left">
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                    <div className="flex items-center mb-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                      <h4 className="text-red-800 font-semibold">Validation Errors Found</h4>
                    </div>
                    <p className="text-red-700 text-sm">
                      Please fix the continuous assessment validation errors before submitting.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 mb-6">
                  Are you sure you want to submit the results for{' '}
                  <span className="font-semibold text-gray-800">{course?.name}</span>?
                  <br />
                  <span className="text-sm text-gray-500 mt-2 block">
                    This action cannot be undone. Results will be sent for review.
                  </span>
                </p>
              )}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setSubmitConfirmationOpen(false)}
                  className="px-6 py-2 rounded-full border border-gray-400 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                {Object.keys(validationErrors).length === 0 && (
                  <button
                    onClick={async () => {
                      setSubmitConfirmationOpen(false);
                      await handleSubmitResults();
                    }}
                    className="px-6 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Submit Results
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseResultsPage;
