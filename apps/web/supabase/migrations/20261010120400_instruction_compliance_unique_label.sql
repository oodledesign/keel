-- Prevent duplicate compliance checklist seed rows under concurrent opens.
CREATE UNIQUE INDEX IF NOT EXISTS instruction_compliance_items_instruction_label_uidx
  ON public.instruction_compliance_items (instruction_id, label);
