import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { fetchUsers } from '../services/api';
import { Users, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboard = () => {
  const [staffStats, setStaffStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminStats = async () => {
      const users = await fetchUsers();
      const allStaff = users.filter(u => u.role === 'staff');
      const allData = await db.posmData.toArray();

      const stats = allStaff.map(staff => {
        const staffData = allData.filter(d => d.pic_id === staff.user_id || d.pic === staff.ho_ten);
        const total = staffData.length;
        const done = staffData.filter(d => d.status === 'Done').length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        
        return {
          ...staff,
          total,
          done,
          pending: total - done,
          percent
        };
      });

      setStaffStats(stats);
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hiệu suất nhân viên tuần này</p>
         </div>
      </div>

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

            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Tổng" value={staff.total} color="text-slate-600" />
              <MiniStat label="Xong" value={staff.done} color="text-done" />
              <MiniStat label="Chờ" value={staff.pending} color="text-accent" />
            </div>
          </motion.div>
        ))}
      </div>
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
