import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  AcademicCapIcon, 
  UserGroupIcon, 
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/useAuth';

interface Course {
  id: number;
  name: string;
  code: string;
  credit: number;
  student_count?: number;
  lecturer?: {
    id: number;
    name: string;
    isActive: boolean;
  };
  resultStatus?: string; // Add result status for draft badges
}

const CoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  // Function to update draft status (called from other components)
  const updateDraftStatus = (courseId: number, status: string) => {
    const draftKey = `course_${courseId}_draft_status`;
    localStorage.setItem(draftKey, status);
    
    // Update the local state to reflect the change
    setCourses(prevCourses => 
      prevCourses.map(course => 
        course.id === courseId 
          ? { ...course, resultStatus: status }
          : course
      )
    );
  };

  // Expose the function globally so other components can use it
  React.useEffect(() => {
    (window as any).updateCourseDraftStatus = updateDraftStatus;
    
    // Also expose a function to clear all draft statuses (for debugging)
    (window as any).clearAllDraftStatuses = () => {
      console.log('Clearing all draft statuses...');
      courses.forEach(course => {
        const draftKey = `course_${course.id}_draft_status`;
        localStorage.removeItem(draftKey);
      });
      // Refresh the courses to update the UI
      window.location.reload();
    };
  }, [courses]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await api.get('/result-system/courses/');
        const coursesData = response.data.results || [];
        

        
        // Get draft status from localStorage for each course
        const coursesWithStatus = coursesData.map((course: Course) => {
          const draftKey = `course_${course.id}_draft_status`;
          const draftStatus = localStorage.getItem(draftKey);
          
          console.log(`Course ${course.id} (${course.name}) draft status from localStorage:`, draftKey, draftStatus);
          
          // Only show status if it's not empty/null
          const finalStatus = draftStatus && draftStatus.trim() !== '' ? draftStatus : undefined;
          
          return {
            ...course,
            resultStatus: finalStatus
          };
        });
        
        console.log('Final courses with status:', coursesWithStatus);
        
        setCourses(coursesWithStatus);
      } catch (err) {
        console.error('Failed to load courses:', err);
        setError('Failed to load courses.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

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
    <div className="p-6 w-full lg:ml-64 bg-gray-50 min-h-screen">
      {/* Floating Welcome Card */}
      <div className="w-full mb-10">
        <div className="bg-blue-600/90 backdrop-blur-md rounded-[2rem] shadow-lg px-8 py-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow">Welcome back, {user?.username}!</h1>
          <p className="text-blue-100 text-lg">
            {user?.is_lecturer && !user?.is_dro && 'Manage your courses and enter student results'}
            {user?.is_dro && user?.is_lecturer && 'Manage your assigned courses and enter student results'}
            {user?.is_dro && !user?.is_lecturer && 'Review and approve submitted results'}
            {user?.is_fro && 'Review and process submitted results'}
            {user?.is_co && 'Handle result corrections and updates'}
          </p>
        </div>
      </div>
      {/* Course Grid */}
      <div className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {courses.map((course) => {
          const isSubmitted = course.resultStatus === 'P_D' || course.resultStatus === 'P_F' || course.resultStatus === 'A';
          const isClickable = !isSubmitted;
          
          return (
            <div
              key={course.id}
              className={`bg-white border border-gray-200 rounded-xl p-6 w-full h-full transition-all duration-200 relative shadow-sm ${
                isClickable 
                  ? 'hover:bg-gray-50 cursor-pointer group hover:shadow-lg' 
                  : 'cursor-not-allowed opacity-75'
              }`}
              onClick={isClickable ? () => navigate(`/result-system/courses/${course.id}`) : undefined}
            >
            {/* Student count badge */}
            <span className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5 z-10">
              —
            </span>
            
            {/* Lecturer Status Badge */}
            {course.lecturer && (
              <div className="absolute top-3 left-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  course.lecturer.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {course.lecturer.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}
            
            {/* Draft Status Badge */}
            {course.resultStatus && (
              <div className="absolute top-3 left-16">
                {course.resultStatus === 'D' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Drafted
                  </span>
                )}
                {course.resultStatus === 'R' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Rejected
                  </span>
                )}
                {course.resultStatus === 'P_D' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Submitted
                  </span>
                )}
              </div>
            )}
            

            
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                <AcademicCapIcon className="h-6 w-6 text-white" />
              </div>
              <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
              {course.name}
            </h3>
            <div className="space-y-2 mb-4">
              <p className="text-gray-600 text-sm">
                <span className="font-medium">Code:</span> {course.code}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-medium">Credits:</span> {course.credit}
              </p>
              {course.lecturer && (
                <p className="text-gray-600 text-sm">
                  <span className="font-medium">Lecturer:</span> {course.lecturer.name}
                </p>
              )}
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <UserGroupIcon className="h-4 w-4 mr-1" />
              — students
            </div>
            
            {/* Create Results Button for DRO when lecturer is inactive */}
            {user?.is_dro && course.lecturer && !course.lecturer.isActive && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/result-system/courses/${course.id}`);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  Create Results
                </button>
              </div>
            )}
          </div>
        );
        })}
      </div>

      {/* Empty State */}
      {courses.length === 0 && !loading && !error && (
        <div className="text-center py-8 px-6">
          <div className="max-w-md mx-auto">
            {/* Icon */}
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4">
              <AcademicCapIcon className="h-10 w-10 text-blue-600" />
            </div>
            
            {/* Title */}
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {user?.is_dro && user?.is_lecturer ? 'No Assigned Courses Yet' : 'No Courses Available'}
            </h2>
            
            {/* Description */}
            <p className="text-gray-600 mb-4">
              {user?.is_dro && user?.is_lecturer 
                ? 'You haven\'t been assigned any courses as a lecturer yet. Once courses are assigned, you\'ll be able to manage student results and submit them for approval.'
                : 'There are no courses assigned to you at the moment. Once courses are assigned, you\'ll be able to manage student results.'
              }
            </p>
            
            {/* Action Items */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">What you can do:</h3>
              <ul className="text-left text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span>Contact your department administrator to request course assignments</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span>Check back later for new course assignments</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span>Review the dashboard for any pending notifications</span>
                </li>
              </ul>
            </div>
            
            {/* Additional Info for DRO+Lecturer */}
            {user?.is_dro && user?.is_lecturer && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> As a DRO, you can still review and approve results from other lecturers while waiting for course assignments.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;