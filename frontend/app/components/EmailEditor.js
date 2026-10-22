'use client';
import { useState, useEffect, useRef } from 'react';
import { Paperclip, X, Link as LinkIcon, Code } from 'lucide-react';

export default function EmailEditor({ content, onChange, onAttachmentChange }) {
  const editorRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [isHtmlMode, setIsHtmlMode] = useState(false); // NEW: State to track view mode
  const isInitializedRef = useRef(false);

  // Sync external content changes into the editor initially or on reset
  useEffect(() => {
    if (editorRef.current && (!isInitializedRef.current || editorRef.current.innerHTML !== content)) {
      editorRef.current.innerHTML = content || '<p><br></p>';
      isInitializedRef.current = true;
      
      // Automatically place cursor at the very top of the editor for typing (only in visual mode)
      if (!isHtmlMode) {
        try {
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(editorRef.current, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {
          // Ignore selection errors if editor is hidden
        }
      }
    }
  }, [content, isHtmlMode]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('insertText', false, text);
    }

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInsertTag = (e) => {
    const tag = e.target.value;
    if (!tag || !editorRef.current) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && editorRef.current.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(tag));
    } else {
      editorRef.current.innerHTML += ` ${tag} `;
    }
    
    onChange(editorRef.current.innerHTML);
    e.target.value = ''; 
  };

  const handleInsertLink = () => {
    const url = prompt('Enter external link URL (e.g., https://example.com):', 'https://');
    if (!url) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const selectedText = selection.toString();

    const linkText = selectedText || prompt('Enter text for the link:', url) || url;
    
    const aTag = document.createElement('a');
    aTag.href = url;
    aTag.target = '_blank';
    aTag.rel = 'noopener noreferrer';
    aTag.innerText = linkText;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(aTag);

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
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
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* NEW: HTML Source Toggle Button */}
          <button 
            type="button" 
            onClick={() => setIsHtmlMode(!isHtmlMode)} 
            className={`px-2.5 py-1 text-xs font-bold border rounded flex items-center gap-1 transition ${isHtmlMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
          >
            <Code size={13} /> {isHtmlMode ? 'Visual Editor' : 'HTML Code'}
          </button>

          {/* Hide rich text formatting buttons when in HTML mode */}
          {!isHtmlMode && (
            <div className="flex items-center gap-1 ml-2 border-l border-slate-300 pl-2">
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
              <button 
                type="button" 
                onClick={handleInsertLink} 
                title="Insert External Link"
                className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-100 flex items-center gap-1 text-blue-600 font-semibold"
              >
                <LinkIcon size={12} /> Link
              </button>
            </div>
          )}

          <select 
            onChange={handleInsertTag} 
            defaultValue="" 
            disabled={isHtmlMode}
            className={`border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white font-medium text-slate-700 shadow-sm focus:outline-none ${isHtmlMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <option value="" disabled>Insert Personalization Tag...</option>
            <option value="{{name}}">Recipient Name (&#123;&#123;name&#125;&#125;)</option>
            <option value="{{email}}">Recipient Email (&#123;&#123;email&#125;&#125;)</option>
            <option value="{{company}}">Company Name (&#123;&#123;company&#125;&#125;)</option>
            <option value="{{mobile}}">Mobile Number (&#123;&#123;mobile&#125;&#125;)</option>
            <option value="{{industry}}">Industry (&#123;&#123;industry&#125;&#125;)</option>
          </select>
        </div>

        <div>
          <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
            <Paperclip size={13} /> Attach Files
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      {/* Visual Editor (Hidden in HTML Mode) */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className={`p-4 min-h-[180px] max-h-[300px] overflow-y-auto focus:outline-none prose prose-sm max-w-none text-slate-800 [&_img]:w-auto [&_img]:max-w-[1109px] [&_img]:h-auto ${isHtmlMode ? 'hidden' : 'block'}`}
        suppressContentEditableWarning={true}
      />

      {/* NEW: Raw HTML Textarea (Visible only in HTML Mode) */}
      <textarea
        value={content || ''}
        onChange={(e) => {
          onChange(e.target.value);
          // Keep the visual editor div perfectly synced in the background
          if (editorRef.current) {
            editorRef.current.innerHTML = e.target.value;
          }
        }}
        placeholder="Paste your raw HTML signature code here..."
        className={`w-full p-4 min-h-[250px] max-h-[400px] font-mono text-xs bg-slate-900 text-green-400 focus:outline-none resize-y ${isHtmlMode ? 'block' : 'hidden'}`}
      />

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