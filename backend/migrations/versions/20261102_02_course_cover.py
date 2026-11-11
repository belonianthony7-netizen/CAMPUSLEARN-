"""Illustrations présélectionnées pour les cours.

Revision ID: 20261102_02
Revises: 20261027_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20261102_02"
down_revision = "20261027_01"
branch_labels = None
depends_on = None


def upgrade():
    # The first migration uses metadata.create_all: new installations already
    # have this column. Older databases need it added explicitly.
    conn = op.get_bind()
    cols = {c['name'] for c in sa.inspect(conn).get_columns('courses')}
    if 'cover_image' not in cols:
        op.add_column('courses', sa.Column('cover_image', sa.String(40), nullable=False, server_default='auto'))


def downgrade():
    conn = op.get_bind()
    cols = {c['name'] for c in sa.inspect(conn).get_columns('courses')}
    if 'cover_image' in cols:
        op.drop_column('courses','cover_image')
