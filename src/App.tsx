import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CoursesPage from "./components/CoursePage";
import CourseResultsPage from "./pages/CourseResultsPage";
import ResultDetailPage from "./pages/ResultDetailPage";
import SubmittedResultsPage from "./pages/SubmittedResultsPage";
import SubmittedResultScorePage from "./pages/SubmittedResultScorePage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { useAuth } from "./contexts/useAuth";
import NotificationPage from './pages/NotificationPage';

const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Show loading spinner while verifying authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {user && <Sidebar />}
      <div>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
          <Route path="/notifications" element={<NotificationPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="result-system/courses" element={<CoursesPage />} />
            <Route
              path="result-system/courses/:courseId"
              element={<CourseResultsPage />}
            />
            <Route
              path="result-system/courses/:courseId/results/:resultId"
              element={<ResultDetailPage />}
            />
            <Route
              path="result-system/submitted-results"
              element={<SubmittedResultsPage />}
            />
            <Route
              path="result-system/submitted-results/:id/scores/"
              element={<SubmittedResultScorePage />}
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
