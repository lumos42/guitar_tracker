"""add last_accessed_at to songs

Revision ID: 003_add_last_accessed_at
Revises: 002_add_download_started_at
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_last_accessed_at"
down_revision = "002_add_download_started_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("last_accessed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("songs", "last_accessed_at")
