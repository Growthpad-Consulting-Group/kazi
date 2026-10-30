"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Callbacks = {
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void;
};

type UnsavedChangesValue = {
  isUnsaved: boolean;
  isSaving: boolean;
  shakeNonce: number;
  message: string;
  onSave?: () => Promise<void>;
  onDiscard?: () => void;
  setUnsaved: (unsaved: boolean, message?: string) => void;
  setCallbacks: (callbacks: Callbacks) => void;
  clearUnsavedFlag: () => void;
  reset: () => void;
  setIsDiscarding: (value: boolean) => void;
  confirmNavigation: () => boolean;
};

const Context = createContext<UnsavedChangesValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isUnsaved, setIsUnsavedState] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [message, setMessage] = useState("Unsaved changes");
  const [callbacks, setCallbacksState] = useState<Callbacks>({});
  const [isDiscarding, setIsDiscarding] = useState(false);

  const setUnsaved = useCallback(
    (unsaved: boolean, nextMessage?: string) => {
      if (isDiscarding && unsaved) return;
      setIsUnsavedState(unsaved);
      if (nextMessage) setMessage(nextMessage);
    },
    [isDiscarding],
  );
  const clearUnsavedFlag = useCallback(() => {
    setIsUnsavedState(false);
    setMessage("Unsaved changes");
  }, []);
  const reset = useCallback(() => {
    setIsUnsavedState(false);
    setMessage("Unsaved changes");
    setCallbacksState({});
  }, []);
  const onSave = useCallback(async () => {
    if (!callbacks.onSave) return;
    setIsSaving(true);
    try {
      await callbacks.onSave();
    } finally {
      setIsSaving(false);
    }
  }, [callbacks]);
  const confirmNavigation = useCallback(() => {
    if (!isUnsaved) return true;
    setShakeNonce((value) => value + 1);
    window.dispatchEvent(new CustomEvent("unsaved-shake"));
    return false;
  }, [isUnsaved]);

  return (
    <Context.Provider
      value={{
        isUnsaved,
        isSaving,
        shakeNonce,
        message,
        onSave: callbacks.onSave ? onSave : undefined,
        onDiscard: callbacks.onDiscard,
        setUnsaved,
        setCallbacks: setCallbacksState,
        clearUnsavedFlag,
        reset,
        setIsDiscarding,
        confirmNavigation,
      }}
    >
      {children}
    </Context.Provider>
  );
}

const fallback: UnsavedChangesValue = {
  isUnsaved: false,
  isSaving: false,
  shakeNonce: 0,
  message: "Unsaved changes",
  setUnsaved: () => {},
  setCallbacks: () => {},
  clearUnsavedFlag: () => {},
  reset: () => {},
  setIsDiscarding: () => {},
  confirmNavigation: () => true,
};

export function useUnsavedChanges() {
  return useContext(Context) ?? fallback;
}
