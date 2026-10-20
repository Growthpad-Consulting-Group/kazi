'use client';
import { Icon } from "@iconify/react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface Field { key: string; label: string; icon: string; }
interface Props {
  fieldsOrder: Field[];
  selectedFields: Record<string, boolean>;
  handleFieldToggle: (key: string) => void;
  mode: "light" | "dark";
}

export default function FieldSelector({ fieldsOrder, selectedFields, handleFieldToggle, mode }: Props) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalContainer(document.body); }, []);

  return (
    <Droppable droppableId="fieldSelector">
      {(provided) => (
        <div
          {...provided.droppableProps}
          ref={provided.innerRef}
          className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1 pr-2"
        >
          {fieldsOrder.map((field, index) => (
            <Draggable key={field.key} draggableId={field.key} index={index}>
              {(provided, snapshot) => {
                const el = (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                      mode === "dark"
                        ? "bg-gray-800 border border-gray-700 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    } ${snapshot.isDragging ? "shadow-xl border-[#f05d23] opacity-90" : "shadow-sm"}`}
                    style={provided.draggableProps.style}
                  >
                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing shrink-0">
                      <Icon icon="solar:hamburger-menu-broken" className={`w-4 h-4 ${mode === "dark" ? "text-gray-500" : "text-gray-400"}`} />
                    </div>
                    <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={!!selectedFields[field.key]}
                        onChange={() => handleFieldToggle(field.key)}
                        className="h-4 w-4 shrink-0 rounded accent-[#f05d23] cursor-pointer"
                      />
                      <Icon icon={field.icon} className="w-4 h-4 shrink-0 text-[#f05d23]" />
                      <span className="text-xs truncate">{field.label}</span>
                    </label>
                  </div>
                );
                return snapshot.isDragging && portalContainer ? createPortal(el, portalContainer) : el;
              }}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
