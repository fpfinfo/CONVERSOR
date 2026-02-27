'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FileSpreadsheet, 
  FileStack, 
  ChevronRight, 
  Menu, 
  X,
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
      {/* Mobile Backdrop */}
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

      <aside 
        className={cn(
          "bg-white border-r border-slate-200 flex flex-col transition-all duration-500 ease-in-out z-50 fixed inset-y-0 left-0 lg:relative",
          isOpen ? "w-72 translate-x-0" : "w-20 -translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <ShieldCheck size={24} />
          </div>
          {(isOpen || true) && (
            <motion.div 
              animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -10 }}
              className={cn("flex flex-col transition-opacity duration-300", !isOpen && "lg:hidden")}
            >
              <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">ÁGIL TJPA</span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Finanças</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {SIDEBAR_ITEMS.map((item, idx) => {
            const active = pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => {
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
                <span className={cn(
                  "text-sm font-bold tracking-tight transition-opacity duration-300",
                  !isOpen && "lg:hidden"
                )}>{item.label}</span>
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

        <div className="p-4 border-t border-slate-100 flex items-center justify-center">
          <p className={cn(
            "text-[10px] font-black text-slate-300 uppercase tracking-widest transition-opacity duration-300",
            !isOpen && "lg:hidden"
          )}>v1.1.0</p>
        </div>
      </aside>
    </>
  );
}
