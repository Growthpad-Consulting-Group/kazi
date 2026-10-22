'use client';
import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';

interface Props {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  mode?: 'light' | 'dark';
  className?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailPillInput({ value = [], onChange, placeholder = "Enter email addresses...", mode = "light", className = "" }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) { setInputValue(''); return; }
    if (emailRegex.test(trimmed)) { onChange([...value, trimmed]); setInputValue(''); setIsValid(true); }
    else setIsValid(false);
  };

  const removeEmail = (email: string) => onChange(value.filter(e => e !== email));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    setIsValid(true);
    if (v.includes(',') || v.includes(';')) {
      v.split(/[,;]/).forEach(part => { if (part.trim()) addEmail(part); });
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (inputValue.trim()) addEmail(inputValue); }
    else if (e.key === 'Backspace' && !inputValue && value.length > 0) removeEmail(value[value.length - 1]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.clipboardData.getData('text').split(/[,;\s\n]/).forEach(part => { if (part.trim()) addEmail(part); });
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`min-h-[42px] w-full px-3 py-2 border rounded-lg cursor-text transition-all duration-200 ${!isValid ? 'border-red-500 ring-2 ring-red-200' : 'focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent'} ${mode === "dark" ? "bg-gray-700 border-gray-600 text-white hover:border-gray-500" : "bg-white border-gray-300 text-gray-900 hover:border-gray-400"} ${className}`}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {value.map((email, i) => (
            <div key={i} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${mode === "dark" ? "bg-brand-500/20 text-brand-500" : "bg-brand-500/10 text-[#d94f1a]"}`}>
              <Icon icon="solar:letter-broken" className="w-3 h-3 opacity-70" />
              <span>{email}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeEmail(email); }} className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors">
                <Icon icon="solar:close-circle-broken" className="w-3 h-3" />
              </button>
            </div>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={value.length === 0 ? placeholder : ""}
            className={`flex-1 min-w-[120px] outline-none bg-transparent ${mode === "dark" ? "text-white placeholder-gray-400" : "text-gray-900 placeholder-gray-500"}`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className={`text-xs flex items-center gap-1 ${!isValid ? "text-red-500" : mode === "dark" ? "text-gray-400" : "text-gray-500"}`}>
          {!isValid ? (
            <><Icon icon="solar:danger-broken" className="w-3 h-3" />Please enter a valid email address</>
          ) : (
            <><Icon icon="solar:info-circle-broken" className="w-3 h-3" />Type email and press comma, semicolon, or Enter to add</>
          )}
        </p>
        {value.length > 0 && (
          <p className={`text-xs ${mode === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            {value.length} recipient{value.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
