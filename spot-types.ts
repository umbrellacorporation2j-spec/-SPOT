export type SpotView =
  | "home"
  | "streams"
  | "matches"
  | "results"
  | "favorites"
  | "tracked"
  | "help"
  | "developer";

export type MatchStatus = "scheduled" | "live" | "finished";

export interface SpotProfile {
  id: string;
  display_name: string;
  email: string;
  favorites: string[];
  tracked: string[];
  family_id: string | null;
}

export interface SpotStream {
  id: string;
  owner_id: string;
  title: string;
  league: string;
  url: string;
  thumb: string;
  is_global: boolean;
  expires_at: string | null;
  created_at: string;
  ownerLabel?: string;
}

export interface SpotMatch {
  id: string;
  home_team: string;
  home_logo_url: string;
  away_team: string;
  away_logo_url: string;
  home_score: number | null;
  away_score: number | null;
  league: string;
  round_name: string;
  venue: string;
  status: MatchStatus;
  kickoff_at: string | null;
  notes: string;
  created_at: string;
}

export interface SpotFamilyMember {
  user_id: string;
  role: string;
  display_name: string;
  email: string;
  favorites: string[];
  tracked: string[];
}

export interface SpotFamily {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  members: SpotFamilyMember[];
}

export interface SpotBugReport {
  id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  status: "new" | "resolved";
  created_at: string;
}

export type ExpiryPreset =
  | "none"
  | "30m"
  | "1h"
  | "2h"
  | "3h"
  | "6h"
  | "24h"
  | "custom";