"""add download_started_at to songs

Revision ID: 002_add_download_started_at
Revises: 001_add_song_download_fields
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_download_started_at"
down_revision = "001_add_song_download_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("download_started_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("songs", "download_started_at")
