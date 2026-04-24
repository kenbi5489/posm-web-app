import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock, RefreshCw, Trophy, Users, CheckCircle2, ShieldAlert, AlertTriangle, BadgeInfo,
  ChevronDown, Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useSyncContext } from '../context/SyncContext';
import { getCustomWeekNumber, getWeekLabelHelper } from '../utils/weekUtils';
import MultiSelect from '../components/MultiSelect';


// ═══════════════════════════════════════════════════════════════════════════
// TỔNG QUAN POSM — Executive Overview Dashboard
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = '#0f3460';
const TEAL = '#0d9488';
const AMBER = '#d97706';
const RED = '#dc2626';

const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Mall keywords — dùng để detect từ address khi mall_name (cột BE) chưa có
const MALL_KEYWORDS = ['aeon', 'vincom', 'lotte', 'big c', 'bigc', 'coopxtra', 'coopmart',
  'van hanh', 'vạn hạnh', 'gigamall', 'thiso', 'crescent', 'vivo city', 'sc vivo',
  'tttm', 'trung tâm thương mại', 'trung tam thuong mai', 'parkson', 'nowzone',
  'sense city', 'pandora', 'estella'];

// isMall: ưu tiên cột BE (Mall_Name từ acceptance sheet) → location_type → address scan
const isMall = (rec) => {
  // 1. Cột BE: Mall_Name được GAS ghi vào acceptance sheet
  const mn = (rec.mall_name || '').trim();
  if (mn && mn !== 'N/A' && mn !== 'Standalone' && mn !== '') return true;
  // 2. Location_Type
  const type = (rec.location_type || '').toLowerCase();
  if (type === 'mall' || type.includes('ttm') || type.includes('trung tâm')) return true;
  // 3. Address fallback — khi chưa có acceptance data
  const addr = (rec.address || '').toLowerCase();
  return MALL_KEYWORDS.some(kw => addr.includes(kw));
};

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────

const DoughnutChart = ({ percent, total, done, color = ACCENT }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-44 h-44 flex items-center justify-center mx-auto">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="88" cy="88" r={radius} fill="none" stroke="#f8fafc" strokeWidth="14" />
        <motion.circle
          cx="88" cy="88" r={radius} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-black text-slate-800 tracking-tighter" style={{ color }}>{percent}%</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{done} / {total}</span>
      </div>
    </div>
  );
};

