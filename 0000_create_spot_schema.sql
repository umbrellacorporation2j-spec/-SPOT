-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Families and family_members tables
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'عائلتي',
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_family_member(_family_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members
    WHERE family_id = _family_id
      AND user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_family_member(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_same_family(_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = _target_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_same_family(UUID) TO authenticated, service_role;

CREATE POLICY "Family members can view their family"
  ON public.families
  FOR SELECT
  TO authenticated
  USING (public.is_family_member(id, auth.uid()));

CREATE POLICY "Owner can create family"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update family"
  ON public.families
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can delete family"
  ON public.families
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Family members can view members of their family"
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (public.is_family_member(family_id, auth.uid()));

CREATE POLICY "Users can leave or owner can remove member"
  ON public.family_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = family_id AND f.owner_id = auth.uid()
    )
  );

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  favorites UUID[] NOT NULL DEFAULT '{}',
  tracked UUID[] NOT NULL DEFAULT '{}',
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own, family, or admin all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_same_family(id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Family RPC helpers
CREATE OR REPLACE FUNCTION public.create_family_with_owner(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_family_id UUID;
  v_code TEXT;
  v_clean_name TEXT := COALESCE(NULLIF(trim(_name), ''), 'عائلتي');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Already in a family';
  END IF;

  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));

  INSERT INTO public.families (name, invite_code, owner_id)
  VALUES (v_clean_name, v_code, v_uid)
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_family_id, v_uid, 'owner');

  UPDATE public.profiles
  SET family_id = v_family_id, updated_at = now()
  WHERE id = v_uid;

  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_family_with_owner(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_family_by_code(_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_family_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Already in a family';
  END IF;

  SELECT id INTO v_family_id
  FROM public.families
  WHERE invite_code = upper(trim(_invite_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_family_id, v_uid, 'member')
  ON CONFLICT (family_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET family_id = v_family_id, updated_at = now()
  WHERE id = v_uid;

  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_family_by_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_family_member(_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_family_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_family_id
  FROM public.families
  WHERE owner_id = v_uid
  LIMIT 1;

  IF v_family_id IS NULL OR _target_user_id = v_uid THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.family_members
  WHERE family_id = v_family_id AND user_id = _target_user_id;

  UPDATE public.profiles
  SET family_id = NULL, updated_at = now()
  WHERE id = _target_user_id AND family_id = v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_family_member(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_or_delete_family()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_family_id UUID;
  v_owner_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT f.id, f.owner_id INTO v_family_id, v_owner_id
  FROM public.family_members fm
  JOIN public.families f ON f.id = fm.family_id
  WHERE fm.user_id = v_uid
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RETURN;
  END IF;

  IF v_owner_id = v_uid THEN
    UPDATE public.profiles SET family_id = NULL, updated_at = now() WHERE family_id = v_family_id;
    DELETE FROM public.families WHERE id = v_family_id;
  ELSE
    DELETE FROM public.family_members WHERE family_id = v_family_id AND user_id = v_uid;
    UPDATE public.profiles SET family_id = NULL, updated_at = now() WHERE id = v_uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_or_delete_family() TO authenticated;

-- 4. Streams table (personal + global admin streams with optional auto-expiry)
CREATE TABLE public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  league TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  thumb TEXT NOT NULL DEFAULT '',
  is_global BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_streams_owner ON public.streams(owner_id);
CREATE INDEX idx_streams_global_expiry ON public.streams(is_global, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.streams TO authenticated;
GRANT ALL ON public.streams TO service_role;

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own active, global active, or admin all streams"
  ON public.streams
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      (owner_id = auth.uid() OR is_global = true)
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

CREATE POLICY "Insert own personal stream or admin any stream"
  ON public.streams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (owner_id = auth.uid() AND is_global = false AND expires_at IS NULL)
  );

CREATE POLICY "Update own personal stream or admin any stream"
  ON public.streams
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (owner_id = auth.uid() AND is_global = false)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (owner_id = auth.uid() AND is_global = false AND expires_at IS NULL)
  );

CREATE POLICY "Delete own personal stream or admin any stream"
  ON public.streams
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (owner_id = auth.uid() AND is_global = false)
  );

-- 5. Matches table (All Matches & Results — managed by admin, browsed by all signed-in users)
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team TEXT NOT NULL,
  home_logo_url TEXT NOT NULL DEFAULT '',
  away_team TEXT NOT NULL,
  away_logo_url TEXT NOT NULL DEFAULT '',
  home_score INTEGER,
  away_score INTEGER,
  league TEXT NOT NULL DEFAULT '',
  round_name TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  kickoff_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_kickoff ON public.matches(kickoff_at DESC NULLS LAST, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all matches"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert matches"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update matches"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete matches"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Bug reports table (sent from top icon on login screen, readable only by admin)
CREATE TABLE public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.bug_reports TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a bug report"
  ON public.bug_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(trim(message)) > 0);

CREATE POLICY "Admins can view bug reports"
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bug reports"
  ON public.bug_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bug reports"
  ON public.bug_reports
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
