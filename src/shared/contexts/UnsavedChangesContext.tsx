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
  confirmNavigation: (onConfirm?: () => void) => boolean;
  navigationConfirmationOpen: boolean;
  cancelNavigation: () => void;
  discardAndNavigate: () => void;
};

const Context = createContext<UnsavedChangesValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isUnsaved, setIsUnsavedState] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [message, setMessage] = useState("Unsaved changes");
  const [callbacks, setCallbacksState] = useState<Callbacks>({});
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [navigationConfirmationOpen, setNavigationConfirmationOpen] =
    useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);

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
  const confirmNavigation = useCallback(
    (onConfirm?: () => void) => {
      if (!isUnsaved) return true;
      setPendingNavigation(() => onConfirm ?? null);
      setNavigationConfirmationOpen(true);
      setShakeNonce((value) => value + 1);
      window.dispatchEvent(new CustomEvent("unsaved-shake"));
      return false;
    },
    [isUnsaved],
  );
  const cancelNavigation = useCallback(() => {
    setNavigationConfirmationOpen(false);
    setPendingNavigation(null);
  }, []);
  const discardAndNavigate = useCallback(() => {
    const next = pendingNavigation;
    setNavigationConfirmationOpen(false);
    setPendingNavigation(null);
    reset();
    next?.();
  }, [pendingNavigation, reset]);

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
        navigationConfirmationOpen,
        cancelNavigation,
        discardAndNavigate,
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
  navigationConfirmationOpen: false,
  cancelNavigation: () => {},
  discardAndNavigate: () => {},
};

export function useUnsavedChanges() {
  return useContext(Context) ?? fallback;
}
