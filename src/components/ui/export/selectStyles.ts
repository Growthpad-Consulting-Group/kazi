import { StylesConfig, GroupBase } from "react-select";

export type ThemeMode = "light" | "dark";

export interface SelectOption {
  value: string | number;
  label: string;
  [key: string]: any;
}

export const getSelectValue = (option: SelectOption | null): string =>
  option?.value ? String(option.value) : "";

export const getSelectStyles = <
  Option = SelectOption,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(
  mode: ThemeMode = "light",
): StylesConfig<Option, IsMulti, Group> => {
  const isDark = mode === "dark";
  const textColor = isDark ? "#F1F5F9" : "#1e293b";
  const borderColor = isDark ? "#1e293b" : "#f1f5f9";
  const hoverBorderColor = isDark ? "#334155" : "#cbd5e1";
  const focusBorderColor = "#f05d23";
  const placeholderColor = isDark ? "#475569" : "#94a3b8";
  const optionHoverBg = isDark ? "#1e293b" : "#f8fafc";
  const optionSelectedBg = isDark ? "#d94f1e" : "#f05d23";

  return {
    control: (provided, state) => ({
      ...provided,
      minHeight: "42px",
      fontSize: "13px",
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderColor: state.isFocused ? focusBorderColor : borderColor,
      borderWidth: "1px",
      borderRadius: "0.75rem",
      boxShadow: "none",
      "&:hover": {
        borderColor: state.isFocused ? focusBorderColor : hoverBorderColor,
      },
      transition: "all 0.2s ease",
    }),
    option: (provided, state) => ({
      ...provided,
      fontSize: "13px",
      padding: "10px 14px",
      backgroundColor: state.isSelected
        ? optionSelectedBg
        : state.isFocused
          ? optionHoverBg
          : "transparent",
      color: state.isSelected ? "white" : textColor,
      cursor: "pointer",
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 20000,
      backgroundColor: isDark ? "#0f172a" : "white",
      border: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
      borderRadius: "1rem",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
      padding: "6px",
    }),
    menuPortal: (provided) => ({ ...provided, zIndex: 20000 }),
    menuList: (provided) => ({ ...provided, maxHeight: "200px", padding: "0" }),
    placeholder: (provided) => ({
      ...provided,
      color: placeholderColor,
      fontSize: "13px",
    }),
    singleValue: (provided) => ({
      ...provided,
      color: textColor,
      fontSize: "13px",
    }),
    input: (provided) => ({ ...provided, color: textColor }),
    dropdownIndicator: (provided) => ({ ...provided, color: placeholderColor }),
    indicatorSeparator: () => ({ display: "none" }),
    clearIndicator: (provided) => ({ ...provided, color: placeholderColor }),
  };
};

export default getSelectStyles;
