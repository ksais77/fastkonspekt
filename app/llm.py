# Слой модели: отправляем текст в локальную модель и получаем ответ.

import os

import httpx

# Переключатель: 0 — заглушка, 1 — настоящая модель через Ollama.
USE_OLLAMA = os.getenv("USE_OLLAMA", "0") == "1"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
TIMEOUT = 300 # секунд, как в ФТ-05

SYSTEM_PROMPT = (
    "Ты составляешь конспекты документов на русском языке. "
    "Пиши только по тексту документа, ничего не придумывай. "
    "Оформляй ответ в Markdown. Выдавай только конспект, без вступлений."
)

LENGTHS = {
    "short": "Сделай краткий конспект: только главное.",
    "medium": "Сделай конспект среднего объёма: главное и важные детали.",
    "detailed": "Сделай подробный конспект: сохрани все существенные детали.",
}

STRUCTURES = {
    "theses": "Оформи списком тезисов, каждый пункт начинай с '- '.",
    "blocks": "Раздели на блоки с подзаголовками, начинающимися с '## '.",
}

def ask_model(prompt: str, system: str | None = None) -> str:
    """Единственный вызов Ollama: отправляет запрос, возвращает текст ответа."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = httpx.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": MODEL,
            "stream": False,
            "messages": messages,
            "options": {"num_ctx": 8192},
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["message"]["content"]


def summarize(text: str, length: str = "short", structure: str = "theses") -> str:
    if not USE_OLLAMA:
        return f"Заглушка: модель не подключена. Объём: {length}, структура: {structure}."
    system = " ".join([
        SYSTEM_PROMPT,
        LENGTHS.get(length, LENGTHS["short"]),
        STRUCTURES.get(structure, STRUCTURES["theses"]),
    ])
    return ask_model(text, system=system)