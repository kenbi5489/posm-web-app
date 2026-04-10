import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchUsers } from '../services/api';
import { db } from '../services/db';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('posm_user');
      if (savedUser && savedUser !== 'undefined') {
        setUser(JSON.parse(savedUser));
      }
      const savedStaff = localStorage.getItem('selected_staff');
      if (savedStaff && savedStaff !== 'undefined') {
        setSelectedStaff(JSON.parse(savedStaff));
      }
    } catch (e) {
      console.error("Failed to load saved state:", e);
      localStorage.removeItem('posm_user');
      localStorage.removeItem('selected_staff');
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const { mockUsers } = await import('../services/mockData');
      const users = mockUsers; // FORCE using mock data to rule out Google Sheets issue
      
      const cleanUsername = (username || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim(); // Prevent trailing space on password too
      
      const foundUser = users.find(u => u.user_name.toLowerCase() === cleanUsername && u.password === cleanPassword);
      
      if (!foundUser) {
         return { success: false, message: `Sai thông tin. User (viết thường): '${cleanUsername}', Pass length: ${cleanPassword.length}` };
      }

      if (foundUser.active !== 'TRUE' && foundUser.active !== 'true' && foundUser.active !== true) {
         return { success: false, message: 'Tài khoản đã bị khóa' };
      }
      
      const userData = {
        user_id: foundUser.user_id,
        user_name: foundUser.user_name,
        ho_ten: foundUser.ho_ten,
        role: foundUser.role,
        email: foundUser.email
      };
      
      try {
         await db.users.put(userData);
      } catch (dbErr) {
         console.error("Dexie put error:", dbErr);
         // Continue even if IndexedDB fails, we still have localStorage
      }

      setUser(userData);
      localStorage.setItem('posm_user', JSON.stringify(userData));
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Lỗi hệ thống: ' + error.message };
    }
  };

  const logout = () => {
    setUser(null);
    setSelectedStaff(null);
    localStorage.removeItem('posm_user');
    localStorage.removeItem('selected_staff');
    db.users.clear();
  };

  const selectStaff = (staff) => {
    setSelectedStaff(staff);
    if (staff) {
      localStorage.setItem('selected_staff', JSON.stringify(staff));
    } else {
      localStorage.removeItem('selected_staff');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, selectedStaff, selectStaff, lastSync, setLastSync }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
