--
-- PostgreSQL database dump
--

\restrict ocHzxVu2bxMlnYHDyZrzK4EMou81e7yCW9vy948nBryQ6KmUYSU23YuJJCNzgln

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
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id integer NOT NULL,
    usuario_id integer,
    accion character varying(60) NOT NULL,
    entidad character varying(40),
    entidad_id integer,
    afectado_id integer,
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


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
-- Name: config_cuota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_cuota (
    id integer DEFAULT 1 NOT NULL,
    modo_vencimiento character varying(20) DEFAULT 'mensual'::character varying NOT NULL,
    dia_vencimiento integer DEFAULT 10 NOT NULL,
    dias_gracia integer DEFAULT 6 NOT NULL,
    precio numeric(10,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT config_cuota_dia_vencimiento_check CHECK (((dia_vencimiento >= 1) AND (dia_vencimiento <= 28))),
    CONSTRAINT config_cuota_dias_gracia_check CHECK (((dias_gracia >= 0) AND (dias_gracia <= 30))),
    CONSTRAINT config_cuota_id_check CHECK ((id = 1)),
    CONSTRAINT config_cuota_modo_vencimiento_check CHECK (((modo_vencimiento)::text = ANY ((ARRAY['mensual'::character varying, 'dia_fijo'::character varying])::text[]))),
    CONSTRAINT config_cuota_precio_check CHECK ((precio >= (0)::numeric))
);


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
-- Name: fotos_socio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fotos_socio (
    usuario_id integer NOT NULL,
    imagen bytea NOT NULL,
    tipo character varying(20) DEFAULT 'image/jpeg'::character varying NOT NULL,
    cargada_por integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fotos_socio_imagen_check CHECK ((octet_length(imagen) <= 102400)),
    CONSTRAINT fotos_socio_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['image/jpeg'::character varying, 'image/webp'::character varying])::text[])))
);


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
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT horarios_cupos_check CHECK (((cupos_totales > 0) AND ((cupos_disponibles >= 0) AND (cupos_disponibles <= cupos_totales)))),
    CONSTRAINT horarios_dia_semana_check CHECK (((dia_semana)::text = ANY ((ARRAY['Lunes'::character varying, 'Martes'::character varying, 'Miércoles'::character varying, 'Jueves'::character varying, 'Viernes'::character varying, 'Sábado'::character varying, 'Domingo'::character varying])::text[]))),
    CONSTRAINT horarios_horas_check CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT horarios_precio_check CHECK ((precio >= (0)::numeric))
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
-- Name: ingresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingresos (
    id integer NOT NULL,
    usuario_id integer,
    dni character varying(12) NOT NULL,
    resultado character varying(20) NOT NULL,
    registrado_por integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id_local character varying(40),
    CONSTRAINT ingresos_resultado_check CHECK (((resultado)::text = ANY ((ARRAY['al_dia'::character varying, 'gracia'::character varying, 'vencida'::character varying, 'sin_cuota'::character varying, 'personal'::character varying, 'baja'::character varying, 'no_registrado'::character varying])::text[])))
);


--
-- Name: ingresos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingresos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingresos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingresos_id_seq OWNED BY public.ingresos.id;


--
-- Name: lista_espera; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lista_espera (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    horario_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lista_espera_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lista_espera_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lista_espera_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lista_espera_id_seq OWNED BY public.lista_espera.id;


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id integer NOT NULL,
    reserva_id integer,
    monto numeric(10,2) NOT NULL,
    metodo character varying(50) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pagos_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagado'::character varying, 'rechazado'::character varying])::text[]))),
    CONSTRAINT pagos_metodo_check CHECK (((metodo)::text = ANY ((ARRAY['efectivo'::character varying, 'mercadopago'::character varying])::text[]))),
    CONSTRAINT pagos_monto_check CHECK ((monto >= (0)::numeric))
);


--
-- Name: pagos_cuota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_cuota (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    metodo character varying(20) NOT NULL,
    meses integer DEFAULT 1 NOT NULL,
    vence_anterior date,
    vence_nuevo date NOT NULL,
    registrado_por integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pagos_cuota_meses_check CHECK (((meses >= 1) AND (meses <= 12))),
    CONSTRAINT pagos_cuota_metodo_check CHECK (((metodo)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'mercadopago'::character varying, 'otro'::character varying])::text[]))),
    CONSTRAINT pagos_cuota_monto_check CHECK ((monto >= (0)::numeric))
);


