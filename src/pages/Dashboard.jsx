import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../hooks/useSync';
import { CheckCircle2, CircleDashed, LayoutGrid, MapPin, TrendingUp, Zap, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ReportModal from '../components/ReportModal';
import { getCurrentWeekLabel, getActiveWeeks, isSameWeek } from '../utils/weekUtils';

const stripAccents = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') || '';

const Dashboard = () => {
  const { user, selectedStaff, lastSync, localRefreshTick } = useAuth();
  const { syncing, pullData, clearAndResync, pullAcceptanceOnly } = useSync(user);
  const [week, setWeek] = useState('All');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [brand, setBrand] = useState('All');
  const [stats, setStats] = useState({ assignedTotal: 0, assignedPending: 0, totalDone: 0, adhocDone: 0, umsDone: 0, percent: 0, efficiency: 0, priorityPending: 0 });
  const [uniqueWeeks, setUniqueWeeks] = useState([]);
  const [uniqueBrands, setUniqueBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawItems, setRawItems] = useState([]);
  const [adhocRawItems, setAdhocRawItems] = useState([]);
  const [diag, setDiag] = useState(null);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    const info = localStorage.getItem('sync_diag');
    if (info) setDiag(JSON.parse(info));
  }, [lastSync]);

  // 1. Fetch Data and discover weeks
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await db.posmData.toArray();
        let adhocData = [];
        try { if (db.adhocPoints) adhocData = await db.adhocPoints.toArray(); } catch (e) { console.warn(e); }
        
        const activeStaff = selectedStaff || (user.role === 'staff' ? user : null);
        const pidNorm = String(activeStaff?.user_id || '').trim().toLowerCase();
        const pNameNorm = stripAccents(activeStaff?.ho_ten || '').toLowerCase().trim();

        const picFilter = (i) => {
          const mPId = String(i.pic_id || '').trim().toLowerCase();
          const mPName = stripAccents(i.pic || '').toLowerCase().trim();
          return (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
        };

        // RULE: Trust db.posmData directly to count every row (avoiding Map-based deduplication errors)
        const items = activeStaff ? allData.filter(picFilter) : allData;
        const adhocItems = activeStaff ? adhocData.filter(picFilter) : adhocData;

        // Week Discovery
        const allWeeksFound = [...new Set(allData.map(i => i.week))].filter(Boolean).sort();
        const activeSystemWeeks = getActiveWeeks(); 
        const dataWeeks = allWeeksFound.filter(w => Boolean(w) && !w.includes('??'));
        
        const sortedWeeks = [...new Set([...activeSystemWeeks, ...dataWeeks])]
          .sort((a, b) => {
            const isAActive = activeSystemWeeks.some(w => isSameWeek(w, a));
            const isBActive = activeSystemWeeks.some(w => isSameWeek(w, b));
            if (isAActive && !isBActive) return -1;
            if (!isAActive && isBActive) return 1;
            
            const numA = parseInt(String(a).match(/\d+/)?.[0]) || 0;
            const numB = parseInt(String(b).match(/\d+/)?.[0]) || 0;
            return numB - numA;
          });

        const brands = [...new Set(items.map(i => i.brand))].filter(Boolean).sort();

        const visibleWeeks = sortedWeeks.slice(0, 2);
        setUniqueWeeks(visibleWeeks);
        setUniqueBrands(brands);
        setRawItems(items); 
        setAdhocRawItems(adhocItems); 
        
        // Auto-select the newest week
        if (visibleWeeks.length > 0) setWeek(visibleWeeks[0]);
        else setWeek('All');

        setDiag({ 
          user: `${pidNorm} - ${pNameNorm}`, 
          total: allData.length, 
          weeks: sortedWeeks.join(', '),
          userMatches: items.length
        });

      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [localRefreshTick, selectedStaff, user, lastSync]);

  // 2. Calculate Stats based on filters
  useEffect(() => {
    let filtered = rawItems;
    if (week !== 'All') filtered = filtered.filter(i => isSameWeek(i.week, week));
    if (brand !== 'All') filtered = filtered.filter(i => i.brand === brand);

    // Differentiate between assigned missions and ad-hoc points
    const assignedFiltered = filtered.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_'));
    const syncedAdhocs = filtered.filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'));
    
    // Process Ad-hoc points (Sync + Local)
    const adhocMap = new Map();
    syncedAdhocs.forEach(i => adhocMap.set(i.job_code, { ...i }));
    
    // Filter local adhocRawItems by week if necessary
    let localAdhocFinal = adhocRawItems;
    if (week !== 'All') {
      localAdhocFinal = localAdhocFinal.filter(i => isSameWeek(i.week, week));
    }
    localAdhocFinal.forEach(i => {
      if (!adhocMap.has(i.job_code)) adhocMap.set(i.job_code, i);
    });

    const adhocFiltered = Array.from(adhocMap.values());
    
    // Numerical aggregation
    const assignedTotal = assignedFiltered.length;
    const assignedDone = assignedFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const assignedPending = assignedTotal - assignedDone;
    const adhocDone = adhocFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const totalDone = assignedDone + adhocDone;
    
    // UMS / UrPoint project tracking
    const umsDone = [...assignedFiltered, ...adhocFiltered].filter(i => 
      i.status?.toLowerCase() === 'done' && (i.project || '').toLowerCase().includes('point')
    ).length;

    const completionRate = Math.min(100, Math.round((totalDone / 75) * 100));
    const efficiency = assignedTotal > 0 ? Math.min(100, Math.round((assignedDone / assignedTotal) * 100)) : 0;
    const priorityPending = filtered.filter(i => i.priority && i.status?.toLowerCase() !== 'done').length;
    
    setStats({ assignedTotal, assignedPending, totalDone, adhocDone, umsDone, percent: completionRate, efficiency, priorityPending });
  }, [rawItems, adhocRawItems, week, brand]);

  const StatCard = ({ icon, label, value, accent }) => {
    const colors = {
      indigo: "bg-indigo-50 border-indigo-100 text-indigo-600 shadow-indigo-100/50",
      emerald: "bg-emerald-50 border-emerald-100 text-emerald-600 shadow-emerald-100/50",
      amber: "bg-amber-50 border-amber-100 text-amber-600 shadow-amber-100/50",
      violet: "bg-violet-50 border-violet-100 text-violet-600 shadow-violet-100/50",
    };
    const c = colors[accent] || colors.indigo;
    return (
      <div className={`${c} p-5 rounded-[2.5rem] border-2 shadow-lg flex flex-col gap-3 transition-transform hover:scale-[1.02]`}>
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">{icon}</div>
        </div>
        <div>
          <div className="text-2xl font-black tracking-tighter leading-none">{value}</div>
          <div className="text-[10px] font-black uppercase tracking-widest mt-1.5 opacity-60">{label}</div>
        </div>
      </div>
    );
  };

  const UMSCard = ({ value }) => (
    <div className="col-span-2 bg-gradient-to-r from-indigo-500 to-violet-600 p-6 rounded-[2.5rem] shadow-xl shadow-indigo-200 text-white relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all" />
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
            <Star className="text-white fill-white" size={28} />
          </div>
          <div>
            <h3 className="font-black text-xl uppercase tracking-tighter leading-none">TASK TEAM UMS</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5 opacity-80">UrPoint Completed</p>
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-black tracking-tighter">{value}</span>
          <span className="text-xs font-black opacity-60 uppercase tracking-widest">Điểm</span>
        </div>
      </div>
    </div>
  );

  if (loading && rawItems.length === 0) return (
    <div className="p-12 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tính toán số liệu...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-24">
      {stats.priorityPending > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] shadow-lg shadow-amber-100/50 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 transform -rotate-6 border-4 border-white">
              <Zap className="text-white fill-white" size={28} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-amber-900 uppercase tracking-tighter text-lg leading-none">Điểm ưu tiên!</h3>
              <p className="text-xs font-bold text-amber-700 mt-1 opacity-80">Bạn đang có <span className="text-amber-900 text-sm font-black underline">{stats.priorityPending}</span> điểm ưu tiên chưa thực hiện.</p>
            </div>
          </div>
          <Link to="/list" onClick={() => { sessionStorage.setItem('lv_status', 'pending'); sessionStorage.setItem('lv_week', 'All'); }} className="w-full bg-white text-amber-600 font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm border border-amber-100">
            Xem danh sách ngay <TrendingUp size={14} />
          </Link>
        </motion.div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lọc theo Tuần</label>
        <select value={week} onChange={(e) => setWeek(e.target.value)} className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-xs font-black text-slate-700 outline-none shadow-sm">
          {uniqueWeeks.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<LayoutGrid size={18} />} label="Điểm phân bổ" value={stats.assignedTotal} accent="indigo" />
        <StatCard icon={<CircleDashed size={18} />} label="Cần thực hiện" value={stats.assignedPending} accent="amber" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Hoàn thành" value={stats.totalDone} accent="emerald" />
        <StatCard icon={<MapPin size={18} />} label="Điểm ngoài" value={stats.adhocDone} accent="violet" />
        <UMSCard value={stats.umsDone} />
      </section>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50 relative overflow-hidden">
        <div className="flex gap-4 items-center justify-center">
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="52" stroke="currentColor" strokeWidth="9" fill="transparent" className="text-slate-100" />
                <motion.circle cx="64" cy="64" r="52" strokeLinecap="round" stroke="currentColor" strokeWidth="9" fill="transparent" initial={{ strokeDasharray: "0, 327" }} animate={{ strokeDasharray: `${(stats.efficiency * 3.27)}, 327` }} className="text-amber-500" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-black text-slate-800 tracking-tighter">{stats.efficiency}%</div>
              </div>
            </div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Hiệu suất</p>
          </div>
          <div className="w-px h-24 bg-slate-100" />
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="52" stroke="currentColor" strokeWidth="9" fill="transparent" className="text-slate-100" />
                <motion.circle cx="64" cy="64" r="52" strokeLinecap="round" stroke="currentColor" strokeWidth="9" fill="transparent" initial={{ strokeDasharray: "0, 327" }} animate={{ strokeDasharray: `${(stats.percent * 3.27)}, 327` }} className="text-indigo-600" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-black text-slate-800 tracking-tighter">{stats.percent}%</div>
              </div>
            </div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Hoàn thành</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <Link to="/list" className="bg-indigo-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center shadow-lg shadow-indigo-200">
            Tuyến đường
          </Link>
          <button onClick={() => setIsReportModalOpen(true)} className="bg-emerald-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center shadow-lg shadow-emerald-200">
            Báo cáo điểm mới
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 pt-4">
        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Hệ thống POSM</h4>
        <button onClick={() => setShowDiag(!showDiag)} className="text-[10px] font-black text-slate-300 uppercase underline decoration-2 underline-offset-4">
          {showDiag ? 'Thu gọn' : 'Chẩn đoán'}
        </button>
      </div>

      {showDiag && diag && (
        <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] space-y-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap size={12} /> Chẩn đoán hệ thống
          </h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">User Detected</p>
              <p className="text-[11px] font-black text-slate-700">{diag.user}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Rows in DB</p>
              <p className="text-[11px] font-black text-slate-700">{diag.total}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Matched for User</p>
              <p className="text-[11px] font-black text-indigo-600">{diag.userMatches} items</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Weeks in DB</p>
              <p className="text-[11px] font-black text-slate-700 break-words">{diag.weeks}</p>
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <ReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          initialData={{ is_adhoc: true, week: getCurrentWeekLabel() }} 
        />
      )}
    </div>
  );
};

export default Dashboard;
