import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, CircleDashed, LayoutGrid, MapPin, ListChecks, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user, selectedStaff, lastSync } = useAuth();
  const [week, setWeek] = useState('All');
  const [brand, setBrand] = useState('All');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const allData = await db.posmData.toArray();
      setData(allData);
      setLoading(false);
    };
    loadData();
  }, [lastSync]);

  const { stats, uniqueWeeks, uniqueBrands } = React.useMemo(() => {
    const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
    const staffName = selectedStaff?.ho_ten || (user.role === 'staff' ? user.ho_ten : null);
    
    let baseData = data;
    if (picId) {
      baseData = data.filter(item => item.pic_id === picId || item.pic === staffName);
    }

    const uWeeks = [...new Set(baseData.map(i => i.week))].filter(Boolean).sort();
    const uBrands = [...new Set(baseData.map(i => i.brand))].filter(Boolean).sort();

    let finalData = baseData;
    if (week !== 'All') finalData = finalData.filter(i => i.week === week);
    if (brand !== 'All') finalData = finalData.filter(i => i.brand === brand);

    const total = finalData.length;
    const done = finalData.filter(item => item.status === 'Done').length;
    
    return {
      uniqueWeeks: uWeeks,
      uniqueBrands: uBrands,
      stats: {
        total,
        done,
        pending: total - done,
        percent: Math.min(100, Math.round((done / 75) * 100))
      }
    };
  }, [data, user, selectedStaff, week, brand]);

  if (loading) return <div className="p-10 text-center animate-pulse">Đang nạp dữ liệu...</div>;

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select 
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="flex-1 h-12 px-4 bg-white border-none rounded-[1.5rem] shadow-soft text-xs font-black uppercase tracking-tight text-slate-600 focus:ring-0"
        >
          <option value="All">Tuần: Tất cả</option>
          {uniqueWeeks.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
 
        <select 
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="flex-1 h-12 px-4 bg-white border-none rounded-[1.5rem] shadow-soft text-xs font-black uppercase tracking-tight text-slate-600 focus:ring-0 max-w-[50%]"
        >
          <option value="All">Brand: Tất cả</option>
          {uniqueBrands.map(b => (
            <option key={b} value={b} className="truncate">{b}</option>
          ))}
        </select>
      </div>

      {/* Summary Grid */}
      <section className="grid grid-cols-2 gap-4">
        <StatCard 
          icon={<LayoutGrid className="text-blue-600" size={20} />} 
          label="Tổng điểm" 
          value={stats.total} 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-done" size={20} />} 
          label="Hoàn thành" 
          value={stats.done} 
          color="bg-green-50"
        />
        <StatCard 
          icon={<CircleDashed className="text-accent" size={20} />} 
          label="Chưa xong" 
          value={stats.pending} 
          color="bg-orange-50"
        />
        <StatCard 
          icon={<TrendingUp className="text-secondary" size={20} />} 
          label="Tỷ lệ xong" 
          value={`${stats.percent}%`} 
          color="bg-teal-50"
        />
      </section>

      {/* Progress Ring Section */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-soft flex flex-col items-center justify-center space-y-4 border border-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative w-48 h-48">
           <svg className="w-full h-full transform -rotate-90">
             <circle
               cx="96" cy="96" r="80"
               stroke="currentColor"
               strokeWidth="12"
               fill="transparent"
               className="text-slate-100"
             />
             <motion.circle
               cx="96" cy="96" r="80"
               stroke="currentColor"
               strokeWidth="12"
               strokeDasharray={502.6}
               initial={{ strokeDashoffset: 502.6 }}
               animate={{ strokeDashoffset: 502.6 - (502.6 * stats.percent) / 100 }}
               transition={{ duration: 1.5, ease: "easeOut" }}
               strokeLinecap="round"
               fill="transparent"
               className="text-primary"
             />
           </svg>
           <div className="absolute inset-0 flex flex-col items-center justify-center">
             <span className="text-4xl font-black text-slate-800">{stats.percent}%</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ tuần</span>
           </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Truy cập nhanh</h3>
        <div className="grid grid-cols-3 gap-4">
          <QuickLink to="/map" icon={<MapPin size={24} />} label="Bản đồ" color="bg-indigo-500" />
          <QuickLink to="/list" icon={<ListChecks size={24} />} label="Danh sách" color="bg-emerald-500" />
          {user.role === 'admin' ? (
            <QuickLink to="/admin-stats" icon={<TrendingUp size={24} />} label="Báo cáo" color="bg-indigo-700" />
          ) : (
            <QuickLink to="/district" icon={<LayoutGrid size={24} />} label="Theo quận" color="bg-amber-500" />
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className={`${color} p-5 rounded-3xl border border-white flex flex-col gap-3 shadow-soft`}>
    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  </div>
);

const QuickLink = ({ to, icon, label, color }) => (
  <Link to={to} className="flex flex-col items-center gap-2 group">
    <div className={`${color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-premium transform group-active:scale-95 transition-all`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{label}</span>
  </Link>
);

export default Dashboard;
