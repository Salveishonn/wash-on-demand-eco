import { useState, useCallback } from "react";

export interface ClusterPricingResult {
  date: string;
  nearbyCount: number;
  discountPercent: number;
  label: string;
  emoji: string;
  radiusKm: number;
  tiers: Array<{
    minNearby: number;
    maxNearby: number | null;
    discountPercent: number;
    label: string;
    emoji: string;
  }>;
}

export function useClusterPricing() {
  const [clusterData, setClusterData] = useState<ClusterPricingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchClusterPricing = useCallback(
    async (date: string, lat: number, lng: number) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-cluster-pricing?date=${date}&lat=${lat}&lng=${lng}`,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (!response.ok) throw new Error("Failed to fetch cluster pricing");
        const data: ClusterPricingResult = await response.json();
        setClusterData(data);
        return data;
      } catch (err) {
        console.error("[useClusterPricing] Error:", err);
        setClusterData(null);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setClusterData(null);
  }, []);

  return { clusterData, isLoading, fetchClusterPricing, reset };
}
