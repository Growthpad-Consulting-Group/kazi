"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
// @ts-ignore
import { CSVLink } from "react-csv";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useSession } from "next-auth/react";

import FieldSelector from "./FieldSelector";
import PreviewTable from "./PreviewTable";
import ExportFormatSelector from "./ExportFormatSelector";
import PreviewRowsSelector from "./PreviewRowsSelector";
import SortOrderSelector from "./SortOrderSelector";
import EmailConfiguration from "./EmailConfiguration";
import FormActions from "./FormActions";
import { sortData, formatRowData, validateSelectedFields, exportXLSX, type SortOrder } from "./exportUtils";

interface Field { label: string; key: string; icon: string; }
type ExportFormat = "csv" | "xlsx" | "pdf" | "email";
type EmailAttachmentFormat = "csv" | "xlsx" | "pdf";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  mode: "light" | "dark";
  type?: string;
  getFieldsOrder?: () => Field[];
  getDefaultFields?: () => Record<string, boolean>;
  animationDuration?: number;
  title?: string;
}

const fieldIconMap: Record<string, string> = {
  name: "solar:user-broken", full_name: "solar:user-broken", title: "solar:document-text-broken",
  email: "solar:letter-broken", role: "solar:user-id-broken", status: "solar:check-circle-broken",
  is_active: "solar:check-circle-broken", created_at: "solar:calendar-broken", updated_at: "solar:refresh-broken",
  applied_at: "solar:calendar-broken", date: "solar:calendar-broken", url: "solar:link-broken",
  source: "solar:global-broken", category: "solar:folder-with-files-broken", location: "solar:map-point-broken",
  country: "solar:map-point-broken", keyword: "solar:hashtag-broken", notes: "solar:notes-broken",
  phone: "solar:phone-broken", address: "solar:map-point-broken",
};
const getFieldIcon = (key: string) => fieldIconMap[key] || "solar:tag-broken";

function createDynamicFields(data: any[]): Field[] {
  if (!data?.length) return [];
  return Object.keys(data[0])
    .filter(k => !["id", "__typename"].includes(k))
    .map(k => ({
      key: k,
      label: k.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      icon: getFieldIcon(k),
    }));
}

function createDefaultFields(fields: Field[]): Record<string, boolean> {
  return Object.fromEntries(fields.map(f => [f.key, !["updated_at", "created_at", "id"].includes(f.key)]));
}

