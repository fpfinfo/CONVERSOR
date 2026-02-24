'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { 
  FileUp, 
  FileText, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  ChevronRight,
  LayoutDashboard,
  Users,
  Briefcase,
  Gavel,
  ShieldCheck,
  Settings,
  Menu,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { convertFileToCsv } from '@/lib/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileStatus {
  id: string;
  file: File;
  status: 'idle' | 'processing' | 'completed' | 'error';
  result?: string;
  error?: string;
}

const SIDEBAR_ITEMS = [
  { icon: FileSpreadsheet, label: 'Conversor SEFIN', active: true },
];

export default function ConversorSefin() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [animateIcon, setAnimateIcon] = useState(false);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'idle' as const,
    }));

    const rejectedFiles = fileRejections.map(rejection => ({
      id: Math.random().toString(36).substring(7),
      file: rejection.file,
      status: 'error' as const,
      error: rejection.errors[0].code === 'file-too-large' 
        ? 'Arquivo excede o limite de 100MB' 
        : 'Formato não suportado'
    }));

    setFiles(prev => [...prev, ...newFiles, ...rejectedFiles]);
    
    if (acceptedFiles.length > 0) {
      setAnimateIcon(true);
      setTimeout(() => setAnimateIcon(false), 500);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: {
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']
    }
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processFile = async (fileStatus: FileStatus) => {
    const { file, id } = fileStatus;
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));

    try {
      let csvResult = '';

      if (file.name.endsWith('.xlsm') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        csvResult = Papa.unparse(jsonData, {
          quotes: true,
          delimiter: ",",
        });
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        
        csvResult = Papa.unparse(parsed.data, {
          quotes: true,
          delimiter: ",",
        });
      } else if (file.type.startsWith('image/') || file.name.endsWith('.pdf')) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
        
        csvResult = await convertFileToCsv(base64, file.type);
      }

      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'completed', 
        result: csvResult 
      } : f));
    } catch (error: any) {
      console.error(`Error processing ${file.name}:`, error);
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: error.message || 'Erro desconhecido' 
      } : f));
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    const idleFiles = files.filter(f => f.status === 'idle');
    for (const file of idleFiles) {
      await processFile(file);
    }
    setIsProcessingAll(false);
  };

  const downloadFile = (fileStatus: FileStatus) => {
    if (!fileStatus.result) return;
    
    const blob = new Blob([fileStatus.result], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileStatus.file.name.split('.')[0]}_convertido.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-30",
        isSidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
            <FileSpreadsheet size={24} />
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-lg font-black tracking-widest text-slate-900 uppercase">ÁGIL TJPA</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestão Financeira</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item, idx) => (
            <button
              key={idx}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 group relative",
                item.active 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={22} className={cn(
                "shrink-0 transition-transform duration-200 group-hover:scale-110",
                item.active ? "text-emerald-600" : "text-slate-400"
              )} />
              {isSidebarOpen && (
                <span className="text-sm font-bold tracking-tight">{item.label}</span>
              )}
              {item.active && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 flex items-center justify-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Utilitários</span>
              <ChevronRight size={14} />
              <span className="text-emerald-600">Conversor SEFIN</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-700">Servidor Público</span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Acesso Autorizado</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden relative">
              <Image 
                src="https://picsum.photos/seed/user/100" 
                alt="User" 
                fill
                className="object-cover"
                referrerPolicy="no-referrer" 
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full space-y-10">
          {/* Hero Section */}
          <section className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={12} />
              Ambiente Seguro
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Conversor Inteligente</h2>
            <p className="text-slate-500 max-w-2xl text-lg leading-relaxed">
              Padronização automática de arquivos para os sistemas de gestão financeira do TJPA. 
              Converta planilhas, documentos PDF e imagens em segundos com tecnologia de IA.
            </p>
          </section>

          {/* Upload Area */}
          <div 
            {...getRootProps()} 
            className={cn(
              "relative group cursor-pointer rounded-[3rem] border-2 border-dashed transition-all duration-500 p-16 flex flex-col items-center justify-center gap-6 bg-white shadow-xl shadow-slate-200/50",
              isDragActive ? "border-emerald-500 bg-emerald-50/50 scale-[0.99]" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50"
            )}
          >
            <input {...getInputProps()} />
          <motion.div 
            animate={animateIcon ? { y: [0, -10, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
              "w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-2xl",
              isDragActive ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
            )}
          >
            <FileUp size={48} />
          </motion.div>
            <div className="text-center space-y-2">
              <p className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                {isDragActive ? "Solte para Processar" : "Arraste seus Arquivos"}
              </p>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                XLSX • XLS • XLSM • CSV • PDF • IMAGENS (MÁX. 100MB)
              </p>
            </div>
            <div className="absolute bottom-6 flex gap-4 opacity-30 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> CSV
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-red-500" /> PDF
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-amber-500" /> Imagem
              </div>
            </div>
          </div>

          {/* File List */}
          <AnimatePresence mode="popLayout">
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Fila de Processamento</h3>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">{files.length}</span>
                  </div>
                  <button 
                    onClick={processAll}
                    disabled={isProcessingAll || files.every(f => f.status !== 'idle')}
                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-slate-200 flex items-center gap-3"
                  >
                    {isProcessingAll ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                    Processar Todos
                  </button>
                </div>

                <div className="grid gap-4">
                  {files.map((fileStatus) => (
                    <motion.div
                      key={fileStatus.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-shadow"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        fileStatus.file.name.endsWith('.pdf') ? "bg-red-50 text-red-500" : 
                        fileStatus.file.type.startsWith('image/') ? "bg-amber-50 text-amber-500" :
                        (fileStatus.file.name.endsWith('.xlsm') || fileStatus.file.name.endsWith('.xlsx') || fileStatus.file.name.endsWith('.xls')) ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
                      )}>
                        {fileStatus.file.name.endsWith('.pdf') ? <FileText size={32} /> : 
                         fileStatus.file.type.startsWith('image/') ? <ImageIcon size={32} /> :
                         <FileSpreadsheet size={32} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-slate-800 truncate uppercase tracking-tight">{fileStatus.file.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {(fileStatus.file.size / 1024).toFixed(1)} KB
                          </span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {fileStatus.file.name.split('.').pop()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {fileStatus.status === 'idle' && (
                          <button 
                            onClick={() => processFile(fileStatus)}
                            className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-emerald-600 hover:text-white rounded-2xl transition-all duration-300"
                            title="Converter"
                          >
                            <ChevronRight size={24} />
                          </button>
                        )}
                        
                        {fileStatus.status === 'processing' && (
                          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                            <Loader2 className="animate-spin" size={16} />
                            Processando
                          </div>
                        )}

                        {fileStatus.status === 'completed' && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full">
                              <CheckCircle2 size={24} />
                            </div>
                            <button 
                              onClick={() => downloadFile(fileStatus)}
                              className="flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                            >
                              <Download size={16} />
                              Baixar
                            </button>
                          </div>
                        )}

                        {fileStatus.status === 'error' && (
                          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest" title={fileStatus.error}>
                            <AlertCircle size={16} />
                            Erro
                          </div>
                        )}

                        <button 
                          onClick={() => removeFile(fileStatus.id)}
                          className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300"
                          title="Remover"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {files.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 space-y-6"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-white text-slate-200 shadow-sm border border-slate-100">
                <FileSpreadsheet size={48} />
              </div>
              <div className="space-y-2">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Nenhum arquivo na fila</p>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">Aguardando upload para processamento</p>
              </div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
