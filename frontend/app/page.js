'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import Sidebar from './components/Sidebar';
import EmailEditor from './components/EmailEditor';
import { Upload, Send, CheckCircle, BellRing, Users, Mail, Layers, FileText, PenTool, AtSign, BarChart3, AlertTriangle, Trash2, Search, ChevronLeft, ChevronRight, Download, RefreshCw, Edit3 } from 'lucide-react';

const CHART_COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f43f5e'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [senders, setSenders] = useState([]);
  const [groupsList, setGroupsList] = useState(['General']);
  const [analytics, setAnalytics] = useState({ summary: {}, dailyTrends: [], logs: [] });
  const [file, setFile] = useState(null);
  const [notification, setNotification] = useState(null);

  // Delivery Date Filter State (Calendar style tabs)
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState('Today');

  // Sending Progress State
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 100 });

  // Contact CRUD, Group Tab & Table State
  const [contactForm, setContactForm] = useState({ 
    name: '', email: '', company: '', mobile: '', industry: '', group: 'General' 
  });
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupTab, setSelectedGroupTab] = useState('All');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Analytics Logs Pagination State
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 8;

  // Sender Email Form State
  const [senderForm, setSenderForm] = useState({ id: null, email: '', host: 'smtp.hostinger.com', port: 587, password: '' });

  // Template Manager State
  const [templateForm, setTemplateForm] = useState({
    id: null, title: '', subject: '', htmlContent: '<p>Hello {{name}},</p><p><br></p><p>Check out our latest update for {{company}}.</p>', isDefault: false
  });

  // Signature Manager State
  const [selectedSigEmail, setSelectedSigEmail] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('<p>Best Regards,<br>Team</p>');
  const [sigFile, setSigFile] = useState(null);

  // Campaign Form State
  const [campaignData, setCampaignData] = useState({
    title: '',
    subject: '',
    group: 'General',
    senderEmail: '',
    cc: '',
    bcc: '',
    htmlContent: '<p>Start typing your email body content...</p>',
    attachments: null
  });

  // Keep a ref of campaignData so background polls don't overwrite active user selections
  const campaignDataRef = useRef(campaignData);
  campaignDataRef.current = campaignData;

  const fetchData = async (isInitial = false) => {
    try {
      const [contactRes, campRes, tempRes, sigRes, senderRes, analyticsRes, groupRes] = await Promise.all([
        axios.get('http://localhost:5000/api/contacts').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/campaigns').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/templates').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/signatures').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/senders').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/analytics').catch(() => ({ data: { summary: {}, dailyTrends: [], logs: [] } })),
        axios.get('http://localhost:5000/api/contacts/groups').catch(() => ({ data: ['General'] }))
      ]);

      setContacts(contactRes.data || []);
      setCampaigns(campRes.data || []);
      setTemplates(tempRes.data || []);
      setSignatures(sigRes.data || []);
      setSenders(senderRes.data || []);
      setAnalytics(analyticsRes.data || { summary: {}, dailyTrends: [], logs: [] });

      const fetchedGroups = groupRes.data && groupRes.data.length > 0 ? groupRes.data : ['General'];
      setGroupsList(fetchedGroups);

      if (senderRes.data && senderRes.data.length > 0) {
        const defaultEmail = senderRes.data[0].email;
        if (isInitial || !campaignDataRef.current.senderEmail) {
          setCampaignData(prev => ({ 
            ...prev, 
            senderEmail: prev.senderEmail || defaultEmail,
            group: prev.group && fetchedGroups.includes(prev.group) ? prev.group : (fetchedGroups[0] || 'General')
          }));
        }
        if (!selectedSigEmail) {
          setSelectedSigEmail(defaultEmail);
          const currSig = (sigRes.data || []).find(s => s.emailId === defaultEmail);
          if (currSig) setSignatureHtml(currSig.htmlContent);
        }
      }
    } catch (err) {
      console.error('Backend connection error', err);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  // Real-time background data polling every 5 seconds (skips form resets)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchData(false);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleContactUpload = async (e) => {
    e.preventDefault();
    if (!file) return triggerNotification('Please select a CSV file first.');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post('http://localhost:5000/api/contacts/upload', formData);
      triggerNotification('Contacts successfully imported!');
      setFile(null);
      fetchData(false);
    } catch (err) {
      triggerNotification('Error uploading CSV file.');
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/contacts/${editingId}`, contactForm);
        triggerNotification('Contact updated!');
      } else {
        await axios.post('http://localhost:5000/api/contacts', contactForm);
        triggerNotification('Contact created!');
      }
      setContactForm({ name: '', email: '', company: '', mobile: '', industry: '', group: 'General' });
      setEditingId(null);
      fetchData(false);
    } catch (err) {
      triggerNotification('Operation failed.');
    }
  };

  const handleDeleteContact = async (id) => {
    if (confirm('Delete contact?')) {
      await axios.delete(`http://localhost:5000/api/contacts/${id}`);
      triggerNotification('Contact deleted.');
      fetchData(false);
    }
  };

  const handleMassDelete = async () => {
    if (selectedContactIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedContactIds.length} contacts?`)) {
      try {
        await Promise.all(selectedContactIds.map(id => axios.delete(`http://localhost:5000/api/contacts/${id}`)));
        triggerNotification(`${selectedContactIds.length} contacts deleted.`);
        setSelectedContactIds([]);
        fetchData(false);
      } catch (err) {
        triggerNotification('Failed to execute mass deletion.');
      }
    }
  };

  const availableGroups = useMemo(() => {
    const groups = new Set((contacts || []).map(c => c.group || 'General'));
    return ['All', ...Array.from(groups)];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return (contacts || []).filter(c => {
      const matchesGroupTab = selectedGroupTab === 'All' || (c.group || 'General') === selectedGroupTab;
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.group && c.group.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesGroupTab && matchesSearch;
    });
  }, [contacts, searchTerm, selectedGroupTab]);

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage) || 1;
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredContacts.slice(start, start + itemsPerPage);
  }, [filteredContacts, currentPage]);

  const totalLogPages = Math.ceil((analytics?.logs || []).length / logsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const logs = analytics?.logs || [];
    const start = (logPage - 1) * logsPerPage;
    return logs.slice(start, start + logsPerPage);
  }, [analytics?.logs, logPage]);

  const handleExportLogsCSV = () => {
    const logs = analytics?.logs || [];
    if (logs.length === 0) return triggerNotification('No logs available to export.');
    const headers = ['Campaign Title', 'Sender Email', 'Recipient Email', 'Status', 'Opened', 'Unsubscribed', 'Timestamp'];
    const rows = logs.map(l => [
      `"${l.campaignTitle || ''}"`,
      `"${l.senderEmail || ''}"`,
      `"${l.recipientEmail || ''}"`,
      `"${l.status || ''}"`,
      l.opened ? 'Yes' : 'No',
      l.unsubscribed ? 'Yes' : 'No',
      `"${new Date(l.sentAt).toLocaleString()}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `engagement_logs_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification('Engagement logs successfully exported to CSV!');
  };

  const handleSelectAllToggle = (e) => {
    if (e.target.checked) {
      setSelectedContactIds(paginatedContacts.map(c => c._id));
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Mobile', 'Industry', 'Group'];
    const rows = filteredContacts.map(c => [
      `"${c.name || ''}"`,
      `"${c.email || ''}"`,
      `"${c.company || ''}"`,
      `"${c.mobile || ''}"`,
      `"${c.industry || ''}"`,
      `"${c.group || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contacts_${selectedGroupTab.toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification('Contacts successfully exported to CSV!');
  };

  const handleSaveSender = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/senders', senderForm);
      triggerNotification('Sender email saved successfully!');
      setSenderForm({ id: null, email: '', host: 'smtp.hostinger.com', port: 587, password: '' });
      fetchData(false);
    } catch (err) {
      triggerNotification('Failed to save sender email.');
    }
  };

  const handleDeleteSender = async (id) => {
    if (confirm('Delete this sender email?')) {
      await axios.delete(`http://localhost:5000/api/senders/${id}`);
      triggerNotification('Sender deleted.');
      fetchData(false);
    }
  };

  const handleSaveSignature = async (e) => {
    e.preventDefault();
    if (!selectedSigEmail) {
      triggerNotification('Please select a valid sender email first.');
      return;
    }
    const formData = new FormData();
    formData.append('emailId', selectedSigEmail);
    formData.append('htmlContent', signatureHtml);
    if (sigFile) formData.append('signatureImage', sigFile);

    try {
      const res = await axios.post('http://localhost:5000/api/signatures', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.htmlContent) {
        setSignatureHtml(res.data.htmlContent);
      }
      triggerNotification(`Signature saved for ${selectedSigEmail}!`);
      setSigFile(null);
      fetchData(false);
    } catch (err) {
      triggerNotification('Failed to save signature.');
    }
  };

  const handleSigEmailChange = (e) => {
    const email = e.target.value;
    setSelectedSigEmail(email);
    const found = (signatures || []).find(s => s.emailId === email);
    setSignatureHtml(found ? found.htmlContent : '<p>Best Regards,<br>Team</p>');
  };

  const handleCampaignSenderChange = (e) => {
    const newEmail = e.target.value;
    const newSigRecord = (signatures || []).find(s => s.emailId === newEmail);
    const newSigHtml = newSigRecord ? newSigRecord.htmlContent : '';

    setCampaignData(prev => ({
      ...prev,
      senderEmail: newEmail,
      htmlContent: prev.htmlContent + (newSigHtml ? `<br><br>${newSigHtml}` : '')
    }));
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:5000/api/templates', templateForm);
    triggerNotification('Template saved!');
    setTemplateForm({ id: null, title: '', subject: '', htmlContent: '<p>New Template</p>', isDefault: false });
    fetchData(false);
  };

  const handleDeleteTemplate = async (id) => {
    if (confirm('Delete template?')) {
      await axios.delete(`http://localhost:5000/api/templates/${id}`);
      triggerNotification('Template deleted.');
      fetchData(false);
    }
  };

  const handleSelectTemplateForCampaign = (e) => {
    const selectedId = e.target.value;
    const selected = (templates || []).find(t => t._id === selectedId);
    if (selected) {
      const sigRecord = (signatures || []).find(s => s.emailId === campaignData.senderEmail);
      const sigHtml = sigRecord ? `<br><br>${sigRecord.htmlContent}` : '';
      const fullTemplateHtml = (selected.htmlContent || '') + sigHtml;

      setCampaignData(prev => ({
        ...prev,
        title: selected.title || '',
        subject: selected.subject || '',
        htmlContent: fullTemplateHtml
      }));
      triggerNotification(`Template "${selected.title}" loaded into editor!`);
    }
  };

  const handleLoadCampaignForResend = (camp) => {
    setCampaignData({
      title: camp.title || '',
      subject: camp.subject || '',
      group: camp.group || 'General',
      senderEmail: camp.senderEmail || (senders[0]?.email ?? ''),
      cc: camp.cc || '',
      bcc: camp.bcc || '',
      htmlContent: camp.htmlContent || '',
      attachments: null
    });
    setActiveTab('new-campaign');
    triggerNotification(`Loaded campaign "${camp.title || camp.subject}" into New Campaign editor.`);
  };

  const handleSendCampaign = async (e) => {
    e.preventDefault();
    if (!campaignData.senderEmail) {
      triggerNotification('Please select a sender email.');
      return;
    }
    if (!campaignData.group) {
      triggerNotification('Please specify a target group.');
      return;
    }

    setIsSending(true);
    setSendProgress({ current: 0, total: 100 });

    try {
      const progressInterval = setInterval(() => {
        setSendProgress(prev => {
          if (prev.current >= 92) {
            clearInterval(progressInterval);
            return prev;
          }
          return { ...prev, current: prev.current + Math.floor(Math.random() * 12) + 6 };
        });
      }, 350);

      const response = await axios.post('http://localhost:5000/api/campaigns/send', campaignData);
      
      clearInterval(progressInterval);
      setSendProgress({ current: 100, total: 100 });

      setTimeout(() => {
        setIsSending(false);
        triggerNotification(response.data.message || 'Campaign dispatched successfully!');
        setActiveTab('all-campaigns');
        fetchData(false);
      }, 800);

    } catch (err) {
      setIsSending(false);
      const errorMsg = err.response?.data?.error || 'Failed to dispatch campaign.';
      triggerNotification(errorMsg);
    }
  };

  const pieChartData = useMemo(() => {
    const trends = analytics?.dailyTrends || [];
    const todayStr = new Date().toLocaleDateString();
    const activeDate = selectedDeliveryDate === 'Today' ? todayStr : selectedDeliveryDate;
    const matchedTrend = trends.find(t => t.date === activeDate);

    if (matchedTrend) {
      return [
        { name: 'Sent', value: matchedTrend.sent || 0 },
        { name: 'Delivered', value: matchedTrend.delivered || 0 },
        { name: 'Bounced', value: matchedTrend.bounced || 0 }
      ];
    } else {
      return [
        { name: 'Total Contacts', value: contacts.length || 0 },
        { name: 'Total Sent', value: analytics?.summary?.totalSent || 0 },
        { name: 'Delivered Rate (%)', value: parseFloat(analytics?.summary?.deliveryRate) || 0 },
        { name: 'Bounced', value: analytics?.summary?.totalBounced || 0 }
      ];
    }
  }, [analytics, selectedDeliveryDate, contacts]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Sending Progress Overlay */}
      <AnimatePresence>
        {isSending && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-blue-100 text-center space-y-6 relative overflow-hidden">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl"></div>

              <div className="relative z-10 space-y-2">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-inner animate-pulse">
                  <Send size={28} className="animate-bounce" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Queueing & Broadcasting</h3>
                <p className="text-xs font-medium text-slate-500">Transmitting personalized emails securely via SMTP...</p>
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span>Sending Queue</span>
                  <span className="text-blue-600">{sendProgress.current}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <motion.div 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full shadow-lg shadow-blue-500/50"
                    style={{ width: `${sendProgress.current}%` }}
                    transition={{ duration: 0.3 }}
                  ></motion.div>
                </div>
                <p className="text-xs font-semibold text-slate-400">
                  {sendProgress.current < 100 ? `Processing emails in queue (${sendProgress.current}%)...` : 'Finalizing delivery reports...'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
          <h1 className="text-lg font-bold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h1>
          <div className="flex items-center gap-4">
            <div className="relative bg-slate-100 p-2 rounded-full text-slate-600 hover:bg-slate-200 cursor-pointer">
              <BellRing size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium">
              <CheckCircle size={18} className="text-emerald-400" />
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            
            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold"><Users size={22} /></div>
                    <div><p className="text-sm font-medium text-slate-500">Total Contacts</p><h3 className="text-2xl font-bold text-slate-800">{contacts.length}</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"><Send size={22} /></div>
                    <div><p className="text-sm font-medium text-slate-500">Total Sent</p><h3 className="text-2xl font-bold text-slate-800">{analytics?.summary?.totalSent || 0}</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"><CheckCircle size={22} /></div>
                    <div><p className="text-sm font-medium text-slate-500">Delivered Rate</p><h3 className="text-2xl font-bold text-emerald-600">{analytics?.summary?.deliveryRate || 0}%</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold"><AlertTriangle size={22} /></div>
                    <div><p className="text-sm font-medium text-slate-500">Bounced</p><h3 className="text-2xl font-bold text-rose-600">{analytics?.summary?.totalBounced || 0}</h3></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-bold text-slate-800">Daily Email Delivery Overview</h3>
                        <button onClick={() => setActiveTab('analytics')} className="text-xs font-semibold text-blue-600 hover:underline">View Analytics &rarr;</button>
                      </div>

                      {/* Calendar-Style Date Filter Navigation Bar */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                        {(() => {
                          const trends = analytics?.dailyTrends || [];
                          const todayStr = new Date().toLocaleDateString();
                          const yesterdayObj = new Date();
                          yesterdayObj.setDate(yesterdayObj.getDate() - 1);
                          const yesterdayStr = yesterdayObj.toLocaleDateString();

                          const allDates = ['Today', ...trends.map(t => t.date)];
                          const uniqueDates = Array.from(new Set(allDates));

                          return uniqueDates.map((dateKey) => {
                            let label = dateKey;
                            if (dateKey === todayStr) label = 'Today';
                            else if (dateKey === yesterdayStr) label = 'Yesterday';

                            const isSelected = selectedDeliveryDate === dateKey || (dateKey === 'Today' && selectedDeliveryDate === todayStr);

                            return (
                              <button
                                key={dateKey}
                                onClick={() => setSelectedDeliveryDate(dateKey === 'Today' ? todayStr : dateKey)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {(() => {
                        const trends = analytics?.dailyTrends || [];
                        const todayStr = new Date().toLocaleDateString();
                        const activeDate = selectedDeliveryDate === 'Today' ? todayStr : selectedDeliveryDate;
                        const matchedTrend = trends.find(t => t.date === activeDate) || trends[0];

                        if (!matchedTrend) {
                          return <p className="text-xs text-slate-400 italic py-6 text-center">No delivery data recorded for this date.</p>;
                        }

                        return (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                              <span>Date: {matchedTrend.date}</span>
                              <span className="text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Active Filter</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="bg-white p-3 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">Sent</p>
                                <p className="text-xl font-extrabold text-blue-600 mt-0.5">{matchedTrend.sent}</p>
                              </div>
                              <div className="bg-white p-3 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">Delivered</p>
                                <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{matchedTrend.delivered}</p>
                              </div>
                              <div className="bg-white p-3 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">Bounced</p>
                                <p className="text-xl font-extrabold text-rose-600 mt-0.5">{matchedTrend.bounced}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between"
                  >
                    <div className="w-full flex justify-between items-center mb-2">
                      <h3 className="text-base font-bold text-slate-800">Campaign Metrics Overview</h3>
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full shadow-inner animate-pulse">Animated 3D View</span>
                    </div>
                    <div className="w-full h-64 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <defs>
                            {CHART_COLORS.map((color, index) => (
                              <linearGradient key={`grad-${index}`} id={`colorGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                                <stop offset="95%" stopColor={color} stopOpacity={0.6} />
                              </linearGradient>
                            ))}
                          </defs>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={6}
                            dataKey="value"
                            animationBegin={200}
                            animationDuration={1200}
                            label={({ name, percent }) => `${name.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={`url(#colorGrad-${index})`} 
                                stroke="#ffffff" 
                                strokeWidth={3} 
                                style={{ filter: 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.12))', cursor: 'pointer' }}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '12px', padding: '10px 14px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}
                            formatter={(value) => [value, 'Count']} 
                          />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* CONTACTS TAB */}
            {activeTab === 'contacts' && (
              <motion.div key="contacts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800">{editingId ? 'Edit Contact' : 'Add Single Contact'}</h3>
                    <form onSubmit={handleSaveContact} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" required placeholder="Name" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                        <input type="email" required placeholder="Email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Company" value={contactForm.company || ''} onChange={e => setContactForm({...contactForm, company: e.target.value})} className="border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                        <input type="text" placeholder="Mobile" value={contactForm.mobile || ''} onChange={e => setContactForm({...contactForm, mobile: e.target.value})} className="border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Industry" value={contactForm.industry || ''} onChange={e => setContactForm({...contactForm, industry: e.target.value})} className="border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                        <input type="text" placeholder="Group" value={contactForm.group || ''} onChange={e => setContactForm({...contactForm, group: e.target.value})} className="border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">{editingId ? 'Update Contact' : 'Save Contact'}</button>
                    </form>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 mb-1">Bulk CSV Upload</h3>
                      <p className="text-xs text-slate-500 mb-3">Upload your contact list using a formatted CSV file.</p>
                      
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1 mb-4">
                        <span className="font-bold uppercase text-[10px] text-blue-600 tracking-wider">Required CSV Headers:</span>
                        <p className="font-mono bg-white p-2 rounded border border-slate-200 text-slate-800">name,email,company,mobile,industry,group</p>
                      </div>

                      <form onSubmit={handleContactUpload} className="space-y-3">
                        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 cursor-pointer"/>
                        <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition">Import CSV File</button>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
                      {availableGroups.map(groupName => (
                        <button
                          key={groupName}
                          onClick={() => { setSelectedGroupTab(groupName); setCurrentPage(1); }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                            selectedGroupTab === groupName
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {groupName} ({groupName === 'All' ? contacts.length : contacts.filter(c => (c.group || 'General') === groupName).length})
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleExportCSV}
                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ml-auto sm:ml-0"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                      {selectedContactIds.length > 0 && (
                        <button 
                          onClick={handleMassDelete}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Trash2 size={14} /> Delete ({selectedContactIds.length})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="px-4 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 uppercase">Directory [{selectedGroupTab}] ({filteredContacts.length})</h3>
                    <div className="relative w-full sm:w-72">
                      <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search by name, email..." 
                        value={searchTerm} 
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                          <th className="p-4 w-10">
                            <input 
                              type="checkbox" 
                              onChange={handleSelectAllToggle}
                              checked={paginatedContacts.length > 0 && selectedContactIds.length === paginatedContacts.length}
                              className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                            />
                          </th>
                          <th className="p-4">Name & Email</th>
                          <th className="p-4">Company</th>
                          <th className="p-4">Mobile</th>
                          <th className="p-4">Industry</th>
                          <th className="p-4">Group</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {paginatedContacts.length > 0 ? (
                          paginatedContacts.map(c => {
                            const isSelected = selectedContactIds.includes(c._id);
                            return (
                              <tr key={c._id} className={`hover:bg-slate-50/50 ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                <td className="p-4">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedContactIds([...selectedContactIds, c._id]);
                                      } else {
                                        setSelectedContactIds(selectedContactIds.filter(id => id !== c._id));
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                  />
                                </td>
                                <td className="p-4">
                                  <p className="font-medium text-slate-800">{c.name}</p>
                                  <p className="text-xs text-slate-500">{c.email}</p>
                                </td>
                                <td className="p-4 text-slate-600">{c.company || '-'}</td>
                                <td className="p-4 text-slate-600">{c.mobile || '-'}</td>
                                <td className="p-4 text-slate-600">{c.industry || '-'}</td>
                                <td className="p-4"><span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-full">{c.group}</span></td>
                                <td className="p-4 text-right space-x-2">
                                  <button onClick={() => { setContactForm(c); setEditingId(c._id); }} className="text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50">Edit</button>
                                  <button onClick={() => handleDeleteContact(c._id)} className="text-rose-600 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50">Delete</button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="7" className="p-8 text-center text-slate-400 italic">No contacts found in this group tab.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Showing page {currentPage} of {totalPages} ({filteredContacts.length} contacts)
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                        disabled={currentPage === 1}
                        className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                        disabled={currentPage === totalPages}
                        className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SENDER EMAILS MANAGER */}
            {activeTab === 'senders-mgr' && (
              <motion.div key="senders-mgr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800">{senderForm.id ? 'Edit Sender Email' : 'Add New Sender Email'}</h3>
                    <form onSubmit={handleSaveSender} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                        <input type="email" required placeholder="intelligence@ibcstudio.com" value={senderForm.email} onChange={e => setSenderForm({...senderForm, email: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SMTP Host</label>
                          <input type="text" required value={senderForm.host} onChange={e => setSenderForm({...senderForm, host: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SMTP Port</label>
                          <input type="number" required value={senderForm.port} onChange={e => setSenderForm({...senderForm, port: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SMTP Password</label>
                        <input type="password" required autoComplete="current-password" placeholder="Password" value={senderForm.password} onChange={e => setSenderForm({...senderForm, password: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">{senderForm.id ? 'Update Sender' : 'Save Sender'}</button>
                    </form>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="text-sm font-bold text-slate-800 uppercase">Configured Senders</h3></div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                          <th className="p-4">Email ID</th><th className="p-4">Host</th><th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {senders.map(s => (
                          <tr key={s._id} className="hover:bg-slate-50/50">
                            <td className="p-4 font-medium text-slate-800">{s.email}</td>
                            <td className="p-4 text-slate-600">{s.host}:{s.port}</td>
                            <td className="p-4 text-right space-x-2">
                              <button onClick={() => setSenderForm({ id: s._id, email: s.email, host: s.host, port: s.port, password: s.password })} className="text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50">Edit</button>
                              <button onClick={() => handleDeleteSender(s._id)} className="text-rose-600 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SIGNATURES MANAGER */}
            {activeTab === 'signatures-mgr' && (
              <motion.div key="signatures-mgr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Email Signature Manager</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Email ID for Signature</label>
                    <select value={selectedSigEmail} onChange={handleSigEmailChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
                      {senders.map(s => <option key={s._id} value={s.email}>{s.email}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Upload Signature Image (Saved in project folder)</label>
                    <input type="file" accept="image/*" onChange={(e) => setSigFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Signature Editor</label>
                    <EmailEditor 
                      content={signatureHtml} 
                      onChange={(html) => setSignatureHtml(html)}
                    />
                  </div>
                  <button onClick={handleSaveSignature} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">Save Signature for {selectedSigEmail}</button>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Live Signature Preview ({selectedSigEmail})</h3>
                  <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-slate-50 overflow-auto prose prose-sm max-w-none [&>img]:max-w-[160px] [&>img]:w-full [&>img]:h-auto">
                    <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* TEMPLATES MANAGER */}
            {activeTab === 'templates-mgr' && (
              <motion.div key="templates-mgr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800">{templateForm.id ? 'Edit Template' : 'Create New Template'}</h3>
                    <form onSubmit={handleSaveTemplate} className="space-y-3">
                      <input type="text" required placeholder="Template Title" value={templateForm.title} onChange={e => setTemplateForm({...templateForm, title: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      <input type="text" placeholder="Default Subject" value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="isDefault" checked={templateForm.isDefault} onChange={e => setTemplateForm({...templateForm, isDefault: e.target.checked})} className="w-4 h-4 rounded text-blue-600"/>
                        <label htmlFor="isDefault" className="text-xs font-semibold text-slate-700">Set as Default Template</label>
                      </div>
                      <EmailEditor content={templateForm.htmlContent} onChange={(html) => setTemplateForm({...templateForm, htmlContent: html})} />
                      <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">Save Template</button>
                    </form>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-base font-bold text-slate-800 mb-4">Live Template Preview</h3>
                    <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-slate-50 overflow-auto prose prose-sm max-w-none [&>img]:max-w-[160px] [&>img]:w-full [&>img]:h-auto">
                      <div dangerouslySetInnerHTML={{ __html: templateForm.htmlContent }} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="text-sm font-bold text-slate-800 uppercase">Saved Templates</h3></div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        <th className="p-4">Title</th><th className="p-4">Subject</th><th className="p-4">Default</th><th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {templates.map(t => (
                        <tr key={t._id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-medium text-slate-800">{t.title}</td>
                          <td className="p-4 text-slate-600">{t.subject || '-'}</td>
                          <td className="p-4">{t.isDefault ? <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2 py-0.5 rounded">Default</span> : '-'}</td>
                          <td className="p-4 text-right space-x-2">
                            <button onClick={() => setTemplateForm({ id: t._id, title: t.title, subject: t.subject || '', htmlContent: t.htmlContent, isDefault: t.isDefault })} className="text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50">Edit</button>
                            <button onClick={() => handleDeleteTemplate(t._id)} className="text-rose-600 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* NEW CAMPAIGN TAB */}
            {activeTab === 'new-campaign' && (
              <motion.div key="new-campaign" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Dispatch New Campaign</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Load from Saved Template</label>
                    <select onChange={handleSelectTemplateForCampaign} defaultValue="" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
                      <option value="" disabled>Select a template...</option>
                      {templates.map(t => <option key={t._id} value={t._id}>{t.title} {t.isDefault ? '(Default)' : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Sender Email (From:)</label>
                    <select value={campaignData.senderEmail} onChange={handleCampaignSenderChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
                      {senders.map(s => <option key={s._id} value={s.email}>{s.email}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">CC (Optional)</label>
                      <input type="text" placeholder="cc@example.com" value={campaignData.cc} onChange={e => setCampaignData({...campaignData, cc: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">BCC (Optional)</label>
                      <input type="text" placeholder="bcc@example.com" value={campaignData.bcc} onChange={e => setCampaignData({...campaignData, bcc: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Campaign Title</label>
                    <input type="text" placeholder="e.g., Q2 Product Launch" value={campaignData.title} onChange={e => setCampaignData({...campaignData, title: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Subject</label>
                    <input type="text" value={campaignData.subject} onChange={e => setCampaignData({...campaignData, subject: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Group Collection</label>
                    <select 
                      value={campaignData.group} 
                      onChange={e => setCampaignData({...campaignData, group: e.target.value})} 
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white font-medium text-slate-800"
                    >
                      {groupsList.map((g, idx) => (
                        <option key={idx} value={g}>{g} ({contacts.filter(c => (c.group || 'General') === g).length} contacts)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Body Content (Includes Auto-Pulled Signature)</label>
                    <EmailEditor 
                      content={campaignData.htmlContent} 
                      onChange={(html) => setCampaignData({...campaignData, htmlContent: html})}
                      onAttachmentChange={(files) => setCampaignData({...campaignData, attachments: files})}
                    />
                  </div>
                  <button onClick={handleSendCampaign} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">Dispatch Campaign</button>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Live Email Preview</h3>
                  <div className="flex-1 border border-slate-200 rounded-xl p-6 bg-slate-50 overflow-auto prose prose-sm max-w-none [&>img]:max-w-[160px] [&>img]:w-full [&>img]:h-auto">
                    <div dangerouslySetInnerHTML={{ __html: campaignData.htmlContent || '<p class="text-slate-400 italic">Start typing your email body content...</p>' }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ALL CAMPAIGNS TAB */}
            {activeTab === 'all-campaigns' && (
              <motion.div key="all-campaigns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 uppercase">Past Campaigns & Recipient Delivery Logs ({campaigns.length})</h3>
                    <button onClick={() => fetchData(false)} className="text-xs font-semibold text-blue-600 hover:underline">Refresh List</button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {campaigns.length > 0 ? (
                      campaigns.map(camp => {
                        const campaignLogs = (analytics?.logs || []).filter(l => l.campaignTitle === camp.title || l.campaignTitle === camp.subject);
                        
                        return (
                          <div key={camp._id} className="p-5 space-y-4 hover:bg-slate-50/40 transition">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-base">{camp.title || 'Untitled Campaign'}</h4>
                                <p className="text-xs text-slate-500">Subject: <span className="font-medium text-slate-700">{camp.subject || 'No Subject'}</span></p>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-xl">From: {camp.senderEmail}</span>
                                <span className="bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-xl">Group: {camp.group}</span>
                                <span className="bg-emerald-50 text-emerald-600 font-bold px-3 py-1 rounded-xl">{new Date(camp.sentAt).toLocaleString()}</span>
                                <button 
                                  onClick={() => handleLoadCampaignForResend(camp)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                                >
                                  <RefreshCw size={13} /> Edit & Resend
                                </button>
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Recipient Delivery Details ({campaignLogs.length} emails dispatched)
                              </h5>
                              {campaignLogs.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase">
                                        <th className="py-2 px-3">Recipient Email</th>
                                        <th className="py-2 px-3">Status</th>
                                        <th className="py-2 px-3">Opened</th>
                                        <th className="py-2 px-3">Unsubscribed</th>
                                        <th className="py-2 px-3 text-right">Timestamp</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {campaignLogs.map((log, lIdx) => (
                                        <tr key={lIdx} className="hover:bg-white">
                                          <td className="py-2.5 px-3 font-medium text-slate-800">{log.recipientEmail}</td>
                                          <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded-full font-semibold ${log.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                              {log.status}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3">
                                            {log.opened ? <span className="text-blue-600 font-bold">Yes</span> : <span className="text-slate-400">No</span>}
                                          </td>
                                          <td className="py-2.5 px-3">
                                            {log.unsubscribed ? <span className="text-amber-600 font-bold">Yes</span> : <span className="text-slate-400">No</span>}
                                          </td>
                                          <td className="py-2.5 px-3 text-right text-slate-400">{new Date(log.sentAt).toLocaleTimeString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No specific recipient delivery logs found for this campaign entry.</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-12 text-center text-slate-400 italic">No past campaigns found. Dispatch a new campaign to see it here.</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ANALYTICS & LOGS TAB */}
            {activeTab === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase">Delivered</p>
                    <h2 className="text-2xl font-extrabold text-emerald-600 mt-1">{analytics?.summary?.totalDelivered || 0}</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{analytics?.summary?.deliveryRate || 0}% Rate</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase">Open Rate</p>
                    <h2 className="text-2xl font-extrabold text-blue-600 mt-1">{analytics?.summary?.openRate || 0}%</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{analytics?.summary?.totalOpened || 0} Opens</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase">Click Rate</p>
                    <h2 className="text-2xl font-extrabold text-indigo-600 mt-1">{analytics?.summary?.clickRate || 0}%</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{analytics?.summary?.totalClicked || 0} Clicks</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase">Unsubscribes</p>
                    <h2 className="text-2xl font-extrabold text-amber-600 mt-1">{analytics?.summary?.totalUnsubscribed || 0}</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{analytics?.summary?.unsubscribeRate || 0}% Rate</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase">Bounced</p>
                    <h2 className="text-2xl font-extrabold text-rose-600 mt-1">{analytics?.summary?.totalBounced || 0}</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">Failed Delivery</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 uppercase">Real-Time Mail Engagement Logs ({(analytics?.logs || []).length})</h3>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleExportLogsCSV}
                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Download size={14} /> Export Logs CSV
                      </button>
                      <button onClick={() => fetchData(false)} className="text-xs font-semibold text-blue-600 hover:underline">Refresh Data</button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                          <th className="p-4">Campaign</th>
                          <th className="p-4">Recipient</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Opened</th>
                          <th className="p-4">Unsubscribed</th>
                          <th className="p-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {paginatedLogs.length > 0 ? (
                          paginatedLogs.map((l, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-4 font-medium text-slate-800">{l.campaignTitle}</td>
                              <td className="p-4 text-slate-600">{l.recipientEmail}</td>
                              <td className="p-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${l.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {l.status}
                                </span>
                              </td>
                              <td className="p-4">
                                {l.opened ? <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded">Yes</span> : <span className="text-slate-400 text-xs">No</span>}
                              </td>
                              <td className="p-4">
                                {l.unsubscribed ? <span className="bg-amber-50 text-amber-600 text-xs font-bold px-2 py-0.5 rounded">Yes</span> : <span className="text-slate-400 text-xs">No</span>}
                              </td>
                              <td className="p-4 text-xs text-slate-400 text-right">{new Date(l.sentAt).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="p-8 text-center text-slate-400 italic">No engagement logs recorded yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Showing page {logPage} of {totalLogPages} ({(analytics?.logs || []).length} total logs)
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setLogPage(prev => Math.max(prev - 1, 1))} 
                        disabled={logPage === 1}
                        className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        onClick={() => setLogPage(prev => Math.min(prev + 1, totalLogPages))} 
                        disabled={logPage === totalLogPages}
                        className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}