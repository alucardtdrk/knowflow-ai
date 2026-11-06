ALTER TABLE guided_steps DROP CONSTRAINT guided_steps_result_check;
ALTER TABLE guided_steps ADD CONSTRAINT guided_steps_result_check
  CHECK (result IN ('worked', 'failed', 'unable', 'answered'));