--
-- Name: pagos_cuota_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_cuota_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_cuota_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_cuota_id_seq OWNED BY public.pagos_cuota.id;


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
-- Name: plantillas_rutina; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas_rutina (
    id integer NOT NULL,
    nombre character varying(80) NOT NULL,
    creador_id integer,
    sesiones jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plantillas_rutina_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantillas_rutina_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_rutina_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantillas_rutina_id_seq OWNED BY public.plantillas_rutina.id;


--
-- Name: progreso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progreso (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    medida character varying(40) NOT NULL,
    valor numeric(7,2) NOT NULL,
    unidad character varying(10) NOT NULL,
    fecha date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT progreso_valor_check CHECK (((valor > (0)::numeric) AND (valor < (10000)::numeric)))
);


--
-- Name: progreso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.progreso_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: progreso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.progreso_id_seq OWNED BY public.progreso.id;


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
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reservas_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagado'::character varying, 'cancelado'::character varying])::text[]))),
    CONSTRAINT reservas_fechas_check CHECK ((fecha_fin >= fecha_inicio)),
    CONSTRAINT reservas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['semanal'::character varying, 'quincenal'::character varying])::text[]))),
    CONSTRAINT reservas_total_check CHECK ((total >= (0)::numeric))
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
-- Name: turnos_profe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turnos_profe (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    CONSTRAINT turnos_profe_fin_check CHECK (((fin IS NULL) OR (fin >= inicio)))
);


--
-- Name: turnos_profe_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.turnos_profe_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: turnos_profe_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.turnos_profe_id_seq OWNED BY public.turnos_profe.id;


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
    created_at timestamp without time zone DEFAULT now(),
    debe_cambiar_password boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    apto_vence date,
    cuota_vence date,
    CONSTRAINT usuarios_rol_check CHECK (((rol)::text = ANY ((ARRAY['alumno'::character varying, 'profesor'::character varying, 'profesional'::character varying, 'admin'::character varying, 'recepcion'::character varying])::text[])))
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
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


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
-- Name: ingresos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos ALTER COLUMN id SET DEFAULT nextval('public.ingresos_id_seq'::regclass);


--
-- Name: lista_espera id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_espera ALTER COLUMN id SET DEFAULT nextval('public.lista_espera_id_seq'::regclass);


--
-- Name: pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id SET DEFAULT nextval('public.pagos_id_seq'::regclass);


--
-- Name: pagos_cuota id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_cuota ALTER COLUMN id SET DEFAULT nextval('public.pagos_cuota_id_seq'::regclass);


--
-- Name: plantillas_rutina id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_rutina ALTER COLUMN id SET DEFAULT nextval('public.plantillas_rutina_id_seq'::regclass);


--
-- Name: progreso id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso ALTER COLUMN id SET DEFAULT nextval('public.progreso_id_seq'::regclass);


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
-- Name: turnos_profe id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_profe ALTER COLUMN id SET DEFAULT nextval('public.turnos_profe_id_seq'::regclass);


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
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: clases clases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases
    ADD CONSTRAINT clases_pkey PRIMARY KEY (id);


--
-- Name: config_cuota config_cuota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_cuota
    ADD CONSTRAINT config_cuota_pkey PRIMARY KEY (id);


--
-- Name: ejercicios ejercicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicios
    ADD CONSTRAINT ejercicios_pkey PRIMARY KEY (id);


--
-- Name: fotos_socio fotos_socio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_socio
    ADD CONSTRAINT fotos_socio_pkey PRIMARY KEY (usuario_id);


--
-- Name: horarios horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey PRIMARY KEY (id);


--
-- Name: ingresos ingresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_pkey PRIMARY KEY (id);


--
-- Name: lista_espera lista_espera_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_espera
    ADD CONSTRAINT lista_espera_pkey PRIMARY KEY (id);


--
-- Name: lista_espera lista_espera_usuario_id_horario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_espera
    ADD CONSTRAINT lista_espera_usuario_id_horario_id_key UNIQUE (usuario_id, horario_id);


