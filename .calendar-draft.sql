--

DROP TABLE IF EXISTS public.calendars;
CREATE TABLE public.calendars (
calendar_id text NOT NULL,
etag text DEFAULT floor(random() * (99999999 - 10000000 + 1) + 10000000)::text,
created timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
updated timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
summary text NULL,
CONSTRAINT calendars_pkey PRIMARY KEY (calendar_id)
);

--

CREATE OR REPLACE FUNCTION update_etag()
RETURNS TRIGGER AS $$
BEGIN
	NEW.etag := floor(random() * (99999999 - 10000000 + 1) + 10000000)::text;
	NEW.updated := current_timestamp;
	return NEW;
END;
$$ LANGUAGE plpgsql;

--

CREATE TRIGGER update_calendar_etag
BEFORE UPDATE ON calendars
FOR EACH ROW
EXECUTE FUNCTION update_etag();

--
