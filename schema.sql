--
-- PostgreSQL database dump
--

\restrict svlvJkzSTCymPytsFyOiJf58d8PlSjylTt3iizJk0jubPUplfvlcVZhYQ4pSwyC

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asistencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencias (
    id integer NOT NULL,
    horario_id integer,
    usuario_id integer,
    fecha date NOT NULL,
    asistio boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: asistencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asistencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asistencias_id_seq OWNED BY public.asistencias.id;


--
-- Name: clases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clases (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    rama character varying(50) NOT NULL,
    profesor_id integer,
    descripcion text,
    duracion integer DEFAULT 60,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: clases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clases_id_seq OWNED BY public.clases.id;


--
-- Name: ejercicios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ejercicios (
    id integer NOT NULL,
    sesion_id integer,
    nombre character varying(100) NOT NULL,
    series integer,
    repeticiones character varying(50),
    orden integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ejercicios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ejercicios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ejercicios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ejercicios_id_seq OWNED BY public.ejercicios.id;


--
-- Name: horarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios (
    id integer NOT NULL,
    clase_id integer,
    dia_semana character varying(20) NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    cupos_totales integer NOT NULL,
    cupos_disponibles integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: horarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.horarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: horarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.horarios_id_seq OWNED BY public.horarios.id;


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id integer NOT NULL,
    reserva_id integer,
    monto numeric(10,2) NOT NULL,
    metodo character varying(50) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_id_seq OWNED BY public.pagos.id;


--
-- Name: reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas (
    id integer NOT NULL,
    usuario_id integer,
    horario_id integer,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    tipo character varying(20) NOT NULL,
    total numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: reservas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reservas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reservas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reservas_id_seq OWNED BY public.reservas.id;


--
-- Name: rutinas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rutinas (
    id integer NOT NULL,
    profesor_id integer,
    alumno_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: rutinas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rutinas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rutinas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rutinas_id_seq OWNED BY public.rutinas.id;


--
-- Name: sesiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones (
    id integer NOT NULL,
    rutina_id integer,
    nombre character varying(100) NOT NULL,
    orden integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: sesiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sesiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sesiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sesiones_id_seq OWNED BY public.sesiones.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    dni character varying(20) NOT NULL,
    telefono character varying(20),
    rol character varying(20) DEFAULT 'alumno'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: asistencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias ALTER COLUMN id SET DEFAULT nextval('public.asistencias_id_seq'::regclass);


--
-- Name: clases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases ALTER COLUMN id SET DEFAULT nextval('public.clases_id_seq'::regclass);


--
-- Name: ejercicios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicios ALTER COLUMN id SET DEFAULT nextval('public.ejercicios_id_seq'::regclass);


--
-- Name: horarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios ALTER COLUMN id SET DEFAULT nextval('public.horarios_id_seq'::regclass);


--
-- Name: pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id SET DEFAULT nextval('public.pagos_id_seq'::regclass);


--
-- Name: reservas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas ALTER COLUMN id SET DEFAULT nextval('public.reservas_id_seq'::regclass);


--
-- Name: rutinas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutinas ALTER COLUMN id SET DEFAULT nextval('public.rutinas_id_seq'::regclass);


--
-- Name: sesiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones ALTER COLUMN id SET DEFAULT nextval('public.sesiones_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: asistencias asistencias_horario_id_usuario_id_fecha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_horario_id_usuario_id_fecha_key UNIQUE (horario_id, usuario_id, fecha);


--
-- Name: asistencias asistencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_pkey PRIMARY KEY (id);


--
-- Name: clases clases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases
    ADD CONSTRAINT clases_pkey PRIMARY KEY (id);


--
-- Name: ejercicios ejercicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicios
    ADD CONSTRAINT ejercicios_pkey PRIMARY KEY (id);


--
-- Name: horarios horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: reservas reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);


--
-- Name: rutinas rutinas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutinas
    ADD CONSTRAINT rutinas_pkey PRIMARY KEY (id);


--
-- Name: sesiones sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_dni_key UNIQUE (dni);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: asistencias asistencias_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horarios(id);


--
-- Name: asistencias asistencias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: clases clases_profesor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases
    ADD CONSTRAINT clases_profesor_id_fkey FOREIGN KEY (profesor_id) REFERENCES public.usuarios(id);


--
-- Name: ejercicios ejercicios_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicios
    ADD CONSTRAINT ejercicios_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.sesiones(id) ON DELETE CASCADE;


--
-- Name: horarios horarios_clase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_clase_id_fkey FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE;


--
-- Name: pagos pagos_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id);


--
-- Name: reservas reservas_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horarios(id);


--
-- Name: reservas reservas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: rutinas rutinas_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutinas
    ADD CONSTRAINT rutinas_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.usuarios(id);


--
-- Name: rutinas rutinas_profesor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutinas
    ADD CONSTRAINT rutinas_profesor_id_fkey FOREIGN KEY (profesor_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones sesiones_rutina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_rutina_id_fkey FOREIGN KEY (rutina_id) REFERENCES public.rutinas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict svlvJkzSTCymPytsFyOiJf58d8PlSjylTt3iizJk0jubPUplfvlcVZhYQ4pSwyC

