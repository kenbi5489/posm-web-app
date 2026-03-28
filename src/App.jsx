import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ListView from './pages/ListView';
import LocationDetail from './pages/LocationDetail';
import MapView from './pages/MapView';
import DistrictSummary from './pages/DistrictSummary';
import AdminDashboard from './pages/AdminDashboard';
import { usePWA } from './hooks/usePWA';
import { masterReset } from './services/db';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''; 

const ProfileField = ({ label, value }) => (
  <div className="relative pl-4 border-l-4 border-primary/20">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{label}</span>
    <span className="text-sm font-bold text-slate-700">{value || 'N/A'}</span>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
};

const Profile = () => {
  const { logout, user } = useAuth();
  const { installPrompt, isInstalled, installApp } = usePWA();
  
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="flex flex-col items-center text-center space-y-4 pt-4">
          <div className="w-24 h-24 rounded-[2rem] bg-slate-100 flex items-center justify-center text-primary text-4xl font-black shadow-inner border-4 border-white">
            {user?.ho_ten?.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">{user?.ho_ten}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.role === 'admin' ? 'Quản lý / Điều phối' : 'Nhân viên hiện trường'}</p>
          </div>
        </div>
        
        <div className="mt-10 space-y-6">
          <ProfileField label="Tên đăng nhập" value={user?.user_name} />
          <ProfileField label="Email liên hệ" value={user?.email} />
          <ProfileField label="Mã nhân viên" value={user?.user_id} />
        </div>
      </div>

      <div className="space-y-3">
        {installPrompt && !isInstalled && (
          <button 
            onClick={installApp}
            className="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-premium active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 uppercase tracking-widest text-sm"
          >
            <span>Tải ứng dụng về máy</span>
            <span className="text-[10px] opacity-70 normal-case font-normal">(Cài đặt như App điện thoại)</span>
          </button>
        )}

        <button 
          onClick={logout}
          className="w-full bg-white text-red-500 font-black py-5 rounded-3xl border border-red-50 shadow-soft active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
        >
          Đăng xuất tài khoản
        </button>

        <button 
          onClick={() => {
            if(window.confirm('CẢNH BÁO: Thao tác này sẽ xóa sạch toàn bộ dữ liệu lưu trên máy và tải lại từ đầu. Bạn có chắc chắn muốn RESET không?')) {
              masterReset();
            }
          }}
          className="w-full bg-slate-50 text-slate-400 font-bold py-5 rounded-3xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
        >
          Reset hệ thống & Xóa bộ nhớ đệm
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="map" element={<MapView apiKey={GOOGLE_MAPS_API_KEY} />} />
            <Route path="list" element={<ListView />} />
            <Route path="detail/:jobCode/:brand" element={<LocationDetail />} />
            <Route path="district" element={<DistrictSummary />} />
            <Route path="admin-stats" element={<AdminDashboard />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
