-- public.calendars definition

-- Drop table

-- DROP TABLE public.calendars;

CREATE TABLE public.calendars (
	calendar_id text NOT NULL,
	etag text NULL DEFAULT floor(random() * (99999999 - 10000000 + 1)::double precision + 10000000::double precision)::text,
	created timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
	updated timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
	summary text NULL,
	primary_author_id text NULL,
	CONSTRAINT calendars_pkey PRIMARY KEY (calendar_id),
	CONSTRAINT fk_primary_author_id FOREIGN KEY (primary_author_id) REFERENCES public.logins(uid) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Table Triggers

create trigger update_calendar_etag before
update
    on
    public.calendars for each row execute function update_etag();