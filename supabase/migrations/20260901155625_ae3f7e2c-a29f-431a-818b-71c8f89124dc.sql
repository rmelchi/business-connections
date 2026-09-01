
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('member','admin');
CREATE TYPE public.membership_status AS ENUM ('active','lapsed','pending','suspended');
CREATE TYPE public.listing_status AS ENUM ('active','inactive');
CREATE TYPE public.audience_type AS ENUM ('b2b','b2c','both');
CREATE TYPE public.product_service_type AS ENUM ('product','service','both');
CREATE TYPE public.interest_state AS ENUM ('none','interested','not_relevant');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  auth_user_id uuid UNIQUE,
  wildapricot_contact_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  geography text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  membership_level text NOT NULL DEFAULT 'Member',
  membership_status public.membership_status NOT NULL DEFAULT 'pending',
  matching_enabled boolean NOT NULL DEFAULT true,
  avatar_initials text NOT NULL DEFAULT '',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- MEMBER ROLES
CREATE TABLE public.member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, role)
);
GRANT SELECT ON public.member_roles TO authenticated;
GRANT ALL ON public.member_roles TO service_role;
ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_roles mr
    JOIN public.profiles p ON p.id = mr.profile_id
    WHERE p.auth_user_id = _user_id AND mr.role = _role
  )
$$;

CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own profile updatable" ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Own roles readable" ON public.member_roles FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

-- CONTACT-SAFE DIRECTORY VIEW (no email/phone)
CREATE VIEW public.member_directory
WITH (security_invoker = false) AS
  SELECT id, wildapricot_contact_id, name, company, title, industry, geography, bio,
         membership_level, membership_status, matching_enabled, avatar_initials,
         last_synced_at, created_at, updated_at
  FROM public.profiles;
GRANT SELECT ON public.member_directory TO authenticated;
GRANT ALL ON public.member_directory TO service_role;

