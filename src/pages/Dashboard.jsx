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
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [allData, checkinData] = await Promise.all([
        db.posmData.toArray(),
        db.checkins ? db.checkins.toArray() : Promise.resolve([]),
      ]);
      setData(allData);
      setCheckins(checkinData);
      setLoading(false);
    };
    loadData();
  }, [lastSync]);

  const { stats, uniqueWeeks, uniqueBrands } = React.useMemo(() => {
    const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
    const staffName = selectedStaff?.ho_ten || (user.role === 'staff' ? user.ho_ten : null);
    
    let baseData = data;
    if (picId || staffName) {
      const matchId = picId ? picId.toString().trim() : null;
      const normalizedStaffName = staffName ? staffName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : null;

      baseData = data.filter(item => {
        const itemPicId = (item.pic_id || '').toString().trim();
        const matchById = matchId && itemPicId && (itemPicId === matchId);
        
        const itemPic = item.pic ? item.pic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        const matchByName = normalizedStaffName && itemPic && (itemPic === normalizedStaffName || itemPic.includes(normalizedStaffName) || normalizedStaffName.includes(itemPic));

        return matchById || matchByName;
      });
    }

    const uWeeks = [...new Set(baseData.map(i => i.week))].filter(Boolean).sort((a, b) => {
      const nA = parseInt((a || '').replace(/\D/g, ''), 10) || 0;
      const nB = parseInt((b || '').replace(/\D/g, ''), 10) || 0;
      return nA - nB;
    });
    const uBrands = [...new Set(baseData.map(i => i.brand))].filter(Boolean).sort();

    let finalData = baseData;
    if (week !== 'All') finalData = finalData.filter(i => i.week === week);
    if (brand !== 'All') finalData = finalData.filter(i => i.brand === brand);

    const total = finalData.length;
    const done = finalData.filter(item => item.status === 'Done').length;
    const verified = finalData.filter(item => item.status === 'Done' && item.verified).length;
    const review = finalData.filter(item => item.status === 'Done' && !item.verified).length;
    
    // Performance score: 75 points = 100%
    const performanceScore = Math.min(100, Math.round((done / 75) * 100));

    return {
      uniqueWeeks: uWeeks,
      uniqueBrands: uBrands,
      stats: {
        total,
        done,
        pending: total - done,
        percent: performanceScore,
        verified,
        review,
      }
    };
  }, [data, checkins, user, selectedStaff, week, brand]);

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
          icon={<LayoutGrid className="text-indigo-600" size={20} />}
          label="Tổng số điểm"
          value={stats.total}
          color="bg-indigo-50"
        />
        <StatCard
          icon={<CheckCircle2 className="text-emerald-600" size={20} />}
          label="Đã hoàn thành"
          value={stats.done}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<CircleDashed className="text-amber-600" size={20} />}
          label="Cần thực hiện"
          value={stats.pending}
          color="bg-amber-50"
        />
        <StatCard
          icon={<TrendingUp className="text-blue-600" size={20} />}
          label="Hiệu suất tuyến"
          value={`${stats.percent}%`}
          color="bg-blue-50"
        />
      </section>

      {/* Progress Ring Section */}
      <div id="tour-progress-card" className="bg-white p-8 rounded-[2.5rem] shadow-soft flex flex-col items-center justify-center space-y-4 border border-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
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
               strokeLinecap="round"
               stroke="currentColor"
               strokeWidth="12"
               fill="transparent"
               initial={{ strokeDasharray: "0, 502" }}
               animate={{ strokeDasharray: `${(stats.percent * 5.02)}, 502` }}
               transition={{ duration: 1, ease: "easeOut" }}
               className="text-indigo-600"
             />
           </svg>
           <div className="absolute inset-0 flex flex-col items-center justify-center">
             <div className="text-4xl font-black text-slate-800 tracking-tighter">
               {stats.percent}%
             </div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               Hoàn thành
             </div>
           </div>
        </div>
        <Link to="/map" className="w-full py-4 bg-indigo-600 text-white text-center font-black rounded-2xl shadow-premium-indigo active:scale-95 transition-all text-sm uppercase tracking-widest">
            Chạy tuyến ngay
        </Link>
      </div>

      {/* Quick Access */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">TRUY CẬP NHANH</h3>
        <div className="grid grid-cols-4 gap-4">
          <QuickLink to="/overview" icon={<TrendingUp size={24} />} label="Tổng quan" color="bg-[#0f3460]" />
          <QuickLink to="/map" icon={<MapPin size={24} />} label="Tuyến đường" color="bg-indigo-600" />
          <QuickLink to="/list" icon={<ListChecks size={24} />} label="Danh sách" color="bg-slate-800" />
          {user.role === 'admin' ? (
            <QuickLink to="/admin-stats" icon={<LayoutGrid size={24} />} label="Báo cáo" color="bg-indigo-900" />
          ) : (
            <QuickLink to="/district" icon={<LayoutGrid size={24} />} label="Bộ lọc" color="bg-amber-500" />
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
