"""live rooms: players, hands, session players

Revision ID: a1c4e7d90b21
Revises: 8735431504e8
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "a1c4e7d90b21"
down_revision = "8735431504e8"
branch_labels = None
depends_on = None

NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "players",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("external_user_id", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_players")),
        sa.UniqueConstraint("external_user_id", name=op.f("uq_players_external_user_id")),
    )

    op.add_column(
        "game_sessions",
        sa.Column("kind", sa.String(length=20), server_default="upload", nullable=False),
    )
    op.add_column("game_sessions", sa.Column("room_code", sa.String(length=12), nullable=True))
    op.add_column("game_sessions", sa.Column("host_player_id", sa.Uuid(), nullable=True))
    op.add_column(
        "game_sessions",
        sa.Column(
            "settings", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
    )
    op.add_column("game_sessions", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        op.f("fk_game_sessions_host_player_id_players"),
        "game_sessions",
        "players",
        ["host_player_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "session_players",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("starting_chips", sa.Integer(), nullable=False),
        sa.Column("final_chips", sa.Integer(), nullable=True),
        sa.Column("hands_played", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["game_sessions.id"],
            name=op.f("fk_session_players_session_id_game_sessions"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["players.id"],
            name=op.f("fk_session_players_player_id_players"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_players")),
        sa.UniqueConstraint("session_id", "player_id", name="uq_session_players_session_player"),
    )
    op.create_index(op.f("ix_session_players_session_id"), "session_players", ["session_id"])
    op.create_index(op.f("ix_session_players_player_id"), "session_players", ["player_id"])

    op.create_table(
        "hands",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("board", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("pot", sa.Integer(), nullable=False),
        sa.Column("winners", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "shown", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["game_sessions.id"],
            name=op.f("fk_hands_session_id_game_sessions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_hands")),
        sa.UniqueConstraint("session_id", "number", name="uq_hands_session_number"),
    )
    op.create_index(op.f("ix_hands_session_id"), "hands", ["session_id"])

    op.add_column("decisions", sa.Column("player_id", sa.Uuid(), nullable=True))
    op.add_column("decisions", sa.Column("hand_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_decisions_player_id_players"),
        "decisions",
        "players",
        ["player_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_decisions_hand_id_hands"),
        "decisions",
        "hands",
        ["hand_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_decisions_player_id"), "decisions", ["player_id"])
    op.create_index(op.f("ix_decisions_hand_id"), "decisions", ["hand_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_decisions_hand_id"), table_name="decisions")
    op.drop_index(op.f("ix_decisions_player_id"), table_name="decisions")
    op.drop_constraint(op.f("fk_decisions_hand_id_hands"), "decisions", type_="foreignkey")
    op.drop_constraint(op.f("fk_decisions_player_id_players"), "decisions", type_="foreignkey")
    op.drop_column("decisions", "hand_id")
    op.drop_column("decisions", "player_id")
    op.drop_index(op.f("ix_hands_session_id"), table_name="hands")
    op.drop_table("hands")
    op.drop_index(op.f("ix_session_players_player_id"), table_name="session_players")
    op.drop_index(op.f("ix_session_players_session_id"), table_name="session_players")
    op.drop_table("session_players")
    op.drop_constraint(
        op.f("fk_game_sessions_host_player_id_players"), "game_sessions", type_="foreignkey"
    )
    for column in ("ended_at", "settings", "host_player_id", "room_code", "kind"):
        op.drop_column("game_sessions", column)
    op.drop_table("players")
