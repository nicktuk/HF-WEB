"""Fixtures de tests contra PostgreSQL (los modelos usan ENUM/ARRAY de
Postgres). Apuntar TEST_DATABASE_URL a una base descartable, p. ej.:

    TEST_DATABASE_URL=postgresql://postgres@localhost:5432/hf_test pytest

El esquema se crea desde los modelos al arrancar (borrando lo que hubiera) y
cada test corre en una transacción que se descarta al terminar.
"""
import os

import pytest
from sqlalchemy import Enum, create_engine, text
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def engine():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL no está definida")
    import app.models  # noqa: F401 — registra todos los modelos
    from app.models.base import Base

    eng = create_engine(TEST_DATABASE_URL)
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("DROP SCHEMA IF EXISTS import_scorer CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("CREATE SCHEMA import_scorer"))
        # Los ENUM de los modelos se declaran con create_type=False (los crean
        # las migraciones): acá hay que crearlos a mano antes de las tablas.
        for table in Base.metadata.tables.values():
            for col in table.columns:
                if isinstance(col.type, Enum) and col.type.name:
                    col.type.create(conn, checkfirst=True)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    trans.rollback()
    conn.close()
