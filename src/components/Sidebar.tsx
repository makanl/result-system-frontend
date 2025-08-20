import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { 
  HomeIcon, 
  DocumentTextIcon, 
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch submitted results count for badge
    const fetchCount = async () => {
      try {
        const response = await api.get('/result-system/submitted-results/');
        setSubmittedCount(response.data.results ? response.data.results.length : 0);
      } catch {
        setSubmittedCount(null);
      }
    };

    fetchCount();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    // Show courses for lecturers (including DROs who are also lecturers)
    ...(user?.is_lecturer ? [{ name: 'Courses', href: '/result-system/courses', icon: AcademicCapIcon }] : []),
    { name: 'Submitted Results', href: '/result-system/submitted-results', icon: DocumentTextIcon, count: submittedCount },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-card border border-border text-text hover:bg-surface transition-colors"
        >
          {isOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-primary-600 transform transition-transform duration-300 ease-in-out rounded-r-[2rem] rounded-l-[2rem]
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-primary-500">
            <h1 className="text-xl font-bold text-white">Result System</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-[1rem] transition-colors relative
                  ${isActive(item.href)
                    ? 'bg-primary-700 text-white'
                    : 'text-blue-200 hover:bg-primary-500 hover:text-white'
                  }
                `}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
                {item.name === 'Submitted Results' && typeof item.count === 'number' && (
                  <span className="ml-2 inline-block bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {item.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* User info */}
          {user && (
            <div className="p-4 border-t border-primary-500">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary-400 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{user.username}</p>
                  <p className="text-xs text-blue-200">
                    {user.is_lecturer && !user.is_dro && 'Lecturer'}
                    {user.is_dro && user.is_lecturer && 'DRO & Lecturer'}
                    {user.is_dro && !user.is_lecturer && 'DRO'}
                    {user.is_fro && 'FRO'}
                    {user.is_co && 'Correction Officer'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-3 w-full text-left text-sm text-blue-200 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar; 