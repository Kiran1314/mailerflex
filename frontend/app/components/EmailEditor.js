'use client';
import { useState, useEffect, useRef } from 'react';
import { Paperclip, X } from 'lucide-react';

export default function EmailEditor({ content, onChange, onAttachmentChange }) {
  const editorRef = useRef(null);
  const [attachments, setAttachments] = useState([]);

  // Sync external content changes (like template selection) into the editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || '';
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInsertTag = (e) => {
    const tag = e.target.value;
    if (!tag || !editorRef.current) return;
    
    // Insert tag at current cursor position or append to editor
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && editorRef.current.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(tag));
    } else {
      editorRef.current.innerHTML += ` ${tag} `;
    }
    
    onChange(editorRef.current.innerHTML);
    e.target.value = ''; // reset dropdown
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const updated = [...attachments, ...files];
    setAttachments(updated);
    if (onAttachmentChange) onAttachmentChange(updated);
  };

  const removeAttachment = (index) => {
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    if (onAttachmentChange) onAttachmentChange(updated);
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm flex flex-col">
      {/* Toolbar with Formatting Buttons & Personalization Dropdown */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            <button 
              type="button" 
              onClick={() => document.execCommand('bold')} 
              className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded hover:bg-slate-100"
            >
              B
            </button>
            <button 
              type="button" 
              onClick={() => document.execCommand('italic')} 
              className="px-2.5 py-1 text-xs italic bg-white border border-slate-200 rounded hover:bg-slate-100"
            >
              I
            </button>
            <button 
              type="button" 
              onClick={() => document.execCommand('underline')} 
              className="px-2.5 py-1 text-xs underline bg-white border border-slate-200 rounded hover:bg-slate-100"
            >
              U
            </button>
          </div>

          {/* Email Personalization Tags Dropdown */}
          <select 
            onChange={handleInsertTag} 
            defaultValue="" 
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white font-medium text-slate-700 cursor-pointer shadow-sm focus:outline-none"
          >
            <option value="" disabled>Insert Personalization Tag...</option>
            <option value="{{name}}">Recipient Name (&#123;&#123;name&#125;&#125;)</option>
            <option value="{{email}}">Recipient Email (&#123;&#123;email&#125;&#125;)</option>
            <option value="{{company}}">Company Name (&#123;&#123;company&#125;&#125;)</option>
            <option value="{{mobile}}">Mobile Number (&#123;&#123;mobile&#125;&#125;)</option>
            <option value="{{industry}}">Industry (&#123;&#123;industry&#125;&#125;)</option>
          </select>
        </div>

        {/* Attachment Upload Button */}
        <div>
          <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
            <Paperclip size={13} /> Attach Files
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      {/* Editable Content Area with 1109px Image Rules */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-[180px] max-h-[300px] overflow-y-auto focus:outline-none prose prose-sm max-w-none text-slate-800 [&_img]:w-auto [&_img]:max-w-[1109px] [&_img]:h-auto"
        suppressContentEditableWarning={true}
      />

      {/* Attached Files List */}
      {attachments.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-2">
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 shadow-sm">
              <span className="truncate max-w-[140px]">{file.name}</span>
              <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-rose-600">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}