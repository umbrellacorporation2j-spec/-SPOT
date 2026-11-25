import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  MatchStatus,
  SpotBugReport,
  SpotFamily,
  SpotFamilyMember,
  SpotMatch,
  SpotProfile,
  SpotStream,
} from "@/lib/spot-types";
import { isStreamActive } from "@/lib/spot-utils";

export function useSpotApp() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (session?.user) {
        void queryClient.invalidateQueries({ queryKey: ["spot"] });
      }
    });

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = user?.id ?? null;

  const roleQuery = useQuery({
    queryKey: ["spot", "role", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (error) return false;
      return Boolean(data);
    },
  });

  const isAdmin = Boolean(roleQuery.data);

  const profileQuery = useQuery({
    queryKey: ["spot", "profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SpotProfile | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, favorites, tracked, family_id")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const fallback: SpotProfile = {
          id: userId,
          display_name: (user?.user_metadata?.["display_name"] as string | undefined) ?? "",
          email: user?.email ?? "",
          favorites: [],
          tracked: [],
          family_id: null,
        };
        await supabase.from("profiles").upsert({
          id: fallback.id,
          display_name: fallback.display_name,
          email: fallback.email,
        });
        return fallback;
      }
      return {
        id: data.id,
        display_name: data.display_name,
        email: data.email,
        favorites: data.favorites ?? [],
        tracked: data.tracked ?? [],
        family_id: data.family_id,
      };
    },
  });

  const familyId = profileQuery.data?.family_id ?? null;

  const familyQuery = useQuery({
    queryKey: ["spot", "family", familyId],
    enabled: Boolean(userId && familyId),
    queryFn: async (): Promise<SpotFamily | null> => {
      if (!familyId) return null;
      const { data: fam, error: famErr } = await supabase
        .from("families")
        .select("id, name, invite_code, owner_id")
        .eq("id", familyId)
        .maybeSingle();
      if (famErr || !fam) return null;

      const { data: rawMembers } = await supabase
        .from("family_members")
        .select("user_id, role")
        .eq("family_id", familyId);

      const memberIds = (rawMembers ?? []).map((m) => m.user_id);
      const { data: memberProfiles } = memberIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name, email, favorites, tracked")
            .in("id", memberIds)
        : { data: [] };

      const profileById = new Map((memberProfiles ?? []).map((p) => [p.id, p]));
      const members: SpotFamilyMember[] = (rawMembers ?? []).map((m) => {
        const p = profileById.get(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          display_name: p?.display_name ?? "",
          email: p?.email ?? "",
          favorites: p?.favorites ?? [],
          tracked: p?.tracked ?? [],
        };
      });

      return { ...fam, members };
    },
  });

  const streamsQuery = useQuery({
    queryKey: ["spot", "streams", userId, isAdmin],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SpotStream[]> => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, owner_id, title, league, url, thumb, is_global, expires_at, created_at")
        .order("is_global", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;

      let ownerMap = new Map<string, string>();
      if (isAdmin && data && data.length > 0) {
        const ownerIds = [...new Set(data.map((s) => s.owner_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", ownerIds);
        ownerMap = new Map(
          (profiles ?? []).map((p) => [p.id, p.display_name || p.email || "مستخدم"]),
        );
      }

      return (data ?? []).map((row) => {
        const ownerLabel = ownerMap.get(row.owner_id);
        return ownerLabel !== undefined ? { ...row, ownerLabel } : { ...row };
      });
    },
  });

  const matchesQuery = useQuery({
    queryKey: ["spot", "matches", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SpotMatch[]> => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, home_team, home_logo_url, away_team, away_logo_url, home_score, away_score, league, round_name, venue, status, kickoff_at, notes, created_at",
        )
        .order("kickoff_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        status: (m.status === "live" || m.status === "finished"
          ? m.status
          : "scheduled") as MatchStatus,
      }));
    },
  });

  const bugReportsQuery = useQuery({
    queryKey: ["spot", "bug_reports", userId, isAdmin],
    enabled: Boolean(userId && isAdmin),
    queryFn: async (): Promise<SpotBugReport[]> => {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("id, sender_name, sender_email, message, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        status: r.status === "resolved" ? "resolved" : "new",
      }));
    },
  });

  const allStreams = streamsQuery.data ?? [];
  const activeStreams = useMemo(() => {
    if (!nowMs) return allStreams;
    return allStreams.filter((s) => isStreamActive(s.expires_at, nowMs));
  }, [allStreams, nowMs]);

  const sharedFavorites = useMemo(() => {
    const set = new Set<string>(profileQuery.data?.favorites ?? []);
    for (const member of familyQuery.data?.members ?? []) {
      for (const id of member.favorites) set.add(id);
    }
    return set;
  }, [profileQuery.data?.favorites, familyQuery.data?.members]);

  const sharedTracked = useMemo(() => {
    const set = new Set<string>(profileQuery.data?.tracked ?? []);
    for (const member of familyQuery.data?.members ?? []) {
      for (const id of member.tracked) set.add(id);
    }
    return set;
  }, [profileQuery.data?.tracked, familyQuery.data?.members]);

  const togglePref = useCallback(
    async (kind: "favorites" | "tracked", streamId: string) => {
      if (!userId || !profileQuery.data) return;
      const currentList = profileQuery.data[kind] ?? [];
      const exists = currentList.includes(streamId);
      const nextList = exists
        ? currentList.filter((id) => id !== streamId)
        : [...currentList, streamId];

      const patch =
        kind === "favorites"
          ? { favorites: nextList, updated_at: new Date().toISOString() }
          : { tracked: nextList, updated_at: new Date().toISOString() };

      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId);

      if (error) {
        toast.error("تعذّر حفظ التفضيل");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["spot", "profile", userId] });
      if (familyId) {
        await queryClient.invalidateQueries({ queryKey: ["spot", "family", familyId] });
      }
      toast.success(
        exists ? "تمت الإزالة" : kind === "favorites" ? "أضيفت للمفضلة" : "تمت إضافتها للمتابعة",
      );
    },
    [userId, profileQuery.data, queryClient, familyId],
  );

  const handleSignOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setUser(null);
  }, [queryClient]);

  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["spot"] });
  }, [queryClient]);

  return {
    authReady,
    user,
    userId,
    isAdmin,
    nowMs,
    profile: profileQuery.data ?? null,
    family: familyQuery.data ?? null,
    allStreams,
    activeStreams,
    matches: matchesQuery.data ?? [],
    bugReports: bugReportsQuery.data ?? [],
    sharedFavorites,
    sharedTracked,
    loadingStreams: streamsQuery.isLoading,
    loadingMatches: matchesQuery.isLoading,
    togglePref,
    handleSignOut,
    refreshAll,
  };
}