-- OFFERS
CREATE TABLE public.offers (
  id text PRIMARY KEY DEFAULT ('of_' || substr(gen_random_uuid()::text, 1, 8)),
  member_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  geography text NOT NULL DEFAULT '',
  product_service public.product_service_type NOT NULL DEFAULT 'service',
  audience public.audience_type NOT NULL DEFAULT 'b2b',
  keywords text[] NOT NULL DEFAULT '{}',
  status public.listing_status NOT NULL DEFAULT 'active',
  embedding jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Network can read offers" ON public.offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage own offers" ON public.offers FOR ALL TO authenticated
  USING (member_id = public.current_profile_id())
  WITH CHECK (member_id = public.current_profile_id());
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REQUESTS
CREATE TABLE public.requests (
  id text PRIMARY KEY DEFAULT ('rq_' || substr(gen_random_uuid()::text, 1, 8)),
  member_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  geography text NOT NULL DEFAULT '',
  product_service public.product_service_type NOT NULL DEFAULT 'service',
  audience public.audience_type NOT NULL DEFAULT 'b2b',
  keywords text[] NOT NULL DEFAULT '{}',
  status public.listing_status NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  embedding jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Network can read requests" ON public.requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage own requests" ON public.requests FOR ALL TO authenticated
  USING (member_id = public.current_profile_id())
  WITH CHECK (member_id = public.current_profile_id());
CREATE TRIGGER requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MATCHES
CREATE TABLE public.matches (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  offer_id text NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  requester_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  request_excerpt text NOT NULL DEFAULT '',
  offer_excerpt text NOT NULL DEFAULT '',
  reciprocal boolean NOT NULL DEFAULT false,
  reciprocal_match_id text,
  engine text NOT NULL DEFAULT 'deterministic-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Network can read matches" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Participants persist matches" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (requester_id = public.current_profile_id() OR provider_id = public.current_profile_id());
CREATE POLICY "Participants update matches" ON public.matches FOR UPDATE TO authenticated
  USING (requester_id = public.current_profile_id() OR provider_id = public.current_profile_id())
  WITH CHECK (requester_id = public.current_profile_id() OR provider_id = public.current_profile_id());
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MATCH FEEDBACK
CREATE TABLE public.match_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest public.interest_state NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_feedback TO authenticated;
GRANT ALL ON public.match_feedback TO service_role;
ALTER TABLE public.match_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feedback visible to match participants" ON public.match_feedback FOR SELECT TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.requester_id = public.current_profile_id() OR m.provider_id = public.current_profile_id())
    )
  );
CREATE POLICY "Members manage own feedback" ON public.match_feedback FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());
CREATE TRIGGER match_feedback_updated_at BEFORE UPDATE ON public.match_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id text REFERENCES public.matches(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications" ON public.notifications FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());
CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WILDAPRICOT SYNC (upsert by contact id; lapse disables matching, keeps listings)
CREATE OR REPLACE FUNCTION public.sync_wildapricot_contact(
  _contact_id text, _name text, _email text, _phone text, _company text,
  _membership_level text, _membership_status public.membership_status
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id text;
BEGIN
  INSERT INTO public.profiles (id, wildapricot_contact_id, name, email, phone, company,
    membership_level, membership_status, matching_enabled, last_synced_at)
  VALUES ('m_' || substr(md5(_contact_id), 1, 8), _contact_id, _name, _email, _phone, _company,
    _membership_level, _membership_status, _membership_status = 'active', now())
  ON CONFLICT (wildapricot_contact_id) DO UPDATE SET
    name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
    company = EXCLUDED.company, membership_level = EXCLUDED.membership_level,
    membership_status = EXCLUDED.membership_status,
    matching_enabled = (EXCLUDED.membership_status = 'active'),
    last_synced_at = now(), updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.sync_wildapricot_contact(text,text,text,text,text,text,public.membership_status) FROM public, anon, authenticated;

-- SEED DEMO DATA
INSERT INTO public.profiles (id, wildapricot_contact_id, name, email, phone, company, title, industry, geography, bio, membership_level, membership_status, matching_enabled, avatar_initials, last_synced_at) VALUES
 ('m_giulia','WA-48210','Giulia Ferrari','giulia@tenutaferrari.it','+39 051 220 118','Tenuta Ferrari S.r.l.','Export Director','Food & Beverage','Emilia-Romagna, Italy','Third-generation producer of DOP balsamic vinegar and artisanal preserves. Building a long-term presence in the North American specialty retail channel.','Corporate Member','active',true,'GF', now()),
 ('m_marcus','WA-51877','Marcus Bell','marcus@goldenstatefinefoods.com','+1 415 555 0142','Golden State Fine Foods','Managing Partner','Food & Beverage','California, United States','Importer and distributor supplying 340+ independent grocers and restaurant groups across California with authentic European specialty foods.','Corporate Member','active',true,'MB', now()),
 ('m_elena','WA-49004','Elena Rossi','elena@rossibrand.it',NULL,'Rossi Brand Studio','Founder','Design & Marketing','Milan, Italy','Packaging and brand systems for food and beverage exporters entering regulated markets.','Professional Member','active',true,'ER', now() - interval '1 day'),
 ('m_dana','WA-52310','Dana Whitcomb','dana@pacificgatelogistics.com',NULL,'Pacific Gate Logistics','Director of Trade Compliance','Logistics & Trade','San Francisco Bay Area, United States','Licensed customs brokerage and cold-chain freight forwarding for EU-to-US food importers.','Corporate Member','active',true,'DW', now() - interval '2 days'),
 ('m_paolo','WA-44120','Paolo Bianchi','paolo@cantinabianchi.it',NULL,'Cantina Bianchi','Owner','Food & Beverage','Veneto, Italy','Family winery producing Valpolicella and Amarone for the on-trade channel.','Corporate Member','lapsed',false,'PB', now() - interval '9 days'),
 ('m_sofia','WA-10001','Sofia Conti','sofia@italiancommerce.org',NULL,'Italian Commerce Association','Membership Director','Association','New York, United States','Administers member services and business development programs for the association.','Staff','active',true,'SC', now());

INSERT INTO public.member_roles (profile_id, role) VALUES
 ('m_giulia','member'),('m_marcus','member'),('m_elena','member'),('m_dana','member'),('m_paolo','member'),('m_sofia','admin');

INSERT INTO public.offers (id, member_id, title, description, category, industry, geography, product_service, audience, keywords, status, created_at, updated_at) VALUES
 ('of_ferrari_dop','m_giulia','DOP balsamic vinegar and artisanal preserves for import','Certified DOP balsamic vinegar of Modena, aged 12 and 25 years, plus a line of artisanal fruit preserves and truffle condiments. Export-ready: FDA registered facility, bilingual labelling, EU organic certification, container and mixed-pallet volumes. Seeking distribution partners rather than one-off wholesale orders.','Specialty food supply','Food & Beverage','Italy — exporting to North America','product','b2b',ARRAY['balsamic','DOP','specialty food','import','export','distribution','italian'],'active', now() - interval '41 days', now() - interval '6 days'),
 ('of_gsff_distribution','m_marcus','California specialty grocery distribution network','Statewide distribution for imported specialty food brands: 340+ independent grocers, gourmet retail chains and restaurant groups across California. We handle warehousing, temperature-controlled logistics, retailer onboarding, in-store demos and category management for European producers entering the US market.','Distribution & channel access','Food & Beverage','California, United States','service','b2b',ARRAY['distribution','california','specialty food','retail','import','grocery'],'active', now() - interval '60 days', now() - interval '4 days'),
 ('of_rossi_packaging','m_elena','Export packaging and label compliance design','Brand and packaging systems for Italian food producers entering the United States, including FDA-compliant label architecture, nutrition panel typesetting and shelf-impact design for specialty retail.','Brand & packaging design','Design & Marketing','Italy — serving EU and US markets','service','b2b',ARRAY['packaging','label','compliance','branding','specialty food','export'],'active', now() - interval '75 days', now() - interval '20 days'),
 ('of_pacific_customs','m_dana','US customs brokerage and cold-chain import handling','Licensed customs brokerage for EU food importers: FDA prior notice filing, FSVP support, port clearance at Oakland and Long Beach, bonded warehousing and temperature-controlled drayage to distributor DCs.','Logistics & compliance','Logistics & Trade','California, United States','service','b2b',ARRAY['customs','import','logistics','FDA','cold chain','california'],'active', now() - interval '88 days', now() - interval '11 days'),
 ('of_bianchi_wine','m_paolo','Valpolicella and Amarone for US on-trade','Estate-bottled Valpolicella Superiore and Amarone della Valpolicella available for import in mixed pallets, with allocation for restaurant and wine-bar programs.','Specialty beverage supply','Food & Beverage','Veneto, Italy','product','b2b',ARRAY['wine','amarone','import','italian','distribution'],'active', now() - interval '130 days', now() - interval '120 days');

INSERT INTO public.requests (id, member_id, title, description, category, industry, geography, product_service, audience, keywords, status, expires_at, created_at, updated_at) VALUES
 ('rq_ferrari_distributor','m_giulia','Seeking a California distributor for Italian specialty food','We are looking for an established specialty food distributor in California with existing relationships in independent grocery and gourmet retail. Priority is a partner able to import directly, warehouse temperature-sensitive product and run retailer onboarding for an Italian DOP condiment line. Long-term exclusive arrangement preferred over spot wholesale.','Distribution & channel access','Food & Beverage','California, United States','service','b2b',ARRAY['distribution','california','specialty food','retail','import','italian'],'active', now() + interval '90 days', now() - interval '30 days', now() - interval '5 days'),
 ('rq_gsff_producers','m_marcus','Seeking Italian producers of DOP condiments and preserves','Expanding our Italian import portfolio for 2027. Looking for certified Italian producers of DOP balsamic vinegar, artisanal preserves and truffle condiments with export-ready certification and the capacity for consistent container volumes. Producers seeking a long-term distribution partnership are the best fit.','Specialty food supply','Food & Beverage','Italy','product','b2b',ARRAY['italian','DOP','balsamic','specialty food','import','export','preserves'],'active', NULL, now() - interval '22 days', now() - interval '3 days'),
 ('rq_ferrari_customs','m_giulia','US customs and FDA compliance support for food import','Need a licensed customs partner to handle FDA prior notice, FSVP requirements and cold-chain drayage for shipments arriving at West Coast ports.','Logistics & compliance','Logistics & Trade','California, United States','service','b2b',ARRAY['customs','FDA','import','logistics','cold chain'],'active', NULL, now() - interval '14 days', now() - interval '14 days'),
 ('rq_gsff_packaging','m_marcus','Label redesign partner for US market compliance','Looking for a design studio that can adapt European packaging and labels for US retail shelves, including compliant nutrition panels for the brands we import.','Brand & packaging design','Design & Marketing','Italy or United States','service','b2b',ARRAY['packaging','label','compliance','branding','retail'],'active', NULL, now() - interval '48 days', now() - interval '35 days');
