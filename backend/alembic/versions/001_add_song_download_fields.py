"""add download_status and local_file_path to songs

Revision ID: 001_add_song_download_fields
Revises:
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa

revision = "001_add_song_download_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("download_status", sa.String(20), nullable=True))
    op.add_column("songs", sa.Column("local_file_path", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("songs", "local_file_path")
    op.drop_column("songs", "download_status")
