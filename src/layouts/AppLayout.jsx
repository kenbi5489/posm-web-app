import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Map as MapIcon, List, User, Users, Camera, X, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../hooks/useSync';
import { fetchUsers } from '../services/api';
import { addWatermark } from '../services/WatermarkService';
import { motion, AnimatePresence } from 'framer-motion';

const AppLayout = () => {
  const { user, selectedStaff, selectStaff } = useAuth();
  const { syncing, pullData } = useSync(user);
  const [allStaff, setAllStaff] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraInputRef = useRef(null);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchUsers().then(data => {
        setAllStaff(data.filter(u => u.role === 'staff'));
      });
    }
  }, [isAdmin]);

  const handleCameraCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      // 1. Get GPS Address
      let currentAddress = "Đang lấy vị trí...";
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            enableHighAccuracy: true, timeout: 5000 
          });
        });
        const { latitude, longitude } = pos.coords;
        // Basic reverse geocoding via Nominatim (No API key needed)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=vi`);
        const geoData = await geoRes.json();
        currentAddress = geoData.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      } catch (err) {
        console.warn("Geolocation failed, using coordinates only", err);
        currentAddress = "Vị trí không xác định";
      }

      // 2. Read Image as Base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const watermarked = await addWatermark({
          imageBase64: reader.result,
          address: currentAddress,
          staffName: user?.ho_ten || "Unknown"
        });
        setCapturedImage(watermarked);
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Camera processing failed", error);
      alert("Lỗi xử lý ảnh camera");
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `timemark_${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-soft px-4 py-3 pt-safe">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Hệ thống POSM</p>
            <h1 className="text-lg font-black text-slate-900 leading-tight">
              {isAdmin && selectedStaff ? selectedStaff.ho_ten : user?.ho_ten}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => pullData()}
              disabled={syncing}
              className={`p-2 rounded-xl transition-all ${syncing ? 'animate-spin text-blue-500' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Đồng bộ lại"
            >
              <Users size={20} className={syncing ? 'hidden' : 'block'} />
              {syncing && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            </button>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-soft ${isAdmin ? 'bg-indigo-600 text-white' : 'bg-primary/10 text-primary'}`}>
              {(selectedStaff?.ho_ten || user?.ho_ten)?.charAt(0)}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              value={selectedStaff?.user_id || ''}
              onChange={(e) => {
                const staff = allStaff.find(s => s.user_id === e.target.value);
                selectStaff(staff || null);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Xem tất cả dữ liệu (Admin)</option>
              {allStaff.map(s => (
                <option key={s.user_id} value={s.user_id}>Nhân viên: {s.ho_ten}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-2 flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.03)] pb-safe z-40">
        <NavItem to="/" icon={<Home size={22} />} label="Trang chủ" />
        <NavItem to="/map" icon={<MapIcon size={22} />} label="Bản đồ" />
        
        {/* CENTER CAMERA BUTTON */}
        <div className="relative -mt-10 flex flex-col items-center gap-1 group">
          <input 
            type="file" 
            ref={cameraInputRef} 
            onChange={handleCameraCapture} 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
          />
          <button 
            onClick={() => cameraInputRef.current.click()}
            disabled={isProcessing}
            className={`w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-primary text-white shadow-[0_4px_12px_rgba(99,102,241,0.4)] flex items-center justify-center transform group-active:scale-90 transition-all border-4 border-white ${isProcessing ? 'animate-pulse opacity-70' : ''}`}
          >
            <Camera size={26} />
          </button>
          <span className="text-[10px] font-bold text-primary uppercase tracking-tighter mt-1">Chụp nhanh</span>
        </div>

        <NavItem to="/list" icon={<List size={22} />} label="Danh sách" />
        <NavItem to="/profile" icon={<User size={22} />} label="Cá nhân" />
      </nav>

      {/* PREVIEW MODAL */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md p-4 flex flex-col items-center justify-center gap-4"
          >
            <div className="relative w-full max-w-sm aspect-[3/4] bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20">
              <img src={capturedImage} className="w-full h-full object-cover" alt="Timemark Preview" />
              <button 
                onClick={() => setCapturedImage(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex gap-4 w-full max-w-sm mt-2">
              <button 
                onClick={() => setCapturedImage(null)}
                className="flex-1 py-4 bg-white/10 text-white font-bold rounded-2xl border border-white/10"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={downloadImage}
                className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Lưu ảnh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
