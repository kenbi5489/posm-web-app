import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Check } from 'lucide-react';

/**
 * True Multi-Select Dropdown with Checkboxes
 * - Bấm chọn nhiều item cùng lúc (Multi-select)
 * - Có checkbox/tick để visualize
 * - Logic "Tất cả" (All): 
 *   + Chọn 'All' sẽ bỏ chọn các cái khác.
 *   + Chọn cái khác sẽ bỏ chọn 'All'.
 */
const MultiSelect = ({ options, value, onChange, label = "Chọn", theme = "light" }) => {
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

  const selectedList = Array.isArray(value) ? value : [value];
  const isAll = selectedList.includes('All') || selectedList.length === 0;

  const displayText = useMemo(() => {
    if (isAll) return `Tất cả ${label.toLowerCase()}`;
    if (selectedList.length === 1) return selectedList[0];
    return `${label}: ${selectedList.length}`;
  }, [isAll, selectedList, label]);

  const handleToggle = (opt) => {
    if (opt === 'All') {
      onChange(['All']);
      return;
    }

    let newList = [...selectedList].filter(i => i !== 'All');
    if (newList.includes(opt)) {
      newList = newList.filter(i => i !== opt);
    } else {
      newList.push(opt);
    }

    // Nếu rỗng thì quay về All
    if (newList.length === 0) {
      onChange(['All']);
    } else {
      onChange(newList);
    }
  };

  return (
    <div className="relative flex-1 min-w-[120px]" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border-none rounded-2xl px-4 py-4 text-[10px] sm:text-[11px] uppercase font-black outline-none flex justify-between items-center transition-all active:scale-[0.98]
          ${theme === 'dark'
            ? 'bg-white/10 text-white border border-white/10 ' + (!isAll ? 'ring-2 ring-white/40 bg-white/20' : '')
            : 'bg-slate-50 shadow-inner ' + (!isAll ? 'ring-2 ring-indigo-500/30 bg-indigo-50/50' : '')
          }`}
      >
        <span className={`truncate mr-1 ${theme === 'dark' ? 'text-white' : (isAll ? 'text-slate-500' : 'text-indigo-800')}`}>
          {displayText}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.1 }}
          style={{ zIndex: 1000 }}
          className="absolute top-full left-0 w-full min-w-[160px] mt-2 bg-white rounded-[1.5rem] shadow-premium-dark border border-slate-100 py-3 max-h-72 overflow-y-auto"
        >
          {options.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <RefreshCw className="animate-spin text-slate-300 mx-auto mb-2" size={16} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đang tải data...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {options.map(opt => {
                const isActive = (opt === 'All' && isAll) || (!isAll && selectedList.includes(opt));
                return (
                  <div
                    key={opt}
                    onClick={() => handleToggle(opt)}
                    className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors text-[11px] font-black
                      ${isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <span className="truncate">{opt === 'All' ? 'Tất cả' : opt}</span>
                    {isActive && (
                      <div className="bg-indigo-600 rounded-lg p-0.5 ml-2">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// Helper function to avoid unnecessary recalculations
const useMemo = (fn, deps) => {
  return React.useMemo(fn, deps);
};

export default MultiSelect;
