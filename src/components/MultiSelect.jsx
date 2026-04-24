import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, RefreshCw } from 'lucide-react';

// Single-select dropdown — bấm chọn 1 tuần, đóng ngay, không checkbox
const MultiSelect = ({ options, value, onChange, label = "Select", theme = "light" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // value là string (tuần đang chọn) hoặc 'All'
  const selected = Array.isArray(value) ? value[0] : value;
  const isAll = !selected || selected === 'All';
  const displayText = isAll ? label : selected;

  const handleSelect = (opt) => {
    onChange(opt === 'All' ? ['All'] : [opt]);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1 min-w-[100px]" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border-none rounded-2xl px-4 py-4 text-[11px] uppercase font-black outline-none flex justify-between items-center transition-all active:scale-95
          ${theme === 'dark'
            ? 'bg-white/10 text-white border border-white/10 ' + (!isAll ? 'ring-2 ring-white/30 bg-white/20' : '')
            : 'bg-slate-50 shadow-inner ' + (!isAll ? 'ring-2 ring-indigo-500/20 bg-indigo-50/30' : '')
          }`}
      >
        <span className={`truncate ${theme === 'dark' ? 'text-white' : (isAll ? 'text-slate-500' : 'text-indigo-700')}`}>
          {displayText}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 ml-2 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={{ zIndex: 1000 }}
          className="absolute top-full left-0 w-full mt-2 bg-white rounded-[1.5rem] shadow-premium-dark border border-slate-100 py-3 max-h-72 overflow-y-auto"
        >
          {options.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <RefreshCw className="animate-spin text-slate-300 mx-auto mb-2" size={16} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đang tải data...</p>
            </div>
          ) : options.map(opt => {
            const isActive = opt === selected || (isAll && opt === 'All');
            return (
              <div
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`px-6 py-3.5 cursor-pointer transition-colors text-[12px] font-black
                  ${isActive
                    ? 'bg-indigo-600 text-white mx-2 rounded-xl'
                    : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {opt === 'All' ? 'Tất cả' : opt}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default MultiSelect;
