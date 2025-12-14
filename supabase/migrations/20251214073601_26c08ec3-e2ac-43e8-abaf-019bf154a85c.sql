-- Add unique constraint on org_id, area_type, area_value for upsert support
ALTER TABLE public.loan_negative_areas 
ADD CONSTRAINT loan_negative_areas_org_area_unique 
UNIQUE (org_id, area_type, area_value);

-- Insert Bihar district headquarters pin codes
INSERT INTO public.loan_negative_areas (org_id, area_type, area_value, reason, is_active)
SELECT 
  p.org_id,
  'pincode',
  pincode,
  'Negative area - ' || district || ', Bihar',
  true
FROM profiles p
CROSS JOIN (VALUES
  ('800001', 'Patna'),
  ('801503', 'Nalanda'),
  ('802301', 'Arwal'),
  ('803101', 'Bihar Sharif'),
  ('804401', 'Jehanabad'),
  ('805110', 'Lakhisarai'),
  ('805130', 'Sheikhpura'),
  ('811101', 'Munger'),
  ('811201', 'Begusarai'),
  ('811301', 'Khagaria'),
  ('812001', 'Bhagalpur'),
  ('812002', 'Banka'),
  ('813110', 'Godda'),
  ('821301', 'Rohtas'),
  ('821305', 'Sasaram'),
  ('821310', 'Kaimur'),
  ('823001', 'Gaya'),
  ('824101', 'Aurangabad'),
  ('824201', 'Nawada'),
  ('841101', 'Saran'),
  ('841219', 'Chapra'),
  ('841301', 'Siwan'),
  ('841401', 'Gopalganj'),
  ('842001', 'Muzaffarpur'),
  ('843101', 'Sitamarhi'),
  ('843301', 'Sheohar'),
  ('844101', 'Vaishali'),
  ('845101', 'East Champaran'),
  ('845401', 'Motihari'),
  ('845438', 'West Champaran'),
  ('846001', 'Darbhanga'),
  ('846004', 'Madhubani'),
  ('847101', 'Samastipur'),
  ('848101', 'Saharsa'),
  ('848102', 'Supaul'),
  ('848201', 'Madhepura'),
  ('851101', 'Khagaria'),
  ('852101', 'Saharsa'),
  ('853201', 'Katihar'),
  ('854101', 'Purnia'),
  ('854301', 'Kishanganj'),
  ('854315', 'Araria'),
  ('855101', 'Jamui')
) AS bihar(pincode, district)
WHERE p.org_id IS NOT NULL
ON CONFLICT (org_id, area_type, area_value) DO NOTHING;

-- Insert Jharkhand district headquarters pin codes
INSERT INTO public.loan_negative_areas (org_id, area_type, area_value, reason, is_active)
SELECT 
  p.org_id,
  'pincode',
  pincode,
  'Negative area - ' || district || ', Jharkhand',
  true
FROM profiles p
CROSS JOIN (VALUES
  ('814101', 'Dumka'),
  ('814110', 'Jamtara'),
  ('814112', 'Deoghar'),
  ('814133', 'Pakur'),
  ('814141', 'Sahebganj'),
  ('815301', 'Giridih'),
  ('815302', 'Koderma'),
  ('816101', 'Godda'),
  ('825301', 'Hazaribagh'),
  ('825302', 'Chatra'),
  ('825401', 'Ramgarh'),
  ('826001', 'Dhanbad'),
  ('827001', 'Bokaro'),
  ('828101', 'Ramgarh'),
  ('829101', 'Gumla'),
  ('829104', 'Simdega'),
  ('829119', 'Khunti'),
  ('831001', 'Jamshedpur'),
  ('832101', 'Seraikela'),
  ('832102', 'Chaibasa'),
  ('833101', 'Garhwa'),
  ('833201', 'Palamu'),
  ('833202', 'Latehar'),
  ('834001', 'Ranchi'),
  ('835101', 'Lohardaga')
) AS jharkhand(pincode, district)
WHERE p.org_id IS NOT NULL
ON CONFLICT (org_id, area_type, area_value) DO NOTHING;