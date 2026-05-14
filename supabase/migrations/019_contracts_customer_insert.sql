-- Allow customers to insert their own PENDING_REVIEW contracts
CREATE POLICY "contracts_customer_insert" ON contracts
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND get_my_role() = 'customer'
    AND status = 'PENDING_REVIEW'
  );
