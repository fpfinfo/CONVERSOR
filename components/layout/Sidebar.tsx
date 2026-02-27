'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FileSpreadsheet, 
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SIDEBAR_ITEMS = [
  { icon: FileSpreadsheet, label: 'Conversor .CSV', href: '/' },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile/Tablet Backdrop - covers screen when sidebar is open on small screens */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 flex flex-col z-50 shrink-0 transition-all duration-300 ease-in-out",
          // Mobile & Tablet: fixed overlay, slide in/out
          "fixed inset-y-0 left-0 w-72",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static in layout flow
          "lg:relative lg:translate-x-0",
          isOpen ? "lg:w-72" : "lg:w-0 lg:border-r-0 lg:overflow-hidden"
        )}
      >
        {/* Logo / Brand */}
        <div className="p-5 sm:p-6 flex items-center gap-3 shrink-0">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <ShieldCheck size={24} />
          </div>
          <motion.div 
            animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -10 }}
            className="flex flex-col min-w-0"
          >
            <span className="text-lg font-black text-slate-900 tracking-tighter leading-none truncate">ÁGIL TJPA</span>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Finanças</span>
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 sm:px-4 space-y-2 mt-4 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item, idx) => {
            const active = pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => {
                  // Close sidebar on mobile/tablet after navigation
                  if (window.innerWidth < 1024) setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 group relative",
                  active 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={22} className={cn(
                  "shrink-0 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-emerald-600" : "text-slate-400"
                )} />
                <span className="text-sm font-bold tracking-tight truncate">{item.label}</span>
                {active && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Version footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-center shrink-0">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v1.1.0</p>
        </div>
      </aside>
    </>
  );
}
