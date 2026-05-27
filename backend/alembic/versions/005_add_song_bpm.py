"""add bpm to songs

Revision ID: 005_add_song_bpm
Revises: 004_dedupe_songs_and_unique_spotify
Create Date: 2026-05-27

"""
from alembic import op
import sqlalchemy as sa

revision = "005_add_song_bpm"
down_revision = "004_dedupe_songs_and_unique_spotify"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("bpm", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("songs", "bpm")
