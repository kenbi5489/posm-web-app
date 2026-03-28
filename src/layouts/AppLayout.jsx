import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Map as MapIcon, List, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../hooks/useSync';
import { fetchUsers } from '../services/api';

const AppLayout = () => {
  const { user, selectedStaff, selectStaff } = useAuth();
  const { syncing } = useSync(user);
  const [allStaff, setAllStaff] = useState([]);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchUsers().then(data => {
        setAllStaff(data.filter(u => u.role === 'staff'));
      });
    }
  }, [isAdmin]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-soft px-4 py-3 pt-safe">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Hệ thống POSM</p>
            <h1 className="text-lg font-black text-slate-900 leading-tight">
              {isAdmin && selectedStaff ? selectedStaff.ho_ten : user?.ho_ten}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {syncing && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Đang đồng bộ" />
            )}
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-soft ${isAdmin ? 'bg-indigo-600 text-white' : 'bg-primary/10 text-primary'}`}>
              {(selectedStaff?.ho_ten || user?.ho_ten)?.charAt(0)}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              value={selectedStaff?.user_id || ''}
              onChange={(e) => {
                const staff = allStaff.find(s => s.user_id === e.target.value);
                selectStaff(staff || null);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Xem tất cả dữ liệu (Admin)</option>
              {allStaff.map(s => (
                <option key={s.user_id} value={s.user_id}>Nhân viên: {s.ho_ten}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-2 flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.03)] pb-safe z-40">
        <NavItem to="/" icon={<Home size={22} />} label="Trang chủ" />
        <NavItem to="/map" icon={<MapIcon size={22} />} label="Bản đồ" />
        <NavItem to="/list" icon={<List size={22} />} label="Danh sách" />
        <NavItem to="/profile" icon={<User size={22} />} label="Cá nhân" />
      </nav>
    </div>
  );
};

const NavItem = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center gap-1 transition-all duration-200 ${
        isActive ? 'text-primary scale-105' : 'text-slate-400'
      }`
    }
  >
    <div className="p-1 rounded-xl transition-colors">
      {icon}
    </div>
    <span className="text-[10px] font-bold tracking-tight">{label}</span>
  </NavLink>
);

export default AppLayout;
