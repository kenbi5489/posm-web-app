import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { LayoutGrid, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const DistrictSummary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [districtData, setDistrictData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      let data = await db.posmData.toArray();
      if (user.role === 'staff') {
        data = data.filter(item => item.pic_id === user.user_id || item.pic === user.ho_ten);
      }
      
      const groups = data.reduce((acc, item) => {
        const d = item.district || 'Khác';
        if (!acc[d]) acc[d] = { name: d, total: 0, done: 0 };
        acc[d].total++;
        if (item.status === 'Done') acc[d].done++;
        return acc;
      }, {});

      const sorted = Object.values(groups).sort((a, b) => b.total - a.total);
      setDistrictData(sorted);
    };

    loadData();
  }, [user]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-premium">
          <LayoutGrid size={24} />
        </div>
        <div>
           <h2 className="text-xl font-black text-slate-900 tracking-tight">Theo quận huyện</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ chi tiết từng khu vực</p>
        </div>
      </div>

      <div className="space-y-4">
        {districtData.map((d, idx) => (
          <motion.div
            key={d.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => navigate('/list', { state: { district: d.name } })}
            className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-50 active:scale-[0.98] transition-transform space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800">{d.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{d.done}/{d.total} Điểm</span>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Tiến độ</span>
                <span className="text-primary">{Math.round((d.done / d.total) * 100)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.done / d.total) * 100}%` }}
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2">
               <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full text-done text-[10px] font-black uppercase tracking-tighter">
                 <CheckCircle2 size={12} /> {d.done} Đã xong
               </div>
               <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full text-accent text-[10px] font-black uppercase tracking-tighter">
                 <Clock size={12} /> {d.total - d.done} Chưa xong
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DistrictSummary;
