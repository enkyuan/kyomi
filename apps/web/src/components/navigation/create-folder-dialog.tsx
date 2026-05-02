"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AddFill } from "@mingcute/react";
import { Button } from "@components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog";
import { Field, FieldError } from "@components/ui/field";
import { Form } from "@components/ui/form";
import { Input } from "@components/ui/input";
import { toastManager } from "@components/ui/toast";
import { createFolder } from "@/features/folders/api";

type CreateFolderDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  hideTrigger = false,
}: CreateFolderDialogProps = {}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const dialogOpen = open ?? internalOpen;

  const trimmedName = name.trim();
  const errorMessage = touched && !trimmedName ? "Folder name is required." : null;

  const resetForm = () => {
    setName("");
    setTouched(false);
  };

  const setDialogOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setInternalOpen(nextOpen);
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
      setDialogOpen(false);
      toastManager.add({
        title: "Folder created",
        description: folder.name,
        type: "success",
      });
    },
    onError: (error) => {
      toastManager.add({
        title: "Unable to create folder",
        description: error instanceof Error ? error.message : "Try a different folder name.",
        type: "error",
      });
    },
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            setTouched(true);

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
                autoFocus
                aria-label="Folder name"
                className="min-w-0"
                placeholder="Folder name"
                type="text"
                value={name}
                onBlur={() => {
                  setTouched(true);
                }}
                onChange={(event) => {
                  setName(event.target.value);
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
    </Dialog>
  );
}
