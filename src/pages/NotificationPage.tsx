import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/useAuth';
import { BellIcon, ArrowLeftIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellOutlineIcon } from '@heroicons/react/24/outline';

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notification/');
        setNotifications(response.data.results || []);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/notification/${id}/`);
      setNotifications((prev: any) => prev.filter((n: any) => n.id !== id));
    } catch {
      // Optionally show error
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 lg:ml-64">
      {/* Floating Welcome Card */}
      <div className="w-full mb-10">
        <div className="bg-blue-600/90 backdrop-blur-md rounded-[2rem] shadow-lg px-8 py-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto relative">
          <div className="absolute top-6 right-8">
            <button
              className="relative focus:outline-none"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              <BellOutlineIcon className="h-7 w-7 text-blue-100 hover:text-white transition-colors" />
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
      {/* Notification Heading and Back Button */}
      <div className="w-full max-w-2xl mx-auto mb-10 flex items-center justify-center relative"> {/* Center heading */}
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-800 text-lg font-semibold absolute left-0 top-1/2 -translate-y-1/2 transition-colors">
          <ArrowLeftIcon className="h-6 w-6 mr-2" /> Back
        </button>
        <div className="flex items-center gap-3">
          <BellIcon className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold text-gray-800 tracking-wide">Notifications</span>
        </div>
      </div>
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-600 text-xl font-medium shadow-lg border border-gray-200">
            No notifications
          </div>
        ) : (
          <ul className="space-y-3 w-full flex flex-col items-center justify-center"> {/* Reduced space between cards */}
            {notifications.map((n: any) => (
              <li key={n.id} className="backdrop-blur-md bg-white border border-gray-200 rounded-3xl shadow-lg px-8 py-6 flex items-center gap-4 hover:bg-gray-50 transition-colors w-full">
                <span className="inline-block w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-6 w-6 text-white" />
                </span>
                <div className="flex flex-col flex-1">
                  <span className="text-gray-800 text-lg font-semibold">{n.verb}</span>
                  {n.timestamp || n.created_at ? (
                    <span className="text-xs text-gray-500 mt-1">
                      {new Date(n.timestamp || n.created_at).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <button
                  className="ml-auto p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  onClick={() => handleDelete(n.id)}
                  disabled={deletingId === n.id}
                  aria-label="Delete notification"
                >
                  {deletingId === n.id ? (
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></span>
                  ) : (
                    <TrashIcon className="h-5 w-5 text-gray-400 hover:text-red-500 transition-colors" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationPage; 