export default function ExportModal({ isOpen, onClose, users, mode, type = "records", getFieldsOrder, getDefaultFields, animationDuration = 300, title }: ExportModalProps) {
  const { data: session } = useSession();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fieldsOrder, setFieldsOrder] = useState<Field[]>(() => typeof getFieldsOrder === "function" ? getFieldsOrder() : createDynamicFields(users));
  const defaultFields = useMemo(() => typeof getDefaultFields === "function" ? getDefaultFields() : createDefaultFields(fieldsOrder), [getDefaultFields, fieldsOrder]);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(defaultFields);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [previewRows, setPreviewRows] = useState(3);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailAttachmentFormat, setEmailAttachmentFormat] = useState<EmailAttachmentFormat>("csv");
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("none");
  const [filterStatus] = useState("all");
  const csvLinkRef = useRef<any>(null);

  useEffect(() => { setMounted(true); }, []);

  const filteredUsers = useMemo(() => {
    if (filterStatus === "all") return users;
    return users.filter(u => u.status === filterStatus || u.is_active === (filterStatus === "Active"));
  }, [users, filterStatus]);

  const processedData = useMemo(() => sortData(formatRowData(filteredUsers), sortOrder), [filteredUsers, sortOrder]);
  const csvHeaders = fieldsOrder.filter(f => selectedFields[f.key]).map(f => ({ label: f.label, key: f.key }));

  useEffect(() => {
    if (shouldRender) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [shouldRender]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const fields = typeof getFieldsOrder === "function" ? getFieldsOrder() : createDynamicFields(users);
      setFieldsOrder(fields);
      setSelectedFields(typeof getDefaultFields === "function" ? getDefaultFields() : createDefaultFields(fields));
      setEmailRecipients([]); setEmailSubject(""); setEmailMessage(""); setEmailAttachmentFormat("csv"); setIsEmailSending(false);
      const t = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => setShouldRender(false), animationDuration);
      return () => clearTimeout(t);
    }
  }, [isOpen, animationDuration]);

  const handleFieldToggle = (key: string) => setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
  const handleSelectAll = () => { setSelectedFields(Object.fromEntries(fieldsOrder.map(f => [f.key, true]))); toast.success("All fields selected"); };
  const handleSelectNone = () => { setSelectedFields(Object.fromEntries(fieldsOrder.map(f => [f.key, false]))); toast.success("All fields deselected"); };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(fieldsOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setFieldsOrder(reordered);
  };

  const modalTitle = title || `Export ${type.charAt(0).toUpperCase() + type.slice(1)} Data`;

  const exportPDF = () => {
    const selectedKeys = fieldsOrder.filter(f => selectedFields[f.key]).map(f => f.key);
    if (!selectedKeys.length) { toast.error("Please select at least one field to export!"); return; }
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(modalTitle, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    autoTable(doc, {
      head: [selectedKeys.map(k => fieldsOrder.find(f => f.key === k)!.label)],
      body: processedData.map((row: any) => selectedKeys.map(k => row[k] || "-")),
      startY: 30, theme: "striped",
      headStyles: { fillColor: [240, 93, 35] },
      styles: { textColor: mode === "dark" ? 255 : 35 },
    });
    doc.save(`${modalTitle.toLowerCase().replace(/\s+/g, "_")}_export.pdf`);
    toast.success("PDF exported successfully!");
  };

  const handleExportClick = () => { if (!validateSelectedFields(selectedFields)) return false; toast.success("CSV exported successfully!"); return true; };
  const handleCSVExport = () => { if (!validateSelectedFields(selectedFields)) return; csvLinkRef.current?.link.click(); };
  const handleXLSXExport = () => exportXLSX(processedData, fieldsOrder, selectedFields, modalTitle);

  const handleEmailExport = async () => {
    if (!validateSelectedFields(selectedFields)) return;
    if (!emailRecipients.length) { toast.error("Please enter at least one email recipient!"); return; }
    setIsEmailSending(true);
    try {
      const selectedKeys = fieldsOrder.filter(f => selectedFields[f.key]).map(f => f.key);
      const exportData = processedData.map((row: any) => Object.fromEntries(selectedKeys.map(k => [k, row[k] || ""])));
      const headers = fieldsOrder.filter(f => selectedFields[f.key]).map(f => ({ label: f.label, key: f.key }));
      const defaultSubject = `${type.charAt(0).toUpperCase() + type.slice(1)} Export - ${new Date().toLocaleDateString()}`;
      const defaultFilename = `${type}_export_${new Date().toISOString().split("T")[0]}`;
      const response = await fetch("/api/export/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: exportData, headers, format: emailAttachmentFormat, recipients: emailRecipients, subject: emailSubject.trim() || defaultSubject, message: emailMessage.trim() || "Please find your requested data export attached.", filename: defaultFilename, user: session?.user }),
      });
      const result = await response.json();
      if (response.ok) { toast.success(`Export email sent to ${emailRecipients.length} recipient${emailRecipients.length > 1 ? "s" : ""}!`); onClose(); }
      else throw new Error(result.error || "Failed to send email");
    } catch (error: any) {
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setIsEmailSending(false);
    }
  };

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[10001] flex items-center justify-center p-4 transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md" onClick={onClose} />

      <div className={`relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl transform transition-all duration-300 ${isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"} ${mode === "dark" ? "bg-gray-900 text-white border border-gray-700/50" : "bg-white text-gray-900 border border-gray-200"}`}>
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-[#f05d23] to-[#d94f1a] rounded-t-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <Icon icon="solar:export-broken" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{modalTitle}</h2>
              <p className="text-white/80 text-xs mt-0.5">{processedData.length} {processedData.length === 1 ? "record" : "records"} available</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 hover:scale-110 hover:rotate-90" aria-label="Close modal">
            <Icon icon="solar:close-circle-broken" width={20} height={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Field Selection */}
            <div className={`rounded-2xl border backdrop-blur-sm ${mode === "dark" ? "bg-gray-800/50 border-gray-700/50" : "bg-white/80 border-gray-200 shadow-sm"}`}>
              <div className={`p-5 border-b ${mode === "dark" ? "border-gray-700/50" : "border-gray-200"}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === "dark" ? "bg-[#f05d23]/20" : "bg-gradient-to-br from-[#f05d23] to-[#d94f1a] shadow-lg shadow-[#f05d23]/30"}`}>
                      <Icon icon="solar:check-square-broken" className={`w-5 h-5 ${mode === "dark" ? "text-[#f05d23]" : "text-white"}`} />
                    </div>
                    <div>
                      <h3 className={`text-base font-semibold ${mode === "dark" ? "text-gray-100" : "text-gray-900"}`}>Select Fields to Export</h3>
                      <p className={`text-sm ${mode === "dark" ? "text-gray-400" : "text-gray-500"}`}>Choose which data columns to include</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSelectAll} className={`text-sm px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${mode === "dark" ? "bg-[#f05d23]/20 text-[#f05d23] hover:bg-[#f05d23]/30 border border-[#f05d23]/30" : "bg-gradient-to-r from-[#f05d23] to-[#d94f1a] text-white hover:from-[#d94f1a] hover:to-[#f05d23] shadow-md"}`}>
                      <span className="flex items-center gap-1.5"><Icon icon="solar:check-circle-broken" className="w-4 h-4" />Select All</span>
                    </button>
                    <button onClick={handleSelectNone} className={`text-sm px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${mode === "dark" ? "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"}`}>
                      <span className="flex items-center gap-1.5"><Icon icon="solar:close-circle-broken" className="w-4 h-4" />Clear All</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <DragDropContext onDragEnd={onDragEnd}>
                  <FieldSelector fieldsOrder={fieldsOrder} selectedFields={selectedFields} handleFieldToggle={handleFieldToggle} mode={mode} />
                </DragDropContext>
              </div>
            </div>

            {/* Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SortOrderSelector sortOrder={sortOrder} setSortOrder={setSortOrder} mode={mode} />
              <ExportFormatSelector exportFormat={exportFormat} setExportFormat={setExportFormat as any} mode={mode} />
              <PreviewRowsSelector previewRows={previewRows} setPreviewRows={setPreviewRows} mode={mode} />
            </div>

            {exportFormat === "email" && (
              <EmailConfiguration
                emailRecipients={emailRecipients} setEmailRecipients={setEmailRecipients}
                emailSubject={emailSubject} setEmailSubject={setEmailSubject}
                emailMessage={emailMessage} setEmailMessage={setEmailMessage}
                emailAttachmentFormat={emailAttachmentFormat} setEmailAttachmentFormat={setEmailAttachmentFormat}
                mode={mode}
              />
            )}

            {/* Data Preview */}
            <div className={`rounded-2xl border backdrop-blur-sm ${mode === "dark" ? "bg-gray-800/50 border-gray-700/50" : "bg-white/80 border-gray-200 shadow-sm"}`}>
              <div className={`p-5 border-b ${mode === "dark" ? "border-gray-700/50" : "border-gray-200"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === "dark" ? "bg-[#f05d23]/20" : "bg-gradient-to-br from-[#f05d23] to-[#d94f1a] shadow-lg shadow-[#f05d23]/30"}`}>
                    <Icon icon="solar:eye-broken" className={`w-5 h-5 ${mode === "dark" ? "text-[#f05d23]" : "text-white"}`} />
                  </div>
                  <div>
                    <h3 className={`text-base font-semibold ${mode === "dark" ? "text-gray-100" : "text-gray-900"}`}>Data Preview</h3>
                    <p className={`text-sm ${mode === "dark" ? "text-gray-400" : "text-gray-500"}`}>Preview of your export data</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <PreviewTable filteredUsers={processedData} csvHeaders={csvHeaders} previewRows={previewRows} mode={mode} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`shrink-0 p-6 border-t rounded-b-2xl ${mode === "dark" ? "bg-gray-900/80 border-gray-700/50" : "bg-gray-50 border-gray-200"}`}>
          <CSVLink
            ref={csvLinkRef}
            data={processedData}
            headers={csvHeaders}
            filename={`${modalTitle.toLowerCase().replace(/\s+/g, "_")}_export.csv`}
            onClick={handleExportClick}
            style={{ display: "none" }}
          />
          <FormActions
            onCancel={onClose}
            onSave={exportFormat === "csv" ? handleCSVExport : exportFormat === "xlsx" ? handleXLSXExport : exportFormat === "pdf" ? exportPDF : handleEmailExport}
            mode={mode}
            saveText={exportFormat === "csv" ? "Export as CSV" : exportFormat === "xlsx" ? "Export as XLSX" : exportFormat === "pdf" ? "Export as PDF" : isEmailSending ? "Sending Email..." : "Send Email"}
            cancelText="Cancel"
            saveIcon={exportFormat === "csv" ? "solar:file-text-broken" : exportFormat === "xlsx" ? "solar:file-spreadsheet-broken" : exportFormat === "pdf" ? "solar:file-text-broken" : "solar:send-square-broken"}
            disabled={isEmailSending}
            variant={exportFormat === "email" ? "success" : "primary"}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
