import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ListView = React.lazy(() => import('./pages/ListView'));
const LocationDetail = React.lazy(() => import('./pages/LocationDetail'));
const MapView = React.lazy(() => import('./pages/MapView'));
const DistrictSummary = React.lazy(() => import('./pages/DistrictSummary'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const OverviewDashboard = React.lazy(() => import('./pages/OverviewDashboard'));
import { usePWA } from './hooks/usePWA';
import { masterReset } from './services/db';

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

const ManualInstallGuide = ({ platform }) => {
  if (platform === 'ios') {
    return (
      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-3">
        <h4 className="text-sm font-black text-blue-900 uppercase tracking-wider flex items-center gap-2">
          <span>📱 Hướng dẫn cài đặt iPhone</span>
        </h4>
        <div className="space-y-4 text-xs font-bold text-blue-700 leading-relaxed">
          <div className="flex gap-3">
            <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">1</span>
            <p>Mở bằng trình duyệt <span className="underline">Safari</span></p>
          </div>
          <div className="flex gap-3">
            <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">2</span>
            <p>Bấm nút <span className="bg-white px-2 py-0.5 rounded shadow-sm">Chia sẻ (Share)</span> ở cạnh dưới màn hình</p>
          </div>
          <div className="flex gap-3">
            <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">3</span>
            <p>Chọn <span className="bg-white px-2 py-0.5 rounded shadow-sm">Thêm vào MH chính (Add to Home Screen)</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'android') {
    return (
      <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-3">
        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
          <span>🤖 Hướng dẫn cài đặt Android</span>
        </h4>
        <div className="space-y-4 text-xs font-bold text-indigo-700 leading-relaxed">
          <div className="flex gap-3">
            <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center shrink-0">1</span>
            <p>Mở bằng trình duyệt <span className="underline">Google Chrome</span></p>
          </div>
          <div className="flex gap-3">
            <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center shrink-0">2</span>
            <p>Bấm biểu tượng <span className="bg-white px-2 py-0.5 rounded shadow-sm">3 chấm (⋮)</span> ở góc trên phải</p>
          </div>
          <div className="flex gap-3">
            <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center shrink-0">3</span>
            <p>Chọn <span className="bg-white px-2 py-0.5 rounded shadow-sm">Cài đặt ứng dụng (Install App)</span></p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const Profile = () => {
  const { logout, user } = useAuth();
  const { installPrompt, isInstalled, installApp, platform } = usePWA();
  
  return (
    <div className="p-6 space-y-6 animate-fade-in pb-20">
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

      <div className="space-y-4">
        {!isInstalled && (
          <div className="space-y-3">
            {installPrompt ? (
              <button 
                onClick={installApp}
                className="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-premium active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 uppercase tracking-widest text-sm"
              >
                <span>Tải ứng dụng về máy</span>
                <span className="text-[10px] opacity-70 normal-case font-normal">(Cài đặt tự động nhanh)</span>
              </button>
            ) : (
              <ManualInstallGuide platform={platform} />
            )}
          </div>
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

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="map" element={<MapView />} />
            <Route path="list" element={<ListView />} />
            <Route path="detail/:jobCode/:brand" element={<LocationDetail />} />
            <Route path="district" element={<DistrictSummary />} />
            <Route path="admin-stats" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="overview" element={<OverviewDashboard />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