const BarChart = ({ data, height = 150 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = Math.min(30, Math.floor(250 / data.length) - 8);

  return (
    <svg viewBox={`0 0 ${data.length * (barW + 12) + 20} ${height + 40}`} className="w-full" style={{ maxHeight: height + 40 }}>
      {data.map((d, i) => {
        const x = 10 + i * (barW + 12);
        const totalH = (d.total / max) * height;
        const doneH = (d.done / max) * height;
        return (
          <g key={i}>
            <rect x={x} y={height - totalH} width={barW} height={totalH} rx={barW / 4} fill="#f1f5f9" />
            <motion.rect
              initial={{ height: 0, y: height }}
              animate={{ height: doneH, y: height - doneH }}
              x={x} width={barW} height={doneH} y={height - doneH} rx={barW / 4} fill={ACCENT} opacity={0.85}
            />
            <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="10" fontWeight="800" fill="#cbd5e1">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const ProgressBar = ({ percent, color = ACCENT }) => (
  <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex-1 shadow-inner">
    <motion.div
      initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
      className="h-full rounded-full" style={{ backgroundColor: color }}
    />
  </div>
);

const TwoSliceDoughnut = ({ val1, val2, color1, color2, label1, label2, centerText }) => {
  const total = val1 + val2 || 1;
  const p1 = (val1 / total) * 100;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset1 = circumference - (p1 / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke={color2} strokeWidth="16" />
          <motion.circle
            cx="80" cy="80" r={radius} fill="none" stroke={color1} strokeWidth="16"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black text-slate-800 tracking-tighter">{centerText || `${Math.round(p1)}%`}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full px-2">
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest bg-slate-50 px-4 py-2.5 rounded-2xl">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: color1}}></div>{label1}</div>
          <span className="text-slate-700 font-black text-xs">{val1}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest bg-slate-50 px-4 py-2.5 rounded-2xl">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: color2}}></div>{label2}</div>
          <span className="text-slate-700 font-black text-xs">{val2}</span>
        </div>
      </div>
    </div>
  );
};

const AlertItem = ({ severity, text }) => {
  const config = {
    high: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: <ShieldAlert size={14} className="text-rose-600 mt-0.5" /> },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: <AlertTriangle size={14} className="text-amber-600 mt-0.5" /> },
    low: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: <BadgeInfo size={14} className="text-indigo-600 mt-0.5" /> },
  };
  const c = config[severity] || config.low;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 p-4 mb-3 rounded-2xl border ${c.bg} ${c.border}`}
    >
      {c.icon}
      <p className={`text-[13px] font-bold leading-snug ${c.text}`}>{text}</p>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════

const OverviewDashboard = () => {
  const { user, selectedStaff, lastSync } = useAuth();
  const [allData, setAllData] = useState([]);
  const [adhocData, setAdhocData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState(['All']);
  const [brandFilter, setBrandFilter] = useState(['All']);
  const [posmFilter, setPosmFilter] = useState('All');
  const { syncing, pullData } = useSyncContext();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [posm, adhoc] = await Promise.all([
          db.posmData.toArray(),
          db.adhocPoints ? db.adhocPoints.toArray() : []
        ]);
        setAllData(posm);
        setAdhocData(adhoc);
      } catch (err) {
        console.error("Overview Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lastSync]);

  // Auto-select the best default week whenever data reloads (lastSync changes).
  // Reset ref each time lastSync changes so a fresh sync always re-picks the right week.
  const autoSelectedRef = useRef(false);
  useEffect(() => { autoSelectedRef.current = false; }, [lastSync]);
  // Auto-select logic removed to default to 'All' weeks per user request
  useEffect(() => {
    if (allData.length === 0) return;
    // We keep the ref update if needed for other logic, but don't setWeekFilter
    autoSelectedRef.current = true;
  }, [allData]);

  const { filtered, filteredAdhoc, uniqueWeeks, uniqueBrands, allStaff, syncedAdhocs } = useMemo(() => {
    const activeStaff = selectedStaff || (user?.role === 'staff' ? user : null);
    const pidNorm = String(activeStaff?.user_id || '').trim().toLowerCase();
    const pNameNorm = stripAccents(activeStaff?.ho_ten || '').toLowerCase().trim();

    const base = activeStaff ? allData.filter(i => {
      const mPId = String(i.pic_id || '').trim().toLowerCase();
      const mPName = stripAccents(i.pic || '').toLowerCase().trim();
      return (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
    }) : allData;

    let filteredData = base;
    if (!weekFilter.includes('All')) {
      const targetWeekNums = weekFilter.map(w => parseInt(String(w).match(/\d+/)?.[0]) || 0);
      filteredData = filteredData.filter(i => targetWeekNums.includes(parseInt(String(i.week).match(/\d+/)?.[0]) || 0));
    }
    if (!brandFilter.includes('All')) {
      filteredData = filteredData.filter(i => brandFilter.includes(i.brand));
    }

    if (posmFilter !== 'All') {
      filteredData = filteredData.filter(i => {
        const s = stripAccents(i.posm_status || "");
        const isCoPosm = (s.startsWith("co") && !s.startsWith("cong") && !s.startsWith("con ") && !s.startsWith("copy")) ||
               s === "yes" || s === "ok" || s === "dat" ||
               s.includes("co posm") || s.includes("yes posm") || s.includes("co khung");
        const isNoPosm = s.includes("khong") || s.includes("no posm") || s === "no" || s.includes("da thao") || s.includes("thao posm");
        
        if (posmFilter === 'HasPOSM') return isCoPosm;
        if (posmFilter === 'NoPOSM') return isNoPosm;
        return true;
      });
    }

    const f = filteredData.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_'));
    const sAdhocs = filteredData.filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'));

    const adhocFiltered = adhocData.filter(i => {
      const okWeek = weekFilter.includes('All') || weekFilter.some(w => (parseInt(String(w).match(/\d+/)?.[0]) || 0) === (parseInt(String(i.week).match(/\d+/)?.[0]) || 0));
      const okBrand = brandFilter.includes('All') || brandFilter.includes(i.brand);
      
      let okPosm = true;
      if (posmFilter !== 'All') {
        const s = stripAccents(i.posm_status || "");
        const isCoPosm = (s.startsWith("co") && !s.startsWith("cong") && !s.startsWith("con ") && !s.startsWith("copy")) ||
               s === "yes" || s === "ok" || s === "dat" || s.includes("co posm") || s.includes("yes posm") || s.includes("co khung");
        const isNoPosm = s.includes("khong") || s.includes("no posm") || s === "no" || s.includes("da thao") || s.includes("thao posm");
        if (posmFilter === 'HasPOSM') okPosm = isCoPosm;
        else if (posmFilter === 'NoPOSM') okPosm = isNoPosm;
      }

      const mPId = String(i.pic_id || '').trim().toLowerCase();
      const mPName = stripAccents(i.pic || '').toLowerCase().trim();
      const picMatch = !activeStaff || (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
      return okWeek && okBrand && okPosm && picMatch;
    });

    const staffSet = [...new Set(allData.map(i => i.pic).filter(Boolean))].sort();
    const _todayNum = getCustomWeekNumber(new Date());
    const _effNum = new Date().getDay() === 4 ? _todayNum + 1 : _todayNum;
    const sortedWeeks = [...new Set(allData.map(i => i.week).filter(Boolean))].sort((a,b) => {
        const na = parseInt(String(a).match(/\d+/)?.[0]) || 0;
        const nb = parseInt(String(b).match(/\d+/)?.[0]) || 0;
        // Current effective week always first, then descending (newest → oldest)
        if (na === _effNum) return -1;
        if (nb === _effNum) return 1;
        return nb - na;
    });
    const uWeeks = ['All', ...sortedWeeks];
    const uBrands = ['All', ...[...new Set(allData.map(i => i.brand).filter(Boolean))].sort()];

    return { filtered: f, syncedAdhocs: sAdhocs, filteredAdhoc: adhocFiltered, uniqueWeeks: uWeeks, uniqueBrands: uBrands, allStaff: staffSet };
  }, [allData, adhocData, user, selectedStaff, weekFilter, brandFilter, posmFilter]);

  const kpis = useMemo(() => {
    const assignedTotal = filtered.length;
    const assignedDone = filtered.filter(i => i.status === 'Done').length;
    const syncAdhocCount = syncedAdhocs.length;
    const localAdhocCount = filteredAdhoc.length;
    
    // De-duplicate adhoc points by job_code
    const adhocMap = new Map();
    syncedAdhocs.forEach(i => adhocMap.set(i.job_code, i));
    filteredAdhoc.forEach(i => adhocMap.set(i.job_code, i));
    const totalDone = assignedDone + adhocMap.size;

    const percent = Math.min(100, Math.round((totalDone / 75) * 100)); // Target 75/week
    const efficiency = assignedTotal > 0 ? Math.round((assignedDone / assignedTotal) * 100) : 0;

    // ── PROFESSIONAL ADJUSTED FORMULA (Reference: modern-dashboard) ──
    const EXCLUDE_REASONS = ["đóng cửa", "chính sách", "không hợp tác", "ngoài giờ", "tháo", "không liên lạc"];
    
    const calculateProfessionalStats = (recs) => {
      const completed = recs.filter(r => r.status === 'Done');

      const hasPosm = completed.filter(r => {
        const s = stripAccents(r.posm_status || "");
        // Match chính xác: "co posm", "co", "yes", "dat", "co posm" — KHÔNG match "khong"
        return (s.startsWith("co") && !s.startsWith("cong") && !s.startsWith("con ") && !s.startsWith("copy")) ||
               s === "yes" || s === "ok" || s === "dat" ||
               s.includes("co posm") || s.includes("yes posm") || s.includes("co khung");
      }).length;

      const noPosm = completed.filter(r => {
        const s = stripAccents(r.posm_status || "");
        return s.includes("khong") || s.includes("no posm") || s === "no" || s.includes("da thao") || s.includes("thao posm");
      }).length;

      const exemptCount = completed.filter(r => {
        const reason = stripAccents(r.posm_status || r.acceptance_note || "");
        const exemptNorm = EXCLUDE_REASONS.map(e => stripAccents(e));
        return exemptNorm.some(ex => reason.includes(ex));
      }).length;

      const hasFrame = completed.filter(r => r.is_frame).length;

      // Adjusted Denominator: chỉ tính những điểm đã check thực sự (loại trừ exempt)
      const adjustedNoPosm = Math.max(0, noPosm - exemptCount);
      const denominator = hasPosm + adjustedNoPosm;
      const rate = denominator > 0 ? Math.round((hasPosm / denominator) * 100) : 0;

      const frameRate = completed.length > 0 ? Math.round((hasFrame / completed.length) * 100) : 0;
      return { total: recs.length, done: completed.length, hasPosm, noPosm, exemptCount, hasFrame, frameRate, rate, denominator };
    };

    const overall = calculateProfessionalStats(filtered);

    // ── MALL CÓ POSM: dựa ĐÚNG trên cột BA (location_type) và cột BD (posm_status) ──
    // Lọc Mall = tất cả records có location_type chứa "mall" (cột BA)
    const isMallByColumn = (r) => {
      const lt = (r.location_type || '').toLowerCase().trim();
      return lt === 'mall' || lt.includes('mall') || lt.includes('ttm') || lt.includes('trung tam');
    };
    const mallRecords = filtered.filter(isMallByColumn);
    const streetRecords = filtered.filter(r => !isMallByColumn(r));

    // ── DEBUG: In ra console để kiểm tra data thực tế ──
    const uniqueLT = [...new Set(filtered.map(r => r.location_type || '(trống)'))].sort();
    const uniquePosmMall = [...new Set(mallRecords.map(r => r.posm_status || '(trống)'))].sort();
    console.group('[MALL DEBUG]');
    console.log('Filtered total:', filtered.length);
    console.log('Unique location_type values:', uniqueLT);
    console.log('Mall records (location_type match):', mallRecords.length);
    console.log('Unique posm_status trong Mall:', uniquePosmMall);
    console.log('Sample mall records:', mallRecords.slice(0, 3).map(r => ({ job_code: r.job_code, location_type: r.location_type, posm_status: r.posm_status, status: r.status })));
    console.groupEnd();

    // Tỉ lệ Mall có POSM: (số mall có posm_status là "Có POSM") / (tổng số mall) * 100
    // Không dùng calculateProfessionalStats mà tính thẳng theo cột BD để đúng nghĩa yêu cầu
    const mallHasPosm = mallRecords.filter(r => {
      const s = stripAccents(r.posm_status || '');
      return (s.startsWith('co') && !s.startsWith('cong') && !s.startsWith('con ') && !s.startsWith('copy')) ||
             s === 'yes' || s === 'ok' || s === 'dat' ||
             s.includes('co posm') || s.includes('yes posm') || s.includes('co khung');
    }).length;
    const mallTotal = mallRecords.length;
    const mallPosmRate = mallTotal > 0 ? Math.round((mallHasPosm / mallTotal) * 100) : 0;
    console.log(`[MALL RESULT] hasPosm=${mallHasPosm} / total=${mallTotal} = ${mallPosmRate}%`);

    // Frame rate cho Mall (vẫn giữ logic cũ)
    const mallStats = calculateProfessionalStats(mallRecords);
    const streetStats = calculateProfessionalStats(streetRecords);

    // Ghi đè posmRate của mall bằng công thức mới (numerator/all mall, không chỉ Done)
    mallStats.rate = mallPosmRate;
    mallStats.hasPosm = mallHasPosm;
    mallStats.total = mallTotal;

    const strip = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    // ── URGIFT STATUS ANALYSIS (cột H: Hoạt động UrGift) ──────────────────
    // Các giá trị chính thức từ cột H:
    //   "Đóng cửa"                          → cửa hàng đóng cửa
    //   "Hoạt động ngoài giờ hành chính"    → hoạt động ngoài giờ
    //   "Site check"                         → bình thường
    //   "Hoạt động"                          → bình thường

    // ── TỈ LỆ ĐÓNG CỬA (Cột H: Hoạt động UrGift) ───────────────────────────
    // urgift_status được overlay từ acceptance sheet (cột "Hoạt động UrGift")
    // Giá trị thực: "Đóng cửa/Hoạt động ngoài giờ hành chính", "Site check - Kiểm tra...", etc.
    // Tất cả records Done đều có urgift_status nếu nhân viên đã báo cáo
    const getUrgiftStatus = (r) => strip(r.urgift_status || r.raw_mission_status || '');

    // Tính trên TẤT CẢ filtered (kể cả chưa Done) để bắt những điểm đóng cửa bị skip
    const closedCount = filtered.filter(r => getUrgiftStatus(r).includes('dong cua')).length;

    // Fallback: nếu không có urgift_status nào (chưa sync), đếm từ acceptance_note
    const closedCountFallback = closedCount === 0
      ? filtered.filter(r => strip(r.acceptance_note || r.posm_status || '').includes('dong cua')).length
      : 0;
    const closedTotal = closedCount + closedCountFallback;

    const closedRate = assignedTotal > 0 ? Math.round((closedTotal / assignedTotal) * 100) : 0;
    const afterHoursCount = filtered.filter(r => {
      const u = getUrgiftStatus(r);
      return !u.includes('dong cua') && u.includes('ngoai gio');
    }).length;
    const afterHoursRate = assignedTotal > 0 ? Math.round((afterHoursCount / assignedTotal) * 100) : 0;
    const urgiftDistribution = {};

    const staffStats = allStaff.map(name => {
      const staffPoints = allData.filter(i => i.pic === name);
      let staffFiltered = staffPoints;
      if (!weekFilter.includes('All')) {
        const targetWeekNums = weekFilter.map(w => parseInt(String(w).match(/\d+/)?.[0]) || 0);
        staffFiltered = staffFiltered.filter(i => targetWeekNums.includes(parseInt(String(i.week).match(/\d+/)?.[0]) || 0));
      }
      const sDone = staffFiltered.filter(i => i.status === 'Done').length;
      const sAssigned = staffFiltered.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_')).length;
      return {
        name,
        done: sDone,
        percent: Math.min(100, Math.round((sDone / 75) * 100)),
        efficiency: sAssigned > 0 ? Math.round((staffFiltered.filter(i => i.status === 'Done' && !String(i.job_code || '').toUpperCase().includes('NEW_')).length / sAssigned) * 100) : 0
      };
    }).sort((a,b) => b.percent - a.percent);

    // ── TOP 10 BRANDS ────────────────────────────────────────────────────────
    const brandMap = {};
    filtered.forEach(r => {
      if (r.status === 'Done' && r.brand) {
        if (!brandMap[r.brand]) {
            brandMap[r.brand] = { total: 0, hasPosm: 0, noPosm: 0 };
        }
        brandMap[r.brand].total++;
        const s = stripAccents(r.posm_status || '');
        const hasP = (s.startsWith('co') && !s.startsWith('cong') && !s.startsWith('con ') && !s.startsWith('copy')) ||
             s === 'yes' || s === 'ok' || s === 'dat' ||
             s.includes('co posm') || s.includes('yes posm') || s.includes('co khung');
        const noP = s.includes("khong") || s.includes("no posm") || s === "no" || s.includes("da thao") || s.includes("thao posm");
        
        if (hasP) brandMap[r.brand].hasPosm++;
        else if (noP) brandMap[r.brand].noPosm++;
      }
    });
    const topBrands = Object.entries(brandMap)
      .map(([name, stats]) => {
          const denom = stats.hasPosm + stats.noPosm;
          // Format to 1 decimal place as seen in the image
          const rateStr = denom > 0 ? ((stats.hasPosm / denom) * 100).toFixed(1) : "0.0";
          return { name, count: stats.total, hasPosm: stats.hasPosm, noPosm: stats.noPosm, rateStr };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── TOP 3 MALLS ──────────────────────────────────────────────────────────
    const mallCoverageMap = {};
    mallRecords.forEach(r => {
      if (r.status === 'Done') {
        const mn = (r.mall_name && r.mall_name !== 'N/A' && r.mall_name !== 'Standalone') ? r.mall_name.trim() : (r.address || 'Unknown Mall').trim();
        if (!mallCoverageMap[mn]) {
          mallCoverageMap[mn] = { total: 0, hasPosm: 0 };
        }
        mallCoverageMap[mn].total++;
        
        const s = stripAccents(r.posm_status || '');
        const hasP = (s.startsWith('co') && !s.startsWith('cong') && !s.startsWith('con ') && !s.startsWith('copy')) ||
             s === 'yes' || s === 'ok' || s === 'dat' ||
             s.includes('co posm') || s.includes('yes posm') || s.includes('co khung');
        if (hasP) mallCoverageMap[mn].hasPosm++;
      }
    });
    const topMalls = Object.entries(mallCoverageMap)
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        hasPosm: stats.hasPosm,
        rate: stats.total > 0 ? Math.round((stats.hasPosm / stats.total) * 100) : 0
      }))
      .filter(m => m.total > 0)
      .sort((a, b) => b.rate - a.rate || b.total - a.total)
      .slice(0, 3);

    // ── PIC PASS RATES ───────────────────────────────────────────────────────
    const staffCompletionPass = staffStats.filter(s => s.percent >= 100).length;
    const staffCompletionFail = staffStats.length - staffCompletionPass;
    const staffEfficiencyPass = staffStats.filter(s => s.efficiency >= 90).length;
    const staffEfficiencyFail = staffStats.length - staffEfficiencyPass;

    return {
      total: assignedTotal,
      done: totalDone,
      percent,
      efficiency,
      closedRate,
      afterHoursCount,
      afterHoursRate,
      urgiftDistribution,
      posmRate: overall.rate,
      hasPosm: overall.hasPosm,
      noPosm: overall.noPosm,
      hasFrame: overall.hasFrame,
      exemptCount: overall.exemptCount,
      denominator: overall.denominator,
      closedCount: closedTotal,
      staffStats,
      staffPassRates: {
        completionPass: staffCompletionPass,
        completionFail: staffCompletionFail,
        efficiencyPass: staffEfficiencyPass,
        efficiencyFail: staffEfficiencyFail
      },
      topBrands,
      topMalls,
      frameRate: overall.frameRate,
      mall: { posmRate: mallStats.rate, hasFrame: mallStats.hasFrame, frameRate: mallStats.frameRate, total: mallStats.total, hasPosm: mallStats.hasPosm },
      nonMall: { posmRate: streetStats.rate, hasFrame: streetStats.hasFrame, frameRate: streetStats.frameRate, total: streetStats.total }
    };
  }, [filtered, syncedAdhocs, filteredAdhoc, allStaff, allData, weekFilter]);

  const chartData = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const w = item.week || 'N/A';
      if (!map[w]) map[w] = { total: 0, done: 0 };
      map[w].total++;
      if (item.status === 'Done') map[w].done++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => (parseInt(String(a).match(/\d+/)?.[0]) || 0) - (parseInt(String(b).match(/\d+/)?.[0]) || 0))
      .map(([label, d]) => ({ label: label.match(/\d+/)?.[0] ? `W${label.match(/\d+/)?.[0]}` : label, ...d }));
  }, [filtered]);

  const alerts = useMemo(() => {
    const res = [];
    if (kpis.closedRate > 15) res.push({ severity: 'high', text: `Tỉ lệ cửa hàng đóng cửa cao (${kpis.closedRate}% — ${kpis.closedCount} điểm). Cần kiểm tra lại lộ trình hoặc giờ giấc thi công.` });
    if (kpis.afterHoursRate > 10) res.push({ severity: 'medium', text: `${kpis.afterHoursCount} điểm hoạt động ngoài giờ hành chính (${kpis.afterHoursRate}%). Cân nhắc bố trí ca chiều/tối.` });
    if (kpis.percent < 50 && !weekFilter.includes('All')) res.push({ severity: 'medium', text: `Tiến độ tuần đang chậm. Hiện chỉ mới đạt ${kpis.percent}% mục tiêu.` });
    if (res.length === 0) res.push({ severity: 'low', text: `Chiến dịch đang vận hành ổn định.` });
    return res;
  }, [kpis, weekFilter]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <RefreshCw className="animate-spin text-indigo-600" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải báo cáo sếp...</p>
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50 pb-32 font-sans selection:bg-indigo-100 italic-none">
      
      {/* ── HEADER ── */}
      <div className="bg-white px-6 pt-12 pb-8 shadow-sm border-b border-slate-100 sticky top-0 z-20 bg-white/80 backdrop-blur-md">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Dashboard</h1>
                <p className="text-[10px] font-black text-slate-400 mt-1 flex items-center gap-2 uppercase tracking-widest">
                    <Clock size={12} /> Sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : '--'}
                </p>
            </div>
            <div className="bg-indigo-900 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
                <ShieldAlert size={20} />
            </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <MultiSelect 
            label="Tuần" 
            options={uniqueWeeks} 
            value={weekFilter} 
            onChange={setWeekFilter} 
          />
          <MultiSelect 
            label="Brand" 
            options={uniqueBrands} 
            value={brandFilter} 
            onChange={setBrandFilter} 
          />
          <select value={posmFilter} onChange={e => setPosmFilter(e.target.value)} className="flex-1 min-w-[130px] bg-slate-50 border-none rounded-2xl px-5 py-4 text-[10px] sm:text-xs font-black uppercase text-slate-800 outline-none shadow-inner appearance-none">
            <option value="All">Trạng thái POSM</option>
            <option value="HasPOSM">Có POSM</option>
            <option value="NoPOSM">Không POSM</option>
          </select>
        </div>
      </div>

      <div className="px-6 pt-8 space-y-8">
        
        {/* ── RATIO ANALYSIS ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* POSM RATIO */}
            <div className="bg-white rounded-[3rem] p-8 shadow-premium border border-slate-50 flex flex-col items-center">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-teal-500" /> Tỉ lệ Có / Không POSM
                </h2>
                <TwoSliceDoughnut 
                   val1={kpis.hasPosm} val2={kpis.noPosm} 
                   color1="#0d9488" color2="#f43f5e" 
                   label1="Có POSM" label2="Không POSM" 
                   centerText={`${kpis.posmRate}%`}
                />
                <div className="mt-8 pt-6 border-t border-slate-100 w-full text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mẫu số chuẩn (Đã loại trừ): {kpis.denominator}</p>
                </div>
            </div>

            {/* PIC COMPLETION RATIO */}
            <div className="bg-white rounded-[3rem] p-8 shadow-premium border border-slate-50 flex flex-col items-center">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center flex items-center gap-2">
                    <Users size={16} className="text-indigo-500" /> Hoàn thành (PIC)
                </h2>
                <TwoSliceDoughnut 
                   val1={kpis.staffPassRates.completionPass} val2={kpis.staffPassRates.completionFail} 
                   color1="#4f46e5" color2="#cbd5e1" 
                   label1="Đạt chỉ tiêu (≥ 100%)" label2="Chưa đạt" 
                />
                <div className="mt-8 pt-6 border-t border-slate-100 w-full text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Target: 75 / Tuần</p>
                </div>
            </div>

            {/* PIC EFFICIENCY RATIO */}
            <div className="bg-white rounded-[3rem] p-8 shadow-premium border border-slate-50 flex flex-col items-center">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center flex items-center gap-2">
                    <Clock size={16} className="text-sky-500" /> Hiệu suất tuyến (PIC)
                </h2>
                <TwoSliceDoughnut 
                   val1={kpis.staffPassRates.efficiencyPass} val2={kpis.staffPassRates.efficiencyFail} 
                   color1="#0ea5e9" color2="#cbd5e1" 
                   label1="Hiệu suất cao (≥ 90%)" label2="Cần cải thiện" 
                />
                <div className="mt-8 pt-6 border-t border-slate-100 w-full text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tổng nhân sự: {kpis.staffStats.length}</p>
                </div>
            </div>
        </section>

        {/* ── TOP RANKINGS ── */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* TOP 10 BRANDS TABLE */}
            <div className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2 border-l-4 border-teal-500 pl-3">
                        Top 10 Brand site check trong tuần
                    </h2>
                </div>
                
                <div className="flex-1 overflow-x-auto relative z-10">
                    <table className="w-full text-left border-collapse min-w-[400px]">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Có</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Không</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">% Có</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {kpis.topBrands.map((b, idx) => (
                                <tr key={b.name} className="hover:bg-white/5 transition-colors">
                                    <td className="py-4 pr-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold text-slate-500 w-4">{idx + 1}.</span>
                                            <span className="text-sm font-bold text-slate-100">{b.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 text-center text-sm font-bold text-slate-300">{b.hasPosm}</td>
                                    <td className="py-4 text-center text-sm font-bold text-slate-300">{b.noPosm}</td>
                                    <td className="py-4 text-right">
                                        <span className="bg-teal-500/20 text-teal-400 text-[10px] font-black px-2 py-1 rounded-lg">
                                            {b.rateStr}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {kpis.topBrands.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs font-bold">Chưa có dữ liệu</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TOP 3 MALLS & STAFF LIST */}
            <div className="space-y-6 flex flex-col">
                {/* TOP 3 MALLS */}
                <div className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full -mr-24 -mt-24 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full -ml-16 -mb-16 blur-2xl" />
                    <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2 mb-8 relative z-10 border-l-4 border-teal-500 pl-3">
                        Top 3 Mall Phủ POSM
                    </h2>
                    <div className="space-y-4 relative z-10">
                        {kpis.topMalls.map((m, idx) => (
                            <div key={m.name} className="flex flex-col bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-bold text-indigo-100 flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-yellow-400">{idx + 1}</span>
                                        <span className="line-clamp-1">{m.name}</span>
                                    </span>
                                    <span className="text-lg font-black text-white">{m.rate}%</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 rounded-xl px-4 py-2">
                                    <span>Có POSM: {m.hasPosm} / {m.total}</span>
                                </div>
                            </div>
                        ))}
                        {kpis.topMalls.length === 0 && <p className="text-center text-slate-400 text-xs py-4 relative z-10">Chưa có dữ liệu mall</p>}
                    </div>
                </div>

                {/* STAFF PERFORMANCE LIST */}
                <div className="bg-white rounded-[3rem] p-8 shadow-premium border border-slate-50 flex-1">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <Users size={16} className="text-indigo-600" /> Chi tiết nhân sự
                        </h2>
                    </div>
                    <div className="space-y-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {kpis.staffStats.map((s, idx) => (
                            <div key={s.name} className="flex items-center gap-4">
                                <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                                    #{idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-xs font-black text-slate-700 truncate">{s.name}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.done} Done</span>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2">
                                        {/* Completion Bar */}
                                        <div className="flex items-center gap-3">
                                            <span className="w-14 text-[8px] font-black text-slate-400 uppercase text-right">Hoàn thành</span>
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                                                <motion.div 
                                                    initial={{ width: 0 }} animate={{ width: `${Math.min(s.percent, 100)}%` }}
                                                    className="h-full bg-indigo-500 rounded-full" 
                                                />
                                            </div>
                                            <span className="w-8 text-[9px] font-black text-indigo-600 text-right">{s.percent}%</span>
                                        </div>

                                        {/* Efficiency Bar */}
                                        <div className="flex items-center gap-3">
                                            <span className="w-14 text-[8px] font-black text-slate-400 uppercase text-right">Hiệu suất</span>
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                                                <motion.div 
                                                    initial={{ width: 0 }} animate={{ width: `${Math.min(s.efficiency, 100)}%` }}
                                                    className="h-full bg-sky-500 rounded-full" 
                                                />
                                            </div>
                                            <span className="w-8 text-[9px] font-black text-sky-600 text-right">{s.efficiency}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>


      </div>
    </div>
  );
};

export default OverviewDashboard;
