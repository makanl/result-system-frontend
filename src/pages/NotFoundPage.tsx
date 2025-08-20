import React from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="text-center">
      <div className="h-24 w-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <ExclamationTriangleIcon className="h-12 w-12 text-white" />
      </div>
      
      <h1 className="text-6xl font-bold text-red-400 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-text mb-4">Page Not Found</h2>
      <p className="text-muted mb-8 max-w-md mx-auto">
        The page you are looking for doesn't exist or has been moved to a different location.
      </p>
      
      <Link
        to="/"
        className="btn-primary inline-flex items-center"
      >
        <HomeIcon className="h-4 w-4 mr-2" />
        Go to Dashboard
      </Link>
    </div>
  </div>
);

export default NotFoundPage;