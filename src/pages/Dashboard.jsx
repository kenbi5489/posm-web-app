import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../hooks/useSync';
import { CheckCircle2, CircleDashed, LayoutGrid, MapPin, ListChecks, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const stripAccents = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') || '';

const Dashboard = () => {
  const { user, selectedStaff } = useAuth();
  const { syncing, lastSync, clearAndResync } = useSync(user);
  const [week, setWeek] = useState('All');
  const [brand, setBrand] = useState('All');
  const [stats, setStats] = useState({ assignedTotal: 0, assignedPending: 0, totalDone: 0, adhocDone: 0, percent: 0, efficiency: 0 });
  const [uniqueWeeks, setUniqueWeeks] = useState([]);
  const [uniqueBrands, setUniqueBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawItems, setRawItems] = useState([]);
  const [diag, setDiag] = useState(null);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    const info = localStorage.getItem('sync_diag');
    if (info) setDiag(JSON.parse(info));
  }, [lastSync]);

  // Data auto-fetches from useSync on login. Re-render triggered by lastSync change.

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
        
        // Fetch ALL data and filter in JS for robustness (handling case/space variations)
        const allItems = await db.posmData.toArray();
        let items = allItems;

        if (picId) {
          const pidNorm = String(picId).trim().toLowerCase();
          const pName = stripAccents(user?.ho_ten || selectedStaff?.ho_ten || '').toLowerCase().trim();

          items = allItems.filter(i => {
             const mPId = String(i.pic_id || '').trim().toLowerCase();
             const mPName = stripAccents(i.pic || '').toLowerCase().trim();
             return (pidNorm && mPId && mPId === pidNorm) || (pName && mPName && mPName === pName);
          });
        }

        setRawItems(items);

        // Derive unique values for filters (Weeks from ALL items to show missing weeks too)
        const weeks = [...new Set(allItems.map(i => i.week))].filter(Boolean).sort((a,b) => {
            const numA = parseInt(String(a).match(/\d+/)?.[0]) || 0;
            const numB = parseInt(String(b).match(/\d+/)?.[0]) || 0;
            return numA - numB;
        });
        const brands = [...new Set(items.map(i => i.brand))].filter(Boolean).sort();
        
        setUniqueWeeks(weeks);
        setUniqueBrands(brands);

        // Set default week to latest if not set
        if (week === 'All' && weeks.length > 0) {
           const latest = weeks.slice(-1)[0];
           setWeek(latest);
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [lastSync, selectedStaff, user]);

  // 2. Calculate Stats based on filters
  useEffect(() => {
    let filtered = rawItems;
    if (week !== 'All') filtered = filtered.filter(i => i.week === week);
    if (brand !== 'All') filtered = filtered.filter(i => i.brand === brand);

    const assignedFiltered = filtered.filter(i => !i.is_virtual && !String(i.job_code || '').startsWith('NEW_'));
    const adhocFiltered = filtered.filter(i => i.is_virtual || String(i.job_code || '').startsWith('NEW_'));

    const assignedTotal = assignedFiltered.length;
    const assignedDone = assignedFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const assignedPending = assignedTotal - assignedDone;

    const adhocDone = adhocFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const totalDone = assignedDone + adhocDone;
    
    // Tỉ lệ hoàn thành: 75 points = 100%
    const completionRate = Math.min(100, Math.round((totalDone / 75) * 100));
    
    // Hiệu suất tuyến: % on total assigned (excluding adhoc)
    const efficiency = assignedTotal > 0 ? Math.round((assignedDone / assignedTotal) * 100) : 0;

    setStats({
      assignedTotal,
      assignedPending,
      totalDone,
      adhocDone,
      percent: completionRate,
      efficiency
    });
  }, [rawItems, week, brand]);

  if (loading && rawItems.length === 0) return (
    <div className="p-12 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tính toán số liệu...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-24">
      {/* Header - sync status only */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {syncing && (
           <span className="text-xs text-indigo-500 font-medium flex items-center gap-1 animate-pulse">
              <CircleDashed size={14} className="animate-spin" />
              Đang đồng bộ...
           </span>
        )}
        {lastSync && !syncing && diag?.source === 'MOCK' && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full animate-pulse">
            MOCK DATA ACTIVE
          </span>
        )}
        <button 
          onClick={() => setShowDiag(!showDiag)}
          className="p-1"
          title="Diagnostics"
          style={{ opacity: 0, width: 10, height: 10 }} // Invisible debug toggle
        >
            <CircleDashed size={10} />
          </button>
        </div>

      {/* Diagnostic Panel */}
      {showDiag && diag && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-slate-900 text-slate-300 rounded-2xl shadow-xl font-mono text-sm overflow-hidden"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-indigo-400 font-bold uppercase tracking-wider">Hệ thống chẩn đoán Sync</h3>
            <span className={`px-2 py-1 rounded text-xs font-bold ${diag.source === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              SOURCE: {diag.source}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p>• Tổng nhiệm vụ: <span className="text-white">{diag.rows_mission}</span></p>
              <p>• Tổng báo cáo: <span className="text-white">{diag.rows_reports}</span></p>
              <p>• Đã khớp thành công: <span className="text-white">{diag.matches}</span></p>
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Phân bổ theo Tuần (Column AJ)</p>
                <div className="space-y-1">
                   {diag.weekly_stats?.map(ws => (
                     <div key={ws.week} className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{ws.week}:</span>
                        <span className="text-white font-bold">{ws.matches} / {ws.total}</span>
                     </div>
                   ))}
                </div>
              </div>
            </div>
            <div>
              <p className="text-indigo-400 mb-1">Cột được nhận diện (15 đầu):</p>
              <p className="text-[10px] leading-tight opacity-70 italic">
                {diag.headers_mission.join(', ')}
              </p>
            </div>
          </div>
          {diag.unmatched?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-rose-400 mb-1 italic">Mã lỗi không khớp (10 đầu):</p>
              <p className="text-xs">{diag.unmatched.join(', ')}</p>
            </div>
          )}
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="mt-6 w-full py-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 rounded-lg transition-colors text-xs font-bold uppercase"
          >
             Xóa toàn bộ bộ nhớ & Tải lại App
          </button>
        </motion.div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lọc theo Tuần</label>
            <select 
                value={week} 
                onChange={(e) => setWeek(e.target.value)}
                className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-xs font-black text-slate-700 outline-none shadow-sm"
            >
                <option value="All">Tất cả tuần</option>
                {uniqueWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
        </div>
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lọc theo Brand</label>
            <select 
                value={brand} 
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-xs font-black text-slate-700 outline-none shadow-sm"
            >
                <option value="All">Tất cả Brand</option>
                {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <StatCard icon={<LayoutGrid className="text-indigo-600" size={20} />} label="Điểm phân bổ" value={stats.assignedTotal} color="bg-indigo-50" />
        <StatCard icon={<CircleDashed className="text-amber-600" size={20} />} label="Cần thực hiện" value={stats.assignedPending} color="bg-amber-50" />
        
        <StatCard icon={<CheckCircle2 className="text-emerald-600" size={20} />} label="Tổng hoàn thành" value={stats.totalDone} color="bg-emerald-50" />
        <StatCard icon={<MapPin className="text-violet-600" size={20} />} label="Điểm đi ngoài danh sách" value={stats.adhocDone} color="bg-violet-50" />
        
        <div className="col-span-2">
            <StatCard icon={<TrendingUp className="text-blue-600" size={20} />} label="Hiệu suất đi tuyến" value={`${stats.efficiency}%`} color="bg-blue-50" />
        </div>
      </section>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-soft flex flex-col items-center justify-center space-y-4 border border-slate-50 relative overflow-hidden">
        <div className="relative w-48 h-48">
           <svg className="w-full h-full transform -rotate-90">
             <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
             <motion.circle
               cx="96" cy="96" r="80" strokeLinecap="round" stroke="currentColor" strokeWidth="12" fill="transparent"
               initial={{ strokeDasharray: "0, 502" }}
               animate={{ strokeDasharray: `${(stats.percent * 5.02)}, 502` }}
               transition={{ duration: 1 }}
               className="text-indigo-600"
             />
           </svg>
           <div className="absolute inset-0 flex flex-col items-center justify-center">
             <div className="text-4xl font-black text-slate-800 tracking-tighter">{stats.percent}%</div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hoàn thành</div>
           </div>
        </div>
        <Link to="/map" className="w-full py-4 bg-indigo-600 text-white text-center font-black rounded-2xl shadow-premium-indigo active:scale-95 transition-all text-sm uppercase tracking-widest">Chạy tuyến ngay</Link>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">TRUY CẬP NHANH</h3>
        <div className="grid grid-cols-4 gap-4">
          <QuickLink to="/overview" icon={<TrendingUp size={24} />} label="Tổng quan" color="bg-[#0f3460]" />
          <QuickLink to="/map" icon={<MapPin size={24} />} label="Tuyến đường" color="bg-indigo-600" />
          <QuickLink to="/list" icon={<ListChecks size={24} />} label="Chi tiết" color="bg-slate-800" />
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
    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  </div>
);

const QuickLink = ({ to, icon, label, color }) => (
  <Link to={to} className="flex flex-col items-center gap-2 group">
    <div className={`${color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-premium transform group-active:scale-95 transition-all`}>{icon}</div>
    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{label}</span>
  </Link>
);

export default Dashboard;
