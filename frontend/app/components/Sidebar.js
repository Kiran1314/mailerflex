'use client';
import { LayoutDashboard, Users, Send, FileText, PenTool, AtSign, BarChart3, ListFilter } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
     { 
      id: 'campaigns-group', 
      label: 'Campaigns', 
      icon: Send,
      subItems: [
        { id: 'new-campaign', label: 'New Campaign' },
        { id: 'all-campaigns', label: 'All Campaigns' }
      ]
    },
    { id: 'templates-mgr', label: 'Templates', icon: FileText },
    { id: 'signatures-mgr', label: 'Signatures', icon: PenTool },
    { id: 'senders-mgr', label: 'Sender Emails', icon: AtSign },
    { id: 'contacts', label: 'Contact Directory', icon: Users },
    { id: 'analytics', label: 'Analytics & Logs', icon: BarChart3 }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-extrabold text-white tracking-wider flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-full inline-block animate-pulse"></span> MailerFlex
        </h2>
        <p className="text-xs text-slate-500 mt-1">Enterprise SaaS Platform</p>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab));

          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  if (!item.subItems) setActiveTab(item.id);
                  else setActiveTab('new-campaign');
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>

              {/* Sub-items for Campaigns */}
              {item.subItems && (
                <div className="pl-9 space-y-1 pt-1">
                  {item.subItems.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setActiveTab(sub.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${
                        activeTab === sub.id ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        IBC Studio &copy; 2026
      </div>
    </aside>
  );
}