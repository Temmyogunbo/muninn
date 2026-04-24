import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { createMuninnApiClient, type MuninnApi } from "@/lib/muninn-api";

export function useMuninnApi(): MuninnApi {
  const { getToken } = useAuth();
  return useMemo(
    () => createMuninnApiClient(() => getToken()),
    [getToken],
  );
}
