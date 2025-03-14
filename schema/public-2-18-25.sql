--
-- PostgreSQL database dump
--

-- Dumped from database version 15.3
-- Dumped by pg_dump version 15.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: generate_etag(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_etag() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
	new_tag text;
BEGIN
	new_tag := floor(random() * (99999999 - 10000000 + 1) + 10000000)::text;
	RETURN new_tag;
END;
$$;


ALTER FUNCTION public.generate_etag() OWNER TO postgres;

--
-- Name: on_event_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.on_event_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	update calendars c set updated = current_timestamp where c.calendar_id = new.calendar_id; 
	return new;
END;
$$;


ALTER FUNCTION public.on_event_touch() OWNER TO postgres;

--
-- Name: update_calendar_etag(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_calendar_etag() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	NEW.etag := floor(random() * (99999999 - 10000000 + 1) + 10000000)::text;
	new.updated = current_timestamp;
	return NEW;
END;
$$;


ALTER FUNCTION public.update_calendar_etag() OWNER TO postgres;

--
-- Name: update_etag(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_etag() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	NEW.etag := floor(random() * (99999999 - 10000000 + 1) + 10000000)::text;
	return NEW;
END;
$$;


ALTER FUNCTION public.update_etag() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: calendars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendars (
    calendar_id text NOT NULL,
    etag text DEFAULT (floor(((random() * (((99999999 - 10000000) + 1))::double precision) + (10000000)::double precision)))::text,
    created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    summary text,
    primary_author_id text,
    updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.calendars OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    event_id text NOT NULL,
    etag text DEFAULT (floor(((random() * (((99999999 - 10000000) + 1))::double precision) + (10000000)::double precision)))::text,
    created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    summary text DEFAULT 'New Event'::text,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    color_id text DEFAULT '#0af'::text NOT NULL,
    calendar_id text NOT NULL
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: idempotency; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.idempotency (
    idem_key text NOT NULL,
    uid text NOT NULL,
    outcome jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.idempotency OWNER TO postgres;

--
-- Name: logins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logins (
    email text NOT NULL,
    name text,
    hash text NOT NULL,
    uid text DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logins OWNER TO postgres;

--
-- Name: notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notes (
    note_id text NOT NULL,
    author_id text,
    content text,
    title text,
    summary text GENERATED ALWAYS AS (("substring"(content, 0, 20) || '...'::text)) STORED,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notes OWNER TO postgres;

--
-- Name: calendars calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_pkey PRIMARY KEY (calendar_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (event_id);


--
-- Name: idempotency idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.idempotency
    ADD CONSTRAINT idempotency_pkey PRIMARY KEY (idem_key, uid);


--
-- Name: logins logins_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logins
    ADD CONSTRAINT logins_email_key UNIQUE (email);


--
-- Name: logins logins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logins
    ADD CONSTRAINT logins_pkey PRIMARY KEY (uid);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (note_id);


--
-- Name: foreign_calendar_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX foreign_calendar_index ON public.events USING btree (calendar_id);


--
-- Name: events event_touched; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER event_touched AFTER INSERT OR DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.on_event_touch();


--
-- Name: calendars update_calendar_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_calendar_trigger BEFORE UPDATE ON public.calendars FOR EACH ROW EXECUTE FUNCTION public.update_calendar_etag();


--
-- Name: events update_event_etag; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_event_etag BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_etag();


--
-- Name: events fk_calendar_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT fk_calendar_id FOREIGN KEY (calendar_id) REFERENCES public.calendars(calendar_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendars fk_primary_author_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT fk_primary_author_id FOREIGN KEY (primary_author_id) REFERENCES public.logins(uid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notes notes_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_uid_fkey FOREIGN KEY (author_id) REFERENCES public.logins(uid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO node;


--
-- Name: TABLE calendars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.calendars TO node;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.events TO node;


--
-- Name: TABLE idempotency; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.idempotency TO node;


--
-- Name: TABLE logins; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.logins TO node;


--
-- Name: TABLE notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notes TO node;


--
-- PostgreSQL database dump complete
--

