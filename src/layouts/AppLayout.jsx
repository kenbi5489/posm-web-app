import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Map as MapIcon, List, User, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSyncContext } from '../context/SyncContext';
import { fetchUsers } from '../services/api';
import { motion } from 'framer-motion';

const AppLayout = () => {
  const { user, selectedStaff, selectStaff } = useAuth();
  const { syncing, pullData } = useSyncContext();
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
      <header className="sticky top-0 z-50 bg-white px-6 py-4 pt-safe">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Hệ thống POSM</p>
            <h1 className="text-2xl font-black text-slate-900 leading-none">
              {isAdmin && selectedStaff ? selectedStaff.ho_ten : user?.ho_ten}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => pullData()}
                className={`p-1 text-slate-300 ${syncing ? 'animate-spin' : ''}`}
             >
                <Users size={22} />
             </button>
             <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-indigo-100">
                {(selectedStaff?.ho_ten || user?.ho_ten)?.charAt(0)}
             </div>
          </div>
        </div>

        {isAdmin && (
          <div className="relative group">
            <select 
              value={selectedStaff?.user_id || ''}
              onChange={(e) => {
                const staff = allStaff.find(s => s.user_id === e.target.value);
                selectStaff(staff || null);
              }}
              className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-500 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-50 transition-all"
            >
              <option value="">Xem tất cả dữ liệu (Admin)</option>
              {allStaff.map(s => (
                <option key={s.user_id} value={s.user_id}>Nhân viên: {s.ho_ten}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 flex flex-col -space-y-1">
               <ChevronRight size={14} className="-rotate-90" />
               <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-8 py-2 flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.03)] pb-safe z-40">
        <NavItem to="/" icon={<Home size={22} />} label="Trang chủ" />
        <NavItem to="/map" icon={<MapIcon size={22} />} label="Tuyến đường" />
        <NavItem to="/list" icon={<List size={22} />} label="Chi tiết" />
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
