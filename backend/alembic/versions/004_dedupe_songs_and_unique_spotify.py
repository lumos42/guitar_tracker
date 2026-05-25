"""dedupe songs and enforce unique spotify track per user

Revision ID: 004_dedupe_songs_and_unique_spotify
Revises: 003_add_last_accessed_at
Create Date: 2026-05-25

"""
from alembic import op
import sqlalchemy as sa

revision = "004_dedupe_songs_and_unique_spotify"
down_revision = "003_add_last_accessed_at"
branch_labels = None
depends_on = None


def _soft_delete_duplicate_songs() -> None:
    conn = op.get_bind()

    # Keep the richest row per user + spotify track (album art, download, recency).
    conn.execute(sa.text("""
        WITH ranked AS (
            SELECT id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, spotify_track_id
                    ORDER BY
                        (album_art_url IS NOT NULL) DESC,
                        (local_file_path IS NOT NULL) DESC,
                        last_accessed_at DESC,
                        id ASC
                ) AS rn
            FROM songs
            WHERE deleted_at IS NULL
              AND spotify_track_id IS NOT NULL
        )
        UPDATE songs
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    """))

    # Also collapse title/artist duplicates (e.g. retries without spotify_track_id).
    conn.execute(sa.text("""
        WITH ranked AS (
            SELECT id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, lower(title), lower(artist)
                    ORDER BY
                        (spotify_track_id IS NOT NULL) DESC,
                        (album_art_url IS NOT NULL) DESC,
                        (local_file_path IS NOT NULL) DESC,
                        last_accessed_at DESC,
                        id ASC
                ) AS rn
            FROM songs
            WHERE deleted_at IS NULL
        )
        UPDATE songs
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    """))


def upgrade() -> None:
    _soft_delete_duplicate_songs()

    with op.batch_alter_table("songs") as batch_op:
        batch_op.drop_index("ix_songs_user_spotify")

    op.create_index(
        "uq_songs_user_spotify_active",
        "songs",
        ["user_id", "spotify_track_id"],
        unique=True,
        sqlite_where=sa.text("spotify_track_id IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_songs_user_spotify_active", table_name="songs")
    op.create_index("ix_songs_user_spotify", "songs", ["user_id", "spotify_track_id"])
