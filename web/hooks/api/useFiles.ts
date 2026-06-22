"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { FileItem, StructuredResponse } from "@/types";

export function useFiles(path: string = "/", provider?: string) {
  return useQuery({
    queryKey: ["files", path, provider],
    queryFn: async () => {
      const response = await api.get<StructuredResponse<FileItem[]>>("/files", {
        params: { path, provider },
      });
      return response.data.data || [];
    },
    staleTime: 10000,
  });
}

export function useStarredFiles() {
  return useQuery({
    queryKey: ["files", "starred"],
    queryFn: async () => {
      const response = await api.get<StructuredResponse<FileItem[]>>("/files/starred");
      return response.data.data || [];
    },
    staleTime: 10000,
  });
}

export function useStarFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ fileId, starred }: { fileId: string, starred: boolean }) => {
      if (starred) {
        return api.post(`/files/${fileId}/star`);
      } else {
        return api.delete(`/files/${fileId}/star`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useAllFolders() {
  return useQuery({
    queryKey: ["files", "all-folders"],
    queryFn: async () => {
      const response = await api.get<StructuredResponse<FileItem[]>>("/files/all-folders");
      return response.data.data || [];
    },
    staleTime: 5000,
  });
}
