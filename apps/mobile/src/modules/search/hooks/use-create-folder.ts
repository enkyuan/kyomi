import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { toast } from "@ui/toast";

type Folder = {
  readonly id: string;
  readonly name: string;
  readonly isPinned: boolean;
  readonly pinnedAt: string | null;
  readonly createdAt: string;
};

function createFolder(name: string) {
  return fetchMobileApiJson<Folder>("/api/v1/folders", {
    body: JSON.stringify({ name }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

type ObservableStringState = {
  value: string;
};

type UseCreateFolderOptions = {
  readonly isPresented: boolean;
  readonly name: ObservableStringState;
  readonly onDismiss: () => void;
};

/** Owns creation and form state for the native create-folder renderers. */
export function useCreateFolder({ isPresented, name, onDismiss }: UseCreateFolderOptions) {
  const createFolderMutation = useMutation({ mutationFn: createFolder });
  const isMountedRef = useRef(true);
  const isPresentedRef = useRef(isPresented);
  const [nameError, setNameError] = useState<string | null>(null);

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;
    name.value = "";
    setNameError(null);
  }, [name]);

  function handleDismiss() {
    if (!isMountedRef.current) return;
    isPresentedRef.current = false;
    reset();
    onDismiss();
  }

  function handleNameChange() {
    if (nameError) {
      setNameError(null);
    }
  }

  async function handleSubmit() {
    if (createFolderMutation.isPending) return;

    const trimmedName = name.value.trim();
    if (!trimmedName) {
      setNameError("Enter a folder name.");
      return;
    }

    try {
      await toast.promise(createFolderMutation.mutateAsync(trimmedName), {
        error: "Couldn’t create folder. Try again.",
        loading: "Creating folder…",
        success: "Folder created",
      });

      if (!isMountedRef.current || !isPresentedRef.current) return;
      handleDismiss();
    } catch {
      // The toast explains a rejected request while preserving the entered name for retry.
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isPresentedRef.current = isPresented;
    if (isPresented) {
      reset();
    }
  }, [isPresented, reset]);

  return {
    handleDismiss,
    handleNameChange,
    handleSubmit,
    isCreating: createFolderMutation.isPending,
    nameError,
  };
}
