"""Apply the shipped schema and idempotent multiview migration."""
from pathlib import Path
import sys,psycopg
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml'))
from wine_ml.config import DATABASE_URL
with psycopg.connect(DATABASE_URL) as conn:
    for path in [ROOT/'db/init.sql',ROOT/'db/migrations/002_views.sql']:
        conn.execute(path.read_text(encoding='utf-8'),prepare=False)
print('Database schema ready')
