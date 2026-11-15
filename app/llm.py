# Слой модели: отправляем текст в локальную модель и получаем ответ.

import os

import httpx

# Переключатель: 0 — заглушка, 1 — настоящая модель через Ollama.
USE_OLLAMA = os.getenv("USE_OLLAMA", "0") == "1"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")

SYSTEM_PROMPT = (
    "Ты кратко пересказываешь документы на русском языке. "
    "Пиши 3–5 предложений, только по тексту документа, ничего не придумывай."
)


def summarize(text: str) -> str:
    if not USE_OLLAMA:
        # ЗАГЛУШКА: модель ещё не подключена, но весь путь запроса уже работает.
        return "Краткое содержание (заглушка): модель пока не подключена."

    # НАСТОЯЩИЙ ВЫЗОВ: один запрос к Ollama.
    response = httpx.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": MODEL,
            "stream": False,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["message"]["content"]