--
-- Name: pagos_cuota pagos_cuota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_cuota
    ADD CONSTRAINT pagos_cuota_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_reserva_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_reserva_id_key UNIQUE (reserva_id);


--
-- Name: plantillas_rutina plantillas_rutina_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_rutina
    ADD CONSTRAINT plantillas_rutina_pkey PRIMARY KEY (id);


--
-- Name: progreso progreso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso
    ADD CONSTRAINT progreso_pkey PRIMARY KEY (id);


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
-- Name: rutinas rutinas_profesor_alumno_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutinas
    ADD CONSTRAINT rutinas_profesor_alumno_key UNIQUE (profesor_id, alumno_id);


--
-- Name: sesiones sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_pkey PRIMARY KEY (id);


--
-- Name: turnos_profe turnos_profe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_profe
    ADD CONSTRAINT turnos_profe_pkey PRIMARY KEY (id);


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
-- Name: idx_auditoria_afectado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_afectado ON public.auditoria USING btree (afectado_id);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_fecha ON public.auditoria USING btree (creado_en DESC);


--
-- Name: idx_turnos_profe_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turnos_profe_inicio ON public.turnos_profe USING btree (inicio DESC);


--
-- Name: ingresos_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingresos_fecha_idx ON public.ingresos USING btree (created_at);


--
-- Name: ingresos_id_local_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ingresos_id_local_idx ON public.ingresos USING btree (id_local) WHERE (id_local IS NOT NULL);


--
-- Name: ingresos_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingresos_usuario_idx ON public.ingresos USING btree (usuario_id, created_at DESC);


--
-- Name: lista_espera_horario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lista_espera_horario_idx ON public.lista_espera USING btree (horario_id);


--
-- Name: pagos_cuota_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_cuota_fecha_idx ON public.pagos_cuota USING btree (created_at);


--
-- Name: pagos_cuota_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_cuota_usuario_idx ON public.pagos_cuota USING btree (usuario_id, created_at DESC);


--
-- Name: plantillas_rutina_nombre_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plantillas_rutina_nombre_idx ON public.plantillas_rutina USING btree (lower((nombre)::text));


--
-- Name: progreso_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX progreso_usuario_idx ON public.progreso USING btree (usuario_id, medida, fecha);


--
-- Name: turno_abierto_por_profe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX turno_abierto_por_profe ON public.turnos_profe USING btree (usuario_id) WHERE (fin IS NULL);


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
-- Name: auditoria auditoria_afectado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_afectado_id_fkey FOREIGN KEY (afectado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


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
-- Name: fotos_socio fotos_socio_cargada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_socio
    ADD CONSTRAINT fotos_socio_cargada_por_fkey FOREIGN KEY (cargada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: fotos_socio fotos_socio_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_socio
    ADD CONSTRAINT fotos_socio_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: horarios horarios_clase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_clase_id_fkey FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE;


--
-- Name: ingresos ingresos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: ingresos ingresos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: lista_espera lista_espera_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_espera
    ADD CONSTRAINT lista_espera_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horarios(id) ON DELETE CASCADE;


--
-- Name: lista_espera lista_espera_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_espera
    ADD CONSTRAINT lista_espera_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: pagos_cuota pagos_cuota_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_cuota
    ADD CONSTRAINT pagos_cuota_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: pagos_cuota pagos_cuota_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_cuota
    ADD CONSTRAINT pagos_cuota_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: pagos pagos_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id);


--
-- Name: plantillas_rutina plantillas_rutina_creador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_rutina
    ADD CONSTRAINT plantillas_rutina_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: progreso progreso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso
    ADD CONSTRAINT progreso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


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
-- Name: turnos_profe turnos_profe_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_profe
    ADD CONSTRAINT turnos_profe_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ocHzxVu2bxMlnYHDyZrzK4EMou81e7yCW9vy948nBryQ6KmUYSU23YuJJCNzgln


--
-- Datos que la app necesita para arrancar (no son datos de prueba).
-- config_cuota tiene una sola fila: sin ella la cuota y la puerta no funcionan.
--

INSERT INTO public.config_cuota (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
