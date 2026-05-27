-- Seed verified Rutland VT food resources
-- Run via Supabase MCP or dashboard SQL editor

INSERT INTO resources (name, category, description, address_line1, city, state, zip_code, phone, website, status, source, is_verified, external_id)
VALUES
('BROC Community Action - Food Shelf', 'food', 'Free food shelf providing groceries to families in need. No appointment necessary during open hours.', '45 Union Street', 'Rutland', 'VT', '05701', '802-775-0878', 'https://www.broc.org', 'approved', 'admin_added', true, 'rutland_broc_food'),
('Rutland Area Food Co-op', 'food', 'Community food co-op with affordable groceries and local products.', '77 Wales Street', 'Rutland', 'VT', '05701', '802-773-0737', 'https://www.rutlandcoop.com', 'approved', 'admin_added', true, 'rutland_coop'),
('Vermont Foodbank - Rutland Distribution', 'food', 'Food bank distribution center serving Rutland County. Contact for distribution schedule.', '33 Parker Ave', 'Rutland', 'VT', '05701', '802-476-3341', 'https://www.vtfoodbank.org', 'approved', 'admin_added', true, 'rutland_vt_foodbank'),
('Salvation Army Rutland - Food Pantry', 'food', 'Food pantry providing emergency food assistance. Call ahead for hours and availability.', '2 Roberts Avenue', 'Rutland', 'VT', '05701', '802-775-1553', 'https://www.salvationarmyusa.org', 'approved', 'admin_added', true, 'rutland_salvation_army'),
('Open Door Free Community Kitchen', 'food', 'Free community meals served regularly. Open to everyone, no questions asked.', '7 Stratton Road', 'Rutland', 'VT', '05701', '802-773-9190', 'https://www.facebook.com/TheOpenDoorRutland', 'approved', 'admin_added', true, 'rutland_open_door')
ON CONFLICT (external_id, source) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phone = EXCLUDED.phone,
  website = EXCLUDED.website;
