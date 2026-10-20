import { Icon } from "@iconify/react";
import Select from "react-select";
import { getSelectStyles } from "./selectStyles";
import EmailPillInput from "./EmailPillInput";

interface Props {
  emailRecipients: string[];
  setEmailRecipients: (r: string[]) => void;
  emailSubject: string;
  setEmailSubject: (s: string) => void;
  emailMessage: string;
  setEmailMessage: (m: string) => void;
  emailAttachmentFormat: 'csv' | 'xlsx' | 'pdf';
  setEmailAttachmentFormat: (f: 'csv' | 'xlsx' | 'pdf') => void;
  mode: 'light' | 'dark';
}

export default function EmailConfiguration({ emailRecipients, setEmailRecipients, emailSubject, setEmailSubject, emailMessage, setEmailMessage, emailAttachmentFormat, setEmailAttachmentFormat, mode }: Props) {
  return (
    <div className={`rounded-2xl border backdrop-blur-sm p-6 space-y-5 ${mode === "dark" ? "bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-700/50" : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg hover:shadow-xl transition-shadow duration-200"}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === "dark" ? "bg-[#f05d23]/20" : "bg-gradient-to-br from-[#f05d23] to-[#d94f1a] shadow-lg shadow-[#f05d23]/30"}`}>
          <Icon icon="solar:letter-opened-broken" className={`w-5 h-5 ${mode === "dark" ? "text-[#f05d23]" : "text-white"}`} />
        </div>
        <div>
          <h3 className={`text-lg font-bold ${mode === "dark" ? "text-gray-100" : "text-gray-900"}`}>Email Configuration</h3>
          <p className={`text-sm ${mode === "dark" ? "text-gray-400" : "text-gray-600"}`}>Configure email delivery settings</p>
        </div>
      </div>

      <div>
        <label className={`flex items-center gap-2 text-sm font-semibold mb-2 ${mode === "dark" ? "text-gray-200" : "text-gray-900"}`}>
          <Icon icon="solar:users-group-two-rounded-broken" className="w-4 h-4 text-[#f05d23]" />
          Email Recipients *
        </label>
        <EmailPillInput value={emailRecipients} onChange={setEmailRecipients} placeholder="Enter email addresses..." mode={mode} />
      </div>

      <div>
        <label className={`flex items-center gap-2 text-sm font-semibold mb-2 ${mode === "dark" ? "text-gray-200" : "text-gray-900"}`}>
          <Icon icon="solar:letter-broken" className="w-4 h-4 text-[#f05d23]" />
          Email Subject
        </label>
        <input
          type="text"
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          placeholder={`Data Export - ${new Date().toLocaleDateString()}`}
          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#f05d23] focus:border-transparent transition-all duration-300 ${mode === "dark" ? "bg-gray-800/50 border-gray-700 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`}
        />
      </div>

      <div>
        <label className={`flex items-center gap-2 text-sm font-semibold mb-2 ${mode === "dark" ? "text-gray-200" : "text-gray-900"}`}>
          <Icon icon="solar:chat-round-line-broken" className="w-4 h-4 text-[#f05d23]" />
          Email Message
        </label>
        <textarea
          value={emailMessage}
          onChange={(e) => setEmailMessage(e.target.value)}
          placeholder="Please find your requested data export attached."
          rows={3}
          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#f05d23] focus:border-transparent resize-none transition-all duration-300 ${mode === "dark" ? "bg-gray-800/50 border-gray-700 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`}
        />
      </div>

      <div>
        <label className={`flex items-center gap-2 text-sm font-semibold mb-2 ${mode === "dark" ? "text-gray-200" : "text-gray-900"}`}>
          <Icon icon="solar:attachment-broken" className="w-4 h-4 text-[#f05d23]" />
          Attachment Format
        </label>
        <Select
          value={{ value: emailAttachmentFormat, label: emailAttachmentFormat === "xlsx" ? "XLSX (Excel)" : emailAttachmentFormat.toUpperCase() }}
          onChange={(opt) => setEmailAttachmentFormat((opt?.value as 'csv' | 'xlsx' | 'pdf') || "csv")}
          options={[{ value: "csv", label: "CSV" }, { value: "xlsx", label: "XLSX (Excel)" }, { value: "pdf", label: "PDF" }]}
          isClearable={false}
          isSearchable={false}
          className="react-select-container"
          classNamePrefix="react-select"
          styles={{ ...getSelectStyles<any>(mode), menuPortal: (b) => ({ ...b, zIndex: 99999 }) }}
          menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
          menuPosition="fixed"
          menuPlacement="auto"
        />
      </div>
    </div>
  );
}
