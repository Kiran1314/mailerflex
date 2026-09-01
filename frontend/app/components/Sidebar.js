'use client';
import { useState } from 'react';
import { 
  LayoutDashboard, Users, Mail, Layers, FileText, PenTool, BarChart3, 
  Inbox, Send, Archive, Trash, ChevronDown, ChevronRight, AtSign, FileCode 
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  senders, 
  selectedWebmailSender, 
  setSelectedWebmailSender, 
  activeFolder, 
  setActiveFolder, 
  unreadWebmailCount 
}) {
  // Track multiple expanded senders using their unique _id
  const [expandedSenderIds, setExpandedSenderIds] = useState({});

  const folders = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox size={14} /> },
    { id: 'junk', label: 'Junk Email', icon: <Layers size={14} /> },
    { id: 'drafts', label: 'Drafts', icon: <FileText size={14} /> },
    { id: 'sent', label: 'Sent Items', icon: <Send size={14} /> },
    { id: 'deleted', label: 'Deleted Items', icon: <Trash size={14} /> },
    { id: 'archive', label: 'Archive', icon: <Archive size={14} /> }
  ];

  const toggleExpand = (e, senderId, senderEmail) => {
    e.stopPropagation();
    setSelectedWebmailSender(senderEmail);
    setExpandedSenderIds(prev => ({
      ...prev,
      [senderId]: !prev[senderId]
    }));
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">MailerFlex SaaS</h2>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <LayoutDashboard size={16} /> Dashboard
        </button>

        <button 
          onClick={() => setActiveTab('contacts')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'contacts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Users size={16} /> Contact Directory
        </button>

        <div className="pt-3 pb-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider px-3">Incoming & Outgoing Webmail</div>
        {senders?.map(s => {
          const isSelectedSender = selectedWebmailSender === s.email;
          const isExpanded = !!expandedSenderIds[s._id];

          return (
            <div key={s._id} className="space-y-1">
              <div 
                onClick={(e) => toggleExpand(e, s._id, s.email)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition ${isSelectedSender ? 'bg-slate-100 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="truncate max-w-[140px] flex items-center gap-1.5"><AtSign size={13}/>{s.email}</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {isExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-blue-100 ml-3 my-1">
                  {folders.map(f => {
                    const isFolderActive = activeTab === 'webmail' && activeFolder === f.id && selectedWebmailSender === s.email;
                    return (
                      <button
                        key={f.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWebmailSender(s.email);
                          setActiveFolder(f.id);
                          setActiveTab('webmail');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${isFolderActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="flex items-center gap-2">{f.icon} {f.label}</span>
                        {f.id === 'inbox' && isSelectedSender && unreadWebmailCount > 0 && (
                          <span className="w-4 h-4 bg-rose-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">{unreadWebmailCount}</span>
                        )}
                      </button>
                    );
                  })}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWebmailSender(s.email);
                      setActiveTab('compose-individual');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition mt-1"
                  >
                    <PenTool size={12} /> Compose Message
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-3 pb-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider px-3">Campaigns & Mass Mail</div>
        <button 
          onClick={() => setActiveTab('new-campaign')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'new-campaign' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Mail size={16} /> New Campaign
        </button>
        <button 
          onClick={() => setActiveTab('all-campaigns')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'all-campaigns' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Layers size={16} /> All Campaigns
        </button>

        <div className="pt-3 pb-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider px-3">Configuration & Data</div>
        
        <button 
          onClick={() => setActiveTab('templates-mgr')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'templates-mgr' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <FileCode size={16} /> Templates
        </button>

        <button 
          onClick={() => setActiveTab('signatures-mgr')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'signatures-mgr' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <FileText size={16} /> Signatures
        </button>

        <button 
          onClick={() => setActiveTab('senders-mgr')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'senders-mgr' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <AtSign size={16} /> Sender Emails
        </button>

        <button 
          onClick={() => setActiveTab('analytics')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <BarChart3 size={16} /> Analytics & Logs
        </button>
      </nav>
    </aside>
  );
}