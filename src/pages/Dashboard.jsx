import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../hooks/useSync';
import { CheckCircle2, CircleDashed, LayoutGrid, MapPin, ListChecks, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ReportModal from '../components/ReportModal';
import { getCurrentWeekLabel } from '../utils/weekUtils';

const stripAccents = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') || '';

const Dashboard = () => {
  const { user, selectedStaff } = useAuth();
  const { syncing, lastSync, clearAndResync } = useSync(user);
  const [week, setWeek] = useState('All');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [brand, setBrand] = useState('All');
  const [stats, setStats] = useState({ assignedTotal: 0, assignedPending: 0, totalDone: 0, adhocDone: 0, percent: 0, efficiency: 0, priorityPending: 0 });
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

  // Data auto-fetches from useSync on login. Re-render triggered by lastSync change.
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

        console.log('--- DASHBOARD FETCH PIPELINE ---');
        console.log(
          'ALL NEW_ BEFORE PIC FILTER (slim):',
          allData
            .filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'))
            .map(i => ({
              job_code: i.job_code,
              pic_id: i.pic_id,
              pic: i.pic,
              week: i.week,
              brand: i.brand,
              status: i.status
            }))
        );

        console.log('FILTER PARAMS:', {
          pidNorm,
          pNameNorm,
          activeStaff
        });

        const items = activeStaff ? allData.filter(i => {
          const mPId = String(i.pic_id || '').trim().toLowerCase();
          const mPName = stripAccents(i.pic || '').toLowerCase().trim();
          return (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
        }) : allData;

        console.log(
          'NEW_ AFTER PIC FILTER (slim):',
          items
            .filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'))
            .map(i => ({
              job_code: i.job_code,
              pic_id: i.pic_id,
              pic: i.pic,
              week: i.week,
              brand: i.brand,
              status: i.status
            }))
        );

        const adhocItems = activeStaff ? adhocData.filter(i => {
          const mPId = String(i.pic_id || '').trim().toLowerCase();
          const mPName = stripAccents(i.pic || '').toLowerCase().trim();
          return (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
        }) : adhocData;

        setRawItems(items);
        setAdhocRawItems(adhocItems);

        // Derive unique values for filters (Weeks from ALL items to show missing weeks too)
        const weeks = [...new Set(allData.map(i => i.week))].filter(Boolean).sort((a, b) => {
          const numA = parseInt(String(a).match(/\d+/)?.[0]) || 0;
          const numB = parseInt(String(b).match(/\d+/)?.[0]) || 0;
          return numA - numB;
        });
        const brands = [...new Set(items.map(i => i.brand))].filter(Boolean).sort();

        setUniqueWeeks(weeks);
        setUniqueBrands(brands);

        // Set default week to current week instead of just the maximum available
        if (week === 'All' && weeks.length > 0) {
          const currentLabel = getCurrentWeekLabel();
          const currentWeekMatch = weeks.find(w => w.startsWith(currentLabel));

          if (currentWeekMatch) {
            setWeek(currentWeekMatch);
          } else {
            const latest = weeks.slice(-1)[0];
            setWeek(latest);
          }
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

    const assignedFiltered = filtered.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_'));

    // adhoc: combine synced from Master (is_virtual) and local adhocPoints DB
    let syncedAdhocs = rawItems.filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'));
    let adhocLocal = adhocRawItems;

    if (week !== 'All') {
      const targetWeekNum = parseInt(String(week).match(/\d+/)?.[0]) || 0;
      const weekMatcher = (i) => {
        const n = parseInt(String(i.week).match(/\d+/)?.[0]) || 0;
        return n === targetWeekNum;
      };
      syncedAdhocs = syncedAdhocs.filter(weekMatcher);
      adhocLocal = adhocLocal.filter(weekMatcher);
    }
    if (brand !== 'All') {
      syncedAdhocs = syncedAdhocs.filter(i => i.brand === brand);
      adhocLocal = adhocLocal.filter(i => i.brand === brand);
    }

    const adhocMap = new Map();
    // Synced ones first
    syncedAdhocs.forEach(item => { if (item.job_code) adhocMap.set(item.job_code, item); });
    // Local ones (will overwrite synced ones if same job_code, ensuring freshest local state)
    adhocLocal.forEach(item => { if (item.job_code) adhocMap.set(item.job_code, item); });

    const adhocFiltered = Array.from(adhocMap.values());

    const assignedTotal = assignedFiltered.length;
    const assignedDone = assignedFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const assignedPending = assignedTotal - assignedDone;

    const adhocDone = adhocFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const totalDone = assignedDone + adhocDone;

    // Tỉ lệ hoàn thành: 75 points = 100%
    const completionRate = Math.min(100, Math.round((totalDone / 75) * 100));

    // Hiệu suất tuyến: strictly (QCxxx done) / (QCxxx total in THIS week)
    // Must exclude NEW_ (adhoc) in both numerator and denominator
    const efficiency = assignedTotal > 0 ? Math.min(100, Math.round((assignedDone / assignedTotal) * 100)) : 0;

    const priorityPending = filtered.filter(i => i.priority && i.status?.toLowerCase() !== 'done').length;
    
    setStats({
      assignedTotal,
      assignedPending,
      totalDone,
      adhocDone,
      percent: completionRate,
      efficiency,
      priorityPending
    });
  }, [rawItems, adhocRawItems, week, brand]);

  if (loading && rawItems.length === 0) return (
    <div className="p-12 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tính toán số liệu...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-24">
      {/* Priority Alert Banner */}
      {stats.priorityPending > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] shadow-lg shadow-amber-100/50 flex flex-col gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 transform -rotate-6 border-4 border-white">
              <Zap className="text-white fill-white" size={28} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-amber-900 uppercase tracking-tighter text-lg leading-none">Điểm ưu tiên!</h3>
              <p className="text-xs font-bold text-amber-700 mt-1 opacity-80">
                Bạn đang có <span className="text-amber-900 text-sm font-black underline">{stats.priorityPending}</span> điểm ưu tiên chưa thực hiện.
              </p>
            </div>
          </div>
          <Link 
            to="/list"
            onClick={() => sessionStorage.setItem('lv_status', 'pending')}
            className="w-full bg-white text-amber-600 font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all border border-amber-100"
          >
            Xem danh sách ngay <TrendingUp size={14} />
          </Link>
        </motion.div>
      )}
      {/* Sync Status Bar - always visible, expandable */}
      {diag && (
        <div className="space-y-2 mb-4">
          <button
            onClick={() => setShowDiag(!showDiag)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border ${
              diag.source === 'LIVE'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-rose-50 border-rose-100 text-rose-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${diag.source === 'LIVE' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              <span className="uppercase tracking-widest text-[10px] font-black">
                {diag.source === 'LIVE'
                  ? `LIVE · ${diag.rows_mission?.toLocaleString()} dòng`
                  : 'MOCK DATA · Kết nối thất bại'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {syncing && <span className="opacity-60 animate-pulse">Đang sync...</span>}
              <button
                onClick={(e) => { e.stopPropagation(); clearAndResync(); }}
                disabled={syncing}
                className="text-[10px] font-black uppercase tracking-wider opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
              >
                Sync lại
              </button>
              <span className="text-[10px] opacity-40">{showDiag ? '▲' : '▼'}</span>
            </div>
          </button>

          {showDiag && (
            <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl font-mono text-[10px] space-y-3">
              <div>
                <p className="text-indigo-400 font-bold uppercase mb-1">Phân bổ theo Tuần</p>
                {diag.weekly_stats?.length > 0 ? (
                  <div className="space-y-1">
                    {diag.weekly_stats.map(ws => (
                      <div key={ws.week} className="flex justify-between">
                        <span className="text-slate-400">{ws.week}:</span>
                        <span className="text-white font-bold">{ws.total} điểm</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-rose-400">Không có tuần nào → Cột tuần không khớp!</p>}
              </div>
              <div>
                <p className="text-indigo-400 font-bold uppercase mb-1">Cột nhận diện được</p>
                <p className="text-slate-400 italic leading-relaxed">{diag.headers_mission?.join(', ')}</p>
              </div>
              <button
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="w-full py-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 rounded-lg transition-colors text-[10px] font-bold uppercase"
              >
                Xóa toàn bộ bộ nhớ & Tải lại App
              </button>
            </div>
          )}
        </div>
      )}
      {!diag && syncing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold border mb-4 bg-indigo-50 border-indigo-100 text-indigo-600">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span className="uppercase tracking-widest text-[10px] font-black animate-pulse">Đang tải dữ liệu lần đầu...</span>
        </div>
      )}

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

      <section className="grid grid-cols-2 gap-4">
        <StatCard icon={<LayoutGrid className="text-indigo-600" size={20} />} label="Điểm phân bổ" value={stats.assignedTotal} color="bg-indigo-50" />
        <StatCard icon={<CircleDashed className="text-amber-600" size={20} />} label="Cần thực hiện" value={stats.assignedPending} color="bg-amber-50" />

        <StatCard icon={<CheckCircle2 className="text-emerald-600" size={20} />} label="Tổng hoàn thành" value={stats.totalDone} color="bg-emerald-50" />
        <StatCard icon={<MapPin className="text-violet-600" size={20} />} label="Điểm đi ngoài" value={stats.adhocDone} color="bg-violet-50" />
      </section>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50 relative overflow-hidden">
        <div className="flex gap-4 items-center justify-center">
          
          {/* Circle 1: Route Efficiency (QCxxx only) */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="52" stroke="currentColor" strokeWidth="9" fill="transparent" className="text-slate-100" />
                <motion.circle
                  cx="64" cy="64" r="52" strokeLinecap="round" stroke="currentColor" strokeWidth="9" fill="transparent"
                  initial={{ strokeDasharray: "0, 327" }}
                  animate={{ strokeDasharray: `${(stats.efficiency * 3.27)}, 327` }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="text-amber-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-black text-slate-800 tracking-tighter">{stats.efficiency}%</div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Hiệu suất</p>
              <p className="text-[9px] font-bold text-slate-400">({stats.assignedTotal - stats.assignedPending}/{stats.assignedTotal} điểm)</p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-24 bg-slate-100" />

          {/* Circle 2: Overall Completion */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Link to="/list" onClick={() => sessionStorage.setItem('lv_status', 'done')} className="relative w-32 h-32 active:scale-95 transition-transform block">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="52" stroke="currentColor" strokeWidth="9" fill="transparent" className="text-slate-100" />
                <motion.circle
                  cx="64" cy="64" r="52" strokeLinecap="round" stroke="currentColor" strokeWidth="9" fill="transparent"
                  initial={{ strokeDasharray: "0, 327" }}
                  animate={{ strokeDasharray: `${(stats.percent * 3.27)}, 327` }}
                  transition={{ duration: 1 }}
                  className="text-indigo-600"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-black text-slate-800 tracking-tighter">{stats.percent}%</div>
              </div>
            </Link>
            <div className="text-center">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Hoàn thành</p>
              <p className="text-[9px] font-bold text-slate-400">({stats.totalDone} điểm xong)</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 w-full mt-6">
          <Link to="/map" className="flex-1 py-4 bg-indigo-600 text-white text-center font-black rounded-2xl shadow-premium-indigo active:scale-95 transition-all text-[11px] uppercase tracking-wider flex items-center justify-center">Tuyến đường</Link>
          <button 
            onClick={() => setIsReportModalOpen(true)} 
            className="flex-1 py-4 bg-emerald-500 text-white text-center font-black rounded-2xl shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] active:scale-95 transition-all text-[11px] uppercase tracking-wider flex items-center justify-center">
            Báo cáo điểm mới
          </button>
        </div>
      </div>

      {isReportModalOpen && (
        <ReportModal 
          isOpen={true} 
          onClose={() => setIsReportModalOpen(false)} 
          item={{ isAdHoc: true }} // Force ad-hoc mode logically
          user={user}
          onSuccess={() => { clearAndResync(); setIsReportModalOpen(false); }} 
        />
      )}
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
