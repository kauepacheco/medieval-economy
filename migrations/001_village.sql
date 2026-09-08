CREATE TABLE villages (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  total_workers integer NOT NULL CHECK (total_workers > 0),
  busy_workers integer NOT NULL DEFAULT 0 CHECK (busy_workers >= 0 AND busy_workers <= total_workers)
);

-- Whole units: wood bundles and stone blocks. No fractional inventory.
CREATE TABLE inventory (
  village_id uuid NOT NULL REFERENCES villages(id),
  resource text NOT NULL CHECK (resource IN ('wood', 'stone')),
  quantity bigint NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 9007199254740991),
  PRIMARY KEY (village_id, resource)
);

CREATE TABLE production_jobs (
  id uuid PRIMARY KEY,
  village_id uuid NOT NULL REFERENCES villages(id),
  idempotency_key uuid NOT NULL,
  recipe_id text NOT NULL,
  recipe_version integer NOT NULL CHECK (recipe_version > 0),
  workers integer NOT NULL CHECK (workers > 0),
  resource text NOT NULL CHECK (resource IN ('wood', 'stone')),
  output_quantity integer NOT NULL CHECK (output_quantity > 0),
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(inputs) = 'object'),
  started_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL CHECK (due_at > started_at),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed')),
  CHECK ((status = 'running' AND completed_at IS NULL) OR (status = 'completed' AND completed_at >= due_at)),
  UNIQUE (village_id, idempotency_key)
);
CREATE INDEX production_due_idx ON production_jobs (due_at, id) WHERE status = 'running';
CREATE INDEX production_village_idx ON production_jobs (village_id, started_at DESC);

CREATE TABLE inventory_events (
  id uuid PRIMARY KEY,
  village_id uuid NOT NULL REFERENCES villages(id),
  job_id uuid NOT NULL UNIQUE REFERENCES production_jobs(id),
  resource text NOT NULL CHECK (resource IN ('wood', 'stone')),
  quantity integer NOT NULL CHECK (quantity > 0),
  occurred_at timestamptz NOT NULL
);
