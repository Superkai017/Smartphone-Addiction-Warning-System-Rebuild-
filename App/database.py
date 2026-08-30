"""SQLAlchemy engine, session factory and declarative base for the API.

One file-backed SQLite database (`<repo>/app.db`) holds every scored request so
the frontend can offer a history tab. Nothing in `Src/` reads it - the ML
pipeline stays file-and-artifact based, and the database is purely a record of
what the *service* was asked and what it answered.

Two SQLite-specific details matter here:

* `check_same_thread=False`. SQLite's Python driver refuses by default to use a
  connection from a thread other than the one that opened it. FastAPI runs
  `def` handlers in a threadpool, so a session opened per request routinely
  lands on a different worker thread than the pool that created the connection.
  Disabling the check is safe *because* `SessionLocal` hands every request its
  own session and the pool never shares one connection across two concurrent
  sessions.
* `StaticPool` is deliberately **not** used. It is the usual companion to
  `check_same_thread=False` for in-memory SQLite, but for a file database it
  would serialise every request through a single connection. The default
  `QueuePool` is correct here.

The URL is overridable with `DATABASE_URL`, so the same app can point at
Postgres in a deployment without an edit; `connect_args` is applied only for
SQLite, where it is the only dialect that understands it.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from Src.config import Database_Path

# `sqlite:///<absolute path>` - see `Src.config.Database_Path` for why this is
# absolute rather than the more familiar relative `sqlite:///./app.db`.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{Database_Path}")

_is_sqlite = DATABASE_URL.startswith("sqlite")

engine: Engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # Log SQL when SQL_ECHO=1. Off by default - it is noisy per request.
    echo=os.getenv("SQL_ECHO") == "1",
    future=True,
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        """WAL + enforced foreign keys on every new connection.

        WAL lets the history reader run while a `/api/predict` writes, which is
        exactly the concurrency shape this app has. Both pragmas are per
        connection, not per database, so they belong on the connect event.
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,  # let a committed row still be read for the response
    future=True,
)


class Base(DeclarativeBase):
    """Declarative base every ORM model in `App/models.py` inherits from."""


def init_db() -> None:
    """Create any missing tables. Called from the FastAPI `lifespan`.

    `create_all` is additive and idempotent: it creates what is absent and
    touches nothing that exists. That makes it right for adding a table, and
    **wrong** for changing an existing one - it will not alter a column. See the
    migration note in the README section of this refactor if the schema below
    ever needs to change in place.
    """
    from App import models  # noqa: F401  - registers the mappers on Base.metadata

    Base.metadata.create_all(bind=engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding one session per request, always closed.

    Handlers commit explicitly. The `finally` is what guarantees the connection
    returns to the pool even when a handler raises an `HTTPException`.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
