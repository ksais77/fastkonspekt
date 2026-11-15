# Слой хранения: сохраняем результаты.

from datetime import datetime

# ЗАГЛУШКА: вместо базы данных обычный список в памяти.
# После перезапуска всё пропадает. Потом здесь будет PostgreSQL.
_documents: list[dict] = []


def save(filename: str, summary: str) -> dict:
    doc = {
        "id": len(_documents) + 1,
        "filename": filename,
        "summary": summary,
        "created_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
    }
    _documents.append(doc)
    return doc


def list_all() -> list[dict]:
    return list(reversed(_documents))
