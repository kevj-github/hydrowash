-- Extend handle_new_user() to also persist address fields captured at signup.
-- Previously only name/phone were read from raw_user_meta_data, so an address
-- entered on the register page was silently discarded whenever email
-- verification was required (data.session is null at that point, so the
-- register page's post-signup profiles.update() call never ran).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, name, phone, role,
    address, address_lat, address_lng, postal_code, unit_floor, building_name
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'customer',
    NEW.raw_user_meta_data->>'address',
    (NEW.raw_user_meta_data->>'address_lat')::double precision,
    (NEW.raw_user_meta_data->>'address_lng')::double precision,
    NEW.raw_user_meta_data->>'postal_code',
    NEW.raw_user_meta_data->>'unit_floor',
    NEW.raw_user_meta_data->>'building_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
