"use client";

import { useReducer } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AddFill } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/button";
import {
  Dialog as UiDialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@kyomi/ui/dialog";
import { Field, FieldError } from "@kyomi/ui/field";
import { Form } from "@kyomi/ui/form";
import { Input } from "@kyomi/ui/input";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import { createFolder } from "@modules/folders/lib/api";

type CreateFolderDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

type DialogState = {
  internalOpen: boolean;
  name: string;
  touched: boolean;
  edited: boolean;
  submitted: boolean;
};

type DialogAction =
  | { type: "change-name"; name: string }
  | { type: "reset" }
  | { type: "set-internal-open"; open: boolean }
  | { type: "submit" }
  | { type: "touch" };

const initialDialogState: DialogState = {
  internalOpen: false,
  name: "",
  touched: false,
  edited: false,
  submitted: false,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "change-name":
      return { ...state, edited: true, name: action.name };
    case "reset":
      return { ...initialDialogState, internalOpen: state.internalOpen };
    case "set-internal-open":
      return { ...state, internalOpen: action.open };
    case "submit":
      return { ...state, submitted: true, touched: true };
    case "touch":
      return { ...state, touched: true };
  }
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  hideTrigger = false,
}: CreateFolderDialogProps = {}) {
  const queryClient = useQueryClient();
  const [{ internalOpen, name, touched, edited, submitted }, dispatch] = useReducer(
    dialogReducer,
    initialDialogState,
  );
  const dialogOpen = open ?? internalOpen;

  const trimmedName = name.trim();
  const errorMessage =
    (submitted || (touched && edited)) && !trimmedName ? "Folder name is required." : null;

  const resetForm = () => {
    dispatch({ type: "reset" });
  };

  const setDialogOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      dispatch({ type: "set-internal-open", open: nextOpen });
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: ({ folderName }: { folderName: string }) =>
      createFolder({ data: { name: folderName } }),
    onSuccess: async (folder) => {
      await queryClient.invalidateQueries({
        queryKey: ["folders"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["inbox", "recap"],
      });
      setDialogOpen(false);
      toastManager.add({
        title: "Folder created",
        description: folder.name,
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("folders.create", error);
      toastManager.add({
        title: "Unable to create folder",
        description: getUserSafeErrorMessage(error, "Try a different folder name."),
        type: "error",
      });
    },
  });

  return (
    <UiDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger ? (
        <DialogTrigger
          render={
            <Button
              aria-label="Create folder"
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            />
          }
        >
          <AddFill aria-hidden="true" className="size-3" />
        </DialogTrigger>
      ) : null}
      <DialogPopup className="sm:max-w-sm">
        <Form
          className="contents"
          onSubmit={async (event) => {
            event.preventDefault();
            dispatch({ type: "submit" });

            if (!trimmedName) {
              return;
            }

            await createFolderMutation.mutateAsync({ folderName: trimmedName });
          }}
        >
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>
              Organize followed feeds into a dedicated folder for focused reading.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="grid gap-4">
            <Field>
              <Input
                aria-label="Folder name"
                className="min-w-0"
                placeholder="Folder name"
                type="text"
                value={name}
                onBlur={() => {
                  dispatch({ type: "touch" });
                }}
                onChange={(event) => {
                  dispatch({ type: "change-name", name: event.target.value });
                }}
              />
              {errorMessage ? <FieldError match={true}>{errorMessage}</FieldError> : null}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button loading={createFolderMutation.isPending} type="submit">
              Create folder
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </UiDialog>
  );
}
