import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, CheckCircle, X } from 'lucide-react';

const TOUR_STEPS = [
  {
    targetId: 'tour-nav-home',
    title: 'Trang Chủ',
    content: 'Nơi bạn xem nhanh tiến độ thực hiện trong tuần và các thông báo mới nhất.',
    position: 'top'
  },
  {
    targetId: 'tour-progress-card',
    title: 'Tiến Độ Tuần',
    content: 'Biểu đồ này giúp bạn biết mình đã hoàn thành bao nhiêu % kế hoạch được giao.',
    position: 'bottom'
  },
  {
    targetId: 'tour-nav-route',
    title: 'Tuyến Đường',
    content: 'Đây là công cụ quan trọng nhất. Các điểm bán được gom nhóm theo Quận giúp bạn tối ưu lộ trình di chuyển.',
    position: 'top'
  },
  {
    targetId: 'tour-nav-list',
    title: 'Danh Sách',
    content: 'Tra cứu nhanh mã công việc hoặc thực hiện báo cáo nhanh cho từng điểm POSM.',
    position: 'top'
  },
  {
    targetId: 'tour-nav-camera',
    title: 'Chụp Ảnh Timemark',
    content: 'Nút ở giữa giúp bạn chụp ảnh nghiệm thu có đóng dấu tọa độ GPS và thời gian thực tế.',
    position: 'top'
  },
  {
    targetId: 'tour-nav-profile',
    title: 'Cá Nhân',
    content: 'Quản lý thông tin tài khoản, cài đặt ứng dụng (PWA) hoặc đăng xuất.',
    position: 'top'
  }
];

const OnboardingTour = () => {
  const [currentStep, setCurrentStep] = useState(null);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    const isCompleted = localStorage.getItem('posm_onboarding_completed');
    if (!isCompleted) {
      // Start tour after a short delay for layout stabilization
      setTimeout(() => setCurrentStep(0), 1000);
    }
  }, []);

  const updateTargetRect = useCallback(() => {
    if (currentStep === null) return;
    const element = document.getElementById(TOUR_STEPS[currentStep].targetId);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    }
  }, [currentStep]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect);
    };
  }, [updateTargetRect]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem('posm_onboarding_completed', 'true');
    setCurrentStep(null);
  };

  if (currentStep === null || !targetRect) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Dimmed Background */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] pointer-events-auto"
        onClick={handleComplete}
      />

      {/* Spotlight Circle */}
      <motion.div 
        initial={false}
        animate={{
          x: targetRect.left - 10,
          y: targetRect.top - 10,
          width: targetRect.width + 20,
          height: targetRect.height + 20,
        }}
        className="absolute bg-white/10 border-2 border-white/50 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] z-[101]"
      />

      {/* Tooltip Content */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
          top: step.position === 'top' ? targetRect.top - 200 : targetRect.bottom + 20,
          left: Math.max(10, Math.min(window.innerWidth - 320, targetRect.left - 150 + targetRect.width / 2))
        }}
        className="absolute z-[102] w-[300px] bg-white rounded-3xl p-6 shadow-2xl pointer-events-auto border border-slate-100"
      >
        <div className="flex justify-between items-start mb-4">
           <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Bước {currentStep + 1}/{TOUR_STEPS.length}
           </div>
           <button onClick={handleComplete} className="text-slate-300 hover:text-slate-500">
             <X size={18} />
           </button>
        </div>

        <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">
          {step.title}
        </h3>
        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
          {step.content}
        </p>

        <div className="flex items-center justify-between">
            <button onClick={handleComplete} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors">
               Bỏ qua
            </button>
            <button 
              onClick={handleNext}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-premium-indigo active:scale-95 transition-all"
            >
              {currentStep < TOUR_STEPS.length - 1 ? (
                <>Tiếp tục <ChevronRight size={16} /></>
              ) : (
                <>Khám phá ngay <CheckCircle size={16} /></>
              )}
            </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTour;
