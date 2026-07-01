import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders, resolveApiUrl } from "@lib/api";

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

export const listFolders = createServerFn({ method: "GET" }).handler(
  async (): Promise<Folder[]> => {
    const headers = buildForwardHeaders(getRequestHeaders());

    return apiJson<Folder[]>("/api/v1/folders", {
      headers,
    });
  },
);

export const createFolder = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }): Promise<Folder> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJson<Folder>("/api/v1/folders", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: data.name.trim() }),
    });
  });

export const updateFolder = createServerFn({ method: "POST" })
  .inputValidator((input: { folderId: string; name: string }) => input)
  .handler(async ({ data }): Promise<Folder> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJson<Folder>(`/api/v1/folders/${encodeURIComponent(data.folderId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ name: data.name.trim() }),
    });
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .inputValidator((input: { folderId: string }) => input)
  .handler(async ({ data }): Promise<void> => {
    const headers = buildForwardHeaders(getRequestHeaders());

    const response = await fetch(
      resolveApiUrl(`/api/v1/folders/${encodeURIComponent(data.folderId)}`),
      {
        method: "DELETE",
        headers,
      },
    );
    if (!response.ok) {
      throw new Error("Unable to delete folder. Try again.");
    }
  });
