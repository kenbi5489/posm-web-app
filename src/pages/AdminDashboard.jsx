import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { fetchUsers } from '../services/api';
import { TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboard = () => {
  const [staffStats, setStaffStats] = useState([]);
  const [currentWeek, setCurrentWeek] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminStats = async () => {
      const users = await fetchUsers();
      const allStaff = users.filter(u => u.role === 'staff');
      const allData = await db.posmData.toArray();
      const allCheckins = db.checkins ? await db.checkins.toArray() : [];

      // Detect latest week numerically (W14 > W9)
      const weeks = [...new Set(allData.map(d => String(d.week || '').trim()).filter(Boolean))]
        .filter(w => { 
          const n = parseInt(String(w || '').replace(/\D/g,''), 10) || 0; 
          return n >= 14 && n < 50; 
        })
        .sort((a,b) => (parseInt(String(a || '').replace(/\D/g,''),10)||0) - (parseInt(String(b || '').replace(/\D/g,''),10)||0));
      const latestWeek = weeks.slice(-1)[0] || '';

      const currentWeekData = allData.filter(d => String(d.week||'').trim() === String(latestWeek || '').trim());


      const stats = allStaff.map(staff => {
        const staffData = currentWeekData.filter(
          d => d.pic_id === staff.user_id || d.pic === staff.ho_ten
        );
        const staffCheckins = allCheckins.filter(c => c.pic_id === staff.user_id?.toString());
        const total = staffData.length;
        const done = staffData.filter(d => d.status === 'Done').length;
        const verified = staffCheckins.filter(c => c.result === 'verified').length;
        const review = staffCheckins.filter(c => c.result === 'manual_review').length;
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

        return { ...staff, total, done, pending: total - done, verified, review, percent };
      });

      setStaffStats(stats.filter(s => s.total > 0));
      setCurrentWeek(latestWeek);
      setLoading(false);
    };
    loadAdminStats();
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse">Đang tải báo cáo tổng quát...</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-premium">
          <TrendingUp size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Báo cáo tổng hợp</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Hiệu suất nhân viên • {currentWeek || 'Tuần này'}
          </p>
        </div>
      </div>

      {/* Manual Review Alert */}
      {staffStats.some(s => s.review > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-amber-800 text-sm">Có check-in cần duyệt tay</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {staffStats.filter(s => s.review > 0).map(s => `${s.ho_ten} (${s.review})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {staffStats.length === 0 ? (
        <div className="text-center py-16 text-slate-400 font-bold text-sm">
          Không có dữ liệu cho {currentWeek}
        </div>
      ) : (
        <div className="grid gap-4">
          {staffStats.map((staff, idx) => (
            <motion.div
              key={staff.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-50 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-indigo-600 font-bold">
                    {staff.ho_ten.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 leading-tight">{staff.ho_ten}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{staff.user_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600 leading-none">{staff.percent}%</span>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Hoàn thành</p>
                </div>
              </div>

              <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${staff.percent}%` }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>

              <div className="grid grid-cols-5 gap-2">
                <MiniStat label="Tổng" value={staff.total} color="text-slate-600" />
                <MiniStat label="Xong" value={staff.done} color="text-done" />
                <MiniStat label="Chờ" value={staff.pending} color="text-accent" />
                <MiniStat label="✅ GPS" value={staff.verified} color="text-green-600" />
                <MiniStat label="🔍 Duyệt" value={staff.review} color="text-amber-600" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const MiniStat = ({ label, value, color }) => (
  <div className="bg-slate-50/50 p-2 rounded-xl text-center">
    <p className={`text-lg font-black ${color}`}>{value}</p>
    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
  </div>
);

export default AdminDashboard;
