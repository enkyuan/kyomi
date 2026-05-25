"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/provider";

type PreferenceUpdate<TPreferences extends object> = {
  patch: Partial<TPreferences>;
  requestId: number;
  rollback: TPreferences;
};

type UseUserPreferencesOptions<TPreferences extends object> = {
  defaults: TPreferences;
  initialData: () => TPreferences;
  normalize: (current: TPreferences, next: Partial<TPreferences>) => TPreferences;
  onCacheWrite?: (preferences: TPreferences, userId?: string) => void;
  queryFn: () => Promise<TPreferences>;
  queryKey: readonly unknown[];
  sanitize: (value: unknown) => TPreferences;
  updateFn: (input: { data: Partial<TPreferences> }) => Promise<TPreferences>;
};

export function useUserPreferences<TPreferences extends object>({
  defaults,
  initialData,
  normalize,
  onCacheWrite,
  queryFn,
  queryKey,
  sanitize,
  updateFn,
}: UseUserPreferencesOptions<TPreferences>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const latestRequestIdRef = useRef(0);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationRollbackRef = useRef<TPreferences | null>(null);

  const preferencesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      onCacheWrite?.(data, user?.id);
      return data;
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    initialData,
    refetchOnWindowFocus: false,
  });

  const preferences = preferencesQuery.data ?? defaults;

  useEffect(() => {
    return () => {
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      const timer = mutationDebounceRef.current;
      if (timer) {
        clearTimeout(timer);
        mutationDebounceRef.current = null;
        mutationRollbackRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ patch }: PreferenceUpdate<TPreferences>) => updateFn({ data: patch }),
    onError: (_error, variables) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return;
      }
      queryClient.setQueryData(queryKey, variables.rollback);
      onCacheWrite?.(variables.rollback, user?.id);
    },
    onSuccess: (serverPreferences, variables) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return;
      }
      const sanitized = sanitize(serverPreferences);
      queryClient.setQueryData(queryKey, sanitized);
      onCacheWrite?.(sanitized, user?.id);
    },
  });

  const getCurrentPreferences = () =>
    queryClient.getQueryData<TPreferences>(queryKey) ?? preferencesQuery.data ?? defaults;

  const setPreferences = (next: Partial<TPreferences>) => {
    const current = getCurrentPreferences();
    const optimistic = normalize(current, next);
    if (JSON.stringify(current) === JSON.stringify(optimistic)) {
      return;
    }

    queryClient.setQueryData(queryKey, optimistic);
    onCacheWrite?.(optimistic, user?.id);

    void queryClient.cancelQueries({ queryKey });

    if (!user?.id) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    if (!mutationDebounceRef.current) {
      mutationRollbackRef.current = current;
    }
    if (mutationDebounceRef.current) {
      clearTimeout(mutationDebounceRef.current);
    }

    mutationDebounceRef.current = setTimeout(() => {
      mutationDebounceRef.current = null;
      const rollback = mutationRollbackRef.current ?? current;
      mutationRollbackRef.current = null;
      const patch = queryClient.getQueryData<TPreferences>(queryKey) ?? optimistic;
      updateMutation.mutate({ patch, requestId, rollback });
    }, 300);
  };

  const setPreferencesAsync = async (next: Partial<TPreferences>) => {
    const current = getCurrentPreferences();
    const optimistic = normalize(current, next);
    if (JSON.stringify(current) === JSON.stringify(optimistic)) {
      return optimistic;
    }

    queryClient.setQueryData(queryKey, optimistic);
    onCacheWrite?.(optimistic, user?.id);

    void queryClient.cancelQueries({ queryKey });

    if (!user?.id) {
      return optimistic;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    return updateMutation.mutateAsync({
      patch: optimistic,
      requestId,
      rollback: current,
    });
  };

  const resetPreferences = () => {
    const current = getCurrentPreferences();
    queryClient.setQueryData(queryKey, defaults);
    onCacheWrite?.(defaults, user?.id);

    void queryClient.cancelQueries({ queryKey });

    if (!user?.id) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    updateMutation.mutate({
      patch: defaults,
      requestId,
      rollback: current,
    });
  };

  return {
    preferences,
    setPreferences,
    setPreferencesAsync,
    resetPreferences,
    isLoadingPreferences: preferencesQuery.isLoading,
    isUpdatingPreferences: updateMutation.isPending,
  };
}
