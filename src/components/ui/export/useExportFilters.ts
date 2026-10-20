'use client';
import { useState } from 'react';

export interface DateRange { startDate: Date | null; endDate: Date | null; key: string; }

export default function useExportFilters(users?: Record<string, unknown>[]) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange[]>([{ startDate: null, endDate: null, key: 'selection' }]);

  if (!users || !Array.isArray(users)) {
    return { filterStatus, setFilterStatus, dateRange, setDateRange, filteredUsers: [] };
  }

  const filteredUsers = users
    .filter((u) => filterStatus === 'all' || (u.status || 'Active') === filterStatus)
    .filter((u) => {
      if (!dateRange[0].startDate || !dateRange[0].endDate) return true;
      const dateFields = ['created_at', 'updated_at', 'applied_at', 'date'];
      let dateValue: string | null = null;
      for (const f of dateFields) { if (u[f]) { dateValue = String(u[f]); break; } }
      if (!dateValue) return false;
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return false;
      const s = new Date(dateRange[0].startDate); s.setHours(0, 0, 0, 0);
      const e = new Date(dateRange[0].endDate); e.setHours(23, 59, 59, 999);
      return d >= s && d <= e;
    });

  return { filterStatus, setFilterStatus, dateRange, setDateRange, filteredUsers };
}
