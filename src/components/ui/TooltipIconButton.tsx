'use client';

import { Icon } from "@iconify/react";
import { useRef, useState, useEffect, ReactNode, CSSProperties, forwardRef } from "react";
import { createPortal } from "react-dom";

interface TooltipIconButtonProps {
  icon?: string;
  label: string | ReactNode;
  onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  mode?: "light" | "dark";
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
  disabled?: boolean;
  position?: "top" | "bottom";
  style?: CSSProperties;
  tooltipMaxWidth?: number;
}

const TooltipIconButton = forwardRef<HTMLDivElement, TooltipIconButtonProps>((
  {
    icon,
    label,
    onClick,
    mode = "light",
    className = "",
    iconClassName = "h-5 w-5",
    children,
    disabled = false,
    position = "bottom",
    style = {},
    tooltipMaxWidth = 320,
  },
  ref
) => {
  const btnRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        top: position === "top" ? rect.top + window.scrollY : rect.bottom + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
    }
  }, [show, position]);

  useEffect(() => {
    if (!show) return;
    const hide = () => setShow(false);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [show]);

  return (
    <>
      <div
        ref={(node) => {
          (btnRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        onClick={disabled ? undefined : onClick}
        className={`relative group p-2 rounded-full focus:outline-none ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
        style={style}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) onClick?.(e); }}
        onMouseEnter={() => !disabled && setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => !disabled && setShow(true)}
        onBlur={() => setShow(false)}
        aria-label={typeof label === "string" ? label : undefined}
        aria-disabled={disabled}
      >
        {children || (icon && <Icon icon={icon} className={`${iconClassName} text-current`} />)}
      </div>
      {show && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "absolute",
            top: position === "top" ? coords.top - 8 : coords.top + 8,
            left: coords.left,
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <div
            className={`text-xs py-2 px-3 rounded-lg shadow-lg backdrop-blur-lg text-center ${mode === "dark" ? "text-gray-100 bg-gray-950/40 border border-white/20" : "text-gray-900 bg-white/40 border border-white/40"}`}
            style={{ whiteSpace: "pre-line", maxWidth: `${tooltipMaxWidth}px`, minWidth: "120px", wordWrap: "break-word" }}
          >
            {label}
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";
export default TooltipIconButton;
